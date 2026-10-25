import { MapScene, paintColours } from './terrain.js';
import { parseGPX, buildMap } from './gpx.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const phone = () => innerWidth < 861;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = n => Math.round(n).toLocaleString('en-CA');

// Under reduced motion the hero is a still composition, so it does not need the long pin.
if (reduce) document.querySelector('#top').dataset.scSpan = '1.3';
ScrollCraft.mount(document.body);

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; }
}
const GL = webglOK();
if (!GL) document.documentElement.classList.add('no-webgl');

const ORDER = { name: 'The Teahouse Loop', elev: 1.5, path: 0.8, km: 14.05 };

/* ------------------------------------------------------------------ data */
const [hBuf, mBuf, meta, profile] = await Promise.all([
  fetch('data/teahouse-height.bin').then(r => r.arrayBuffer()),
  fetch('data/teahouse-mat.bin').then(r => r.arrayBuffer()),
  fetch('data/teahouse.json').then(r => r.json()),
  fetch('data/profile.json').then(r => r.json()),
  document.fonts.ready,
]);
function downsample(src, n0, n) {
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * (n0 - 1), y = j / (n - 1) * (n0 - 1), a = x | 0, b = y | 0, u = x - a, v = y - b;
    const a1 = Math.min(a + 1, n0 - 1), b1 = Math.min(b + 1, n0 - 1);
    out[j * n + i] = src[b * n0 + a] * (1 - u) * (1 - v) + src[b * n0 + a1] * u * (1 - v) + src[b1 * n0 + a] * (1 - u) * v + src[b1 * n0 + a1] * u * v;
  }
  return out;
}
const heroN = phone() ? 224 : 320;
const HERO = {
  n: heroN, heights: downsample(new Float32Array(hBuf), meta.grid, heroN), baseScale: meta.elevScale,
  colours: paintColours(new Uint8Array(mBuf), meta.grid), trail: meta.trail.map(p => [p[0], p[1]]),
  title: 'The Teahouse Loop', line: 'Banff National Park  ·  14.05 km  ·  555 m climbed',
};
const eleAtKm = km => { const K = profile.km, E = profile.ele; let i = 1; while (i < K.length - 1 && K[i] < km) i++;
  const t = clamp((km - K[i - 1]) / ((K[i] - K[i - 1]) || 1)); return lerp(E[i - 1], E[i], t); };

/* ------------------------------------------------------------------ hero */
const hero = document.querySelector('#top');
const heroCanvas = hero.querySelector('.hero__gl');
const layers = ['far', 'mid', 'near'].map(k => hero.querySelector('.hero__contours--' + k));
const readout = hero.querySelector('.hero__readout');
const rPlace = readout.querySelector('.readout__place'), rKm = readout.querySelector('.readout__km'), rEle = readout.querySelector('.readout__ele');
let heroScene = null;
if (GL) {
  try {
    heroScene = new MapScene(heroCanvas, { maxDpr: phone() ? 1.5 : 1.75 });
    heroScene.setTerrain(HERO);
  } catch (e) { console.warn(e); document.documentElement.classList.add('no-webgl'); heroScene = null; }
}

// Camera keys: [p, theta, phi, dist, tx, ty, tz]
const KEYS_DESK = [
  [0.00, 0, 89.4, 860, 0, 0, 0],
  [0.10, 0, 89.4, 860, 0, 0, 0],
  [0.31, -22, 48, 610, 0, 12, 0],
  [0.54, 18, 36, 520, 0, 22, 0],
  [0.60, 32, 34, 540, 0, 22, 0],
  [0.82, 24, 30, 960, -135, 36, 22],
  [1.00, 30, 30, 960, -135, 36, 22],
];
const KEYS_PHONE = [
  [0.00, 0, 89.4, 860, 0, 0, 0],
  [0.10, 0, 89.4, 860, 0, 0, 0],
  [0.31, -22, 52, 1300, 0, -60, 0],
  [0.54, 18, 42, 1250, 0, -60, 0],
  [0.60, 32, 40, 1280, 0, -60, 0],
  [0.82, 26, 32, 1720, 10, -205, 25],
  [1.00, 30, 32, 1720, 10, -205, 25],
];
function camAt(p) {
  const K = phone() ? KEYS_PHONE : KEYS_DESK;
  let i = 1; while (i < K.length - 1 && K[i][0] < p) i++;
  const a = K[i - 1], b = K[i], t = smooth(a[0], b[0], p);
  return a.map((v, k) => lerp(v, b[k], t)).slice(1);
}
const fp = () => { const d = 860, f = 30 * Math.PI / 180; return 250 / (2 * d * Math.tan(f / 2)) * 100; };
hero.style.setProperty('--fp', fp() + 'vh');

