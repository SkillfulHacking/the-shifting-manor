import * as THREE from 'three';
import { Builder, archShape, bx, cyl, gilt, iron, brass, lathe, mesh, plain, ringGeo, smoothLathe, sph, tag, tint, tor, TAU, wood, tube, rng, V3, canvasTex, paintingTex, ornateFrame, smoothSeams, crestShape, cupGeo, addChain, mat } from './util';
import { caseWood } from './clock';
import { skull } from './objects';

/* ---------- frames ---------- */
function frameBW(w: number, h: number) { return Math.max(0.05, Math.min(0.14, Math.min(w, h) * 0.11)); }

/** Gilded ornate painting frame. width/height = outer size. Origin = centre on wall, +Z out. */
export function paintingFrame(width = 0.9, height = 1.2, seed = 1): THREE.Group {
  const bw = frameBW(width, height);
  const iw = width - bw * 2, ih = height - bw * 2;
  const g = ornateFrame(iw, ih, bw, 'gilt');
  const tex = paintingTex(seed, 512, Math.max(256, Math.round(512 * ih / iw)));
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(iw + 0.02, ih + 0.02), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65, metalness: 0 }));
  canvas.position.z = 0.012; canvas.name = 'canvas'; canvas.receiveShadow = true;
  g.add(canvas);
  const b = new Builder(g);
  b.add(bx(iw + 0.02, ih + 0.02, 0.01), plain(0x1a120c, 1), { p: [0, 0, 0.005] });
  // hanging wire hint / tiny brass plaque
  if (width > 0.7) {
    b.add(bx(0.12, 0.03, 0.006, 0.002), gilt(), { p: [0, -height / 2 - 0.01, 0.055 ] });
  }
  b.build();
  return tag(g, { innerSize: { w: iw, h: ih }, canvas });
}

/** Same frame as paintingFrame but with a hole in the middle. */
export function mirrorFrame(width = 0.9, height = 1.4): THREE.Group {
  const bw = frameBW(width, height);
  const iw = width - bw * 2, ih = height - bw * 2;
  const g = ornateFrame(iw, ih, bw, 'gilt');
  return tag(g, { innerSize: { w: iw, h: ih }, glassZ: 0.012 });
}

function ellipseTube(a: number, b: number, r: number, segs = 48, radial = 6): THREE.BufferGeometry {
  const pts: V3[] = [];
  for (let i = 0; i < 24; i++) { const t = (i / 24) * TAU; pts.push([Math.cos(t) * a, Math.sin(t) * b, 0]); }
  return tube(pts, r, segs, radial, true);
}

/** First-person hand mirror. Origin at handle grip; +Y toward the oval, front +Z. Glass surface left open. */
export function handMirror(): THREE.Group {
  const b = new Builder();
  const m = tint('brass', 0xe8e0cc, { roughness: 0.3, metalness: 0.55, key: 'handMirror' });
  const br = gilt();
  const a = 0.068, bb = 0.09, cy = 0.215;
  // handle: turned silver with gilt bands
  b.add(smoothLathe([[0.006, -0.085], [0.011, -0.078], [0.017, -0.06], [0.012, -0.035], [0.011, -0.01], [0.014, 0.02], [0.012, 0.05], [0.016, 0.07], [0.02, 0.085], [0.011, 0.105]], 20, 3), m);
  b.add(sph(0.014, 10, 8), br, { p: [0, -0.088, 0] });
  for (const y of [-0.05, 0.0, 0.055]) b.add(tor(0.0135, 0.0035, 5, 16), br, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
  // collar + fluted neck into frame
  b.add(smoothLathe([[0.011, 0.1], [0.024, 0.115], [0.02, 0.125], [0.01, 0.135]], 14, 2), br);
  b.add(new THREE.ConeGeometry(0.02, 0.05, 8), m, { p: [0, cy - bb - 0.005, 0], r: [Math.PI, 0, 0], s: [1, 1, 0.5] });
  // oval frame: stacked tubes for layered rim
  b.add(ellipseTube(a, bb, 0.0075, 56, 6), m, { p: [0, cy, 0.0] });
  b.add(ellipseTube(a + 0.011, bb + 0.011, 0.0055, 56, 6), br, { p: [0, cy, -0.003] });
  b.add(ellipseTube(a - 0.009, bb - 0.009, 0.0038, 56, 6), br, { p: [0, cy, 0.004] });
  // rim beading
  const bead = sph(0.0045, 5, 4);
  for (let i = 0; i < 32; i++) { const t = (i / 32) * TAU; b.add(bead, br, { p: [Math.cos(t) * (a + 0.02), cy + Math.sin(t) * (bb + 0.02), 0.0] }); }
  // top crest flourish
  b.add(sph(0.012, 8, 6), br, { p: [0, cy + bb + 0.028, 0], s: [1.2, 1.4, 0.7] });
  for (const s of [-1, 1]) {
    b.add(tor(0.016, 0.003, 4, 10, Math.PI * 1.4), m, { p: [s * 0.02, cy + bb + 0.02, 0], r: [0, 0, s > 0 ? -1 : 2.5] });
  }
  // back scroll ornaments
  for (const s of [-1, 1]) b.add(sph(0.01, 6, 5), br, { p: [s * (a + 0.02), cy - bb * 0.55, 0], s: [1, 1.6, 0.8] });
  const g = b.build();
  return tag(g, { glassCenter: new THREE.Vector3(0, cy, 0.002), glassRadius: a * 0.96, glassSize: { a: a - 0.008, b: bb - 0.008 } });
}

/* ---------- coffin / sarcophagus ---------- */
function coffinShape(sx = 1, sz = 1): THREE.Shape {
  const pts: [number, number][] = [[-1.0, -0.16], [-0.6, -0.32], [0.4, -0.27], [1.0, -0.12], [1.0, 0.12], [0.4, 0.27], [-0.6, 0.32], [-1.0, 0.16]];
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x * sx, y * sz) : s.moveTo(x * sx, y * sz)));
  s.closePath();
  return s;
}
function flat(g: THREE.BufferGeometry) { g.rotateX(-Math.PI / 2); return g; }

