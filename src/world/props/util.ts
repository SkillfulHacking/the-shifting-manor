import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as TX from '../../rendering/textures';
import { getMaterial, tileMeters, type MaterialName } from '../../rendering/textures';

export type MatRef = MaterialName | THREE.Material;
export type V3 = [number, number, number];
export interface Xf { p?: V3; r?: V3; s?: V3 | number }

export function rng(seed: number): () => number {
  let a = (Math.floor(seed) * 2654435761 + 12345) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- textures (with local fallbacks so this module works standalone) ---------- */
export function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true): THREE.CanvasTexture {
  const f = (TX as any).canvasTexture;
  if (typeof f === 'function') return f(w, h, draw, srgb);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function paintingTex(seed: number, w = 512, h = 640): THREE.CanvasTexture {
  const f = (TX as any).paintingTexture;
  if (typeof f === 'function') return f(seed, w, h);
  return canvasTex(w, h, (g, W, H) => {
    const r = rng(seed);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#2a2a3a'); gr.addColorStop(1, '#151008');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(${60 + r() * 80},${40 + r() * 40},${30},0.3)`; g.beginPath(); g.arc(r() * W, r() * H, 30 + r() * 90, 0, 7); g.fill(); }
  });
}

/* ---------- materials ---------- */
const tileOf = new WeakMap<THREE.Material, number>();
const vertGrain = new WeakSet<THREE.Material>();
/** Shared material by name (registers its tile size so Builder can world-scale UVs). */
export function named(name: MaterialName): THREE.MeshStandardMaterial {
  const m = getMaterial(name);
  if (!tileOf.has(m)) { tileOf.set(m, tileMeters(name) || 2); if (name === 'darkWood' || name === 'panelling') vertGrain.add(m); }
  return m;
}
export function mat(m: MatRef): THREE.Material { return typeof m === 'string' ? named(m) : m; }

const tintCache = new Map<string, THREE.MeshStandardMaterial>();
/** Cached tinted clone of a shared material (never mutates the original). */
export function tint(name: MaterialName, color: number, extra?: { roughness?: number; metalness?: number; key?: string }): THREE.MeshStandardMaterial {
  const key = `${name}:${color}:${extra?.roughness ?? ''}:${extra?.metalness ?? ''}:${extra?.key ?? ''}`;
  let m = tintCache.get(key);
  if (!m) {
    m = getMaterial(name).clone();
    tileOf.set(m, tileMeters(name) || 2);
    if (name === 'darkWood' || name === 'panelling') vertGrain.add(m);
    m.color.multiply(new THREE.Color(color));
    if (extra?.roughness !== undefined) m.roughness = extra.roughness;
    if (extra?.metalness !== undefined) m.metalness = extra.metalness;
    tintCache.set(key, m);
  }
  return m;
}
const plainCache = new Map<string, THREE.MeshStandardMaterial>();
export function plain(color: number, roughness = 0.7, metalness = 0, emissive = 0x000000, ei = 1): THREE.MeshStandardMaterial {
  const k = `${color}:${roughness}:${metalness}:${emissive}:${ei}`;
  let m = plainCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: ei }); plainCache.set(k, m); }
  return m;
}
/** Gilt / brass variants. */
export const gilt = () => tint('brass', 0xffe6a8, { roughness: 0.36, metalness: 0.65, key: 'gilt' });
export const brass = () => tint('brass', 0xffffff, { roughness: 0.4, metalness: 0.6, key: 'brassM' });
export const iron = () => tint('ironBlack', 0xffffff, { roughness: 0.6, metalness: 0.5, key: 'ironM' });
export const wood = () => named('darkWood');

