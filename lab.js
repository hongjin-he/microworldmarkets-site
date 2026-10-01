'use strict';
const E=window.MicroWorldEngine,$=id=>document.getElementById(id),fmt=(n,d=2)=>`${n>0?'+':''}${n.toFixed(d)}`,names={vol:'Vol-control',trend:'Trend followers',levered:'Leveraged funds'};
let result=null,step=0,replayTimer=null,dirty=false,tourStep=0;
function config(){return{scenario:$('scenario').value,shock:Number($('shock').value),depth:Number($('depth').value),crowding:Number($('crowding').value),seed:$('seed').value===''?NaN:Number($('seed').value),weights:[0,1,2,3].map(i=>$('w'+i).value===''?NaN:Number($('w'+i).value)),agents:{vol:$('vol').checked,trend:$('trend').checked,levered:$('levered').checked}};}
function load(c){for(const k of ['scenario','shock','depth','crowding','seed'])$(k).value=c[k];c.weights.forEach((w,i)=>$('w'+i).value=w);for(const k in c.agents)$(k).checked=c.agents[k];labels();}
function labels(){const c=config();$('shock-out').textContent=`−${c.shock.toFixed(1)}%`;$('depth-out').textContent=c.depth+'%';$('crowding-out').textContent=c.crowding+'%';const sum=c.weights.reduce((a,b)=>a+b,0);$('weight-total').textContent=`Total allocation: ${Number.isFinite(sum)?sum:'—'}%${sum!==100?' · Must equal 100%':''}`;$('weight-total').style.color=sum===100?'':'#f1b195';}
function stopReplay(){clearInterval(replayTimer);replayTimer=null;$('replay').textContent='Replay steps ▷';}
function changed(){labels();dirty=true;stopReplay();$('results').classList.add('stale');$('status').textContent='Inputs changed. Run to update the results.';$('status').classList.remove('error');$('export').disabled=true;$('replay').disabled=true;}
async function execute(){
 stopReplay();$('run').disabled=true;$('status').classList.remove('error');$('status').textContent='Computing scenario and comparison…';
 await new Promise(requestAnimationFrame);
 try{result=E.run(config());dirty=false;$('results').hidden=false;$('results').classList.remove('stale');$('error').hidden=true;$('export').disabled=false;$('replay').disabled=false;
 $('scenario-name').textContent=E.PRESETS[result.config.scenario].name;$('run-meta').textContent=`10 synthetic steps · Shock −${result.config.shock.toFixed(1)}% · Depth ${result.config.depth}% · Seed ${result.config.seed}`;
 $('active-return').textContent=fmt(result.metrics.activeReturn)+'%';$('baseline-return').textContent=fmt(result.metrics.baselineReturn)+'%';$('difference').textContent=fmt(result.metrics.feedbackDifference)+' pp';
 $('steps').innerHTML=result.active.map(r=>`<button class="step-button ${r.events.length?'trigger':''}" type="button" data-step="${r.step}" aria-pressed="false" aria-label="Inspect step ${r.step}${r.events.length?', participant response':''}">${r.step===0?'Start':'T+'+r.step}</button>`).join('');
 $('steps').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{stopReplay();selectStep(Number(b.dataset.step));}));
 $('data-rows').innerHTML=result.active.map((r,i)=>`<tr><td>${i}</td><td>${r.portfolio.toFixed(3)}</td><td>${result.baseline[i].portfolio.toFixed(3)}</td><td>${fmt(r.external*100,3)}%</td><td>${fmt(r.impact*100,3)}%</td></tr>`).join('');
 const delta=result.metrics.feedbackDifference;
 $('interpretation').textContent=Math.abs(delta)<.0001?'The two portfolio paths coincide under these assumptions. With no effective feedback exposure, this run provides no portfolio amplification.':`Under these assumptions, participant feedback changes the final portfolio outcome by ${fmt(delta)} percentage points. Maximum portfolio drawdown is ${result.metrics.maxDrawdown.toFixed(2)}%. This is a consequence of the specified rules and parameters, not evidence that these rules describe real market participants.`;
 selectStep(result.metrics.firstTrigger??0);$('status').textContent=`Run complete · ${E.VERSION} · All assumptions exportable.`;
 return{version:result.version,config:result.config,metrics:result.metrics,evidence:result.evidence};
 }catch(error){result=null;$('results').hidden=true;$('error').hidden=false;$('error').textContent=error.message;$('status').textContent='Check the inputs and run again.';$('status').classList.add('error');$('export').disabled=true;$('replay').disabled=true;throw error;
 }finally{$('run').disabled=false;}
}
function selectStep(n){if(!result)return;step=n;for(const b of $('steps').querySelectorAll('button'))b.setAttribute('aria-pressed',String(Number(b.dataset.step)===n));const r=result.active[n];$('step-title').textContent=n===0?'Start / Initial state':`T+${n} / ${r.events.length?'Constraints change exposure':'State transition'}`;
 $('step-description').textContent=n===0?'Portfolio and market start at 100. All participant exposures start at 100%; annualized volatility starts at 12%.':`External market move ${fmt(r.external*100)}%; participant price impact ${fmt(r.impact*100)}%. Portfolio value ${r.portfolio.toFixed(2)}. Rules used the previous state (${r.volatility.toFixed(1)}% annualized volatility).`;
 $('events').innerHTML=r.events.length?r.events.map(e=>`<div class="event"><div><span>${names[e.agent]} ${e.action}</span><small>${e.reason}</small></div><b>${fmt(e.change,1)} pp</b></div>`).join(''):`<div class="empty-event">${n===0?'No actions yet. Select a later step to inspect the responses.':'No participant exposure change exceeded the 0.6 pp display threshold. Smaller changes, if any, remain in the calculation.'}</div>`;chart();}
