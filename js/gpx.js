// GPX -> printable terrain, in the browser. Same sources as TrailPrint3D:
// elevation from Terrain Tiles (terrarium), forest / water / scree from OpenStreetMap.
import { SIZE } from './terrain.js';
import { readTile } from './mvt.js';

const TILE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const TILEJSON = 'https://tiles.openfreemap.org/planet';   // OpenStreetMap as OpenMapTiles vector tiles, CORS-open
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

export function parseGPX(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('That file is not readable GPX.');
  let nodes = [...doc.getElementsByTagName('trkpt')];
  if (nodes.length < 2) nodes = [...doc.getElementsByTagName('rtept')];
  if (nodes.length < 2) throw new Error('No track points found in that GPX.');
  const pts = nodes.map(n => [+n.getAttribute('lat'), +n.getAttribute('lon')]).filter(p => isFinite(p[0]) && isFinite(p[1]));
  const nm = doc.querySelector('trk > name')?.textContent || doc.querySelector('metadata > name')?.textContent || 'Your trail';
  const name = nm.replace(/^GPX Download:\s*/i, '').split(/\s+[—–]\s+/)[0].trim().slice(0, 60).trim() || 'Your trail';
  return { name, pts };
}

const R = 6371000, rad = d => d * Math.PI / 180;
export function distanceKm(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = pts[i - 1], [c, e] = pts[i];
    const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(e - b) / 2) ** 2;
    d += 2 * R * Math.asin(Math.sqrt(h));
  }
  return d / 1000;
}

function frameFor(pts) {
  let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
  for (const [la, lo] of pts) { la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); }
  const lat = (la0 + la1) / 2, lon = (lo0 + lo1) / 2, kx = 111320 * Math.cos(rad(lat)), ky = 110540;
  const extent = Math.max(1500, Math.max((lo1 - lo0) * kx, (la1 - la0) * ky) * 1.3);
  return { lat, lon, kx, ky, extent };
}

const merc = (lat, lon, z) => {
  const s = 256 * 2 ** z, l = rad(lat);
  return [(lon + 180) / 360 * s, (1 - Math.log(Math.tan(l) + 1 / Math.cos(l)) / Math.PI) / 2 * s];
};

function loadImg(url) {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('tile')); i.src = url; });
}

export async function buildMap(trk, { n = 256, onStep = () => {} } = {}) {
  const F = frameFor(trk.pts), half = F.extent / 2;
  const toLatLon = (x, y) => [F.lat + y / F.ky, F.lon + x / F.kx];
  // 1. elevation tiles
  onStep('elevation');
  const mpp = 156543.03 * Math.cos(rad(F.lat));
  const z = Math.max(8, Math.min(14, Math.ceil(Math.log2(mpp * n * 1.6 / F.extent))));
  const [nwLat, nwLon] = toLatLon(-half, half), [seLat, seLon] = toLatLon(half, -half);
  const [px0, py0] = merc(nwLat, nwLon, z), [px1, py1] = merc(seLat, seLon, z);
  const tx0 = Math.floor(px0 / 256), ty0 = Math.floor(py0 / 256), tx1 = Math.floor(px1 / 256), ty1 = Math.floor(py1 / 256);
  const cw = (tx1 - tx0 + 1) * 256, ch = (ty1 - ty0 + 1) * 256;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++)
    jobs.push(loadImg(TILE.replace('{z}', z).replace('{x}', tx).replace('{y}', ty)).then(im => g.drawImage(im, (tx - tx0) * 256, (ty - ty0) * 256)));
  await Promise.all(jobs);
  const px = g.getImageData(0, 0, cw, ch).data;
  const elevAt = (fx, fy) => {
    const x = Math.min(Math.max(fx, 0), cw - 2), y = Math.min(Math.max(fy, 0), ch - 2), i = x | 0, j = y | 0, u = x - i, v = y - j;
    const e = (a, b) => { const k = (b * cw + a) * 4; return px[k] * 256 + px[k + 1] + px[k + 2] / 256 - 32768; };
    return e(i, j) * (1 - u) * (1 - v) + e(i + 1, j) * u * (1 - v) + e(i, j + 1) * (1 - u) * v + e(i + 1, j + 1) * u * v;
  };
  const elev = new Float32Array(n * n); let emin = Infinity, emax = -Infinity;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -half + F.extent * i / (n - 1), y = half - F.extent * j / (n - 1);
    const [la, lo] = toLatLon(x, y), [mx, my] = merc(la, lo, z);
    const e = elevAt(mx - tx0 * 256, my - ty0 * 256); elev[j * n + i] = e;
    if (e < emin) emin = e; if (e > emax) emax = e;
  }
  // mm at elevation scale 1.0 (TrailPrint3D "factor" mode), plus 2 mm floor.
  const mmPerM = SIZE / F.extent, heights = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) heights[i] = 2 + (elev[i] - emin) * mmPerM;

  // 2. trail into map millimetres, thinned to keep the tube light
  const step = Math.max(1, Math.floor(trk.pts.length / 900));
  const trail = trk.pts.filter((_, i) => i % step === 0 || i === trk.pts.length - 1)
    .map(([la, lo]) => [(lo - F.lon) * F.kx * mmPerM, (la - F.lat) * F.ky * mmPerM]);

  // 3. land cover from OpenStreetMap
  onStep('landcover');
  const M = 512, mats = new Uint8Array(M * M);
  let cover = 'ok';
  try { await paintCoverTiles(F, M, mats); }
  catch (_) {
    try { await paintCover(F, M, mats); } catch (e) { cover = 'estimated'; estimateCover(elev, n, F, M, mats); }
  }

  // elevation at each track point, for the plaque
  const tEle = trail.map(([x, y]) => {
    const i = Math.round((x / SIZE + 0.5) * (n - 1)), j = Math.round((0.5 - y / SIZE) * (n - 1));
    return elev[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];
  });
  let gain = 0; for (let i = 1; i < tEle.length; i++) if (tEle[i] > tEle[i - 1]) gain += tEle[i] - tEle[i - 1];
  return { n, heights, trail, mats, matN: M, cover, km: distanceKm(trk.pts), high: Math.round(Math.max(...tEle)), gain: Math.round(gain),
    extentKm: F.extent / 1000, name: trk.name, lat: F.lat, lon: F.lon };
}

