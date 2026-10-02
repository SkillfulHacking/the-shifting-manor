import { makeCanvas, mulberry } from './core';

type Ctx = CanvasRenderingContext2D;
type R = () => number;

const rgba = (r: number, g: number, b: number, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const pick = <T,>(rand: R, arr: T[]): T => arr[Math.floor(rand() * arr.length)];

function vgrad(c: Ctx, w: number, h: number, stops: [number, string][]): void {
  const g = c.createLinearGradient(0, 0, 0, h);
  for (const [t, col] of stops) g.addColorStop(t, col);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

function glow(c: Ctx, x: number, y: number, r: number, col: [number, number, number], a: number, mode: GlobalCompositeOperation = 'source-over'): void {
  c.save();
  c.globalCompositeOperation = mode;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col[0], col[1], col[2], a));
  g.addColorStop(1, rgba(col[0], col[1], col[2], 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

/** Soft dark/light smudges to give the ground a painted, uneven feel. */
function smudges(c: Ctx, w: number, h: number, rand: R, count: number, dark: boolean): void {
  for (let i = 0; i < count; i++) {
    const v = dark ? 0 : 255;
    glow(c, rand() * w, rand() * h, 40 + rand() * 160, [v, v * 0.8, v * 0.6], dark ? 0.12 + rand() * 0.14 : 0.03 + rand() * 0.05);
  }
}

function blurCanvas(c: Ctx, w: number, h: number, px: number): void {
  if (!('filter' in c)) return;
  const t = makeCanvas(w, h);
  t.getContext('2d')!.drawImage(c.canvas, 0, 0);
  c.save();
  c.filter = `blur(${px}px)`;
  c.drawImage(t, 0, 0);
  c.restore();
}

// ---------------------------------------------------------------- portraits
interface PortraitP {
  bg: [string, string]; cloth: [number, number, number]; collar: [number, number, number]; skin: [number, number, number];
  hair: [number, number, number]; woman: boolean; drape?: [number, number, number]; light: number; wig?: boolean; bonnet?: boolean;
}

function portrait(c: Ctx, w: number, h: number, rand: R, p: PortraitP): void {
  vgrad(c, w, h, [[0, p.bg[0]], [1, p.bg[1]]]);
  smudges(c, w, h, rand, 30, true);
  glow(c, w * (0.5 - 0.2 * p.light), h * 0.3, w * 0.7, [190, 150, 90], 0.16);
  if (p.drape) {
    const [r, g, b] = p.drape;
    const side = p.light > 0 ? w : 0;
    const dw = w * 0.34;
    const x0 = side ? w - dw : 0;
    for (let i = 0; i < 9; i++) {
      const gx = x0 + (i / 9) * dw;
      const g2 = c.createLinearGradient(gx, 0, gx + dw / 9, 0);
      const k = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + 0.5));
      g2.addColorStop(0, rgba(r * k, g * k, b * k));
      g2.addColorStop(1, rgba(r * k * 0.5, g * k * 0.5, b * k * 0.5));
      c.fillStyle = g2;
      c.fillRect(gx, 0, dw / 9 + 1, h);
    }
    const sh = c.createLinearGradient(x0, 0, x0 + dw, 0);
    sh.addColorStop(side ? 0 : 1, 'rgba(0,0,0,0.5)'); sh.addColorStop(side ? 1 : 0, 'rgba(0,0,0,0.0)');
    c.fillStyle = sh; c.fillRect(x0, 0, dw, h);
    // swag
    c.fillStyle = rgba(r * 0.7, g * 0.7, b * 0.7);
    c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + dw, 0); c.quadraticCurveTo(x0 + dw * (side ? 0.2 : 0.8), h * 0.18, x0 + (side ? 0 : dw), h * 0.24); c.lineTo(x0 + (side ? dw : 0), 0); c.fill();
  }
  const cx = w * (0.5 + (rand() - 0.5) * 0.06), hy = h * 0.36;
  const hrx = w * 0.125, hry = w * 0.16;
  const L = p.light;
  const sk = p.skin;
  // hair behind head (woman / wig)
  if (p.woman || p.wig) {
    const hc = p.hair;
    c.fillStyle = rgba(hc[0], hc[1], hc[2]);
    c.beginPath(); c.ellipse(cx, hy - hry * 0.1, hrx * 1.45, hry * 1.25, 0, 0, Math.PI * 2); c.fill();
    if (p.wig) { for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(cx + s * hrx * 1.25, hy + hry * (0.4 + k * 0.5), hrx * 0.55, hry * 0.32, 0, 0, 7); c.fill(); } }
    else { c.beginPath(); c.moveTo(cx - hrx * 1.4, hy); c.quadraticCurveTo(cx - hrx * 1.9, hy + hry * 2.4, cx - hrx * 1.0, hy + hry * 2.4); c.lineTo(cx - hrx * 0.8, hy); c.fill(); c.beginPath(); c.moveTo(cx + hrx * 1.4, hy); c.quadraticCurveTo(cx + hrx * 1.9, hy + hry * 2.4, cx + hrx * 1.0, hy + hry * 2.4); c.lineTo(cx + hrx * 0.8, hy); c.fill(); }
  }
  // body
  const cl = p.cloth;
  const bodyG = c.createLinearGradient(cx - w * 0.4 * L, h * 0.6, cx + w * 0.4 * L, h);
  bodyG.addColorStop(0, rgba(cl[0] * 1.5, cl[1] * 1.5, cl[2] * 1.5));
  bodyG.addColorStop(1, rgba(cl[0] * 0.4, cl[1] * 0.4, cl[2] * 0.4));
  c.fillStyle = bodyG;
  c.beginPath();
  c.moveTo(w * 0.0, h);
  c.bezierCurveTo(w * 0.02, h * 0.7, w * 0.16, h * 0.58, cx - w * 0.12, h * 0.535);
  c.lineTo(cx + w * 0.12, h * 0.535);
  c.bezierCurveTo(w * 0.84, h * 0.58, w * 0.98, h * 0.7, w * 1.0, h);
  c.closePath(); c.fill();
  // fold shading
  for (let i = 0; i < 4; i++) {
    const fx = w * (0.15 + rand() * 0.7);
    const g = c.createLinearGradient(fx - 20, 0, fx + 20, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${0.08 + rand() * 0.1})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(fx - 20, h * 0.6, 40, h * 0.4);
  }
  if (p.woman) {
    // low neckline showing skin + jewellery
    c.fillStyle = rgba(sk[0] * 0.7, sk[1] * 0.65, sk[2] * 0.6);
    c.beginPath(); c.moveTo(cx - w * 0.15, h * 0.575); c.quadraticCurveTo(cx, h * 0.72, cx + w * 0.15, h * 0.575); c.lineTo(cx + w * 0.07, h * 0.51); c.lineTo(cx - w * 0.07, h * 0.51); c.fill();
    glow(c, cx, h * 0.625, w * 0.05, [230, 200, 130], 0.7);
  } else {
    // waistcoat V and cravat
    c.fillStyle = rgba(p.collar[0], p.collar[1], p.collar[2]);
    c.beginPath(); c.moveTo(cx - w * 0.1, h * 0.55); c.quadraticCurveTo(cx, h * 0.66, cx + w * 0.1, h * 0.55); c.lineTo(cx + w * 0.05, h * 0.5); c.lineTo(cx - w * 0.05, h * 0.5); c.fill();
    c.fillStyle = rgba(cl[0] * 0.3, cl[1] * 0.3, cl[2] * 0.3);
    c.beginPath(); c.moveTo(cx - w * 0.035, h * 0.62); c.lineTo(cx, h * 0.99); c.lineTo(cx + w * 0.035, h * 0.62); c.fill();
    c.fillStyle = 'rgba(200,170,90,0.85)';
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(cx + (k & 1 ? 8 : -8) * 0, h * (0.7 + k * 0.07), 3, 0, 7); c.fill(); }
  }
  // neck
  c.fillStyle = rgba(sk[0] * 0.55, sk[1] * 0.5, sk[2] * 0.46);
  c.beginPath(); c.moveTo(cx - w * 0.07, hy + hry * 0.6); c.lineTo(cx - w * 0.1, h * 0.56); c.lineTo(cx + w * 0.1, h * 0.56); c.lineTo(cx + w * 0.07, hy + hry * 0.6); c.fill();
  if (!p.woman) {
    // ruffled collar / cravat
    c.fillStyle = rgba(p.collar[0], p.collar[1], p.collar[2]);
    for (let k = 0; k < 7; k++) { c.beginPath(); c.ellipse(cx + (k - 3) * w * 0.026, h * 0.53 + Math.abs(k - 3) * 3, w * 0.026, w * 0.034, 0, 0, 7); c.fill(); }
    glow(c, cx, h * 0.54, w * 0.1, [255, 240, 210], 0.25);
  }
  // head
  const hg = c.createRadialGradient(cx - L * hrx * 0.5, hy - hry * 0.3, hrx * 0.1, cx, hy, hry * 1.15);
  hg.addColorStop(0, rgba(sk[0] * 1.12, sk[1] * 1.1, sk[2] * 1.05));
  hg.addColorStop(0.55, rgba(sk[0] * 0.85, sk[1] * 0.78, sk[2] * 0.72));
  hg.addColorStop(1, rgba(sk[0] * 0.38, sk[1] * 0.32, sk[2] * 0.3));
  c.fillStyle = hg;
  c.beginPath(); c.moveTo(cx, hy - hry);
  c.bezierCurveTo(cx + hrx * 1.35, hy - hry * 1.02, cx + hrx * 1.1, hy + hry * 0.5, cx, hy + hry * 1.08);
  c.bezierCurveTo(cx - hrx * 1.1, hy + hry * 0.5, cx - hrx * 1.35, hy - hry * 1.02, cx, hy - hry);
  c.fill();
  glow(c, cx, hy + hry * 1.15, hrx * 1.1, [0, 0, 0], 0.4);
  // features
  const ey = hy - hry * 0.08, ex = hrx * 0.42;
  for (const s of [-1, 1]) {
    const dark = s * L > 0 ? 0.85 : 1;
    c.fillStyle = rgba(30, 18, 14, 0.45 * dark);
    c.beginPath(); c.ellipse(cx + s * ex, ey, hrx * 0.28, hry * 0.09, 0, 0, 7); c.fill();
    c.fillStyle = rgba(20, 12, 10, 0.95);
    c.beginPath(); c.ellipse(cx + s * ex, ey, hrx * 0.11, hry * 0.05, 0, 0, 7); c.fill();
    c.fillStyle = rgba(255, 255, 240, 0.6);
    c.fillRect(cx + s * ex - 1, ey - 1, 2, 1.6);
    c.strokeStyle = rgba(p.hair[0] * 0.8, p.hair[1] * 0.8, p.hair[2] * 0.8, 0.8);
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx + s * (ex - hrx * 0.3), ey - hry * 0.15); c.quadraticCurveTo(cx + s * ex, ey - hry * 0.24, cx + s * (ex + hrx * 0.3), ey - hry * 0.12); c.stroke();
  }
  // nose
  const ng = c.createLinearGradient(cx - 6, 0, cx + 10, 0);
  ng.addColorStop(0, 'rgba(0,0,0,0)'); ng.addColorStop(0.7, 'rgba(50,25,15,0.4)'); ng.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = ng; c.fillRect(cx - 6 + L * -1, ey + 2, 16, hry * 0.5);
  c.fillStyle = 'rgba(40,20,14,0.5)';
  c.beginPath(); c.ellipse(cx, hy + hry * 0.36, hrx * 0.22, hry * 0.05, 0, 0, 7); c.fill();
  // mouth
  c.strokeStyle = p.woman ? 'rgba(120,40,40,0.9)' : 'rgba(80,30,26,0.85)';
  c.lineWidth = p.woman ? 3.4 : 2.4;
  c.beginPath(); c.moveTo(cx - hrx * 0.3, hy + hry * 0.6); c.quadraticCurveTo(cx, hy + hry * 0.64 + (rand() - 0.5) * 3, cx + hrx * 0.3, hy + hry * 0.6); c.stroke();
  glow(c, cx - hrx * 0.5, hy + hry * 0.3, hrx * 0.35, [200, 90, 80], 0.14);
  glow(c, cx + hrx * 0.5, hy + hry * 0.3, hrx * 0.35, [200, 90, 80], 0.1);
  // hair on top
  const hc = p.hair;
  c.fillStyle = rgba(hc[0], hc[1], hc[2]);
  c.beginPath();
  c.ellipse(cx, hy - hry * 0.72, hrx * (p.woman ? 1.05 : 1.1), hry * 0.42, 0, Math.PI, 0);
  c.quadraticCurveTo(cx + hrx * 0.4, hy - hry * 0.4, cx - hrx * 0.4, hy - hry * 0.42);
  c.fill();
  if (!p.woman) { for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * hrx * 0.98, hy - hry * 0.15, hrx * 0.14, hry * 0.5, 0, 0, 7); c.fill(); } }
  if (p.bonnet) {
    c.fillStyle = rgba(190, 175, 150);
    c.beginPath(); c.ellipse(cx, hy - hry * 0.85, hrx * 1.5, hry * 0.5, 0, Math.PI, 0); c.fill();
    c.fillStyle = rgba(90, 30, 34);
    c.fillRect(cx - hrx * 1.5, hy - hry * 0.88, hrx * 3, 5);
  }
  // rim light
  glow(c, cx - L * hrx, hy - hry * 0.2, hrx * 1.2, [255, 210, 160], 0.1, 'lighter');
}

