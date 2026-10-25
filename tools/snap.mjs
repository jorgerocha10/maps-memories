// node tools/snap.mjs out-prefix width height "hero:0,0.2,..." ["sel:#inside,..."]
import {chromium} from 'playwright-core';
const [pre,W,H,list,...rest]=process.argv.slice(2);
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:+W,height:+H},deviceScaleFactor:1,reducedMotion:rest.includes('reduced')?'reduce':'no-preference'});
await ctx.addInitScript(()=>{Element.prototype.setPointerCapture=()=>{};Element.prototype.requestPointerLock=()=>{};});
const p=await ctx.newPage();const errs=[];p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text())});p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('requestfailed',r=>errs.push('REQFAIL '+r.url()));
await p.goto(process.env.SNAP_URL||'http://localhost:4500/',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
for(const item of list.split(',')){
  let y;
  if(item.startsWith('#')){const [sel,f='0']=item.split('@');y=await p.evaluate(([s,f])=>{const e=document.querySelector(s);const t=e.getBoundingClientRect().top+scrollY;return t+(e.offsetHeight-innerHeight)*+f},[sel,f]);}
  else y=await p.evaluate(f=>{const e=document.querySelector('#top');return (e.offsetHeight-innerHeight)*f},+item);
  await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(1800);
  await p.screenshot({path:`${pre}-${item.replace(/[#@.]/g,'_')}.png`});
}
console.log(errs.slice(0,15).join('\n')||'no console errors');await b.close();
