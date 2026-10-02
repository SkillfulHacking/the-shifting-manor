import * as THREE from 'three';
import { Builder, archShape, bx, cyl, gilt, iron, brass, lathe, mesh, plain, ringGeo, smoothLathe, sph, tag, tint, tor, TAU, wood, tube, rng, V3, canvasTex, addChain, cupGeo, smoothSeams } from './util';
import { caseWood } from './clock';
import { turnedLeg, handle, knob, keyEscutcheon } from './furniture';

const glassMat = () => new THREE.MeshStandardMaterial({ color: 0xbcd4d8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.14, depthWrite: false });
let _glass: THREE.MeshStandardMaterial | null = null;
const glass = () => (_glass ??= glassMat());

/** panelled door helper: raised gothic-arched panel on a rectangular door slab at (x,y) facing +Z. */
function panelDoor(b: Builder, x: number, y: number, w: number, h: number, z: number, arch = true, m: THREE.Material = caseWood()) {
  const frame = 0.05;
  b.add(ringGeo(w, h, w - frame * 2, h - frame * 2, 0.03, 0.004), m, { p: [x, y, z] });
  const inset = tint('darkWood', 0x5c4432, { key: 'panelIn' });
  if (arch) {
    b.add(new THREE.ExtrudeGeometry(archShape(w - frame * 2 + 0.005, h - frame * 2 + 0.005, (w - frame * 2) * 0.55), { depth: 0.014, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 1, curveSegments: 6 }), inset, { p: [x, y - (h - frame * 2) / 2, z + 0.012] });
  } else b.add(bx(w - frame * 2 + 0.005, h - frame * 2 + 0.005, 0.014, 0.004), inset, { p: [x, y, z + 0.018] });
}