/* ---------- geometry helpers ---------- */
/** Chamfered box (44 tris): flat facets catch light like a bevel. */
export function chamferBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  r = Math.min(r, hx * 0.95, hy * 0.95, hz * 0.95);
  const pos: number[] = [], nor: number[] = [];
  const poly = (pts: THREE.Vector3[]) => {
    const c = new THREE.Vector3(); pts.forEach(p => c.add(p)); c.multiplyScalar(1 / pts.length);
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(pts[1], pts[0]), new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
    if (n.dot(c) < 0) { pts.reverse(); n.negate(); }
    for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); }
  };
  const H = [hx, hy, hz], I = [hx - r, hy - r, hz - r];
  const V = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const o1 = (a + 1) % 3, o2 = (a + 2) % 3;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const p = [0, 0, 0]; p[a] = s * H[a]; p[o1] = u * I[o1]; p[o2] = v * I[o2]; return V(p); });
    poly(pts);
  }
  for (let a = 0; a < 3; a++) {
    const b = (a + 1) % 3, c = (a + 2) % 3;
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (const sc of [-1, 1]) { const p = [0, 0, 0]; p[a] = sa * H[a]; p[b] = sb * I[b]; p[c] = sc * I[c]; pts.push(V(p)); }
      for (const sc of [1, -1]) { const p = [0, 0, 0]; p[a] = sa * I[a]; p[b] = sb * H[b]; p[c] = sc * I[c]; pts.push(V(p)); }
      poly(pts);
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    poly([V([sx * hx, sy * I[1], sz * I[2]]), V([sx * I[0], sy * hy, sz * I[2]]), V([sx * I[0], sy * I[1], sz * hz])]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  return g;
}
export const bx = (w: number, h: number, d: number, r = 0): THREE.BufferGeometry =>
  r <= 0 ? new THREE.BoxGeometry(w, h, d)
    : r >= 0.04 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4))
      : chamferBox(w, h, d, r);
export const cyl = (rt: number, rb: number, h: number, seg = 16, open = false): THREE.BufferGeometry => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
export const sph = (r: number, ws = 16, hs = 12): THREE.BufferGeometry => new THREE.SphereGeometry(r, ws, hs);
export const tor = (R: number, r: number, tseg = 8, rseg = 24, arc = Math.PI * 2): THREE.BufferGeometry => new THREE.TorusGeometry(R, r, tseg, rseg, arc);

/** Lathe from [radius, y] pairs. */
export function lathe(pts: [number, number][], seg = 24, phiStart = 0, phiLen = Math.PI * 2): THREE.BufferGeometry {
  return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(p[0], 0.0001), p[1])), seg, phiStart, phiLen);
}
/** Smooth (Catmull-Rom) lathe profile through control points. */
export function smoothLathe(pts: [number, number][], seg = 24, div = 6): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const out = curve.getPoints((pts.length - 1) * Math.max(1, Math.round(div / 2))).map(v => new THREE.Vector2(Math.max(v.x, 0.0001), v.y));
  return new THREE.LatheGeometry(out, seg);
}
/** Ring-shaped (frame) extrusion in XY, depth along +Z from z=0. */
export function ringGeo(w: number, h: number, iw: number, ih: number, depth: number, bevel = 0): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
  if (iw > 0 && ih > 0) {
    const p = new THREE.Path();
    p.moveTo(-iw / 2, -ih / 2); p.lineTo(-iw / 2, ih / 2); p.lineTo(iw / 2, ih / 2); p.lineTo(iw / 2, -ih / 2); p.closePath();
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, bevel);
  return g;
}
/** Gothic pointed arch shape (centered x, base y=0, total height h, arch rise `rise`). */
export const archRise = (w: number, h: number) => Math.min(w * 0.7, h * 0.3);
export function archShape(w: number, h: number, rise?: number): THREE.Shape {
  const rs = rise ?? w * 0.75;
  const sh = h - rs;
  const R = (rs * rs + (w * w) / 4) / w;
  const cx = R - w / 2;
  const a1 = Math.acos(cx / R);
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, sh);
  const N = 14;
  // right arc: centre (-cx, sh)
  for (let i = 1; i <= N; i++) { const a = (i / N) * a1; s.lineTo(-cx + R * Math.cos(a), sh + R * Math.sin(a)); }
  // left arc: centre (cx, sh)
  for (let i = N - 1; i >= 0; i--) { const a = (i / N) * a1; s.lineTo(cx - R * Math.cos(a), sh + R * Math.sin(a)); }
  s.lineTo(-w / 2, 0);
  return s;
}

/** Compose an Xf into a matrix. */
export function xf(t?: Xf): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  if (!t) return m;
  const p = t.p ?? [0, 0, 0];
  const r = t.r ?? [0, 0, 0];
  const s = typeof t.s === 'number' ? [t.s, t.s, t.s] : (t.s ?? [1, 1, 1]);
  m.compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])), new THREE.Vector3(s[0], s[1], s[2]));
  return m;
}

function boxUV(g: THREE.BufferGeometry, tile: number, off = 0, vert = false) {
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u: number, v: number;
    if (nx >= ny && nx >= nz) { u = z; v = y; } else if (ny >= nz) { u = x; v = z; } else { u = x; v = y; }
    if (vert && !(ny > nx && ny > nz)) { const t = u; u = v; v = t; }
    uv.setXY(i, u / tile + off, v / tile + off);
  }
  uv.needsUpdate = true;
}

