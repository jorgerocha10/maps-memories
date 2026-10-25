import fs from 'fs';
const x=fs.readFileSync('assets/teahouse-loop.gpx','utf8');
const pts=[...x.matchAll(/<trkpt lat="([-\d.]+)" lon="([-\d.]+)">\s*<ele>([-\d.]+)<\/ele>/g)].map(m=>[+m[1],+m[2],+m[3]]);
const R=6371000,rad=d=>d*Math.PI/180;const km=[0];for(let i=1;i<pts.length;i++){const[a,b]=pts[i-1],[c,d]=pts[i];const h=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;km.push(km[i-1]+2*R*Math.asin(Math.sqrt(h))/1000)}
const wps=[...x.matchAll(/<wpt lat="([-\d.]+)" lon="([-\d.]+)">[\s\S]*?<name>([^<]*)<\/name>/g)].map(m=>[+m[1],+m[2],m[3]]);
for(const [la,lo,n] of wps){let bi=0,bd=1e9;pts.forEach((p,i)=>{const d=(p[0]-la)**2+(p[1]-lo)**2;if(d<bd){bd=d;bi=i}});console.log(n,bi,km[bi].toFixed(2),Math.round(pts[bi][2]))}
fs.writeFileSync('data/profile.json',JSON.stringify({km:km.map(v=>+v.toFixed(3)),ele:pts.map(p=>+p[2].toFixed(1))}));
