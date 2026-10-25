import {key} from './env.mjs';
const r=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:'Bearer '+key()}});
const j=await r.json(); if(!r.ok){console.log(r.status,j.error?.message);process.exit(1)}
console.log(j.data.map(m=>m.id).filter(id=>/image|dall/i.test(id)).sort().join('\n'));