/** Collects geometry per material and merges into one mesh per material. */
export class Builder {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  constructor(public group: THREE.Group = new THREE.Group()) {}
  add(geo: THREE.BufferGeometry, m: MatRef, t?: Xf | THREE.Matrix4, opts?: { uv?: 'box' | 'keep'; uvOff?: number; hgrain?: boolean }): this {
    const material = mat(m);
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.groups = [];
    g.applyMatrix4(t instanceof THREE.Matrix4 ? t : xf(t));
    const tile = tileOf.get(material);
    if (tile && opts?.uv !== 'keep') boxUV(g, tile, opts?.uvOff ?? 0, vertGrain.has(material) && !opts?.hgrain);
    let arr = this.parts.get(material);
    if (!arr) this.parts.set(material, (arr = []));
    arr.push(g);
    return this;
  }
  /** Repeat helper: add many with transforms. */
  addMany(geo: THREE.BufferGeometry, m: MatRef, ts: Xf[], opts?: { uv?: 'box' | 'keep' }): this {
    for (const t of ts) this.add(geo, m, t, opts);
    return this;
  }
  build(warp?: (v: THREE.Vector3) => void): THREE.Group {
    for (const [material, arr] of this.parts) {
      const merged = mergeGeometries(arr, false);
      if (!merged) continue;
      if (warp) {
        const p = merged.attributes.position, v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); warp(v); p.setXYZ(i, v.x, v.y, v.z); }
        merged.computeBoundingSphere();
      }
      for (const g of arr) g.dispose();
      const me = new THREE.Mesh(merged, material);
      me.castShadow = true; me.receiveShadow = true;
      this.group.add(me);
    }
    this.parts.clear();
    return this.group;
  }
}

export function mesh(geo: THREE.BufferGeometry, m: MatRef, t?: Xf, name?: string): THREE.Mesh {
  const me = new THREE.Mesh(geo, mat(m));
  if (t?.p) me.position.set(...t.p);
  if (t?.r) me.rotation.set(...t.r);
  if (t?.s !== undefined) typeof t.s === 'number' ? me.scale.setScalar(t.s) : me.scale.set(...t.s);
  me.castShadow = true; me.receiveShadow = true;
  if (name) me.name = name;
  return me;
}

export function shadows(g: THREE.Object3D, cast = true, receive = true) {
  g.traverse(o => { if ((o as THREE.Mesh).isMesh && !o.userData.noShadow) { o.castShadow = cast; o.receiveShadow = receive; } });
}

