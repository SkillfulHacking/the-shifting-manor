import * as THREE from 'three';
import { Builder, archShape, bx, cyl, gilt, iron, brass, lathe, mesh, plain, ringGeo, smoothLathe, sph, tag, tint, tor, TAU, wood, tube, rng, V3, canvasTex, cupGeo, smoothSeams, crestShape } from './util';
import { caseWood } from './clock';

/* ---------- Suit of armor ---------- */
export function suitOfArmor(): THREE.Group {
  const b = new Builder();
  const steel = tint('silver', 0x8f949c, { roughness: 0.4, metalness: 0.6, key: 'steel' });
  const dark = tint('ironBlack', 0xffffff, { key: 'ironB' });
  const trim = brass();
  // plinth
  b.add(bx(0.62, 0.05, 0.62, 0.008), 'stoneWall', { p: [0, 0.025, 0] });
  b.add(bx(0.54, 0.09, 0.54, 0.008), 'stoneWall', { p: [0, 0.095, 0] });
  b.add(bx(0.6, 0.03, 0.6, 0.008), 'marble', { p: [0, 0.155, 0] });
  const y0 = 0.17;
  for (const s of [-1, 1]) {
    const x = s * 0.1;
    // sabaton (pointed foot)
    b.add(smoothLathe([[0.0001, 0], [0.04, 0], [0.05, 0.03], [0.04, 0.07], [0.0001, 0.08]], 10, 2), steel, { p: [x, y0, 0.085], r: [Math.PI / 2, 0, 0] , s: [1, 1.5, 1] });
    b.add(bx(0.09, 0.05, 0.16, 0.015), steel, { p: [x, y0 + 0.03, 0.02] });
    for (let i = 0; i < 3; i++) b.add(bx(0.096, 0.012, 0.03, 0.004), steel, { p: [x, y0 + 0.05, 0.04 + i * 0.035 ] });
    // greave
    b.add(smoothLathe([[0.045, 0], [0.058, 0.1], [0.07, 0.22], [0.06, 0.36], [0.065, 0.42]], 14, 3), steel, { p: [x, y0 + 0.05, -0.005] });
    b.add(bx(0.03, 0.4, 0.014, 0.005), steel, { p: [x, y0 + 0.25, 0.058] });
    // poleyn (knee)
    b.add(sph(0.062, 12, 8), steel, { p: [x, y0 + 0.5, 0.01], s: [1, 0.85, 1] });
    b.add(new THREE.ConeGeometry(0.03, 0.08, 6), steel, { p: [x + s * 0.06, y0 + 0.5, 0.01], r: [0, 0, -s * Math.PI / 2] });
    // cuisse
    b.add(smoothLathe([[0.062, 0], [0.075, 0.12], [0.085, 0.3], [0.08, 0.36]], 14, 3), steel, { p: [x, y0 + 0.5, 0.01] });
  }
  // faulds (skirt of lames)
  for (let i = 0; i < 5; i++) b.add(smoothLathe([[0.15 + i * 0.008, 0], [0.19 + i * 0.008, -0.05]], 20, 1), steel, { p: [0, y0 + 0.9 - i * 0.048 + 0.0, 0.0], s: [1.05, 1, 0.8] });
  // tasset plates
  for (const s of [-1, 1]) b.add(bx(0.08, 0.22, 0.02, 0.008), steel, { p: [s * 0.11, y0 + 0.72, 0.16], r: [0.15, 0, s * 0.1] });
  // breastplate (bulged lathe) with ridge
  const bp = smoothLathe([[0.14, 0], [0.155, 0.08], [0.17, 0.16], [0.19, 0.24], [0.17, 0.3], [0.13, 0.34]], 22, 3);
  b.add(bp, steel, { p: [0, y0 + 0.9, 0], s: [1.1, 1, 0.78] });
  b.add(new THREE.ConeGeometry(0.03, 0.32, 4), steel, { p: [0, y0 + 1.06, 0.15], r: [0.12, Math.PI / 4, 0], s: [0.5, 1, 1] });
  b.add(tor(0.13, 0.008, 4, 20), trim, { p: [0, y0 + 0.88, 0], r: [Math.PI / 2, 0, 0], s: [1.1, 0.8, 1] });
  // gorget
  b.add(smoothLathe([[0.09, 0], [0.11, 0.03], [0.12, 0.07]], 16, 2), steel, { p: [0, y0 + 1.22, 0] });
  // pauldrons
  for (const s of [-1, 1]) {
    const x = s * 0.235;
    for (let k = 0; k < 3; k++) b.add(new THREE.SphereGeometry(0.1 - k * 0.006, 14, 8, 0, TAU, 0, Math.PI * 0.5), steel, { p: [x, y0 + 1.19 - k * 0.04, 0], r: [0, 0, s * 0.25], s: [1, 0.6, 1] });
    b.add(sph(0.014, 6, 5), trim, { p: [x + s * 0.02, y0 + 1.26, 0.07] });
    // upper arm, elbow, forearm, gauntlet
    b.add(cyl(0.045, 0.04, 0.24, 12), steel, { p: [x + s * 0.02, y0 + 1.03, 0.0], r: [0, 0, s * 0.06] });
    b.add(sph(0.045, 10, 8), steel, { p: [x + s * 0.035, y0 + 0.9, 0.0] });
    b.add(cyl(0.04, 0.032, 0.24, 12), steel, { p: [x + s * 0.045, y0 + 0.77, 0.04], r: [-0.25, 0, s * 0.05] });
    b.add(bx(0.06, 0.09, 0.04, 0.012), steel, { p: [x + s * 0.05, y0 + 0.62, 0.09] });
    for (let f = 0; f < 4; f++) b.add(cyl(0.007, 0.007, 0.06, 5), steel, { p: [x + s * 0.05 + (f - 1.5) * 0.013, y0 + 0.58, 0.1], r: [0.3, 0, 0] });
  }
  // helmet: bascinet with visor and plume
  const hy = y0 + 1.34;
  b.add(smoothLathe([[0.0001, -0.06], [0.07, -0.05], [0.095, 0.0], [0.105, 0.06], [0.098, 0.12], [0.07, 0.17], [0.03, 0.2], [0.0001, 0.21]], 20, 3), steel, { p: [0, hy, 0.0], s: [0.92, 1, 1.05] });
  // visor (pointed snout) and slit
  b.add(new THREE.ConeGeometry(0.07, 0.11, 8, 1, false), steel, { p: [0, hy + 0.015, 0.105], r: [Math.PI / 2, 0, 0], s: [1, 1, 1.2] });
  b.add(bx(0.13, 0.014, 0.05), plain(0x030303, 1), { p: [0, hy + 0.045, 0.112] });
  for (let i = 0; i < 5; i++) b.add(cyl(0.004, 0.004, 0.014, 5), plain(0x030303, 1), { p: [-0.04 + i * 0.02, hy - 0.03, 0.13], r: [Math.PI / 2, 0, 0] });
  b.add(tor(0.098, 0.006, 4, 22), trim, { p: [0, hy + 0.06, 0], r: [Math.PI / 2, 0, 0] });
  b.add(bx(0.014, 0.05, 0.18, 0.004), steel, { p: [0, hy + 0.2, 0], r: [0, 0, 0] });
  // plume
  b.add(smoothLathe([[0.0001, 0], [0.015, 0.02], [0.02, 0.06], [0.012, 0.11], [0.0001, 0.15]], 8, 2), plain(0x6a1218, 0.9), { p: [0, hy + 0.2, -0.05], r: [-0.9, 0, 0], s: [1, 1.4, 3] });
  // polearm held in right hand
  b.add(cyl(0.011, 0.011, 2.0, 8), wood(), { p: [-0.29, y0 + 0.95, 0.1] });
  b.add(cyl(0.014, 0.014, 0.06, 8), trim, { p: [-0.29, y0 + 1.94, 0.1] });
  b.add(new THREE.ExtrudeGeometry(crestShape(0.24, 0.24), { depth: 0.008, bevelEnabled: false }), steel, { p: [-0.29 + 0.0, y0 + 1.72, 0.1], r: [0, Math.PI / 2, 0] });
  b.add(new THREE.ConeGeometry(0.02, 0.22, 4), steel, { p: [-0.29, y0 + 2.08, 0.1] });
  // heraldic shield left
  const shield = new THREE.Shape();
  shield.moveTo(-0.11, 0.12); shield.lineTo(0.11, 0.12); shield.lineTo(0.11, -0.02); shield.quadraticCurveTo(0.09, -0.12, 0, -0.18); shield.quadraticCurveTo(-0.09, -0.12, -0.11, -0.02); shield.closePath();
  b.add(new THREE.ExtrudeGeometry(shield, { depth: 0.014, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 1 }), plain(0x4a1218, 0.5, 0.3), { p: [0.3, y0 + 0.88, 0.1], r: [0, -0.5, 0.0] });
  return b.build();
}

