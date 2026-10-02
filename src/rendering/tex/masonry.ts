import { RGB, clamp, sstep, lerp, mulberry, hash, noise, ramp, cellular, crackMask, contrast } from './core';
import { Out, setc } from './out';

export interface BlockP {
  rows: number;
  perRow: number;
  hVar: number;       // course height variance 0..1
  wVar: number;       // block width variance 0..1
  stagger: boolean;   // half-offset alternate rows (running bond)
  ramp: RGB[];        // block colour ramp
  mortar: RGB;
  mortarW: number;    // px
  round: number;      // edge rounding px
  bulge: number;      // rusticated pillow 0..1
  rough: number;      // surface bump amount
  toneVar: number;
  cracks: number;
  seed: number;
  soot?: number;
  pitted?: boolean;
}

export function genBlocks(o: Out, p: BlockP): void {
  const n = o.n, rand = mulberry(p.seed);
  const mott = noise(n, 3, 3, 5, p.seed + 1);
  const fine = noise(n, 32, 32, 3, p.seed + 2);
  const coarse = noise(n, 8, 8, 5, p.seed + 3);
  const edgeN = noise(n, 24, 24, 3, p.seed + 4);
  const grit = noise(n, 200, 200, 1, p.seed + 7);
  const stain = noise(n, 2, 4, 5, p.seed + 5);
  const crk = p.cracks ? crackMask(n, p.cracks, p.seed + 6, 220, 1.5, 1) : null;

  // course boundaries
  const hs: number[] = [];
  let tot = 0;
  for (let r = 0; r < p.rows; r++) { const h = 1 + (rand() - 0.5) * 2 * p.hVar; hs.push(h); tot += h; }
  const rowY0: number[] = [], rowY1: number[] = [];
  let acc = 0;
  for (let r = 0; r < p.rows; r++) { rowY0.push((acc / tot) * n); acc += hs[r]; rowY1.push((acc / tot) * n); }
  const rowOf = new Int32Array(n);
  for (let r = 0; r < p.rows; r++) for (let y = Math.round(rowY0[r]); y < Math.round(rowY1[r]) && y < n; y++) rowOf[y] = r;

  // per-row block edges + lookup
  const edges: number[][] = [], blockAt: Int16Array[] = [];
  for (let r = 0; r < p.rows; r++) {
    const ws: number[] = []; let wt = 0;
    for (let b = 0; b < p.perRow; b++) { const w = 1 + (rand() - 0.5) * 2 * p.wVar; ws.push(w); wt += w; }
    let x0 = p.stagger ? (r & 1) * (n / p.perRow / 2) : rand() * n;
    const e: number[] = [];
    for (let b = 0; b < p.perRow; b++) { e.push(x0); x0 += (ws[b] / wt) * n; }
    e.push(e[0] + n);
    edges.push(e);
    const lut = new Int16Array(n);
    for (let x = 0; x < n; x++) {
      const xx = x < e[0] ? x + n : x;
      let b = 0;
      while (b < p.perRow - 1 && xx >= e[b + 1]) b++;
      lut[x] = b;
    }
    blockAt.push(lut);
  }

  const c: RGB = [0, 0, 0];
  for (let y = 0; y < n; y++) {
    const r = rowOf[y];
    const y0 = rowY0[r], y1 = rowY1[r];
    const e = edges[r], lut = blockAt[r];
    for (let x = 0; x < n; x++) {
      const b = lut[x];
      const bx0 = e[b], bx1 = e[b + 1];
      const xx = x < e[0] ? x + n : x;
      const i = y * n + x;
      const en = (edgeN[i] - 0.5) * p.round * 1.3;
      const dxl = xx - bx0, dxr = bx1 - xx;
      const dist = Math.min(dxl, dxr, y - y0, y1 - 1 - y) + en;
      const bw = bx1 - bx0, bh = y1 - y0;
      const half = Math.min(bw, bh) * 0.5;
      const tone0 = hash(r, b, p.seed) - 0.5;
      const tone1 = hash(b, r, p.seed + 11);
      const md = sstep(p.mortarW * 0.6, p.mortarW + p.round, dist);
      // block surface
      const bul = Math.sqrt(clamp(dist / half)) * p.bulge;
      const surf = (coarse[i] - 0.5) * p.rough + (fine[i] - 0.5) * p.rough * 0.5;
      let hgt = 0.15 + md * (0.55 + 0.25 * tone1) + bul * 0.35 + surf;
      if (p.pitted) hgt -= 0.15 * Math.max(0, fine[i] - 0.65) * 3;
      let t = 0.5 + tone0 * p.toneVar * 1.6 + (mott[i] - 0.5) * 0.7 + (fine[i] - 0.5) * 0.35 + (coarse[i] - 0.5) * 0.3 + (grit[i] - 0.5) * 0.35;
      ramp(p.ramp, clamp(t), c);
      // occlusion near mortar, grime pooling
      let k = 0.7 + 0.3 * sstep(0, p.round + 6, dist);
      k *= 1 - 0.28 * sstep(0.55, 0.85, stain[i]);
      if (p.soot) k *= 1 - p.soot * (1 - sstep(0, 0.6, stain[i])) * 0.6;
      let cr = c[0] * k, cg = c[1] * k, cb = c[2] * k;
      // mortar
      const mm = 1 - md;
      const mt = 0.75 + 0.4 * (fine[i] - 0.5) + 0.3 * (coarse[i] - 0.5);
      cr = lerp(cr, p.mortar[0] * mt * (0.85 + 0.25 * stain[i]), mm);
      cg = lerp(cg, p.mortar[1] * mt * (0.85 + 0.25 * stain[i]), mm);
      cb = lerp(cb, p.mortar[2] * mt * (0.85 + 0.25 * stain[i]), mm);
      if (crk) {
        const cv = crk[i];
        hgt -= cv * 0.5;
        const kk = 1 - cv * 0.85;
        cr *= kk; cg *= kk; cb *= kk;
      }
      setc(o, i, cr, cg, cb);
      o.h[i] = hgt;
      o.r[i] = clamp(0.8 + 0.2 * (fine[i] - 0.5) + mm * 0.15);
    }
  }
}

