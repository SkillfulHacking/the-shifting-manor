import * as THREE from 'three';
import { Builder, bx, cyl, gilt, iron, brass, plain, ringGeo, smoothLathe, sph, tag, tint, tor, TAU, canvasTex, rng, tube } from './util';

/** Round stone/brass pressure plate flush with the floor (origin on the floor, centre). */
export function pressurePlate(): THREE.Group {
  const g = new THREE.Group();
  const R = 0.5;
  // fixed frame + pit
  const fb = new Builder(g);
  const frame = new THREE.Shape(); frame.absarc(0, 0, R + 0.16, 0, TAU, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, R + 0.012, 0, TAU, true); frame.holes.push(hole);
  const fg = new THREE.ExtrudeGeometry(frame, { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 40 });
  fg.rotateX(-Math.PI / 2);
  fb.add(fg, 'stoneFloor', { p: [0, -0.024, 0] });
  fb.add(tor(R + 0.015, 0.01, 5, 48), iron(), { p: [0, 0.003, 0], r: [Math.PI / 2, 0, 0] });
  fb.add(cyl(R + 0.012, R + 0.012, 0.12, 40, true), plain(0x0a0806, 1), { p: [0, -0.06, 0] }, { uv: 'keep' });
  fb.add(cyl(R, R, 0.02, 40), plain(0x0a0806, 1), { p: [0, -0.12, 0] });
  // studs on frame
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; fb.add(sph(0.018, 6, 5), brass(), { p: [Math.cos(a) * (R + 0.09), 0.005, Math.sin(a) * (R + 0.09)], s: [1, 0.5, 1] }); }
  fb.build();
  // moving plate
  const plate = new THREE.Group(); plate.name = 'plate';
  const pb = new Builder(plate);
  pb.add(cyl(R - 0.004, R - 0.004, 0.06, 48), 'stoneFloor', { p: [0, -0.03, 0] });
  pb.add(tor(R - 0.03, 0.014, 5, 48), brass(), { p: [0, 0.0, 0], r: [Math.PI / 2, 0, 0] });
  pb.add(smoothLathe([[0.0001, 0.006], [0.14, 0.006], [0.17, 0.0], [0.19, -0.003]], 32, 2), brass(), { p: [0, 0.0, 0] });
  // raised star / eye centre
  const star = new THREE.Shape();
  for (let i = 0; i < 16; i++) { const r = i % 2 ? 0.045 : 0.125, a = (i / 16) * TAU; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? star.lineTo(x, y) : star.moveTo(x, y); }
  star.closePath();
  const sg = new THREE.ExtrudeGeometry(star, { depth: 0.008, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 });
  sg.rotateX(-Math.PI / 2);
  pb.add(sg, gilt(), { p: [0, 0.004, 0] });
  pb.add(sph(0.04, 12, 8), tint('brass', 0x554433, { key: 'pupil' }), { p: [0, 0.012, 0], s: [1, 0.4, 1] });
  pb.build();
  // rune ring
  const tex = canvasTex(1024, 128, (c, W, H) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const Rn = rng(3);
    c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
    const n = 12;
    for (let i = 0; i < n; i++) {
      const x0 = (i + 0.5) * (W / n), s = 34;
      c.beginPath();
      c.moveTo(x0, H / 2 - s); c.lineTo(x0, H / 2 + s);
      const k = 2 + Math.floor(Rn() * 3);
      for (let j = 0; j < k; j++) {
        const y = H / 2 - s + Rn() * 2 * s, dir = Rn() < 0.5 ? -1 : 1;
        c.moveTo(x0, y); c.lineTo(x0 + dir * (12 + Rn() * 14), y + (Rn() - 0.4) * 30);
      }
      c.stroke();
    }
    c.lineWidth = 3; c.beginPath(); c.moveTo(0, 6); c.lineTo(W, 6); c.moveTo(0, H - 6); c.lineTo(W, H - 6); c.stroke();
  }, false);
  tex.wrapS = THREE.RepeatWrapping;
  const runeMaterial = new THREE.MeshStandardMaterial({ color: 0x100a04, emissive: 0xffa640, emissiveMap: tex, emissiveIntensity: 0.9, map: null, roughness: 0.6, metalness: 0.2 });
  const rg = new THREE.RingGeometry(R - 0.19, R - 0.06, 64, 1);
  // polar uv: u = angle, v = radius
  const pos = rg.attributes.position, uv = rg.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    uv.setXY(i, (Math.atan2(y, x) / TAU + 0.5), (Math.hypot(x, y) - (R - 0.19)) / 0.13);
  }
  rg.rotateX(-Math.PI / 2);
  const runes = new THREE.Mesh(rg, runeMaterial); runes.name = 'runes'; runes.position.y = 0.002; runes.receiveShadow = true;
  plate.add(runes);
  g.add(plate);
  return tag(g, { runeMaterial, plate, radius: R });
}

/** Iron floor lever. userData.handle rotates around Z (swings in the XY plane); rotation.z ~ -0.7 (left) .. +0.7 (right). */
export function lever(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder(g);
  const ib = iron();
  b.add(bx(0.5, 0.06, 0.34, 0.012), 'stoneFloor', { p: [0, 0.03, 0] });
  b.add(bx(0.44, 0.03, 0.28, 0.008), ib, { p: [0, 0.075, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(sph(0.014, 6, 5), brass(), { p: [sx * 0.19, 0.095, sz * 0.11], s: [1, 0.6, 1] });
  // quadrant gate: two arcs
  for (const sz of [-1, 1]) {
    const sh = new THREE.Shape(); const r0 = 0.36, r1 = 0.4;
    sh.absarc(0, 0, r1, 0.5, Math.PI - 0.5, false); sh.absarc(0, 0, r0, Math.PI - 0.5, 0.5, true);
    b.add(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 20 }), ib, { p: [0, 0.16, sz * 0.05 - 0.01] });
  }
  // notch markers and pivot posts
  for (const a of [-0.7, 0, 0.7]) b.add(sph(0.014, 6, 5), brass(), { p: [Math.sin(a) * 0.39, 0.16 + Math.cos(a) * 0.39, 0.0], s: [1, 1, 1.5] });
  for (const sz of [-1, 1]) b.add(bx(0.06, 0.16, 0.03, 0.008), ib, { p: [0, 0.16, sz * 0.07 - 0.0] });
  b.add(cyl(0.028, 0.028, 0.2, 14), brass(), { p: [0, 0.16, 0], r: [Math.PI / 2, 0, 0] });
  b.build();
  // handle pivot at (0, 0.16, 0)
  const handle = new THREE.Group(); handle.name = 'handle'; handle.position.set(0, 0.16, 0);
  const hb = new Builder(handle);
  hb.add(bx(0.05, 0.05, 0.11, 0.01), ib, { p: [0, 0, 0] });
  hb.add(smoothLathe([[0.016, -0.04], [0.02, 0.0], [0.014, 0.1], [0.016, 0.45], [0.02, 0.55]], 12, 3), ib, { p: [0, 0, 0] });
  hb.add(smoothLathe([[0.0001, 0], [0.03, 0.02], [0.045, 0.07], [0.04, 0.12], [0.022, 0.16], [0.0001, 0.17]], 16, 3), brass(), { p: [0, 0.52, 0] });
  hb.add(tor(0.033, 0.006, 5, 16), brass(), { p: [0, 0.55, 0], r: [Math.PI / 2, 0, 0] });
  hb.build();
  g.add(handle);
  return tag(g, { handle, minAngle: -0.7, maxAngle: 0.7, tipHeight: 0.16 + 0.69 });
}
