import fs from 'fs';
const x=fs.readFileSync(process.argv[2],'utf8');
const pts=[...x.matchAll(/<trkpt lat="([-\d.]+)" lon="([-\d.]+)">\s*<ele>([-\d.]+)<\/ele>/g)].map(m=>[+m[1],+m[2],+m[3]]);
const R=6371000,rad=d=>d*Math.PI/180;let d=0,g=0,l=0;
for(let i=1;i<pts.length;i++){const[a,b,e]=pts[i-1],[c,dd,f]=pts[i];const h=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(dd-b)/2)**2;d+=2*R*Math.asin(Math.sqrt(h));if(f>e)g+=f-e;else l+=e-f;}
const el=pts.map(p=>p[2]);console.log(JSON.stringify({n:pts.length,km:+(d/1000).toFixed(2),gain:Math.round(g),loss:Math.round(l),min:Math.round(Math.min(...el)),max:Math.round(Math.max(...el)),start:pts[0],imax:el.indexOf(Math.max(...el))}));
const wp=[...x.matchAll(/<wpt[^>]*>[\s\S]*?<name>([^<]*)<\/name>/g)].map(m=>m[1]);console.log(wp);
