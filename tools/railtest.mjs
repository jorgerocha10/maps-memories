import {chromium} from 'playwright-core';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4500/',{waitUntil:'networkidle'});await p.waitForTimeout(800);
const at=async(label,fn)=>{await p.evaluate(fn);await p.waitForTimeout(7000);console.log(label.padEnd(22),await p.evaluate(()=>{const r=document.querySelector('.route');return `opacity=${r.style.opacity} vis=${r.style.visibility} km=${document.querySelector('.readout__km').textContent} passed=${[...document.querySelectorAll('.route__stops a.is-passed')].length}`}));};
const hp=f=>`(()=>{const e=document.querySelector('#top');scrollTo(0,e.offsetTop+(e.offsetHeight-innerHeight)*${f})})()`;
for(const f of [0.1,0.3,0.42,0.53,0.66,0.95]) await at('hero p='+f, hp(f));
await at('inside section',"document.querySelector('#inside').scrollIntoView()");
await at('back in hero p=0.45', hp(0.45));

await p.click('.route__stops a[data-km="8.15"]');await p.waitForTimeout(6000);
console.log('clicked Plain of Six  ',await p.evaluate(()=>`readout km=${document.querySelector('.readout__km').textContent} place="${document.querySelector('.readout__place').textContent}"`));
console.log(errs.join('\n')||'no errors');await b.close();