export function cabinet(w = 1.4, h = 1.9): THREE.Group {
  const b = new Builder();
  const wd = caseWood();
  const d = 0.48;
  const baseH = 0.85;
  // plinth & feet
  b.add(bx(w, 0.08, d, 0.008), wd, { p: [0, 0.04, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(sph(0.05, 10, 8), wd, { p: [sx * (w / 2 - 0.06), 0.03, sz * (d / 2 - 0.06)], s: [1, 0.8, 1] });
  // lower carcass
  b.add(bx(w - 0.04, baseH - 0.08, d - 0.04, 0.006), wd, { p: [0, 0.08 + (baseH - 0.08) / 2, 0] });
  // worktop overhang
  b.add(bx(w + 0.04, 0.04, d + 0.04, 0.012), wd, { p: [0, baseH + 0.02, 0.01] });
  // lower doors
  const dw = (w - 0.08) / 2;
  for (const s of [-1, 1]) {
    panelDoor(b, s * (dw / 2 + 0.005), 0.08 + (baseH - 0.08) / 2, dw - 0.01, baseH - 0.14, d / 2 - 0.03, true);
    knob(b, [s * 0.05, baseH * 0.55, d / 2 + 0.0], 0.02);
  }
  // upper glazed carcass: side posts, back, top
  const upH = h - baseH - 0.14;
  for (const s of [-1, 1]) b.add(bx(0.04, upH, d - 0.1, 0.004), wd, { p: [s * (w / 2 - 0.04), baseH + 0.04 + upH / 2, -0.02] });
  b.add(bx(w - 0.08, upH, 0.02), tint('darkWood', 0x6a5040, { key: 'cabBack' }), { p: [0, baseH + 0.04 + upH / 2, -d / 2 + 0.06] });
  b.add(bx(w - 0.06, 0.03, d - 0.1), wd, { p: [0, baseH + 0.05, -0.02] });
  // glass doors with muntins
  const gw = (w - 0.1) / 2, gh = upH - 0.02;
  const gy = baseH + 0.04 + upH / 2;
  const gz = d / 2 - 0.05;
  for (const s of [-1, 1]) {
    const gx = s * (gw / 2 + 0.002);
    b.add(ringGeo(gw, gh, gw - 0.07, gh - 0.07, 0.03, 0.004), wd, { p: [gx, gy, gz] });
    for (let i = 1; i < 3; i++) b.add(bx(0.014, gh - 0.06, 0.014), wd, { p: [gx - (gw - 0.07) / 2 + ((gw - 0.07) * i) / 3, gy, gz + 0.012] });
    for (let i = 1; i < 4; i++) b.add(bx(gw - 0.06, 0.014, 0.014), wd, { p: [gx, gy - (gh - 0.07) / 2 + ((gh - 0.07) * i) / 4, gz + 0.012] });
    b.add(bx(gw - 0.06, gh - 0.06, 0.004), glass(), { p: [gx, gy, gz + 0.014] }, { uv: 'keep' });
    knob(b, [s * 0.04, gy, gz + 0.03], 0.016);
  }
  // shelves and objects inside
  for (let i = 0; i < 3; i++) b.add(bx(w - 0.1, 0.014, d - 0.16), glass(), { p: [0, baseH + 0.04 + (upH * (i + 1)) / 4, -0.02] }, { uv: 'keep' });
  const vs = [0.12, 0.09, 0.14];
  for (let i = 0; i < 3; i++) {
    const sy = baseH + 0.047 + (upH * (i + 1)) / 4;
    const R = rng(i + 3);
    for (let k = 0; k < 3; k++) {
      const x = -w / 2 + 0.2 + k * (w - 0.4) / 2 + (R() - 0.5) * 0.06;
      const bh = 0.09 + R() * 0.08;
      b.add(smoothLathe([[0.0001, 0], [0.04, 0.0], [0.05, bh * 0.35], [0.03, bh * 0.75], [0.017, bh * 0.9], [0.022, bh]], 12, 3), i === 1 ? 'bone' : k === 1 ? 'copper' : 'silver', { p: [x, sy - (i > 0 ? 0 : 0), -0.03] });
    }
  }
  // cornice with dentils
  b.add(bx(w + 0.04, 0.05, d + 0.02, 0.006), wd, { p: [0, h - 0.1, 0.0] });
  b.add(bx(w + 0.1, 0.05, d + 0.08, 0.008), wd, { p: [0, h - 0.055, 0.02] });
  b.add(bx(w + 0.14, 0.03, d + 0.12, 0.006), wd, { p: [0, h - 0.015, 0.03] });
  const crest = new THREE.ExtrudeGeometry(archShape(w * 0.28, 0.16, 0.14), { depth: 0.02, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
  b.add(crest, wd, { p: [0, h, d / 2 + 0.03] });
  b.add(sph(0.02, 8, 6), gilt(), { p: [0, h + 0.19, d / 2 + 0.035] });
  return b.build();
}

export function wardrobe(): THREE.Group {
  const b = new Builder();
  const wd = caseWood();
  const w = 1.35, d = 0.62, h = 2.2;
  b.add(bx(w + 0.04, 0.09, d + 0.04, 0.008), wd, { p: [0, 0.135, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(smoothLathe([[0.03, 0], [0.05, 0.02], [0.055, 0.05], [0.035, 0.09], [0.04, 0.09]], 12, 3), wd, { p: [sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.06)] });
  b.add(bx(w, h - 0.28, d, 0.008), wd, { p: [0, 0.18 + (h - 0.28) / 2 - 0.0, 0] });
  // doors
  const dw = (w - 0.12) / 2, dh = h - 0.62;
  for (const s of [-1, 1]) {
    panelDoor(b, s * (dw / 2 + 0.003), 0.35 + dh / 2 + 0.05, dw - 0.006, dh, d / 2 - 0.01, true);
    // carved rosette in each panel
    b.add(tor(0.06, 0.01, 4, 16), gilt(), { p: [s * (dw / 2), 0.35 + dh / 2 + 0.15, d / 2 + 0.03] });
    b.add(sph(0.03, 8, 6), gilt(), { p: [s * (dw / 2), 0.35 + dh / 2 + 0.15, d / 2 + 0.03], s: [1, 1, 0.5] });
    handle(b, [s * 0.05, 1.05, d / 2 + 0.03], 0.1, true);
  }
  keyEscutcheon(b, [0, 1.0, d / 2 + 0.03]);
  // drawer strip at base
  b.add(bx(w - 0.1, 0.12, 0.02, 0.004), tint('darkWood', 0x8a6a50, { key: 'drawerFront' }), { p: [0, 0.32, d / 2 - 0.0] });
  knob(b, [-0.25, 0.32, d / 2 + 0.01], 0.016); knob(b, [0.25, 0.32, d / 2 + 0.01], 0.016);
  // cornice + arched crest
  b.add(bx(w + 0.04, 0.06, d + 0.03, 0.006), wd, { p: [0, h - 0.13, 0.0] });
  b.add(bx(w + 0.12, 0.06, d + 0.1, 0.008), wd, { p: [0, h - 0.07, 0.03] });
  b.add(bx(w + 0.16, 0.035, d + 0.14, 0.006), wd, { p: [0, h - 0.02, 0.04] });
  b.add(new THREE.ExtrudeGeometry(archShape(w * 0.42, 0.24, 0.2), { depth: 0.03, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 1 }), wd, { p: [0, h, d / 2 + 0.02] });
  b.add(tor(0.05, 0.008, 5, 18), gilt(), { p: [0, h + 0.1, d / 2 + 0.06] });
  for (const s of [-1, 1]) b.add(smoothLathe([[0.03, 0], [0.02, 0.04], [0.025, 0.08], [0.012, 0.13], [0.0001, 0.19]], 8, 2), wd, { p: [s * (w / 2 + 0.03), h + 0.01, d / 2 - 0.04] });
  return b.build();
}

export function chest(): THREE.Group {
  const b = new Builder();
  const wd = caseWood();
  const w = 1.0, d = 0.5, h = 0.42;
  const ib = iron();
  b.add(bx(w, h, d, 0.012), wd, { p: [0, h / 2 + 0.04, 0] });
  b.add(bx(w + 0.03, 0.05, d + 0.03, 0.01), wd, { p: [0, 0.03, 0] });
  // domed lid: half cylinder
  const lidGeo = new THREE.CylinderGeometry(d / 2 + 0.01, d / 2 + 0.01, w + 0.03, 20, 1, false, 0, Math.PI);
  b.add(lidGeo, wd, { p: [0, h + 0.04, 0], r: [0, 0, Math.PI / 2] , s: [0.7, 1, 1]});
  const lid = new THREE.Group(); lid.name = 'lid';
  // iron bands
  const bandX = [-w / 2 + 0.11, -w * 0.12, w * 0.12 + 0.0, w / 2 - 0.11];
  for (const x of bandX) {
    b.add(bx(0.06, h + 0.02, d + 0.02, 0.006), ib, { p: [x, h / 2 + 0.04, 0] });
    b.add(new THREE.CylinderGeometry(d / 2 + 0.025, d / 2 + 0.025, 0.06, 20, 1, false, 0, Math.PI), ib, { p: [x, h + 0.04, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 1] });
    for (const sz of [-1, 1]) for (const yy of [0.12, 0.34]) b.add(sph(0.011, 6, 5), ib, { p: [x, yy, sz * (d / 2 + 0.014)] });
  }
  // lock plate & hasp
  b.add(bx(0.09, 0.14, 0.012, 0.004), brass(), { p: [0, h + 0.02, d / 2 + 0.018] });
  b.add(cyl(0.012, 0.012, 0.004, 8), plain(0x050302, 1), { p: [0, h - 0.0, d / 2 + 0.026], r: [Math.PI / 2, 0, 0] });
  // side handles
  for (const s of [-1, 1]) b.add(tor(0.035, 0.005, 5, 12, Math.PI), ib, { p: [s * (w / 2 + 0.015), h * 0.62, 0], r: [0, Math.PI / 2, Math.PI] });
  // corner brackets
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(bx(0.06, 0.06, 0.06, 0.005), ib, { p: [sx * (w / 2 - 0.0), 0.06, sz * (d / 2 - 0.0)] });
  return b.build();
}

export function barrel(): THREE.Group {
  const b = new Builder();
  const wd = tint('darkWood', 0xb8926a, { key: 'barrel' });
  const H = 0.9;
  const prof: [number, number][] = [[0.0001, 0], [0.24, 0], [0.265, 0.1], [0.3, 0.3], [0.315, H / 2], [0.3, H - 0.3], [0.265, H - 0.1], [0.24, H], [0.0001, H]];
  const geo = smoothLathe(prof, 28, 4);
  // stave grooves
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r < 0.1) continue;
    const f = 1 - 0.006 * (0.5 - 0.5 * Math.cos(Math.atan2(z, x) * 28));
    p.setX(i, x * f); p.setZ(i, z * f);
  }
  smoothSeams(geo);
  b.add(geo, wd);
  // sunken head
  b.add(cyl(0.21, 0.21, 0.02, 24), wd, { p: [0, H + 0.001, 0] });
  const ib = iron();
  const hoopY: [number, number][] = [[0.06, 0.255], [0.19, 0.29], [H / 2 - 0.09, 0.313], [H / 2 + 0.09, 0.313], [H - 0.19, 0.29], [H - 0.06, 0.255]];
  for (const [y, r] of hoopY) b.add(cyl(r + 0.006, r + 0.006, 0.035, 28, true), ib, { p: [0, y, 0] }, { uv: 'keep' });
  for (const [y, r] of hoopY) b.add(cyl(r + 0.006, r + 0.006, 0.035, 28, true), ib, { p: [0, y, 0], s: [0.985, 1, 0.985] });
  // bung
  b.add(cyl(0.025, 0.025, 0.02, 8), plain(0x2a1a10, 1), { p: [0.28, H / 2, 0.08], r: [0, 0, Math.PI / 2] });
  b.add(cyl(0.05, 0.05, 0.01, 10), iron(), { p: [0.08, H + 0.012, 0.0] });
  return b.build();
}

export function crate(): THREE.Group {
  const b = new Builder();
  const wd = tint('darkWood', 0xc8a880, { roughness: 0.9, key: 'crate' });
  const s = 0.62;
  const R = rng(5);
  const nPl = 4, ph = s / nPl;
  for (const sz of [-1, 1]) {
    for (let i = 0; i < nPl; i++) {
      b.add(bx(s, ph - 0.006, 0.02, 0.003), wd, { p: [0, 0.03 + ph * (i + 0.5) - 0.0, sz * (s / 2 - 0.01)], r: [0, 0, (R() - 0.5) * 0.01] });
      b.add(bx(0.02, ph - 0.006, s - 0.04, 0.003), wd, { p: [sz * (s / 2 - 0.01), 0.03 + ph * (i + 0.5), 0], r: [0, 0, (R() - 0.5) * 0.01] });
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(bx(0.05, s, 0.05, 0.004), wd, { p: [sx * (s / 2 - 0.02), 0.03 + s / 2, sz * (s / 2 - 0.02)] });
  // top slats
  for (let i = 0; i < 4; i++) b.add(bx(s * 0.24, 0.02, s, 0.003), wd, { p: [-s * 0.375 + i * (s * 0.25), s + 0.03, 0] });
  // diagonal brace on front & bottom skids
  const dl = Math.hypot(s, s) * 0.92;
  b.add(bx(dl, 0.06, 0.02, 0.003), wd, { p: [0, 0.03 + s / 2, s / 2 + 0.01], r: [0, 0, Math.PI / 4] });
  b.add(bx(0.06, 0.03, s, 0.003), wd, { p: [-s / 2 + 0.06, 0.015, 0] }); b.add(bx(0.06, 0.03, s, 0.003), wd, { p: [s / 2 - 0.06, 0.015, 0] });
  // nails
  for (const sx of [-1, 1]) for (const yy of [0.1, 0.25, 0.4, 0.55]) b.add(sph(0.006, 4, 3), plain(0x222222, 0.5, 0.8), { p: [sx * (s / 2 - 0.02), 0.03 + yy, s / 2 + 0.012] });
  // stencil
  b.add(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshStandardMaterial({ map: canvasTex(128, 64, (g, W, H) => { g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, W, H); g.fillStyle = '#3a1c10'; g.font = 'bold 34px serif'; g.textAlign = 'center'; g.fillText('MANOR', W / 2, 32); g.font = '20px serif'; g.fillText('No. 13', W / 2, 54); }), transparent: true, roughness: 1 }), { p: [0.08, 0.34, s / 2 + 0.023], r: [0, 0, 0.04] }, { uv: 'keep' });
  return b.build();
}

export function wineRack(w = 2, h = 1.8): THREE.Group {
  const b = new Builder();
  const wd = tint('darkWood', 0xb09070, { key: 'rack' });
  const d = 0.34;
  const cell = 0.22;
  const cols = Math.max(2, Math.round((w - 0.08) / cell)), rows = Math.max(2, Math.round((h - 0.16) / cell));
  const cw = (w - 0.08) / cols, ch = (h - 0.16) / rows;
  for (const s of [-1, 1]) b.add(bx(0.04, h, d, 0.004), wd, { p: [s * (w / 2 - 0.02), h / 2, 0] });
  b.add(bx(w, 0.08, d + 0.02, 0.006), wd, { p: [0, 0.04, 0.0] });
  b.add(bx(w + 0.04, 0.05, d + 0.04, 0.008), wd, { p: [0, h - 0.025, 0] });
  b.add(bx(w - 0.08, h - 0.13, 0.015), plain(0x1a100a, 0.9), { p: [0, h / 2, -d / 2 + 0.01] });
  for (let r = 1; r < rows; r++) b.add(bx(w - 0.08, 0.02, d, 0.003), wd, { p: [0, 0.08 + ch * r, 0] });
  for (let c = 1; c < cols; c++) b.add(bx(0.02, h - 0.13, d, 0.003), wd, { p: [-w / 2 + 0.04 + cw * c, h / 2 - 0.005, 0] });
  // arched header
  b.add(new THREE.ExtrudeGeometry(archShape(w * 0.3, 0.12, 0.1), { depth: 0.02, bevelEnabled: false }), wd, { p: [0, h, d / 2 - 0.02] });
  const g = b.build();
  // bottles
  const R = rng(9);
  const bottleProfile: [number, number][] = [[0.0001, 0], [0.03, 0.0], [0.038, 0.006], [0.038, 0.16], [0.03, 0.2], [0.014, 0.24], [0.012, 0.29], [0.016, 0.3], [0.0001, 0.3]];
  const bg = smoothLathe(bottleProfile, 8, 2);
  bg.rotateX(Math.PI / 2); // axis along +Z (base at z=0, neck +z)
  bg.scale(1, 1, -1); // neck toward back, base toward front
  const cap = cols * rows;
  const gm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.0 });
  const inst = new THREE.InstancedMesh(bg, gm, cap);
  const m4 = new THREE.Matrix4(); const col = new THREE.Color(); let n = 0;
  const cols2 = [0x2f6a3a, 0x4a7a2e, 0x7a5a2a, 0x2c5c60];
  const cork = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 8).rotateX(Math.PI / 2), plain(0xb08b52, 0.8), cap);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (R() < 0.3) continue;
    const x = -w / 2 + 0.04 + cw * (c + 0.5), y = 0.08 + ch * (r + 0.5) - 0.005;
    const z = d / 2 - 0.02 + (R() - 0.5) * 0.02;
    m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.0, (R() - 0.5) * 0.06, 0)), new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(n, m4);
    col.setHex(cols2[Math.floor(R() * cols2.length)]); inst.setColorAt(n, col);
    m4.setPosition(x, y, z - 0.0005); cork.setMatrixAt(n, m4);
    n++;
  }
  inst.count = n; cork.count = 0; inst.castShadow = true; inst.receiveShadow = true;
  g.add(inst);
  return g;
}