/* ---------- Globe ---------- */
export function globe(): THREE.Group {
  const b = new Builder();
  const wd = caseWood();
  const r = 0.22, cy = 0.95;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    b.add(tube([[Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3], [Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2], [Math.cos(a) * 0.05, 0.4, Math.sin(a) * 0.05], [0, 0.65, 0]], 0.014, 16, 6), wd);
    b.add(sph(0.025, 8, 6), brass(), { p: [Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3], s: [1, 0.6, 1] });
  }
  b.add(smoothLathe([[0.0001, 0.6], [0.05, 0.62], [0.055, 0.68], [0.03, 0.72], [0.0001, 0.74]], 12, 2), wd);
  b.add(cyl(0.06, 0.04, 0.08, 14), wd, { p: [0, 0.5, 0] });
  b.add(smoothLathe([[0.0001, 0.7], [0.14, 0.72], [0.19, 0.76], [0.2, 0.8]], 24, 3), wd, { p: [0, 0, 0] }); // bowl beneath
  b.add(cyl(0.2, 0.2, 0.05, 28), wd, { p: [0, 0.665, 0] });
  const g = b.build();
  // globe sphere w/ canvas map
  const map = canvasTex(1024, 512, (c, W, H) => {
    const grd = c.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#c7b788'); grd.addColorStop(1, '#a89665');
    c.fillStyle = '#7d8f8a'; c.fillRect(0, 0, W, H);
    const R = rng(4);
    c.fillStyle = '#b3a06e';
    for (let i = 0; i < 14; i++) {
      let x = R() * W, y = H * (0.15 + R() * 0.7);
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 14; k++) { x += (R() - 0.4) * 60; y += (R() - 0.5) * 50; c.lineTo(x, y); }
      c.closePath(); c.fill();
    }
    c.strokeStyle = 'rgba(50,40,20,0.35)'; c.lineWidth = 1;
    for (let i = 0; i < 24; i++) { c.beginPath(); c.moveTo((i / 24) * W, 0); c.lineTo((i / 24) * W, H); c.stroke(); }
    for (let i = 1; i < 12; i++) { c.beginPath(); c.moveTo(0, (i / 12) * H); c.lineTo(W, (i / 12) * H); c.stroke(); }
    c.fillStyle = 'rgba(30,20,5,0.55)'; c.fillRect(0, 0, W, 22); c.fillRect(0, H - 22, W, 22);
    for (let i = 0; i < 800; i++) { c.fillStyle = `rgba(60,40,10,${R() * 0.06})`; c.fillRect(R() * W, R() * H, 20 * R(), 20 * R()); }
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 24), new THREE.MeshStandardMaterial({ map, roughness: 0.55 }));
  sphere.position.y = cy; sphere.castShadow = sphere.receiveShadow = true; sphere.rotation.z = -0.41;
  sphere.name = 'globeSphere';
  g.add(sphere);
  // Fixed vertical meridian ring (XY plane) on the stand; the tilted axle runs through the globe centre and its ends sit exactly on the ring.
  const R2 = r + 0.035;
  const mb = new Builder();
  mb.add(tor(R2, 0.009, 6, 56), brass(), { p: [0, cy, 0] });
  mb.add(cyl(0.012, 0.012, 0.13, 6), brass(), { p: [0, cy - R2 - 0.065, 0] }); // post from the stand up to the ring
  g.add(mb.build());
  const tilt = 0.41;
  const axle = new Builder();
  axle.add(cyl(0.006, 0.006, 2 * R2, 8), brass(), { p: [0, 0, 0] });
  axle.add(sph(0.016, 8, 6), brass(), { p: [0, R2, 0] });
  axle.add(sph(0.016, 8, 6), brass(), { p: [0, -R2, 0] });
  const pivot = new THREE.Group(); pivot.position.y = cy; pivot.rotation.z = -tilt;
  pivot.add(axle.build());
  g.add(pivot);
  // ring end points of the axle are at angle `tilt` on the circle: shorten so they land on the ring in the XY plane
  return tag(g, { sphere });
}

