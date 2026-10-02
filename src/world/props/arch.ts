import * as THREE from 'three';
import { Builder, archShape, bx, cyl, gilt, iron, brass, lathe, mesh, plain, ringGeo, smoothLathe, sph, tag, tint, tor, TAU, wood, tube, rng, V3, canvasTex, cupGeo, smoothSeams, addChain, crestShape } from './util';
import { caseWood } from './clock';

/* ---------- ceiling beam ---------- */
/** Ceiling beam along X, origin at centre of its underside (beam extends upward to +0.32). */
export function ceilingBeam(length = 4): THREE.Group {
  const b = new Builder();
  const w = 0.3, hgt = 0.32;
  const m = 'ceilingBeam' as const;
  b.add(bx(length, hgt, w, 0.03), m, { p: [0, hgt / 2, 0] });
  // chamfer strips along lower edges and cove
  for (const s of [-1, 1]) b.add(bx(length, 0.03, 0.03, 0.006), m, { p: [0, 0.012, s * (w / 2 - 0.005)] });
  // iron straps
  for (const x of [-length * 0.32, 0, length * 0.32]) {
    b.add(bx(0.06, 0.02, w + 0.03, 0.004), iron(), { p: [x, 0.005, 0] });
    for (const s of [-1, 1]) {
      b.add(bx(0.06, hgt * 0.8, 0.02, 0.004), iron(), { p: [x, hgt * 0.45, s * (w / 2 + 0.01)] });
      b.add(sph(0.014, 6, 5), iron(), { p: [x, 0.08, s * (w / 2 + 0.024)], s: [1, 1, 0.6] });
      b.add(sph(0.014, 6, 5), iron(), { p: [x, 0.24, s * (w / 2 + 0.024)], s: [1, 1, 0.6] });
    }
  }
  // curved braces at the ends
  for (const sx of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(0.5, 0); sh.quadraticCurveTo(0.12, -0.05, 0, -0.5); sh.lineTo(0, 0);
    const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 10 });
    bg.translate(0, 0, -0.08);
    b.add(bg, m, { p: [sx * (length / 2), 0, 0], s: [-sx, 1, 1] });
  }
  return b.build();
}

/* ---------- window ---------- */
function clipLine(x0: number, y0: number, dx: number, dy: number, W: number, H: number): [number, number, number, number] | null {
  let t0 = -1e9, t1 = 1e9;
  const clip = (p: number, q: number) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
  if (clip(-dx, x0) && clip(dx, W - x0) && clip(-dy, y0) && clip(dy, H - y0) && t0 < t1) return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
  return null;
}