async function paintCover(F, M, mats) {
  const half = F.extent / 2;
  const s = F.lat - half / F.ky, w = F.lon - half / F.kx, nn = F.lat + half / F.ky, e = F.lon + half / F.kx;
  const bb = `${s},${w},${nn},${e}`;
  const q = `[out:json][timeout:25];(
    way["natural"~"^(water|wood|scree|bare_rock)$"](${bb});relation["natural"~"^(water|wood|scree|bare_rock)$"](${bb});
    way["landuse"="forest"](${bb});relation["landuse"="forest"](${bb});way["waterway"="riverbank"](${bb});
  );out geom;`;
  let data;
  for (const url of OVERPASS) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: ctl.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      clearTimeout(t); if (r.ok) { data = await r.json(); break; }
    } catch (_) { /* next mirror */ }
  }
  if (!data) throw new Error('overpass');
  const c = document.createElement('canvas'); c.width = c.height = M;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, M, M);
  const P = (pt) => [((pt.lon - F.lon) * F.kx / F.extent + 0.5) * M, (0.5 - (pt.lat - F.lat) * F.ky / F.extent) * M];
  const cls = t => (t.natural === 'water' || t.waterway === 'riverbank') ? 2 : (t.natural === 'wood' || t.landuse === 'forest') ? 1 : 3;
  const colour = { 1: '#ff0000', 2: '#00ff00', 3: '#0000ff' };
  // paint order: scree, then forest, then water on top
  const els = data.elements.filter(el => el.tags).sort((a, b) => ({ 3: 0, 1: 1, 2: 2 }[cls(a.tags)] - { 3: 0, 1: 1, 2: 2 }[cls(b.tags)]));
  for (const el of els) {
    const rings = el.type === 'way' ? [el.geometry || []] : joinRings((el.members || []).filter(m => m.type === 'way' && m.geometry).map(m => m.geometry));
    g.beginPath();
    for (const r of rings) { if (r.length < 3) continue; r.forEach((pt, i) => { const [x, y] = P(pt); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); }
    g.fillStyle = colour[cls(el.tags)]; g.fill('evenodd');
  }
  const d = g.getImageData(0, 0, M, M).data;
  for (let i = 0; i < M * M; i++) { const k = i * 4; mats[i] = d[k + 1] > 127 ? 2 : d[k] > 127 ? 1 : d[k + 2] > 127 ? 3 : 0; }
}