/* ---------- Gramophone ---------- */
export function gramophone(): THREE.Group {
  const b = new Builder();
  const wd = caseWood();
  b.add(bx(0.42, 0.16, 0.42, 0.012), wd, { p: [0, 0.08, 0] });
  b.add(bx(0.45, 0.02, 0.45, 0.008), wd, { p: [0, 0.17, 0] });
  b.add(bx(0.38, 0.012, 0.38), plain(0x2a3a22, 0.9), { p: [0, 0.182, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(sph(0.02, 8, 6), brass(), { p: [sx * 0.19, 0.01, sz * 0.19], s: [1, 0.6, 1] });
  // crank
  b.add(tube([[0.21, 0.09, 0], [0.26, 0.09, 0], [0.3, 0.09, 0.03], [0.3, 0.09, 0.1]], 0.006, 12, 5), brass());
  b.add(cyl(0.012, 0.012, 0.06, 8), wd, { p: [0.3, 0.09, 0.13], r: [Math.PI / 2, 0, 0] });
  // grille
  for (let i = 0; i < 5; i++) b.add(bx(0.3, 0.008, 0.006), brass(), { p: [0, 0.05 + i * 0.022, 0.212] });
  // record
  b.add(cyl(0.15, 0.15, 0.006, 40), plain(0x0b0b0b, 0.25), { p: [-0.02, 0.192, 0.0] });
  b.add(cyl(0.05, 0.05, 0.007, 20), plain(0x7a1a14, 0.6), { p: [-0.02, 0.194, 0.0] });
  b.add(cyl(0.004, 0.004, 0.03, 6), brass(), { p: [-0.02, 0.2, 0.0] });
  // tone arm
  b.add(tube([[0.14, 0.2, -0.13], [0.11, 0.24, -0.12], [0.05, 0.25, -0.06], [0.0, 0.22, 0.02]], 0.006, 12, 5), brass());
  b.add(bx(0.03, 0.02, 0.04, 0.005), brass(), { p: [0.14, 0.2, -0.13] });
  // elbow/neck up to horn
  b.add(tube([[0.14, 0.2, -0.13], [0.14, 0.32, -0.14], [0.1, 0.45, -0.12], [0.0, 0.55, -0.05], [-0.08, 0.6, 0.05]], 0.02, 24, 8), brass());
  // horn: flared lathe pointing forward-left
  const horn = smoothLathe([[0.02, 0], [0.028, 0.06], [0.045, 0.14], [0.08, 0.22], [0.14, 0.3], [0.22, 0.36], [0.27, 0.38]], 32, 5);
  horn.rotateZ(-Math.PI / 2 * 1.0); // axis to +X
  b.add(horn, tint('brass', 0xffe2b0, { roughness: 0.3, metalness: 0.5, key: 'horn' }), { p: [-0.0, 0.6, 0.05], r: [0, 0.5, 0.15] });
  const g = b.build();
  return tag(g, {});
}

/* ---------- Pedestal & plaque & rugs ---------- */
function drapeGeometry(hw: number, drop: number, folds: number, seed: number): THREE.BufferGeometry {
  const N = 28, ext = hw + drop;
  const g = new THREE.PlaneGeometry(ext * 2, ext * 2, N, N);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const R = rng(seed);
  const ph = R() * TAU;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i);
    const cx = Math.max(-hw, Math.min(hw, x)), cz = Math.max(-hw, Math.min(hw, z));
    const dx = x - cx, dz = z - cz;
    const dd = Math.hypot(dx, dz);
    if (dd > 0) {
      const nx = dx / dd, nz = dz / dd;
      const ang = Math.atan2(nz, nx);
      const f = 1 + 0.5 * Math.sin(folds * ang + ph) * Math.min(1, dd / 0.15);
      const out = Math.min(dd, drop) * 0.04 * f + 0.01 * (dd / drop);
      const fall = dd;
      x = cx + nx * (out + Math.min(0.0, 0));
      z = cz + nz * out;
      p.setXYZ(i, x + nx * 0.03 * Math.min(1, dd / 0.1) * (0.5 + 0.5 * Math.sin(folds * ang + ph)), 0.006 - fall * 1.0 - 0.0, z + nz * 0.03 * Math.min(1, dd / 0.1) * (0.5 + 0.5 * Math.sin(folds * ang + ph)));
    } else p.setXYZ(i, x, 0.006, z);
  }
  g.computeVertexNormals();
  return g;
}

export function pedestal(height = 1.1): THREE.Group {
  const b = new Builder();
  const st = 'stoneWall' as const;
  const bw = 0.5, sw = 0.34;
  b.add(bx(bw, 0.08, bw, 0.01), st, { p: [0, 0.04, 0] });
  b.add(bx(bw - 0.08, 0.07, bw - 0.08, 0.01), st, { p: [0, 0.115, 0] });
  b.add(bx(sw * 1.15, 0.06, sw * 1.15, 0.01), st, { p: [0, 0.2, 0] });
  const sh = height - 0.52;
  b.add(bx(sw, sh, sw, 0.012), st, { p: [0, 0.23 + sh / 2, 0] });
  b.add(bx(bw - 0.08, 0.05, bw - 0.08, 0.008), st, { p: [0, height - 0.26, 0] });
  b.add(bx(bw - 0.04, 0.05, bw - 0.04, 0.008), st, { p: [0, height - 0.21, 0] });
  b.add(bx(bw + 0.04, 0.09, bw + 0.04, 0.012), st, { p: [0, height - 0.13, 0] });
  b.add(bx(bw + 0.08, 0.04, bw + 0.08, 0.01), 'marble', { p: [0, height - 0.065, 0] });
  const g = b.build();
  // fix panel placement: replace the placeholder with panels on four faces
  const pb = new Builder(g);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    pb.add(new THREE.ExtrudeGeometry(archShape(0.18, sh * 0.7, 0.09), { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 }), tint('stoneWall', 0x8d867c, { key: 'pedIn' }), new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeTranslation(0, 0.23 + sh * 0.12, sw / 2 - 0.004)));
  }
  pb.build();
  // cloth draped on top
  const cloth = new THREE.Mesh(drapeGeometry((bw + 0.08) / 2 - 0.03, 0.22, 9, 2), tint('velvetRed', 0xffffff, { key: 'cloth' }));
  cloth.material = (() => { const m = tint('velvetRed', 0xffffff, { key: 'cloth' }).clone(); m.side = THREE.DoubleSide; return m; })();
  cloth.position.y = height + 0.004; cloth.castShadow = cloth.receiveShadow = true;
  g.add(cloth);
  g.userData.topY = height;
  return g;
}

