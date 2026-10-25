// Marching squares over the real Teahouse heightmap -> SVG contour sets.
import fs from 'fs';
const N=512, H=new Float32Array(fs.readFileSync('data/teahouse-height.bin').buffer.slice(0));
const S=128; // downsample for smooth lines
const g=new Float32Array(S*S);
for(let j=0;j<S;j++)for(let i=0;i<S;i++){let s=0,c=0;const r=N/S;for(let y=0;y<r;y++)for(let x=0;x<r;x++){s+=H[(j*r+y)*N+i*r+x];c++}g[j*S+i]=s/c;}
function iso(lv){const segs=[];const v=(i,j)=>g[j*S+i];
 for(let j=0;j<S-1;j++)for(let i=0;i<S-1;i++){const a=v(i,j),b=v(i+1,j),c=v(i+1,j+1),d=v(i,j+1);
  const k=(a>lv)|((b>lv)<<1)|((c>lv)<<2)|((d>lv)<<3); if(k===0||k===15)continue;
  const e={t:[i+(lv-a)/(b-a),j],r:[i+1,j+(lv-b)/(c-b)],b:[i+(lv-d)/(c-d),j+1],l:[i,j+(lv-a)/(d-a)]};
  const T={1:['l','t'],2:['t','r'],3:['l','r'],4:['r','b'],5:['l','t','r','b'],6:['t','b'],7:['l','b'],8:['b','l'],9:['t','b'],10:['t','r','b','l'],11:['r','b'],12:['r','l'],13:['t','r'],14:['l','t']}[k];
  for(let q=0;q<T.length;q+=2)segs.push([e[T[q]],e[T[q+1]]]);}
 // chain segments
 const key=p=>p[0].toFixed(3)+','+p[1].toFixed(3);const map=new Map();segs.forEach((s,ix)=>{for(const p of s){const k=key(p);(map.get(k)||map.set(k,[]).get(k)).push(ix)}});
 const used=new Uint8Array(segs.length),lines=[];
 for(let s0=0;s0<segs.length;s0++){if(used[s0])continue;used[s0]=1;let line=[segs[s0][0],segs[s0][1]];
  for(const dir of [1,0]){let grow=true;while(grow){grow=false;const end=dir?line[line.length-1]:line[0];for(const ix of map.get(key(end))||[]){if(used[ix])continue;used[ix]=1;const s=segs[ix];const nxt=key(s[0])===key(end)?s[1]:s[0];dir?line.push(nxt):line.unshift(nxt);grow=true;break;}}}
  if(line.length>6)lines.push(line);}
 return lines;}
function path(lines,sc){return lines.map(l=>{let d='';l.forEach((p,i)=>{if(i%2&&i!==l.length-1)return;d+=(i?'L':'M')+(p[0]*sc).toFixed(1)+' '+(p[1]*sc).toFixed(1)});return d}).join('');}
const zmin=2,zmax=94.2,levels=[];for(let z=6;z<zmax;z+=3.4)levels.push(z);
const sc=1000/(S-1);
const sets={far:[],mid:[],near:[]};levels.forEach((lv,ix)=>{sets[['far','mid','near'][ix%3]].push(path(iso(lv),sc))});
for(const [k,v] of Object.entries(sets)) fs.writeFileSync(`assets/contour-${k}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice"><path d="${v.join('')}" fill="none" stroke="#95A7B5" stroke-width="1.1" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`);
// all levels as one guide file (thin)
fs.writeFileSync('assets/contour-all.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice"><path d="${Object.values(sets).flat().join('')}" fill="none" stroke="#95A7B5" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`);
// trail projected to same 0..1000 space
const T=JSON.parse(fs.readFileSync('data/teahouse.json')).trail.map(p=>[((p[0]+125)/250*1000),((125-p[1])/250*1000)]);
fs.writeFileSync('data/trail-2d.json',JSON.stringify(T.map(p=>p.map(v=>+v.toFixed(1)))));
console.log(levels.length,'levels', Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,v.join('').length])));
