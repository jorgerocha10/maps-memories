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
(function buildRoute() {
  const K = profile.km, E = profile.ele, kmax = K[K.length - 1], e0 = Math.min(...E), e1 = Math.max(...E);
  let d = ''; for (let i = 0; i < K.length; i += 2) d += (i ? 'L' : 'M') + (4 + (E[i] - e0) / (e1 - e0) * 52).toFixed(2) + ' ' + (K[i] / kmax * 1000).toFixed(1);
  ghost.setAttribute('d', d); live.setAttribute('d', d);
  stops.forEach(a => { a.parentElement.style.top = (+a.dataset.km / kmax * 100) + '%'; });
  route.dataset.kmax = kmax;
})();
const liveLen = live.getTotalLength(); live.style.strokeDasharray = liveLen; live.style.strokeDashoffset = liveLen;
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
    live.style.strokeDashoffset = (liveLen * (1 - cv)).toFixed(1);
    const pt = live.getPointAtLength(liveLen * cv), box = route.querySelector('.route__svg').getBoundingClientRect();
    head.style.transform = `translate(${pt.x / 60 * box.width}px, ${pt.y / 1000 * box.height}px)`;
    const kmNow = cv * +route.dataset.kmax; stops.forEach(a => a.classList.toggle('is-passed', +a.dataset.km <= kmNow + 0.01));
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
const plate = document.querySelector('.plate'), msg = plate.querySelector('.plate__msg');
const ORDER_EMAIL = '';   // set to the shop's inbox to send orders by email
function syncOrder() {
  plate.querySelector('[data-order="name"]').textContent = ORDER.name;
  plate.querySelector('[data-order="elev"]').textContent = ORDER.elev.toFixed(1) + '×';
  plate.querySelector('[data-order="path"]').textContent = ORDER.path.toFixed(1) + '×';
}
plate.addEventListener('submit', e => {
  e.preventDefault();
  const f = plate.elements; let bad = null;
  for (const k of ['name', 'email']) { const ok = f[k].value.trim() && f[k].checkValidity(); f[k].setAttribute('aria-invalid', String(!ok)); if (!ok && !bad) bad = f[k]; }
  if (bad) { msg.textContent = bad.name === 'email' ? 'Add an email we can reply to.' : 'Add your name.'; bad.focus(); return; }
  const body = [`Trail: ${ORDER.name}`, `Elevation scale: ${ORDER.elev.toFixed(1)}x`, `Path scale: ${ORDER.path.toFixed(1)}x`, 'Size: 250 mm square, framed',
    `Name: ${f.name.value.trim()}`, `Email: ${f.email.value.trim()}`, `Note: ${f.note.value.trim() || '-'}`].join('\n');
  if (ORDER_EMAIL) {
    location.href = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent('Map order: ' + ORDER.name)}&body=${encodeURIComponent(body)}`;
    msg.textContent = 'Your email app should open with the order filled in. Send it and we will reply.';
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    a.download = 'maps-and-memories-order.txt'; a.click(); URL.revokeObjectURL(a.href);
    msg.textContent = 'Online ordering is not connected yet. We saved your order as a file so nothing is lost.';
  }
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