/* ---------- kitchen ---------- */
function potGeo(r: number, h: number): THREE.BufferGeometry {
  return smoothLathe([[0.0001, 0], [r * 0.9, 0], [r, h * 0.08], [r * 1.02, h * 0.5], [r, h * 0.95], [r * 1.06, h], [r * 0.96, h], [r * 0.92, h * 0.95], [r * 0.96, h * 0.1], [0.0001, h * 0.06]], 14, 2);
}
function addPot(b: Builder, p: V3, r: number, h: number, lid = true, m: THREE.Material = iron()) {
  b.add(potGeo(r, h), m, { p });
  b.add(tor(r * 1.08, 0.005, 3, 12, Math.PI), m, { p: [p[0], p[1] + h * 0.85, p[2]] });
  b.add(tor(0.028, 0.005, 5, 10), m, { p: [p[0] + r * 1.08, p[1] + h * 0.8, p[2]], r: [0, Math.PI / 2, 0] });
  b.add(tor(0.028, 0.005, 5, 10), m, { p: [p[0] - r * 1.08, p[1] + h * 0.8, p[2]], r: [0, Math.PI / 2, 0] });
  if (lid) {
    b.add(smoothLathe([[0.0001, 0.1], [r * 0.3, 0.1], [r * 0.8, 0.04], [r * 1.04, 0.0], [r * 1.06, -0.008]].map(q => [q[0], q[1] * h * 0.4] as [number, number]), 20, 3), m, { p: [p[0], p[1] + h * 0.99, p[2]] });
    b.add(sph(0.017, 8, 6), brass(), { p: [p[0], p[1] + h * 1.05, p[2]] });
  }
}

