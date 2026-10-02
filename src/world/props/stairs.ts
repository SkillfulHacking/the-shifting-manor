import * as THREE from 'three';
import { Builder, archShape, bx, cyl, gilt, iron, brass, lathe, mesh, plain, ringGeo, smoothLathe, sph, tag, tint, tor, TAU, wood, tube, rng, V3, cupGeo, addChain } from './util';
import { caseWood } from './clock';
import { chandelier } from './candles';
import { rugTexture } from './objects';

interface StairOpts { steps: number; h: number; d: number; width: number; banister: boolean; grand: boolean }

function baluster(): THREE.BufferGeometry {
  return lathe([[0.014, 0], [0.02, 0.03], [0.013, 0.09], [0.028, 0.18], [0.02, 0.27], [0.013, 0.32], [0.013, 0.72], [0.02, 0.8], [0.03, 0.86], [0.014, 0.95], [0.014, 1.0]], 6);
}

function buildStairs(o: StairOpts): THREE.Group {
  const { steps: n, h, d, width: W } = o;
  const b = new Builder();
  const wd = caseWood();
  const treadWood = tint('floorboards', 0xd8c0a0, { key: 'tread' });
  const riserWood = tint('darkWood', 0xc09070, { key: 'riser' });
  const stringerT = 0.06;
  const cheekX = W / 2 + stringerT / 2 - 0.0;
  // core wedge / cheek plates (sawtooth outline)
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(0, h);
  for (let i = 0; i < n; i++) { sh.lineTo(-(i + 1) * d, (i + 1) * h); if (i < n - 1) sh.lineTo(-(i + 1) * d, (i + 2) * h); }
  sh.lineTo(-n * d, 0); sh.closePath();
  const cheek = new THREE.ExtrudeGeometry(sh, { depth: stringerT, bevelEnabled: false });
  cheek.rotateY(-Math.PI / 2); // shape x -> world z, extrude -> -x
  for (const s of [-1, 1]) b.add(cheek, wd, { p: [s > 0 ? W / 2 + stringerT : -W / 2, 0, 0] });
  // core (stone-ish, hidden mostly)
  const core = new THREE.Shape();
  core.moveTo(0, 0); core.lineTo(0, h * 0.5); core.lineTo(-n * d, n * h - 0.05); core.lineTo(-n * d, 0); core.closePath();
  const cg = new THREE.ExtrudeGeometry(core, { depth: W, bevelEnabled: false }); cg.rotateY(-Math.PI / 2);
  b.add(cg, plain(0x1a120c, 1), { p: [W / 2, 0, 0] });
  for (let i = 0; i < n; i++) {
    const y = (i + 1) * h;
    const zc = -(i + 0.5) * d;
    if (o.grand && i === 0) {
      const s = new THREE.Shape(); const ex = 0.22;
      s.moveTo(-W / 2 - 0.02, 0); s.lineTo(W / 2 + 0.02, 0); s.lineTo(W / 2 + 0.02, -0.0);
      s.absellipse(0, 0, W / 2 + 0.02, ex, 0, -Math.PI, true);
      const tg = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 20 });
      tg.rotateX(-Math.PI / 2);
      b.add(tg, treadWood, { p: [0, y - 0.05, -0.0 + 0] , s: [1, 1, 1]});
      b.add(bx(W + 0.04, 0.05, d - 0.0, 0.008), treadWood, { p: [0, y - 0.025, zc - 0.0] });
      // curved riser
      const rg = new THREE.CylinderGeometry(1, 1, h - 0.05, 32, 1, true, Math.PI / 2, Math.PI);
      rg.rotateY(0);
      b.add(new THREE.CylinderGeometry(1, 1, h - 0.05, 32, 1, false, Math.PI / 2 - Math.PI / 2 * 0 + 0, Math.PI), riserWood, { p: [0, (h - 0.05) / 2, 0], s: [W / 2 + 0.02, 1, ex] , r: [0, Math.PI, 0] });
    } else {
      b.add(bx(W + 0.04, 0.05, d + 0.03, 0.008), treadWood, { p: [0, y - 0.025, zc + 0.015] });
      b.add(bx(W, h - 0.05, 0.02, 0.003), riserWood, { p: [0, y - h / 2 - 0.025 + 0.0, -i * d - 0.005] });
    }
  }
  const g = b.build();
  if (o.grand) {
    // carpet runner with brass rods
    const cb = new Builder(g);
    const cw = W * 0.56;
    // one continuous runner that follows the tread/riser profile, with a texture drawn for its true size (border stays at the edges)
    const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
    const total = n * (h + d);
    let run = 0;
    const pts: [number, number, number][] = []; // y, z, arclength
    pts.push([0.012, 0.02, 0]);
    for (let i = 0; i < n; i++) {
      run += h; pts.push([(i + 1) * h + 0.012, -i * d + 0.02, run]);
      run += d; pts.push([(i + 1) * h + 0.012, -(i + 1) * d + 0.02, run]);
    }
    pts.forEach(([y, z, s], k) => {
      pos.push(-cw / 2, y, z, cw / 2, y, z);
      uvs.push(0, 1 - s / total, 1, 1 - s / total);
      if (k > 0) { const a0 = (k - 1) * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
    });
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    const rmat = new THREE.MeshStandardMaterial({ map: rugTexture(cw, total, 'red'), roughness: 0.96, side: THREE.DoubleSide });
    const runner = new THREE.Mesh(rg, rmat);
    runner.receiveShadow = true;
    g.add(runner);
    for (let i = 0; i < n; i++) {
      const y = (i + 1) * h;
      cb.add(cyl(0.007, 0.007, cw + 0.08, 6), brass(), { p: [0, y - 0.005, -i * d + 0.005], r: [0, 0, Math.PI / 2] });
      for (const s of [-1, 1]) cb.add(sph(0.012, 6, 5), brass(), { p: [s * (cw / 2 + 0.05), y - 0.005, -i * d + 0.005] });
    }
    cb.build();
  }
  if (o.banister) {
    const rb = new Builder(g);
    const slope = Math.atan2(n * h, n * d);
    const railH = 0.92;
    const bal = baluster();
    for (const s of [-1, 1]) {
      const x = s * (W / 2 + stringerT * 0.5 + (o.grand ? 0.0 : 0.0));
      // newel posts
      const nh = o.grand ? 1.35 : 1.15;
      const newel = (z: number, y0: number, hh: number) => {
        rb.add(bx(0.15, hh, 0.15, 0.012), wd, { p: [x, y0 + hh / 2, z] });
        rb.add(bx(0.19, 0.06, 0.19, 0.012), wd, { p: [x, y0 + 0.08, z] });
        rb.add(bx(0.18, 0.05, 0.18, 0.012), wd, { p: [x, y0 + hh - 0.1, z] });
        rb.add(bx(0.2, 0.04, 0.2, 0.01), wd, { p: [x, y0 + hh + 0.02, z] });
        if (o.grand) {
          // gothic spire finial
          rb.add(new THREE.ConeGeometry(0.075, 0.28, 4), wd, { p: [x, y0 + hh + 0.18, z], r: [0, Math.PI / 4, 0] });
          for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) rb.add(new THREE.ConeGeometry(0.02, 0.09, 4), wd, { p: [x + dx * 0.085, y0 + hh + 0.09, z + dz * 0.085], r: [0, Math.PI / 4, 0] });
          rb.add(sph(0.022, 8, 6), gilt(), { p: [x, y0 + hh + 0.34, z] });
          // recessed gothic arch panel on newel face
          rb.add(new THREE.ExtrudeGeometry(archShape(0.08, 0.4, 0.04), { depth: 0.008, bevelEnabled: false }), tint('darkWood', 0x8a6a50, { key: 'clockPanel' }), { p: [x, y0 + 0.3, z + 0.075] });
        } else {
          rb.add(sph(0.06, 10, 8), wd, { p: [x, y0 + hh + 0.07, z] });
        }
      };
      newel(0.02, 0, nh);
      newel(-n * d + 0.03, n * h, nh - 0.05);
      // rail
      const zA = 0.02, yA = 0.0 + nh - 0.12;
      const zB = -n * d + 0.03, yB = n * h + nh - 0.17;
      const len = Math.hypot(zA - zB, yB - yA);
      const ang = Math.atan2(yB - yA, zA - zB);
      rb.add(bx(0.07, 0.07, len, 0.025), wd, { p: [x, (yA + yB) / 2 + 0.0, (zA + zB) / 2], r: [ang, 0, 0] });
      rb.add(bx(0.09, 0.02, len, 0.006), wd, { p: [x, (yA + yB) / 2 - 0.045, (zA + zB) / 2], r: [ang, 0, 0] });
      // balusters: two per step
      for (let i = 0; i < n; i++) for (const off of [0.25, 0.75]) {
        const z = -(i + off) * d;
        const t = (zA - z) / (zA - zB);
        const railY = yA + (yB - yA) * t - 0.06;
        const y0 = (i + 1) * h;
        const ht = railY - y0;
        if (ht > 0.2) rb.add(bal, wd, { p: [x, y0, z], s: [1, ht, 1] });
      }
      // curved volute scroll at bottom end
      if (o.grand) rb.add(tor(0.09, 0.02, 6, 16, Math.PI * 1.5), wd, { p: [x, yA - 0.02, zA + 0.14], r: [0, Math.PI / 2, Math.PI * 0.3] });
    }
    rb.build();
  }
  return tag(g, { rise: n * h, run: n * d, width: W, steps: n, stepHeight: h, stepDepth: d, topY: n * h });
}

