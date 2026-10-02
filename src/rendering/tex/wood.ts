import { RGB, clamp, sstep, lerp, mulberry, hash, noise, ramp, crackMask } from './core';
import { Out, setc } from './out';

export interface WoodP {
  rows: number;      // planks across the tile (perpendicular to grain)
  joints: number;    // boards per row along grain (0 = full-length, no joints)
  ramp: RGB[];
  gap: number;       // gap between planks in px
  knots: number;
  ringF: number;     // growth-ring lines per plank
  rough: number;
  seed: number;
  cracks?: number;
  toneVar?: number;
}

const GAP: RGB = [10, 7, 5];

export function genWood(o: Out, p: WoodP): void {
  const n = o.n, rand = mulberry(p.seed);
  const streak = noise(n, 2, 64, 4, p.seed + 1);
  const warp = noise(n, 3, 3, 4, p.seed + 2);
  const pores = noise(n, 24, 160, 2, p.seed + 3);
  const blot = noise(n, 4, 4, 5, p.seed + 4);
  const crk = p.cracks ? crackMask(n, p.cracks, p.seed + 9, 260, 1.4, 1) : null;
  const rowPx = n / p.rows;
  const tv = p.toneVar ?? 0.22;

  interface Seg { tone: number; ox: number; oy: number }
  const jx: number[][] = [], segs: Seg[][] = [];
  for (let r = 0; r < p.rows; r++) {
    const j: number[] = [];
    const cnt = Math.max(1, p.joints);
    const base = rand() * n;
    for (let s = 0; s < cnt; s++) j.push(Math.floor(base + (s + rand() * 0.35) * (n / cnt)) % n);
    j.sort((a, b) => a - b);
    jx.push(p.joints ? j : []);
    const ss: Seg[] = [];
    for (let s = 0; s < cnt; s++) ss.push({ tone: (rand() - 0.5) * tv * 2, ox: Math.floor(rand() * n), oy: Math.floor(rand() * n) });
    segs.push(ss);
  }
  const knots: { x: number; y: number; r: number }[] = [];
  for (let k = 0; k < p.knots; k++) knots.push({ x: rand() * n, y: rand() * n, r: 9 + rand() * 12 });

  const c: RGB = [0, 0, 0];
  for (let y = 0; y < n; y++) {
    const rowf = (y * p.rows) / n;
    const r = Math.min(p.rows - 1, Math.floor(rowf));
    const ly = rowf - r;
    const edgeY = Math.min(ly, 1 - ly) * rowPx;
    const J = jx[r];
    for (let x = 0; x < n; x++) {
      let si = 0, jd = 1e9;
      if (J.length) {
        si = J.length - 1;
        for (let k = 0; k < J.length; k++) {
          const dj = (x - J[k] + n) % n;
          if (dj < jd) { jd = dj; si = k; }
        }
        // jd = distance after the nearest preceding joint; before-distance is the next joint
        let dn = 1e9;
        for (let k = 0; k < J.length; k++) dn = Math.min(dn, (J[k] - x + n) % n);
        jd = Math.min(jd, dn);
      }
      const sg = segs[r][J.length ? si : 0];
      const sx = (x + sg.ox) % n, sy = (y + sg.oy) % n;
      const si2 = sy * n + sx;
      const s = streak[si2], w = warp[si2], pr = pores[si2];
      let phase = p.ringF * ly + 3.2 * (w - 0.5) + 2.2 * (s - 0.5);
      let kn = 0, kring = 0;
      for (let k = 0; k < knots.length; k++) {
        const kk = knots[k];
        let dx = x - kk.x, dy = y - kk.y;
        dx -= Math.round(dx / n) * n; dy -= Math.round(dy / n) * n;
        if (Math.abs(dx) > kk.r * 4 || Math.abs(dy) > kk.r * 4) continue;
        const kd = Math.hypot(dx * 0.7, dy) / kk.r;
        const e = Math.exp(-kd * kd * 0.5);
        kn = Math.max(kn, e);
        kring += (0.5 + 0.5 * Math.sin(kd * 11)) * Math.exp(-kd * 0.45) * (kd < 3.2 ? 1 : 0);
        phase += 1.6 * e * Math.sign(dy || 1);
      }
      const ring = Math.pow(0.5 + 0.5 * Math.sin(phase * 6.2832), 1.6);
      let tone = 0.42 * s + 0.36 * ring + 0.12 * pr + 0.1 * blot[y * n + x] + sg.tone;
      tone = lerp(tone, 0.06 + 0.2 * kring, kn * 0.9);
      const dist = Math.min(edgeY, jd);
      ramp(p.ramp, clamp(tone * 1.15), c);
      const shade = 1 - 0.45 * Math.exp(-dist / 5) - 0.12 * (1 - blot[y * n + x]);
      let cr = c[0] * shade, cg = c[1] * shade, cb = c[2] * shade;
      let crackV = 0;
      if (crk) { crackV = crk[y * n + x]; const k = 1 - crackV * 0.9; cr *= k; cg *= k; cb *= k; }
      const gm = 1 - sstep(p.gap * 0.4, p.gap + 1.5, dist);
      cr = lerp(cr, GAP[0], gm); cg = lerp(cg, GAP[1], gm); cb = lerp(cb, GAP[2], gm);
      const i = y * n + x;
      setc(o, i, cr, cg, cb);
      const hd = p.gap > 0 ? sstep(0, p.gap + 2.5, dist) : 1;
      o.h[i] = (0.6 + 0.16 * (tone - 0.5) + 0.08 * (pr - 0.5) - 0.2 * kn * (1 - kring * 0.3) - 0.35 * crackV) * (0.15 + 0.85 * hd);
      o.r[i] = clamp(p.rough + 0.22 * (pr - 0.5) + 0.2 * (0.5 - blot[y * n + x]) + gm * 0.5);
    }
  }
}

