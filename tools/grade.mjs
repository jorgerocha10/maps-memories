// Colour-grade a photo to the site's muted palette (no generative edits):
// node tools/grade.mjs in.jpg out.png cropLeft cropTop cropRight cropBottom
import fs from 'fs'; import {chromium} from 'playwright-core';
const [inp, out, cl = 0, ct = 0, cr = 0, cb = 0] = process.argv.slice(2);
const b = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const p = await b.newPage();
const data = 'data:image/jpeg;base64,' + fs.readFileSync(inp).toString('base64');
const res = await p.evaluate(async ([d, cl, ct, cr, cb]) => {
  const im = new Image(); im.src = d; await im.decode();
  const w = im.width - cl - cr, h = im.height - ct - cb;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(im, -cl, -ct);
  const px = g.getImageData(0, 0, w, h), a = px.data;
  const curve = v => { const x = v / 255; const s = x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x); return Math.min(255, (0.03 + 0.97 * (x * 0.72 + s * 0.28)) * 1.035 * 255); };   // soft S, lifted blacks
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; let r = a[i], gg = a[i + 1], bb = a[i + 2];
    const l = 0.299 * r + 0.587 * gg + 0.114 * bb;
    // how "electric blue" this pixel is: blue well above red and green
    const blue = Math.max(0, Math.min(1, (bb - Math.max(r, gg) - 25) / 90));
    const sat = 0.88 - 0.36 * blue;                    // ease everything, the sky most
    r = l + (r - l) * sat; gg = l + (gg - l) * sat; bb = l + (bb - l) * sat;
    // pull the sky toward the brand slate (#95A7B5) a touch
    r += (0x95 * (l / 150) - r) * 0.18 * blue; gg += (0xA7 * (l / 150) - gg) * 0.18 * blue; bb += (0xB5 * (l / 150) - bb) * 0.18 * blue;
    // gentle warmth in the mids and highlights
    const warm = 0.04 * (l / 255); r *= 1 + warm; bb *= 1 - warm * 0.9;
    // soft vignette
    const dx = x / w - 0.5, dy = y / h - 0.48, v = 1 - 0.12 * Math.min(1, (dx * dx + dy * dy) * 2.4);
    a[i] = curve(Math.min(255, r)) * v; a[i + 1] = curve(Math.min(255, gg)) * v; a[i + 2] = curve(Math.min(255, bb)) * v;
  }
  g.putImageData(px, 0, 0);
  return c.toDataURL('image/png');
}, [data, +cl, +ct, +cr, +cb]);
fs.writeFileSync(out, Buffer.from(res.split(',')[1], 'base64')); console.log('wrote', out); await b.close();