export function staircase(steps = 12, stepHeight = 0.18, stepDepth = 0.3, width = 1.4, withBanister = true): THREE.Group {
  return buildStairs({ steps, h: stepHeight, d: stepDepth, width, banister: withBanister, grand: false });
}

export function grandStair(): THREE.Group {
  return buildStairs({ steps: 16, h: 0.17, d: 0.34, width: 3.0, banister: true, grand: true });
}

/** A chandelier that has crashed to the floor: lies tilted and bent with chain coils and wax/plaster debris. */
export function fallenChandelier(): THREE.Group {
  const g = new THREE.Group();
  const c = chandelier(0.7, 8, 0.02);
  c.rotation.set(0.32, 0.4, 0.18);
  c.updateMatrixWorld(true);
  // hide flames
  const holder = new THREE.Group(); holder.add(c);
  const box = new THREE.Box3().setFromObject(holder);
  holder.position.y = -box.min.y + 0.005;
  // squash the ring slightly so it looks bent
  c.scale.set(1.0, 1, 0.88);
  g.add(holder);
  const R = rng(4);
  const b = new Builder(g);
  // spilled candles & wax
  for (let i = 0; i < 5; i++) {
    const a = R() * TAU, r = 0.7 + R() * 0.7;
    b.add(cyl(0.017, 0.017, 0.11 + R() * 0.05, 8), 'candleWax', { p: [Math.cos(a) * r, 0.02, Math.sin(a) * r], r: [Math.PI / 2, 0, R() * TAU] });
    b.add(cyl(0.06 + R() * 0.03, 0.06 + R() * 0.04, 0.004, 10), 'candleWax', { p: [Math.cos(a) * (r + 0.05), 0.002, Math.sin(a) * (r + 0.05)] });
  }
  // plaster and stone chunks
  const chunk = new THREE.DodecahedronGeometry(0.1, 0);
  for (let i = 0; i < 14; i++) {
    const a = R() * TAU, r = 0.2 + R() * 1.3, s = 0.3 + R() * 0.9;
    b.add(chunk, 'plaster', { p: [Math.cos(a) * r, 0.04 * s, Math.sin(a) * r], s: [s * (0.8 + R() * 0.8), s * 0.5, s * (0.8 + R() * 0.8)], r: [R() * 3, R() * 3, R() * 3] });
  }
  // chain coil
  const link = tor(0.016, 0.0055, 5, 10);
  for (let i = 0; i < 40; i++) {
    const t = i / 40 * 5.2, rr = 0.09 + i * 0.0025;
    b.add(link, iron(), { p: [-0.9 + Math.cos(t) * rr, 0.01 + Math.floor(i / 16) * 0.012, 0.9 + Math.sin(t) * rr], r: [Math.PI / 2 * (i % 2), t, Math.PI / 2 * ((i + 1) % 2)], s: [1, 1.5, 1] });
  }
  // dust plate
  b.add(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }), { p: [0, 0.003, 0], r: [-Math.PI / 2, 0, 0] }, { uv: 'keep' });
  b.build();
  g.traverse(o => { if (o.userData.flame || (o as THREE.Mesh).isMesh && (o as THREE.Mesh).material && ((o as THREE.Mesh).material as any).blending === THREE.AdditiveBlending) o.visible = false; });
  return g;
}
