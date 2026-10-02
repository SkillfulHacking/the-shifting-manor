import * as THREE from 'three';
import { Builder, canvasTex, mesh, rng, smoothSeams, tag, tube, cyl, sph, lathe, plain, iron, tor, addChain, bx, TAU, V3, tint } from './util';

/** Ribbed pumpkin body: unit-ish sphere with lobes, squash, and dimpled poles. */
export function pumpkinGeometry(seed = 1, lobes = 10, wSeg = 40, hSeg = 26): THREE.BufferGeometry {
  const r = rng(seed);
  const g = new THREE.SphereGeometry(0.5, wSeg, hSeg);
  const pos = g.attributes.position;
  const squash = 0.78 + r() * 0.1;
  const rib = 0.06 + r() * 0.03;
  const phase = r() * TAU;
  const lean = (r() - 0.5) * 0.06;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const rad = v.length();
    const az = Math.atan2(v.z, v.x);
    const cp = v.y / rad; // cos polar
    const sp = Math.sqrt(Math.max(0, 1 - cp * cp));
    const ribs = 1 - rib * (0.5 - 0.5 * Math.cos(lobes * az + phase)) * Math.pow(sp, 0.7);
    let k = ribs;
    // dimple at poles
    const dimple = Math.pow(Math.abs(cp), 14);
    let y = v.y * squash;
    y -= Math.sign(cp) * dimple * 0.075;
    const s = rad * k * (1 - 0.06 * Math.pow(Math.abs(cp), 3));
    pos.setXYZ(i, (v.x / rad) * s * (1 + lean * cp), y, (v.z / rad) * s);
  }
  smoothSeams(g);
  return g;
}

export function stemGeometry(h = 0.09, r = 0.022, curl = 0.35): THREE.BufferGeometry {
  const pts: V3[] = [[0, 0, 0], [0.004, h * 0.4, 0], [curl * 0.05 + 0.006, h * 0.75, 0], [curl * 0.16, h, 0]];
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(c, 8, r, 7);
  const p = geo.attributes.position;
  // flare at base & ridged
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, p.getY(i) / h));
    const f = 1 + (1 - t) * 0.9 * (1 - t);
    const a = Math.atan2(p.getZ(i), p.getX(i) - c.getPoint(t).x);
    const ridged = 1 + 0.12 * Math.cos(a * 5);
    const cx = c.getPoint(t).x;
    p.setX(i, cx + (p.getX(i) - cx) * f * ridged);
    p.setZ(i, p.getZ(i) * f * ridged);
  }
  geo.computeVertexNormals();
  return geo;
}

const stemMat = () => plain(0x55642c, 0.85);

function skin(seed: number): THREE.Material {
  const r = rng(seed * 7 + 3);
  const c = new THREE.Color().setHSL(0.06 + r() * 0.025, 0.55 + r() * 0.15, 0.62 + r() * 0.2);
  return tint('pumpkinSkin', c.getHex(), { key: 'pk' + Math.round(c.getHex() / 5000) });
}

/** Uncarved pumpkin; `size` = diameter in metres. Origin at bottom-centre. */
export function pumpkin(size = 0.4, seed = 1): THREE.Group {
  const r = rng(seed);
  const geo = pumpkinGeometry(seed, 8 + Math.floor(r() * 5), 24, 16);
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo, skin(seed));
  body.scale.setScalar(size);
  body.position.y = 0.5 * size * (0.78 + r() * 0.0) * 0.97;
  geo.computeBoundingBox();
  body.position.y = -geo.boundingBox!.min.y * size;
  body.castShadow = body.receiveShadow = true;
  const stem = new THREE.Mesh(stemGeometry(size * 0.2, size * 0.055, 0.3 + r() * 0.5), stemMat());
  stem.position.y = geo.boundingBox!.max.y * size * 0.93 + body.position.y - 0.0;
  stem.position.y = body.position.y + (geo.boundingBox!.max.y - 0.075) * size;
  stem.rotation.y = r() * TAU; stem.rotation.z = (r() - 0.5) * 0.3;
  stem.castShadow = true;
  g.add(body, stem);
  g.userData.height = (geo.boundingBox!.max.y - geo.boundingBox!.min.y) * size;
  return g;
}

export function pumpkinPile(seed = 1): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const spots: [number, number, number][] = [[0, 0, 0.38], [0.42, 0.1, 0.3], [-0.38, 0.12, 0.34], [0.12, -0.42, 0.28], [-0.2, -0.36, 0.24], [0.5, -0.32, 0.22], [0.06, -0.06, 0.26], [-0.55, -0.15, 0.2]];
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const [x, z, s] = spots[i];
    const p = pumpkin(s * (0.9 + r() * 0.25), seed * 13 + i);
    p.position.set(x, i === 6 ? 0.2 : 0, z);
    p.rotation.y = r() * TAU; p.rotation.x = (r() - 0.5) * 0.2; p.rotation.z = (r() - 0.5) * 0.2;
    g.add(p);
  }
  // scatter of dry leaves & a mini gourd
  const gourd = pumpkin(0.11, seed + 99);
  gourd.position.set(0.28, 0, 0.3); g.add(gourd);
  return g;
}

