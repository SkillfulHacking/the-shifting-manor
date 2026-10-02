import * as THREE from 'three';
import { Builder, archShape, bx, cyl, gilt, iron, brass, lathe, mesh, plain, ringGeo, smoothLathe, sph, tag, tint, tor, TAU, wood, tube, rng, V3, crestShape, MatRef, cupGeo, addCandle, canvasTex } from './util';
import { caseWood } from './clock';

/* ---------- shared bits ---------- */
export function turnedLeg(b: Builder, x: number, z: number, h: number, r: number, m: MatRef = caseWood(), y0 = 0) {
  const k = h;
  b.add(smoothLathe([[r * 0.55, 0], [r * 0.7, 0.02 * k], [r * 1.05, 0.08 * k], [r * 0.7, 0.16 * k], [r * 0.55, 0.3 * k], [r * 0.75, 0.42 * k], [r * 1.0, 0.5 * k], [r * 0.7, 0.58 * k], [r * 0.8, 0.7 * k], [r * 1.05, 0.82 * k], [r * 1.0, 0.9 * k], [r * 1.0, k]], 12, 4), m, { p: [x, y0, z] });
}
export function handle(b: Builder, p: V3, len = 0.1, vertical = false) {
  b.add(tube([[0, 0, 0], [0, 0.02, 0.0], [len / 2, 0.02, 0.0], [len, 0.02, 0], [len, 0, 0]].map(q => [q[0] - len / 2, q[1], q[2] + 0.0] as V3), 0.005, 8, 5), brass(), { p, r: vertical ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0] });
  b.add(sph(0.012, 6, 5), brass(), { p: [p[0] - (vertical ? 0 : len / 2), p[1] + (vertical ? -len / 2 : 0), p[2]], s: [1, 1, 0.5] });
  b.add(sph(0.012, 6, 5), brass(), { p: [p[0] + (vertical ? 0 : len / 2), p[1] + (vertical ? len / 2 : 0), p[2]], s: [1, 1, 0.5] });
}
export function knob(b: Builder, p: V3, r = 0.022) {
  b.add(smoothLathe([[0.006, 0], [0.008, 0.01], [0.007, 0.02], [r, 0.03], [r * 0.9, 0.04], [0.004, 0.046]], 12, 3), brass(), { p, r: [Math.PI / 2, 0, 0] });
}
export function keyEscutcheon(b: Builder, p: V3) {
  b.add(cyl(0.014, 0.014, 0.004, 10), brass(), { p, r: [Math.PI / 2, 0, 0] });
  b.add(bx(0.004, 0.02, 0.005), plain(0x050302, 1), { p: [p[0], p[1] - 0.006, p[2] + 0.002] });
}

/* ---------- bookshelf ---------- */
const bookMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.02 });
const bandMat = new THREE.MeshStandardMaterial({ color: 0xc8a24a, roughness: 0.4, metalness: 0.8 });
const BOOK_COLS = [0x5a1a1a, 0x3a1010, 0x1e3b2a, 0x233a55, 0x4b2c5c, 0x6a4a25, 0x2b2b2b, 0x7a3a20, 0x3d4a2a, 0x8b6a34, 0x1c2a44, 0x5a2a38, 0x40352a, 0x9a8258];

