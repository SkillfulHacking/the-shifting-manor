import { RGB, clamp, sstep, lerp, mulberry, hash, noise, ramp, cellular, crackMask, blur, samp, makeCanvas } from './core';
import { Out, setc } from './out';

// ---------------------------------------------------------------- damask wallpaper
function drawMotif(c: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  c.lineCap = 'round';
  for (const m of [1, -1]) {
    c.save();
    c.scale(m, 1);
    // ogee frame
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(0, -238);
    c.bezierCurveTo(70, -180, 118, -96, 96, -4);
    c.bezierCurveTo(112, 84, 70, 176, 0, 238);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -222);
    c.bezierCurveTo(58, -168, 104, -92, 82, -4);
    c.bezierCurveTo(98, 80, 60, 162, 0, 222);
    c.stroke();
    // main acanthus leaf sweeping from stem
    c.beginPath();
    c.moveTo(0, -80);
    c.bezierCurveTo(30, -140, 78, -130, 84, -76);
    c.bezierCurveTo(70, -96, 46, -92, 40, -66);
    c.bezierCurveTo(70, -60, 86, -30, 66, -6);
    c.bezierCurveTo(56, -22, 36, -26, 24, -14);
    c.bezierCurveTo(46, 0, 50, 24, 34, 40);
    c.lineTo(0, 30);
    c.closePath();
    c.fill();
    // lower leaf
    c.beginPath();
    c.moveTo(0, 60);
    c.bezierCurveTo(40, 40, 80, 60, 78, 112);
    c.bezierCurveTo(60, 96, 44, 100, 40, 118);
    c.bezierCurveTo(32, 100, 16, 100, 0, 110);
    c.closePath();
    c.fill();
    // scroll spiral
    c.lineWidth = 7;
    c.beginPath();
    for (let a = 0; a < 10.5; a += 0.15) {
      const r = 26 - a * 2.3;
      const x = 60 + Math.cos(a - 1) * r, y = 122 + Math.sin(a - 1) * r;
      if (a === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
    // upper tendril
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(6, -150);
    c.bezierCurveTo(40, -200, 66, -170, 52, -150);
    c.bezierCurveTo(44, -140, 34, -152, 42, -158);
    c.stroke();
    // small leaf pair top
    c.beginPath();
    c.moveTo(0, -170);
    c.bezierCurveTo(16, -186, 34, -186, 40, -204);
    c.bezierCurveTo(24, -204, 10, -196, 0, -196);
    c.fill();
    c.restore();
  }
  // central stem + finial teardrops + rosette
  c.beginPath();
  c.moveTo(0, -224);
  c.bezierCurveTo(16, -196, 16, -170, 0, -150);
  c.bezierCurveTo(-16, -170, -16, -196, 0, -224);
  c.fill();
  c.beginPath();
  c.moveTo(0, 224);
  c.bezierCurveTo(16, 196, 16, 170, 0, 150);
  c.bezierCurveTo(-16, 170, -16, 196, 0, 224);
  c.fill();
  c.beginPath();
  c.moveTo(0, -120);
  c.bezierCurveTo(24, -60, 24, 60, 0, 130);
  c.bezierCurveTo(-24, 60, -24, -60, 0, -120);
  c.fill();
  for (let k = 0; k < 8; k++) {
    c.save();
    c.rotate((k * Math.PI) / 4);
    c.beginPath();
    c.ellipse(0, -26, 8, 20, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  c.beginPath(); c.arc(0, -92, 7, 0, 7); c.arc(0, 88, 7, 0, 7); c.fill();
  c.restore();
}

export function genWallpaper(o: Out, base: RGB, motif: RGB, seed: number, sheen = 0.4): void {
  const n = o.n;
  const cv = makeCanvas(n, n);
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000';
  c.fillRect(0, 0, n, n);
  const s = n / 560;
  for (const [x, y] of [[n / 2, n / 2], [0, 0], [n, 0], [0, n], [n, n]]) drawMotif(c, x, y, s);
  const d = c.getImageData(0, 0, n, n).data;
  const m = new Float32Array(n * n);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4] / 255;
  const mh = blur(Float32Array.from(m), n, 2);
  blur(m, n, 1);

  const vert = noise(n, 26, 2, 3, seed + 1);      // vertical wear streaks
  const bigStain = noise(n, 3, 3, 5, seed + 2);
  const blotch = noise(n, 5, 5, 4, seed + 3);
  const grain = noise(n, 128, 128, 2, seed + 4);
  const lo = noise(n, 2, 5, 3, seed + 5);
  const rand = mulberry(seed);
  const fox = new Float32Array(n * n);
  for (let k = 0; k < 90; k++) {
    const fx = rand() * n, fy = rand() * n, fr = 1.5 + rand() * 4.5, fa = 0.3 + rand() * 0.5;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      const dd = Math.hypot(dx, dy) / fr;
      if (dd < 1.6) { const ix = (Math.floor(fx) + dx + n) % n, iy = (Math.floor(fy) + dy + n) % n; fox[iy * n + ix] = Math.max(fox[iy * n + ix], fa * (1 - sstep(0.3, 1.6, dd))); }
    }
  }
  const crk = crackMask(n, 2, seed + 7, 120, 1, 1);
  const cA: RGB = [0, 0, 0];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const stripe = 0.5 + 0.5 * Math.sin((x / n) * 6.2832 * 32);
      const fade = 0.62 + 0.55 * lo[i] - 0.15;
      const mm = m[i];
      cA[0] = lerp(base[0], motif[0], mm);
      cA[1] = lerp(base[1], motif[1], mm);
      cA[2] = lerp(base[2], motif[2], mm);
      let k = (0.94 + 0.06 * stripe) * (0.92 + 0.16 * grain[i]) * fade * (0.84 + 0.3 * vert[i]);
      // water stains with darker rim
      const sv = bigStain[i];
      const stain = sstep(0.58, 0.7, sv);
      const rim = Math.exp(-Math.pow((sv - 0.615) / 0.014, 2));
      k *= 1 - 0.16 * stain * blotch[i] - 0.12 * rim;
      let r = cA[0] * k, g = cA[1] * k, b = cA[2] * k;
      // foxing
      const f = fox[i];
      r = lerp(r, 118, f * 0.45); g = lerp(g, 84, f * 0.45); b = lerp(b, 48, f * 0.45);
      // yellowing in stains
      r += 5 * stain; g += 3 * stain; b -= 3 * stain;
      const cr = crk[i] * 0.45;
      setc(o, i, r * (1 - cr), g * (1 - cr), b * (1 - cr));
      o.h[i] = 0.5 + mh[i] * 0.22 + (grain[i] - 0.5) * 0.05 - cr * 0.3;
      o.r[i] = clamp(0.88 - mm * sheen + (vert[i] - 0.5) * 0.25 + stain * 0.08);
    }
  }
}