/* ------------- carved faces ------------- */
function drawFace(g: CanvasRenderingContext2D, W: number, H: number, face: number) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineJoin = 'round';
  const cx = W * 0.25, cy = H * 0.43;
  const U = W * 0.17; // half-width in px (u range 0.28)
  g.translate(0, cy); g.scale(1, 0.8); g.translate(0, -cy);
  const poly = (pts: number[][]) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(cx + x * U, cy + y * U) : g.moveTo(cx + x * U, cy + y * U)); g.closePath(); g.fill(); };
  switch (face % 4) {
    case 0: // classic triangles + jagged grin
      poly([[-0.72, -0.12], [-0.22, -0.12], [-0.47, -0.58]]);
      poly([[0.72, -0.12], [0.22, -0.12], [0.47, -0.58]]);
      poly([[0, 0.03], [-0.12, 0.2], [0.12, 0.2]]);
      poly([[-0.85, 0.3], [-0.6, 0.28], [-0.5, 0.42], [-0.34, 0.3], [-0.2, 0.52], [-0.05, 0.36], [0.05, 0.36], [0.2, 0.52], [0.34, 0.3], [0.5, 0.42], [0.6, 0.28], [0.85, 0.3], [0.6, 0.72], [0.3, 0.86], [0, 0.9], [-0.3, 0.86], [-0.6, 0.72]]);
      break;
    case 1: // round eyes, toothy smile
      g.beginPath(); g.ellipse(cx - 0.42 * U, cy - 0.3 * U, 0.2 * U, 0.24 * U, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(cx + 0.42 * U, cy - 0.3 * U, 0.2 * U, 0.24 * U, 0, 0, TAU); g.fill();
      poly([[0, 0], [-0.1, 0.16], [0.1, 0.16]]);
      g.beginPath(); g.moveTo(cx - 0.85 * U, cy + 0.28 * U); g.quadraticCurveTo(cx, cy + 1.18 * U, cx + 0.85 * U, cy + 0.28 * U);
      g.lineTo(cx + 0.7 * U, cy + 0.3 * U);
      for (let i = 0; i <= 6; i++) { const x = 0.7 - i * (1.4 / 6); g.lineTo(cx + x * U, cy + (0.3 + (i % 2 ? 0.16 : 0.0)) * U); }
      g.closePath(); g.fill();
      break;
    case 2: // angry slanted eyes, star nose, wide zig mouth
      poly([[-0.8, -0.42], [-0.15, -0.14], [-0.28, -0.02], [-0.72, -0.15]]);
      poly([[0.8, -0.42], [0.15, -0.14], [0.28, -0.02], [0.72, -0.15]]);
      poly([[0, -0.04], [0.09, 0.2], [-0.09, 0.2]]);
      poly([[-0.9, 0.35], [-0.5, 0.3], [-0.3, 0.55], [-0.1, 0.32], [0.1, 0.55], [0.3, 0.32], [0.5, 0.55], [0.7, 0.3], [0.9, 0.35], [0.7, 0.68], [0.35, 0.62], [0, 0.72], [-0.35, 0.62], [-0.7, 0.68]]);
      break;
    default: { // hollow crescent eyes, screaming oval
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(cx + s * 0.75 * U, cy - 0.5 * U);
        g.quadraticCurveTo(cx + s * 0.45 * U, cy - 0.05 * U, cx + s * 0.15 * U, cy - 0.4 * U);
        g.quadraticCurveTo(cx + s * 0.45 * U, cy - 0.28 * U, cx + s * 0.75 * U, cy - 0.5 * U); g.fill();
        g.beginPath(); g.ellipse(cx + s * 0.45 * U, cy - 0.28 * U, 0.26 * U, 0.2 * U, 0, 0, TAU); g.fill();
      }
      poly([[0, -0.04], [-0.1, 0.16], [0.1, 0.16]]);
      g.beginPath(); g.ellipse(cx, cy + 0.6 * U, 0.42 * U, 0.42 * U, 0, 0, TAU); g.fill();
      break;
    }
  }
}
const carveCache = new Map<number, THREE.CanvasTexture>();
function carveTex(face: number): THREE.CanvasTexture {
  const k = face % 4;
  let t = carveCache.get(k);
  if (!t) {
    t = canvasTex(1024, 512, (g, W, H) => drawFace(g, W, H, k), false);
    t.colorSpace = THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping;
    carveCache.set(k, t);
  }
  return t;
}
const shellCache = new Map<string, THREE.MeshStandardMaterial>();
function carvedShell(face: number, seed: number): THREE.MeshStandardMaterial {
  const key = `${face % 4}:${Math.round(seed) % 3}`;
  let m = shellCache.get(key);
  if (!m) {
    m = (skin(seed) as THREE.MeshStandardMaterial).clone();
    m.alphaMap = carveTex(face);
    m.alphaTest = 0.5;
    m.side = THREE.DoubleSide;
    shellCache.set(key, m);
  }
  return m;
}

