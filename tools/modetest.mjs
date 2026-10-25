// Which hero mode each device gets, including a phone whose window starts wide and one with WebGL blocked.
import {chromium} from 'playwright-core';
const cases=[
  ['Pixel-like: wide window at load, 411px screen',{viewport:{width:980,height:801},screen:{width:411,height:915}},[]],
  ['phone with WebGL blocked',{viewport:{width:411,height:801},screen:{width:411,height:915}},['--disable-webgl','--disable-3d-apis']],
  ['desktop',{viewport:{width:1440,height:900},screen:{width:1440,height:900}},[]],
];
for(const [name,ctxOpts,args] of cases){
  const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader',...args]});
  const p=await b.newPage(ctxOpts);const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:4500/?debug=1',{waitUntil:'networkidle'});await p.waitForTimeout(1200);
  await p.evaluate(()=>{const e=document.querySelector('#top');scrollTo(0,(e.offsetHeight-innerHeight)*0.45)});await p.waitForTimeout(2000);
  const box=(await p.textContent('.dbg')).split('\n');
  console.log(name.padEnd(46),'|',box[1],'|',box.at(-1),'|',errs.length?errs.join('; '):'no errors');
  if(name.startsWith('phone'))await p.screenshot({path:'lab/nowebgl-phone.png'});
  await b.close();
}
