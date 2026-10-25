import {chromium} from 'playwright-core';
const BASE=process.argv[2]||'http://localhost:4600';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({viewport:{width:1440,height:900}});
await ctx.addInitScript(()=>{Element.prototype.setPointerCapture=()=>{};Element.prototype.releasePointerCapture=()=>{};
  window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI));});
const p=await ctx.newPage();const errs=[],bad=[];
p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url())});
const main=await p.goto(BASE+'/',{waitUntil:'networkidle'});
const h=main.headers();console.log('index headers:',['content-security-policy','x-content-type-options','cache-control','x-frame-options'].map(k=>k+'='+(h[k]?'set':'MISSING')).join(' '));
for(const u of ['/tools/gen.mjs','/BRIEF.md','/README.md','/lab/railsync.png','/.vercelignore','/.gitignore','/vercel.json'])console.log('blocked?',u,(await ctx.request.get(BASE+u)).status());
const H=await p.evaluate(()=>document.documentElement.scrollHeight);
for(let y=0;y<H;y+=700){await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(250);}
await p.evaluate(()=>document.querySelector('.surface').scrollIntoView({block:'center'}));
await p.click('[data-sample="assets/sample-banff-half.gpx"]');
for(let i=0;i<180;i++){if(await p.evaluate(()=>document.querySelector('.surface').dataset.state)==='ready')break;await p.waitForTimeout(500);}
await p.waitForTimeout(3000);
console.log('surface status:',JSON.stringify(await p.textContent('.surface__status')),'| trail:',await p.textContent('[data-stat="name"]'));
await p.click('[data-frame]');await p.waitForTimeout(2000);
console.log('CSP violations:',JSON.stringify(await p.evaluate(()=>window.__csp)));
console.log('HTTP errors:',bad.length?bad.join('\n  '):'none');console.log('page errors:',errs.length?errs.join('\n  '):'none');
await b.close();