/** Gothic lancet window with mullions, lead-came panes, dark-blue glass. Origin at window centre; +Z into room. */
export function windowFrame(width = 1.0, height = 2.0): THREE.Group {
  const b = new Builder();
  const rise = Math.min(width * 0.8, height * 0.4);
  const t = 0.12;
  const stone = tint('stoneWall', 0xd6cfc4, { key: 'winStone' });
  const oy = -height / 2;
  const holeS = archShape(width, height, rise);
  const outer = archShape(width + 2 * t, height + t * 1.2, rise + t * 0.9);
  outer.holes.push(new THREE.Path(holeS.getPoints(8)));
  b.add(new THREE.ExtrudeGeometry(outer, { depth: 0.1, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1, curveSegments: 8 }), stone, { p: [0, oy, -0.02] });
  const o2 = archShape(width + 2 * t * 0.5, height + t * 0.65, rise + t * 0.5);
  o2.holes.push(new THREE.Path(archShape(width - 0.02, height - 0.01, rise).getPoints(8)));
  b.add(new THREE.ExtrudeGeometry(o2, { depth: 0.04, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 8 }), tint('stoneWall', 0xc0b8ac, { key: 'winStone2' }), { p: [0, oy, 0.09] });
  // sill with drip moulding & corbels
  b.add(bx(width + 0.5, 0.06, 0.28, 0.01), stone, { p: [0, oy - 0.03, 0.1] });
  b.add(bx(width + 0.4, 0.05, 0.2, 0.01), stone, { p: [0, oy - 0.085, 0.05] });
  for (const s of [-1, 1]) b.add(new THREE.ConeGeometry(0.07, 0.18, 4), stone, { p: [s * (width / 2 + 0.05), oy - 0.19, 0.08], r: [Math.PI, Math.PI / 4, 0] });
  // tracery / lead came
  const lead = plain(0x2c2c30, 0.55, 0.85);
  const springY = height - rise;
  const gz = 0.035;
  b.add(bx(0.03, springY + rise * 0.32, 0.03, 0.004), stone, { p: [0, oy + (springY + rise * 0.32) / 2, gz] });
  const sub = archShape(width / 2 - 0.02, springY + rise * 0.55, rise * 0.5);
  for (const s of [-1, 1]) {
    const ring = new THREE.Shape(archShape(width / 2 - 0.02, springY + rise * 0.55, rise * 0.5).getPoints(8));
    ring.holes.push(new THREE.Path(archShape(width / 2 - 0.02 - 0.06, springY + rise * 0.55 - 0.03, rise * 0.5 - 0.02).getPoints(8).map(p => new THREE.Vector2(p.x, p.y))));
    b.add(new THREE.ExtrudeGeometry(ring, { depth: 0.03, bevelEnabled: false }), stone, { p: [s * (width / 4), oy, gz - 0.015] });
  }
  b.add(tor(rise * 0.22, 0.012, 5, 28), stone, { p: [0, oy + springY + rise * 0.72, gz] });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.add(bx(rise * 0.2, 0.008, 0.012), lead, { p: [Math.cos(a) * rise * 0.11, oy + springY + rise * 0.72 + Math.sin(a) * rise * 0.11, gz], r: [0, 0, a] }); }
  // diamond lattice in the rectangular portion (each half)
  const halfW = width / 2 - 0.05;
  const sp = Math.max(0.16, width / 3.2);
  for (const s of [-1, 1]) {
    const x0 = s * (width / 4);
    for (let k = -12; k <= 12; k++) for (const dir of [1, -1]) {
      const ox = k * sp, oyy = 0;
      const seg = clipLine(ox - (dir > 0 ? springY : 0) * 0, 0, 1, dir, halfW, springY);
      // family of lines: y = dir*(x - c), start on the bottom edge x = c
      const c = k * sp * 0.75;
      const s2 = clipLine(c, dir > 0 ? 0 : springY, 1, dir, halfW, springY);
      const sg = dir > 0 ? clipLine(c, 0, 1, 1, halfW, springY) : clipLine(c, springY, 1, -1, halfW, springY);
      if (!sg) continue;
      const [ax, ay, bx2, by] = sg;
      const len = Math.hypot(bx2 - ax, by - ay);
      if (len < 0.02) continue;
      b.add(bx(len, 0.006, 0.01), lead, { p: [x0 - halfW / 2 + (ax + bx2) / 2, oy + (ay + by) / 2 + 0.0, gz], r: [0, 0, Math.atan2(by - ay, bx2 - ax)] });
    }
  }
  // horizontal saddle bar
  b.add(bx(width - 0.02, 0.02, 0.025, 0.004), iron(), { p: [0, oy + springY * 0.5, gz] });
  const g = b.build();
  // glass
  const gm = new THREE.MeshStandardMaterial({ color: 0x1a3450, emissive: 0x081830, emissiveIntensity: 0.8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const gg = new THREE.ShapeGeometry(archShape(width, height, rise), 12);
  const gl = new THREE.Mesh(gg, gm); gl.name = 'glass'; gl.position.set(0, oy, 0.02); gl.userData.noShadow = true; gl.castShadow = false;
  g.add(gl);
  return tag(g, { glassMaterial: gm, glass: gl, openingSize: { w: width, h: height } });
}

/* ---------- curtains ---------- */
export function curtains(width = 1.6, height = 2.4, colour: 'red' | 'green' = 'red'): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder(g);
  const rodY = 0;
  b.add(cyl(0.017, 0.017, width + 0.5, 10), brass(), { p: [0, rodY, 0.0], r: [0, 0, Math.PI / 2] });
  for (const s of [-1, 1]) {
    b.add(smoothLathe([[0.0001, 0], [0.02, 0.01], [0.035, 0.04], [0.03, 0.07], [0.012, 0.09], [0.0001, 0.1]], 12, 3), brass(), { p: [s * (width / 2 + 0.25), rodY, 0], r: [0, 0, -s * Math.PI / 2] });
    b.add(bx(0.02, 0.02, 0.3, 0.004), brass(), { p: [s * (width / 2 + 0.05), rodY, -0.15] });
  }
  const mat = tint(colour === 'red' ? 'velvetRed' : 'velvetGreen', 0xffffff, { key: 'curtain' }).clone();
  mat.side = THREE.DoubleSide;
  const pw = width * 0.3, folds = 7;
  const mk = (side: number) => {
    const geo = new THREE.PlaneGeometry(1, 1, 36, 24);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5, v = 0.5 - p.getY(i); // u 0..1, v 0 top .. 1 bottom
      const tie = Math.exp(-Math.pow((v - 0.6) / 0.11, 2));
      const flare = Math.pow(Math.max(0, v - 0.6) / 0.4, 1.5);
      const spread = pw * (1 - 0.5 * tie + 0.28 * flare + 0.0);
      const pinch = 1;
      const amp = 0.028 + 0.05 * (0.35 + 0.65 * (1 - tie * 0.6)) * (0.5 + 0.5 * v) + 0.04 * flare;
      const ph = u * folds * TAU;
      const z = amp * Math.sin(ph) + 0.03 * Math.sin(ph * 2.3 + v * 3) * (0.3 + v);
      // outer edge x = -side*width/2 ; panel extends toward centre; tie pulls in
      const x = side * (width / 2 - u * spread * 1.0 * 1) * 1;
      const xo = side * (width / 2) + (-side) * (u * spread);
      const y = rodY - v * height - 0.006 * Math.sin(ph) * v;
      const zz = z + 0.02 + (v > 0.6 ? flare * 0.09 : 0) + tie * -0.02;
      p.setXYZ(i, xo, y, zz);
    }
    geo.computeVertexNormals();
    // uv in metres
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.0, p.getY(i) / 1.0);
    return geo;
  };
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(mk(s), mat); m.castShadow = m.receiveShadow = true; g.add(m);
    // rings
    for (let i = 0; i <= 8; i++) {
      const x = s * (width / 2) - s * (i / 8) * pw;
      b.add(tor(0.028, 0.004, 4, 12), brass(), { p: [x, rodY, 0.0], r: [0, Math.PI / 2, 0] });
    }
    // tieback cord and tassel
    const tx = s * (width / 2 - pw * 0.5 * 0.55);
    b.add(tor(pw * 0.3, 0.008, 5, 16), gilt(), { p: [tx, -height * 0.6, 0.05], r: [Math.PI / 2, 0, 0], s: [1, 0.55, 1] });
    b.add(smoothLathe([[0.0001, 0], [0.018, 0.03], [0.014, 0.08], [0.02, 0.11], [0.0001, 0.14]], 10, 2), gilt(), { p: [tx + s * 0.0, -height * 0.6 - 0.24, 0.05] });
    b.add(cyl(0.004, 0.004, 0.1, 4), gilt(), { p: [tx, -height * 0.6 - 0.06, 0.04] });
  }
  b.build();
  return g;
}

