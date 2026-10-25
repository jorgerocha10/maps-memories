import {chromium} from 'playwright-core';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4500/',{waitUntil:'networkidle'});await p.waitForTimeout(800);
for(const f of [0.34,0.40,0.46,0.52]){
  await p.evaluate(f=>{const e=document.querySelector('#top');scrollTo(0,(e.offsetHeight-innerHeight)*f)},f);await p.waitForTimeout(7000);
  console.log('p='+f, await p.evaluate(()=>{
    const live=document.querySelector('.route__live'),L=live.getTotalLength(),end=live.getPointAtLength(L),svg=document.querySelector('.route__svg').getBoundingClientRect();
    const ctm=live.getScreenCTM();const ex=end.x*ctm.a+ctm.e, ey=end.y*ctm.d+ctm.f;
    const h=document.querySelector('.route__head').getBoundingClientRect();const hx=h.x+h.width/2, hy=h.y+h.height/2;
    return `lineEnd=(${ex.toFixed(1)},${ey.toFixed(1)}) dot=(${hx.toFixed(1)},${hy.toFixed(1)}) gap=${Math.hypot(ex-hx,ey-hy).toFixed(1)}px readout=${document.querySelector('.readout__km').textContent}km`;}));
}
await p.screenshot({path:'lab/railsync.png',clip:{x:1180,y:120,width:260,height:700},timeout:90000});
console.log(errs.join('\n')||'no errors');await b.close();