export function bookshelf(width = 2, height = 2.8, depth = 0.38, seed = 1): THREE.Group {
  const R = rng(seed);
  const b = new Builder();
  const w = caseWood();
  const side = 0.035, baseH = 0.12, topH = 0.22;
  const inner = width - side * 2;
  // carcass
  for (const s of [-1, 1]) b.add(bx(side, height - topH, depth, 0.004), w, { p: [s * (width / 2 - side / 2), (height - topH) / 2 + 0.0, 0] });
  b.add(bx(width - 0.02, 0.01, 0.02), w, { p: [0, 0, 0] });
  b.add(bx(width, baseH, depth, 0.005), w, { p: [0, baseH / 2, 0] });
  b.add(bx(width + 0.03, 0.03, depth + 0.03, 0.006), w, { p: [0, baseH + 0.015, 0.0] });
  b.add(bx(inner, height - topH, 0.015), tint('darkWood', 0x705848, { key: 'shBack' }), { p: [0, (height - topH) / 2, -depth / 2 + 0.01] });
  // cornice
  b.add(bx(width + 0.04, 0.05, depth + 0.02, 0.006), w, { p: [0, height - topH + 0.025, 0.0] });
  b.add(bx(width + 0.1, 0.03, depth + 0.07, 0.006), w, { p: [0, height - topH + 0.065, 0.02] });
  const dent = bx(0.025, 0.035, 0.03, 0.004);
  const nd = Math.floor((width + 0.06) / 0.05);
  for (let i = 0; i < nd; i++) b.add(dent, w, { p: [-width / 2 - 0.03 + 0.025 + i * 0.05 + ((width + 0.06) - nd * 0.05) / 2, height - topH + 0.107, depth / 2 + 0.03] });
  b.add(bx(width + 0.13, 0.05, depth + 0.11, 0.008), w, { p: [0, height - topH + 0.15, 0.03] });
  b.add(bx(width + 0.08, 0.04, depth + 0.06, 0.008), w, { p: [0, height - topH + 0.195, 0.025] });
  // gothic arched frieze cutouts on front cornice
  const fr = tint('darkWood', 0x6a5040, { key: 'frieze' });
  const na = Math.max(2, Math.round(width / 0.4));
  for (let i = 0; i < na; i++) {
    const x = -width / 2 + (width * (i + 0.5)) / na;
    b.add(new THREE.ExtrudeGeometry(archShape(width / na - 0.06, 0.13, 0.05), { depth: 0.004, bevelEnabled: false }), fr, { p: [x, height - topH + 0.001, depth / 2 - 0.0] });
  }
  // shelves
  const shelfY: number[] = [];
  const usable = height - topH - baseH - 0.045;
  const nShelves = Math.max(2, Math.round(usable / 0.36));
  const gap = usable / nShelves;
  for (let i = 0; i <= nShelves; i++) {
    const y = baseH + 0.045 + gap * i;
    if (i > 0 && i < nShelves) b.add(bx(inner, 0.025, depth - 0.02, 0.003), w, { p: [0, y, 0.005] });
    if (i < nShelves) shelfY.push(y + (i > 0 ? 0.0125 : 0));
  }
  // mid divider for wide cases
  if (width > 2.2) b.add(bx(0.025, height - topH - baseH - 0.045, depth - 0.02), w, { p: [0, (height - topH + baseH + 0.045) / 2, 0.005] });
  // books
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const bandGeo = new THREE.BoxGeometry(1, 1, 1);
  const cap = 260;
  const books = new THREE.InstancedMesh(geo, bookMat, cap);
  const bands = new THREE.InstancedMesh(bandGeo, bandMat, cap * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
  let n = 0, nb = 0;
  const cells = width > 2.2 ? [[-inner / 2, -0.0125], [0.0125, inner / 2]] : [[-inner / 2, inner / 2]];
  for (const y0 of shelfY) {
    const clear = gap - 0.03;
    for (const [x0, x1] of cells) {
      let x = x0 + 0.01;
      const fillFrac = 0.65 + R() * 0.35;
      const stop = x0 + (x1 - x0) * fillFrac;
      const sparse = R() < 0.18;
      while (x < stop - 0.03 && n < cap - 2) {
        const bw = 0.022 + R() * 0.04, bh = Math.min(clear - 0.02, 0.18 + R() * 0.15), bd = Math.min(depth - 0.08, 0.17 + R() * 0.13);
        const skip = sparse && R() < 0.35;
        if (skip) { x += bw + 0.1; continue; }
        const lean = R() < 0.03 ? (R() < 0.5 ? 1 : -1) * (0.18 + R() * 0.2) : 0;
        const zBack = -depth / 2 + 0.03;
        pv.set(x + bw / 2 + Math.abs(Math.sin(lean)) * bh / 2 * 0.5, y0 + bh / 2 + 0.002, zBack + bd / 2 + R() * 0.015 + 0.05);
        q.setFromEuler(new THREE.Euler(0, 0, lean));
        sc.set(bw, bh, bd);
        m4.compose(pv, q, sc); books.setMatrixAt(n, m4);
        col.setHex(BOOK_COLS[Math.floor(R() * BOOK_COLS.length)]).offsetHSL((R() - 0.5) * 0.03, 0, (R() - 0.5) * 0.06);
        books.setColorAt(n, col); n++;
        // gilt bands
        const nbnd = R() < 0.7 ? 2 : 0;
        for (let k = 0; k < nbnd && nb < cap * 2; k++) {
          const yy = bh * (0.3 + k * 0.4);
          const off = new THREE.Vector3(0, -bh / 2 + yy, bd / 2).applyQuaternion(q);
          m4.compose(pv.clone().add(off), q, new THREE.Vector3(bw * 1.01, 0.008, 0.004)); bands.setMatrixAt(nb++, m4);
        }
        x += bw + 0.002 + (lean ? bh * Math.abs(Math.sin(lean)) * 0.6 : 0);
        if (R() < 0.05) x += 0.02 + R() * 0.06;
      }
      // a stack lying flat at gaps
      if (R() < 0.5 && stop < x1 - 0.2) {
        let yy = y0 + 0.003;
        const sx = x1 - 0.14 - R() * 0.06;
        for (let k = 0; k < 2 + Math.floor(R() * 3); k++) {
          const bh = 0.03 + R() * 0.02, bw = 0.2 + R() * 0.07, bd = 0.15 + R() * 0.07;
          pv.set(sx + (R() - 0.5) * 0.03, yy + bh / 2, -depth / 2 + 0.05 + bd / 2 + 0.05);
          q.setFromEuler(new THREE.Euler(0, (R() - 0.5) * 0.3, 0)); sc.set(bw, bh, bd);
          m4.compose(pv, q, sc); books.setMatrixAt(n, m4);
          col.setHex(BOOK_COLS[Math.floor(R() * BOOK_COLS.length)]); books.setColorAt(n, col); n++;
          yy += bh;
        }
      }
    }
  }
  books.count = n; bands.count = nb;
  books.instanceMatrix.needsUpdate = true; if (books.instanceColor) books.instanceColor.needsUpdate = true; bands.instanceMatrix.needsUpdate = true;
  books.castShadow = books.receiveShadow = true;
  const g = b.build();
  g.add(books, bands);
  g.userData.bookCount = n;
  return g;
}

/* ---------- tables ---------- */
export function table(w = 1.8, d = 0.9, h = 0.78, style: 'dining' | 'side' | 'desk' = 'dining'): THREE.Group {
  const b = new Builder();
  const wd = caseWood();
  const topT = 0.045;
  if (style === 'dining') {
    // slab with roundover + moulded apron + turned legs + stretcher
    b.add(bx(w, topT, d, 0.018), wd, { p: [0, h - topT / 2, 0] });
    b.add(bx(w - 0.06, 0.012, d - 0.06, 0.004), tint('darkWood', 0xb09070, { key: 'inlay' }), { p: [0, h + 0.0, 0] });
    const ah = 0.11, ai = 0.08;
    b.add(bx(w - ai * 2, ah, 0.025, 0.004), wd, { p: [0, h - topT - ah / 2, d / 2 - ai] });
    b.add(bx(w - ai * 2, ah, 0.025, 0.004), wd, { p: [0, h - topT - ah / 2, -d / 2 + ai] });
    b.add(bx(0.025, ah, d - ai * 2, 0.004), wd, { p: [w / 2 - ai, h - topT - ah / 2, 0] });
    b.add(bx(0.025, ah, d - ai * 2, 0.004), wd, { p: [-w / 2 + ai, h - topT - ah / 2, 0] });
    // scalloped drop on apron
    for (const sz of [-1, 1]) for (let i = -1; i <= 1; i++) b.add(sph(0.035, 8, 6), wd, { p: [i * w * 0.22, h - topT - ah - 0.005, sz * (d / 2 - ai)], s: [1.3, 1, 0.5] });
    const lr = 0.038, lh = h - topT - 0.01;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      turnedLeg(b, sx * (w / 2 - ai), sz * (d / 2 - ai), lh, lr);
      b.add(bx(0.09, 0.09, 0.09, 0.005), wd, { p: [sx * (w / 2 - ai), h - topT - 0.05, sz * (d / 2 - ai)] });
    }
    b.add(cyl(0.02, 0.02, w - ai * 2 - 0.1, 10), wd, { p: [0, 0.17, 0], r: [0, 0, Math.PI / 2] });
    b.add(bx(0.03, 0.05, d - ai * 2 - 0.1, 0.005), wd, { p: [w / 2 - ai, 0.17, 0] });
    b.add(bx(0.03, 0.05, d - ai * 2 - 0.1, 0.005), wd, { p: [-w / 2 + ai, 0.17, 0] });
  } else if (style === 'side') {
    b.add(bx(w, 0.035, d, 0.014), wd, { p: [0, h - 0.0175, 0] });
    b.add(bx(w - 0.06, 0.09, d - 0.06, 0.006), wd, { p: [0, h - 0.08, 0] });
    // drawer front
    b.add(bx(w * 0.7, 0.07, 0.012, 0.004), tint('darkWood', 0x8a6a50, { key: 'drawerFront' }), { p: [0, h - 0.08, d / 2 - 0.03 + 0.01] });
    knob(b, [0, h - 0.08, d / 2 - 0.02 + 0.01], 0.016);
    // cabriole-ish legs
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - 0.05), z = sz * (d / 2 - 0.05);
      const k = (h - 0.13) / 0.55;
      b.add(smoothLathe([[0.014, 0], [0.024, 0.03 * k], [0.02, 0.08 * k], [0.016, 0.2 * k], [0.028, 0.4 * k], [0.038, 0.55 * k]], 10, 4), wd, { p: [x, 0, z] });
      b.add(sph(0.03, 8, 6), wd, { p: [x, 0.012, z], s: [1, 0.5, 1] });
    }
    b.add(bx(w - 0.16, 0.02, d - 0.16, 0.004), wd, { p: [0, 0.16, 0] });
  } else {
    // desk: pedestals + leather top
    b.add(bx(w, 0.05, d, 0.016), wd, { p: [0, h - 0.025, 0] });
    b.add(bx(w - 0.14, 0.006, d - 0.14), 'leather', { p: [0, h + 0.002, 0] });
    b.add(ringGeo(w - 0.1, d - 0.1, w - 0.14, d - 0.14, 0.004), gilt(), { p: [0, h + 0.004, 0], r: [Math.PI / 2, 0, 0] }, { uv: 'keep' });
    const pw = 0.42;
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - pw / 2 - 0.03);
      b.add(bx(pw, h - 0.12, d - 0.08, 0.008), wd, { p: [x, (h - 0.12) / 2 + 0.1, 0] });
      b.add(bx(pw + 0.03, 0.1, d - 0.05, 0.008), wd, { p: [x, 0.05, 0] });
      const nD = 4, dh = (h - 0.2) / nD;
      for (let i = 0; i < nD; i++) {
        const y = 0.16 + dh * (i + 0.5);
        b.add(bx(pw - 0.06, dh - 0.02, 0.012, 0.004), tint('darkWood', 0x8a6a50, { key: 'drawerFront' }), { p: [x, y, d / 2 - 0.04 + 0.008] });
        b.add(bx(pw - 0.1, dh - 0.06, 0.004), plain(0x2a1a10, 0.8), { p: [x, y, d / 2 - 0.04 + 0.016] });
        knob(b, [x, y, d / 2 - 0.02], 0.016);
      }
    }
    // modesty panel + center drawer
    b.add(bx(w - pw * 2 - 0.1, 0.5, 0.02), wd, { p: [0, 0.4, -d / 2 + 0.06] });
    b.add(bx(w - pw * 2 - 0.1, 0.09, 0.02, 0.004), tint('darkWood', 0x8a6a50, { key: 'drawerFront' }), { p: [0, h - 0.1, d / 2 - 0.04 + 0.008] });
    keyEscutcheon(b, [0, h - 0.1, d / 2 - 0.02]);
  }
  return b.build();
}