/* ---------- flames & candles ---------- */
export function flameGeometry(h = 0.04, r = 0.011): THREE.BufferGeometry {
  const pts: [number, number][] = [[0, 0], [r * 0.55, h * 0.06], [r * 0.95, h * 0.2], [r, h * 0.35], [r * 0.78, h * 0.58], [r * 0.4, h * 0.8], [r * 0.1, h * 0.95], [0, h]];
  const g = smoothLathe(pts, 10, 3);
  return g;
}
export function makeFlame(h = 0.04, r = 0.011): THREE.Mesh {
  const m = new THREE.MeshBasicMaterial({ color: 0xffa640, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const me = new THREE.Mesh(flameGeometry(h, r), m);
  me.name = 'flame'; me.visible = false; me.userData.noShadow = true;
  me.castShadow = false; me.receiveShadow = false;
  return me;
}
/** Static always-visible flame (for decorative unlit clusters). */
export function staticFlame(h = 0.04, r = 0.011): THREE.Mesh {
  const f = makeFlame(h, r); f.visible = true; return f;
}

export interface CandleOpts { drips?: number; melted?: boolean; seed?: number; flameH?: number; wax?: MatRef }
export interface CandleOut { flame: THREE.Mesh; wick: THREE.Mesh; anchor: THREE.Vector3 }
/** Adds wax body into builder and flame/wick into group at position p (base of candle). */
export function addCandle(b: Builder, p: V3, height: number, radius: number, o: CandleOpts = {}): CandleOut {
  const r = rng(o.seed ?? 1);
  const wax = o.wax ?? 'candleWax';
  const top = height;
  const pts: [number, number][] = [[0.0001, 0], [radius * 1.02, 0], [radius, height * 0.05], [radius * 0.97, height * 0.5], [radius * 0.94, top - radius * 0.35], [radius * 0.78, top - radius * 0.12], [radius * 0.45, top - radius * 0.22], [0.0001, top - radius * 0.3]];
  b.add(lathe(pts, 10), wax, { p });
  // drips
  const nd = o.drips ?? 3;
  for (let i = 0; i < nd; i++) {
    const a = r() * Math.PI * 2, len = height * (0.15 + r() * 0.35), rr = radius * (0.1 + r() * 0.08);
    const x = Math.cos(a) * radius * 0.97, z = Math.sin(a) * radius * 0.97;
    b.add(cyl(rr, rr * 0.9, len, 6), wax, { p: [p[0] + x, p[1] + top - len / 2 - radius * 0.2, p[2] + z] });
    b.add(sph(rr * 1.25, 5, 4), wax, { p: [p[0] + x, p[1] + top - len - radius * 0.2, p[2] + z] });
  }
  const wickH = 0.014;
  const wick = new THREE.Mesh(cyl(0.0011, 0.0013, wickH, 5), plain(0x1a1410, 1));
  wick.name = 'wick'; wick.position.set(p[0], p[1] + top - radius * 0.3 + wickH / 2, p[2]);
  wick.userData.noShadow = true;
  const fh = o.flameH ?? 0.04;
  const flame = makeFlame(fh, Math.min(0.013, radius * 0.4 + 0.004));
  flame.position.set(p[0], p[1] + top - radius * 0.3 + wickH * 0.8, p[2]);
  b.group.add(wick, flame);
  return { flame, wick, anchor: new THREE.Vector3(p[0], p[1] + top - radius * 0.3 + wickH + fh * 0.4, p[2]) };
}

/** Ornate spiral/scroll "acanthus" crest shape for frames etc. (symmetric, centered, base y=0). */
export function crestShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = w / 2;
  s.moveTo(-hw, 0);
  s.bezierCurveTo(-hw, h * 0.35, -hw * 0.55, h * 0.4, -hw * 0.35, h * 0.55);
  s.bezierCurveTo(-hw * 0.2, h * 0.72, -hw * 0.22, h * 0.9, 0, h);
  s.bezierCurveTo(hw * 0.22, h * 0.9, hw * 0.2, h * 0.72, hw * 0.35, h * 0.55);
  s.bezierCurveTo(hw * 0.55, h * 0.4, hw, h * 0.35, hw, 0);
  s.bezierCurveTo(hw * 0.6, h * 0.12, hw * 0.3, h * 0.1, 0, h * 0.14);
  s.bezierCurveTo(-hw * 0.3, h * 0.1, -hw * 0.6, h * 0.12, -hw, 0);
  return s;
}

/** Ornate gilded frame around an opening of iw x ih, centred at origin, back at z=0, front +Z. */
export function ornateFrame(iw: number, ih: number, bw = 0.09, tone: 'gilt' | 'dark' = 'gilt'): THREE.Group {
  const b = new Builder();
  const m: THREE.Material = tone === 'gilt' ? gilt() : tint('darkWood', 0x9a8070, { key: 'frameDark' });
  const ow = iw + bw * 2, oh = ih + bw * 2;
  // stepped layers: outer flat, raised bead, cove, inner lip
  b.add(ringGeo(ow, oh, ow - bw * 0.7, oh - bw * 0.7, 0.025, 0.004), m, { p: [0, 0, 0] }, { uv: 'keep' });
  b.add(ringGeo(ow - bw * 0.5, oh - bw * 0.5, iw + bw * 0.9, ih + bw * 0.9, 0.04, 0.006), m, { p: [0, 0, 0] }, { uv: 'keep' });
  b.add(ringGeo(iw + bw * 1.1, ih + bw * 1.1, iw + bw * 0.35, ih + bw * 0.35, 0.052, 0.005), m, undefined, { uv: 'keep' });
  b.add(ringGeo(iw + bw * 0.4, ih + bw * 0.4, iw, ih, 0.03, 0.003), m, undefined, { uv: 'keep' });
  // beading: small spheres along the raised ring
  const bead = sph(0.0085, 5, 3);
  const bs = 0.032;
  const bwid = ow - bw * 0.75, bhei = oh - bw * 0.75;
  const nx = Math.round(bwid / bs), ny = Math.round(bhei / bs);
  for (let i = 1; i < nx; i++) for (const sy of [-1, 1]) b.add(bead, m, { p: [-bwid / 2 + (bwid * i) / nx, sy * bhei / 2, 0.044] , s: [1, 1, 0.7] }, { uv: 'keep' });
  for (let i = 1; i < ny; i++) for (const sx of [-1, 1]) b.add(bead, m, { p: [sx * bwid / 2, -bhei / 2 + (bhei * i) / ny, 0.044], s: [1, 1, 0.7] }, { uv: 'keep' });
  // corner rosettes
  const rose = lathe([[0, 0.03], [0.012, 0.03], [0.026, 0.04], [0.032, 0.052], [0.02, 0.066], [0.009, 0.072], [0.004, 0.08], [0, 0.08]], 12);
  const petals = tor(0.026, 0.006, 5, 10);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const p: V3 = [sx * (ow / 2 - bw * 0.45), sy * (oh / 2 - bw * 0.45), 0.02];
    b.add(rose, m, { p, s: [bw * 9.5, bw * 9.5, 1] }, { uv: 'keep' });
    b.add(petals, m, { p: [p[0], p[1], 0.048], s: [bw * 9, bw * 9, 1.2] }, { uv: 'keep' });
    // fleur leaves radiating diagonally
    for (let k = 0; k < 3; k++) {
      const a = Math.atan2(sy, sx) + (k - 1) * 0.6;
      b.add(sph(0.014, 6, 5), m, { p: [p[0] + Math.cos(a) * bw * 0.72, p[1] + Math.sin(a) * bw * 0.72, 0.038], s: [1.7, 0.7, 0.6], r: [0, 0, a] }, { uv: 'keep' });
    }
  }
  // top crest & bottom apron
  const crest = new THREE.ExtrudeGeometry(crestShape(Math.min(ow * 0.42, 0.55), bw * 1.35), { depth: 0.02, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 6 });
  b.add(crest, m, { p: [0, oh / 2 - 0.004, 0.02] }, { uv: 'keep' });
  b.add(sph(0.022, 8, 6), m, { p: [0, oh / 2 + bw * 1.2, 0.035], s: [0.8, 1.3, 0.6] }, { uv: 'keep' });
  const apron = new THREE.ExtrudeGeometry(crestShape(Math.min(ow * 0.3, 0.4), bw * 0.9), { depth: 0.02, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1, curveSegments: 5 });
  b.add(apron, m, { p: [0, -oh / 2 + 0.004, 0.02], r: [Math.PI, 0, 0] }, { uv: 'keep' });
  return b.build();
}

