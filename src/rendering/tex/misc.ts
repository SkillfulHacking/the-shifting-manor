import { RGB, clamp, sstep, lerp, mulberry, hash, noise, ramp, cellular, crackMask, blur, samp } from './core';
import { Out, setc } from './out';

// ---------------------------------------------------------------- metals
export function genBrushedMetal(o: Out, bright: RGB, dark: RGB, tarnish: RGB, seed: number, tarnishAmt: number, baseRough: number, greenPatina = 0): void {
  const n = o.n;
  const brushed = noise(n, 1, 170, 2, seed + 1), brushed2 = noise(n, 2, 90, 2, seed + 2);
  const tn = noise(n, 6, 6, 4, seed + 3), tn2 = noise(n, 16, 16, 3, seed + 4);
  const crk = crackMask(n, 10, seed + 5, 70, 0.7, 0);
  const c: RGB = [0, 0, 0];
  for (let i = 0; i < n * n; i++) {
    const br = brushed[i] * 0.6 + brushed2[i] * 0.4;
    const tv = clamp((tn[i] - 0.5) * 1.6 + (tn2[i] - 0.5) * 1.0 + (br - 0.5) * 0.3 + 0.5 - 0.22 * (1 - tarnishAmt) * 2);
    const t = sstep(0.55, 0.9, tv) * 0.75 + sstep(0.35, 0.7, tn2[i]) * 0.15 * tarnishAmt;
    ramp([dark, bright, [bright[0] * 1.12, bright[1] * 1.12, bright[2] * 1.1]], 0.3 + 0.55 * br + 0.2 * (tn2[i] - 0.5), c);
    let r = lerp(c[0], tarnish[0], t * 0.85), g = lerp(c[1], tarnish[1], t * 0.85), b = lerp(c[2], tarnish[2], t * 0.85);
    let pat = 0;
    if (greenPatina) {
      pat = sstep(0.6, 0.72, tn[i] * 0.7 + tn2[i] * 0.4 - 0.2) * greenPatina;
      r = lerp(r, 66, pat); g = lerp(g, 132, pat); b = lerp(b, 112, pat);
    }
    const sc = crk[i] * 0.25;
    r += sc * 60; g += sc * 55; b += sc * 40;
    setc(o, i, r, g, b);
    o.h[i] = 0.5 + (br - 0.5) * 0.15 + pat * 0.1;
    o.r[i] = clamp(baseRough + 0.28 * t + 0.2 * (br - 0.5) + pat * 0.35);
    if (o.m) o.m[i] = clamp(1 - 0.9 * pat - 0.25 * t);
  }
}

export function genIron(o: Out, seed: number): void {
  const n = o.n;
  const cl = cellular(n, 20, seed, 1);
  const tn = noise(n, 6, 6, 5, seed + 1), fine = noise(n, 128, 128, 2, seed + 2), tn2 = noise(n, 3, 3, 4, seed + 3);
  const c: RGB = [0, 0, 0];
  for (let i = 0; i < n * n; i++) {
    const dimple = 1 - sstep(0, 0.75, cl.f1[i]);
    const rustV = sstep(0.6, 0.85, tn[i] + (fine[i] - 0.5) * 0.15);
    ramp([[34, 32, 32], [62, 60, 58], [98, 94, 90]], 0.3 + 0.4 * (tn2[i] - 0.3) + 0.35 * dimple * (hash(cl.id[i], 2, seed) + 0.3) + (fine[i] - 0.5) * 0.25, c);
    const rr = rustV * 0.85;
    setc(o, i, lerp(c[0], 118 + 30 * fine[i], rr), lerp(c[1], 62 + 18 * fine[i], rr), lerp(c[2], 30, rr));
    o.h[i] = 0.3 + dimple * 0.4 + rustV * (fine[i] - 0.5) * 0.3;
    o.r[i] = clamp(0.5 + 0.25 * (fine[i] - 0.5) + rr * 0.4 + 0.15 * (1 - dimple));
    if (o.m) o.m[i] = clamp(1 - rr * 0.7);
  }
}

// ---------------------------------------------------------------- dirt
export function genDirt(o: Out, seed: number): void {
  const n = o.n;
  const big = noise(n, 3, 3, 6, seed + 1), fine = noise(n, 80, 80, 3, seed + 2), mid = noise(n, 14, 14, 3, seed + 3);
  const cl = cellular(n, 34, seed + 4, 1);
  const c: RGB = [0, 0, 0];
  const pal: RGB[] = [[40, 30, 22], [82, 64, 46], [122, 98, 70]];
  for (let i = 0; i < n * n; i++) {
    const isP = hash(cl.id[i], 4, seed) > 0.8;
    const pd = isP ? 1 - sstep(0.18, 0.5, cl.f1[i]) : 0;
    const t = 0.15 + (big[i] - 0.5) * 0.7 + (mid[i] - 0.5) * 0.5 + (fine[i] - 0.5) * 0.4;
    ramp(pal, clamp(t + 0.3), c);
    const pt = hash(cl.id[i], 8, seed);
    const pr = 52 + pt * 38;
    setc(o, i, lerp(c[0], pr, pd * 0.8) * (1 - 0.3 * (1 - pd) * (fine[i] > 0.7 ? 1 : 0)), lerp(c[1], pr * 0.95, pd * 0.8), lerp(c[2], pr * 0.85, pd * 0.8));
    o.h[i] = 0.35 + (mid[i] - 0.5) * 0.4 + (fine[i] - 0.5) * 0.35 + pd * 0.35;
    o.r[i] = clamp(0.95 - pd * 0.15);
  }
}

