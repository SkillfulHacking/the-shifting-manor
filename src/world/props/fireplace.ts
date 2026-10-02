import * as THREE from 'three';
import { Builder, archShape, bx, cyl, iron, lathe, plain, sph, smoothLathe, tag, tint, tor, rng, mat, mesh, TAU, tube, V3, brass } from './util';

/** Stone fireplace with marble mantel. Origin at floor, back against wall (z=0), front +Z. */
export function fireplace(width = 2.4, height = 1.6, breastTop = 0): THREE.Group {
  const b = new Builder();
  const depth = 0.5;
  const stone = tint('stoneWall', 0xd6cec4, { key: 'fpStone' });
  const marble = 'marble' as const;
  const openW = width * 0.56, openH = height * 0.62;
  const slabH = height - 0.07;

  // main surround slab with pointed-arch opening
  const outer = new THREE.Shape();
  outer.moveTo(-width / 2, 0); outer.lineTo(width / 2, 0); outer.lineTo(width / 2, slabH); outer.lineTo(-width / 2, slabH); outer.closePath();
  const hole = archShape(openW, openH, openW * 0.5);
  outer.holes.push(new THREE.Path(hole.getPoints(6).reverse()));
  b.add(new THREE.ExtrudeGeometry(outer, { depth: depth - 0.02, bevelEnabled: false, curveSegments: 4 }), stone, { p: [0, 0, 0.0] });

  // arch moulding: an offset ring around the opening standing proud
  const ring = new THREE.Shape(archShape(openW + 0.2, openH + 0.1, (openW + 0.2) * 0.5).getPoints(6));
  ring.holes.push(new THREE.Path(archShape(openW + 0.02, openH, openW * 0.5).getPoints(6).reverse()));
  b.add(new THREE.ExtrudeGeometry(ring, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 4 }), marble, { p: [0, 0, depth - 0.02] });
  // spandrel quatrefoil-ish roundels above arch
  for (const s of [-1, 1]) {
    const cx = s * (openW / 2 + (width - openW) / 4), cy = openH * 0.9;
    b.add(tor(0.11, 0.014, 5, 20), marble, { p: [cx, Math.min(cy, slabH - 0.2), depth - 0.005] });
    b.add(sph(0.05, 10, 8), marble, { p: [cx, Math.min(cy, slabH - 0.2), depth - 0.005], s: [1, 1, 0.5] });
  }
  // side pilasters (plinth + shaft + capital)
  for (const s of [-1, 1]) {
    const x = s * (width / 2 - 0.13);
    b.add(bx(0.3, 0.14, 0.34, 0.012), marble, { p: [x, 0.07, depth - 0.15] });
    b.add(cyl(0.085, 0.095, slabH - 0.34, 16), marble, { p: [x, 0.14 + (slabH - 0.34) / 2, depth - 0.12] });
    b.add(tor(0.09, 0.016, 5, 16), marble, { p: [x, 0.16, depth - 0.12], r: [Math.PI / 2, 0, 0] });
    b.add(smoothLathe([[0.085, slabH - 0.2], [0.11, slabH - 0.16], [0.14, slabH - 0.1], [0.145, slabH - 0.05]], 16, 3), marble, { p: [x, 0, depth - 0.12] });
    b.add(bx(0.32, 0.05, 0.32, 0.008), marble, { p: [x, slabH - 0.04, depth - 0.12] });
  }
  // mantel shelf (stacked moulding)
  b.add(bx(width + 0.24, 0.035, depth + 0.16, 0.008), marble, { p: [0, height - 0.13, (depth + 0.16) / 2 - 0.02] });
  b.add(bx(width + 0.32, 0.045, depth + 0.24, 0.012), marble, { p: [0, height - 0.09, (depth + 0.24) / 2 - 0.02] });
  b.add(bx(width + 0.4, 0.028, depth + 0.3, 0.008), marble, { p: [0, height - 0.05, (depth + 0.3) / 2 - 0.02] });
  b.add(bx(width + 0.36, 0.025, depth + 0.28, 0.008), marble, { p: [0, height - 0.025, (depth + 0.28) / 2 - 0.02] });
  // corbels
  for (const s of [-1, 1]) b.add(new THREE.ConeGeometry(0.06, 0.16, 4), marble, { p: [s * (openW / 2 + 0.28), slabH - 0.2, depth + 0.03], r: [Math.PI, Math.PI / 4, 0] });
  // hearth slab
  b.add(bx(width + 0.5, 0.06, 0.62, 0.01), marble, { p: [0, 0.03, depth + 0.28] });
  b.add(bx(width + 0.4, 0.05, 0.5, 0.01), 'stoneFloor', { p: [0, 0.075, depth + 0.24] });

  // overmantel: recessed blind arch panel
  const om = 1.1;
  b.add(bx(width * 0.86, om, 0.2, 0.01), stone, { p: [0, height + om / 2, 0.1] });
  b.add(bx(width * 0.92, 0.07, 0.3, 0.01), marble, { p: [0, height + om + 0.035, 0.15] });
  b.add(bx(width * 0.98, 0.04, 0.34, 0.01), marble, { p: [0, height + om + 0.09, 0.17] });
  const pan = new THREE.Shape(archShape(width * 0.5, om * 0.8, width * 0.2).getPoints(6));
  b.add(new THREE.ExtrudeGeometry(pan, { depth: 0.02, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 }), tint('darkWood', 0x8a7a70, { key: 'fpPan' }), { p: [0, height + om * 0.1, 0.2] });
  if (breastTop > height + om + 0.1) b.add(bx(width * 0.8, breastTop - height - om - 0.1, 0.16, 0), stone, { p: [0, (breastTop + height + om + 0.1) / 2, 0.08] });

  // firebox interior
  const dark = tint('bricks', 0x555048, { key: 'fpBrick' });
  b.add(bx(openW + 0.05, openH + 0.1, 0.03), dark, { p: [0, openH / 2, 0.03] });
  b.add(bx(openW, 0.04, depth), plain(0x1c1a19, 0.9), { p: [0, 0.095, depth / 2] });
  // inner slanted side bricks
  for (const s of [-1, 1]) b.add(bx(0.04, openH * 0.85, depth * 0.9), dark, { p: [s * (openW / 2 - 0.02), openH * 0.45, depth * 0.5], r: [0, s * 0.0, 0] });

  // andirons & grate
  const im = iron();
  for (const s of [-1, 1]) {
    const x = s * openW * 0.3;
    b.add(bx(0.03, 0.03, 0.42, 0.005), im, { p: [x, 0.16, depth * 0.55] });
    b.add(cyl(0.017, 0.017, 0.3, 8), im, { p: [x, 0.28, depth * 0.85] });
    b.add(sph(0.032, 10, 8), brass(), { p: [x, 0.45, depth * 0.85] });
    b.add(bx(0.03, 0.14, 0.03), im, { p: [x, 0.12, depth * 0.85 + 0.06] });
    b.add(bx(0.03, 0.14, 0.03), im, { p: [x, 0.12, depth * 0.3] });
  }
  b.add(cyl(0.012, 0.012, openW * 0.6, 6), im, { p: [0, 0.2, depth * 0.85], r: [0, 0, Math.PI / 2] });
  b.add(cyl(0.012, 0.012, openW * 0.6, 6), im, { p: [0, 0.22, depth * 0.35], r: [0, 0, Math.PI / 2] });

  const g = b.build();

  // logs (bark-like via displaced cylinders) and embers
  const r = rng(11);
  const logGeo = (len: number, rad: number) => {
    const gg = new THREE.CylinderGeometry(rad, rad * 1.05, len, 10, 6);
    const p = gg.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.14 - 0.05; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    gg.computeVertexNormals(); return gg;
  };
  const bark = tint('darkWood', 0x574a40, { key: 'log' });
  const logs = new THREE.Group();
  const l1 = mesh(logGeo(openW * 0.75, 0.075), bark, { p: [0, 0.17, depth * 0.62], r: [0, 0, Math.PI / 2 + 0.05] });
  const l2 = mesh(logGeo(openW * 0.7, 0.065), bark, { p: [0.05, 0.17, depth * 0.42], r: [0, 0.1, Math.PI / 2 - 0.05] });
  const l3 = mesh(logGeo(openW * 0.6, 0.07), bark, { p: [0, 0.25, depth * 0.52], r: [0, 0.08, Math.PI / 2 + 0.04] });
  logs.add(l1, l2, l3); logs.name = 'logs'; g.add(logs);
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x2a0a02, emissive: 0xff5a10, emissiveIntensity: 2.2, roughness: 0.8 });
  const emb = new THREE.Group(); emb.name = 'embers';
  const eg = new THREE.IcosahedronGeometry(0.05, 1);
  for (let i = 0; i < 14; i++) {
    const e = mesh(eg, emberMat, { p: [(r() - 0.5) * openW * 0.6, 0.13 + r() * 0.05, depth * (0.3 + r() * 0.4)], s: [1 + r(), 0.4 + r() * 0.4, 1 + r() * 0.6], r: [r() * 3, r() * 3, r() * 3] });
    e.castShadow = false; emb.add(e);
  }
  // glowing coal bed
  const bed = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 16), emberMat, { p: [0, 0.12, depth * 0.52], s: [openW * 1.1, 1, 0.5] }); bed.castShadow = false;
  emb.add(bed);
  g.add(emb);
  return tag(g, { fireAnchor: new THREE.Vector3(0, 0.34, depth * 0.55), emberMaterial: emberMat, openingWidth: openW, openingHeight: openH });
}