export function kitchenRange(): THREE.Group {
  const b = new Builder();
  const ib = iron();
  const W = 1.7, D = 0.8, H = 0.92;
  // legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(smoothLathe([[0.04, 0], [0.03, 0.03], [0.045, 0.08], [0.03, 0.14], [0.05, 0.16]], 10, 3), ib, { p: [sx * (W / 2 - 0.07), 0, sz * (D / 2 - 0.07)] });
  b.add(bx(W, 0.06, D, 0.01), ib, { p: [0, 0.19, 0] });
  b.add(bx(W - 0.04, H - 0.28, D - 0.04, 0.012), ib, { p: [0, 0.22 + (H - 0.28) / 2, 0] });
  // top plate
  b.add(bx(W + 0.04, 0.045, D + 0.04, 0.012), ib, { p: [0, H - 0.02, 0] });
  // hobs
  for (let i = 0; i < 3; i++) {
    const x = -W / 2 + 0.28 + i * 0.4;
    b.add(smoothLathe([[0.0001, 0.02], [0.135, 0.02], [0.14, 0.0], [0.15, -0.005]], 20, 2), ib, { p: [x, H + 0.0, 0.06] });
    b.add(tor(0.09, 0.006, 4, 20), ib, { p: [x, H + 0.022, 0.06], r: [Math.PI / 2, 0, 0] });
    b.add(tor(0.05, 0.006, 4, 16), ib, { p: [x, H + 0.022, 0.06], r: [Math.PI / 2, 0, 0] });
    b.add(cyl(0.017, 0.02, 0.02, 8), brass(), { p: [x, H + 0.03, 0.06] });
  }
  b.add(bx(0.5, 0.008, 0.5), plain(0x0c0c0c, 0.8, 0.5), { p: [W / 2 - 0.3, H + 0.006, 0.0] });
  // oven doors with gothic panels
  const zf = D / 2;
  for (let i = 0; i < 2; i++) {
    const x = -W / 2 + 0.42 + i * 0.5;
    b.add(ringGeo(0.44, 0.44, 0.34, 0.34, 0.035, 0.006), ib, { p: [x, 0.5, zf - 0.03] });
    b.add(new THREE.ExtrudeGeometry(archShape(0.32, 0.32, 0.12), { depth: 0.015, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 }), plain(0x151515, 0.6, 0.7), { p: [x, 0.34, zf - 0.01] });
    b.add(tor(0.06, 0.008, 4, 16), brass(), { p: [x, 0.5, zf + 0.02] });
    b.add(cyl(0.008, 0.008, 0.38, 6), brass(), { p: [x, 0.7, zf + 0.055], r: [0, 0, Math.PI / 2] });
    for (const s of [-1, 1]) b.add(cyl(0.007, 0.007, 0.045, 6), brass(), { p: [x + s * 0.17, 0.7, zf + 0.035], r: [Math.PI / 2, 0, 0] });
    b.add(cyl(0.018, 0.018, 0.02, 12), brass(), { p: [x, 0.79, zf + 0.0], r: [Math.PI / 2, 0, 0] });
  }
  // firebox door (right)
  const fx = W / 2 - 0.3;
  b.add(ringGeo(0.4, 0.3, 0.3, 0.2, 0.035, 0.006), ib, { p: [fx, 0.44, zf - 0.03] });
  const grill = new THREE.Group();
  for (let i = 0; i < 5; i++) b.add(bx(0.008, 0.2, 0.01), ib, { p: [fx - 0.12 + i * 0.06, 0.44, zf - 0.012] });
  b.add(bx(0.3, 0.2, 0.008), plain(0x120404, 0.9), { p: [fx, 0.44, zf - 0.03] });
  b.add(cyl(0.02, 0.02, 0.03, 8), brass(), { p: [fx + 0.14, 0.44, zf + 0.0], r: [Math.PI / 2, 0, 0] });
  b.add(bx(0.4, 0.06, 0.05, 0.008), ib, { p: [fx, 0.24, zf - 0.02] });
  // trim: brass rail along the front top
  b.add(cyl(0.011, 0.011, W - 0.05, 8), brass(), { p: [0, H - 0.012, zf + 0.09], r: [0, 0, Math.PI / 2] });
  for (const s of [-1, 1]) b.add(bx(0.02, 0.07, 0.08), brass(), { p: [s * (W / 2 - 0.05), H - 0.012, zf + 0.05] });
  // ornamental frieze & embossed plates
  b.add(bx(W - 0.05, 0.05, 0.02, 0.005), plain(0x111111, 0.55, 0.7), { p: [0, H - 0.08, zf - 0.0] });
  for (let i = 0; i < 12; i++) b.add(sph(0.011, 6, 5), brass(), { p: [-W / 2 + 0.12 + i * (W - 0.24) / 11, H - 0.08, zf + 0.012], s: [1, 1, 0.6] });
  // back splash + chimney
  b.add(bx(W - 0.1, 0.5, 0.08, 0.01), ib, { p: [0, H + 0.28, -D / 2 + 0.06] });
  b.add(bx(W - 0.05, 0.05, 0.14, 0.01), ib, { p: [0, H + 0.56, -D / 2 + 0.08] });
  b.add(cyl(0.08, 0.08, 1.8, 14), ib, { p: [W / 2 - 0.35, H + 1.1, -D / 2 + 0.16] });
  b.add(cyl(0.11, 0.11, 0.05, 14), ib, { p: [W / 2 - 0.35, H + 0.65, -D / 2 + 0.16] });
  b.add(cyl(0.1, 0.1, 0.04, 14), ib, { p: [W / 2 - 0.35, H + 1.4, -D / 2 + 0.16] });
  b.add(sph(0.06, 8, 6), brass(), { p: [W / 2 - 0.35, H + 0.87, -D / 2 + 0.16 + 0.07], s: [1, 1, 0.5] });
  // pots
  addPot(b, [-W / 2 + 0.28, H + 0.025, 0.06], 0.12, 0.2, true);
  addPot(b, [-W / 2 + 0.68, H + 0.025, 0.06], 0.1, 0.13, false, tint('copper', 0xffffff, { key: 'cop' }));
  addPot(b, [-W / 2 + 1.08, H + 0.025, 0.06], 0.09, 0.22, true);
  // kettle
  const kx = W / 2 - 0.3;
  b.add(smoothLathe([[0.0001, 0], [0.11, 0], [0.13, 0.03], [0.12, 0.1], [0.07, 0.15], [0.05, 0.17]], 18, 3), 'copper', { p: [kx, H + 0.025, 0] });
  b.add(tube([[0.1, 0.05, 0], [0.15, 0.08, 0], [0.19, 0.14, 0], [0.2, 0.16, 0]], 0.014, 8, 6), 'copper', { p: [kx, H + 0.025, 0] });
  b.add(tor(0.09, 0.008, 4, 16, Math.PI), iron(), { p: [kx, H + 0.025 + 0.14, 0], r: [0, 0, 0] });
  const g = b.build();
  return tag(g, { fireAnchor: new THREE.Vector3(fx, 0.44, zf - 0.02), size: new THREE.Vector3(W, H + 1.8, D) });
}

