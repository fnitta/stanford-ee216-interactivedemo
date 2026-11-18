import {junction} from './physics/junction.js';
import {statistics} from './physics/statistics.js';
import {diffusion} from './physics/diffusion.js';

const $ = id => document.getElementById(id);
const colors = {teal:'#006c67',violet:'#6a4dad',orange:'#b45309',ink:'#142d3c',muted:'#526777'};
const defaults = {junction:{logNa:16,logNd:16,bias:0},statistics:{temperature:300,energy:.1},diffusion:{logTau:0,logS:4,zero:false}};
let active = new URLSearchParams(location.search).get('demo');
if (!Object.hasOwn(defaults,active)) active='junction';
let state = structuredClone(defaults[active]);
let plotMode='field', model, plotted, announceTimer;
const scientific = (n,d=2) => n===0?'0':n.toExponential(d).replace('e+',' × 10^').replace('e-',' × 10^−');
const concise = n => n===0?'0':Math.abs(n)>=1e4||Math.abs(n)<.001?scientific(n,1):Number(n.toPrecision(4)).toString();
const pct=n => n>10000?scientific(n,2)+'%':(n<.01&&n!==0?scientific(n,1):n.toFixed(2))+'%';
const metric=(label,value,unit,note='')=>`<div class="metric"><div class="metric-label">${label}</div><div class="metric-value">${value} <span>${unit}</span></div>${note?`<div class="metric-note">${note}</div>`:''}</div>`;
const configs = {
 junction:{title:'Inside a pn junction',description:'Change doping and applied voltage to see how the depletion region, electric field, and potential barrier respond. The depletion region extends farther into the lightly doped side; reverse bias widens it and increases the barrier. This abrupt silicon junction model uses the depletion approximation at 300 K, with complete ionization and nondegenerate carriers. It excludes breakdown, tunneling, and strong forward-injection effects.',presets:[['Equilibrium',{logNa:16,logNd:16,bias:0}],['Reverse bias',{logNa:16,logNd:16,bias:-2}],['Unequal doping',{logNa:17,logNd:15,bias:0}]]},
 statistics:{title:'When is Boltzmann a good shortcut?',description:'Compare the exact Fermi–Dirac occupation probability with the Boltzmann approximation as temperature and energy change. At the Fermi level, exact occupancy is always one half. Several kᵦT above it, the exponential approximation becomes accurate; below it, the approximation can exceed one. These curves describe the probability that an individual state is occupied. Carrier concentration also depends on the density of available states.',presets:[['At the Fermi level',{temperature:300,energy:0}],['3kᵦT above Eꜰ',{temperature:300,energy:3*8.617333262e-5*300}],['Hotter sample',{temperature:800,energy:.1}]]},
 diffusion:{title:'What does passivation save?',description:'Change surface recombination velocity and bulk lifetime to explore excess minority carriers near an illuminated surface. Passivation lowers surface recombination, preserving carriers near the surface. The diffusion length is L = √(Dτ). This steady-state, low-injection model assumes uniform illumination, negligible drift, constant lifetime and diffusivity, and a semi-infinite n-type sample. D = 12.4 cm²/s at 300 K. The concentration is normalized to its bulk value Gτ, and the horizontal span follows the diffusion length.',presets:[['Unpassivated',{logTau:0,logS:Math.log10(2e5),zero:false}],['Passivated',{logTau:0,logS:Math.log10(50),zero:false}],['Ideal surface',{logTau:0,logS:0,zero:true}]]}
};

