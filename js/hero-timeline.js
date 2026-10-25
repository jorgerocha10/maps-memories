// The hero's choreography in one place: what the map is doing and where the camera
// is at every scroll position. The live 3D (desktop) and the pre-rendered frame
// sequence (phones, built by tools/frames.mjs) both read it, so they match.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

export const CARVE = [0.31, 0.54];

// Camera keys: [p, theta, phi, dist, tx, ty, tz]
export const KEYS_DESK = [
  [0.00, 0, 89.4, 860, 0, 0, 0],
  [0.10, 0, 89.4, 860, 0, 0, 0],
  [0.31, -22, 48, 610, 0, 12, 0],
  [0.54, 18, 36, 520, 0, 22, 0],
  [0.60, 32, 34, 540, 0, 22, 0],
  [0.82, 24, 30, 960, -135, 36, 22],
  [1.00, 30, 30, 960, -135, 36, 22],
];
export const KEYS_PHONE = [
  [0.00, 0, 89.4, 860, 0, 0, 0],
  [0.10, 0, 89.4, 860, 0, 0, 0],
  [0.31, -22, 52, 1300, 0, -60, 0],
  [0.54, 18, 42, 1250, 0, -60, 0],
  [0.60, 32, 40, 1280, 0, -60, 0],
  [0.82, 26, 32, 1720, 10, -205, 25],
  [1.00, 30, 32, 1720, 10, -205, 25],
];

export function camAt(p, K) {
  let i = 1; while (i < K.length - 1 && K[i][0] < p) i++;
  const a = K[i - 1], b = K[i], t = smooth(a[0], b[0], p);
  return a.map((v, k) => lerp(v, b[k], t)).slice(1);
}

export function heroState(p) {
  return {
    light: smooth(0.06, 0.24, p),
    rise: smooth(0.12, 0.30, p),
    carve: smooth(CARVE[0], CARVE[1], p),
    frame: smooth(0.58, 0.70, p),
    lid: smooth(0.68, 0.80, p),
    glow: 0.9 * smooth(0.78, 0.81, p) * (1 - smooth(0.81, 0.9, p)),
  };
}

// Phone frame sequence: frame i shows scroll position SEQ.from + i * SEQ.step.
export const SEQ = { from: 0.04, to: 1.0, count: 97, w: 780, h: 1690, dir: 'assets/hero-seq/' };
SEQ.step = (SEQ.to - SEQ.from) / (SEQ.count - 1);
export const seqFile = i => `${SEQ.dir}f${String(i).padStart(3, '0')}.webp`;