/** Irregular flagstones from Voronoi cells. */
export function genFlagstone(o: Out, seed: number): void {
  const n = o.n;
  const cl = cellular(n, 5, seed, 0.85);
  const mott = noise(n, 3, 3, 5, seed + 1), fine = noise(n, 40, 40, 3, seed + 2), coarse = noise(n, 10, 10, 4, seed + 3);
  const stain = noise(n, 2, 3, 5, seed + 4), edgeN = noise(n, 20, 20, 3, seed + 5);
  const crk = crackMask(n, 4, seed + 6, 200, 1.4, 1);
  const st: RGB[] = [[58, 56, 52], [100, 96, 88], [134, 126, 112]];
  const c: RGB = [0, 0, 0];
  for (let i = 0; i < n * n; i++) {
    const id = cl.id[i];
    const edge = cl.edge[i] * (n / 5) + (edgeN[i] - 0.5) * 6; // px
    const t0 = hash(id, 3, seed);
    const md = sstep(2.5, 8, edge);
    const worn = 0.5 + (mott[i] - 0.5) * 0.8;
    const t = 0.15 + t0 * 0.5 + (mott[i] - 0.5) * 0.5 + (fine[i] - 0.5) * 0.25 + (coarse[i] - 0.5) * 0.25;
    ramp(st, clamp(t), c);
    // hint of warm/green tint per stone
    const tint = (hash(id, 9, seed) - 0.5) * 14;
    let k = (0.66 + 0.34 * sstep(0, 14, edge)) * (1 - 0.3 * sstep(0.55, 0.85, stain[i]));
    let cr = c[0] * k + tint, cg = c[1] * k + tint * 0.4, cb = c[2] * k - tint * 0.6;
    const mm = 1 - md;
    const mt = 0.55 + 0.45 * fine[i];
    cr = lerp(cr, 62 * mt, mm); cg = lerp(cg, 56 * mt, mm); cb = lerp(cb, 46 * mt, mm);
    const cv = crk[i];
    const kk = 1 - cv * 0.85;
    setc(o, i, cr * kk, cg * kk, cb * kk);
    o.h[i] = 0.1 + md * (0.55 + 0.15 * t0 + 0.2 * sstep(2, 26, edge)) + (coarse[i] - 0.5) * 0.14 + (fine[i] - 0.5) * 0.07 - cv * 0.4 + (worn - 0.5) * 0.05;
    o.r[i] = clamp(0.78 + 0.25 * (fine[i] - 0.5) - 0.12 * (worn - 0.5));
  }
  contrast(o.h, 1);
}