/* ---------- chairs ---------- */
export function diningChair(): THREE.Group {
  const b = new Builder();
  const wd = caseWood();
  const sh = 0.46, sw = 0.46, sd = 0.44;
  // seat: frame + cushion
  b.add(bx(sw, 0.05, sd, 0.008), wd, { p: [0, sh - 0.03, 0] });
  b.add(bx(sw - 0.03, 0.055, sd - 0.03, 0.02), 'leather', { p: [0, sh + 0.0, 0.005] });
  // stud line
  for (let i = 0; i < 9; i++) { const t = i / 8; b.add(sph(0.007, 5, 4), brass(), { p: [-sw / 2 + 0.03 + (sw - 0.06) * t, sh - 0.01, sd / 2 - 0.006] }); }
  // legs: front turned, back raked
  for (const sx of [-1, 1]) {
    turnedLeg(b, sx * (sw / 2 - 0.03), sd / 2 - 0.03, sh - 0.05, 0.022);
    b.add(bx(0.045, sh - 0.03, 0.04, 0.006), wd, { p: [sx * (sw / 2 - 0.03), (sh - 0.03) / 2, -sd / 2 + 0.04], r: [-0.06, 0, 0] });
    // back post continuing up
    b.add(bx(0.04, 0.6, 0.035, 0.006), wd, { p: [sx * (sw / 2 - 0.03), sh + 0.3, -sd / 2 + 0.02 - 0.03], r: [-0.1, 0, 0] });
    b.add(smoothLathe([[0.015, 0], [0.02, 0.02], [0.012, 0.04], [0.016, 0.06], [0.0001, 0.09]], 8, 2), wd, { p: [sx * (sw / 2 - 0.03), sh + 0.6, -sd / 2 + 0.02 - 0.06] , r: [-0.1, 0, 0] });
  }
  // stretchers
  b.add(cyl(0.012, 0.012, sw - 0.06, 8), wd, { p: [0, 0.16, sd / 2 - 0.03], r: [0, 0, Math.PI / 2] });
  b.add(cyl(0.012, 0.012, sw - 0.06, 8), wd, { p: [0, 0.16, -sd / 2 + 0.05], r: [0, 0, Math.PI / 2] });
  b.add(cyl(0.012, 0.012, sd - 0.08, 8), wd, { p: [sw / 2 - 0.03, 0.2, 0], r: [Math.PI / 2, 0, 0] });
  b.add(cyl(0.012, 0.012, sd - 0.08, 8), wd, { p: [-sw / 2 + 0.03, 0.2, 0], r: [Math.PI / 2, 0, 0] });
  // gothic back splat with tracery
  const bs = archShape(sw - 0.1, 0.5, 0.2);
  const hole = new THREE.Path(); hole.absarc(0, 0.34, 0.06, 0, TAU, true);
  bs.holes.push(hole);
  const hole2 = archShape(0.09, 0.16, 0.05).getPoints(4).map(p => new THREE.Vector2(p.x - 0.09, p.y + 0.06));
  const hole3 = archShape(0.09, 0.16, 0.05).getPoints(4).map(p => new THREE.Vector2(p.x + 0.09, p.y + 0.06));
  bs.holes.push(new THREE.Path(hole2.reverse()), new THREE.Path(hole3.reverse()));
  b.add(new THREE.ExtrudeGeometry(bs, { depth: 0.022, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 6 }), wd, { p: [0, sh + 0.11, -sd / 2 + 0.0], r: [-0.1, 0, 0] });
  b.add(bx(sw - 0.02, 0.04, 0.03, 0.008), wd, { p: [0, sh + 0.09, -sd / 2 - 0.0], r: [-0.1, 0, 0] });
  return b.build();
}