export function coffin(): THREE.Group {
  const b = new Builder();
  const wd = tint('darkWood', 0x9a7458, { roughness: 0.42, key: 'coffinWood' });
  const stone = 'stoneWall' as const;
  // stone bier
  b.add(bx(2.5, 0.12, 1.0, 0.012), stone, { p: [0, 0.06, 0] });
  b.add(bx(2.3, 0.5, 0.8, 0.015), stone, { p: [0, 0.37, 0] });
  for (let i = 0; i < 4; i++) b.add(new THREE.ExtrudeGeometry(archShape(0.42, 0.34, 0.14), { depth: 0.015, bevelEnabled: false }), tint('stoneWall', 0x6a655d, { key: 'bierIn' }), { p: [-0.83 + i * 0.555, 0.2, 0.4] });
  b.add(bx(2.5, 0.08, 1.0, 0.012), 'marble', { p: [0, 0.66, 0] });
  b.add(bx(2.42, 0.04, 0.92, 0.01), 'marble', { p: [0, 0.71, 0] });
  const y0 = 0.73;
  // coffin body: walls (ring) + floor
  const outer = coffinShape();
  const inner = new THREE.Path(coffinShape(0.965, 0.9).getPoints().reverse());
  outer.holes.push(inner);
  b.add(flat(new THREE.ExtrudeGeometry(outer, { depth: 0.42, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 })), wd, { p: [0, y0 + 0.01, 0] });
  b.add(flat(new THREE.ExtrudeGeometry(coffinShape(0.97, 0.9), { depth: 0.03, bevelEnabled: false })), wd, { p: [0, y0 + 0.02, 0] });
  b.add(flat(new THREE.ExtrudeGeometry(coffinShape(0.97, 0.9), { depth: 0.01, bevelEnabled: false })), plain(0x2a0a12, 0.9), { p: [0, y0 + 0.4, 0] });
  // metal handles & studs along sides
  for (const sz of [-1, 1]) for (const x of [-0.6, -0.1, 0.4]) {
    b.add(tube([[-0.06, 0, 0], [-0.04, -0.03, 0], [0.04, -0.03, 0], [0.06, 0, 0]], 0.008, 10, 5), brass(), { p: [x, y0 + 0.3, sz * (0.3 - (x > 0.3 ? 0.03 : 0) + 0.02) ], r: [0, sz > 0 ? 0 : Math.PI, 0] });
  }
  b.add(bx(2.08, 0.03, 0.66, 0.008), wd, { p: [0, y0 + 0.435, 0], s: [1, 1, 1] }, { uv: 'box' });
  const g = b.build();
  b.build();
  // lid
  const lid = new THREE.Group(); lid.name = 'lid'; lid.position.set(0, y0 + 0.44, 0);
  const lb = new Builder(lid);
  lb.add(flat(new THREE.ExtrudeGeometry(coffinShape(1.03, 1.04), { depth: 0.045, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 })), wd, { p: [0, 0, 0] });
  lb.add(flat(new THREE.ExtrudeGeometry(coffinShape(0.9, 0.75), { depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 })), tint('darkWood', 0xc09070, { key: 'lidPanel' }), { p: [0, 0.048, 0] });
  lb.add(flat(new THREE.ExtrudeGeometry(coffinShape(0.98, 0.95), { depth: 0.005, bevelEnabled: false })), gilt(), { p: [0, 0.0, 0] });
  // brass cross and corner plates
  lb.add(bx(0.5, 0.012, 0.06, 0.003), brass(), { p: [-0.25, 0.098, 0] }); lb.add(bx(0.06, 0.012, 0.26, 0.003), brass(), { p: [-0.15, 0.098, 0] });
  lb.add(sph(0.03, 8, 6), brass(), { p: [-0.15, 0.105, 0], s: [1, 0.4, 1] });
  lb.add(bx(0.3, 0.008, 0.11, 0.003), brass(), { p: [0.35, 0.098, 0] });
  lb.add(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 3), gilt(), { p: [0.35, 0.106, 0] });
  for (const [x, z] of [[-0.85, 0.08], [-0.85, -0.08], [0.85, 0.05], [0.85, -0.05], [0.0, 0.2], [0.0, -0.2]]) lb.add(sph(0.014, 6, 5), brass(), { p: [x, 0.09, z], s: [1, 0.6, 1] });
  lb.build();
  g.add(lid);
  return g;
}