/** Basket-weave parquet of slat blocks. */
export function genParquet(o: Out, seed: number): void {
  const n = o.n, cell = n / 4, slat = cell / 4;
  const streak = noise(n, 2, 64, 4, seed + 1), pores = noise(n, 24, 160, 2, seed + 3), blot = noise(n, 4, 4, 5, seed + 4);
  const wear = noise(n, 3, 3, 4, seed + 5);
  const st: RGB[] = [[62, 38, 22], [120, 78, 44], [168, 118, 68]];
  const c: RGB = [0, 0, 0];
  for (let y = 0; y < n; y++) {
    const cy = Math.floor(y / cell);
    for (let x = 0; x < n; x++) {
      const cx = Math.floor(x / cell);
      const horiz = ((cx + cy) & 1) === 0;
      const lx = x - cx * cell, ly = y - cy * cell;
      const across = horiz ? ly : lx, along = horiz ? lx : ly;
      const si = Math.floor(across / slat);
      const lw = across - si * slat;
      const dist = Math.min(lw, slat - lw, along, cell - along);
      const tone0 = hash(cx, cy, si + 7) - 0.5;
      const ox = Math.floor(hash(cx, cy, si) * n), oy = Math.floor(hash(si, cy, cx) * n);
      const gx = (horiz ? x : y) + ox, gy = (horiz ? y : x) + oy;
      const gi = (gy % n) * n + (gx % n);
      const s = streak[gi], pr = pores[gi];
      const ring = 0.5 + 0.5 * Math.sin((lw / slat * 3 + (blot[gi] - 0.5) * 3.5 + s) * 6.28);
      const tone = 0.4 * s + 0.28 * ring + 0.1 * pr + 0.22 + tone0 * 0.5 - 0.12 * wear[y * n + x];
      ramp(st, clamp(tone * 1.05), c);
      const shade = 1 - 0.5 * Math.exp(-dist / 2.5);
      const gm = 1 - sstep(0.8, 2.6, dist);
      const i = y * n + x;
      setc(o, i, lerp(c[0] * shade, 12, gm), lerp(c[1] * shade, 8, gm), lerp(c[2] * shade, 5, gm));
      o.h[i] = (0.6 + 0.1 * (s - 0.5)) * (0.2 + 0.8 * sstep(0, 3, dist));
      o.r[i] = clamp(0.42 + 0.35 * wear[y * n + x] + 0.15 * (pr - 0.5) + gm * 0.5);
    }
  }
}

/** Raised-and-fielded wood panelling (one panel per tile). */
export function genPanelling(o: Out, seed: number): void {
  const n = o.n;
  const streak = noise(n, 64, 2, 4, seed + 1), pores = noise(n, 160, 24, 2, seed + 3);
  const warp = noise(n, 3, 3, 4, seed + 2), blot = noise(n, 4, 4, 5, seed + 4), dirt = noise(n, 6, 6, 4, seed + 6);
  const st: RGB[] = [[46, 28, 18], [96, 60, 36], [142, 92, 56]];
  const c: RGB = [0, 0, 0];
  const r0 = 0.085, bev = 0.05;
  for (let y = 0; y < n; y++) {
    const v = y / n;
    for (let x = 0; x < n; x++) {
      const u = x / n, i = y * n + x;
      const inside = Math.min(u - r0, 1 - r0 - u, v - r0, 1 - r0 - v);
      const rail = (v < r0 || v > 1 - r0) && u > r0 && u < 1 - r0;
      // grain runs vertically in stiles/panel, horizontally in rails
      const sx = rail ? y : x, sy = rail ? x : y;
      const gi = (sy % n) * n + (sx % n);
      const zone = inside < 0 ? 0 : inside < bev ? 1 : 2;
      const off = zone === 2 ? 0.08 : 0;
      const s = streak[gi], w = warp[gi], pr = pores[gi];
      const ring = 0.5 + 0.5 * Math.sin((u * 5 + 2.5 * (w - 0.5) + 1.5 * (s - 0.5) + (zone === 2 ? 0.37 : 0)) * 6.28);
      const tone = 0.4 * s + 0.32 * ring + 0.12 * pr + 0.1 * blot[i] + off - 0.08;
      ramp(st, clamp(tone * 1.15), c);
      let hgt: number, k = 1;
      if (zone === 0) { hgt = 0.9; }
      else if (zone === 1) { const t = inside / bev; hgt = 0.86 - t * 0.36; k = 0.75 + 0.35 * (1 - t); }
      else { hgt = 0.5; k = 0.85; }
      const groove = Math.exp(-Math.abs(inside) / 0.004);
      k *= 1 - 0.65 * groove;
      // dirt gathers in the recesses
      k *= 1 - (zone > 0 ? 0.35 : 0.12) * dirt[i];
      setc(o, i, c[0] * k, c[1] * k, c[2] * k);
      o.h[i] = hgt + 0.03 * (s - 0.5) - 0.3 * groove;
      o.r[i] = clamp(0.5 + 0.2 * (pr - 0.5) + 0.25 * dirt[i]);
    }
  }
}