export function armchair(colour: 'red' | 'green' = 'red'): THREE.Group {
  const b = new Builder();
  const fab = colour === 'red' ? 'velvetRed' : 'velvetGreen';
  const wd = caseWood();
  const W = 0.86, D = 0.85;
  // legs (short turned) + rails
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turnedLeg(b, sx * (W / 2 - 0.06), sz * (D / 2 - 0.07), 0.16, 0.03, wd);
  b.add(bx(W - 0.04, 0.05, D - 0.06, 0.01), wd, { p: [0, 0.17, 0] });
  // seat base + cushion
  b.add(bx(W - 0.06, 0.16, D - 0.1, 0.05), fab, { p: [0, 0.28, 0.02] });
  b.add(bx(W - 0.26, 0.13, D - 0.24, 0.06), fab, { p: [0, 0.42, 0.06] });
  // arms with rolled scroll top
  for (const s of [-1, 1]) {
    b.add(bx(0.15, 0.36, D - 0.16, 0.05), fab, { p: [s * (W / 2 - 0.09), 0.46, 0.0] });
    b.add(cyl(0.085, 0.085, D - 0.14, 14), fab, { p: [s * (W / 2 - 0.09), 0.66, 0.0], r: [Math.PI / 2, 0, 0] });
    b.add(sph(0.086, 12, 8), fab, { p: [s * (W / 2 - 0.09), 0.66, D / 2 - 0.07], s: [1, 1, 0.35] });
    b.add(cyl(0.055, 0.055, 0.02, 12), brass(), { p: [s * (W / 2 - 0.09), 0.66, D / 2 - 0.045], r: [Math.PI / 2, 0, 0] });
  }
  // back: tall with wings
  b.add(bx(W - 0.1, 0.72, 0.2, 0.07), fab, { p: [0, 0.72, -D / 2 + 0.14], r: [-0.12, 0, 0] });
  for (const s of [-1, 1]) {
    b.add(bx(0.13, 0.5, 0.36, 0.05), fab, { p: [s * (W / 2 - 0.15), 0.98, -D / 2 + 0.24], r: [-0.06, s * -0.14, 0] });
  }
  b.add(sph(0.36, 14, 8), fab, { p: [0, 1.06, -D / 2 + 0.12], s: [1.1, 0.42, 0.34], r: [-0.12, 0, 0] });
  // tufting buttons
  const btn = sph(0.014, 6, 5);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    if (r === 2 && (c === 0 || c === 3)) continue;
    const x = -0.24 + c * 0.16 + (r % 2 ? 0.08 : 0) - (r % 2 ? 0.08 : 0);
    b.add(btn, plain(0x120808, 0.4, 0.2), { p: [x, 0.68 + r * 0.14, -D / 2 + 0.235 - r * 0.014] });
  }
  // nailhead trim on front base
  for (let i = 0; i < 12; i++) b.add(sph(0.008, 5, 4), brass(), { p: [-W / 2 + 0.08 + i * (W - 0.16) / 11, 0.23, D / 2 - 0.02 ], s: [1, 1, 0.6] });
  return b.build();
}