// ---------------------------------------------------------------- plaster
export function genPlaster(o: Out, base: RGB, seed: number, cracks: number, dirty: number): void {
  const n = o.n;
  const mott = noise(n, 3, 3, 6, seed + 1);
  const trowel = noise(n, 6, 6, 3, seed + 2);
  const grit = noise(n, 200, 200, 2, seed + 3);
  const fine = noise(n, 48, 48, 3, seed + 4);
  const st = noise(n, 3, 3, 5, seed + 5);
  const vs = noise(n, 8, 2, 4, seed + 6); // drip streaks
  const crk = cracks ? crackMask(n, cracks, seed + 7, 260, 1.7, 1) : null;
  for (let i = 0; i < n * n; i++) {
    let k = 0.86 + 0.24 * mott[i] + 0.12 * (fine[i] - 0.5) + 0.16 * (grit[i] - 0.5);
    const sv = st[i];
    const stain = sstep(0.5, 0.72, sv) * dirty;
    const rim = Math.exp(-Math.pow((sv - 0.56) / 0.03, 2)) * dirty;
    const drip = sstep(0.55, 0.8, vs[i]) * 0.1 * dirty;
    k *= 1 - 0.16 * stain - 0.1 * rim - drip;
    let r = base[0] * k, g = base[1] * k, b = base[2] * k;
    r = lerp(r, r * 0.9 + 8, stain * 0.5); g = lerp(g, g * 0.86, stain * 0.5); b = lerp(b, b * 0.72, stain * 0.5);
    let hgt = 0.5 + (trowel[i] - 0.5) * 0.28 + (fine[i] - 0.5) * 0.2 + (grit[i] - 0.5) * 0.1;
    if (crk) { const cv = crk[i]; const kk = 1 - cv * 0.88; r *= kk; g *= kk; b *= kk; hgt -= cv * 0.55; }
    setc(o, i, r, g, b);
    o.h[i] = hgt;
    o.r[i] = clamp(0.9 + (grit[i] - 0.5) * 0.15 - stain * 0.1);
  }
}

