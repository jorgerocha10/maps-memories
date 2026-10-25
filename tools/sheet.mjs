// node tools/sheet.mjs out.png cols a.png b.png ...  -> contact sheet via Chrome canvas
import fs from 'fs';import {chromium} from 'playwright-core';
const [out,cols,...files]=process.argv.slice(2);
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const p=await b.newPage();
const data=files.map(f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64'));
const res=await p.evaluate(async([d,cols])=>{const ims=await Promise.all(d.map(s=>{const i=new Image();i.src=s;return i.decode().then(()=>i)}));const w=720,h=Math.round(ims[0].height*w/ims[0].width),rows=Math.ceil(ims.length/cols);const c=document.createElement('canvas');c.width=w*cols;c.height=h*rows;const g=c.getContext('2d');ims.forEach((im,i)=>g.drawImage(im,(i%cols)*w,Math.floor(i/cols)*h,w,h));return c.toDataURL('image/jpeg',0.85)},[data,+cols]);
fs.writeFileSync(out,Buffer.from(res.split(',')[1],'base64'));await b.close();