// ---------------------------------------------------------------- landscapes
function tree(c: Ctx, x: number, y: number, len: number, ang: number, wd: number, rand: R, depth: number): void {
  if (depth <= 0 || len < 4) return;
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  c.lineWidth = wd;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
  const n = 2 + (rand() < 0.3 ? 1 : 0);
  for (let i = 0; i < n; i++) tree(c, x2, y2, len * (0.68 + rand() * 0.12), ang + (rand() - 0.5) * 1.3, wd * 0.68, rand, depth - 1);
}

function hills(c: Ctx, w: number, y: number, amp: number, col: string, rand: R, roughness = 3): void {
  c.fillStyle = col;
  c.beginPath(); c.moveTo(0, c.canvas.height);
  const ph = rand() * 10;
  for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x * 0.012 + ph) * amp + Math.sin(x * 0.031 + ph * 2) * amp * 0.4 + Math.sin(x * 0.09 + ph) * roughness);
  c.lineTo(w, c.canvas.height); c.closePath(); c.fill();
}

function moonlit(c: Ctx, w: number, h: number, rand: R, warm: boolean): void {
  vgrad(c, w, h, [[0, warm ? '#1c1a26' : '#0b1220'], [0.45, warm ? '#4a3a3a' : '#1f3040'], [0.62, warm ? '#b0804a' : '#5a7080'], [0.63, '#111']]);
  const mx = w * (0.25 + rand() * 0.5), my = h * (0.14 + rand() * 0.12);
  glow(c, mx, my, w * 0.6, warm ? [255, 200, 130] : [190, 210, 240], 0.35);
  // clouds
  for (let i = 0; i < 9; i++) {
    const y = h * (0.05 + rand() * 0.5), cxx = rand() * w;
    c.save(); c.globalAlpha = 0.12 + rand() * 0.16; c.fillStyle = warm ? '#6a5040' : '#39485c';
    c.beginPath(); c.ellipse(cxx, y, w * (0.15 + rand() * 0.25), 6 + rand() * 12, (rand() - 0.5) * 0.1, 0, 7); c.fill(); c.restore();
  }
  c.fillStyle = warm ? '#f7e2b8' : '#e7eef6';
  c.beginPath(); c.arc(mx, my, w * 0.055, 0, 7); c.fill();
  c.fillStyle = 'rgba(120,120,130,0.12)';
  for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(mx + (rand() - 0.5) * w * 0.05, my + (rand() - 0.5) * w * 0.04, 4 + rand() * 6, 0, 7); c.fill(); }
  const hz = h * 0.6;
  hills(c, w, hz - 20, 20, warm ? '#3a2a2a' : '#1a2836', rand);
  hills(c, w, hz + 20, 24, warm ? '#20191a' : '#0e1a26', rand);
  // ground
  const gg = c.createLinearGradient(0, hz + 30, 0, h);
  gg.addColorStop(0, warm ? '#1c1810' : '#0d1510'); gg.addColorStop(1, '#050605');
  c.fillStyle = gg; c.fillRect(0, hz + 50, w, h);
  // path
  c.fillStyle = warm ? 'rgba(200,160,100,0.25)' : 'rgba(150,180,210,0.22)';
  c.beginPath(); c.moveTo(w * 0.47, hz + 45); c.lineTo(w * 0.53, hz + 45); c.lineTo(w * 0.8, h); c.lineTo(w * 0.2, h); c.fill();
  // house on hill
  const hx = w * (0.55 + rand() * 0.2), hyy = hz + 6;
  c.fillStyle = '#0a0a0c';
  c.fillRect(hx, hyy - 34, 36, 34);
  c.beginPath(); c.moveTo(hx - 4, hyy - 34); c.lineTo(hx + 18, hyy - 56); c.lineTo(hx + 40, hyy - 34); c.fill();
  c.fillRect(hx + 28, hyy - 62, 6, 18);
  c.fillStyle = '#f0b860'; c.fillRect(hx + 9, hyy - 24, 6, 9);
  glow(c, hx + 12, hyy - 20, 34, [255, 190, 90], 0.45, 'lighter');
  // trees
  c.strokeStyle = '#050508'; c.lineCap = 'round';
  const tx = rand() < 0.5 ? w * 0.14 : w * 0.86;
  tree(c, tx, h * 0.98, h * 0.16, -Math.PI / 2 + (rand() - 0.5) * 0.3, 16, rand, 8);
  tree(c, tx + (rand() - 0.5) * 120, h * 0.9, h * 0.1, -Math.PI / 2 + (rand() - 0.5) * 0.5, 9, rand, 7);
  for (let i = 0; i < 7; i++) { c.fillStyle = '#080a0a'; const bx = w * (0.3 + rand() * 0.5), by = hz + 22 + rand() * 14; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - 6, by + 14); c.lineTo(bx + 6, by + 14); c.fill(); c.fillRect(bx - 1, by + 12, 2, 6); }
  // mist
  const mg = c.createLinearGradient(0, hz - 10, 0, hz + 70);
  mg.addColorStop(0, 'rgba(160,170,180,0)'); mg.addColorStop(0.5, 'rgba(160,170,180,0.14)'); mg.addColorStop(1, 'rgba(160,170,180,0)');
  c.fillStyle = mg; c.fillRect(0, hz - 10, w, 80);
}