// ---------------------------------------------------------------- rug
export interface RugPal { field: RGB; field2: RGB; dark: RGB; cream: RGB; accent: RGB; gold: RGB; }

function poly(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number, rot: number): void {
  c.beginPath();
  for (let k = 0; k < sides; k++) {
    const a = rot + (k / sides) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (k) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.closePath();
}
function star(c: CanvasRenderingContext2D, cx: number, cy: number, ro: number, ri: number, pts: number, rot: number): void {
  c.beginPath();
  for (let k = 0; k < pts * 2; k++) {
    const a = rot + (k / (pts * 2)) * Math.PI * 2;
    const r = k & 1 ? ri : ro;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (k) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.closePath();
}
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

export function genRug(o: Out, pal: RugPal, seed: number): void {
  const n = o.n;
  const cv = makeCanvas(n, n);
  const c = cv.getContext('2d')!;
  const F = (col: RGB) => { c.fillStyle = css(col); };
  F(pal.dark); c.fillRect(0, 0, n, n);
  const band = (a: number, b: number, col: RGB) => { F(col); c.fillRect(a * n, a * n, (1 - 2 * a) * n, (1 - 2 * a) * n); void b; };
  // outer bands (drawn as nested squares)
  band(0.0, 1, pal.dark);
  band(0.03, 1, pal.cream);
  band(0.042, 1, pal.dark);
  band(0.055, 1, pal.accent);         // border ground
  band(0.175, 1, pal.cream);
  band(0.187, 1, pal.dark);
  band(0.2, 1, pal.field);
  // border motifs
  const bc = 0.115 * n; // band centre offset
  const unit = n / 9;
  const motif = (x: number, y: number, r: number) => {
    F(pal.cream); poly(c, x, y, r, 4, 0); c.fill();
    F(pal.field); poly(c, x, y, r * 0.66, 4, 0); c.fill();
    F(pal.gold); poly(c, x, y, r * 0.3, 4, Math.PI / 4); c.fill();
    F(pal.dark);
    for (const sgn of [-1, 1]) { c.fillRect(x + sgn * r * 1.18 - 1.5, y - 1.5, 3, 3); c.fillRect(x - 1.5, y + sgn * r * 1.18 - 1.5, 3, 3); }
  };
  for (let k = 0; k < 9; k++) {
    const t = (k + 0.5) * unit;
    if (t > 0.2 * n && t < 0.8 * n || k === 0 || k === 8 || true) {
      motif(t, bc, 20); motif(t, n - bc, 20); motif(bc, t, 20); motif(n - bc, t, 20);
    }
  }
  // corner blocks
  for (const [x, y] of [[bc, bc], [n - bc, bc], [bc, n - bc], [n - bc, n - bc]]) {
    F(pal.dark); c.fillRect(x - 34, y - 34, 68, 68);
    F(pal.gold); star(c, x, y, 30, 14, 8, 0); c.fill();
    F(pal.field); poly(c, x, y, 8, 8, 0); c.fill();
  }
  // field: diamond lattice
  const fs = n * 0.07;
  for (let gy = -1; gy <= 15; gy++) for (let gx = -1; gx <= 15; gx++) {
    const x = 0.2 * n + gx * fs, y = 0.2 * n + gy * fs;
    if (x < 0.2 * n || y < 0.2 * n || x > 0.8 * n || y > 0.8 * n) continue;
    const alt = (gx + gy) & 1;
    F(alt ? pal.field2 : pal.field); poly(c, x, y, fs * 0.42, 4, 0); c.fill();
    F(alt ? pal.accent : pal.gold); poly(c, x, y, fs * 0.13, 4, Math.PI / 4); c.fill();
  }
  // medallion
  const mx = n / 2, my = n / 2;
  F(pal.dark); star(c, mx, my, n * 0.31, n * 0.2, 8, Math.PI / 8); c.fill();
  F(pal.accent); star(c, mx, my, n * 0.285, n * 0.185, 8, Math.PI / 8); c.fill();
  F(pal.cream); star(c, mx, my, n * 0.23, n * 0.15, 8, 0); c.fill();
  F(pal.field); poly(c, mx, my, n * 0.17, 8, Math.PI / 8); c.fill();
  F(pal.gold); star(c, mx, my, n * 0.135, n * 0.07, 8, Math.PI / 8); c.fill();
  F(pal.dark); poly(c, mx, my, n * 0.06, 4, Math.PI / 4); c.fill();
  F(pal.cream); poly(c, mx, my, n * 0.03, 4, 0); c.fill();
  // spandrels
  F(pal.dark);
  for (const [sx, sy] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
    c.beginPath(); c.moveTo(sx * n, sy * n); c.lineTo((sx + (sx < 0.5 ? 0.11 : -0.11)) * n, sy * n); c.lineTo(sx * n, (sy + (sy < 0.5 ? 0.11 : -0.11)) * n); c.closePath(); c.fill();
  }
  const d = c.getImageData(0, 0, n, n).data;
  const wear = noise(n, 4, 4, 5, seed + 1), fib = noise(n, 128, 128, 2, seed + 2), dirt = noise(n, 3, 3, 5, seed + 3), edgeN = noise(n, 40, 40, 2, seed + 4);
  const pitch = 4;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const tx = (x % pitch) / pitch, ty = (y % pitch) / pitch;
      const bead = Math.sin(Math.PI * tx) * Math.sin(Math.PI * ty);
      const chk = ((x >> 2) ^ (y >> 2)) & 1;
      let k = 0.72 + 0.34 * bead + (chk ? 0.05 : -0.03) + (fib[i] - 0.5) * 0.28;
      const w = sstep(0.56, 0.75, wear[i]);       // threadbare patches
      const dg = 0.78 + 0.35 * dirt[i];
      // edge fray/darkening
      const ed = Math.min(x, y, n - 1 - x, n - 1 - y) + (edgeN[i] - 0.5) * 10;
      const edgeK = 0.8 + 0.2 * sstep(0, 22, ed);
      let r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      r = lerp(r, 138, w * 0.35); g = lerp(g, 118, w * 0.35); b = lerp(b, 92, w * 0.35);
      k *= dg * edgeK * (1 - 0.15 * w * (1 - bead));
      // slight desaturation with age
      const l = (r + g + b) / 3;
      r = lerp(r, l, 0.12); g = lerp(g, l, 0.12); b = lerp(b, l, 0.12);
      setc(o, i, r * k, g * k, b * k);
      o.h[i] = 0.35 + 0.4 * bead * (1 - 0.4 * w) + (fib[i] - 0.5) * 0.1;
      o.r[i] = clamp(0.93 + (fib[i] - 0.5) * 0.1);
    }
  }
}