/* ---------- arch trim ---------- */
/** Gothic arch moulding around a doorway. Origin: floor centre of the opening; +Z out. Opening is exactly width x height (apex height). */
export function archTrim(width = 1.2, height = 2.4, style: 'stone' | 'wood' = 'stone'): THREE.Group {
  const b = new Builder();
  const m: THREE.Material = style === 'stone' ? tint('stoneWall', 0xd6cfc4, { key: 'trimStone' }) : tint('darkWood', 0xc09070, { key: 'caseWood' });
  const m2: THREE.Material = style === 'stone' ? tint('stoneWall', 0xbdb5a8, { key: 'trimStone2' }) : tint('darkWood', 0xa88060, { key: 'trim2' });
  const rise = Math.min(width * 0.7, height * 0.3);
  const springY = height - rise;
  const layers: [number, number, number][] = [[0.15, 0.05, 0.0], [0.1, 0.08, 0.0], [0.05, 0.11, 0.0]];
  for (let i = 0; i < layers.length; i++) {
    const [tt, dep] = layers[i];
    const outer = archShape(width + 2 * tt, height + tt * 1.1, rise + tt * 0.9);
    const inner = archShape(width + (i < layers.length - 1 ? 2 * layers[i + 1][0] : 0), height + (i < layers.length - 1 ? layers[i + 1][0] * 1.1 : 0), rise + (i < layers.length - 1 ? layers[i + 1][0] * 0.9 : 0));
    outer.holes.push(new THREE.Path(inner.getPoints(10)));
    b.add(new THREE.ExtrudeGeometry(outer, { depth: dep, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 8 }), i % 2 ? m2 : m, { p: [0, 0, -0.01] });
  }
  // inner reveal
  const rv = new THREE.Shape(archShape(width + 0.02, height + 0.02, rise)?.getPoints(10));
  rv.holes.push(new THREE.Path(archShape(width, height, rise).getPoints(10)));
  b.add(new THREE.ExtrudeGeometry(rv, { depth: 0.14, bevelEnabled: false }), m2, { p: [0, 0, -0.06] });
  // jamb colonettes & bases/capitals at the springing
  for (const s of [-1, 1]) {
    const x = s * (width / 2 + 0.06);
    b.add(cyl(0.028, 0.028, springY - 0.2, 10), m, { p: [x, 0.16 + (springY - 0.2) / 2, 0.14] });
    b.add(bx(0.11, 0.16, 0.11, 0.008), m, { p: [x, 0.08, 0.13] });
    b.add(tor(0.03, 0.01, 4, 12), m, { p: [x, 0.17, 0.14], r: [Math.PI / 2, 0, 0] });
    b.add(smoothLathe([[0.028, springY - 0.04], [0.045, springY - 0.02], [0.06, springY + 0.0], [0.06, springY + 0.05]], 12, 2), m, { p: [x, 0, 0.14] });
    b.add(bx(0.13, 0.05, 0.13, 0.008), m, { p: [x, springY + 0.075, 0.14] });
    // label stops (little bosses)
    b.add(sph(0.045, 8, 6), m2, { p: [x, springY + 0.2, 0.06], s: [1, 1.1, 0.6] });
  }
  // hood mould (label) arch
  const hoodT = 0.24;
  const ho = archShape(width + 2 * hoodT, height + hoodT * 1.15 + 0.06, rise + hoodT * 1.0 + 0.06);
  ho.holes.push(new THREE.Path(archShape(width + 2 * (hoodT - 0.09), height + (hoodT - 0.09) * 1.15 + 0.06, rise + (hoodT - 0.09) + 0.06).getPoints(10)));
  b.add(new THREE.ExtrudeGeometry(ho, { depth: 0.07, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 8 }), m, { p: [0, springY * 0 + 0.0, 0.1] });
  // apex finial: crocket + fleuron
  b.add(smoothLathe([[0.03, 0], [0.024, 0.04], [0.032, 0.08], [0.014, 0.13], [0.0001, 0.2]], 8, 2), m, { p: [0, height + hoodT * 1.15 + 0.03, 0.14] });
  {
    const wH = width + 2 * hoodT, riseH = rise + hoodT + 0.06, HH = height + hoodT * 1.15 + 0.06;
    const R = (riseH * riseH + (wH * wH) / 4) / wH, cx = R - wH / 2, a1 = Math.acos(cx / R), shH = HH - riseH;
    for (let i = 1; i <= 5; i++) {
      const a = (i / 6) * a1;
      for (const s of [-1, 1]) {
        const x = s * (-cx + R * Math.cos(a) + 0.0), y = shH + R * Math.sin(a);
        b.add(sph(0.024, 6, 5), m2, { p: [x, y + 0.015, 0.18], s: [0.8, 1.4, 0.7], r: [0, 0, -s * (Math.PI / 2 - a) * 0.6] });
      }
    }
  }
  return tag(b.build(), { openingSize: { w: width, h: height }, springY, rise });
}