export function sarcophagus(): THREE.Group {
  const b = new Builder();
  const st = 'stoneWall' as const;
  const dk = tint('stoneWall', 0x8f887e, { key: 'sarcIn' });
  const L = 2.3, W = 0.95, H = 0.85;
  b.add(bx(L + 0.2, 0.14, W + 0.2, 0.012), st, { p: [0, 0.07, 0] });
  b.add(bx(L, H - 0.14, W, 0.012), st, { p: [0, 0.14 + (H - 0.14) / 2, 0] });
  b.add(bx(L + 0.08, 0.06, W + 0.08, 0.012), st, { p: [0, H - 0.03, 0] });
  b.add(bx(L + 0.08, 0.05, W + 0.08, 0.012), st, { p: [0, 0.165, 0] });
  // arcade on long sides & ends
  const n = 4, aw = (L - 0.5) / n;
  for (const sz of [-1, 1]) for (let i = 0; i < n; i++) {
    const x = -L / 2 + 0.25 + aw * (i + 0.5);
    const rot = sz > 0 ? 0 : Math.PI;
    const mtx = new THREE.Matrix4().makeRotationY(rot).setPosition(sz > 0 ? 0 : 0, 0, 0);
    const local = new THREE.Matrix4().makeTranslation(sz > 0 ? x : -x, 0.22, W / 2 - 0.005);
    b.add(new THREE.ExtrudeGeometry(archShape(aw - 0.08, H - 0.4, (aw - 0.08) * 0.45), { depth: 0.02, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 }), dk, new THREE.Matrix4().multiplyMatrices(mtx, local));
    // colonettes
    for (const cx of [-1, 1]) {
      const xx = x + cx * (aw / 2 - 0.02);
      b.add(cyl(0.017, 0.017, H - 0.4, 8), st, new THREE.Matrix4().multiplyMatrices(mtx, new THREE.Matrix4().makeTranslation(sz > 0 ? xx : -xx, 0.22 + (H - 0.4) / 2 - 0.05, W / 2 + 0.02)));
    }
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
    const rot = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    const z = -0.2 + i * 0.4;
    b.add(new THREE.ExtrudeGeometry(archShape(0.32, H - 0.4, 0.15), { depth: 0.02, bevelEnabled: false }), dk, new THREE.Matrix4().makeRotationY(rot).multiply(new THREE.Matrix4().makeTranslation(z, 0.22, L / 2 - 0.005)));
  }
  // corner posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(bx(0.12, H - 0.14, 0.12, 0.012), st, { p: [sx * (L / 2 - 0.04), 0.14 + (H - 0.14) / 2, sz * (W / 2 - 0.04)] });
  const g = b.build();
  // lid: gabled with carved recumbent relief
  const lid = new THREE.Group(); lid.name = 'lid'; lid.position.y = H;
  const lb = new Builder(lid);
  const roof = new THREE.Shape();
  roof.moveTo(-W / 2 - 0.04, 0); roof.lineTo(W / 2 + 0.04, 0); roof.lineTo(W / 2 + 0.03, 0.06); roof.lineTo(0.06, 0.24); roof.lineTo(0, 0.25); roof.lineTo(-0.06, 0.24); roof.lineTo(-W / 2 - 0.03, 0.06); roof.closePath();
  const rg = new THREE.ExtrudeGeometry(roof, { depth: L + 0.1, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 });
  rg.translate(0, 0, -(L + 0.1) / 2);
  rg.rotateY(Math.PI / 2);
  lb.add(rg, st);
  // relief effigy on ridge: cross & skull medallion
  lb.add(bx(0.9, 0.02, 0.06, 0.006), 'marble', { p: [-0.1, 0.262, 0] });
  lb.add(bx(0.06, 0.02, 0.32, 0.006), 'marble', { p: [-0.35, 0.262, 0] });
  lb.add(sph(0.06, 12, 8), 'marble', { p: [0.55, 0.28, 0], s: [1, 0.7, 0.9] });
  for (const s of [-1, 1]) lb.add(sph(0.014, 6, 5), plain(0x0a0808, 1), { p: [0.6, 0.31, s * 0.02] });
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) lb.add(sph(0.03, 8, 6), 'stoneWall', { p: [-L / 2 + 0.2 + i * (L - 0.4) / 3, 0.06, s * (W / 2 + 0.04)], s: [1.6, 0.8, 0.6] });
  lb.build();
  g.add(lid);
  return g;
}

export function gravestone(seed = 1): THREE.Group {
  const R = rng(seed * 5 + 2);
  const b = new Builder();
  const st = tint('plaster', 0x8c8b86, { roughness: 0.92, key: 'grave' });
  const kind = Math.floor(R() * 4);
  const w = 0.55 + R() * 0.15, h = 0.85 + R() * 0.35, t = 0.12;
  let shape: THREE.Shape;
  if (kind === 0) { // round-top
    shape = new THREE.Shape(); shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h - w / 2); shape.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); shape.lineTo(-w / 2, 0);
  } else if (kind === 1) { // gothic pointed
    shape = archShape(w, h, w * 0.6);
  } else if (kind === 2) { // shouldered
    shape = new THREE.Shape(); const s = w * 0.2;
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h - s * 1.5); shape.quadraticCurveTo(w / 2, h - s, w * 0.3, h - s * 0.9); shape.quadraticCurveTo(w * 0.12, h - s * 0.6, 0, h); shape.quadraticCurveTo(-w * 0.12, h - s * 0.6, -w * 0.3, h - s * 0.9); shape.quadraticCurveTo(-w / 2, h - s, -w / 2, h - s * 1.5); shape.closePath();
  } else { // cross
    const ar = 0.13, shf = w * 0.24;
    shape = new THREE.Shape();
    shape.moveTo(-shf / 2 - 0.04, 0); shape.lineTo(shf / 2 + 0.04, 0); shape.lineTo(shf / 2, 0.12); shape.lineTo(shf / 2, h * 0.6); shape.lineTo(w / 2, h * 0.6); shape.lineTo(w / 2, h * 0.6 + ar); shape.lineTo(shf / 2, h * 0.6 + ar); shape.lineTo(shf / 2, h); shape.lineTo(-shf / 2, h); shape.lineTo(-shf / 2, h * 0.6 + ar); shape.lineTo(-w / 2, h * 0.6 + ar); shape.lineTo(-w / 2, h * 0.6); shape.lineTo(-shf / 2, h * 0.6); shape.lineTo(-shf / 2, 0.12); shape.closePath();
  }
  const ex = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 10 });
  // roughen a little
  const p = ex.attributes.position;
  for (let i = 0; i < p.count; i++) { const n = Math.sin(p.getX(i) * 41 + p.getY(i) * 27 + p.getZ(i) * 13) * 0.004; p.setXYZ(i, p.getX(i) + n, p.getY(i) + n * 0.5, p.getZ(i) + n); }
  ex.computeVertexNormals();
  const lean = (R() - 0.5) * 0.12;
  b.add(ex, st, { p: [0, 0.14, -t / 2], r: [(R() - 0.5) * 0.06, 0, lean] });
  b.add(bx(w + 0.16, 0.14, t + 0.16, 0.02), 'stoneWall', { p: [0, 0.05, 0] });
  // moss
  for (let i = 0; i < 5; i++) b.add(sph(0.06 + R() * 0.05, 8, 6), tint('moss', 0x6c7c58, { key: 'gm' }), { p: [(R() - 0.5) * w, 0.14 + R() * 0.12, t / 2 + 0.005 - R() * 0.02], s: [1.6, 0.8, 0.35] });
  b.add(sph(0.12, 8, 6), tint('moss', 0x6c7c58, { key: 'gm' }), { p: [w / 2 - 0.04, 0.12, t / 2 + 0.05], s: [1.5, 0.6, 0.9] });
  const g = b.build();
  // inscription
  const names = ['E. Blackwood', 'M. Ashgrove', 'T. Hollowell', 'A. Crowe', 'H. Vane', 'L. Thorne'];
  const nm = names[Math.floor(R() * names.length)];
  const y1 = 1720 + Math.floor(R() * 150), y2 = y1 + 20 + Math.floor(R() * 50);
  const tx = canvasTex(256, 256, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(25,22,20,0.8)'; c.textAlign = 'center';
    c.font = 'bold 30px "Times New Roman", serif'; c.fillText('R.I.P.', W / 2, 50);
    c.font = '24px "Times New Roman", serif'; c.fillText(nm, W / 2, 110);
    c.font = '18px "Times New Roman", serif'; c.fillText(`${y1} - ${y2}`, W / 2, 145);
    c.fillText('Sleep Not Softly', W / 2, 190);
    c.strokeStyle = 'rgba(25,22,20,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 - 50, 65); c.lineTo(W / 2 + 50, 65); c.stroke();
  });
  const tw = Math.min(w * 0.85, 0.5);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(tw, tw), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, opacity: 0.85 }));
  label.position.set(0, 0.14 + (kind === 3 ? h * 0.35 : h * 0.55), t / 2 + 0.014); label.userData.noShadow = true;
  g.add(label);
  return g;
}