export function sofa(): THREE.Group {
  const b = new Builder();
  const fab = 'velvetRed' as const;
  const wd = caseWood();
  const W = 2.1, D = 0.92;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(smoothLathe([[0.03, 0], [0.04, 0.03], [0.05, 0.07], [0.04, 0.1], [0.045, 0.14]], 12, 3), wd, { p: [sx * (W / 2 - 0.09), 0, sz * (D / 2 - 0.09)] });
  }
  b.add(bx(W - 0.04, 0.22, D - 0.04, 0.06), fab, { p: [0, 0.25, 0] });
  // seat cushions
  for (let i = 0; i < 3; i++) {
    const cw = (W - 0.6) / 3;
    b.add(bx(cw - 0.01, 0.13, D - 0.3, 0.05), fab, { p: [-(W - 0.6) / 2 + cw / 2 + i * cw + 0.0, 0.42, 0.1] });
  }
  // back w/ tufting
  b.add(bx(W, 0.62, 0.22, 0.07), fab, { p: [0, 0.68, -D / 2 + 0.11] , r: [-0.06, 0, 0] });
  b.add(cyl(0.11, 0.11, W - 0.02, 16), fab, { p: [0, 0.99, -D / 2 + 0.1], r: [0, 0, Math.PI / 2] });
  const btn = sph(0.014, 6, 5);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 11; c++) {
    const x = -0.9 + c * 0.18 + (r % 2 ? 0.09 : 0);
    if (x > 0.93) continue;
    b.add(btn, plain(0x140808, 0.4, 0.2), { p: [x, 0.5 + r * 0.16, -D / 2 + 0.225 - 0.006 * r] });
  }
  // rolled arms
  for (const s of [-1, 1]) {
    b.add(bx(0.24, 0.42, D - 0.05, 0.08), fab, { p: [s * (W / 2 - 0.12), 0.46, 0.0] });
    b.add(cyl(0.13, 0.13, D - 0.05, 16), fab, { p: [s * (W / 2 - 0.12), 0.68, 0], r: [Math.PI / 2, 0, 0] });
    b.add(cyl(0.11, 0.11, 0.03, 16), fab, { p: [s * (W / 2 - 0.12), 0.68, D / 2 - 0.02], r: [Math.PI / 2, 0, 0] });
    b.add(cyl(0.06, 0.06, 0.012, 12), brass(), { p: [s * (W / 2 - 0.12), 0.68, D / 2 + 0.0], r: [Math.PI / 2, 0, 0] });
  }
  for (let i = 0; i < 16; i++) b.add(sph(0.008, 5, 4), brass(), { p: [-W / 2 + 0.3 + i * (W - 0.6) / 15, 0.2, D / 2 - 0.006], s: [1, 1, 0.6] });
  return b.build();
}

