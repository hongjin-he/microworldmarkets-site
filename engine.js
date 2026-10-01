/* MicroWorld Scenario Lab v1.0.0 — illustrative, uncalibrated mechanism engine. */
(function(root){
'use strict';
const VERSION='mw-lab-1.0.0';
const PRESETS={
 repricing:{name:'Equity repricing',description:'A sharp equity shock meets volatility budgets, trend signals and drawdown limits.',shock:4,depth:75,crowding:60,profile:[1,.28,-.12,.08,0,-.06,0,-.04,0,0],bondBeta:-.12},
 liquidity:{name:'Liquidity squeeze',description:'The same kinds of selling meet less market depth. Inspect how the transmission changes.',shock:3,depth:40,crowding:80,profile:[1,.35,.15,-.12,.04,0,-.05,0,0,-.03],bondBeta:.18},
 rates:{name:'Rates repricing',description:'Equities and duration reprice together. Bonds are no longer a hedge under this assumption.',shock:3.5,depth:85,crowding:50,profile:[1,.3,.15,-.15,.05,-.05,0,0,-.03,0],bondBeta:.6}
};
const DEFAULT={scenario:'repricing',shock:4,depth:75,crowding:60,seed:42,weights:[65,25,10,0],agents:{vol:true,trend:true,levered:true}};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function validate(c){
 if(!c||!PRESETS[c.scenario])throw new Error('Choose a supported scenario.');
 for(const [k,min,max] of [['shock',0,10],['depth',25,150],['crowding',0,100],['seed',1,999999]])if(!Number.isFinite(c[k])||c[k]<min||c[k]>max||(k==='seed'&&!Number.isInteger(c[k])))throw new Error(`Invalid ${k}; expected ${min}–${max}.`);
 if(!Array.isArray(c.weights)||c.weights.length!==4||c.weights.some(x=>!Number.isFinite(x)||x<0||x>100))throw new Error('Each portfolio weight must be between 0 and 100%.');
 if(Math.abs(c.weights.reduce((a,b)=>a+b,0)-100)>.000001)throw new Error('Portfolio weights must add up to 100%.');
 if(!c.agents||['vol','trend','levered'].some(k=>typeof c.agents[k]!=='boolean'))throw new Error('Participant switches must be true or false.');
 return c;
}
function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function path(c,feedback,impactMultiplier=1){
 const scenario=PRESETS[c.scenario],random=rng(c.seed),weights=c.weights.map(w=>w/100);
 let market=100,portfolio=100,peak=100,variance=(.12/Math.sqrt(252))**2,positions={vol:1,trend:1,levered:1},assets=[100,100,100,100],history=[.004,.003,.002];
 const rows=[{step:0,market,portfolio,assets:[...assets],external:0,marketReturn:0,impact:0,depth:c.depth/100,volatility:12,flows:{vol:0,trend:0,levered:0},positions:{...positions},events:[]}];
 for(let step=1;step<=10;step++){
  const lagVol=Math.sqrt(variance*252),lagTrend=history.slice(-3).reduce((a,b)=>a+b,0),lagDrawdown=1-market/peak;
  const targets={vol:Math.min(1,.12/Math.max(.12,lagVol)),trend:clamp(1+lagTrend*12,0,1),levered:lagDrawdown>.035?.5:1};
  const flows={vol:0,trend:0,levered:0};const events=[];
  if(feedback)for(const key of ['vol','trend','levered'])if(c.agents[key]){
   const rate={vol:.55,trend:.4,levered:.65}[key];
   flows[key]=(targets[key]-positions[key])*rate;
   positions[key]+=flows[key];
   if(Math.abs(flows[key])>.006)events.push({agent:key,action:flows[key]<0?'reduces exposure':'rebuilds exposure',change:flows[key]*100,reason:key==='vol'?`Lagged volatility ${(lagVol*100).toFixed(1)}% versus 12% target`:key==='trend'?`Lagged 3-step return ${(lagTrend*100).toFixed(2)}%`:`Lagged drawdown ${(lagDrawdown*100).toFixed(2)}% versus 3.5% limit`});
  }
  const depth=(c.depth/100)/(1+2*Math.max(0,lagVol-.12));
  const flow=.45*flows.vol+.35*flows.trend+.2*flows.levered;
  const impact=feedback?impactMultiplier*.12*(c.crowding/100)*flow/depth:0;
  // A shared seed produces identical small exogenous perturbations in all comparisons.
  const external=-(c.shock/100)*scenario.profile[step-1]+(random()-.5)*.001*(c.shock/4);
  const marketReturn=external+impact;
  if(!Number.isFinite(marketReturn)||Math.abs(marketReturn)>.35)throw new Error(`Outside the demo’s modeling range at step ${step}: a one-step market move exceeds 35%. Reduce the shock or participation, or increase depth. No result is released.`);
  market*=1+marketReturn;peak=Math.max(peak,market);
  const returns=[1.35*marketReturn,marketReturn,scenario.bondBeta*external+.08*impact,0];
  assets=assets.map((a,i)=>a*(1+returns[i]));portfolio=assets.reduce((sum,a,i)=>sum+a*weights[i],0);
  rows.push({step,market,portfolio,assets:[...assets],external,marketReturn,impact,depth,volatility:lagVol*100,flows:{...flows},positions:{...positions},events});
  variance=.82*variance+.18*marketReturn**2;history.push(marketReturn);
 }
 return rows;
}
function maxDrawdown(rows){let peak=100,max=0;for(const row of rows){peak=Math.max(peak,row.portfolio);max=Math.max(max,1-row.portfolio/peak);}return max*100;}
function run(config){const c=JSON.parse(JSON.stringify(config));validate(c);const active=path(c,true),baseline=path(c,false),low=path(c,true,.75),high=path(c,true,1.25);return{version:VERSION,evidence:'Synthetic illustration; uncalibrated. Not a forecast or a confidence interval.',config:c,active,baseline,sensitivity:{low,high,assumption:'Market impact coefficient at 0.75× and 1.25×; parameter sensitivity only.'},metrics:{activeReturn:active[10].portfolio-100,baselineReturn:baseline[10].portfolio-100,feedbackDifference:active[10].portfolio-baseline[10].portfolio,maxDrawdown:maxDrawdown(active),firstTrigger:active.find(r=>r.events.length)?.step??null}};}
const api={VERSION,PRESETS,DEFAULT,validate,run};root.MicroWorldEngine=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