// ---------------------------------------------------------------- pumpkin
export function genPumpkin(o: Out, seed: number): void {
  const n = o.n, RIBS = 8;
  const blotch = noise(n, 4, 4, 5, seed + 1), streak = noise(n, 64, 3, 3, seed + 2), warp = noise(n, 3, 3, 3, seed + 3), fine = noise(n, 90, 90, 2, seed + 4);
  const cl = cellular(n, 30, seed + 5, 1);
  const c: RGB = [0, 0, 0];
  const pal: RGB[] = [[120, 46, 8], [200, 96, 22], [232, 138, 46]];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    const u = x / n + (warp[i] - 0.5) * 0.02;
    const ph = (((u * RIBS) % 1) + 1) % 1;
    const prof = Math.sin(Math.PI * ph);            // 0 groove -> 1 crest
    const crest = Math.pow(prof, 0.7);
    const wart = hash(cl.id[i], 5, seed) > 0.9 ? 1 - sstep(0.05, 0.3, cl.f1[i]) : 0;
    const t = 0.3 + 0.6 * crest + (blotch[i] - 0.5) * 0.4 + (streak[i] - 0.5) * 0.12;
    ramp(pal, clamp(t), c);
    const groove = 1 - sstep(0.0, 0.25, prof);
    let r = c[0], g = c[1], b = c[2];
    r = lerp(r, 96, groove * 0.4); g = lerp(g, 60, groove * 0.5); b = lerp(b, 14, groove * 0.4);
    const gr = sstep(0.62, 0.8, blotch[i]) * groove;   // greenish blush in grooves
    r = lerp(r, 96, gr * 0.5); g = lerp(g, 110, gr * 0.5); b = lerp(b, 30, gr * 0.5);
    r = lerp(r, 170, wart * 0.5); g = lerp(g, 120, wart * 0.5); b = lerp(b, 60, wart * 0.5);
    setc(o, i, r, g, b);
    o.h[i] = 0.2 + crest * 0.6 + (streak[i] - 0.5) * 0.05 + wart * 0.08 + (fine[i] - 0.5) * 0.02;
    o.r[i] = clamp(0.42 + 0.25 * (blotch[i] - 0.5) + groove * 0.2);
  }
}

// ---------------------------------------------------------------- glass
export function genGlass(o: Out, seed: number): void {
  const n = o.n;
  const sw = noise(n, 3, 3, 4, seed + 1), fine = noise(n, 60, 60, 2, seed + 2), tn = noise(n, 5, 5, 5, seed + 3);
  const scr = crackMask(n, 9, seed + 4, 130, 0.7, 0);
  const smudge = noise(n, 6, 6, 4, seed + 5);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    const wob = samp(sw, n, x + (fine[i] - 0.5) * 20, y);
    const k = 0.75 + 0.5 * wob;
    const sc = scr[i];
    const sm = sstep(0.55, 0.8, smudge[i]);
    setc(o, i, 26 * k + sc * 90 + sm * 22, 40 * k + sc * 95 + sm * 26, 44 * k + sc * 90 + sm * 26);
    o.h[i] = 0.5 + (wob - 0.5) * 0.15 - sc * 0.1;
    o.r[i] = clamp(0.06 + 0.12 * tn[i] + sm * 0.4 + sc * 0.3);
  }
}

// ---------------------------------------------------------------- paper
export function genPaper(o: Out, seed: number): void {
  const n = o.n;
  const fib = noise(n, 160, 160, 2, seed + 1), fib2 = noise(n, 8, 90, 2, seed + 2), tn = noise(n, 3, 3, 5, seed + 3), st = noise(n, 3, 3, 5, seed + 4);
  const rand = mulberry(seed);
  const fox = new Float32Array(n * n);
  for (let k = 0; k < 60; k++) {
    const fx = rand() * n, fy = rand() * n, fr = 2 + rand() * 6, fa = 0.25 + rand() * 0.6;
    const R = Math.ceil(fr * 1.8);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const dd = Math.hypot(dx, dy) / fr;
      if (dd < 1.8) { const ix = (Math.floor(fx) + dx + n) % n, iy = (Math.floor(fy) + dy + n) % n; fox[iy * n + ix] = Math.max(fox[iy * n + ix], fa * (1 - sstep(0.2, 1.8, dd))); }
    }
  }
  blur(fox, n, 1);
  const creaseX = Math.floor(n * (0.3 + rand() * 0.4)), creaseY = Math.floor(n * (0.3 + rand() * 0.4));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    const cr = Math.max(Math.exp(-Math.abs(x - creaseX) / 1.6) * 0.9, Math.exp(-Math.abs(y - creaseY) / 1.6) * 0.9);
    const sv = st[i];
    const stain = sstep(0.5, 0.72, sv);
    const rim = Math.exp(-Math.pow((sv - 0.56) / 0.03, 2));
    let k = 0.86 + 0.22 * tn[i] + (fib[i] - 0.5) * 0.12 + (fib2[i] - 0.5) * 0.1;
    k *= 1 - 0.12 * stain - 0.12 * rim - 0.12 * cr;
    let r = 214 * k, g = 196 * k, b = 156 * k;
    r = lerp(r, 120, fox[i] * 0.55); g = lerp(g, 82, fox[i] * 0.55); b = lerp(b, 44, fox[i] * 0.55);
    r = lerp(r, 176, stain * 0.25); g = lerp(g, 138, stain * 0.25); b = lerp(b, 84, stain * 0.25);
    setc(o, i, r, g, b);
    o.h[i] = 0.5 + (fib[i] - 0.5) * 0.2 + (fib2[i] - 0.5) * 0.1 - cr * 0.3;
    o.r[i] = clamp(0.9 + (fib[i] - 0.5) * 0.15);
  }
}