export function brassPlaque(w = 0.3, h = 0.1): THREE.Group {
  const b = new Builder();
  const m = gilt();
  b.add(bx(w, h, 0.008, 0.003), m, { p: [0, 0, 0.004] });
  b.add(ringGeo(w - 0.01, h - 0.01, w - 0.024, h - 0.024, 0.004, 0.0005), tint('brass', 0x8a6a3a, { key: 'plaqueEdge' }), { p: [0, 0, 0.009] }, { uv: 'keep' });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.add(sph(0.005, 6, 5), m, { p: [sx * (w / 2 - 0.012), sy * (h / 2 - 0.012), 0.008], s: [1, 1, 0.6] });
  const g = b.build();
  const tx = canvasTex(256, Math.max(32, Math.round(256 * h / w)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(30,18,4,0.85)';
    const R = rng(Math.round(w * 100 + h * 1000));
    const lines = h > 0.12 ? 3 : 2;
    for (let l = 0; l < lines; l++) {
      let x = W * 0.12; const y = H * (0.3 + (l + 0.5 - lines / 2) * 0.28 + 0.2);
      c.font = `${Math.round(H * 0.16)}px "Times New Roman", serif`;
      const words = ['HIC', 'LOCUS', 'MANET', 'TACITUS', 'ET', 'VIGILAT', 'ANIMA'];
      let s = ''; for (let k = 0; k < 2 + Math.floor(R() * 2); k++) s += words[Math.floor(R() * words.length)] + ' ';
      c.textAlign = 'center'; c.fillText(s.trim(), W / 2, y + H * 0.06);
    }
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.03, h - 0.03), new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0.9, depthWrite: false }));
  label.position.z = 0.0092; label.userData.noShadow = true; g.add(label);
  return g;
}