/* ---------- door ---------- */
const doorInlay = () => new THREE.MeshStandardMaterial({ color: 0x1a0f22, emissive: 0x9a5cff, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.3 });

function eyeShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.quadraticCurveTo(0, h * 1.1, w / 2, 0);
  s.quadraticCurveTo(0, -h * 1.1, -w / 2, 0);
  return s;
}

export function doorLeaf(width = 1.1, height = 2.15, style: 'wood' | 'iron' | 'shifting' | 'attic' = 'wood'): THREE.Group {
  const b = new Builder();
  const T = 0.055;
  const h = new Builder(); // hardware (unwarped)
  const green = style === 'shifting';
  const wd = style === 'shifting' ? tint('darkWood', 0x8aa090, { key: 'shiftWood' }) : style === 'attic' ? tint('darkWood', 0xb09880, { roughness: 0.95, key: 'atticWood' }) : style === 'iron' ? tint('darkWood', 0xa89078, { roughness: 0.9, key: 'ironDoorWood' }) : caseWood();
  const rise = Math.min(width * 0.7, height * 0.3); // same rule as archTrim, so leaf and opening match
  const slab = new THREE.ExtrudeGeometry(archShape(width, height, rise), { depth: T, bevelEnabled: false, curveSegments: 12 });
  b.add(slab, wd, { p: [width / 2, 0, -T / 2] });
  const fw = 0.11;
  let inlay: THREE.MeshStandardMaterial | undefined;
  if (style === 'wood') {
    // stiles & rails raised
    {
      // one arched raised frame replaces rectangular stiles and top rail, so nothing pokes outside the arch
      const outer = archShape(width - 0.02, height - 0.02, rise);
      outer.holes.push(new THREE.Path(archShape(width - 2 * fw, height - 0.02 - fw * 1.1, rise - fw * 0.9).getPoints(14)));
      b.add(new THREE.ExtrudeGeometry(outer, { depth: 0.014, bevelEnabled: false, curveSegments: 12 }), wd, { p: [width / 2, 0.01, T / 2 - 0.006] });
    }
    for (const y of [0.1, height * 0.5]) b.add(bx(width - fw, 0.16, 0.014, 0.003), wd, { p: [width / 2, y, T / 2 + 0.004] });
    const inset = tint('darkWood', 0x7a5f48, { key: 'panelIn' });
    const pw = width - fw * 2;
    const ph1 = height * 0.5 - 0.26 - 0.06;
    // lower panels (2)
    for (const k of [0, 1]) {
      const x = fw + pw * (k ? 0.75 : 0.25);
      const y = 0.3 + ph1 / 2 - 0.02;
      b.add(bx(pw / 2 - 0.05, ph1, 0.018, 0.005), inset, { p: [x, y, T / 2 + 0.002] });
      b.add(bx(pw / 2 - 0.12, ph1 - 0.08, 0.012, 0.004), wd, { p: [x, y, T / 2 + 0.014] });
    }
    // upper panels: gothic arched
    const uh = height - height * 0.5 - 0.3;
    for (const k of [0, 1]) {
      const x = fw + pw * (k ? 0.75 : 0.25);
      b.add(new THREE.ExtrudeGeometry(archShape(pw / 2 - 0.05, uh, (pw / 2 - 0.05) * 0.5), { depth: 0.018, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 }), inset, { p: [x, height * 0.5 + 0.12, T / 2 - 0.006] });
      b.add(new THREE.ExtrudeGeometry(archShape(pw / 2 - 0.12, uh - 0.08, (pw / 2 - 0.12) * 0.5), { depth: 0.012, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 }), wd, { p: [x, height * 0.5 + 0.16, T / 2 + 0.004] });
    }
    // mirror the panels on the back
    b.add(new THREE.ExtrudeGeometry(archShape(width - 0.06, height - 0.06, rise - 0.03), { depth: 0.01, bevelEnabled: false, curveSegments: 12 }), wd, { p: [width / 2, 0.03, -T / 2 - 0.01] });
  } else if (style === 'iron') {
    // vertical planks with gaps
    const n = 5;
    for (let i = 1; i < n; i++) b.add(bx(0.006, height - 0.02, 0.058), plain(0x0a0705, 1), { p: [(width * i) / n, height / 2, 0] });
    // iron straps with ornate ends
    const ib = iron();
    for (const y of [0.3, height * 0.5, height - 0.45]) {
      b.add(bx(width - 0.06, 0.09, 0.014, 0.003), ib, { p: [width / 2 + 0.02, y, T / 2 + 0.006] });
      b.add(new THREE.ExtrudeGeometry(crestShape(0.16, 0.14), { depth: 0.012, bevelEnabled: false }), ib, { p: [width - 0.04, y, T / 2 + 0.002], r: [0, 0, -Math.PI / 2] });
      for (let k = 0; k < 6; k++) b.add(sph(0.013, 6, 5), ib, { p: [0.16 + k * (width - 0.35) / 5, y, T / 2 + 0.014], s: [1, 1, 0.7] });
    }
    // studs in grid
    for (let i = 0; i < n; i++) for (const y of [0.08, 0.6, 1.4, height - 0.5]) b.add(sph(0.012, 6, 5), ib, { p: [width * (i + 0.5) / n, y, T / 2 + 0.008], s: [1, 1, 0.7] });
    // ring pull
    h.add(tor(0.05, 0.008, 6, 20), iron(), { p: [width - 0.2, 1.0, T / 2 + 0.05], r: [0.1, 0, 0] });
    h.add(cyl(0.025, 0.025, 0.02, 10), iron(), { p: [width - 0.2, 1.05, T / 2 + 0.014], r: [Math.PI / 2, 0, 0] });
  } else if (style === 'shifting') {
    inlay = doorInlay();
    const ib = inlay;
    const cx = width / 2, cy = height * 0.6;
    // planks with fine seams, raised framing
    const n = 5;
    for (let i = 1; i < n; i++) b.add(bx(0.005, height - 0.02, 0.058), plain(0x05100a, 1), { p: [(width * i) / n, height / 2, 0] });
    // eye motif: inlay lines
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 24), ib, { p: [cx, cy, T / 2 + 0.018], r: [Math.PI / 2, 0, 0] });
    b.add(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 16), plain(0x040106, 0.4), { p: [cx, cy, T / 2 + 0.024], r: [Math.PI / 2, 0, 0] });
    // sunburst rays
    const N = 24;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const long = i % 2 === 0;
      const r0 = 0.27, r1 = long ? 0.5 : 0.38;
      const rl = r1 - r0;
      const ray = new THREE.Shape(); ray.moveTo(-0.012, 0); ray.lineTo(0.012, 0); ray.lineTo(0.003, rl); ray.lineTo(-0.003, rl); ray.closePath();
      b.add(new THREE.ExtrudeGeometry(ray, { depth: 0.006, bevelEnabled: false }), ib, { p: [cx + Math.cos(a) * r0 * 0.9, cy + Math.sin(a) * r0 * 1.0, T / 2 + 0.005], r: [0, 0, a - Math.PI / 2] });
    }
    // ring of dots and inlay border
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; b.add(sph(0.011, 6, 5), ib, { p: [cx + Math.cos(a) * 0.2, cy + Math.sin(a) * 0.15, T / 2 + 0.012], s: [1, 1, 0.5] }); }
    {
      const ring = archShape(width - 0.26, height - 0.2, rise * 0.9);
      ring.holes.push(new THREE.Path(archShape(width - 0.28, height - 0.22, rise * 0.9).getPoints(14)));
      b.add(new THREE.ExtrudeGeometry(ring, { depth: 0.008, bevelEnabled: false, curveSegments: 12 }), ib, { p: [width / 2, 0.1, T / 2 + 0.002] });
    }
    // lower crescent-and-keys
    b.add(tor(0.09, 0.008, 4, 24, Math.PI * 1.5), ib, { p: [cx, height * 0.22, T / 2 + 0.008], r: [0, 0, 0.6] });
    b.add(new THREE.CircleGeometry(0.045, 16), ib, { p: [cx + 0.03, height * 0.22 + 0.02, T / 2 + 0.008] });
    h.add(new THREE.SphereGeometry(0.035, 12, 10), plain(0x21102e, 0.3, 0.6), { p: [width - 0.12, 1.02, T / 2 + 0.04], s: [1, 1, 0.8] });
  } else { // attic
    for (let i = 1; i < 4; i++) b.add(bx(0.006, height - 0.02, 0.058), plain(0x0a0705, 1), { p: [(width * i) / 4, height / 2, 0] });
    // Z brace
    b.add(bx(0.09, Math.hypot(width - 0.2, height * 0.65), 0.02, 0.003), wd, { p: [width / 2, height * 0.5, T / 2 + 0.01], r: [0, 0, Math.atan2(width - 0.2, height * 0.65) * -1] });
    b.add(bx(width - 0.5, 0.11, 0.02, 0.003), wd, { p: [width / 2, height - 0.3, T / 2 + 0.01] });
    b.add(bx(width - 0.1, 0.11, 0.02, 0.003), wd, { p: [width / 2, 0.2, T / 2 + 0.01] });
    // latch
    h.add(bx(0.32, 0.03, 0.01, 0.003), iron(), { p: [width - 0.2, 1.02, T / 2 + 0.03] });
    h.add(bx(0.03, 0.09, 0.01, 0.003), iron(), { p: [width - 0.06, 1.02, T / 2 + 0.03] });
    h.add(cyl(0.012, 0.012, 0.03, 6), iron(), { p: [width - 0.2, 1.02, T / 2 + 0.02], r: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 8; i++) h.add(sph(0.01, 5, 4), iron(), { p: [0.2 + i * 0.09, height * 0.5 + (i % 2) * 0.01, T / 2 + 0.024], s: [1, 1, 0.6] });
  }
  // hardware (all styles): hinges on x=0 edge, handle on latch side
  const hingeM = style === 'iron' || style === 'attic' ? iron() : brass();
  for (const y of [0.25, height * 0.5, height - rise - 0.2]) {
    h.add(cyl(0.013, 0.013, 0.12, 8), hingeM, { p: [0.006, y, T / 2 + 0.006] });
    h.add(bx(0.13, 0.055, 0.008, 0.002), hingeM, { p: [0.07, y, T / 2 + 0.006] });
    for (const k of [0.04, 0.1]) h.add(sph(0.007, 5, 4), hingeM, { p: [k, y, T / 2 + 0.014], s: [1, 1, 0.6] });
  }
  if (style === 'wood' || style === 'shifting') {
    const hx = width - 0.09, hy = 1.02;
    const plate = new THREE.Shape();
    plate.moveTo(-0.025, -0.09); plate.lineTo(0.025, -0.09); plate.lineTo(0.03, 0.06); plate.quadraticCurveTo(0, 0.1, -0.03, 0.06); plate.closePath();
    h.add(new THREE.ExtrudeGeometry(plate, { depth: 0.006, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1 }), gilt(), { p: [hx, hy, T / 2 + 0.003] });
    h.add(cyl(0.007, 0.007, 0.07, 8), brass(), { p: [hx, hy + 0.045, T / 2 + 0.03], r: [Math.PI / 2, 0, 0] });
    h.add(sph(0.017, 10, 8), brass(), { p: [hx, hy + 0.045, T / 2 + 0.065] });
    h.add(tube([[0, 0, 0], [-0.03, 0, 0.0], [-0.085, 0, 0.0], [-0.11, -0.012, 0.0]], 0.0065, 12, 6), brass(), { p: [hx, hy + 0.045, T / 2 + 0.03] });
    h.add(cyl(0.011, 0.011, 0.006, 10), plain(0x040302, 1), { p: [hx, hy - 0.03, T / 2 + 0.008], r: [Math.PI / 2, 0, 0] });
    h.add(bx(0.005, 0.02, 0.006), plain(0x040302, 1), { p: [hx, hy - 0.04, T / 2 + 0.008] });
    // back side knob
    h.add(sph(0.02, 10, 8), brass(), { p: [hx, hy + 0.045, -T / 2 - 0.05] });
    h.add(cyl(0.008, 0.008, 0.05, 8), brass(), { p: [hx, hy + 0.045, -T / 2 - 0.02], r: [Math.PI / 2, 0, 0] });
  }
  const warp = green ? (v: THREE.Vector3) => {
    const k = v.x / width;
    const bend = Math.sin(v.y * 2.2 + 0.7) * 0.014 * k + Math.sin(v.y * 6.0 + v.x * 3.0) * 0.004 * k;
    v.z += bend;
    v.x += Math.sin(v.y * 3.1) * 0.006 * k;
    v.y += Math.sin(v.x * 4.0) * 0.004 * k;
  } : undefined;
  const g = b.build(warp);
  h.build();
  g.add(...h.group.children.splice(0));
  return tag(g, { inlayMaterial: inlay ?? null, style, doorSize: { w: width, h: height }, hingeX: 0 });
}

/* ---------- floor mechanisms ---------- */
