// The printed map as a three.js object: terrain tile, red trail, black frame,
// plaque + badge, acrylic lid. One renderer for the hero (real Blender export)
// and the GPX surface (terrain built in the browser), so both show the same piece.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';

export const SIZE = 250;                 // mm, the printed tile
export const PALETTE = {                 // material index -> printed colour
  0: '#9aa37f',   // BASE: meadow / open ground
  1: '#33503c',   // FOREST
  2: '#4c7690',   // WATER
  3: '#b8b4aa',   // MOUNTAIN: scree and rock
};
const TRAIL_RED = new THREE.Color('#c8150c');

export function paintColours(mats, n, show = { forest: true, water: true, scree: true }) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(n, n);
  const rgb = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, new THREE.Color(v)]));
  for (let i = 0; i < n * n; i++) {
    let m = mats[i];
    if ((m === 1 && !show.forest) || (m === 2 && !show.water) || (m === 3 && !show.scree)) m = 0;
    const col = rgb[m] || rgb[0];
    img.data[i * 4] = col.r * 255; img.data[i * 4 + 1] = col.g * 255; img.data[i * 4 + 2] = col.b * 255; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function makePlaque(title, line) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#16191c'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#d2bda2';
  g.font = '500 86px Archivo, system-ui, sans-serif'; g.textBaseline = 'middle';
  g.fillText(title.toUpperCase().slice(0, 34), 40, 92);
  g.fillStyle = '#95a7b5'; g.font = '400 58px Geist, system-ui, sans-serif';
  g.fillText(line, 40, 190);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export class MapScene {
  constructor(canvas, { maxDpr = 1.75, shadows = true, shadowSize = 2048 } = {}) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = shadows; r.shadowMap.type = THREE.PCFSoftShadowMap;

    const s = this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;

    this.camera = new THREE.PerspectiveCamera(30, 1, 5, 4000);
    this.target = new THREE.Vector3();

    this.hemi = new THREE.HemisphereLight('#d6e0e8', '#13202b', 0.55); s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#fff1df', 2.6);
    sun.position.set(-230, 260, -140); sun.castShadow = shadows;
    Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 50, far: 900 });
    sun.shadow.mapSize.set(shadowSize, shadowSize); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
    s.add(sun);

    this.model = new THREE.Group(); s.add(this.model);
    this.state = { rise: 1, elevMul: 1, pathScale: 0.8, carve: 1, frame: 0, lid: 0, light: 1 };
    this._dirty = true;
    this._buildFixtures();
  }

  _buildFixtures() {
    // Frame: black base, wider at the front where the plaque sits.
    const frameMat = this.frameMat = new THREE.MeshStandardMaterial({ color: '#141619', roughness: 0.42, metalness: 0.15, transparent: true });
    const frame = this.frame = new THREE.Mesh(new RoundedBoxGeometry(274, 24, 312, 4, 3), frameMat);
    frame.position.set(0, -12, 18); frame.castShadow = frame.receiveShadow = true;
    this.frameGroup = new THREE.Group(); this.frameGroup.add(frame);

    this.plaqueMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, transparent: true });
    const plaque = this.plaque = new THREE.Mesh(new THREE.PlaneGeometry(196, 24.5), this.plaqueMat);
    plaque.rotation.x = -Math.PI / 2; plaque.position.set(14, 0.25, 150);
    this.frameGroup.add(plaque);

    const badgeTex = new THREE.TextureLoader().load(new URL('../assets/badge.webp', import.meta.url).href);
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    this.badgeMat = new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.35, metalness: 0.55, transparent: true });
    const badge = this.badge = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1.6, 64), [
      new THREE.MeshStandardMaterial({ color: '#8e5a22', roughness: 0.35, metalness: 0.7 }), this.badgeMat, this.badgeMat]);
    badge.position.set(-108, 0.8, 150); badge.castShadow = true;
    this.badgeGroup = new THREE.Group(); this.badgeGroup.add(badge); this.frameGroup.add(this.badgeGroup);
    this.model.add(this.frameGroup);

    // Acrylic lid. Thin, clear, catches the room in its faces.
    this.lidMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1,
      clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
    this.lidEdgeMat = new THREE.LineBasicMaterial({ color: '#e9f1f6', transparent: true, opacity: 0.4 });
    this.lid = new THREE.Group(); this.model.add(this.lid);

    // Trail head: the light that carves.
    this.head = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 16), new THREE.MeshBasicMaterial({ color: '#ff5040', toneMapped: false }));
    this.headLight = new THREE.PointLight('#ff3b2a', 0, 60, 2);
    this.head.add(this.headLight); this.model.add(this.head);
  }

  setLidHeight(h) {
    this.lid.children.forEach(o => o.geometry.dispose());   // the lid is rebuilt as the terrain rises; free the old one
    this.lid.clear();
    const g = new THREE.BoxGeometry(258, h, 258);
    const box = new THREE.Mesh(g, this.lidMat); box.position.y = h / 2; box.renderOrder = 10;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g), this.lidEdgeMat); edges.position.y = h / 2;
    this.lid.add(box, edges); this.lidH = h;
  }

  /** heights: Float32Array n*n in mm (row 0 = north), baseScale: the elevation scale they were made at. */
  setTerrain({ n, heights, colours, trail, baseScale = 1, title = '', line = '' }) {
    this.n = n; this.heights = heights; this.baseScale = baseScale; this.trailSrc = trail;
    if (this.terrain) { this.model.remove(this.terrain, this.walls); this.terrain.geometry.dispose(); this.walls.geometry.dispose(); }
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, n - 1, n - 1); geo.rotateX(-Math.PI / 2);
    this.colourTex = new THREE.CanvasTexture(colours); this.colourTex.colorSpace = THREE.SRGBColorSpace; this.colourTex.anisotropy = 8;
    this.terrainMat = new THREE.MeshStandardMaterial({ map: this.colourTex, roughness: 0.9, metalness: 0, transparent: true });
    this.terrain = new THREE.Mesh(geo, this.terrainMat); this.terrain.castShadow = this.terrain.receiveShadow = true;
    // Walls: the printed tile's sides, down to the frame.
    const per = 4 * (n - 1), wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((per + 1) * 2 * 3), 3));
    const idx = []; for (let i = 0; i < per; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    wg.setIndex(idx);
    this.wallMat = new THREE.MeshStandardMaterial({ color: '#5f6b4e', roughness: 0.95, side: THREE.DoubleSide, transparent: true });
    this.walls = new THREE.Mesh(wg, this.wallMat); this.walls.castShadow = true;
    this.model.add(this.terrain, this.walls);
    this.plaqueMat.map?.dispose(); this.plaqueMat.map = makePlaque(title, line); this.plaqueMat.needsUpdate = true;
    this._geoKey = ''; this._dirty = true;
  }

  setColours(canvas) { this.colourTex.image = canvas; this.colourTex.needsUpdate = true; this._dirty = true; }

  heightAt(x, y) {   // blender-style mm coords: x east, y north, both -125..125
    const n = this.n, h = this.heights;
    const fx = Math.min(Math.max((x + SIZE / 2) / SIZE * (n - 1), 0), n - 1.001);
    const fy = Math.min(Math.max((SIZE / 2 - y) / SIZE * (n - 1), 0), n - 1.001);
    const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j;
    const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
    return this._z(a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v);
  }
  _z(h) { const { rise, elevMul } = this.state; return 2 + (h - 2) * elevMul * rise; }

  _updateGeometry() {
    const { n, heights } = this; const s = this.state;
    const key = s.rise.toFixed(4) + '|' + s.elevMul.toFixed(3) + '|' + s.pathScale.toFixed(3);
    if (key === this._geoKey) return; this._geoKey = key;
    const pos = this.terrain.geometry.attributes.position; let maxY = 0;
    for (let i = 0; i < n * n; i++) { const y = this._z(heights[i]); pos.setY(i, y); if (y > maxY) maxY = y; }
    pos.needsUpdate = true; this.terrain.geometry.computeVertexNormals(); this.terrain.geometry.computeBoundingSphere();
    this.maxY = maxY;
    // walls around the perimeter, clockwise from NW
    const wp = this.walls.geometry.attributes.position, ring = [];
    for (let i = 0; i < n - 1; i++) ring.push(i);                       // north edge W->E
    for (let j = 0; j < n - 1; j++) ring.push(j * n + n - 1);           // east edge N->S
    for (let i = n - 1; i > 0; i--) ring.push((n - 1) * n + i);          // south edge E->W
    for (let j = n - 1; j >= 0; j--) ring.push(j * n);                  // west edge S->N
    ring.forEach((vi, k) => { const x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
      wp.setXYZ(k * 2, x, y, z); wp.setXYZ(k * 2 + 1, x, 0, z); });
    wp.needsUpdate = true; this.walls.geometry.computeVertexNormals(); this.walls.geometry.computeBoundingSphere();
    this._buildTrail();
    if (Math.abs((this.lidH || 0) - (maxY + 10)) > 2) this.setLidHeight(Math.max(maxY + 10, 24));
  }

  _buildTrail() {
    if (this.trail) { this.model.remove(this.trail); this.trail.geometry.dispose(); }
    const src = this.trailSrc; if (!src || src.length < 2) return;
    const lift = 1.6 * this.state.pathScale + 0.5;
    const pts = src.map(([x, y]) => new THREE.Vector3(x, this.heightAt(x, y) + lift, -y));
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.3);
    const seg = this.tubeSeg = Math.min(pts.length * 3, 3000);
    const g = new THREE.TubeGeometry(this.curve, seg, 2 * this.state.pathScale, 8, false);
    this.trailMat ??= new THREE.MeshStandardMaterial({ color: TRAIL_RED, emissive: '#ff1d10', emissiveIntensity: 0.55, roughness: 0.5, toneMapped: false });
    this.trail = new THREE.Mesh(g, this.trailMat); this.trail.castShadow = true;
    this.model.add(this.trail); this._applyCarve();
  }
  _applyCarve() {
    if (!this.trail) return;
    const c = this.state.carve, segs = Math.floor(this.tubeSeg * c);
    this.trail.geometry.setDrawRange(0, segs * 8 * 6);
    const on = c > 0.001 && c < 0.999;
    this.head.visible = on || (c > 0.001 && this.state.headAlways);
    if (this.head.visible) this.head.position.copy(this.curve.getPointAt(Math.min(c, 1)));
    this.headLight.intensity = on ? 900 : 0;
  }

  set(p) { Object.assign(this.state, p); this._dirty = true; }

  view(theta, phi, dist, tx = 0, ty = 0, tz = 0) {   // degrees: theta around Y from south, phi above horizon
    const t = THREE.MathUtils.degToRad(theta), f = THREE.MathUtils.degToRad(phi);
    this.camera.position.set(tx + dist * Math.cos(f) * Math.sin(t), ty + dist * Math.sin(f), tz + dist * Math.cos(f) * Math.cos(t));
    this.target.set(tx, ty, tz); this.camera.lookAt(this.target); this._dirty = true;
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    if (w === this._w && h === this._h) return; this._w = w; this._h = h;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this._dirty = true;
  }

  render(force = false) {
    this.resize();
    if (!this.terrain || (!this._dirty && !force)) return;
    const s = this.state;
    this._updateGeometry(); this._applyCarve();
    // fixtures
    const f = s.frame, l = s.lid, ease = t => 1 - Math.pow(1 - t, 3);
    this.frameGroup.visible = f > 0.001;
    this.frameGroup.position.y = -(1 - ease(f)) * 70;
    this.frameMat.opacity = Math.min(1, f * 1.6); this.frameMat.transparent = f < 0.999;
    const b = Math.min(1, Math.max(0, (f - 0.55) / 0.45));
    this.plaqueMat.opacity = b; this.badgeMat.opacity = b; this.badge.material[0].transparent = true; this.badge.material[0].opacity = b;
    this.badgeGroup.position.y = (1 - ease(b)) * 14;
    this.lid.visible = l > 0.001;
    this.lid.position.y = (1 - ease(l)) * 190 + 0.4;
    this.lidMat.opacity = 0.1 * Math.min(1, l * 1.4); this.lidEdgeMat.opacity = 0.42 * Math.min(1, l * 1.4);
    this.terrainMat.opacity = this.wallMat.opacity = Math.min(1, s.light * 1.25);
    this.terrainMat.transparent = this.wallMat.transparent = s.light < 0.999;
    this.sun.intensity = 2.6 * s.light; this.hemi.intensity = 0.55 * s.light;
    if (this.trail) this.trailMat.emissiveIntensity = 0.55 + (s.glow || 0);
    this.renderer.render(this.scene, this.camera);
    this._dirty = false;
  }
}