function ruin(c: Ctx, w: number, h: number, rand: R): void {
  vgrad(c, w, h, [[0, '#0e1418'], [0.5, '#2c3a40'], [1, '#0a0e10']]);
  glow(c, w * 0.5, h * 0.3, w * 0.7, [170, 200, 210], 0.28);
  // moon behind
  c.fillStyle = '#e4ecef'; c.beginPath(); c.arc(w * 0.5, h * 0.24, w * 0.06, 0, 7); c.fill();
  glow(c, w * 0.5, h * 0.24, w * 0.3, [220, 235, 240], 0.3);
  // gothic wall with arches
  c.fillStyle = '#080b0d';
  c.fillRect(0, h * 0.42, w, h * 0.6);
  for (const cx of [w * 0.2, w * 0.5, w * 0.8]) {
    const aw = w * 0.11, top = h * 0.5, bot = h * 0.85;
    c.save();
    c.beginPath(); c.moveTo(cx - aw, bot); c.lineTo(cx - aw, top + aw); c.quadraticCurveTo(cx - aw, top, cx, top - aw * 1.1); c.quadraticCurveTo(cx + aw, top, cx + aw, top + aw); c.lineTo(cx + aw, bot); c.closePath();
    c.clip();
    const g = c.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, '#5a7a88'); g.addColorStop(1, '#1c2a30');
    c.fillStyle = g; c.fillRect(cx - aw, top - aw * 1.2, aw * 2, bot - top + aw * 1.4);
    c.strokeStyle = '#080b0d'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(cx, top - aw); c.lineTo(cx, bot); c.moveTo(cx - aw, top + aw * 1.4); c.lineTo(cx + aw, top + aw * 1.4); c.stroke();
    c.beginPath(); c.arc(cx - aw / 2, top + aw * 0.55, aw * 0.38, 0, 7); c.arc(cx + aw / 2, top + aw * 0.55, aw * 0.38, 0, 7); c.stroke();
    c.restore();
    glow(c, cx, bot, aw * 3, [140, 180, 200], 0.15, 'lighter');
  }
  // broken tops / pinnacles
  c.fillStyle = '#080b0d';
  for (let i = 0; i < 8; i++) { const x = (i / 7) * w; const ph = 20 + rand() * 60; c.beginPath(); c.moveTo(x - 12, h * 0.44); c.lineTo(x, h * 0.44 - ph); c.lineTo(x + 12, h * 0.44); c.fill(); }
  c.strokeStyle = '#040607'; c.lineCap = 'round';
  tree(c, w * (0.06 + rand() * 0.1), h, h * 0.15, -Math.PI / 2, 10, rand, 7);
  tree(c, w * (0.85 + rand() * 0.1), h, h * 0.12, -Math.PI / 2, 9, rand, 7);
  // gravestones
  for (let i = 0; i < 9; i++) {
    const gx = rand() * w, gy = h * (0.86 + rand() * 0.12), gw = 14 + rand() * 12;
    c.fillStyle = `rgb(${18 + rand() * 20},${24 + rand() * 20},${28 + rand() * 20})`;
    c.beginPath(); c.moveTo(gx - gw / 2, gy + 30); c.lineTo(gx - gw / 2, gy); c.quadraticCurveTo(gx, gy - gw * 0.8, gx + gw / 2, gy); c.lineTo(gx + gw / 2, gy + 30); c.fill();
  }
  const fog = c.createLinearGradient(0, h * 0.7, 0, h);
  fog.addColorStop(0, 'rgba(150,170,180,0)'); fog.addColorStop(0.6, 'rgba(150,170,180,0.28)'); fog.addColorStop(1, 'rgba(60,70,80,0.2)');
  c.fillStyle = fog; c.fillRect(0, h * 0.7, w, h * 0.3);
}