let heroP = 0, heroTarget = 0, mx = 0, my = 0, mxs = 0, mys = 0;
function heroProgress() {
  const r = hero.getBoundingClientRect(), h = hero.offsetHeight - innerHeight;
  return h > 0 ? clamp(-r.top / h) : 0;
}
if (fine && !reduce) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

function drawHero(p) {
  const emerge = smooth(0.08, 0.30, p);
  mxs += (mx - mxs) * 0.06; mys += (my - mys) * 0.06;
  const calm = 1 - emerge;
  [[0.25, 6], [0.9, 14], [2.4, 26]].forEach(([s, px], i) => {
    const el = layers[i];
    el.style.transform = `translate(calc(-50% + ${mxs * px * calm}px), calc(-50% + ${mys * px * calm}px)) scale(${1 + s * emerge})`;
    el.style.opacity = String([0.32, 0.55, 0.85][i] * (1 - smooth(0.12, 0.28 - i * 0.03, p)));
  });
  if (!heroScene) return;
  const carve = smooth(0.31, 0.54, p);
  heroScene.set({
    light: reduce ? 1 : smooth(0.06, 0.24, p),
    rise: reduce ? 1 : smooth(0.12, 0.32, p),
    carve: reduce ? 1 : carve,
    frame: reduce ? 1 : smooth(0.58, 0.70, p),
    lid: reduce ? 1 : smooth(0.68, 0.80, p),
    glow: 0.9 * smooth(0.78, 0.81, p) * (1 - smooth(0.81, 0.9, p)),
  });
  const c = reduce ? camAt(1) : camAt(p);
  heroScene.view(c[0] + mxs * 4 * (1 - calm), c[1] - mys * 2 * (1 - calm), c[2], c[3], c[4], c[5]);
  heroScene.render();
  // readout follows the carving head
  const ro = smooth(0.29, 0.32, p) * (1 - smooth(0.545, 0.575, p));
  readout.style.opacity = reduce ? 0 : ro.toFixed(3);
  if (ro > 0) {
    const km = carve * ORDER.km;
    rKm.textContent = km.toFixed(1); rEle.textContent = fmt(eleAtKm(km));
    rPlace.textContent = km < 0.4 ? 'Lake Louise Lakeshore' : km < 3.62 ? 'Climbing to Lake Agnes Tea House'
      : km < 8.15 ? 'On to the Plain of Six Glaciers' : km < 13.6 ? 'Down to Lake Louise' : 'Back at the lake';
  }
}