/** Tag a group with userData typed loosely. */
export function tag<T extends THREE.Object3D>(o: T, data: Record<string, unknown>): T { Object.assign(o.userData, data); return o; }

export const TAU = Math.PI * 2;

export function tube(points: V3[], r: number, seg = 24, radial = 6, closed = false): THREE.BufferGeometry {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'catmullrom', 0.5);
  return new THREE.TubeGeometry(c, seg, r, radial, closed);
}
/** Average normals of coincident vertices (fixes shading seams on lathe/sphere-like meshes). */
export function smoothSeams(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal;
  const map = new Map<string, number[]>();
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    const a = map.get(k); if (a) a.push(i); else map.set(k, [i]);
  }
  const v = new THREE.Vector3();
  for (const idx of map.values()) {
    if (idx.length < 2) continue;
    v.set(0, 0, 0);
    for (const i of idx) v.add(new THREE.Vector3().fromBufferAttribute(nor, i));
    v.normalize();
    for (const i of idx) nor.setXYZ(i, v.x, v.y, v.z);
  }
  nor.needsUpdate = true;
  return g;
}
/** Hanging chain from y=0 downward for `len` metres. */
export function addChain(b: Builder, len: number, m: MatRef = 'ironBlack', linkH = 0.055, x = 0, z = 0, y0 = 0) {
  const link = tor(0.016, 0.0055, 4, 8);
  const n = Math.max(1, Math.floor(len / (linkH * 0.72)));
  for (let i = 0; i < n; i++) b.add(link, m, { p: [x, y0 - i * linkH * 0.72 - linkH * 0.4, z], r: [0, (i % 2) * Math.PI / 2, 0], s: [1, (linkH / 0.032), 1] }, { uv: 'keep' });
}
/** small candle cup (bobeche) */
export function cupGeo(r = 0.025): THREE.BufferGeometry {
  return lathe([[0.0001, 0], [r * 0.4, 0], [r * 0.5, 0.01], [r * 0.9, 0.018], [r * 1.25, 0.03], [r * 1.2, 0.034], [r * 0.7, 0.024], [0.0001, 0.02]], 12);
}