function control(id,label,min,max,step,hint=''){
 return `<div class="control"><div class="control-head"><label for="${id}">${label}</label><output for="${id}" id="${id}-value"></output></div><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${state[id]}"><div class="range-limits"><span id="${id}-min">${min}</span><span id="${id}-max">${max}</span></div>${hint?`<p class="control-hint">${hint}</p>`:''}</div>`;
}
function selectDemo(id,updateURL=true){
 active=id;state=structuredClone(defaults[id]);plotMode='field';
 const c=configs[id];
 document.querySelectorAll('[data-demo]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.demo===id)));
 $('demo-title').textContent=c.title;
 $('demo-description').textContent=c.description;
 $('control-fields').innerHTML=id==='junction'?
   control('logNa','p-side doping Nₐ',14,18,.1,'Log scale · acceptors in cm⁻³')+control('logNd','n-side doping Nᴅ',14,18,.1,'Log scale · donors in cm⁻³')+control('bias','Applied bias V',-3,.5,.01,'Positive = forward bias. The upper limit keeps at least a 0.15 V barrier; high injection can still limit accuracy.'):
   id==='statistics'?control('temperature','Temperature',100,1000,10)+control('energy','Selected E − Eꜰ',-.3,.5,.005):
   control('logS','Surface velocity S',0,Math.log10(2e5),.01,'Log scale · choose Ideal surface for S = 0.')+control('logTau','Bulk lifetime τ',-1,2,.01,'Log scale · 0.1 to 100 µs.');
 for(const input of $('control-fields').querySelectorAll('input'))input.addEventListener('input',()=>{state[input.id]=Number(input.value);if(input.id==='logS')state.zero=false;update();});
 $('presets').replaceChildren(...c.presets.map(([name,values])=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.addEventListener('click',()=>{state={...values};syncInputs();update();});return b;}));
 $('plot-modes').replaceChildren();
 if(id==='junction')for(const [name,value] of [['Charge','rho'],['Field','field'],['Potential','potential']]){const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.mode=value;b.addEventListener('click',()=>{plotMode=value;update();});$('plot-modes').append(b);}
 syncInputs();update();
 if(updateURL){const url=new URL(location.href);url.searchParams.set('demo',id);history.replaceState(null,'',url);}
}
function syncInputs(){for(const input of $('control-fields').querySelectorAll('input'))input.value=state[input.id];}
function label(id,text,min,max){$(id+'-value').textContent=text;if(min!==undefined)$(id+'-min').textContent=min;if(max!==undefined)$(id+'-max').textContent=max;}
function update(){
 let summary='';
 if(active==='junction'){
  let preliminary=junction({logNa:state.logNa,logNd:state.logNd,bias:Math.min(state.bias,0)});
  const maxBias=Math.floor((preliminary.maxBias+1e-9)*100)/100;
  state.bias=Math.min(state.bias,maxBias);$('bias').max=maxBias;$('bias').value=state.bias;
  model=junction(state);
  label('logNa',scientific(model.Na,1),'10¹⁴','10¹⁸');label('logNd',scientific(model.Nd,1),'10¹⁴','10¹⁸');label('bias',state.bias.toFixed(2)+' V','−3.00 V',maxBias.toFixed(2)+' V');
  $('metrics').innerHTML=metric('Depletion width W',model.W.toFixed(3),'µm',`xₚ ${concise(model.xp)} · xₙ ${concise(model.xn)} µm`)+metric('Barrier Vᵦᵢ − V',model.barrier.toFixed(3),'V',`Built-in Vᵦᵢ ${model.Vbi.toFixed(3)} V`)+metric('Peak field |E|', (model.peakField/1000).toFixed(2),'kV/cm',`C′ ${concise(model.capacitance*1e9)} nF/cm²`);
  $('plot-modes').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===plotMode)));
  const spec={rho:['Fixed depletion charge','ρ (mC/cm³)',1000,colors.violet],field:['Electric field across the junction','E (kV/cm)',.001,colors.teal],potential:['Electrostatic potential','φ (V)',1,colors.teal]}[plotMode];
  $('plot-title').textContent=spec[0];
  const series=model.x.map((x,i)=>({x,y:model[plotMode][i]*spec[2]}));
  const values=series.map(p=>p.y),low=Math.min(0,...values),high=Math.max(0,...values),span=(high-low)||1;
  plot({xMin:-model.xp-model.W*.1,xMax:model.xn+model.W*.1,yMin:low-span*.14,yMax:high+span*.2,xLabel:'Position x (µm)',yLabel:spec[1],series:[{name:spec[0],data:series,color:spec[3]}],bands:[{x0:-model.xp,x1:0,fill:'#ede7f7',label:'p-side depletion'},{x0:0,x1:model.xn,fill:'#def0eb',label:'n-side depletion'}],vertical:0,title:spec[0],description:`p-side width ${model.xp.toFixed(4)} µm; n-side width ${model.xn.toFixed(4)} µm. Potential barrier ${model.barrier.toFixed(4)} V.`});
  $('plot-note').textContent=plotMode==='field'?'The field points from the positive donor charge on the n side toward the negative acceptor charge on the p side. Its sign is negative for this x direction.':plotMode==='rho'?'Mobile carriers are neglected inside the depletion region. The shaded widths change with doping and bias; neutral material lies outside.':'The p-side neutral potential is the zero reference. The n-side potential is Vᵦᵢ − V; φ increases because E = −dφ/dx.';
  summary=`${state.bias===0?'Equilibrium':state.bias<0?'Reverse bias':'Forward bias'} · 300 K · abrupt silicon junction`;
  plotted={headers:['x_um','rho_C_per_cm3','E_V_per_cm','potential_V'],rows:model.x.map((x,i)=>[x,model.rho[i],model.field[i],model.potential[i]])};
 }else if(active==='statistics'){
  model=statistics(state);label('temperature',state.temperature+' K','100 K','1000 K');label('energy',state.energy.toFixed(3)+' eV','−0.300 eV','0.500 eV');
  const kT=8.617333262e-5*state.temperature;
  $('metrics').innerHTML=metric('Exact occupancy f',concise(model.f),'',pct(model.f*100)+' of states occupied')+metric('Boltzmann fᴮ',concise(model.mb),'',model.mb>1?'Exceeds a physical probability':'Exponential approximation')+metric('Relative error',pct(model.relativeError*100),'',`Selected energy ${(state.energy/kT).toFixed(2)} kᵦT`);
  $('plot-title').textContent='Occupation probability vs energy';
  plot({xMin:-.3,xMax:.5,yMin:0,yMax:1.2,xLabel:'Energy relative to Eꜰ (eV)',yLabel:'Occupation probability',series:[{name:'Fermi–Dirac (exact)',data:model.curve.map(p=>({x:p.energy,y:p.f})),color:colors.teal},{name:'Boltzmann approximation',data:model.curve.map(p=>({x:p.energy,y:p.mb})),color:colors.orange,dashed:true}],bands:[{x0:3*kT,x1:.5,fill:'#e3f1ed',label:'Boltzmann error < 5%'}],vertical:state.energy,dot:{x:state.energy,y:model.f},title:'Fermi–Dirac and Boltzmann occupation',description:`At ${state.temperature} K and E minus Fermi energy ${state.energy.toFixed(3)} eV, exact occupancy is ${model.f.toPrecision(5)}, Boltzmann is ${model.mb.toPrecision(5)}; relative error ${pct(model.relativeError*100)}.`});
  $('plot-note').textContent='The dashed approximation is clipped above 1.2. A physical occupancy cannot exceed 1. The shaded region starts at E − Eꜰ = 3kᵦT; its relative approximation error is below 5%.';
  summary=`${state.temperature} K · kᵦT = ${(kT*1000).toFixed(2)} meV · dotted line: selected energy`;
  plotted={headers:['energy_minus_Ef_eV','fermi_dirac_probability','boltzmann_approximation'],rows:model.curve.map(p=>[p.energy,p.f,p.mb])};
 }else{
  const S=state.zero?0:10**state.logS,tau=10**state.logTau;
  model=diffusion({D:12.4,tau,S});label('logS',concise(S)+' cm/s','1 cm/s','200,000 cm/s');label('logTau',concise(tau)+' µs','0.1 µs','100 µs');
  $('metrics').innerHTML=metric('Diffusion length L',model.L.toFixed(2),'µm','L = √(Dτ)')+metric('Surface retention',pct(model.surfaceFraction*100),'','Relative to bulk excess Gτ')+metric('Surface competition α',concise(S*(tau*1e-6)/(model.L*1e-4)),'','α = Sτ/L · dimensionless');
  $('plot-title').textContent='Excess minority carriers near the surface';
  plot({xMin:0,xMax:5*model.L,yMin:0,yMax:1.1,xLabel:'Depth into semiconductor x (µm)',yLabel:'Normalized excess Δp / (Gτ)',series:[{name:'Excess-hole concentration',data:model.profile,color:colors.teal},{name:'Bulk value Gτ',data:[{x:0,y:1},{x:5*model.L,y:1}],color:colors.violet,dashed:true}],vertical:model.L,dot:{x:0,y:model.surfaceFraction},title:'Normalized excess holes vs depth',description:`Diffusion length ${model.L.toFixed(3)} µm; surface retention ${pct(model.surfaceFraction*100)}. The curve approaches 1 far from the surface.`});
  $('plot-note').textContent='The surface is at x = 0; the dotted line marks one diffusion length L. The horizontal axis rescales to 5L when lifetime changes. Normalization isolates the profile shape, rather than absolute carrier density.';
  summary=`D = 12.4 cm²/s · τ = ${concise(tau)} µs · S = ${concise(S)} cm/s`;
  plotted={headers:['depth_um','normalized_excess_holes'],rows:model.profile.map(p=>[p.x,p.y])};
 }
 $('state-summary').textContent=summary;
 clearTimeout(announceTimer);announceTimer=setTimeout(()=>{$('live-summary').textContent=$('metrics').innerText.replaceAll('\n',' ')+'. '+summary;},300);
}

