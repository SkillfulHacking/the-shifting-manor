import { makeCanvas } from './core';

export type SigilName =
  | 'moon' | 'chalice' | 'flame' | 'raven' | 'eye' | 'rose' | 'spider' | 'skull' | 'bell' | 'crown' | 'star' | 'key';

type Ctx = CanvasRenderingContext2D;

/** Glyph drawn in a -40..40 box around the origin; `cut` erases (destination-out) then restores. */
function cut(c: Ctx, fn: () => void): void {
  c.save();
  c.globalCompositeOperation = 'destination-out';
  fn();
  c.restore();
}
function ellipsePath(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

const GLYPHS: Record<SigilName, (c: Ctx) => void> = {
  moon(c) {
    const R = 32, r = 26, cx = 13;
    const x = (R * R - r * r + cx * cx) / (2 * cx), y = Math.sqrt(R * R - x * x);
    const th = Math.atan2(y, x), ph = Math.atan2(y, x - cx);
    c.beginPath();
    c.arc(-4, 0, R, -th, th, true);
    c.arc(-4 + cx, 0, r, ph, -ph, false);
    c.closePath();
    c.fill();
    // small star in the hollow
    c.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 - Math.PI / 2, rr = k & 1 ? 2.6 : 8;
      c.lineTo(20 + Math.cos(a) * rr, 2 + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  },
  chalice(c) {
    c.beginPath();
    c.moveTo(-26, -32);
    c.lineTo(26, -32);
    c.bezierCurveTo(26, -8, 10, -2, 5, 6);
    c.lineTo(5, 16);
    c.bezierCurveTo(5, 20, 20, 22, 26, 32);
    c.lineTo(-26, 32);
    c.bezierCurveTo(-20, 22, -5, 20, -5, 16);
    c.lineTo(-5, 6);
    c.bezierCurveTo(-10, -2, -26, -8, -26, -32);
    c.closePath();
    c.fill();
    ellipsePath(c, 0, 12, 10, 5); c.fill();
    cut(c, () => {
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(-23, -22); c.lineTo(23, -22); c.stroke();
      c.beginPath(); c.moveTo(-5.5, 9); c.lineTo(5.5, 9); c.moveTo(-5.5, 15.5); c.lineTo(5.5, 15.5); c.stroke();
    });
  },
  flame(c) {
    const shape = (s: number, oy: number) => {
      c.save(); c.translate(0, oy); c.scale(s, s);
      c.beginPath();
      c.moveTo(2, -40);
      c.bezierCurveTo(6, -22, 30, -10, 28, 12);
      c.bezierCurveTo(27, 28, 14, 36, 0, 36);
      c.bezierCurveTo(-14, 36, -27, 28, -27, 12);
      c.bezierCurveTo(-27, 0, -18, -6, -14, -18);
      c.bezierCurveTo(-8, -8, -6, -6, -4, -6);
      c.bezierCurveTo(-8, -20, -4, -34, 2, -40);
      c.closePath();
      c.restore();
    };
    shape(1, 0); c.fill();
    cut(c, () => { shape(0.52, 14); c.fill(); });
    shape(0.24, 20); c.fill();
  },
  raven(c) {
    c.beginPath();
    c.moveTo(-38, -4);
    c.lineTo(-26, -13);
    c.bezierCurveTo(-22, -26, -4, -26, 2, -16);
    c.bezierCurveTo(12, -8, 26, 0, 40, 14);
    c.lineTo(30, 18);
    c.lineTo(38, 26);
    c.lineTo(20, 22);
    c.bezierCurveTo(14, 26, 0, 26, -8, 18);
    c.bezierCurveTo(-16, 12, -18, 4, -22, 0);
    c.closePath();
    c.fill();
    // legs + perch
    c.lineWidth = 3.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-4, 22); c.lineTo(-6, 34); c.moveTo(6, 23); c.lineTo(5, 34); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.moveTo(-22, 35); c.lineTo(22, 35); c.stroke();
    cut(c, () => {
      c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-10, -8); c.bezierCurveTo(4, -6, 22, 4, 32, 15); c.stroke();
      c.beginPath(); c.moveTo(-6, 0); c.bezierCurveTo(6, 2, 16, 10, 22, 18); c.stroke();
      ellipsePath(c, -21, -10, 2.4, 2.4); c.fill();
    });
  },
  eye(c) {
    c.lineJoin = 'round';
    c.lineWidth = 5.5;
    c.beginPath(); c.moveTo(0, -36); c.lineTo(37, 28); c.lineTo(-37, 28); c.closePath(); c.stroke();
    // almond
    c.beginPath(); c.moveTo(-21, 8); c.quadraticCurveTo(0, -14, 21, 8); c.quadraticCurveTo(0, 30, -21, 8); c.closePath(); c.fill();
    cut(c, () => { ellipsePath(c, 0, 8, 8, 8); c.fill(); });
    ellipsePath(c, 0, 8, 4, 4); c.fill();
  },
  rose(c) {
    // leaves
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1); c.translate(14, 22); c.rotate(-0.7);
      ellipsePath(c, 0, 0, 7, 14); c.fill();
      c.restore();
    }
    c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 12); c.lineTo(0, 38); c.stroke();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      ellipsePath(c, Math.cos(a) * 17, -8 + Math.sin(a) * 17, 13.5, 13.5); c.fill();
    }
    ellipsePath(c, 0, -8, 16, 16); c.fill();
    cut(c, () => {
      c.lineWidth = 2.4;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        ellipsePath(c, Math.cos(a) * 17, -8 + Math.sin(a) * 17, 13.5, 13.5); c.stroke();
      }
      c.beginPath();
      for (let a = 0; a < 7; a += 0.2) { const r = 1 + a * 1.3; const x = Math.cos(a) * r, y = -8 + Math.sin(a) * r; if (a === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
    });
  },
  spider(c) {
    c.lineWidth = 3.6; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const y0 = -8 + k * 5;
        const kneeX = 20 + (k === 1 || k === 2 ? 6 : 0), kneeY = -26 + k * 12;
        const footX = 32, footY = [-14, -2, 12, 28][k];
        c.beginPath(); c.moveTo(s * 5, y0); c.lineTo(s * kneeX, kneeY); c.lineTo(s * footX, footY); c.stroke();
      }
    }
    ellipsePath(c, 0, 10, 12, 15); c.fill();
    ellipsePath(c, 0, -10, 8, 8); c.fill();
    c.lineWidth = 3; c.beginPath(); c.moveTo(-4, -20); c.lineTo(-3, -15); c.moveTo(4, -20); c.lineTo(3, -15); c.stroke();
    cut(c, () => {
      c.beginPath(); c.moveTo(-5, 3); c.lineTo(5, 3); c.lineTo(0, 11); c.lineTo(5, 19); c.lineTo(-5, 19); c.lineTo(0, 11); c.closePath(); c.fill();
    });
  },
  skull(c) {
    ellipsePath(c, 0, -6, 26, 26); c.fill();
    c.beginPath();
    c.moveTo(-17, 12); c.lineTo(17, 12); c.lineTo(15, 32); c.quadraticCurveTo(0, 36, -15, 32); c.closePath(); c.fill();
    cut(c, () => {
      ellipsePath(c, -10, -4, 7.5, 8.5); c.fill();
      ellipsePath(c, 10, -4, 7.5, 8.5); c.fill();
      c.beginPath(); c.moveTo(0, 4); c.lineTo(-4, 13); c.lineTo(4, 13); c.closePath(); c.fill();
      c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath();
      for (const x of [-8, -2.7, 2.7, 8]) { c.moveTo(x, 22); c.lineTo(x, 33); }
      c.stroke();
    });
  },
  bell(c) {
    ellipsePath(c, 0, -33, 4.5, 4.5); c.fill();
    c.beginPath();
    c.moveTo(0, -29);
    c.bezierCurveTo(-14, -29, -19, -12, -21, 6);
    c.bezierCurveTo(-22, 16, -32, 20, -33, 27);
    c.lineTo(33, 27);
    c.bezierCurveTo(32, 20, 22, 16, 21, 6);
    c.bezierCurveTo(19, -12, 14, -29, 0, -29);
    c.closePath();
    c.fill();
    ellipsePath(c, 0, 31, 6, 6); c.fill();
    cut(c, () => {
      c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-22, 17); c.lineTo(22, 17); c.stroke();
      c.beginPath(); c.moveTo(-12, -14); c.bezierCurveTo(-15, -4, -17, 2, -17, 8); c.stroke();
    });
  },
  crown(c) {
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(-32, 24); c.lineTo(-35, -18); c.lineTo(-17, 2); c.lineTo(0, -28); c.lineTo(17, 2); c.lineTo(35, -18); c.lineTo(32, 24);
    c.closePath(); c.fill();
    for (const [x, y] of [[-35, -23], [0, -34], [35, -23]]) { ellipsePath(c, x, y, 5, 5); c.fill(); }
    cut(c, () => {
      c.lineWidth = 2.6; c.beginPath(); c.moveTo(-33, 11); c.lineTo(33, 11); c.stroke();
      for (const x of [-18, 0, 18]) { ellipsePath(c, x, 18, 3, 3); c.fill(); }
    });
    c.fillRect(-33, 28, 66, 6);
  },
  star(c) {
    c.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8 - Math.PI / 2, r = k & 1 ? 14 : 38;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath(); c.fill();
    cut(c, () => { ellipsePath(c, 0, 0, 5, 5); c.fill(); });
  },
  key(c) {
    c.save(); c.rotate(-0.6);
    ellipsePath(c, 0, -24, 15, 15); c.fill();
    c.fillRect(-3.6, -12, 7.2, 50);
    c.fillRect(3, 20, 13, 6);
    c.fillRect(3, 30, 9, 6);
    c.fillRect(-7, -12, 14, 5);
    cut(c, () => { ellipsePath(c, 0, -24, 7, 7); c.fill(); });
    c.restore();
  },
};

const cache = new Map<string, HTMLCanvasElement>();

export function drawSigil(name: SigilName, color: string, size: number): HTMLCanvasElement {
  const key = `${name}|${color}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const g = makeCanvas(size, size);
  const c = g.getContext('2d')!;
  const s = size / 100;
  c.scale(s, s);
  c.translate(50, 50);
  c.fillStyle = color;
  c.strokeStyle = color;
  // rings
  c.lineWidth = 3.8;
  c.beginPath(); c.arc(0, 0, 46.5, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 1.4;
  c.beginPath(); c.arc(0, 0, 41.5, 0, Math.PI * 2); c.stroke();
  // glyph (scaled to fit inside inner ring)
  c.save();
  c.scale(0.8, 0.8);
  c.lineCap = 'round';
  GLYPHS[name](c);
  c.restore();
  // glow pass
  const out = makeCanvas(size, size);
  const oc = out.getContext('2d')!;
  oc.shadowColor = color;
  oc.shadowBlur = size * 0.05;
  oc.drawImage(g, 0, 0);
  oc.shadowBlur = size * 0.02;
  oc.drawImage(g, 0, 0);
  oc.shadowBlur = 0;
  oc.drawImage(g, 0, 0);
  cache.set(key, out);
  return out;
}