/* -------------------------------------------------- route rail + chrome */
const route = document.querySelector('.route');
const ghost = route.querySelector('.route__ghost'), live = route.querySelector('.route__live'), head = route.querySelector('.route__head');
const stops = [...route.querySelectorAll('.route__stops a')];
// The rail is drawn in real pixels, so the red line, the dot, the stop labels and
// the km readout all sit on one scale: km down the rail, elevation across it.
const railSvg = route.querySelector('.route__svg');
const RK = profile.km, RE = profile.ele, kmax = RK[RK.length - 1];
const re0 = Math.min(...RE), re1 = Math.max(...RE);
route.dataset.kmax = kmax;
stops.forEach(a => { a.parentElement.style.top = (+a.dataset.km / kmax * 100) + '%'; });
let railW = 0, railH = 0, railPts = [];
const fmtPt = ([x, y]) => x.toFixed(1) + ' ' + y.toFixed(1);
function railLayout() {
  const w = railSvg.clientWidth, h = railSvg.clientHeight;
  if (!w || !h || (w === railW && h === railH)) return;
  railW = w; railH = h; railSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  railPts = RK.map((k, i) => [(4 + (RE[i] - re0) / (re1 - re0) * 52) / 60 * w, k / kmax * h]);
  ghost.setAttribute('d', 'M' + railPts.map(fmtPt).join('L'));
}
function railAt(km) {   // the red line up to km, and the point where it ends
  let i = 1; while (i < RK.length - 1 && RK[i] < km) i++;
  const t = clamp((km - RK[i - 1]) / ((RK[i] - RK[i - 1]) || 1));
  const end = [lerp(railPts[i - 1][0], railPts[i][0], t), lerp(railPts[i - 1][1], railPts[i][1], t)];
  return { d: 'M' + railPts.slice(0, i).map(fmtPt).join('L') + 'L' + fmtPt(end), end };
}
// The rail belongs to the map animation: it fills as the trail carves, and a
// waypoint jumps to the scroll position where the carving reaches it.
const CARVE = [0.31, 0.54];
const pForCarve = f => CARVE[0] + (CARVE[1] - CARVE[0]) * (0.5 - Math.sin(Math.asin(1 - 2 * clamp(f)) / 3));
stops.forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  const p = pForCarve(+a.dataset.km / +route.dataset.kmax) + 0.004;
  scrollTo({ top: hero.offsetTop + (hero.offsetHeight - innerHeight) * p, behavior: reduce ? 'auto' : 'smooth' });
}));

const lightSecs = [...document.querySelectorAll('.ground-light')];
const placesSec = document.querySelector('#places'), yoursSec = document.querySelector('#yours'), orderSec = document.querySelector('#order');
function chrome() {
  const hp = heroVisible ? heroP : (hero.getBoundingClientRect().top > 0 ? 0 : 1);
  const show = reduce ? 0 : smooth(0.26, 0.31, hp) * (1 - smooth(0.56, 0.61, hp));
  route.style.opacity = show.toFixed(3); route.style.visibility = show > 0.01 ? 'visible' : 'hidden'; route.classList.toggle('is-on', show > 0.5);
  const cv = smooth(CARVE[0], CARVE[1], hp);
  document.documentElement.style.setProperty('--route-p', cv.toFixed(4));
  if (show > 0) {
    railLayout();
    const kmNow = cv * kmax;
    if (railPts.length) {   // the side rail has no size on phones, where only the bottom bar shows
      const r = railAt(kmNow);
      live.setAttribute('d', r.d);
      head.style.transform = `translate(${r.end[0]}px, ${r.end[1]}px)`;
    }
    stops.forEach(a => a.classList.toggle('is-passed', +a.dataset.km <= kmNow + 0.01));
  }
  const y = 40; document.body.classList.toggle('on-light', lightSecs.some(s => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; }));
  const rp = placesSec.getBoundingClientRect(); document.body.classList.toggle('at-places', rp.top < innerHeight * 0.5 && rp.bottom > innerHeight * 0.5);
  const ry = yoursSec.getBoundingClientRect(); document.body.classList.toggle('at-yours', ry.top < innerHeight * 0.6 && ry.bottom > innerHeight * 0.4);
  const atOrder = orderSec.getBoundingClientRect().top < innerHeight * 0.5;
  document.body.classList.toggle('at-order', atOrder);
  collarState(atOrder);
}

// Header: bare at the top of the hero, slides away while reading down,
// returns on a backing the moment the visitor scrolls up. Hidden at the order plate.
const collar = document.querySelector('.collar');
let lastY = scrollY, travel = 0;
function collarState(atOrder) {
  const y = scrollY, d = y - lastY; lastY = y;
  if (d === 0) return;
  travel = Math.sign(d) === Math.sign(travel) ? travel + d : d;   // distance moved in the current direction
  if (y < 80) { collar.classList.remove('is-hidden', 'is-backed'); return; }
  if (atOrder || travel > 12) collar.classList.add('is-hidden');
  else if (travel < -12) collar.classList.remove('is-hidden');
  collar.classList.add('is-backed');
}