function stillLife(c: Ctx, w: number, h: number, rand: R): void {
  vgrad(c, w, h, [[0, '#0c0806'], [0.6, '#1a120c'], [1, '#080504']]);
  smudges(c, w, h, rand, 24, true);
  const cx = w * 0.36;
  glow(c, cx, h * 0.38, w * 0.9, [255, 170, 80], 0.35);
  // table
  const ty = h * 0.72;
  const tg = c.createLinearGradient(0, ty, 0, h);
  tg.addColorStop(0, '#4a3020'); tg.addColorStop(1, '#100804');
  c.fillStyle = tg; c.fillRect(0, ty, w, h - ty);
  glow(c, cx, ty + 10, w * 0.5, [255, 190, 110], 0.28);
  // book
  c.fillStyle = '#3a1618'; c.fillRect(w * 0.5, ty - 30, w * 0.36, 30);
  c.fillStyle = '#d8c8a0'; c.fillRect(w * 0.51, ty - 24, w * 0.34, 5); c.fillRect(w * 0.51, ty - 16, w * 0.34, 3);
  c.fillStyle = '#5a2a24'; c.fillRect(w * 0.5, ty - 32, w * 0.36, 4);
  // skull
  const sx = w * 0.64, sy = ty - 78;
  const sg = c.createRadialGradient(sx - 14, sy - 12, 4, sx, sy, 60);
  sg.addColorStop(0, '#f0e0c0'); sg.addColorStop(0.6, '#9a8560'); sg.addColorStop(1, '#2a2015');
  c.fillStyle = sg;
  c.beginPath(); c.ellipse(sx, sy, 44, 46, 0, 0, 7); c.fill();
  c.beginPath(); c.moveTo(sx - 26, sy + 26); c.lineTo(sx + 26, sy + 26); c.lineTo(sx + 22, sy + 48); c.lineTo(sx - 22, sy + 48); c.fill();
  c.fillStyle = '#0a0604';
  c.beginPath(); c.ellipse(sx - 17, sy - 2, 12, 14, 0, 0, 7); c.ellipse(sx + 17, sy - 2, 12, 14, 0, 0, 7); c.fill();
  c.beginPath(); c.moveTo(sx, sy + 12); c.lineTo(sx - 6, sy + 26); c.lineTo(sx + 6, sy + 26); c.fill();
  c.strokeStyle = '#1a1008'; c.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(sx + i * 8, sy + 32); c.lineTo(sx + i * 8, sy + 46); c.stroke(); }
  // goblet
  const gx = w * 0.16, gy = ty;
  c.fillStyle = '#8a6a30';
  c.beginPath(); c.moveTo(gx - 26, gy - 90); c.lineTo(gx + 26, gy - 90); c.quadraticCurveTo(gx + 26, gy - 50, gx + 5, gy - 42); c.lineTo(gx + 5, gy - 12); c.lineTo(gx + 22, gy - 4); c.lineTo(gx + 22, gy); c.lineTo(gx - 22, gy); c.lineTo(gx - 22, gy - 4); c.lineTo(gx - 5, gy - 12); c.lineTo(gx - 5, gy - 42); c.quadraticCurveTo(gx - 26, gy - 50, gx - 26, gy - 90); c.fill();
  glow(c, gx + 10, gy - 70, 26, [255, 220, 150], 0.4, 'lighter');
  // candle
  const kx = cx, ky = ty;
  c.fillStyle = '#d8c8a0'; c.fillRect(kx - 13, ky - 120, 26, 120);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(kx + 4, ky - 120, 9, 120);
  c.fillStyle = '#e8dcc0'; c.beginPath(); c.moveTo(kx - 13, ky - 120); c.lineTo(kx - 6, ky - 108); c.lineTo(kx - 2, ky - 124); c.lineTo(kx + 10, ky - 112); c.lineTo(kx + 13, ky - 120); c.fill();
  glow(c, kx, ky - 150, 90, [255, 190, 90], 0.55, 'lighter');
  c.fillStyle = '#ffb040'; c.beginPath(); c.moveTo(kx, ky - 186); c.quadraticCurveTo(kx + 12, ky - 152, kx, ky - 130); c.quadraticCurveTo(kx - 12, ky - 152, kx, ky - 186); c.fill();
  c.fillStyle = '#fff4c8'; c.beginPath(); c.ellipse(kx, ky - 148, 4, 12, 0, 0, 7); c.fill();
}