/** Carved jack-o'-lantern; `size` is the diameter. Front (+Z) carries the face. */
export function jackOLantern(size = 0.4, face = 0, seed = 2): THREE.Group {
  const g = new THREE.Group();
  const geo = pumpkinGeometry(seed, 10, 44, 30);
  geo.computeBoundingBox();
  const b0 = geo.boundingBox!;
  const yOff = -b0.min.y * size;
  const shell = new THREE.Mesh(geo, carvedShell(face, seed));
  shell.scale.setScalar(size); shell.position.y = yOff;
  shell.castShadow = true; shell.receiveShadow = true;
  // inner glowing core (visible through carved holes)
  const glow = new THREE.MeshBasicMaterial({ color: 0xffb62e });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), glow);
  core.scale.set(size * 0.93, size * 0.7, size * 0.93); core.position.y = yOff + (b0.min.y + b0.max.y) * size * 0.5 * 0.0;
  core.position.y = yOff + 0.0 * size + (b0.max.y + b0.min.y) / 2 * size;
  core.userData.noShadow = true;
  // hot central gradient sprite-like disc behind face (additive)
  const halo = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), halo);
  haloMesh.scale.set(size * 0.55, size * 0.4, size * 0.55); haloMesh.position.copy(core.position); haloMesh.userData.noShadow = true;
  const stem = new THREE.Mesh(stemGeometry(size * 0.22, size * 0.058, 0.35), stemMat());
  stem.position.y = yOff + (b0.max.y - 0.078) * size; stem.rotation.y = seed;
  stem.castShadow = true;
  g.add(shell, core, haloMesh, stem);
  return tag(g, { glowMaterial: glow, haloMaterial: halo, flameAnchor: new THREE.Vector3(0, core.position.y - size * 0.1, 0) , face });
}

/** Small hanging iron lantern, containing a mini carved pumpkin as a position marker. Origin at top attach point. */
export function doorLantern(index: number, total: number): THREE.Group {
  const b = new Builder();
  const m = iron();
  addChain(b, 0.35, m);
  const top = -0.35;
  const s = 0.2; // cage half height scale
  // top cap
  b.add(new THREE.ConeGeometry(0.11, 0.09, 4, 1), m, { p: [0, top - 0.045, 0], r: [0, Math.PI / 4, 0] });
  b.add(tor(0.014, 0.004, 4, 10), m, { p: [0, top + 0.0, 0] });
  b.add(cyl(0.12, 0.09, 0.02, 4), m, { p: [0, top - 0.098, 0], r: [0, Math.PI / 4, 0] });
  // base
  const by = top - 0.098 - 0.26;
  b.add(cyl(0.085, 0.06, 0.03, 4), m, { p: [0, by, 0], r: [0, Math.PI / 4, 0] });
  b.add(new THREE.ConeGeometry(0.03, 0.06, 6), m, { p: [0, by - 0.045, 0], r: [Math.PI, 0, 0] });
  // 4 corner posts + rings
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const px = Math.cos(a) * 0.085, pz = Math.sin(a) * 0.085;
    b.add(cyl(0.006, 0.006, 0.26, 5), m, { p: [px, top - 0.098 - 0.13, pz] });
    b.add(sph(0.012, 6, 5), m, { p: [px, by + 0.02, pz] });
  }
  b.add(tor(0.085 * 1.0, 0.004, 4, 4, Math.PI * 2), m, { p: [0, top - 0.098 - 0.13, 0], r: [Math.PI / 2, 0, Math.PI / 4] });
  const g = b.build();
  const jack = jackOLantern(0.15, index, 3 + index);
  jack.position.y = by + 0.012;
  g.add(jack);
  // pips
  const pip = new THREE.SphereGeometry(0.007, 6, 5);
  for (let i = 0; i < total; i++) {
    const pm = mesh(pip, i === index ? plain(0xffc060, 0.4, 0.8, 0x553300, 0.6) : plain(0x2a2a2a, 0.6, 0.9), { p: [(i - (total - 1) / 2) * 0.026, by - 0.09, 0] });
    g.add(pm);
  }
  return tag(g, { glowMaterial: jack.userData.glowMaterial, haloMaterial: jack.userData.haloMaterial, flameAnchor: jack.position.clone().add(jack.userData.flameAnchor), index, total });
}
