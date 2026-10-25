import {chromium} from 'playwright-core';
const [W,H,f,expr]=process.argv.slice(2);
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({viewport:{width:+W,height:+H}});const p=await ctx.newPage();
await p.goto('http://localhost:4500/',{waitUntil:'networkidle'});await p.waitForTimeout(1200);
await p.evaluate(f=>{const e=document.querySelector('#top');scrollTo(0,(e.offsetHeight-innerHeight)*f)},+f);await p.waitForTimeout(2500);
console.log(await p.evaluate(expr));await b.close();
