import {chromium} from 'playwright-core';
const jobs=JSON.parse(process.argv[2]);
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const [out,w,h,qs] of jobs){const p=await b.newPage({viewport:{width:w,height:h}});
await p.goto('http://localhost:4500/tools/capture.html?'+qs);await p.waitForFunction(()=>document.title==='ready',null,{timeout:120000});await p.waitForTimeout(500);
await p.screenshot({path:out});await p.close();console.log(out);}
await b.close();