/* --------------------------------------------- stops: the profile strip */
// The loop's real elevation profile runs under the photos. Whatever km sits at
// the centre of the screen is where the red line and its dot have climbed to.
const strip = document.querySelector('[data-strip]');
const pSvg = strip.querySelector('.profile__svg'), pFig = strip.querySelector('.profile');
const pArea = pSvg.querySelector('.profile__area'), pGhost = pSvg.querySelector('.profile__ghost'), pLive = pSvg.querySelector('.profile__live');
const pDot = pSvg.querySelector('.profile__dot'), pGrid = pSvg.querySelector('.profile__grid');
const pLeaders = pSvg.querySelector('.profile__leaders'), pMarks = pSvg.querySelector('.profile__marks');
const pRead = strip.querySelector('.profile__readout'), pKm = pRead.querySelector('[data-pkm]'), pEle = pRead.querySelector('[data-pele]');
const stopEls = [...strip.querySelectorAll('.stop')];
const P_LO = 1700, P_HI = 2150, svgNS = 'http://www.w3.org/2000/svg';
stopEls.forEach(s => s.style.setProperty('--x', (+s.dataset.km / kmax).toFixed(4)));
// Preview: ?art=illustrated swaps the stop photos for the illustrated set.
if (new URLSearchParams(location.search).get('art') === 'illustrated') {
  strip.querySelectorAll('.stop picture').forEach(pic => {
    pic.querySelector('source').srcset = pic.querySelector('source').srcset.replace('assets/wp', 'assets/il');
    const img = pic.querySelector('img'); img.src = img.getAttribute('src').replace('assets/wp', 'assets/il');
    img.alt = 'Illustration: ' + img.alt;
  });
  document.querySelector('.places__note').textContent = 'Illustrations are artistic impressions. Distances and heights are from the trail’s GPX.';
}
let pW = 0, pH = 0, pPts = [], pPad = { t: 14, b: 26 };
const px = km => km / kmax * pW, py = e => pPad.t + (1 - (e - P_LO) / (P_HI - P_LO)) * (pH - pPad.t - pPad.b);
const el = (tag, attrs) => { const n = document.createElementNS(svgNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
function profileLayout() {
  const w = strip.clientWidth, h = pFig.clientHeight;
  if (!w || !h || (w === pW && h === pH)) return;
  pW = w; pH = h; pSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  pPts = RK.map((k, i) => [px(k), py(RE[i])]);
  const line = 'M' + pPts.map(fmtPt).join('L');
  pGhost.setAttribute('d', line);
  pArea.setAttribute('d', line + `L${w} ${h - pPad.b}L0 ${h - pPad.b}Z`);
  pGrid.replaceChildren();
  for (const e of [1800, 1900, 2000, 2100]) {
    pGrid.append(el('line', { x1: 0, x2: w, y1: py(e), y2: py(e) }));
    pGrid.append(Object.assign(el('text', { x: 4, y: py(e) - 5 }), { textContent: e.toLocaleString('en-CA') + ' m' }));
  }
  pGrid.append(el('line', { class: 'axis', x1: 0, x2: w, y1: h - pPad.b, y2: h - pPad.b }));
  for (let k = 0; k <= Math.floor(kmax); k++) {
    pGrid.append(el('line', { class: 'axis', x1: px(k), x2: px(k), y1: h - pPad.b, y2: h - pPad.b + (k % 2 ? 4 : 7) }));
    if (k % 2 === 0 && k > 0) pGrid.append(Object.assign(el('text', { x: px(k), y: h - 6, 'text-anchor': 'middle' }), { textContent: k + ' km' }));
  }
  const hang = parseFloat(getComputedStyle(strip.closest('.places')).getPropertyValue('--hang')) / 100 * innerHeight || 18;
  pLeaders.replaceChildren(); pMarks.replaceChildren();
  stopEls.forEach(s => {
    const k = +s.dataset.km, x = px(k), y = py(eleAtKm(k));
    pLeaders.append(el('line', { x1: x, x2: x, y1: -hang, y2: y }));
    pMarks.append(el('circle', { cx: x, cy: y, r: 5, 'data-km': k }));
  });
}
function profileAt(km) {
  let i = 1; while (i < RK.length - 1 && RK[i] < km) i++;
  const t = clamp((km - RK[i - 1]) / ((RK[i] - RK[i - 1]) || 1));
  const end = [lerp(pPts[i - 1][0], pPts[i][0], t), lerp(pPts[i - 1][1], pPts[i][1], t)];
  return { d: 'M' + pPts.slice(0, i).map(fmtPt).join('L') + 'L' + fmtPt(end), end };
}
let pLastKm = -1;
function drawProfile() {
  profileLayout();
  if (!pPts.length) return;
  const r = strip.getBoundingClientRect();
  const km = clamp((innerWidth / 2 - r.left) / (pW || 1)) * kmax;
  if (Math.abs(km - pLastKm) < 0.002) return; pLastKm = km;
  const a = profileAt(km);
  pLive.setAttribute('d', a.d);
  pDot.setAttribute('cx', a.end[0]); pDot.setAttribute('cy', a.end[1]);
  pRead.style.transform = `translate(calc(${a.end[0].toFixed(1)}px - 50%), ${(a.end[1] - 38).toFixed(1)}px)`;
  pKm.textContent = km.toFixed(1); pEle.textContent = fmt(eleAtKm(km));
  stopEls.forEach(s => s.classList.toggle('is-reached', +s.dataset.km <= km + 0.05));
  pMarks.querySelectorAll('circle').forEach(c => c.classList.toggle('is-reached', +c.dataset.km <= km + 0.05));
}
let placesVisible = false;
new IntersectionObserver(([e]) => { placesVisible = e.isIntersecting; }).observe(placesSec);
addEventListener('resize', () => { pW = 0; pLastKm = -1; });

/* ------------------------------------------------------- the GPX surface */
const surface = document.querySelector('.surface');
const sCanvas = surface.querySelector('.surface__gl'), status = surface.querySelector('.surface__status');
const tune = surface.querySelector('.tune'), frameBtn = surface.querySelector('[data-frame]');
const statEl = k => surface.querySelector(`[data-stat="${k}"]`);
let sScene = null, controls = null, built = null, anim = null, sVisible = false, turn = 0;
const show = { forest: true, water: true, scree: true };

function ensureSurface() {
  if (sScene || !GL) return sScene;
  sScene = new MapScene(sCanvas, { maxDpr: phone() ? 1.5 : 1.75 });
  sScene.view(20, 42, phone() ? 1150 : 640, 0, 10, 0);
  if (fine) {
    controls = new OrbitControls(sScene.camera, sCanvas);
    Object.assign(controls, { enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.08, minPolarAngle: 0.2, maxPolarAngle: 1.35 });
    controls.target.set(0, 10, 0); controls.update();
    controls.addEventListener('change', () => { sScene._dirty = true; });
  }
  new IntersectionObserver(([e]) => { sVisible = e.isIntersecting; }).observe(sCanvas);
  return sScene;
}

function tween(ms, fn, done) {
  if (reduce) { fn(1); done?.(); return; }
  const t0 = performance.now(); cancelAnimationFrame(anim);
  const step = now => { const t = clamp((now - t0) / ms); fn(1 - Math.pow(1 - t, 3)); if (t < 1) anim = requestAnimationFrame(step); else done?.(); };
  anim = requestAnimationFrame(step);
}

async function loadTrail(text, sourceBtn) {
  if (!GL) { status.textContent = 'Your browser has WebGL turned off, so the 3D preview cannot run. You can still order below.'; }
  let trk;
  try { trk = parseGPX(text); } catch (e) { status.textContent = e.message; return; }
  sourceBtn?.setAttribute('aria-busy', 'true');
  surface.dataset.state = 'loading'; tune.disabled = true;
  status.textContent = `Reading ${trk.pts.length.toLocaleString()} points from “${trk.name}”…`;
  try {
    built = await buildMap(trk, { n: phone() ? 192 : 256, onStep: s => {
      status.textContent = s === 'elevation' ? 'Fetching the real terrain…' : 'Painting forest, water and scree from OpenStreetMap…'; } });
  } catch (e) {
    status.textContent = 'The terrain service did not answer. Check your connection and try again.';
    surface.dataset.state = 'empty'; sourceBtn?.removeAttribute('aria-busy'); return;
  }
  sourceBtn?.removeAttribute('aria-busy');
  statEl('name').textContent = built.name;
  statEl('km').textContent = built.km.toFixed(2) + ' km';
  statEl('high').textContent = fmt(built.high) + ' m';
  statEl('extent').textContent = built.extentKm.toFixed(1) + ' km square';
  ORDER.name = built.name; syncOrder();
  if (!GL) return;
  const sc = ensureSurface();
  const elev = +tune.elements.elev.value, path = +tune.elements.path.value;
  sc.setTerrain({ n: built.n, heights: built.heights, colours: paintColours(built.mats, built.matN, show), trail: built.trail, baseScale: 1,
    title: built.name, line: `${built.km.toFixed(2)} km  ·  high point ${fmt(built.high)} m` });
  sc.set({ elevMul: elev, pathScale: path, rise: 0, carve: 0, frame: 0, lid: 0, light: 1 });
  frameBtn.setAttribute('aria-pressed', 'false'); frameBtn.textContent = 'Put it in the frame';
  surface.dataset.state = 'ready'; tune.disabled = false;
  status.textContent = built.cover === 'ok' ? '' : 'OpenStreetMap did not answer, so forest and scree are estimated from elevation and slope. The printed map uses the OpenStreetMap data.';
  tween(1900, t => sc.set({ rise: t }), () => tween(2200, t => sc.set({ carve: t })));
}

sCanvas.closest('.surface__view').addEventListener('dragover', e => { e.preventDefault(); surface.classList.add('is-over'); });
sCanvas.closest('.surface__view').addEventListener('dragleave', () => surface.classList.remove('is-over'));
sCanvas.closest('.surface__view').addEventListener('drop', async e => {
  e.preventDefault(); surface.classList.remove('is-over');
  const f = e.dataTransfer.files?.[0]; if (f) loadTrail(await f.text());
});
surface.querySelector('#gpx-file').addEventListener('change', async e => { const f = e.target.files?.[0]; if (f) loadTrail(await f.text()); e.target.value = ''; });
surface.querySelectorAll('[data-sample]').forEach(b => b.addEventListener('click', async () => {
  const t = await fetch(b.dataset.sample).then(r => r.text()); loadTrail(t, b);
}));

tune.addEventListener('input', e => {
  const el = e.target;
  if (el.name === 'elev' || el.name === 'path') {
    const v = +el.value; surface.querySelector(`[data-out="${el.name}"]`).textContent = v.toFixed(1) + '×';
    ORDER[el.name] = v; syncOrder();
    sScene?.set(el.name === 'elev' ? { elevMul: v / (sScene.baseScale || 1) } : { pathScale: v });
  } else if (el.type === 'checkbox') {
    show[el.name] = el.checked; if (sScene && built) sScene.setColours(paintColours(built.mats, built.matN, show));
  }
});
frameBtn.addEventListener('click', () => {
  if (!sScene) return;
  const on = frameBtn.getAttribute('aria-pressed') !== 'true';
  frameBtn.setAttribute('aria-pressed', String(on)); frameBtn.textContent = on ? 'Take it out of the frame' : 'Put it in the frame';
  const f0 = sScene.state.frame, l0 = sScene.state.lid;
  tween(1600, t => sScene.set({ frame: lerp(f0, on ? 1 : 0, Math.min(1, t * 1.4)), lid: lerp(l0, on ? 1 : 0, clamp(t * 1.4 - 0.4)) }));
});

/* ----------------------------------------------------------------- order */
// The store will be on Etsy. Until ETSY_URL is set, the buttons lead to the order
// plate and say the shop opens soon. Paste the shop link here and every button
// becomes "Order on Etsy", opening the shop in a new tab.
const ETSY_URL = '';
if (ETSY_URL) {
  const ext = '<svg class="btn__ext" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="sr"> (opens in a new tab)</span>';
  const toEtsy = a => { a.href = ETSY_URL; a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = 'Order on Etsy' + ext; };
  document.querySelectorAll('[data-etsy]').forEach(toEtsy);
  const soon = document.querySelector('[data-etsy-soon]'), shop = document.createElement('a');
  shop.className = 'btn'; toEtsy(shop); soon.replaceWith(shop);
  const copyBtn = document.querySelector('[data-copy]'); copyBtn.classList.add('btn--ghost'); copyBtn.textContent = 'Copy details';
  document.querySelector('[data-etsy-lede]').textContent = 'Our shop is on Etsy. Copy your trail and settings, then paste them into your order there.';
}

const plate = document.querySelector('.plate'), msg = plate.querySelector('.plate__msg');
function syncOrder() {
  plate.querySelector('[data-order="name"]').textContent = ORDER.name;
  plate.querySelector('[data-order="elev"]').textContent = ORDER.elev.toFixed(1) + '×';
  plate.querySelector('[data-order="path"]').textContent = ORDER.path.toFixed(1) + '×';
}
// The visitor's trail travels to Etsy as text they paste into the personalisation box.
const details = () => [`Trail: ${ORDER.name}`, `Elevation scale: ${ORDER.elev.toFixed(1)}x`, `Path scale: ${ORDER.path.toFixed(1)}x`, 'Size: 250 mm square, framed'].join('\n');
plate.querySelector('[data-copy]').addEventListener('click', async e => {
  const b = e.currentTarget;
  try {
    await navigator.clipboard.writeText(details());
    b.textContent = 'Copied'; msg.textContent = ETSY_URL ? 'Paste these into your Etsy order so we build the right map.' : 'Copied. Keep them for your order when the Etsy shop opens.';
  } catch (_) {
    msg.textContent = details().replace(/\n/g, ' · ');   // clipboard blocked: show it so it can be selected by hand
  }
  const label = b.textContent === 'Copied' ? (ETSY_URL ? 'Copy details' : 'Copy your trail details') : b.textContent;
  setTimeout(() => { b.textContent = label; }, 2200);
});

/* ------------------------------------------------------------------ loop */
let heroVisible = true;
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
function frame() {
  heroTarget = heroProgress();
  heroP += (heroTarget - heroP) * (reduce ? 1 : 0.14);
  if (Math.abs(heroTarget - heroP) < 0.0004) heroP = heroTarget;
  if (heroVisible) drawHero(heroP);
  chrome();
  if (placesVisible) drawProfile();
  if (sScene && sVisible) {
    if (controls) controls.update();
    else if (!reduce && surface.dataset.state === 'ready') { turn += 0.0015; sScene.view(20 + Math.sin(turn) * 25, 42, 1150, 0, -10, 0); }
    sScene.render();
  }
  requestAnimationFrame(frame);
}
syncOrder();
requestAnimationFrame(frame);
addEventListener('resize', () => { hero.style.setProperty('--fp', fp() + 'vh'); heroScene && (heroScene._dirty = true); sScene && (sScene._dirty = true); });

// A keyboard visitor tabbing to the hero's action is taken to the moment it is on screen.
hero.querySelector('.hero__close .btn').addEventListener('focus', () => {
  setTimeout(() => { if (heroProgress() < 0.86) scrollTo({ top: hero.offsetTop + (hero.offsetHeight - innerHeight) * 0.92, behavior: 'instant' }); }, 30);
});
