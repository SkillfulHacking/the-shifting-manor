// Shared procedural-texture toolkit: seeded RNG, periodic noise, cellular noise, blur, normal maps.
export type RGB = [number, number, number];

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function mulberry(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(a: number, b = 0, c = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Piecewise-linear colour ramp over evenly spaced stops; writes into out. */
export function ramp(stops: RGB[], t: number, out: RGB): RGB {
  t = clamp(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  const f = t - i;
  const a = stops[i], b = stops[i + 1];
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  out[2] = a[2] + (b[2] - a[2]) * f;
  return out;
}

/** Periodic multi-octave value noise in [0,1]; cx,cy = lattice cells across the tile at octave 0. */
export function noise(n: number, cx: number, cy: number, oct: number, seed: number, gain = 0.5): Float32Array {
  const out = new Float32Array(n * n);
  const rand = mulberry(seed * 7919 + 13);
  let amp = 1, tot = 0;
  const ix0 = new Int32Array(n), ix1 = new Int32Array(n), sx = new Float32Array(n);
  for (let o = 0; o < oct; o++) {
    const gx = cx << o, gy = cy << o;
    const grid = new Float32Array(gx * gy);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    for (let x = 0; x < n; x++) {
      const f = (x * gx) / n;
      const i0 = Math.floor(f);
      const t = f - i0;
      ix0[x] = i0 % gx;
      ix1[x] = (i0 + 1) % gx;
      sx[x] = t * t * (3 - 2 * t);
    }
    for (let y = 0; y < n; y++) {
      const f = (y * gy) / n;
      const j0 = Math.floor(f);
      const t = f - j0;
      const sy = t * t * (3 - 2 * t);
      const r0 = (j0 % gy) * gx, r1 = ((j0 + 1) % gy) * gx;
      const row = y * n;
      for (let x = 0; x < n; x++) {
        const a = grid[r0 + ix0[x]], b = grid[r0 + ix1[x]], c = grid[r1 + ix0[x]], d = grid[r1 + ix1[x]];
        const s = sx[x];
        const top = a + (b - a) * s;
        out[row + x] += (top + (c + (d - c) * s - top) * sy) * amp;
      }
    }
    tot += amp;
    amp *= gain;
  }
  const inv = 1 / tot;
  for (let i = 0; i < out.length; i++) out[i] *= inv;
  return out;
}

/** Push contrast about 0.5 in place (returns same array). */
export function contrast(a: Float32Array, k: number): Float32Array {
  for (let i = 0; i < a.length; i++) a[i] = clamp((a[i] - 0.5) * k + 0.5);
  return a;
}

/** Bilinear wrapped sample of an n*n field. */
export function samp(a: Float32Array, n: number, x: number, y: number): number {
  x = ((x % n) + n) % n;
  y = ((y % n) + n) % n;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
  const a0 = a[y0 * n + x0], a1 = a[y0 * n + x1], b0 = a[y1 * n + x0], b1 = a[y1 * n + x1];
  const t = a0 + (a1 - a0) * fx;
  return t + (b0 + (b1 - b0) * fx - t) * fy;
}

export interface Cells { f1: Float32Array; edge: Float32Array; id: Int32Array; }
/** Periodic Worley noise. f1 = distance to nearest point (cell units), edge = f2-f1, id = nearest cell index. */
export function cellular(n: number, cells: number, seed: number, jitter = 1): Cells {
  const rand = mulberry(seed * 31 + 5);
  const px = new Float32Array(cells * cells), py = new Float32Array(cells * cells);
  for (let i = 0; i < px.length; i++) {
    px[i] = 0.5 + (rand() - 0.5) * jitter;
    py[i] = 0.5 + (rand() - 0.5) * jitter;
  }
  const f1 = new Float32Array(n * n), edge = new Float32Array(n * n), id = new Int32Array(n * n);
  const k = cells / n;
  for (let y = 0; y < n; y++) {
    const fy = y * k, cy = Math.floor(fy);
    for (let x = 0; x < n; x++) {
      const fx = x * k, cx = Math.floor(fx);
      let d1 = 9, d2 = 9, best = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = cy + dy, wy = ((yy % cells) + cells) % cells;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = cx + dx, wx = ((xx % cells) + cells) % cells;
          const idx = wy * cells + wx;
          const ex = xx + px[idx] - fx, ey = yy + py[idx] - fy;
          const d = ex * ex + ey * ey;
          if (d < d1) { d2 = d1; d1 = d; best = idx; } else if (d < d2) d2 = d;
        }
      }
      const i = y * n + x;
      d1 = Math.sqrt(d1);
      f1[i] = d1;
      edge[i] = Math.sqrt(d2) - d1;
      id[i] = best;
    }
  }
  return { f1, edge, id };
}

/** Separable wrapped box blur (in place). */
export function blur(a: Float32Array, n: number, r: number): Float32Array {
  if (r < 1) return a;
  const tmp = new Float32Array(n);
  const w = 2 * r + 1;
  for (let y = 0; y < n; y++) {
    const row = y * n;
    let s = 0;
    for (let k = -r; k <= r; k++) s += a[row + ((k + n) % n)];
    for (let x = 0; x < n; x++) {
      tmp[x] = s / w;
      s += a[row + ((x + r + 1) % n)] - a[row + ((x - r + n) % n)];
    }
    for (let x = 0; x < n; x++) a[row + x] = tmp[x];
  }
  for (let x = 0; x < n; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += a[((k + n) % n) * n + x];
    for (let y = 0; y < n; y++) {
      tmp[y] = s / w;
      s += a[((y + r + 1) % n) * n + x] - a[((y - r + n) % n) * n + x];
    }
    for (let y = 0; y < n; y++) a[y * n + x] = tmp[y];
  }
  return a;
}

/** Tileable network of crack lines as a 0..1 mask. */
export function crackMask(n: number, count: number, seed: number, maxLen = 200, width = 1.6, blurR = 1): Float32Array {
  const rand = mulberry(seed * 17 + 3);
  type Line = { pts: number[]; w: number };
  const lines: Line[] = [];
  const walk = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
    const pts = [x, y];
    let d = 0;
    while (d < len) {
      ang += (rand() - 0.5) * 0.4;
      const s = 3 + rand() * 6;
      x += Math.cos(ang) * s;
      y += Math.sin(ang) * s;
      d += s;
      pts.push(x, y);
      if (depth < 2 && rand() < 0.06) walk(x, y, ang + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.7), len * 0.45 - d * 0.2, w * 0.6, depth + 1);
    }
    lines.push({ pts, w });
  };
  for (let i = 0; i < count; i++) walk(rand() * n, rand() * n, rand() * Math.PI * 2, maxLen * (0.4 + rand() * 0.6), width, 0);
  const cv = makeCanvas(n, n);
  const c = cv.getContext('2d')!;
  c.strokeStyle = '#fff';
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const alphas = lines.map(() => 0.35 + rand() * 0.5);
  for (const oy of [-n, 0, n]) for (const ox of [-n, 0, n]) {
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      c.globalAlpha = alphas[li];
      c.lineWidth = l.w;
      c.beginPath();
      c.moveTo(l.pts[0] + ox, l.pts[1] + oy);
      for (let i = 2; i < l.pts.length; i += 2) c.lineTo(l.pts[i] + ox, l.pts[i + 1] + oy);
      c.stroke();
    }
  }
  const d = c.getImageData(0, 0, n, n).data;
  const out = new Float32Array(n * n);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return blurR > 0 ? blur(out, n, blurR) : out;
}

