// Scrolls the hero slowly at phone size and reports GPU objects three.js holds.
import {chromium} from 'playwright-core';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:3});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto((process.argv[2]||'http://localhost:4500')+'/?debug=1',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
const info=()=>p.evaluate(()=>{const r=__hero.renderer,m=r.info.memory,c=r.domElement;return `geometries=${m.geometries} textures=${m.textures} canvas=${c.width}x${c.height}`});
console.log('start   ',await info());
for(const f of (process.argv[3]==='loop'?[0.75,0.12,0.2,0.28,0.16,0.24,0.32,0.14,0.22,0.3,0.75]:[0.1,0.15,0.2,0.25,0.3,0.35,0.45,0.55,0.65,0.75,0.9])){await p.evaluate(f=>{const e=document.querySelector('#top');scrollTo(0,(e.offsetHeight-innerHeight)*f)},f);await p.waitForTimeout(2500);console.log('p='+f.toFixed(2).padEnd(5),await info());}
console.log(errs.join('\n')||'no errors');await b.close();
