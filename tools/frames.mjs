// Renders the phone hero frame sequence: node tools/frames.mjs  (dev server on :4500)
import fs from 'fs'; import {chromium} from 'playwright-core';
import { SEQ, seqFile } from '../js/hero-timeline.js';
fs.mkdirSync('out/hero-seq', {recursive:true}); fs.mkdirSync(SEQ.dir, {recursive:true});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:SEQ.w,height:SEQ.h},deviceScaleFactor:1});
await p.goto('http://localhost:4500/tools/frames.html');await p.waitForFunction(()=>document.title==='ready',null,{timeout:180000});
const stage=p.locator('#stage');const t0=Date.now();
for(let i=0;i<SEQ.count;i++){
  const pos=SEQ.from+i*SEQ.step;
  await p.evaluate(pos=>window.renderAt(pos),pos);
  const png=await stage.screenshot({type:'png'});
  const webp=await p.evaluate(async d=>{const im=new Image();im.src=d;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return c.toDataURL('image/webp',0.78)},'data:image/png;base64,'+png.toString('base64'));
  fs.writeFileSync(seqFile(i),Buffer.from(webp.split(',')[1],'base64'));
  if(i%12===0)console.log(`frame ${i}/${SEQ.count} p=${pos.toFixed(3)} ${Math.round((Date.now()-t0)/1000)}s`);
}
const total=fs.readdirSync(SEQ.dir).reduce((s,f)=>s+fs.statSync(SEQ.dir+f).size,0);
console.log('done',SEQ.count,'frames',(total/1024/1024).toFixed(2),'MB');await b.close();
