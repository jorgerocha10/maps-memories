// node tools/webp.mjs in.png out.webp width [quality]  (uses local Chrome canvas)
import fs from 'fs'; import {chromium} from 'playwright-core';
const jobs=JSON.parse(process.argv[2]);
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const p=await b.newPage();
for(const [inp,out,w,q=0.82] of jobs){
 const data='data:image/'+(inp.endsWith('.jpg')?'jpeg':'png')+';base64,'+fs.readFileSync(inp).toString('base64');
 const res=await p.evaluate(async([d,w,q])=>{const im=new Image();im.src=d;await im.decode();const h=Math.round(im.height*w/im.width);const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);return c.toDataURL('image/webp',q)},[data,w,q]);
 fs.writeFileSync(out,Buffer.from(res.split(',')[1],'base64'));console.log(out,fs.statSync(out).size);}
await b.close();