// ---------------------------------------------------------------- wax
export function genWax(o: Out, seed: number): void {
  const n = o.n;
  const drips = noise(n, 9, 1, 3, seed + 1), lo = noise(n, 3, 3, 4, seed + 2), fine = noise(n, 90, 90, 2, seed + 3);
  const ring = noise(n, 1, 6, 2, seed + 4);
  for (let i = 0; i < n * n; i++) {
    const dv = sstep(0.45, 0.75, drips[i]);
    const k = 0.9 + 0.16 * lo[i] + 0.06 * dv + (fine[i] - 0.5) * 0.04 + (ring[i] - 0.5) * 0.06;
    setc(o, i, 226 * k, 208 * k, 164 * k * (0.95 + 0.05 * lo[i]));
    o.h[i] = 0.5 + dv * 0.25 + (lo[i] - 0.5) * 0.1 + (fine[i] - 0.5) * 0.03;
    o.r[i] = clamp(0.4 + 0.15 * (lo[i] - 0.5) + 0.1 * fine[i]);
  }
}

// ---------------------------------------------------------------- bone
export function genBone(o: Out, seed: number): void {
  const n = o.n;
  const cl = cellular(n, 60, seed, 1);
  const grain = noise(n, 3, 24, 4, seed + 1), tn = noise(n, 4, 4, 5, seed + 2), fine = noise(n, 110, 110, 2, seed + 3);
  const crk = crackMask(n, 9, seed + 4, 140, 1, 1);
  const c: RGB = [0, 0, 0];
  for (let i = 0; i < n * n; i++) {
    const pore = hash(cl.id[i], 6, seed) > 0.8 ? 1 - sstep(0.05, 0.22, cl.f1[i]) : 0;
    const t = 0.55 + (tn[i] - 0.5) * 0.9 + (grain[i] - 0.5) * 0.3;
    ramp([[128, 108, 76], [190, 174, 138], [224, 212, 180]], clamp(t), c);
    const k = (1 - pore * 0.5) * (1 - crk[i] * 0.55) * (0.95 + 0.1 * fine[i]);
    setc(o, i, c[0] * k, c[1] * k, c[2] * k);
    o.h[i] = 0.55 + (grain[i] - 0.5) * 0.1 - pore * 0.3 - crk[i] * 0.3;
    o.r[i] = clamp(0.62 + 0.2 * (tn[i] - 0.5) + pore * 0.2);
  }
}

// ---------------------------------------------------------------- moss
export function genMoss(o: Out, seed: number): void {
  const n = o.n;
  const cl = cellular(n, 52, seed, 1);
  const cl2 = cellular(n, 20, seed + 9, 1);
  const tn = noise(n, 4, 4, 5, seed + 1), fine = noise(n, 120, 120, 2, seed + 2), mid = noise(n, 24, 24, 3, seed + 3);
  const c: RGB = [0, 0, 0];
  for (let i = 0; i < n * n; i++) {
    const tuft = 1 - sstep(0, 0.9, cl.f1[i]);
    const clump = 1 - sstep(0, 1.0, cl2.f1[i]);
    const hgt = clamp(0.35 * tuft + 0.5 * clump + 0.25 * (mid[i] - 0.5) + 0.15);
    const t = clamp(hgt * 1.1 + (tn[i] - 0.5) * 0.5 + (fine[i] - 0.5) * 0.25);
    ramp([[20, 30, 15], [48, 68, 30], [88, 108, 46], [122, 138, 72]], t, c);
    const dry = sstep(0.72, 0.88, tn[i] + (fine[i] - 0.5) * 0.2);
    setc(o, i, lerp(c[0], 128, dry * 0.5), lerp(c[1], 106, dry * 0.5), lerp(c[2], 54, dry * 0.5));
    o.h[i] = hgt;
    o.r[i] = clamp(0.95 - 0.1 * tuft);
  }
}