// ---------------------------------------------------------------- finishing
function craquelure(c: Ctx, w: number, h: number, rand: R): void {
  c.save();
  c.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    let x = rand() * w, y = rand() * h, a = rand() * 6.28;
    const len = 8 + rand() * 26;
    c.beginPath(); c.moveTo(x, y);
    for (let d = 0; d < len; d += 4) { a += (rand() - 0.5) * 1.1; x += Math.cos(a) * 4; y += Math.sin(a) * 4; c.lineTo(x, y); }
    c.strokeStyle = `rgba(20,10,4,${0.14 + rand() * 0.2})`; c.lineWidth = 0.8; c.stroke();
    c.translate(0.8, 0.8); c.strokeStyle = 'rgba(255,230,180,0.06)'; c.stroke(); c.translate(-0.8, -0.8);
  }
  c.restore();
}

function brushStrokes(c: Ctx, w: number, h: number, rand: R): void {
  const d = c.getImageData(0, 0, w, h).data;
  c.save();
  c.lineCap = 'round';
  for (let i = 0; i < 5000; i++) {
    const x = rand() * w, y = rand() * h;
    const j = ((y | 0) * w + (x | 0)) * 4;
    const a = (rand() < 0.6 ? -0.9 : 0.5) + (rand() - 0.5) * 0.9;
    const len = 3 + rand() * 6;
    c.strokeStyle = rgba(d[j], d[j + 1], d[j + 2], 0.3);
    c.lineWidth = 2 + rand() * 2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
  }
  c.restore();
}