/** Pot rack hanging from the ceiling attach point at origin (drop = chain length to the bar). */
export function hangingPots(drop = 1.1): THREE.Group {
  const b = new Builder();
  const ib = iron();
  const L = 1.3;
  for (const sx of [-1, 1]) {
    addChain(b, drop, ib, 0.06, sx * (L / 2 - 0.05), 0, 0);
    b.add(smoothLathe([[0.0001, 0.02], [0.05, 0.02], [0.06, 0], [0.03, -0.03]], 10, 2), ib, { p: [sx * (L / 2 - 0.05), 0, 0] });
  }
  const y = -drop - 0.02;
  b.add(bx(L, 0.035, 0.035, 0.006), ib, { p: [0, y, 0] });
  b.add(bx(L, 0.035, 0.035, 0.006), ib, { p: [0, y, 0.3] });
  for (const sx of [-1, 1]) {
    b.add(bx(0.035, 0.035, 0.3, 0.006), ib, { p: [sx * (L / 2 - 0.0175), y, 0.15] });
    b.add(sph(0.03, 8, 6), brass(), { p: [sx * (L / 2), y, 0] });
  }
  b.add(bx(0.03, 0.03, 0.3), ib, { p: [0, y, 0.15] });
  b.add(cyl(0.008, 0.008, L, 6), brass(), { p: [0, y - 0.035, 0.15], r: [0, 0, Math.PI / 2] });
  // hooks + hanging items
  const items: (() => void)[] = [];
  const hook = (x: number, z: number, drop2: number) => {
    b.add(tube([[0, 0, 0], [0, -0.05, 0], [0.03, -drop2 + 0.02, 0], [0.02, -drop2, 0]], 0.004, 10, 4), ib, { p: [x, y - 0.02, z] });
  };
  const xs = [-0.52, -0.3, -0.06, 0.16, 0.38, 0.55];
  const cop = tint('copper', 0xffffff, { key: 'cop' });
  xs.forEach((x, i) => {
    const z = i % 2 ? 0.02 : 0.28;
    const by = y - 0.02; // underside of bar
    if (i === 1 || i === 4) {
      // ladle hung from an S-hook
      hook(x, z, 0.1);
      b.add(cyl(0.006, 0.006, 0.34, 6), ib, { p: [x + 0.02, by - 0.3, z] });
      b.add(smoothLathe([[0.0001, 0], [0.045, 0.018], [0.05, 0.05], [0.0001, 0.05]], 12, 2), ib, { p: [x + 0.02, by - 0.5, z], r: [Math.PI, 0, 0] });
    } else {
      const r = 0.1 + (i % 3) * 0.025, ph = 0.12 + (i % 2) * 0.05;
      const bailTop = by - 0.16;
      const potY = bailTop - r * 1.08 - ph * 0.85;
      hook(x, z, 0.12);
      b.add(cyl(0.004, 0.004, by - bailTop, 5), ib, { p: [x + 0.02, (by + bailTop) / 2, z] });
      addPot(b, [x + 0.02, potY, z], r, ph, i === 0, i % 2 ? cop : ib);
    }
  });
  return b.build();
}