/* ---------- webs ---------- */
const webCache = new Map<number, THREE.CanvasTexture>();
function webTexture(k: number): THREE.CanvasTexture {
  let t = webCache.get(k);
  if (t) return t;
  t = canvasTex(512, 512, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const R = rng(k * 17 + 3);
    c.lineCap = 'round';
    const cx = 0, cy = 0;
    const nSpokes = 9 + Math.floor(R() * 4);
    const spokes: { x: number; y: number }[] = [];
    for (let i = 0; i < nSpokes; i++) {
      const a = (i / (nSpokes - 1)) * Math.PI / 2 + (R() - 0.5) * 0.12;
      const len = W * (0.75 + R() * 0.3);
      spokes.push({ x: cx + Math.cos(a) * len, y: cy + Math.sin(a) * len });
    }
    c.strokeStyle = 'rgba(235,235,230,0.55)'; c.lineWidth = 1.3;
    for (const s of spokes) {
      c.beginPath(); c.moveTo(cx, cy);
      c.quadraticCurveTo(s.x * 0.5 + (R() - 0.5) * 12, s.y * 0.5 + (R() - 0.5) * 12, s.x, s.y); c.stroke();
    }
    // capture arcs between spokes (sagging)
    for (let r = 0.1; r < 1.0; r += 0.07 + R() * 0.05) {
      for (let i = 0; i < nSpokes - 1; i++) {
        const a = spokes[i], b = spokes[i + 1];
        const ax = a.x * r, ay = a.y * r, bx2 = b.x * r, by = b.y * r;
        const mx = (ax + bx2) / 2, my = (ay + by) / 2;
        const nx = (ax + bx2) * 0.02, ny = (ay + by) * 0.02;
        c.strokeStyle = `rgba(235,235,230,${0.25 + R() * 0.3})`; c.lineWidth = 0.8 + R() * 0.6;
        c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx - nx, my - ny, bx2, by); c.stroke();
      }
    }
    // stray wisps
    c.lineWidth = 0.7;
    for (let i = 0; i < 26; i++) {
      c.strokeStyle = `rgba(230,230,225,${0.15 + R() * 0.25})`;
      const x = R() * W * 0.9, y = R() * H * 0.9, len = 30 + R() * 120, a = R() * TAU;
      c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + Math.cos(a) * len * 0.3, y + Math.sin(a) * len * 0.3 + 12, x + Math.cos(a) * len * 0.7, y + Math.sin(a) * len * 0.7 + 8, x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
    }
    // dust clumps
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(200,200,195,${0.12 + R() * 0.15})`; c.beginPath(); c.arc(R() * W * 0.8, R() * H * 0.8, 1 + R() * 2, 0, TAU); c.fill(); }
  });
  webCache.set(k, t);
  return t;
}
const webMats = new Map<number, THREE.MeshBasicMaterial>();

/** Wispy cobweb plane; densest in the top-left corner (rotate/flip for other corners). Origin centre, +Z. */
export function cobwebs(w = 1, h = 1, variant = 0): THREE.Group {
  const k = Math.abs(Math.floor(variant)) % 3;
  let m = webMats.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ map: webTexture(k), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9, fog: true }); webMats.set(k, m); }
  const g = new THREE.Group();
  // corner-anchored: web origin (0,0 in texture) is texture's top-left; canvas y goes down -> after flipY, texture top-left maps to plane (-w/2, +h/2)
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  pl.userData.noShadow = true; pl.castShadow = false; pl.receiveShadow = false; pl.renderOrder = 2;
  g.add(pl);
  return g;
}

export function spiderweb(size = 0.6): THREE.Group {
  const tex = canvasTex(512, 512, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const R = rng(21);
    const cx = W / 2, cy = H / 2;
    const n = 14;
    const ends: [number, number][] = [];
    c.strokeStyle = 'rgba(240,240,235,0.75)'; c.lineWidth = 1.6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (R() - 0.5) * 0.1, len = W * (0.44 + R() * 0.04);
      ends.push([cx + Math.cos(a) * len, cy + Math.sin(a) * len]);
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(ends[i][0], ends[i][1]); c.stroke();
    }
    // spiral
    c.lineWidth = 1;
    let r = 0.05;
    c.strokeStyle = 'rgba(240,240,235,0.55)';
    while (r < 0.98) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = cx + (ends[i][0] - cx) * r, ay = cy + (ends[i][1] - cy) * r;
        const r2 = r + 0.075 / n * 12 / 12 * 1.0 + 0.004;
        const bx2 = cx + (ends[j][0] - cx) * r2, by = cy + (ends[j][1] - cy) * r2;
        c.beginPath(); c.moveTo(ax, ay);
        c.quadraticCurveTo((ax + bx2) / 2 + (cx - (ax + bx2) / 2) * 0.03, (ay + by) / 2 + (cy - (ay + by) / 2) * 0.03 + 2, bx2, by); c.stroke();
        r = r2;
      }
      r += 0.005;
    }
    // hub
    c.fillStyle = 'rgba(240,240,235,0.6)'; c.beginPath(); c.arc(cx, cy, 5, 0, TAU); c.fill();
    // dew/dust
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(220,220,215,0.4)'; c.beginPath(); c.arc(cx + (R() - 0.5) * W * 0.8, cy + (R() - 0.5) * H * 0.8, 1 + R() * 1.5, 0, TAU); c.fill(); }
  });
  const g = new THREE.Group();
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  pl.userData.noShadow = true; pl.castShadow = false; g.add(pl);
  // spider
  const b = new Builder();
  const dk = plain(0x0c0806, 0.6);
  b.add(sph(0.011 * size / 0.6, 8, 6), dk, { p: [0, -size * 0.03, 0.004], s: [1, 1.3, 1] });
  b.add(sph(0.017 * size / 0.6, 8, 6), dk, { p: [0, -size * 0.06, 0.005], s: [1, 1.4, 1] });
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const y = -size * (0.03 + i * 0.006), kk = size / 0.6;
    b.add(tube([[0, y, 0.004], [s * 0.025 * kk, y + 0.02 * kk, 0.006], [s * 0.05 * kk, y + (i - 1.5) * 0.02 * kk, 0.004], [s * 0.06 * kk, y + (i - 1.5) * 0.035 * kk - 0.015 * kk, 0.002]], 0.0012, 6, 3), dk);
  }
  b.build(); g.add(b.group);
  return g;
}

/* ---------- plants ---------- */
const leafTexCache = new Map<string, THREE.CanvasTexture>();
function leafTex(kind: 'fern' | 'palm' | 'ivy' | 'dead' | 'maple'): THREE.CanvasTexture {
  let t = leafTexCache.get(kind);
  if (t) return t;
  const isFrond = kind === 'fern' || kind === 'palm';
  t = canvasTex(kind === 'ivy' || kind === 'dead' || kind === 'maple' ? 256 : 128, 512, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const R = rng(kind.length * 31);
    if (kind === 'fern' || kind === 'palm') {
      const n = kind === 'fern' ? 26 : 20;
      const base = kind === 'fern' ? [50, 110, 45] : [40, 100, 50];
      // rib
      c.strokeStyle = 'rgb(35,70,30)'; c.lineWidth = kind === 'fern' ? 3 : 4;
      c.beginPath(); c.moveTo(W / 2, H); c.lineTo(W / 2, 4); c.stroke();
      for (let i = 0; i < n; i++) {
        const y = H - 20 - (i / n) * (H - 30);
        const t2 = i / n;
        const len = (kind === 'fern' ? W * 0.5 : W * 0.48) * Math.sin(Math.PI * Math.min(1, 0.25 + t2 * 0.85)) ;
        for (const s of [-1, 1]) {
          const shade = 0.8 + R() * 0.4;
          c.fillStyle = `rgb(${base[0] * shade},${base[1] * shade},${base[2] * shade})`;
          c.beginPath();
          const x0 = W / 2, y0 = y;
          const ang = kind === 'fern' ? -0.5 - t2 * 0.2 : -0.75;
          const ex = x0 + s * len, ey = y0 + Math.sin(ang) * len * 0.5 - 10;
          c.moveTo(x0, y0); c.quadraticCurveTo(x0 + s * len * 0.5, y0 - 12 - t2 * 4, ex, ey);
          c.quadraticCurveTo(x0 + s * len * 0.5, y0 + 6, x0, y0 + 10); c.fill();
        }
      }
    } else if (kind === 'ivy') {
      c.fillStyle = 'rgb(40,90,42)';
      c.beginPath(); c.moveTo(W / 2, H * 0.94);
      c.bezierCurveTo(W * 0.1, H * 0.85, W * 0.02, H * 0.5, W * 0.18, H * 0.4);
      c.bezierCurveTo(W * 0.05, H * 0.3, W * 0.25, H * 0.25, W * 0.35, H * 0.35);
      c.bezierCurveTo(W * 0.32, H * 0.15, W * 0.45, H * 0.08, W / 2, H * 0.03);
      c.bezierCurveTo(W * 0.55, H * 0.08, W * 0.68, H * 0.15, W * 0.65, H * 0.35);
      c.bezierCurveTo(W * 0.75, H * 0.25, W * 0.95, H * 0.3, W * 0.82, H * 0.4);
      c.bezierCurveTo(W * 0.98, H * 0.5, W * 0.9, H * 0.85, W / 2, H * 0.94); c.fill();
      c.strokeStyle = 'rgb(170,200,150)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(W / 2, H * 0.94); c.lineTo(W / 2, H * 0.1);
      for (const s of [-1, 1]) { c.moveTo(W / 2, H * 0.7); c.lineTo(W / 2 + s * W * 0.35, H * 0.5); c.moveTo(W / 2, H * 0.45); c.lineTo(W / 2 + s * W * 0.28, H * 0.33); }
      c.stroke();
    } else if (kind === 'dead') {
      c.fillStyle = 'rgb(96,66,38)';
      c.beginPath(); c.moveTo(W / 2, H * 0.95);
      c.bezierCurveTo(W * 0.05, H * 0.7, W * 0.1, H * 0.3, W * 0.55, H * 0.05);
      c.bezierCurveTo(W * 0.8, H * 0.3, W * 0.95, H * 0.7, W / 2, H * 0.95); c.fill();
      c.strokeStyle = 'rgb(60,40,22)'; c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2, H * 0.95); c.lineTo(W * 0.55, H * 0.1); c.stroke();
      for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(40,25,10,${R() * 0.3})`; c.fillRect(R() * W, R() * H, 6, 6); }
    } else { // maple/oak generic leaf
      c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(W / 2, H * 0.97);
      c.lineTo(W / 2, H * 0.85);
      const pts = [[0.15, 0.8], [0.3, 0.7], [0.05, 0.55], [0.28, 0.5], [0.12, 0.3], [0.35, 0.33], [0.4, 0.05]];
      c.moveTo(W / 2, H * 0.9);
      for (const [x, y] of pts) c.lineTo(W * x, H * y);
      c.lineTo(W / 2, H * 0.02);
      for (const [x, y] of pts.slice().reverse()) c.lineTo(W * (1 - x), H * y);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2, H * 0.95); c.lineTo(W / 2, H * 0.1); c.stroke();
    }
  });
  leafTexCache.set(kind, t);
  return t;
}
const leafMats = new Map<string, THREE.MeshStandardMaterial>();
function leafMat(kind: 'fern' | 'palm' | 'ivy' | 'dead' | 'maple'): THREE.MeshStandardMaterial {
  let m = leafMats.get(kind);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: leafTex(kind), alphaTest: 0.5, side: THREE.DoubleSide, roughness: kind === 'dead' || kind === 'maple' ? 0.95 : 0.6, color: 0xffffff });
    leafMats.set(kind, m);
  }
  return m;
}

