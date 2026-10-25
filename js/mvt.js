// Minimal Mapbox Vector Tile reader: just enough protobuf to get layers,
// feature tags and geometry rings out of an OpenMapTiles .pbf.
export function readTile(buf, want) {
  const b = new Uint8Array(buf), layers = {};
  let p = 0;
  const varint = () => { let v = 0, s = 0, c; do { c = b[p++]; v += (c & 0x7f) * 2 ** s; s += 7; } while (c & 0x80); return v; };
  const skip = wt => { if (wt === 0) varint(); else if (wt === 1) p += 8; else if (wt === 2) p += varint(); else if (wt === 5) p += 4; };
  const str = (s, e) => new TextDecoder().decode(b.subarray(s, e));
  while (p < b.length) {
    const tag = varint();
    if (tag >> 3 !== 3 || (tag & 7) !== 2) { skip(tag & 7); continue; }
    const end = varint() + p;
    const L = { name: '', extent: 4096, keys: [], vals: [], feats: [] };
    while (p < end) {
      const t = varint(), f = t >> 3, wt = t & 7;
      if (f === 1 && wt === 2) { const n = varint(); L.name = str(p, p + n); p += n; }
      else if (f === 2 && wt === 2) { const n = varint(); L.feats.push([p, p + n]); p += n; }
      else if (f === 3 && wt === 2) { const n = varint(); L.keys.push(str(p, p + n)); p += n; }
      else if (f === 4 && wt === 2) {
        const e = varint() + p; let v = null;
        while (p < e) { const vt = varint(), vf = vt >> 3;
          if (vf === 1) { const n = varint(); v = str(p, p + n); p += n; } else skip(vt & 7); }
        L.vals.push(v);
      }
      else if (f === 5 && wt === 0) L.extent = varint();
      else skip(wt);
    }
    p = end;
    if (want && !want.includes(L.name)) continue;
    layers[L.name] = { extent: L.extent, features: L.feats.map(([s, e]) => feature(s, e, L)) };
    p = end;
  }
  return layers;

  function feature(s, e, L) {
    p = s; const tags = {}; let type = 0, geom = [];
    while (p < e) {
      const t = varint(), f = t >> 3, wt = t & 7;
      if (f === 2 && wt === 2) { const ee = varint() + p; while (p < ee) { const k = varint(), v = varint(); tags[L.keys[k]] = L.vals[v]; } }
      else if (f === 3 && wt === 0) type = varint();
      else if (f === 4 && wt === 2) { const ee = varint() + p; while (p < ee) geom.push(varint()); }
      else skip(wt);
    }
    // decode command stream into rings / lines
    const rings = []; let x = 0, y = 0, i = 0, ring = null;
    const zz = n => (n >>> 1) ^ -(n & 1);
    while (i < geom.length) {
      const c = geom[i++], id = c & 7, cnt = c >> 3;
      if (id === 1 || id === 2) {
        for (let k = 0; k < cnt; k++) {
          x += zz(geom[i++]); y += zz(geom[i++]);
          if (id === 1) { ring = [[x, y]]; rings.push(ring); } else ring.push([x, y]);
        }
      } else if (id === 7 && ring) ring.push(ring[0]);
    }
    return { type, tags, rings };
  }
}
