import fs from 'fs';
export function key(){const t=fs.readFileSync(new URL('../../../../.env',import.meta.url),'utf8');const m=t.match(/^\s*OPENAI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m);if(!m||!m[1].trim())throw new Error('OPENAI_API_KEY missing in Maps&Memories/.env');return m[1].trim();}