/** Curved strip: length L along arc, width W, arcing outward with pitch angle and droop. */
function frondGeometry(L: number, W: number, pitch: number, droop: number, twist = 0, segs = 8): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(W, 1, 2, segs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / W; // -0.5..0.5
    const v = p.getY(i) + 0.5; // 0..1
    const a = pitch + droop * v * v; // angle from vertical toward outward
    // integrate arc: approx position along curve
    const s = v * L;
    const px = Math.sin(pitch) * s + droop * (s * s) * 0.5 / L * Math.cos(pitch) * 1.0;
    const py = Math.cos(pitch) * s - droop * (s * s) * 0.5 / L * Math.sin(pitch) * 0.6;
    // width direction rotates with twist
    const tw = twist * v;
    const wx = Math.cos(tw) * u * W * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, v * 0.9 + 0.1)));
    const wz = Math.sin(tw) * u * W;
    p.setXYZ(i, px + 0 * wx, py, wz * 0 + u * W * Math.cos(0));
    p.setX(i, px);
    p.setZ(i, u * W * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, v * 0.85 + 0.15))) * 1.0);
    // keep width on Z so rotate around Y to fan out
    p.setY(i, py);
    // slight V-fold along the rib
    p.setY(i, py + Math.abs(u) * W * 0.25);
  }
  g.computeVertexNormals();
  return g;
}