// ---------------------------------------------------------------- velvet
export function genVelvet(o: Out, dark: RGB, mid: RGB, sheen: RGB, seed: number): void {
  const n = o.n;
  const pile = noise(n, 128, 128, 2, seed + 1), crush = noise(n, 5, 3, 5, seed + 2), folds = noise(n, 2, 3, 4, seed + 3);
  const dir = noise(n, 24, 6, 3, seed + 4);
  const wear = noise(n, 4, 4, 4, seed + 5);
  const c: RGB = [0, 0, 0];
  for (let i = 0; i < n * n; i++) {
    let t = 0.42 + (crush[i] - 0.5) * 0.6 + (folds[i] - 0.5) * 0.6 + (dir[i] - 0.5) * 0.25;
    t = clamp(t);
    const stops: RGB[] = [dark, mid, sheen];
    ramp(stops, t, c);
    const fuzz = 0.85 + 0.3 * pile[i];
    const worn = sstep(0.62, 0.8, wear[i]);
    const l = (c[0] + c[1] + c[2]) / 3;
    const k = fuzz * (1 - 0.15 * worn);
    setc(o, i, lerp(c[0], l * 1.1, worn * 0.35) * k, lerp(c[1], l * 1.0, worn * 0.35) * k, lerp(c[2], l * 0.95, worn * 0.35) * k);
    o.h[i] = 0.5 + (pile[i] - 0.5) * 0.25 + (crush[i] - 0.5) * 0.3;
    o.r[i] = clamp(0.95 - 0.15 * t);
  }
}