export function workTable(): THREE.Group {
  const b = new Builder();
  const wd = tint('darkWood', 0xb59470, { roughness: 0.85, key: 'work' });
  const w = 1.7, d = 0.85, h = 0.92;
  b.add(bx(w, 0.09, d, 0.014), wd, { p: [0, h - 0.045, 0] });
  b.add(bx(w - 0.08, 0.015, d - 0.08, 0.004), tint('darkWood', 0xe0c8a0, { key: 'blk' }), { p: [0, h + 0.005, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(bx(0.09, h - 0.09, 0.09, 0.008), wd, { p: [sx * (w / 2 - 0.09), (h - 0.09) / 2, sz * (d / 2 - 0.09)] });
  b.add(bx(w - 0.2, 0.06, 0.05, 0.005), wd, { p: [0, 0.22, d / 2 - 0.09] }); b.add(bx(w - 0.2, 0.06, 0.05, 0.005), wd, { p: [0, 0.22, -d / 2 + 0.09] });
  for (const sx of [-1, 1]) b.add(bx(0.05, 0.06, d - 0.2, 0.005), wd, { p: [sx * (w / 2 - 0.09), 0.22, 0] });
  b.add(bx(w - 0.2, 0.03, d - 0.2, 0.004), wd, { p: [0, 0.27, 0] });
  b.add(bx(w - 0.2, 0.13, 0.05, 0.005), wd, { p: [0, h - 0.15, d / 2 - 0.09] });
  b.add(bx(0.5, 0.11, 0.02, 0.004), tint('darkWood', 0x8a6a50, { key: 'drawerFront' }), { p: [0.3, h - 0.15, d / 2 - 0.06] });
  knob(b, [0.3, h - 0.15, d / 2 - 0.04], 0.016);
  // vice
  b.add(bx(0.1, 0.1, 0.12, 0.006), iron(), { p: [-w / 2 + 0.15, h + 0.05, d / 2 - 0.05] });
  b.add(cyl(0.01, 0.01, 0.2, 6), iron(), { p: [-w / 2 + 0.15, h + 0.06, d / 2 + 0.06], r: [Math.PI / 2, 0, 0] });
  // tools & items
  b.add(bx(0.4, 0.02, 0.28, 0.006), tint('darkWood', 0xf0dab0, { key: 'board' }), { p: [0.1, h + 0.02, 0.05], r: [0, 0.08, 0] });
  // cleaver and knife
  b.add(bx(0.2, 0.004, 0.09), 'silver', { p: [0.06, h + 0.03, 0.06], r: [0, 0.3, 0] });
  b.add(bx(0.11, 0.02, 0.026, 0.006), wd, { p: [-0.09, h + 0.03, 0.02], r: [0, 0.3, 0] });
  b.add(smoothLathe([[0.0001, 0], [0.08, 0], [0.1, 0.05], [0.11, 0.09], [0.09, 0.1], [0.0001, 0.1]].map(p => [p[0] * 0.9, p[1] * 1.0] as [number, number]), 18, 3), 'bone', { p: [-0.45, h + 0.012, -0.12] });
  b.add(smoothLathe([[0.0001, 0], [0.05, 0], [0.06, 0.1], [0.045, 0.2], [0.03, 0.22], [0.032, 0.24]], 12, 3), 'copper', { p: [0.55, h + 0.012, -0.2] });
  b.add(sph(0.06, 10, 8), 'pumpkinSkin', { p: [0.1, h + 0.06, -0.2], s: [1, 0.8, 1] });
  return b.build();
}