const potMat = () => tint('dirt', 0xd8a080, { roughness: 0.85, key: 'terracotta' });
function potBuilder(b: Builder, r: number, h: number, dead = false) {
  const m = dead ? tint('dirt', 0xc0a890, { roughness: 0.95, key: 'deadpot' }) : potMat();
  b.add(smoothLathe([[0.0001, 0], [r * 0.62, 0], [r * 0.7, h * 0.05], [r * 0.9, h * 0.5], [r * 1.0, h * 0.86], [r * 1.12, h * 0.9], [r * 1.14, h * 0.98], [r * 1.02, h], [r * 0.95, h * 0.96]], 24, 4), m);
  b.add(tor(r * 1.06, r * 0.05, 5, 24), m, { p: [0, h * 0.9, 0], r: [Math.PI / 2, 0, 0] });
  b.add(cyl(r * 0.92, r * 0.92, 0.01, 24), 'dirt', { p: [0, h * 0.9, 0] });
  b.add(smoothLathe([[r * 0.55, 0], [r * 0.9, 0.01], [r * 1.2, 0.025], [r * 1.3, 0.04]], 24, 2), m, { p: [0, -0.015, 0], s: [1, 0.8, 1] });
  return h * 0.9;
}

export function plantPot(kind: 'fern' | 'palm' | 'ivy' | 'dead' = 'fern', size = 1, seed = 1): THREE.Group {
  const R = rng(seed * 11 + 5);
  const b = new Builder();
  const g = b.group;
  const potR = kind === 'palm' ? 0.22 : 0.17 * Math.max(0.8, size);
  const potH = kind === 'palm' ? 0.36 : 0.26 * Math.max(0.8, size);
  const soilY = potBuilder(b, potR, potH, kind === 'dead');
  if (kind === 'dead') {
    // crack in pot
    b.add(bx(0.006, potH * 0.6, 0.006), plain(0x1a100a, 1), { p: [potR * 0.75, potH * 0.4, potR * 0.7], r: [0, 0.6, 0.1] });
    // bare twisted branches
    const nb = 7;
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * TAU + R();
      const len = (0.35 + R() * 0.35) * size;
      const pts: V3[] = [[0, soilY, 0], [Math.cos(a) * 0.03, soilY + len * 0.3, Math.sin(a) * 0.03], [Math.cos(a) * len * 0.3, soilY + len * 0.65, Math.sin(a) * len * 0.3], [Math.cos(a + 0.5) * len * 0.5, soilY + len * (0.8 + R() * 0.2), Math.sin(a + 0.5) * len * 0.5]];
      b.add(tube(pts, 0.006 + R() * 0.004, 10, 5), tint('darkWood', 0x9a8c80, { key: 'deadStick' }));
      // twig
      const tp = pts[2];
      b.add(tube([tp, [tp[0] + Math.cos(a + 1.5) * 0.08, tp[1] + 0.05, tp[2] + Math.sin(a + 1.5) * 0.08], [tp[0] + Math.cos(a + 1.5) * 0.16, tp[1] + 0.03, tp[2] + Math.sin(a + 1.5) * 0.16]], 0.003, 8, 4), tint('darkWood', 0x9a8c80, { key: 'deadStick' }));
    }
    b.build();
    // a few curled brown leaves
    const geo = frondGeometry(0.14, 0.08, 0.3, 0.6, 0.2, 5).clone();
    const lm = leafMat('dead');
    for (let i = 0; i < 9; i++) {
      const a = R() * TAU, r = R() * 0.22 * size, hgt = 0.15 + R() * 0.4 * size;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.13, 1, 3), lm);
      m.position.set(Math.cos(a) * r, soilY + hgt, Math.sin(a) * r); m.rotation.set(R() * 1.5, R() * TAU, R() * 1.5);
      m.castShadow = true; g.add(m);
    }
    for (let i = 0; i < 6; i++) { // fallen leaves
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.13, 1, 1), lm);
      const a = R() * TAU, r = potR * 1.4 + R() * 0.2;
      m.position.set(Math.cos(a) * r, 0.004, Math.sin(a) * r); m.rotation.set(-Math.PI / 2, 0, R() * TAU); g.add(m);
    }
    return g;
  }
  if (kind === 'fern') {
    const geos: THREE.BufferGeometry[] = [];
    const n = 20;
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * TAU + R() * 0.3;
      const layer = i % 3;
      const L = (0.45 + R() * 0.3 + layer * 0.06) * size;
      const fg = frondGeometry(L, 0.17 * size, 0.35 + layer * 0.3 + R() * 0.15, 0.9 + R() * 0.5, 0, 8);
      fg.rotateY(yaw); fg.translate(Math.cos(yaw) * 0.02, soilY, Math.sin(yaw) * -0.02);
      geos.push(fg);
    }
    const merged = mergeUV(geos);
    const m = new THREE.Mesh(merged, leafMat('fern')); m.castShadow = true; m.receiveShadow = true; g.add(m);
  } else if (kind === 'palm') {
    // trunk
    const trunkH = 0.9 * size;
    const pts: V3[] = [[0, soilY, 0], [0.03, soilY + trunkH * 0.35, 0.01], [0.05, soilY + trunkH * 0.7, -0.02], [0.02, soilY + trunkH, 0.0]];
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    const tg = new THREE.TubeGeometry(curve, 20, 0.05, 8);
    const pp = tg.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const y = pp.getY(i); const ring = Math.pow(Math.abs(Math.sin(y * 42)), 3);
      const f = 1 + ring * 0.14 - Math.max(0, (y - soilY) / trunkH) * 0.25;
      const c = curve.getPoint(Math.min(1, Math.max(0, (y - soilY) / trunkH)));
      pp.setX(i, c.x + (pp.getX(i) - c.x) * f); pp.setZ(i, c.z + (pp.getZ(i) - c.z) * f);
    }
    tg.computeVertexNormals();
    b.add(tg, tint('darkWood', 0xb09070, { roughness: 0.95, key: 'palmTrunk' }), undefined, { uv: 'box' });
    b.build();
    const top = curve.getPoint(1);
    const geos: THREE.BufferGeometry[] = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * TAU + R() * 0.2;
      const L = (0.75 + R() * 0.25) * size;
      const fg = frondGeometry(L, 0.28 * size, 0.7 + (i % 2) * 0.35 + R() * 0.2, 1.4, 0, 10);
      fg.rotateY(yaw); fg.translate(top.x, top.y, top.z);
      geos.push(fg);
    }
    // upright new frond
    const up = frondGeometry(0.5 * size, 0.16 * size, 0.1, 0.4, 0, 6); up.translate(top.x, top.y, top.z); geos.push(up);
    const m = new THREE.Mesh(mergeUV(geos), leafMat('palm')); m.castShadow = true; m.receiveShadow = true; g.add(m);
  } else { // ivy
    // bamboo trellis stakes with a spiral of vine and hanging strands
    const H = 0.9 * size;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      b.add(cyl(0.007, 0.007, H, 5), tint('darkWood', 0xd0b070, { key: 'bamboo' }), { p: [Math.cos(a) * 0.05, soilY + H / 2, Math.sin(a) * 0.05], r: [Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12] });
    }
    for (let i = 0; i < 3; i++) b.add(tor(0.05 + i * 0.012, 0.004, 4, 16), tint('darkWood', 0xd0b070, { key: 'bamboo' }), { p: [0, soilY + H * (0.3 + i * 0.25), 0], r: [Math.PI / 2, 0, 0] });
    const vines: THREE.Vector3[][] = [];
    const vg: THREE.BufferGeometry[] = [];
    const lm = leafMat('ivy');
    const leaves: [THREE.Vector3, number][] = [];
    for (let v = 0; v < 5; v++) {
      const pts: V3[] = [];
      const a0 = R() * TAU, up2 = v < 3;
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        if (up2) { const a = a0 + t * 9; pts.push([Math.cos(a) * (0.055 + t * 0.01), soilY + t * H * 0.95, Math.sin(a) * (0.055 + t * 0.01)]); }
        else { const a = a0 + t * 1.5; const rr = potR * 1.1 + t * 0.05; pts.push([Math.cos(a) * rr, soilY - t * (0.3 + R() * 0.15) * size, Math.sin(a) * rr]); }
      }
      b.add(tube(pts, 0.0035, 30, 4), tint('moss', 0x606040, { key: 'vine' }));
      pts.forEach((p, k) => { if (k % 1 === 0 && k > 0) leaves.push([new THREE.Vector3(...p), Math.atan2(p[2], p[0])]); });
    }
    b.build();
    const lg = new THREE.PlaneGeometry(0.07, 0.11);
    lg.translate(0, 0.05, 0);
    const im = new THREE.InstancedMesh(lg, lm, leaves.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color(); let n = 0;
    for (const [pos, a] of leaves) for (let k = 0; k < 2; k++) {
      const s = 0.7 + R() * 0.7;
      q.setFromEuler(new THREE.Euler((R() - 0.2) * 1.2, -a + (R() - 0.5) * 2.5, (R() - 0.5) * 1.2));
      sc.set(s, s, s); m4.compose(pos, q, sc); im.setMatrixAt(n, m4);
      col.setHSL(0.3 + R() * 0.04, 0.4 + R() * 0.2, 0.5 + R() * 0.3); im.setColorAt(n, col); n++;
    }
    im.count = n; im.castShadow = true; im.receiveShadow = true; g.add(im);
  }
  b.build();
  return g;
}