function finish(c: Ctx, w: number, h: number, rand: R): void {
  brushStrokes(c, w, h, rand);
  blurCanvas(c, w, h, 0.9);
  // canvas weave and painterly noise
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const weave = (Math.sin(x * 2.1) * Math.sin(y * 2.1)) * 3.5 + (rand() - 0.5) * 9;
    d[i] += weave; d[i + 1] += weave; d[i + 2] += weave;
  }
  c.putImageData(img, 0, 0);
  craquelure(c, w, h, rand);
  // varnish: warm yellowing, darker at edges, uneven
  c.save();
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = 'rgb(226,196,140)'; c.fillRect(0, 0, w, h);
  c.restore();
  const vg = c.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) glow(c, rand() * w, rand() * h, 40 + rand() * 90, [30, 18, 6], 0.1 + rand() * 0.12);
  // tiny dust flecks
  for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(${rand() < 0.5 ? '220,200,160' : '10,6,2'},${0.1 + rand() * 0.25})`; c.fillRect(rand() * w, rand() * h, 1 + rand() * 1.5, 1 + rand() * 1.5); }
}

export function drawPainting(c: Ctx, w: number, h: number, seed: number): void {
  const look = ((Math.floor(seed) % 6) + 6) % 6;
  const rand = mulberry(Math.floor(seed) * 977 + 31);
  const L = rand() < 0.5 ? 1 : -1;
  const v = Math.floor(Math.abs(seed) / 6) & 1;
  switch (look) {
    case 0:
      portrait(c, w, h, rand, { bg: ['#2a1c12', '#0c0705'], cloth: [40, 34, 32], collar: [226, 214, 190], skin: [214, 168, 134], hair: [190, 186, 178], woman: false, light: L, wig: true });
      break;
    case 1:
      portrait(c, w, h, rand, { bg: ['#14262a', '#070d0f'], cloth: [178, 160, 138], collar: [230, 222, 205], skin: [226, 186, 158], hair: [36, 24, 18], woman: true, light: L, bonnet: false });
      break;
    case 2: moonlit(c, w, h, rand, v === 1); break;
    case 3:
      portrait(c, w, h, rand, { bg: ['#301612', '#0e0605'], cloth: [30, 44, 66], collar: [220, 210, 186], skin: [206, 158, 126], hair: [60, 38, 24], woman: false, light: L, drape: [122, 24, 30] });
      break;
    case 4: ruin(c, w, h, rand); break;
    default: stillLife(c, w, h, rand); break;
  }
  finish(c, w, h, rand);
}