/** Woven rug texture drawn for this exact size: border bands hug the edge, the field repeats a lattice with medallions. */
export function rugTexture(w: number, d: number, kind: 'red' | 'blue'): THREE.CanvasTexture {
  const ppm = Math.min(150, 1800 / Math.max(w, d));
  const W = Math.round(w * ppm), H = Math.round(d * ppm);
  const pal = kind === 'red'
    ? { base: '#5d1a1c', field: '#7a2423', band: '#1e2442', gold: '#c9a24a', cream: '#d9c9a0', dark: '#2a0d0f' }
    : { base: '#1b2747', field: '#27396a', band: '#5d1a1c', gold: '#c9a24a', cream: '#d9c9a0', dark: '#0e1530' };
  return canvasTex(W, H, (c) => {
    const m = ppm;
    c.fillStyle = pal.base; c.fillRect(0, 0, W, H);
    // weave noise
    for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; c.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1); }
    const bw = Math.min(0.11 * m * 1.4, Math.min(W, H) * 0.09);
    // outer border: dark, gold line, patterned band, gold line
    const ring = (inset: number, thick: number, col: string) => { c.strokeStyle = col; c.lineWidth = thick; c.strokeRect(inset + thick / 2, inset + thick / 2, W - 2 * inset - thick, H - 2 * inset - thick); };
    ring(bw * 0.2, bw * 0.12, pal.gold);
    const bandIn = bw * 0.4, bandW = bw * 0.9;
    c.fillStyle = pal.band; c.fillRect(bandIn, bandIn, W - 2 * bandIn, H - 2 * bandIn);
    // field inside the band
    const fi = bandIn + bandW;
    c.fillStyle = pal.field; c.fillRect(fi, fi, W - 2 * fi, H - 2 * fi);
    ring(bandIn - 2, 3, pal.gold);
    ring(fi - 3, 3, pal.gold);
    // diamonds along the band
    const step = bandW * 1.5;
    c.fillStyle = pal.cream;
    for (let x = bandIn + step / 2; x < W - bandIn; x += step) for (const y of [bandIn + bandW / 2, H - bandIn - bandW / 2]) { c.beginPath(); c.moveTo(x, y - bandW * 0.3); c.lineTo(x + bandW * 0.3, y); c.lineTo(x, y + bandW * 0.3); c.lineTo(x - bandW * 0.3, y); c.fill(); }
    for (let y = bandIn + step / 2; y < H - bandIn; y += step) for (const x of [bandIn + bandW / 2, W - bandIn - bandW / 2]) { c.beginPath(); c.moveTo(x, y - bandW * 0.3); c.lineTo(x + bandW * 0.3, y); c.lineTo(x, y + bandW * 0.3); c.lineTo(x - bandW * 0.3, y); c.fill(); }
    // lattice in the field (clipped)
    c.save(); c.beginPath(); c.rect(fi, fi, W - 2 * fi, H - 2 * fi); c.clip();
    c.strokeStyle = 'rgba(217,201,160,0.28)'; c.lineWidth = 2;
    const cell = 0.55 * m;
    for (let k = -H; k < W + H; k += cell) { c.beginPath(); c.moveTo(fi + k, fi); c.lineTo(fi + k + H, fi + H); c.stroke(); c.beginPath(); c.moveTo(fi + k + H, fi); c.lineTo(fi + k, fi + H); c.stroke(); }
    // medallions down the centre line
    const fw = W - 2 * fi, fh = H - 2 * fi;
    const long = fh >= fw;
    const rad = Math.min(fw, fh) * 0.34;
    const n = Math.max(1, Math.round((long ? fh : fw) / (rad * 2.9)));
    for (let i = 0; i < n; i++) {
      const cx = long ? W / 2 : fi + (fw * (i + 0.5)) / n, cy = long ? fi + (fh * (i + 0.5)) / n : H / 2;
      c.fillStyle = pal.dark; c.beginPath(); c.arc(cx, cy, rad, 0, 7); c.fill();
      c.strokeStyle = pal.gold; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, rad * 0.9, 0, 7); c.stroke();
      c.fillStyle = pal.band; c.beginPath(); c.moveTo(cx, cy - rad * 0.75); c.lineTo(cx + rad * 0.5, cy); c.lineTo(cx, cy + rad * 0.75); c.lineTo(cx - rad * 0.5, cy); c.fill();
      c.fillStyle = pal.gold; c.beginPath(); c.arc(cx, cy, rad * 0.16, 0, 7); c.fill();
      for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283; c.fillStyle = pal.cream; c.beginPath(); c.arc(cx + Math.cos(a) * rad * 0.72, cy + Math.sin(a) * rad * 0.72, rad * 0.05, 0, 7); c.fill(); }
    }
    c.restore();
    // wear
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(30,20,10,${Math.random() * 0.08})`; c.beginPath(); c.arc(Math.random() * W, Math.random() * H, 10 + Math.random() * 40, 0, 7); c.fill(); }
  });
}

export function rugRect(w = 3, d = 2, kind: 'red' | 'blue' = 'red'): THREE.Group {
  const b = new Builder();
  const th = 0.01;
  b.add(bx(w, th, d, 0.0035), plain(kind === 'red' ? 0x5d1a1c : 0x1b2747, 1), { p: [0, th / 2, 0] }, { uv: 'keep' });
  const g0 = b.build();
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: rugTexture(w, d, kind), roughness: 0.96 }));
  top.rotation.x = -Math.PI / 2; top.position.y = th + 0.0015; top.receiveShadow = true;
  g0.add(top);
  const b2 = new Builder(g0);
  b.group = g0;
  // fringe on the short ends (x-ends): along d
  const fr = plain(0xd7c7a2, 0.95);
  const cnt = Math.floor(d / 0.035);
  const fg = bx(0.07, 0.004, 0.008);
  const R = rng(Math.round(w * 10 + d));
  for (const sx of [-1, 1]) for (let i = 0; i < cnt; i++) {
    const z = -d / 2 + 0.02 + (i * (d - 0.04)) / (cnt - 1);
    b2.add(fg, fr, { p: [sx * (w / 2 + 0.03), 0.003, z], r: [0, sx * (R() - 0.5) * 0.25, 0] }, { uv: 'keep' });
  }
  b2.build();
  return g0;
}

/* ---------- Statues / urns / skull ---------- */
function foldedRobe(h: number, r0: number, r1: number, folds: number, seg = 40): THREE.BufferGeometry {
  const pts: [number, number][] = [[0.0001, 0], [r0, 0], [r0 * 0.97, h * 0.08], [(r0 + r1) / 2 * 0.95, h * 0.4], [r1 * 1.12, h * 0.7], [r1, h * 0.88], [r1 * 0.55, h]];
  const g = smoothLathe(pts, seg, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const a = Math.atan2(z, x);
    const t = 1 - y / h;
    const f = 1 + (0.055 * Math.cos(folds * a) + 0.025 * Math.cos(folds * 2.3 * a + 1)) * (0.35 + t * 0.65);
    p.setX(i, x * f); p.setZ(i, z * f);
  }
  return smoothSeams(g);
}

export function statue(pose: 'angel' | 'bust' | 'urn' = 'angel'): THREE.Group {
  const b = new Builder();
  const mb = tint('marble', 0xe9e6e0, { roughness: 0.42, key: 'statue' });
  const base = 'stoneWall' as const;
  if (pose === 'angel') {
    b.add(bx(0.8, 0.12, 0.8, 0.012), base, { p: [0, 0.06, 0] });
    b.add(bx(0.68, 0.14, 0.68, 0.012), base, { p: [0, 0.19, 0] });
    b.add(bx(0.74, 0.05, 0.74, 0.01), 'marble', { p: [0, 0.285, 0] });
    const y0 = 0.31;
    // robe with folds
    b.add(foldedRobe(1.15, 0.36, 0.13, 11), mb, { p: [0, y0, 0] });
    // shoulders & torso cap
    b.add(sph(0.14, 16, 10), mb, { p: [0, y0 + 1.13, 0], s: [1.3, 0.6, 0.8] });
    // hood / cowl
    b.add(smoothLathe([[0.0001, 0], [0.11, 0.0], [0.13, 0.08], [0.11, 0.18], [0.06, 0.24], [0.0001, 0.25]], 16, 3), mb, { p: [0, y0 + 1.16, -0.015], s: [1, 1, 1.1], r: [0.18, 0, 0] });
    // face (inside hood, bowed)
    b.add(sph(0.075, 14, 10), mb, { p: [0, y0 + 1.27, 0.03], s: [0.9, 1.1, 0.95] });
    b.add(cyl(0.008, 0.008, 0.06, 5), mb, { p: [0.0, y0 + 1.28, 0.1], r: [0.1, 0, 0] }); // nose ridge
    // arms folded in prayer
    b.add(tube([[0.15, y0 + 1.1, 0.0], [0.19, y0 + 0.95, 0.06], [0.11, y0 + 0.9, 0.13], [0.02, y0 + 1.0, 0.14]], 0.04, 14, 8), mb);
    b.add(tube([[-0.15, y0 + 1.1, 0.0], [-0.19, y0 + 0.95, 0.06], [-0.11, y0 + 0.9, 0.13], [-0.02, y0 + 1.0, 0.14]], 0.04, 14, 8), mb);
    b.add(sph(0.045, 8, 6), mb, { p: [0, y0 + 1.0, 0.15], s: [1.2, 1.5, 0.8] });
    // wings: fans of flattened feathers sweeping up and outward from the shoulder blades
    const feather = new THREE.CapsuleGeometry(0.032, 1, 2, 6);
    const up = new THREE.Vector3(0, 1, 0);
    for (const s of [-1, 1]) {
      const yaw = 0.55;
      const outward = new THREE.Vector3(s * Math.cos(yaw), 0, -Math.sin(yaw));
      const P = new THREE.Vector3(s * 0.1, y0 + 1.02, -0.13);
      for (let row = 0; row < 3; row++) {
        const n = 9 - row;
        for (let k = 0; k < n; k++) {
          const t = k / (n - 1);
          const phi = 0.08 + t * 1.05;
          const L = (0.98 - 0.55 * Math.pow(t, 1.2)) * (1 - row * 0.28);
          const dir = up.clone().multiplyScalar(Math.cos(phi)).add(outward.clone().multiplyScalar(Math.sin(phi))).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
          const c = P.clone().add(dir.clone().multiplyScalar(L / 2 + 0.03)).add(new THREE.Vector3(0, 0, -0.012 * row));
          const m4 = new THREE.Matrix4().compose(c, q, new THREE.Vector3(1 + row * 0.1, (L - 0.06) / 1.06, 0.3));
          b.add(feather, mb, m4);
        }
      }
      // wing bone arm
      b.add(tube([[P.x, P.y, P.z], [P.x + s * 0.16, P.y + 0.3, P.z - 0.08], [P.x + s * 0.38, P.y + 0.45, P.z - 0.16]], 0.022, 10, 6), mb);
    }
    b.add(tor(0.11, 0.006, 4, 24), mb, { p: [0, y0 + 1.5, -0.03], r: [0.1, 0, 0] });
  } else if (pose === 'bust') {
    b.add(bx(0.4, 0.1, 0.4, 0.01), base, { p: [0, 0.05, 0] });
    b.add(cyl(0.14, 0.16, 0.8, 16), base, { p: [0, 0.5, 0] });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; b.add(cyl(0.009, 0.009, 0.72, 5), tint('stoneWall', 0x6a655d, { key: 'flute' }), { p: [Math.cos(a) * 0.15, 0.5, Math.sin(a) * 0.15] }); }
    b.add(smoothLathe([[0.14, 0.88], [0.17, 0.9], [0.19, 0.93], [0.18, 0.95]], 16, 2), base);
    b.add(bx(0.38, 0.03, 0.38, 0.008), 'marble', { p: [0, 0.965, 0] });
    const y0 = 0.98;
    // bust: chest lathe, neck, head, hair, face features
    b.add(smoothLathe([[0.0001, 0], [0.15, 0.0], [0.19, 0.06], [0.2, 0.12], [0.15, 0.2], [0.07, 0.26], [0.06, 0.3]], 20, 3), mb, { p: [0, y0, 0], s: [1.3, 1, 0.75] });
    b.add(cyl(0.05, 0.06, 0.1, 12), mb, { p: [0, y0 + 0.3, 0] });
    b.add(sph(0.1, 20, 14), mb, { p: [0, y0 + 0.45, 0], s: [0.9, 1.2, 1.0] });
    b.add(sph(0.06, 12, 8), mb, { p: [0, y0 + 0.38, 0.05], s: [1.0, 0.8, 0.9] });   // jaw
    b.add(bx(0.028, 0.07, 0.04, 0.008), mb, { p: [0, y0 + 0.445, 0.098], r: [-0.25, 0, 0] }); // nose
    b.add(sph(0.02, 8, 6), mb, { p: [0, y0 + 0.418, 0.112], s: [1.3, 0.8, 1] });
    for (const s of [-1, 1]) {
      b.add(sph(0.018, 8, 6), tint('marble', 0xbfbcb6, { key: 'socket' }), { p: [s * 0.04, y0 + 0.475, 0.083], s: [1.4, 0.9, 0.6] });
      b.add(bx(0.05, 0.008, 0.02, 0.003), mb, { p: [s * 0.042, y0 + 0.5, 0.088], r: [0, 0, s * 0.15] });
      b.add(sph(0.022, 8, 6), mb, { p: [s * 0.098, y0 + 0.44, 0.0], s: [0.5, 1, 0.7] });
    }
    b.add(bx(0.05, 0.007, 0.015, 0.003), tint('marble', 0xa8a5a0, { key: 'lips' }), { p: [0, y0 + 0.39, 0.092] });
    // hair: tight curls and a laurel wreath
    const R2 = rng(5);
    for (let n = 0; n < 34; n++) {
      const a = R2() * TAU * 0.7 + Math.PI * 0.65 - 0.2 * 0, ph = 0.25 + R2() * 1.0;
      const rx = Math.sin(ph) * Math.cos(a), rz = Math.sin(ph) * Math.sin(a), ry = Math.cos(ph);
      if (rz > 0.55 && ry < 0.5) continue;
      b.add(sph(0.026 + R2() * 0.01, 7, 5), mb, { p: [rx * 0.098, y0 + 0.47 + ry * 0.122, rz * 0.1 - 0.01], s: [1, 1, 1] });
    }
    b.add(tor(0.1, 0.008, 5, 24), mb, { p: [0, y0 + 0.5, 0.0], r: [Math.PI / 2 - 0.12, 0, 0], s: [0.95, 1.05, 1] });
    for (let n = 0; n < 12; n++) { const a = Math.PI * (0.05 + (n / 11) * 0.9); b.add(sph(0.014, 6, 5), mb, { p: [Math.cos(a) * 0.1 * (n % 2 ? 1 : 0.95), y0 + 0.5 - 0.02 + (n % 2) * 0.012, Math.sin(a) * 0.1], s: [1, 0.5, 2] }); }
    // drapery over shoulder
    b.add(tube([[-0.22, y0 + 0.15, 0.06], [-0.1, y0 + 0.24, 0.09], [0.05, y0 + 0.13, 0.11], [0.2, y0 + 0.02, 0.08]], 0.03, 14, 8), mb);
  } else {
    b.add(bx(0.7, 0.1, 0.7, 0.01), base, { p: [0, 0.05, 0] });
    b.add(bx(0.55, 0.5, 0.55, 0.012), base, { p: [0, 0.35, 0] });
    b.add(bx(0.65, 0.06, 0.65, 0.01), 'marble', { p: [0, 0.63, 0] });
    b.add(urnBody(mb, 0.72, 0.45), mb);
    const g = b.build(); (urnHandlesInto(g, mb, 0.72, 0.45)); return g;
  }
  return b.build();
}

function urnBody(m: THREE.Material, y0: number, h: number): THREE.BufferGeometry {
  const pts: [number, number][] = [[0.0001, 0], [0.09, 0], [0.11, 0.03], [0.07, 0.07], [0.09, 0.11], [0.19, 0.2], [0.21, 0.26], [0.17, 0.32], [0.11, 0.36], [0.13, 0.37], [0.14, 0.4], [0.1, 0.42], [0.06, 0.43], [0.045, 0.47], [0.03, 0.5], [0.0001, 0.52]];
  const g = smoothLathe(pts.map(p => [p[0], p[1] * h / 0.52 * 1] as [number, number]), 28, 4);
  g.translate(0, y0, 0);
  return g;
}
function urnHandlesInto(g: THREE.Group, m: THREE.Material, y0: number, h: number) {
  const k = h / 0.52;
  const b = new Builder(g);
  for (const s of [-1, 1]) b.add(tube([[s * 0.2, y0 + 0.23 * k, 0], [s * 0.3, y0 + 0.28 * k, 0], [s * 0.3, y0 + 0.36 * k, 0], [s * 0.14, y0 + 0.37 * k, 0]], 0.018, 16, 6), m);
  b.build();
}

export function urn(seed = 1): THREE.Group {
  const b = new Builder();
  const mb = tint('marble', 0xdcd6cc, { roughness: 0.5, key: 'urn' });
  const R = rng(seed);
  const h = 0.55 + R() * 0.2;
  b.add(bx(0.28, 0.05, 0.28, 0.008), 'stoneWall', { p: [0, 0.025, 0] });
  b.add(urnBody(mb, 0.05, h), mb);
  b.add(tor(0.085, 0.01, 5, 20), mb, { p: [0, 0.16 + 0.05, 0], r: [Math.PI / 2, 0, 0] });
  b.add(tor(0.19, 0.008, 5, 28), mb, { p: [0, 0.05 + h * 0.5, 0], r: [Math.PI / 2, 0, 0] });
  const g = b.build();
  urnHandlesInto(g, mb, 0.05, h);
  return g;
}

export function vase(seed = 1): THREE.Group {
  const R = rng(seed * 3 + 1);
  const b = new Builder();
  const kind = Math.floor(R() * 4);
  const k = 0.85 + R() * 0.5;
  const P: [number, number][][] = [
    [[0.0001, 0], [0.055, 0], [0.08, 0.02], [0.12, 0.12], [0.135, 0.24], [0.1, 0.36], [0.05, 0.44], [0.038, 0.5], [0.05, 0.58], [0.075, 0.62], [0.07, 0.63]],
    [[0.0001, 0], [0.06, 0], [0.09, 0.03], [0.14, 0.14], [0.14, 0.26], [0.09, 0.36], [0.06, 0.4], [0.07, 0.42], [0.065, 0.44]],
    [[0.0001, 0], [0.05, 0], [0.058, 0.03], [0.05, 0.14], [0.034, 0.3], [0.024, 0.4], [0.03, 0.48], [0.04, 0.5], [0.032, 0.5]],
    [[0.0001, 0], [0.07, 0], [0.085, 0.03], [0.09, 0.14], [0.075, 0.24], [0.085, 0.3], [0.1, 0.34], [0.09, 0.34]],
  ];
  const geo = smoothLathe(P[kind].map(p => [p[0] * k, p[1] * k] as [number, number]), 28, 5);
  const col = [0x2d5a7c, 0x8b2f2f, 0x3d6a4a, 0xd8c8a8][Math.floor(R() * 4)];
  const mm = (vaseMats[col] ??= new THREE.MeshStandardMaterial({ color: col, roughness: 0.22, metalness: 0.05 }));
  b.add(geo, mm, undefined, { uv: 'keep' });
  const top = P[kind][P[kind].length - 1][1] * k;
  b.add(tor(P[kind][4][0] * k * 0.9, 0.006, 4, 24), gilt(), { p: [0, P[kind][4][1] * k * 0.6, 0], r: [Math.PI / 2, 0, 0] });
  b.add(tor(P[kind][P[kind].length - 1][0] * k, 0.005, 4, 20), gilt(), { p: [0, top, 0], r: [Math.PI / 2, 0, 0] });
  if (kind === 0) for (const s of [-1, 1]) b.add(tube([[s * 0.04 * k, 0.5 * k, 0], [s * 0.1 * k, 0.5 * k, 0], [s * 0.15 * k, 0.4 * k, 0], [s * 0.128 * k, 0.28 * k, 0]], 0.012 * k, 14, 6), mm, undefined, { uv: 'keep' });
  return b.build();
}
const vaseMats: Record<number, THREE.MeshStandardMaterial> = {};

export function skull(): THREE.Group {
  const b = new Builder();
  const bn = 'bone' as const;
  const dark = plain(0x0a0605, 1);
  const cy = 0.095;
  // cranium (slightly egg-shaped: narrower at the jaw)
  const cr = new THREE.SphereGeometry(1, 28, 20);
  const p = cr.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = y < 0 ? 1 + y * 0.28 : 1;
    p.setXYZ(i, x * f, y, z * (y < -0.3 ? 0.85 : 1));
  }
  smoothSeams(cr);
  b.add(cr, bn, { p: [0, cy, -0.004], s: [0.076, 0.085, 0.098] });
  // brow ridge, cheekbones, temples
  b.add(sph(0.05, 12, 8), bn, { p: [0, cy - 0.008, 0.05], s: [1.05, 0.28, 0.6] });
  for (const s of [-1, 1]) {
    b.add(sph(0.022, 8, 6), bn, { p: [s * 0.049, cy - 0.032, 0.062], s: [0.9, 0.9, 0.9] });
    // eye sockets: recessed dark hollows
    b.add(sph(0.021, 12, 10), dark, { p: [s * 0.032, cy - 0.006, 0.074], s: [1.0, 1.1, 0.7] });
    b.add(tor(0.021, 0.005, 5, 14), bn, { p: [s * 0.032, cy - 0.006, 0.084], r: [0, 0, 0], s: [1, 1.1, 0.8] });
    // crack
  }
  // nasal cavity
  b.add(new THREE.ConeGeometry(0.012, 0.03, 3), dark, { p: [0, cy - 0.038, 0.088], r: [Math.PI, 0, 0], s: [1, 1, 0.6] });
  // upper jaw / maxilla with teeth
  b.add(bx(0.06, 0.03, 0.044, 0.006), bn, { p: [0, cy - 0.066, 0.064] });
  for (let i = 0; i < 8; i++) b.add(bx(0.0068, 0.016, 0.008, 0.002), bn, { p: [-0.0245 + i * 0.007, cy - 0.088, 0.083 - Math.abs(i - 3.5) * 0.0025] });
  // mandible
  const jaw = tube([[-0.05, cy - 0.03, -0.005], [-0.048, cy - 0.085, 0.02], [-0.026, cy - 0.106, 0.066], [0.026, cy - 0.106, 0.066], [0.048, cy - 0.085, 0.02], [0.05, cy - 0.03, -0.005]], 0.008, 24, 6);
  b.add(jaw, bn);
  for (let i = 0; i < 8; i++) b.add(bx(0.0068, 0.014, 0.008, 0.002), bn, { p: [-0.0245 + i * 0.007, cy - 0.1, 0.075 - Math.abs(i - 3.5) * 0.0035] });
  // shift so the base rests on y=0
  const g = b.build();
  g.position.y = 0;
  const wrap = new THREE.Group();
  g.position.y = 0.012;
  wrap.add(g);
  return wrap;
}