function mergeUV(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // ensure same attribute layout (all Plane based); simple merge without groups
  const out = new THREE.BufferGeometry();
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
    const ix = g.index!;
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
    off += p.count;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

/** Hanging basket: origin = ceiling attach point, hangs down ~1.1 m. */
export function hangingPlant(): THREE.Group {
  const R = rng(8);
  const b = new Builder();
  const drop = 0.6;
  // three chains meeting at a ring
  b.add(tor(0.03, 0.006, 5, 12), iron(), { p: [0, -0.02, 0], r: [Math.PI / 2, 0, 0] });
  const bowlR = 0.16, by = -drop - 0.15;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const x = Math.cos(a) * bowlR * 0.95, z = Math.sin(a) * bowlR * 0.95;
    const top = new THREE.Vector3(0, -0.03, 0), bot = new THREE.Vector3(x, by + 0.09, z);
    const len = top.distanceTo(bot);
    const mid = top.clone().add(bot).multiplyScalar(0.5);
    const dir = bot.clone().sub(top).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const link = tor(0.013, 0.0035, 4, 8);
    const nl = Math.floor(len / 0.028);
    for (let k = 0; k < nl; k++) {
      const p = top.clone().lerp(bot, (k + 0.5) / nl);
      const m4 = new THREE.Matrix4().compose(p, q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (k % 2) * Math.PI / 2, 0))), new THREE.Vector3(1, 1.6, 1));
      b.add(link, iron(), m4, { uv: 'keep' });
    }
    b.add(tor(0.02, 0.005, 5, 8), brass(), { p: [x, by + 0.1, z], r: [Math.PI / 2 - 0.3, -a, 0] });
  }
  // bowl
  b.add(smoothLathe([[0.0001, 0], [0.05, 0.0], [0.11, 0.03], [0.15, 0.09], [0.165, 0.14], [0.155, 0.145], [0.14, 0.14]], 24, 4), tint('copper', 0xc09070, { key: 'basket' }), { p: [0, by, 0] });
  b.add(tor(0.165, 0.009, 5, 24), 'copper', { p: [0, by + 0.14, 0], r: [Math.PI / 2, 0, 0] });
  b.add(cyl(0.15, 0.15, 0.01, 20), 'dirt', { p: [0, by + 0.13, 0] });
  const g = b.build();
  // ivy trailing strands + fern fronds
  const vb = new Builder(g);
  const leaves: [THREE.Vector3, number][] = [];
  for (let v = 0; v < 9; v++) {
    const a = (v / 9) * TAU + R() * 0.3;
    const len = 0.35 + R() * 0.5;
    const pts: V3[] = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([Math.cos(a) * (0.17 + t * 0.03 + Math.sin(t * 6 + v) * 0.01), by + 0.12 - t * len - t * t * 0.05, Math.sin(a) * (0.17 + t * 0.03 + Math.sin(t * 5 + v) * 0.01)]); }
    vb.add(tube(pts, 0.003, 20, 4), tint('moss', 0x606040, { key: 'vine' }));
    pts.forEach((p, k) => { if (k > 0) leaves.push([new THREE.Vector3(...p), a]); });
  }
  vb.build();
  const lg = new THREE.PlaneGeometry(0.07, 0.11); lg.translate(0, -0.05, 0);
  const im = new THREE.InstancedMesh(lg, leafMat('ivy'), leaves.length * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color(); let n = 0;
  for (const [pos, a] of leaves) for (let k = 0; k < 2; k++) {
    const s = 0.7 + R() * 0.7;
    q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.8, -a + (R() - 0.5) * 3, (R() - 0.5) * 0.6)); sc.set(s, s, s);
    m4.compose(pos, q, sc); im.setMatrixAt(n, m4);
    col.setHSL(0.3 + R() * 0.04, 0.4 + R() * 0.2, 0.5 + R() * 0.3); im.setColorAt(n, col); n++;
  }
  im.count = n; im.castShadow = true; g.add(im);
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const yaw = (i / 9) * TAU + R() * 0.3;
    const fg = frondGeometry(0.38 + R() * 0.15, 0.16, 0.4 + R() * 0.4, 1.2, 0, 7); fg.rotateY(yaw); fg.translate(0, by + 0.13, 0); geos.push(fg);
  }
  const fm = new THREE.Mesh(mergeUV(geos), leafMat('fern')); fm.castShadow = true; g.add(fm);
  return g;
}