// Primary source: OpenStreetMap land cover from vector tiles. Lakes and riverbanks
// are filled, rivers and streams are drawn as lines, forest is wood, scree is rock and ice.
async function paintCoverTiles(F, M, mats) {
  const tj = await fetch(TILEJSON).then(r => { if (!r.ok) throw new Error('tilejson'); return r.json(); });
  const url = tj.tiles[0], half = F.extent / 2;
  const z = Math.max(10, Math.min(14, Math.round(Math.log2(40075016.7 * Math.cos(rad(F.lat)) / (F.extent / 3)))));
  const [x0f, y0f] = merc(F.lat + half / F.ky, F.lon - half / F.kx, z), [x1f, y1f] = merc(F.lat - half / F.ky, F.lon + half / F.kx, z);
  const tx0 = Math.floor(x0f / 256), ty0 = Math.floor(y0f / 256), tx1 = Math.floor(x1f / 256), ty1 = Math.floor(y1f / 256);
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++)
    jobs.push(fetch(url.replace('{z}', z).replace('{x}', tx).replace('{y}', ty)).then(r => { if (!r.ok) throw new Error('tile'); return r.arrayBuffer(); })
      .then(buf => ({ tx, ty, layers: readTile(buf, ['water', 'waterway', 'landcover']) })));
  const tiles = await Promise.all(jobs);
  const c = document.createElement('canvas'); c.width = c.height = M;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, M, M);
  const n2 = 2 ** z;
  const P = (tx, ty, ext, x, y) => {
    const X = (tx + x / ext) / n2, Y = (ty + y / ext) / n2;
    const lon = X * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * Y))) * 180 / Math.PI;
    return [((lon - F.lon) * F.kx / F.extent + 0.5) * M, (0.5 - (lat - F.lat) * F.ky / F.extent) * M];
  };
  const paint = (layer, test, colour, mode) => {
    for (const t of tiles) {
      const L = t.layers[layer]; if (!L) continue;
      for (const f of L.features) {
        if (!test(f.tags)) continue;
        g.beginPath();
        for (const r of f.rings) r.forEach(([x, y], i) => { const [px, py] = P(t.tx, t.ty, L.extent, x, y); i ? g.lineTo(px, py) : g.moveTo(px, py); });
        if (mode === 'fill' && f.type === 3) { g.fillStyle = colour; g.fill('evenodd'); }
        else if (mode !== 'fill' && f.type === 2) { g.strokeStyle = colour; g.lineWidth = mode; g.lineCap = g.lineJoin = 'round'; g.stroke(); }
      }
    }
  };
  paint('landcover', t => t.class === 'rock' || t.class === 'ice', '#0000ff', 'fill');
  paint('landcover', t => t.class === 'wood', '#ff0000', 'fill');
  paint('water', t => t.class !== 'swimming_pool', '#00ff00', 'fill');
  const px = M / F.extent;   // canvas pixels per metre
  paint('waterway', t => t.class === 'river' || t.class === 'canal', '#00ff00', Math.max(2.5, 30 * px));
  paint('waterway', t => t.class === 'stream', '#00ff00', Math.max(1.4, 9 * px));
  const d = g.getImageData(0, 0, M, M).data;
  for (let i = 0; i < M * M; i++) { const k = i * 4; mats[i] = d[k + 1] > 127 ? 2 : d[k] > 127 ? 1 : d[k + 2] > 127 ? 3 : 0; }
}

// Multipolygon members arrive as separate ways; stitch them into closed rings.
function joinRings(ways) {
  const eq = (a, b) => a && b && a.lat === b.lat && a.lon === b.lon;
  const pool = ways.map(w => w.slice()), rings = [];
  while (pool.length) {
    let ring = pool.shift(), grew = true;
    while (!eq(ring[0], ring[ring.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i], end = ring[ring.length - 1];
        if (eq(w[0], end)) ring = ring.concat(w.slice(1));
        else if (eq(w[w.length - 1], end)) ring = ring.concat(w.slice(0, -1).reverse());
        else if (eq(w[w.length - 1], ring[0])) ring = w.concat(ring.slice(1));
        else if (eq(w[0], ring[0])) ring = w.slice().reverse().concat(ring.slice(1));
        else continue;
        pool.splice(i, 1); grew = true; break;
      }
    }
    rings.push(ring);
  }
  return rings;
}

// When OpenStreetMap cannot answer: forest below the regional treeline on slopes trees hold,
// scree and rock above it or on steep ground. Water is left out rather than guessed.
function estimateCover(elev, n, F, M, mats) {
  const treeline = 3750 - 31 * Math.abs(F.lat), cell = F.extent / (n - 1);
  const at = (i, j) => elev[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const i = Math.round(x / (M - 1) * (n - 1)), j = Math.round(y / (M - 1) * (n - 1)), e = at(i, j);
    const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * cell), dy = (at(i, j + 1) - at(i, j - 1)) / (2 * cell);
    const slope = Math.atan(Math.hypot(dx, dy)) * 180 / Math.PI;
    const wobble = Math.sin(x * 0.11 + y * 0.07) * 35 + Math.sin(x * 0.031 - y * 0.05) * 50;
    mats[y * M + x] = (e > treeline + 120 + wobble || slope > 38) ? 3 : (e < treeline - 60 + wobble && slope < 33) ? 1 : 0;
  }
}