function chart(){if(!result)return;const band=$('sensitivity').checked,w=window.matchMedia('(max-width:760px)').matches?360:780,h=280,left=w===360?35:47,right=19,top=28,bottom=35;
 $('chart').setAttribute('viewBox',`0 0 ${w} ${h}`);
 const all=[...result.active,...result.baseline,...(band?[...result.sensitivity.low,...result.sensitivity.high]:[])].map(r=>r.portfolio),lo=Math.floor((Math.min(...all)-1)/2)*2,hi=Math.max(102,Math.ceil((Math.max(...all)+1)/2)*2);
 const x=i=>left+i*(w-left-right)/10,y=v=>top+(hi-v)/(hi-lo)*(h-top-bottom),path=rows=>rows.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(r.portfolio).toFixed(2)}`).join(' ');
 let svg='<title id="chart-title">Portfolio paths with and without participant feedback</title><desc id="chart-desc">Synthetic scenario. Exact numerical values are in the table below. Sensitivity varies impact strength, not probability.</desc>';
 for(let k=0;k<=4;k++){const val=lo+(hi-lo)*k/4;svg+=`<path d="M${left} ${y(val)}H${w-right}" stroke="#2d4435" stroke-width="1"/><text x="${left-10}" y="${y(val)+3}" text-anchor="end" fill="#8da280" font-size="9" font-family="monospace">${val.toFixed(0)}</text>`;}
 for(let i=0;i<=10;i+=2)svg+=`<text x="${x(i)}" y="${h-12}" text-anchor="middle" fill="#8da280" font-size="9" font-family="monospace">${i===0?'Start':'T+'+i}</text>`;
 if(band){const upper=result.active.map((_,i)=>({portfolio:Math.max(result.sensitivity.low[i].portfolio,result.sensitivity.high[i].portfolio)})),lower=result.active.map((_,i)=>({portfolio:Math.min(result.sensitivity.low[i].portfolio,result.sensitivity.high[i].portfolio)}));svg+=`<path d="${path(upper)} ${lower.map((r,j)=>`L${x(10-j)},${y(lower[10-j].portfolio)}`).join(' ')}Z" fill="#d1ec84" opacity=".09"/>`;}
 svg+=`<path d="${path(result.baseline)}" stroke="#829a92" stroke-width="2" stroke-dasharray="5 5" fill="none"/><path d="${path(result.active)}" stroke="#d1ec84" stroke-width="2.5" fill="none"/><path d="M${x(step)} ${top}V${h-bottom}" stroke="#9cb970" opacity=".55" stroke-dasharray="3 5"/><circle cx="${x(step)}" cy="${y(result.active[step].portfolio)}" r="5" fill="#d1ec84" stroke="#173125" stroke-width="3"/>`;
 svg+=`<text x="${Math.min(w-85,Math.max(left,x(step)-25))}" y="${Math.max(16,y(result.active[step].portfolio)-15)}" fill="#d1ec84" font-size="11" font-family="monospace">${result.active[step].portfolio.toFixed(2)}</text>`;$('chart').innerHTML=svg;
}
$('config-form').addEventListener('submit',event=>{event.preventDefault();execute().catch(()=>{});});
$('config-form').addEventListener('input',changed);
$('scenario').addEventListener('change',()=>{const p=E.PRESETS[$('scenario').value];for(const k of ['shock','depth','crowding'])$(k).value=p[k];labels();execute().catch(()=>{});});
$('reset').addEventListener('click',()=>{load(E.DEFAULT);execute().catch(()=>{});});
$('sensitivity').addEventListener('change',chart);
$('replay').addEventListener('click',()=>{if(replayTimer){stopReplay();return;}selectStep(0);$('replay').textContent='Pause replay Ⅱ';replayTimer=setInterval(()=>{selectStep(step+1);if(step>=10)stopReplay();},950);});
let exportURL=null;
$('export').addEventListener('click',()=>{if(!result||dirty)return;const content=JSON.stringify(result,null,2);$('export-content').value=content;if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(new Blob([content],{type:'application/json'}));$('export-download').href=exportURL;$('export-download').download=`microworld-${result.config.scenario}-seed-${result.config.seed}.json`;$('export-feedback').textContent='You can also select and copy the complete record above.';$('export-dialog').showModal();});
$('export-close').addEventListener('click',()=>$('export-dialog').close());
$('export-dialog').addEventListener('close',()=>{if(exportURL){URL.revokeObjectURL(exportURL);exportURL=null;}});
$('export-copy').addEventListener('click',()=>{const field=$('export-content');field.focus();field.select();let copied=false;try{copied=document.execCommand('copy');}catch{}$('export-feedback').textContent=copied?'Complete JSON record copied.':'The complete record is selected. Use your device’s Copy command.';});
$('export-download').addEventListener('click',()=>{$('export-feedback').textContent='Download requested. If your browser blocks downloads, use Copy JSON.';});
const tourSteps=[
 '1 / Start with the same shock. The dashed path applies only the external scenario; the green path also allows participant responses to affect prices.',
 '2 / Inspect the first reaction. Each participant reads the previous state. Select T+2 or replay the steps to see why exposure changes.',
 '3 / Challenge the mechanism. Untick Vol-control funds and run again. The model recalculates without that group’s price impact.',
 '4 / Challenge the assumptions. Increase market depth and rerun. Then export the exact configuration. The next research task is to test these rules against real data.'
];
function showTour(){ $('tour').classList.add('visible');$('tour-text').textContent=tourSteps[tourStep];$('tour-next').textContent=tourStep===3?'Finish ✓':'Next →';if(tourStep===1&&result)selectStep(2);}
$('tour-start').addEventListener('click',()=>{tourStep=0;showTour();$('tour-next').focus();});$('tour-close').addEventListener('click',()=>{$('tour').classList.remove('visible');$('tour-start').focus();});$('tour-next').addEventListener('click',()=>{if(tourStep===3){$('tour').classList.remove('visible');$('tour-start').focus();}else{tourStep++;showTour();}});
load(E.DEFAULT);execute().catch(()=>{});
// Optional browser-native agent access uses the same validated actions as the UI.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});try{Promise.resolve(document.modelContext.registerTool({name:'run_microworld_scenario',title:'Run MicroWorld scenario',description:'Configure and run the synthetic, uncalibrated Scenario Lab and update its visible results. No market forecast or external submission.',inputSchema:{type:'object',properties:{scenario:{type:'string',enum:Object.keys(E.PRESETS)},shock:{type:'number',minimum:0,maximum:10,multipleOf:0.5},depth:{type:'number',minimum:25,maximum:150,multipleOf:5},crowding:{type:'number',minimum:0,maximum:100,multipleOf:5}},required:['scenario','shock','depth','crowding'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){if(!input||typeof input!=='object'||['scenario','shock','depth','crowding'].some(k=>!(k in input))||Object.keys(input).some(k=>!['scenario','shock','depth','crowding'].includes(k)))throw new Error('Unsupported scenario fields.');const c={...config(),...input};E.validate(c);if(c.shock%0.5!==0||c.depth%5!==0||c.crowding%5!==0)throw new Error('Values must match the visible slider increments.');load(c);return await execute();}},{signal:lifecycle.signal})).catch(()=>{});}catch{}}

window.addEventListener('resize',chart);