/** Tangent-space normal map from a height field via wrapped Sobel. */
export function normalCanvas(h: Float32Array, n: number, strength: number): HTMLCanvasElement {
  const cv = makeCanvas(n, n);
  const c = cv.getContext('2d')!;
  const img = c.createImageData(n, n);
  const d = img.data;
  const xm = new Int32Array(n), xp = new Int32Array(n);
  for (let i = 0; i < n; i++) { xm[i] = (i - 1 + n) % n; xp[i] = (i + 1) % n; }
  const s = strength * 0.25;
  for (let y = 0; y < n; y++) {
    const rm = xm[y] * n, r0 = y * n, rp = xp[y] * n;
    for (let x = 0; x < n; x++) {
      const l = xm[x], r = xp[x];
      const dx = h[rm + r] + 2 * h[r0 + r] + h[rp + r] - h[rm + l] - 2 * h[r0 + l] - h[rp + l];
      const dy = h[rp + l] + 2 * h[rp + x] + h[rp + r] - h[rm + l] - 2 * h[rm + x] - h[rm + r];
      let nx = -dx * s * 8, ny = dy * s * 8;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      nx *= inv; ny *= inv;
      const j = (r0 + x) * 4;
      d[j] = (nx * 0.5 + 0.5) * 255;
      d[j + 1] = (ny * 0.5 + 0.5) * 255;
      d[j + 2] = (inv * 0.5 + 0.5) * 255;
      d[j + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

export function grayCanvas(a: Float32Array, n: number, channel: 'all' | 'b' = 'all'): HTMLCanvasElement {
  const cv = makeCanvas(n, n);
  const c = cv.getContext('2d')!;
  const img = c.createImageData(n, n);
  const d = img.data;
  for (let i = 0; i < a.length; i++) {
    const v = clamp(a[i]) * 255;
    const j = i * 4;
    d[j] = channel === 'all' ? v : 255;
    d[j + 1] = channel === 'all' ? v : 255;
    d[j + 2] = v;
    d[j + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return cv;
}
