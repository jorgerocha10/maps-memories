import {chromium} from 'playwright-core';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:3});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4500/?debug=1',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
const read=async()=>{const t=await p.textContent('.dbg');return t.split('\n').slice(-1)[0];};
let maxDec=0;const path=[...Array(26).keys()].map(i=>i/25).concat([0.6,0.3,0.1,0.5,0.9,1]);
for(const f of path){await p.evaluate(f=>{const e=document.querySelector('#top');scrollTo(0,(e.offsetHeight-innerHeight)*f)},f);await p.waitForTimeout(220);
  const l=await read();const d=+(l.match(/decoded: (\d+)/)||[0,0])[1];maxDec=Math.max(maxDec,d);}
console.log('max decoded frames at once:',maxDec);
await p.evaluate(()=>{const e=document.querySelector('#top');scrollTo(0,(e.offsetHeight-innerHeight)*0.45)});await p.waitForTimeout(1200);await p.screenshot({path:'lab/seq-045.png'});
console.log('at 0.45 ->',await read());
await p.evaluate(()=>document.querySelector('#inside').scrollIntoView({behavior:'instant'}));await p.waitForTimeout(2500);console.log('after leaving hero ->',await read());
await p.reload({waitUntil:'networkidle'});await p.waitForTimeout(800);console.log((await p.textContent('.dbg')).split('\n').find(l=>l.startsWith('last visit')));
console.log(errs.join('\n')||'no errors');await b.close();