export function leafPile(seed = 1): THREE.Group {
  const R = rng(seed * 7 + 1);
  const g = new THREE.Group();
  const cnt = 320;
  const lg = new THREE.PlaneGeometry(0.15, 0.19); lg.rotateX(-Math.PI / 2); lg.translate(0, 0, -0.02);
  const lm = new THREE.MeshStandardMaterial({ map: leafTex('maple'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, color: 0xffffff });
  const im = new THREE.InstancedMesh(lg, lm, cnt);
  const cols = [0x9a3a12, 0xb8621c, 0xc78a26, 0x7a2a12, 0x8a6a24, 0x5e3a18, 0xa04a1a];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color(), pv = new THREE.Vector3();
  const rad = 0.6;
  for (let i = 0; i < cnt; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * rad;
    const y = 0.005 + Math.pow(1 - r / rad, 1.4) * 0.16 * (0.6 + R() * 0.6);
    pv.set(Math.cos(a) * r * 1.0, y + R() * 0.02, Math.sin(a) * r * 0.85);
    q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.7 + Math.sin(a) * (r / rad) * 0.5, R() * TAU, (R() - 0.5) * 0.7 - Math.cos(a) * (r / rad) * 0.5, 'YXZ'));
    const s = 0.8 + R() * 0.9; sc.set(s, s, s);
    m4.compose(pv, q, sc); im.setMatrixAt(i, m4);
    col.setHex(cols[Math.floor(R() * cols.length)]).offsetHSL(0, 0, (R() - 0.5) * 0.08); im.setColorAt(i, col);
  }
  im.castShadow = im.receiveShadow = true;
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8, 0, TAU, 0, Math.PI / 2), tint('dirt', 0x9a6a3a, { key: 'leafBase' }));
  mound.scale.set(1.15, 0.12, 0.98); mound.position.y = 0; mound.receiveShadow = true;
  g.add(mound, im);
  return g;
}