export function deskWithLamp(): THREE.Group {
  const g = table(1.4, 0.7, 0.76, 'desk');
  const b = new Builder(g);
  const h = 0.76;
  // banker's lamp
  b.add(smoothLathe([[0.0001, 0], [0.06, 0], [0.065, 0.008], [0.05, 0.02], [0.02, 0.035], [0.012, 0.06], [0.012, 0.3]], 20, 4), brass(), { p: [-0.5, h + 0.005, -0.15] });
  b.add(tube([[0, 0, 0], [0, 0.03, 0], [0.04, 0.05, 0]], 0.004, 6, 4), brass(), { p: [-0.5, h + 0.28, -0.15] });
  const shade = new THREE.CylinderGeometry(0.075, 0.075, 0.28, 20, 1, true, -Math.PI * 0.5, Math.PI);
  b.add(shade, new THREE.MeshStandardMaterial({ color: 0x1e5a3a, roughness: 0.15, metalness: 0.0, emissive: 0x0a2a14, emissiveIntensity: 0.6, side: THREE.DoubleSide }), { p: [-0.5, h + 0.34, -0.15], r: [0, Math.PI / 2, Math.PI / 2] , s: [1, 1, 1] }, { uv: 'keep' });
  // inkwell & quill
  b.add(smoothLathe([[0.0001, 0], [0.04, 0], [0.042, 0.02], [0.03, 0.035], [0.018, 0.04], [0.018, 0.05], [0.0001, 0.05]], 14, 2), 'silver', { p: [0.35, h + 0.005, 0.0] });
  b.add(tube([[0, 0, 0], [0.02, 0.1, 0.01], [0.06, 0.17, 0.02], [0.1, 0.19, 0.03]], 0.0025, 8, 4), 'bone', { p: [0.35, h + 0.05, 0.0] });
  b.add(new THREE.PlaneGeometry(0.11, 0.028), 'paper', { p: [0.42, h + 0.235, 0.05], r: [0, 0, 0.5] });
  // papers, blotter, books
  for (let i = 0; i < 3; i++) b.add(bx(0.3, 0.003, 0.22), 'paper', { p: [0.0 + i * 0.008, h + 0.01 + i * 0.003, 0.1 - i * 0.01], r: [0, 0.1 + i * 0.12, 0] });
  b.add(bx(0.2, 0.05, 0.14, 0.006), plain(0x3a1a18, 0.7), { p: [-0.2, h + 0.03, -0.18], r: [0, 0.2, 0] });
  b.add(bx(0.19, 0.03, 0.13, 0.006), plain(0x1e3b2a, 0.7), { p: [-0.2, h + 0.07, -0.18], r: [0, -0.05, 0] });
  b.build();
  const flameAnchor = new THREE.Vector3(-0.5, h + 0.34, -0.15);
  return tag(g, { lampAnchor: flameAnchor });
}