function plot({xMin,xMax,yMin,yMax,xLabel,yLabel,series,bands=[],vertical,dot,title,description}){
 const W=Math.max(280,Math.min(760,Math.round($('plot').clientWidth)||760)),H=350,narrow=W<480;
 const p={l:narrow?62:78,r:narrow?16:20,t:54,b:57};
 const wrap=(text,width)=>{const lines=[];let line='';for(const word of text.split(' ')){if(line&&(line+' '+word).length*6.8>width){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;};
 const legendStart=narrow?14:p.l,legendWidth=W-legendStart-p.r,legend=[];
 let lx=legendStart,ly=5,rowHeight=18;
 for(const s of series){const lines=wrap(s.name,legendWidth-36),width=Math.min(legendWidth,Math.max(...lines.map(line=>line.length))*6.8+36);if(lx>legendStart&&lx+width>W-p.r){lx=legendStart;ly+=rowHeight+8;rowHeight=18;}legend.push({...s,lines,x:lx,y:ly});lx+=width+18;rowHeight=Math.max(rowHeight,lines.length*18);}
 const axisLines=wrap(yLabel,W-p.l-p.r),axisY=ly+rowHeight+18;
 p.t=axisY+(axisLines.length-1)*16+14;
 const iw=W-p.l-p.r,ih=H-p.t-p.b;
 $('plot').style.aspectRatio=`${W} / ${H}`;
 const x=v=>p.l+(v-xMin)/(xMax-xMin)*iw,y=v=>p.t+(yMax-v)/(yMax-yMin)*ih;
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="chart-title chart-description"><title id="chart-title">${esc(title)}</title><desc id="chart-description">${esc(description)}</desc><defs><clipPath id="plot-clip"><rect x="${p.l}" y="${p.t}" width="${iw}" height="${ih}"/></clipPath></defs>`;
 for(const b of bands){const a=Math.max(xMin,b.x0),z=Math.min(xMax,b.x1);if(z>a){svg+=`<rect x="${x(a)}" y="${p.t}" width="${x(z)-x(a)}" height="${ih}" fill="${b.fill}"/>`;if(x(z)-x(a)>130)svg+=`<text x="${(x(a)+x(z))/2}" y="${p.t+18}" text-anchor="middle" font-size="13" fill="${colors.muted}">${esc(b.label)}</text>`;}}
 for(let i=0;i<=4;i++){const v=yMin+(yMax-yMin)*i/4,yy=y(v);svg+=`<line x1="${p.l}" y1="${yy}" x2="${W-p.r}" y2="${yy}" stroke="#d9e2e6" stroke-dasharray="3 4"/><text x="${p.l-12}" y="${yy+4}" text-anchor="end" font-size="13" fill="${colors.muted}">${concise(v)}</text>`;}
 const tickCount=narrow?2:4;
 for(let i=0;i<=tickCount;i++){const v=xMin+(xMax-xMin)*i/tickCount,xx=x(v),anchor=i===0?'start':i===tickCount?'end':'middle';svg+=`<line x1="${xx}" y1="${H-p.b}" x2="${xx}" y2="${H-p.b+5}" stroke="#8c9ea7"/><text x="${xx}" y="${H-p.b+23}" text-anchor="${anchor}" font-size="13" fill="${colors.muted}">${concise(v)}</text>`;}
 svg+=`<line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}" stroke="#8c9ea7"/>`;
 for(const [i,line] of axisLines.entries())svg+=`<text x="${p.l}" y="${axisY+i*16}" font-size="13" fill="${colors.muted}">${esc(line)}</text>`;
 svg+=`<text x="${narrow?W/2:p.l+iw/2}" y="${H-6}" text-anchor="middle" font-size="14" fill="${colors.muted}">${esc(xLabel)}</text><g clip-path="url(#plot-clip)">`;
 if(yMin<0&&yMax>0)svg+=`<line x1="${p.l}" y1="${y(0)}" x2="${W-p.r}" y2="${y(0)}" stroke="#8c9ea7"/>`;
 if(vertical!==undefined)svg+=`<line x1="${x(vertical)}" y1="${p.t}" x2="${x(vertical)}" y2="${H-p.b}" stroke="#526777" stroke-dasharray="2 5"/>`;
 for(const s of series){const path=s.data.map((v,i)=>`${i?'L':'M'}${x(v.x).toFixed(3)},${Math.max(-1e6,Math.min(1e6,y(v.y))).toFixed(3)}`).join(' ');svg+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="3" ${s.dashed?'stroke-dasharray="8 5"':''} stroke-linejoin="round"/>`;}
 if(dot)svg+=`<circle cx="${x(dot.x)}" cy="${y(dot.y)}" r="5" fill="${colors.teal}" stroke="white" stroke-width="2"/>`;
 svg+='</g>';
 for(const s of legend){svg+=`<line x1="${s.x}" y1="${s.y+8}" x2="${s.x+20}" y2="${s.y+8}" stroke="${s.color}" stroke-width="3" ${s.dashed?'stroke-dasharray="5 3"':''}/>`;for(const [i,line] of s.lines.entries())svg+=`<text x="${s.x+28}" y="${s.y+12+i*18}" font-size="13" fill="${colors.ink}">${esc(line)}</text>`;}
 $('plot').innerHTML=svg+'</svg>';
}
document.querySelectorAll('[data-demo]').forEach(b=>b.addEventListener('click',()=>selectDemo(b.dataset.demo)));
$('reset').addEventListener('click',()=>{state=structuredClone(defaults[active]);syncInputs();update();});
$('csv').addEventListener('click',()=>{
 const metadata=active==='junction'?{Na_cm3:model.Na,Nd_cm3:model.Nd,bias_V:state.bias}:active==='statistics'?{temperature_K:state.temperature,selected_energy_eV:state.energy}:{D_cm2_s:model.D,tau_us:model.tau,S_cm_s:model.S};
 const rows=[['# EE216 demo',active],...Object.entries(metadata).map(([k,v])=>['# '+k,v]),plotted.headers,...plotted.rows];
 const blob=new Blob([rows.map(r=>r.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ee216-${active}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
selectDemo(active,false);
// Only width changes need a redraw; changing the SVG height cannot loop here.
let plotWidth=Math.round($('plot').clientWidth),resizeFrame;
if('ResizeObserver' in window)new ResizeObserver(([entry])=>{const width=Math.round(entry.contentRect.width);if(width>0&&width!==plotWidth){plotWidth=width;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(update);}}).observe($('plot'));