// ---------------------------------------------------------------- leather
export function genLeather(o: Out, seed: number): void {
  const n = o.n;
  const cl = cellular(n, 56, seed, 0.9);
  const mott = noise(n, 3, 3, 5, seed + 1), scuff = noise(n, 8, 8, 5, seed + 2), fine = noise(n, 90, 90, 2, seed + 3);
  const wr = noise(n, 4, 7, 3, seed + 4);
  const st: RGB[] = [[46, 24, 14], [92, 54, 32], [134, 86, 52]];
  const c: RGB = [0, 0, 0];
  for (let i = 0; i < n * n; i++) {
    const cr = sstep(0.0, 0.32, cl.edge[i]);
    const wrinkle = Math.exp(-Math.pow((wr[i] - 0.5) / 0.03, 2));
    const t = 0.42 + (mott[i] - 0.5) * 0.7 + (hash(cl.id[i], 1, seed) - 0.5) * 0.15 + (fine[i] - 0.5) * 0.1;
    ramp(st, clamp(t + (scuff[i] > 0.66 ? (scuff[i] - 0.66) * 1.5 : 0)), c);
    const k = (0.6 + 0.4 * cr) * (1 - 0.18 * wrinkle);
    setc(o, i, c[0] * k, c[1] * k, c[2] * k);
    o.h[i] = 0.25 + 0.55 * cr * (0.85 + 0.15 * cl.f1[i]) - 0.2 * wrinkle;
    o.r[i] = clamp(0.5 + 0.22 * (1 - cr) + 0.3 * (mott[i] - 0.5) - (scuff[i] > 0.66 ? 0.15 : 0));
  }
}

// ---------------------------------------------------------------- marble
export function genMarble(o: Out, base: RGB, vein: RGB, seed: number): void {
  const n = o.n;
  const F = noise(n, 3, 3, 5, seed + 1), W1 = noise(n, 2, 2, 3, seed + 2), W2 = noise(n, 2, 2, 3, seed + 3);
  const F2 = noise(n, 6, 6, 4, seed + 4), mott = noise(n, 5, 5, 5, seed + 5), fine = noise(n, 64, 64, 2, seed + 6);
  const c: RGB = [0, 0, 0];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    const wx = x + (W1[i] - 0.5) * 150, wy = y + (W2[i] - 0.5) * 150;
    const f = samp(F, n, wx, wy);
    const f2 = samp(F2, n, wx * 1.0 + 40, wy * 1.0);
    const v1 = Math.exp(-Math.pow((f - 0.5) / 0.009, 2)) * 0.9;
    const v1b = Math.exp(-Math.pow((f - 0.5) / 0.05, 2)) * 0.1;
    const v2 = Math.exp(-Math.pow((f2 - 0.5) / 0.008, 2)) * 0.5;
    const veins = clamp(v1 + v2 * 0.8 + v1b);
    const m = 0.88 + 0.22 * mott[i] + (fine[i] - 0.5) * 0.06;
    const tint = (mott[i] - 0.5) * 10;
    let r = base[0] * m + tint, g = base[1] * m + tint * 0.8, b = base[2] * m + tint * 0.4;
    const vk = clamp(veins);
    r = lerp(r, vein[0], vk * 0.75); g = lerp(g, vein[1], vk * 0.75); b = lerp(b, vein[2], vk * 0.75);
    void c;
    setc(o, i, r, g, b);
    o.h[i] = 0.5 + (fine[i] - 0.5) * 0.04 - vk * 0.03;
    o.r[i] = clamp(0.22 + 0.25 * (mott[i] - 0.4) + vk * 0.15 + (fine[i] - 0.5) * 0.1);
  }
}
