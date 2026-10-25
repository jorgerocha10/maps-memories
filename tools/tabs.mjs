import {chromium} from 'playwright-core';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://localhost:4500/',{waitUntil:'networkidle'});
const out=[];for(let i=0;i<22;i++){await p.keyboard.press('Tab');out.push(await p.evaluate(()=>{const e=document.activeElement;const r=e.getBoundingClientRect();return `${e.tagName}${e.name?'['+e.name+']':''} "${(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,28)}" vis=${getComputedStyle(e).visibility!=='hidden'&&r.width>0} op=${(()=>{let o=1,n=e;while(n&&n.nodeType===1){o*=+getComputedStyle(n).opacity;n=n.parentElement}return o.toFixed(2)})()}`}));}
console.log(out.join('\n'));
// submit empty form then valid
await p.evaluate(()=>document.querySelector('#order').scrollIntoView());await p.waitForTimeout(800);
await p.click('.plate .btn');console.log('empty submit:',await p.textContent('.plate__msg'));
await p.fill('[name=name]','Test Person');await p.fill('[name=email]','test@example.com');
const [dl]=await Promise.all([p.waitForEvent('download'),p.click('.plate .btn')]);console.log('download:',dl.suggestedFilename());
const fs=await import('fs');await dl.saveAs('lab/order-test.txt');console.log(fs.readFileSync('lab/order-test.txt','utf8'));console.log('msg:',await p.textContent('.plate__msg'));
await b.close();
