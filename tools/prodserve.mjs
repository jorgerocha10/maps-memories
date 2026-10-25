// Local stand-in for Vercel: serves only what .vercelignore lets through and
// applies vercel.json headers, so the deploy can be tested before it exists.
// node tools/prodserve.mjs [port]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const ignore = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
const ignored = rel => ignore.some(p => p.endsWith('/') ? rel.startsWith(p) : p.startsWith('*.') ? rel.endsWith(p.slice(1)) : rel === p || rel.startsWith(p + '.'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.gpx': 'application/gpx+xml', '.bin': 'application/octet-stream' };
const rules = cfg.headers.map(h => ({ re: new RegExp('^' + h.source.replace(/\(\.\*\)/g, '(.*)').replace(/\//g, '\/') + '$'), headers: h.headers }));
http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  if (cfg.cleanUrls && !path.extname(rel) && fs.existsSync(path.join(root, rel + '.html'))) rel += '.html';
  const file = path.join(root, rel);
  if (ignored(rel) || !file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('404'); }
  const urlPath = '/' + rel;
  for (const r of rules) if (r.re.test(urlPath)) for (const h of r.headers) res.setHeader(h.key, h.value);
  res.setHeader('Content-Type', types[path.extname(rel)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(+process.argv[2] || 4600, '127.0.0.1', () => console.log('prod preview on http://localhost:' + (+process.argv[2] || 4600)));