/* ---------- upright piano ---------- */
export function pianoUpright(): THREE.Group {
  const b = new Builder();
  const wd = tint('darkWood', 0x8a6650, { roughness: 0.32, key: 'piano' });
  const W = 1.5, D = 0.62, H = 1.3;
  b.add(bx(W, H - 0.28, D - 0.1, 0.01), wd, { p: [0, 0.28 + (H - 0.28) / 2, -0.05] });
  // top lid
  b.add(bx(W + 0.06, 0.04, D + 0.04, 0.012), wd, { p: [0, H + 0.02, 0.0] });
  b.add(bx(W + 0.02, 0.03, D, 0.008), wd, { p: [0, H - 0.02, 0.0] });
  // key bed & keyslip
  b.add(bx(W - 0.1, 0.06, 0.32, 0.008), wd, { p: [0, 0.74, D / 2 - 0.08] });
  b.add(bx(W - 0.1, 0.04, 0.03, 0.006), wd, { p: [0, 0.79, D / 2 - 0.045] });
  for (const s of [-1, 1]) b.add(bx(0.1, 0.16, 0.34, 0.01), wd, { p: [s * (W / 2 - 0.05), 0.78, D / 2 - 0.08] });
  // lower panel with carved arch panels, legs
  b.add(bx(W, 0.46, 0.5, 0.01), wd, { p: [0, 0.35, -0.02] });
  const panel = tint('darkWood', 0x6c4c3a, { roughness: 0.4, key: 'pianoPanel' });
  for (let i = 0; i < 3; i++) b.add(new THREE.ExtrudeGeometry(archShape(0.4, 0.34, 0.12), { depth: 0.01, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 }), panel, { p: [(i - 1) * 0.47, 0.22, 0.23] });
  for (const s of [-1, 1]) {
    b.add(bx(0.08, 0.28, 0.08, 0.008), wd, { p: [s * (W / 2 - 0.05), 0.14, D / 2 - 0.1] });
    b.add(bx(0.08, 0.28, 0.08, 0.008), wd, { p: [s * (W / 2 - 0.05), 0.14, -D / 2 + 0.06] });
  }
  b.add(bx(W, 0.03, D - 0.1, 0.006), wd, { p: [0, 0.03, -0.03] });
  // music desk + fretwork panel
  b.add(bx(0.9, 0.36, 0.015), panel, { p: [0, 1.0, D / 2 - 0.22], r: [-0.22, 0, 0] });
  b.add(bx(0.9, 0.02, 0.06), wd, { p: [0, 0.84, D / 2 - 0.16] });
  b.add(new THREE.PlaneGeometry(0.3, 0.2), 'paper', { p: [0, 1.05, D / 2 - 0.21], r: [-0.22 + 0.0, 0, 0.0] });
  // candle brackets
  for (const s of [-1, 1]) {
    b.add(tube([[0, 0, 0], [s * 0.06, 0.0, 0.05], [s * 0.1, 0.03, 0.09]], 0.006, 8, 5), brass(), { p: [s * 0.55, 1.0, D / 2 - 0.22] });
    b.add(cupGeo(0.025), brass(), { p: [s * 0.65, 1.03, D / 2 - 0.13] });
  }
  // pedals
  for (let i = -1; i <= 1; i += 2) b.add(bx(0.03, 0.01, 0.07, 0.004), brass(), { p: [i * 0.06, 0.04, D / 2 - 0.02] });
  b.add(cyl(0.005, 0.005, 0.2, 5), brass(), { p: [0, 0.14, D / 2 - 0.16] });
  const g = b.build();
  // keys (instanced)
  const nWhite = 52, kw = (W - 0.22) / nWhite;
  const wk = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xe9e0c8, roughness: 0.4 }), nWhite);
  const bk = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.35 }), 40);
  const m4 = new THREE.Matrix4(); let nb = 0;
  const pat = [1, 1, 0, 1, 1, 1, 0]; // black key after white index in octave (C D E F G A B: after C, D, F, G, A)
  const seq = [1, 1, 0, 1, 1, 1, 0];
  for (let i = 0; i < nWhite; i++) {
    const x = -(W - 0.22) / 2 + kw * (i + 0.5);
    m4.compose(new THREE.Vector3(x, 0.785, D / 2 - 0.02 + 0.0), new THREE.Quaternion(), new THREE.Vector3(kw - 0.002, 0.02, 0.15)); wk.setMatrixAt(i, m4);
    if (seq[(i + 5) % 7] && i < nWhite - 1 && nb < 40) {
      m4.compose(new THREE.Vector3(x + kw / 2, 0.803, D / 2 - 0.02 - 0.03), new THREE.Quaternion(), new THREE.Vector3(kw * 0.55, 0.02, 0.09)); bk.setMatrixAt(nb++, m4);
    }
  }
  bk.count = nb; wk.castShadow = bk.castShadow = true; wk.receiveShadow = bk.receiveShadow = true;
  g.add(wk, bk);
  // stool
  const sb = new Builder();
  sb.add(bx(0.55, 0.07, 0.3, 0.025), 'leather', { p: [0, 0.5, 0.95] });
  sb.add(bx(0.5, 0.04, 0.26, 0.01), wd, { p: [0, 0.46, 0.95] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turnedLeg(sb, sx * 0.22, 0.95 + sz * 0.1, 0.45, 0.022, wd);
  sb.build(); g.add(...sb.group.children.splice(0));
  return g;
}
