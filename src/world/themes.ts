import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { RoomId } from '../game/types';
import { OBJECTS, DOORS, ROOM_BY_ID, DANCE } from '../data/manor';
import { danceState } from '../game/dance';
import * as P from './props';
import { DecorCtx, type ThemeSpec } from './room';
import { getMaterial, canvasTexture, sigilTexture, type SigilName } from '../rendering/textures';
import { uOf, boxMesh } from './wall';
import { spectre } from './ghostStyle';
import type { GameState } from '../game/state';

const WARM = 0xffa858;
const AMBER = 0xff9a44;
const PI = Math.PI;

/** Every note / matchbox in the room gets a small table with a piece of paper on it. */
function placeNotes(c: DecorCtx, rots: Record<string, number> = {}, skip: string[] = []) {
  for (const o of OBJECTS.filter((x) => x.room === c.def.id && (x.type === 'note' || x.type === 'matches') && !skip.includes(x.id))) {
    const { tab, paper } = c.noteTable(o, rots[o.id] ?? 0);
    c.interactable(o.id, o.x, 0.9 + gyAt(c, o.x, o.z), o.z, 0.7, 0.4, 0.6, [paper, tab]);
    if (o.type === 'matches') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.055), new THREE.MeshStandardMaterial({ color: 0x7a1e14, roughness: 0.7 }));
      box.position.set(o.x, 0.885, o.z);
      box.rotation.y = 0.5;
      c.add(box);
      // matches vanish once taken
      c.room.objAnimators.set(o.id, (st: GameState) => { box.visible = !st.flags.has('hasMatches'); paper.visible = !st.flags.has('hasMatches'); });
    }
  }
}

/** tame blown-out pale stone: clone shared materials with a warmer, darker tint */
const dimCache = new Map<THREE.Material, THREE.Material>();
function dimWhite<T extends THREE.Object3D>(o: T, tint = 0x8f8778): T {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat || Array.isArray(mat) || !(mat.name === 'marble' || mat.name === 'bone')) return;
    let d = dimCache.get(mat);
    if (!d) { const c = mat.clone(); c.color.setHex(tint); c.roughness = 1; c.envMapIntensity = 0.3; d = c; dimCache.set(mat, d); }
    m.material = d;
  });
  return o;
}

function gyAt(c: DecorCtx, x: number, z: number) {
  let g = 0;
  for (const st of c.room.colliders.steps) if (x > st.minX && x < st.maxX && z > st.minZ && z < st.maxZ) g = Math.max(g, st.top);
  return g;
}

function sconce(c: DecorCtx, wall: 'N' | 'E' | 'S' | 'W', coord: number, v = 1.8, light = true) {
  const s = P.wallSconce();
  c.onWall(wall, uOf(wall, coord), v, s);
  c.reserve(wall, uOf(wall, coord), 0.3);
  c.lightUp(s, light ? { intensity: 3.6, dist: 6.5, dy: 0.1 } : undefined);
  return s;
}

function paintings(c: DecorCtx, wall: 'N' | 'E' | 'S' | 'W', coords: number[], v = 2.3, seed0 = 1, w = 0.9, h = 1.2) {
  coords.forEach((k, i) => c.hang(wall, uOf(wall, k), v, P.paintingFrame(w, h + (i % 2) * 0.2, seed0 + i * 3 + 1), w / 2 + 0.05, 0.06));
}

function cobweb(c: DecorCtx, wall: 'N' | 'E' | 'S' | 'W', coord: number, v: number, s = 1.2) {
  const w = P.cobwebs(s, s, (Math.abs(coord) | 0) % 3);
  c.onWall(wall, uOf(wall, coord), v, w, 0.03);
}

function windowsSide(wall: 'N' | 'E' | 'S' | 'W', us: number[], w = 1.3, h = 2.4, sill = 0.9) {
  return us.map((u) => ({ wall, u, w, h, sill }));
}

// =========================================================================================== HALL
const hall: ThemeSpec = {
  wall: 'wallpaperGreen', wainscot: 'panelling', floor: 'marble', ceiling: 'ceilingPlaster', beams: true,
  windows: [...windowsSide('E', [2.8, -4.2], 1.4, 3.0, 1.0), ...windowsSide('S', [3.4, -3.4], 1.3, 2.6, 1.0)],
  moonWall: 'E', hemi: [0x3a4a78, 0x1a1218, 0.42], footstep: 'stone',
  crest: { wall: 'S', u: 0, v: 4.3, size: 0.9 },
  decor(c) {
    const { w, d, h } = c.def;
    // grand stair: a real, walkable flight up to a landing and a sealed door
    const gs = P.grandStair();
    const INS = 1.75;
    c.wallItem('N', 0, gs, { inset: INS, noCol: true });
    const n = 16, sd = 0.34, sh = 0.17;
    const gsz = gs.position.z - d / 2; // world z of the stair's local origin (front of first riser)
    for (let i = 0; i < n; i++) c.step({ minX: -1.5, maxX: 1.5, minZ: gsz - (i + 1) * sd, maxZ: gsz - i * sd, top: (i + 1) * sh });
    const zTop = gsz - n * sd; // back edge of the top step = front edge of the landing
    const landTop = n * sh;
    const LW = 2.7;
    c.step({ minX: -LW, maxX: LW, minZ: -d / 2, maxZ: zTop, top: landTop });
    const lm = boxMesh(LW * 2, landTop, zTop + d / 2, 'panelling');
    lm.position.set(0, landTop / 2, (zTop - d / 2) / 2);
    c.add(lm);
    const lf = boxMesh(LW * 2, 0.08, zTop + d / 2, 'floorboards');
    lf.position.set(0, landTop + 0.04, (zTop - d / 2) / 2);
    c.add(lf);
    // balustrade round the landing (gap left for the stair) + stair sides
    const rail = (x0: number, x1: number, z0: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
      const top = boxMesh(0.09, 0.07, len, 'darkWood');
      top.position.set((x0 + x1) / 2, landTop + 1.0, (z0 + z1) / 2); top.rotation.y = ang; c.add(top);
      const cnt = Math.max(2, Math.round(len / 0.22));
      for (let k = 0; k <= cnt; k++) {
        const t = k / cnt, post = boxMesh(0.045, 0.95, 0.045, 'darkWood');
        post.position.set(x0 + (x1 - x0) * t, landTop + 0.5, z0 + (z1 - z0) * t); c.add(post);
      }
      c.block((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) + 0.15, Math.abs(z1 - z0) + 0.15);
    };
    rail(-LW, -1.55, zTop, zTop); rail(1.55, LW, zTop, zTop);
    rail(-LW, -LW, -d / 2 + 0.1, zTop); rail(LW, LW, -d / 2 + 0.1, zTop);
    c.block(-1.62, (gsz + zTop) / 2, 0.14, gsz - zTop); c.block(1.62, (gsz + zTop) / 2, 0.14, gsz - zTop);
    sconce(c, 'N', -2.0, landTop + 1.6);
    sconce(c, 'N', 2.0, landTop + 1.6);
    const fc = P.fallenChandelier();
    c.putBB(fc, -2.9, -3.0, 0.4, { noCol: true }); c.block(-2.9, -3.0, 1.1, 1.1);
    c.place(P.rugRect(3.0, 3.2, 'red'), 0, gsz + 0.4 + 1.6, 0);
    // front door flanked by jack-o'-lanterns
    for (const [x, sd] of [[-1.7, 1], [1.8, 2]] as [number, number][]) {
      const j = P.jackOLantern(0.5, sd);
      c.putBB(j, x, d / 2 - 0.7, PI + (x > 0 ? -0.35 : 0.35), { noCol: true });
      c.lightUp(j, { intensity: 1.6, dist: 4.5, dy: 0.0 });
    }
    c.putBB(P.pumpkinPile(4), -3.6, d / 2 - 1.0, 0.6);
    c.putBB(P.leafPile(2), 0.4, d / 2 - 1.5, 0.3, { noCol: true });
    // fireplace on the west wall
    const fp = P.fireplace(2.6, 1.7, h - 1.8); dimWhite(fp);
    c.wallItem('W', uOf('W', 3.4), fp);
    const hp = new THREE.Vector3(-w / 2 + 0.7, 0.7, 3.4);
    c.room.hearthPos = hp;
    c.light(hp.x, 1.0, hp.z, 11, 12, AMBER, { flicker: 0.3 });
    const ember: THREE.MeshStandardMaterial | undefined = fp.userData.emberMaterial;
    if (ember) c.animate((t) => { ember.emissiveIntensity = 1.3 + Math.sin(t * 7) * 0.25 + Math.sin(t * 13) * 0.15; });
    c.onWall('W', uOf('W', 3.4), 3.55, P.paintingFrame(1.6, 2.0, 5), 0.03);
    // armour guards the collapsed stair
    for (const x of [-3.6, 3.6]) {
      const a = P.suitOfArmor();
      c.wallItem('N', x, a, { inset: 0.05 });
    }
    // S wall paintings + cobwebs
    paintings(c, 'W', [-1.5, -4.0], 2.6, 11);
    paintings(c, 'E', [-1.5 + 4.6], 2.6, 20, 1.0, 1.3);
    cobweb(c, 'N', -4.2, h - 1.6, 1.8);
    cobweb(c, 'N', 4.2, h - 1.6, 1.8);
    cobweb(c, 'S', 4.2, h - 1.4, 1.6);
    // table with the letter + candelabra (key light)
    placeNotes(c, { n_intro: 0.4, matches: -0.3 });
    const cand = P.candelabra(3);
    const ni = OBJECTS.find((o) => o.id === 'n_intro')!;
    c.place(cand, ni.x + 0.28, ni.z - 0.08, 0, undefined, 0.85);
    c.lightUp(cand, { intensity: 7, dist: 11, shadow: true, dy: 0.2 });
    // chandelier is not hanging: a dark ring of chain remains on the ceiling
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), getMaterial('ironBlack'));
    chain.position.set(0.2, h - 0.6, -2.6);
    c.add(chain);
    const cab = P.cabinet(1.3, 1.1);
    c.wallItem('S', uOf('S', 0.0) + 2.2 * 0 - 2.6 * 0, cab, { inset: 0.02 });
    c.add(new THREE.Object3D());
  },
};

// =========================================================================================== LIBRARY
const library: ThemeSpec = {
  wall: 'wallpaperRed', wainscot: 'panelling', floor: 'parquet', ceiling: 'ceilingPlaster', beams: true,
  windows: windowsSide('S', [1.2, 4.0], 1.2, 2.6, 0.9),
  moonWall: 'S', hemi: [0x3a3f66, 0x2a1a14, 0.4], footstep: 'wood',
  crest: { wall: 'E', u: -0.0, v: 3.6, size: 0.8 },
  decor(c) {
    const { w, d, h } = c.def;
    // bookshelves flank the restless door on the north wall
    c.wallItem('N', -2.4, P.bookshelf(2.4, 3.3, 0.42, 3));
    c.wallItem('N', 3.0, P.bookshelf(2.4, 3.3, 0.42, 7));
    c.wallItem('N', 4.35, P.bookshelf(0.5, 3.3, 0.42, 9), { noCol: true });
    c.wallItem('W', uOf('W', 2.4), P.bookshelf(3.0, 3.3, 0.42, 11));
    c.wallItem('W', uOf('W', -3.2), P.bookshelf(1.3, 3.3, 0.42, 5));
    // fireplace on the east wall, armchairs facing it
    const fp = P.fireplace(2.4, 1.6, h - 1.7); dimWhite(fp);
    c.wallItem('E', uOf('E', -2.2), fp);
    const hp = new THREE.Vector3(w / 2 - 0.7, 0.7, -2.2);
    c.room.hearthPos = hp;
    c.light(hp.x, 1.0, hp.z, 10, 11, AMBER, { flicker: 0.3 });
    const ember: THREE.MeshStandardMaterial | undefined = fp.userData.emberMaterial;
    if (ember) c.animate((t) => { ember.emissiveIntensity = 1.3 + Math.sin(t * 7.3) * 0.25 + Math.sin(t * 12) * 0.15; });
    c.onWall('E', uOf('E', -2.2), 3.3, P.paintingFrame(1.4, 1.1, 2), 0.03);
    c.putBB(P.armchair('red'), 2.4, -0.7, PI / 2 + 0.25, { shrink: 0.08 });
    c.putBB(P.armchair('red'), 2.6, -3.6, PI / 2 - 0.35, { shrink: 0.08 });
    c.place(P.rugRect(4.2, 3.2, 'blue'), 1.0, -1.6, 0);
    // reading table
    const tb = P.table(2.2, 1.0, 0.78, 'desk');
    c.putBB(tb, -1.0, 0.6, 0.1);
    const TOP = c.topOf(tb);
    const cd = P.candelabra(3);
    c.place(cd, -1.3, 0.75, 0, undefined, TOP);
    c.lightUp(cd, { intensity: 6, dist: 10, shadow: true });
    const gl = P.globe();
    c.place(gl, -0.2, 0.55, 0.4, undefined, TOP);
    c.putBB(P.diningChair(), -1.5, 1.6, PI + 0.2, { shrink: 0.1 });
    c.putBB(P.sofa(), 1.0, 2.6, PI, { shrink: 0.1 });
    // chandelier
    const ch = P.chandelier(0.8, 8);
    ch.position.set(-0.5, h, 0.5);
    c.add(ch);
    c.lightUp(ch);
    // hanging pumpkin display on the table + sconce
    const j = P.jackOLantern(0.35, 3);
    c.place(j, -2.0, 0.5, 0.6, undefined, TOP);
    c.lightUp(j, { intensity: 1.4, dist: 4, dy: 0 });
    sconce(c, 'S', -3.5, 1.9);
    paintings(c, 'S', [-0.4 + 0.0], 2.4, 30);
    cobweb(c, 'N', -4.6, h - 1.3, 1.6);
    cobweb(c, 'W', 3.8 * -1, h - 1.3, 1.6);
    placeNotes(c, { n_lantern: 0.3 });
  },
};

// =========================================================================================== DINING
const dining: ThemeSpec = {
  wallTint: 0x9fd0c4,
  wall: 'wallpaperGreen', wainscot: 'panelling', floor: 'floorboards', ceiling: 'ceilingPlaster', beams: true,
  windows: windowsSide('S', [-2.2, 2.2], 1.2, 2.6, 0.9),
  moonWall: 'S', hemi: [0x33406a, 0x241914, 0.38], footstep: 'wood',
  crest: { wall: 'N', u: 0, v: 3.6, size: 0.8 },
  decor(c) {
    const { w, d, h } = c.def;
    const fp = P.fireplace(2.4, 1.6, h - 1.7); dimWhite(fp);
    c.wallItem('N', 0, fp);
    const hp = new THREE.Vector3(0, 0.7, -d / 2 + 0.7);
    c.room.hearthPos = hp;
    c.light(hp.x, 1.0, hp.z, 9, 10, AMBER, { flicker: 0.3 });
    const ember: THREE.MeshStandardMaterial | undefined = fp.userData.emberMaterial;
    if (ember) c.animate((t) => { ember.emissiveIntensity = 1.3 + Math.sin(t * 6.1) * 0.25 + Math.sin(t * 11) * 0.15; });
    c.place(P.rugRect(5.2, 3.4, 'red'), 0, 0.6, 0);
    const tb = P.table(4.4, 1.3, 0.78, 'dining');
    c.putBB(tb, 0, 0.6, 0);
    const TOP = c.topOf(tb);
    for (let i = 0; i < 3; i++) {
      const x = -1.5 + i * 1.5;
      c.putBB(P.diningChair(), x, -0.35, 0, { shrink: 0.12 });
      c.putBB(P.diningChair(), x, 1.55, PI, { shrink: 0.12 });
    }
    c.putBB(P.diningChair(), -2.75, 0.6, PI / 2, { shrink: 0.12 });
    c.putBB(P.diningChair(), 2.75, 0.6, -PI / 2, { shrink: 0.12 });
    const cd = P.candelabra(5);
    c.place(cd, 0, 0.6, 0, undefined, TOP);
    c.lightUp(cd, { intensity: 8, dist: 11, shadow: true });
    for (const [x, s] of [[-1.5, 5], [1.6, 6]] as [number, number][]) {
      const j = P.jackOLantern(0.3, s);
      c.place(j, x, 0.6, 0.5, undefined, TOP);
      c.lightUp(j, { intensity: 1.0, dist: 3.5, dy: 0 });
    }
    const ch = P.chandelier(0.9, 10);
    ch.position.set(0, h, 0.6);
    c.add(ch);
    c.lightUp(ch);
    c.wallItem('E', uOf('E', 2.8), P.cabinet(1.8, 1.3));
    c.wallItem('W', uOf('W', 2.8), P.cabinet(1.6, 1.9));
    c.putBB(P.pumpkinPile(2), 3.0, 3.9, 0.3);
    paintings(c, 'W', [-3.2, 0.2], 2.6, 40, 1.0, 1.3);
    paintings(c, 'E', [0.5, 3.6], 2.6, 45, 1.0, 1.3);
    sconce(c, 'S', 0, 2.0);
    cobweb(c, 'N', 3.6, h - 1.2, 1.4);
    cobweb(c, 'E', -4.6, h - 1.2, 1.4);
    const cur = 0;
    void cur;
    placeNotes(c);
  },
};

// =========================================================================================== KITCHEN
const kitchen: ThemeSpec = {
  wall: 'plaster', wainscot: 'bricks', floor: 'flagstone', ceiling: 'ceilingPlaster', beams: true,
  windows: windowsSide('E', [0.8], 1.0, 1.3, 1.6),
  moonWall: 'E', hemi: [0x30395e, 0x2a1a10, 0.36], footstep: 'stone',
  crest: { wall: 'N', u: 0, v: 3.05, size: 0.7 },
  decor(c) {
    const { w, d, h } = c.def;
    const range = P.kitchenRange();
    c.wallItem('N', 0, range);
    c.room.hearthPos = new THREE.Vector3(0, 0.9, -d / 2 + 0.8);
    c.light(0, 1.1, -d / 2 + 1.0, 12, 11, 0xff8a3a, { shadow: true, flicker: 0.28 });
    const wt = P.workTable();
    c.putBB(wt, 0.4, 0.4, 0.05);
    const hp = P.hangingPots(1.1);
    hp.position.set(0.4, h, 0.4);
    c.add(hp);
    c.putBB(P.barrel(), 3.4, 2.8, 0);
    c.putBB(P.barrel(), 3.4, 1.9, 0.6);
    c.putBB(P.crate(), 3.3, 0.7, 0.3);
    c.putBB(P.crate(), 3.3, 0.7, 0.3, { noCol: true, y: 0.5 });
    c.putBB(P.pumpkinPile(6), -3.2, -2.6, 0.5);
    const j = P.jackOLantern(0.35, 4);
    c.place(j, 0.85, 0.65, 0.3, undefined, 0.93);
    c.lightUp(j, { intensity: 1.4, dist: 4, dy: 0 });
    c.wallItem('S', uOf('S', -2.6), P.cabinet(1.5, 1.9));
    c.wallItem('W', uOf('W', 2.2), P.wineRack(1.6, 1.6));
    sconce(c, 'W', 1.9, 2.0);
    cobweb(c, 'S', 3.4, h - 1.0, 1.2);
    placeNotes(c, { n_kitchen: 0.2 });
  },
};

// =========================================================================================== MIRRORS
const mirrors: ThemeSpec = {
  wallTint: 0xc4d4ff,
  wall: 'wallpaperBlue', wainscot: 'panelling', floor: 'parquet', ceiling: 'ceilingPlaster', beams: false,
  windows: windowsSide('E', [-4.5, 4.0], 1.2, 2.6, 0.9),
  moonWall: 'E', hemi: [0x34406e, 0x1a1420, 0.4], footstep: 'wood',
  crest: { wall: 'N', u: 0, v: 3.3, size: 0.85 },
  decor(c) {
    const { w, d, h } = c.def;
    // the wall mirror: a real planar reflection that also renders the spectral layer
    const mw = 3.2, mh = 2.7;
    const refl = new Reflector(new THREE.PlaneGeometry(mw, mh), { textureWidth: 1792, textureHeight: 1536, color: 0xdfe6f4, clipBias: 0.003 });
    const orig = refl.onBeforeRender.bind(refl);
    const room = c.room;
    refl.onBeforeRender = (r, s, cam, g, m, grp) => {
      const prev = room.spectral.visible;
      room.spectral.visible = true;
      orig(r, s, cam, g, m, grp);
      room.spectral.visible = prev;
    };
    c.onWall('W', uOf('W', -2), 2.45, refl, 0.075);
    c.onWall('W', uOf('W', -2), 2.45, P.mirrorFrame(mw, mh), 0.045);
    c.room.reflector = refl;
    // secondary, darker (dead) mirrors along the same wall
    for (const z of [2.6, -5.0]) {
      const fr = P.mirrorFrame(1.3, 2.1);
      c.onWall('W', uOf('W', z), 2.35, fr, 0.045);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.1), smokyGlass());
      c.onWall('W', uOf('W', z), 2.35, g, 0.065);
    }
    c.place(P.rugRect(2.6, 9.5, 'blue'), 0, 0.2, 0);
    // pedestal with the Seer's Glass
    const ped = P.pedestal(1.05);
    c.putBB(ped, 0, -5.0, 0);
    const hm = P.handMirror();
    hm.position.set(0, c.topOf(ped) + 0.01, -5.0);
    hm.rotation.set(-PI / 2 + 0.12, 0, 0.5);
    hm.scale.setScalar(1.15);
    c.add(hm);
    const halo = new THREE.PointLight(0x9fffe0, 0, 4, 2);
    halo.position.set(0, 1.5, -5.0);
    c.add(halo);
    c.animate((t) => { halo.intensity = (hm.visible ? 1 : 0) * (0.9 + Math.sin(t * 2) * 0.25); });
    c.room.objAnimators.set('handMirror', (st: GameState) => { hm.visible = !st.flags.has('hasMirror'); });
    c.interactable('handMirror', 0, 1.15, -5.0, 0.7, 0.5, 0.7, [hm]);
    // candelabra on plinths along the east wall
    let k = 0;
    for (const z of [4.6, 0.4, -4.3]) {
      const pl = P.pedestal(0.95);
      c.putBB(pl, w / 2 - 0.55, z, 0);
      const cd = P.candelabra(3);
      cd.position.set(w / 2 - 0.55, c.topOf(pl), z);
      c.add(cd);
      c.lightUp(cd, k++ === 0 ? { intensity: 4.2, dist: 8, shadow: true } : { intensity: 3.4, dist: 7 });
    }
    // dust sheets & a pair of statues
    c.putBB(dimWhite(P.statue('angel')), -w / 2 + 0.6, 5.0, PI / 2 - 0.2);
    // hidden writing (only the glass can read it): tells you when a door will show the room you are hunting
    const hint = spectralHint(2.5, 1.25);
    c.onWall('E', uOf('E', -0.05), 2.0, hint.mesh, 0.05);
    c.room.spectral.attach(hint.mesh);
    c.room.objAnimators.set('mirrorHint', (st: GameState) => hint.set(mirrorHintLines(st)));
    cobweb(c, 'S', -2.6, h - 1.0, 1.3);
    placeNotes(c);
  },
};

const WALLS = { N: 'north', E: 'east', S: 'south', W: 'west' } as const;
const HUNT: Record<number, string> = { 1: 'clock.s', 2: 'crypt.n', 4: 'atticstair.s' };
/** e.g. "THE EAST DOOR OF THE HALL OF MIRRORS SHOWS THE CLOCK ROOM AFTER THE HOUSE HAS TURNED TWICE" from the live cycle data */
function mirrorHintLines(st: GameState): string[] {
  const target = HUNT[st.phase];
  if (!target) return ['THE GLASS', 'REMEMBERS', 'EVERY WAY'];
  for (const d of DOORS) {
    if (d.kind !== 'shifting') continue;
    const c = st.cycle(d);
    const k = c.indexOf(target);
    if (k < 0) continue;
    const turns = (k - st.ptr[d.id] + c.length) % c.length;
    const when = turns === 0 ? 'NOW' : turns === 1 ? 'AFTER ONE TURN' : turns === 2 ? 'AFTER TWO TURNS' : `AFTER ${turns} TURNS`;
    const lines = [`THE ${WALLS[d.wall].toUpperCase()} DOOR OF`, ROOM_BY_ID[d.room].name.toUpperCase(), `SHOWS ${ROOM_BY_ID[st.door(target).room].name.toUpperCase()}`, when];
    if (st.phase === 1) lines.push('IF THE DOORS TURN IN STEP, HOLD ONE WITH A CANDLE');
    return lines;
  }
  return ['THE GLASS', 'REMEMBERS', 'EVERY WAY'];
}

function spectralHint(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 512;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9, fog: false, side: THREE.DoubleSide }));
  mesh.scale.x = -1; // written in mirror-writing so it reads correctly in the glass
  let last = '';
  return {
    mesh,
    set(lines: string[]) {
      const key = lines.join('|');
      if (key === last) return;
      last = key;
      const ctx = cv.getContext('2d')!;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.font = '700 76px "Palatino Linotype", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#3fe8b0';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#d8fff0';
      const y0 = 130 - (lines.length - 3) * 38;
      lines.forEach((l, i) => ctx.fillText(l, cv.width / 2, y0 + i * 100, 980));
      tex.needsUpdate = true;
    },
  };
}

let smokyTex: THREE.CanvasTexture | null = null;
/** an old, clouded mirror: smoky silver with foxing, so dead mirrors don't read as black holes */
function smokyGlass() {
  if (!smokyTex) {
    smokyTex = canvasTexture(256, 400, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w * 0.4, h * 0.35, 10, w / 2, h / 2, h * 0.7);
      g.addColorStop(0, '#6d7d94'); g.addColorStop(0.6, '#3a475c'); g.addColorStop(1, '#161c28');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(${20 + Math.random() * 40},${25 + Math.random() * 30},${30 + Math.random() * 40},${Math.random() * 0.35})`; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 14, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(210,225,255,0.10)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.9); ctx.lineTo(w * 0.7, h * 0.05); ctx.stroke();
    });
  }
  return new THREE.MeshStandardMaterial({ map: smokyTex, roughness: 0.18, metalness: 0.7, emissive: 0x1a2438, emissiveMap: smokyTex, emissiveIntensity: 0.9 });
}

const numeralCache = new Map<string, THREE.CanvasTexture>();
function numeralTex(txt: string) {
  let t = numeralCache.get(txt);
  if (!t) {
    t = canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(20,12,6,0.65)'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 56, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = '#f0d078'; ctx.font = '700 70px "Palatino Linotype", Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(['', 'I', 'II', 'III', 'IV'][Number(txt)] ?? txt, w / 2, h / 2 + 4);
    });
    numeralCache.set(txt, t);
  }
  return t;
}

function spectralText(lines: string[], w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, 1024, 256);
  ctx.font = '600 84px "Palatino Linotype", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9df3d0';
  ctx.shadowColor = '#5fffc0';
  ctx.shadowBlur = 26;
  lines.forEach((l, i) => ctx.fillText(l, 512, 100 + i * 100));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8, fog: false }));
  return m;
}

// =========================================================================================== GALLERY
const gallery: ThemeSpec = {
  wallTint: 0xffc8b8,
  wall: 'wallpaperRed', wainscot: 'panelling', floor: 'floorboards', ceiling: 'ceilingPlaster', beams: true,
  windows: windowsSide('E', [-3.6], 1.1, 2.6, 0.9),
  moonWall: 'E', hemi: [0x363e68, 0x2a1616, 0.4], footstep: 'wood',
  crest: { wall: 'S', u: 0, v: 3.55, size: 0.8 },
  decor(c) {
    const { w, d, h } = c.def;
    c.place(P.rugRect(2.4, 12.5, 'red'), 0, -0.4, 0);
    paintings(c, 'W', [-5.8, -3.2, -0.6, 2.0], 2.35, 60, 1.05, 1.35);
    paintings(c, 'E', [-6.0, -1.0, 1.8], 2.35, 90, 1.05, 1.35);
    // armour and statues
    c.wallItem('W', uOf('W', 2.6), P.suitOfArmor(), { inset: 0.05 });
    c.wallItem('E', uOf('E', -2.3), P.suitOfArmor(), { inset: 0.05 });
    c.putBB(dimWhite(P.statue('angel')), 0, 6.2, PI);
    c.putBB(P.statue('bust'), -2.0, 6.4, PI - 0.3, { noCol: true, y: 0 });
    for (const [wall, z] of [['W', -4.4], ['W', 0.7], ['E', -5.0], ['E', 0.0]] as ['W' | 'E', number][]) sconce(c, wall, z, 1.9, z === 0.7 || z === -5.0);
    const cd = P.candelabra(3);
    c.place(cd, 0, 4.9, 0, undefined, 0);
    cd.scale.setScalar(1.6);
    c.lightUp(cd, { intensity: 6, dist: 10, shadow: true, dy: 0.5 });
    cobweb(c, 'N', 2.2, h - 1.3, 1.6);
    cobweb(c, 'S', -2.2, h - 1.3, 1.6);
    placeNotes(c, { n_clock: 0.2 });
  },
};

// =========================================================================================== CONSERVATORY
const conservatory: ThemeSpec = {
  wall: 'plaster', wainscot: 'bricks', floor: 'flagstone', ceiling: 'ceilingPlaster',
  windows: [...windowsSide('N', [-2.8, 2.8], 1.6, 3.6, 0.7), ...windowsSide('S', [-2.8, 2.8], 1.6, 3.6, 0.7), ...windowsSide('E', [-3.0, 3.0], 1.2, 3.4, 0.7), ...windowsSide('W', [-3.0, 3.0], 1.2, 3.4, 0.7)],
  moonWall: 'N', hemi: [0x40567f, 0x1c2a1c, 0.5], footstep: 'stone', skylight: true,
  crest: { wall: 'N', u: 0, v: 3.6, size: 0.9 },
  decor(c) {
    const { w, d, h } = c.def;
    const st = dimWhite(P.statue('angel'));
    const ped = P.pedestal(0.9);
    c.putBB(ped, 0, 0, 0);
    st.position.set(0, 0.92, 0);
    st.scale.setScalar(0.85);
    c.add(st);
    // plants
    const spots: [string, number, number, number][] = [
      ['palm', -3.6, -3.6, 2.3], ['palm', 3.6, -3.6, 2.0], ['palm', -3.6, 3.6, 2.2], ['palm', 3.7, 3.5, 2.4], ['palm', 0.0, -3.9, 1.8],
      ['fern', -2.4, -3.9, 1.5], ['fern', 2.3, -3.9, 1.5], ['ivy', -3.9, -1.5, 1.4], ['fern', 3.9, 1.5, 1.4], ['dead', -2.4, 3.9, 1.3], ['fern', 2.0, 3.9, 1.4], ['ivy', 3.9, -1.5, 1.3], ['fern', -3.9, 1.8, 1.5], ['palm', 0.0, 3.9, 1.9],
    ];
    spots.forEach(([k, x, z, s], i) => { c.putBB(P.plantPot(k as 'palm', s, i + 1), x, z, i * 0.7, { noCol: true }); c.block(x, z, 0.55, 0.55); });
    let benchTop = 0.47;
    // stone benches
    for (const [x, z, r] of [[-2.1, 0.0, PI / 2], [2.1, 0.0, -PI / 2]] as [number, number, number][]) {
      const b = P.table(1.6, 0.5, 0.45, 'side');
      c.putBB(b, x, z, r);
      benchTop = c.topOf(b);
    }
    const hp = P.hangingPlant();
    hp.position.set(-2, h - 0.5, -2);
    c.add(hp);
    const hp2 = P.hangingPlant();
    hp2.position.set(2.2, h - 0.5, 2.2);
    c.add(hp2);
    const cd = P.candelabra(3);
    cd.position.set(-2.1, benchTop, 0.0);
    c.add(cd);
    c.lightUp(cd, { intensity: 4.5, dist: 8, shadow: true });
    const j = P.jackOLantern(0.4, 7);
    j.position.set(2.1, benchTop, 0.2);
    c.add(j);
    c.lightUp(j, { intensity: 1.5, dist: 4, dy: 0 });
    c.putBB(P.pumpkinPile(9), 3.4, -1.9, 0.5, { noCol: true }); c.block(3.4, -1.9, 0.9, 0.9);
    c.putBB(P.leafPile(4), -1.6, -1.6, 0, { noCol: true });
    sconce(c, 'E', 1.9, 1.9);
    // iron roof ribs under the glass roof
    const ribMat = getMaterial('ironBlack');
    for (let x = -w / 2 + 1.5; x < w / 2; x += 3) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, d + 0.4), ribMat);
      rib.position.set(x, h + 0.05, 0);
      rib.castShadow = true;
      c.add(rib);
    }
    for (let z = -d / 2 + 1.5; z < d / 2; z += 3) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.1, 0.1), ribMat);
      rib.position.set(0, h + 0.05, z);
      rib.castShadow = true;
      c.add(rib);
    }
    placeNotes(c);
  },
};

// =========================================================================================== CELLAR
const cellar: ThemeSpec = {
  wall: 'stoneWall', floor: 'flagstone', ceiling: 'stoneWall', beams: false,
  windows: [{ wall: 'S', u: -1.5, w: 0.9, h: 0.55, sill: 2.35 }],
  moonWall: 'S', hemi: [0x2a3555, 0x18120e, 0.3], footstep: 'stone',
  crest: { wall: 'N', u: 2.0, v: 2.2, size: 0.7 },
  decor(c) {
    const { w, d, h } = c.def;
    c.wallItem('W', uOf('W', -2.0), P.wineRack(2.4, 2.0));
    c.wallItem('W', uOf('W', 1.6), P.wineRack(2.4, 2.0));
    c.wallItem('S', uOf('S', 1.0), P.wineRack(2.0, 2.0));
    for (const [x, z, r] of [[2.4, 3.0, 0], [3.3, 2.6, 0.7], [1.6, 3.3, 0.2], [3.2, 1.2, 0.3]] as [number, number, number][]) c.putBB(P.barrel(), x, z, r);
    c.putBB(P.crate(), -2.6, 3.2, 0.2);
    c.putBB(P.crate(), 0.0, -3.4, 0.5);
    c.putBB(P.chest(), 3.2, -3.2, -0.4);
    c.putBB(P.pumpkinPile(12), -3.2, -3.2, 0.7);
    const cd = P.candelabra(3);
    c.place(cd, 2.9, 2.6, 0, undefined, 0);
    const bar = c.room.group.children[c.room.group.children.length - 1];
    void bar;
    cd.position.set(2.85, 0.98, 2.8);
    c.lightUp(cd, { intensity: 5, dist: 9, shadow: true });
    sconce(c, 'N', 0.6, 1.8);
    sconce(c, 'W', 0.0, 1.9);
    sconce(c, 'S', -2.0, 1.9);
    cobweb(c, 'W', 3.2, h - 0.7, 1.4);
    cobweb(c, 'S', -3.4, h - 0.8, 1.4);
    cobweb(c, 'N', -3.6, h - 0.8, 1.4);
    placeNotes(c);
  },
};

// =========================================================================================== CRYPT
const crypt: ThemeSpec = {
  wall: 'stoneWall', floor: 'stoneFloor', ceiling: 'stoneWall',
  windows: [],
  moonWall: 'N', hemi: [0x2a3a52, 0x141a18, 0.34], footstep: 'stone',
  crest: { wall: 'E', u: 0, v: 2.7, size: 0.75 },
  decor(c) {
    const { w, d, h } = c.def;
    const cf = P.coffin();
    const bier = P.pedestal(0.3);
    void bier;
    c.putBB(cf, 0, -0.6, PI / 2, { shrink: 0.02 });
    const lid = cf.getObjectByName('lid');
    let slide = 0;
    c.room.objAnimators.set('coffin', (st: GameState) => { slide += ((st.flags.has('lordFreed') ? 1 : 0) - slide) * 0.03; if (lid) lid.position.x = slide * 0.9; });
    c.interactable('coffin', 0, 0.9, -0.6, 1.0, 1.1, 2.2, [cf]);
    // graves and niches
    c.wallItem('W', uOf('W', -2.5), P.gravestone(2), { inset: 0.05 });
    c.wallItem('W', uOf('W', 0.4), P.gravestone(5), { inset: 0.05 });
    c.wallItem('W', uOf('W', 2.9), P.gravestone(7), { inset: 0.05 });
    c.wallItem('E', uOf('E', -3.0), P.sarcophagus(), { inset: 0.05 });
    c.wallItem('E', uOf('E', 2.9), P.gravestone(11), { inset: 0.05 });
    for (const [x, z, s] of [[-2.9, 4.0, 3], [2.9, 3.9, 4], [2.8, -3.9, 5], [-2.8, -4.0, 6]] as [number, number, number][]) {
      const cl = P.candleCluster(s);
      c.place(cl, x, z, 0);
      c.lightUp(cl, { intensity: 3.2, dist: 7, shadow: s === 3, dy: 0.3, color: 0xffb060 });
    }
    const sk = P.skull();
    c.place(sk, 1.2, 0.0, 0, undefined, 0);
    cobweb(c, 'N', -2.6, h - 1.0, 1.6);
    cobweb(c, 'N', 2.6, h - 1.0, 1.6);
    cobweb(c, 'S', 2.8, h - 1.0, 1.5);
    // Ambrose, released: hovers over the coffin
    const lord = spectre(1.0, 'cold');
    lord.position.set(0, 1.1, -0.6);
    lord.visible = false;
    c.add(lord);
    c.animate((t) => { const u = lord.userData.update; if (u) u(t); lord.position.y = 1.15 + Math.sin(t * 0.7) * 0.1; });
    c.room.objAnimators.set('lord', (st: GameState) => { lord.visible = st.flags.has('lordFreed'); });
    placeNotes(c, { n_crypt: 0.2, n_echo: -0.4 });
  },
};

// =========================================================================================== CLOCK ROOM
const clockRoom: ThemeSpec = {
  wallTint: 0xb4b8ff,
  wall: 'wallpaperBlue', wainscot: 'panelling', floor: 'parquet', ceiling: 'ceilingPlaster', beams: true,
  windows: windowsSide('W', [-1.6, 1.6], 1.2, 3.4, 1.0),
  moonWall: 'W', hemi: [0x35406a, 0x241a14, 0.4], footstep: 'wood',
  crest: { wall: 'S', u: -1.5, v: 3.7, size: 0.85 },
  decor(c) {
    const { w, d, h } = c.def;
    const clk = P.grandfatherClock();
    clk.scale.setScalar(1.35);
    c.wallItem('N', 0, clk, { inset: 0.04 });
    c.room.clockPos = new THREE.Vector3(0, 1.8, -d / 2 + 0.5);
    const pend: THREE.Object3D | undefined = clk.userData.pendulum;
    const hh: THREE.Object3D | undefined = clk.userData.hourHand;
    const mh: THREE.Object3D | undefined = clk.userData.minuteHand;
    // hands: stopped at a stuck time until wound, then follow the clock phase
    const times = [9, 10, 11, 11.5, 12];
    c.room.objAnimators.set('clock', (st: GameState, t: number) => {
      const wound = st.flags.has('clockWound');
      let hr = wound ? times[st.phase] : 4.25;
      const min = (hr % 1) * 60;
      if (hh) hh.rotation.z = -((Math.floor(hr) % 12) / 12 + min / 720) * Math.PI * 2;
      if (mh) mh.rotation.z = -(min / 60) * Math.PI * 2;
      if (pend) pend.rotation.z = wound ? Math.sin(t * 3.1) * 0.16 : 0.0;
    });
    c.interactable('clockWind', 0, 1.9, -d / 2 + 0.8, 1.2, 2.6, 1.0, [clk]);
    // brass gearworks on the west wall, turning once the clock is wound
    const gears: THREE.Group[] = [];
    for (const [z, r, teeth, v] of [[2.6, 0.7, 20, 3.4], [3.9, 0.45, 12, 2.5], [1.3, 0.35, 10, 2.5]] as [number, number, number, number][]) {
      const g = makeGear(r, teeth);
      c.onWall('E', uOf('E', z * -1), v, g, 0.06);
      gears.push(g);
    }
    let gt = 0;
    c.room.objAnimators.set('gears', (st: GameState) => { gt = st.flags.has('clockWound') ? 1 : 0; });
    c.animate((t, dt) => { gears.forEach((g, i) => { g.rotation.z += dt * 0.35 * gt * (i % 2 ? -1.6 : 1); }); });
    c.place(P.rugRect(4.4, 4.4, 'blue'), 0, 0.2, 0);
    c.putBB(P.armchair('green'), -2.4, -1.6, PI / 2 + 0.3);
    const sideT = P.table(1.0, 0.6, 0.6, 'side');
    c.putBB(sideT, -2.9, 0.4, 0.3);
    const cd = P.candelabra(3);
    cd.position.set(-2.9, c.topOf(sideT), 0.4);
    c.add(cd);
    c.lightUp(cd, { intensity: 6, dist: 10, shadow: true });
    c.wallItem('S', uOf('S', 1.8), P.cabinet(1.3, 1.9));
    c.putBB(P.pumpkinPile(3), 2.6, 2.7, 0.4);
    sconce(c, 'N', -2.4, 2.2);
    sconce(c, 'N', 2.4, 2.2);
    cobweb(c, 'E', 2.9, h - 1.4, 1.8);
    cobweb(c, 'W', -3.2, h - 1.4, 1.8);
    placeNotes(c, { n_ambrose: 0.5 });
  },
};

function makeGear(r: number, teeth: number) {
  const g = new THREE.Group();
  const m = getMaterial('brass');
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 32, 1, false), m);
  disc.rotation.x = PI / 2;
  g.add(disc);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.22, 0.06, 16), getMaterial('ironBlack'));
  hole.rotation.x = PI / 2;
  g.add(hole);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * PI * 2;
    const t = new THREE.Mesh(new THREE.BoxGeometry(r * 0.24, r * 0.2, 0.05), m);
    t.position.set(Math.cos(a) * (r + r * 0.07), Math.sin(a) * (r + r * 0.07), 0);
    t.rotation.z = a;
    g.add(t);
  }
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, r * 0.12, 0.04), m);
    sp.rotation.z = (i / 4) * PI;
    sp.position.z = 0.01;
    g.add(sp);
  }
  g.traverse((o) => { (o as THREE.Mesh).castShadow = true; (o as THREE.Mesh).receiveShadow = true; });
  return g;
}

// =========================================================================================== UPPER HALL
const upper: ThemeSpec = {
  wallTint: 0xd2d8a8,
  wall: 'wallpaperGreen', wainscot: 'panelling', floor: 'floorboards', ceiling: 'ceilingPlaster', beams: true,
  windows: [...windowsSide('W', [-3.0, 3.2], 1.1, 2.6, 0.9), ...windowsSide('E', [3.4, -3.4 + 7], 1.1, 2.6, 0.9)],
  moonWall: 'E', hemi: [0x4a4a88, 0x2c1a20, 0.55], footstep: 'wood',
  crest: { wall: 'S', u: 0, v: 3.5, size: 0.8 },
  decor(c) {
    const { w, d, h } = c.def;
    c.place(P.rugRect(2.2, 11, 'red'), 0, 0, 0);
    paintings(c, 'W', [0.2, 3.5], 2.35, 120, 1.0, 1.3);
    paintings(c, 'E', [-5.0, 0.6], 2.35, 140, 1.0, 1.3);
    c.wallItem('W', uOf('W', -4.9), P.suitOfArmor(), { inset: 0.05 });
    c.wallItem('E', uOf('E', 4.9), P.suitOfArmor(), { inset: 0.05 });
    c.putBB(P.statue('urn'), -2.3, -5.3, 0);
    c.wallItem('E', uOf('E', 2.0), P.cabinet(1.3, 1.1));
    const cd = P.candelabra(3);
    c.place(cd, 2.3, 4.6, 0, undefined, 0);
    cd.scale.setScalar(1.5);
    c.lightUp(cd, { intensity: 6, dist: 10, shadow: true, dy: 0.5 });
    sconce(c, 'S', 2.0, 2.0);
    sconce(c, 'S', -2.0, 2.0);
    cobweb(c, 'N', -2.6, h - 1.0, 1.6);
    cobweb(c, 'N', 2.6, h - 1.0, 1.6);
    cobweb(c, 'W', 4.6, h - 1.3, 1.5);
    c.putBB(P.pumpkinPile(7), -2.4, 4.7, 0.4);
    placeNotes(c, { n_upper: 0.3 });
  },
};

// =========================================================================================== ATTIC STAIR
const atticstair: ThemeSpec = {
  wall: 'plaster', wainscot: 'panelling', floor: 'floorboards', ceiling: 'ceilingPlaster',
  windows: [{ wall: 'W', u: 1.0, w: 0.9, h: 2.0, sill: 3.6 }],
  moonWall: 'W', hemi: [0x4a5488, 0x2c2024, 0.6], footstep: 'wood',
  crest: { wall: 'S', u: 0, v: 3.4, size: 0.7 },
  decor(c) {
    const { w, d, h } = c.def;
    // steep stair: ground at z=+2.8 rising to a landing (y=2.7) at z<=-2.2; landing door on the north wall
    const rise = 2.7, n = 15, run = 0.34, stepH = rise / n;
    const z0 = 2.7;
    const wood = getMaterial('darkWood');
    for (let i = 0; i < n; i++) {
      const top = (i + 1) * stepH;
      const zc = z0 - (i + 0.5) * run;
      const m = boxMesh(2.6, top, run, 'darkWood');
      m.position.set(0, top / 2, zc);
      m.castShadow = true; m.receiveShadow = true;
      c.add(m);
      c.step({ minX: -1.3, maxX: 1.3, minZ: zc - run / 2, maxZ: zc + run / 2, top });
    }
    const landZ0 = z0 - n * run; // -2.4
    const land = new THREE.Mesh(new THREE.BoxGeometry(3.6, rise, d / 2 - 0.0 + landZ0 * 1 + 0.0), wood);
    void land;
    const lz1 = -d / 2, lz0 = landZ0;
    const lm = boxMesh(w, rise, lz0 - lz1, 'floorboards');
    lm.position.set(0, rise / 2, (lz0 + lz1) / 2);
    lm.castShadow = true; lm.receiveShadow = true;
    c.add(lm);
    c.step({ minX: -w / 2, maxX: w / 2, minZ: lz1, maxZ: lz0, top: rise });
    // side walls of the stair carcass so the sides read as solid
    for (const sx of [-1.55, 1.55]) {
      const side = boxMesh(0.5, rise + 0.02, n * run, 'panelling');
      side.position.set(sx, rise / 2, (z0 + landZ0) / 2);
      c.add(side);
    }
    c.block(-1.75, (z0 + landZ0) / 2, 0.5, n * run);
    c.block(1.75, (z0 + landZ0) / 2, 0.5, n * run);
    // handrails
    for (const sx of [-1.2, 1.2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, Math.hypot(n * run, rise)), getMaterial('darkWood'));
      rail.position.set(sx, rise / 2 + 1.0, (z0 + landZ0) / 2);
      rail.rotation.x = Math.atan2(rise, n * run) * 1;
      c.add(rail);
    }
    for (const sx of [-1.2, 1.2]) for (let i = 1; i < n; i += 2) {
      const post = boxMesh(0.05, 0.98, 0.05, 'darkWood');
      post.position.set(sx, (i + 1) * stepH + 0.49, z0 - (i + 0.5) * run);
      c.add(post);
    }
    // dust, boxes
    c.putBB(P.crate(), -w / 2 + 0.6, 3.9, 0.3);
    c.putBB(P.chest(), w / 2 - 0.7, 3.9, -0.2);
    sconce(c, 'S', -1.2, 2.0);
    const lamp = P.candleHolder();
    lamp.position.set(-1.1, rise, -3.6);
    c.add(lamp);
    c.lightUp(lamp, { intensity: 4, dist: 8, shadow: true, dy: 0.2 });
    cobweb(c, 'E', -1.0, h - 1.0, 1.6);
    cobweb(c, 'S', 1.2, h - 1.2, 1.4);
    placeNotes(c, { n_attic: 0.2 });
    // the note sits on the landing: placeNotes puts it on the floor, lift is handled by y below
  },
};

// =========================================================================================== ATTIC
const attic: ThemeSpec = {
  wall: 'plaster', floor: 'floorboards', ceiling: 'ceilingPlaster', beams: true,
  windows: [{ wall: 'N', u: 0, w: 1.9, h: 3.4, sill: 1.1 }, ...windowsSide('E', [-2.5], 1.0, 1.6, 1.8)],
  moonWall: 'N', hemi: [0x4a5a90, 0x2c2024, 0.62], footstep: 'wood',
  decor(c) {
    const { w, d, h } = c.def;
    // sheet-draped furniture
    const wrinkle = canvasTexture(256, 256, (ctx, W, H) => {
      ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 140; i++) { const x = Math.random() * W, y = Math.random() * H, l = 30 + Math.random() * 90, a = Math.random() * 3.14; ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.08 + Math.random() * 0.18})`; ctx.lineWidth = 2 + Math.random() * 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
    }, false);
    wrinkle.wrapS = wrinkle.wrapT = THREE.RepeatWrapping; wrinkle.repeat.set(3, 2);
    const sheet = new THREE.MeshStandardMaterial({ color: 0xa8a290, roughness: 0.97, bumpMap: wrinkle, bumpScale: 2.2, side: THREE.DoubleSide });
    const drape = (x: number, z: number, sx: number, sy: number, sz: number, r = 0) => {
      const g = new THREE.Group();
      const geo = new THREE.BoxGeometry(sx, sy, sz, 16, 12, 16);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const t = (py + sy / 2) / sy; // 0 floor .. 1 top
        const ang = Math.atan2(pz, px);
        const flare = 1 + Math.pow(1 - t, 3) * 0.3;
        const round = t > 0.8 ? 1 - Math.pow((t - 0.8) / 0.2, 2) * 0.22 : 1;
        const fold = 1 + Math.sin(ang * 11 + t * 3) * 0.035 * (1 - t * 0.6) + Math.sin(ang * 5 - t * 7) * 0.02;
        px *= flare * round * fold; pz *= flare * round * fold;
        py += t > 0.9 ? -Math.pow((t - 0.9) / 0.1, 2) * sy * 0.03 : 0;
        pos.setXYZ(i, px, py, pz);
      }
      geo.computeVertexNormals();
      const body = new THREE.Mesh(geo, sheet);
      body.position.y = sy / 2;
      body.castShadow = true; body.receiveShadow = true;
      g.add(body);
      return c.place(g, x, z, r, { w: sx, d: sz });
    };
    drape(-2.8, -2.8, 1.6, 0.95, 0.9, 0.3);
    drape(-1.9, 0.4, 0.8, 1.15, 0.8, 0.2);
    drape(2.9, -3.2, 1.2, 1.5, 0.8, -0.2);
    drape(-3.0, 1.5, 1.4, 0.8, 1.4, 0.1);
    drape(3.0, 2.0, 1.0, 1.9, 1.0, 0.4);
    c.putBB(P.chest(), -3.2, 3.9, 0.2);
    c.putBB(P.chest(), 3.2, 4.0, -0.5);
    c.putBB(P.crate(), -3.5, -4.2, 0.4);
    c.putBB(P.wardrobe(), 3.3, -4.2, -PI / 2 * 0);
    c.putBB(P.armchair('green'), 1.2, 2.6, PI - 0.5);
    c.putBB(P.pumpkinPile(13), -1.8, 3.9, 0.3);
    // the music box, in the moonbeam
    const tab = P.table(0.9, 0.6, 0.72, 'side');
    c.putBB(tab, 0, -1.5, 0);
    const mb = makeMusicBox();
    mb.position.set(0, c.topOf(tab), -1.5);
    c.add(mb);
    const moonspot = new THREE.PointLight(0xa8c0ff, 2.2, 6, 2);
    moonspot.position.set(0, 2.6, -2.6);
    c.add(moonspot);
    c.interactable('musicBox', 0, 0.9, -1.5, 0.7, 0.5, 0.7, [mb]);
    c.room.objAnimators.set('musicBox', (st: GameState, t: number) => {
      const lid = mb.getObjectByName('lid');
      if (lid) lid.rotation.x = -(st.flags.has('ending') ? 1.7 : 0);
      void t;
    });
    // candlelight
    const cd = P.candelabra(5);
    cd.position.set(1.0, 0.0, -1.6);
    const sT = P.table(0.6, 0.6, 0.6, 'side');
    c.putBB(sT, 1.6, -1.2, 0.3);
    cd.position.set(1.6, c.topOf(sT), -1.2);
    c.add(cd);
    c.lightUp(cd, { intensity: 5, dist: 10, shadow: true });
    // ismene, faint, at the window (visible only in the end)
    const isme = spectre(1.0, 'pale');
    isme.position.set(0.0, 0, -4.3);
    isme.visible = false;
    c.add(isme);
    c.animate((t) => { const u = isme.userData.update; if (u) u(t); });
    c.room.objAnimators.set('ismene', (st: GameState) => { isme.visible = st.flags.has('ending'); });
    cobweb(c, 'S', 2.2, h - 1.2, 2.0);
    cobweb(c, 'W', -2.5, h - 1.3, 2.0);
    cobweb(c, 'E', 3.0, h - 1.3, 2.0);
  },
};

function makeMusicBox() {
  const g = new THREE.Group();
  const wood = getMaterial('darkWood');
  const brass = getMaterial('brass');
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.24), wood);
  body.position.y = 0.07;
  body.castShadow = true;
  g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.26), brass);
  trim.position.y = 0.14;
  g.add(trim);
  const lidPivot = new THREE.Group();
  lidPivot.name = 'lid';
  lidPivot.position.set(0, 0.15, -0.12);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.24), wood);
  lid.position.set(0, 0.015, 0.12);
  lidPivot.add(lid);
  const inset = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.005, 0.12), new THREE.MeshStandardMaterial({ color: 0x9a7bdc, emissive: 0x6a4bc0, emissiveIntensity: 0.6, roughness: 0.3 }));
  inset.position.set(0, 0.032, 0.12);
  lidPivot.add(inset);
  g.add(lidPivot);
  const key = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 16), brass);
  key.position.set(0.19, 0.08, 0);
  key.rotation.y = PI / 2;
  g.add(key);
  return g;
}

// =========================================================================================== BALLROOM
const ballroom: ThemeSpec = {
  wall: 'wallpaperRed', wainscot: 'panelling', floor: 'parquet', ceiling: 'ceilingPlaster', beams: true,
  windows: [...windowsSide('E', [-5.2, -1.4, 2.4, 6.0], 1.5, 4.0, 1.0), ...windowsSide('W', [-3.6, -0.4], 1.5, 4.0, 1.0)],
  moonWall: 'E', hemi: [0x4a4a88, 0x2c1a20, 0.6], footstep: 'wood', wallTint: 0xd8c0e0,
  decor(c) {
    const { w, d, h } = c.def;
    // a great rug under the dance floor, then eight sigil tiles in mirrored pairs
    c.place(P.rugRect(11, 12.5, 'red'), 0, 0.2, 0);
    const mkTile = (t: { x: number; z: number; sigil: string }) => {
      const g = new THREE.Group();
      const discMat = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.45, metalness: 0.4, emissive: 0x7a4a14, emissiveIntensity: 0 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.76, 0.05, 40), discMat);
      disc.position.y = 0.04; disc.receiveShadow = true; g.add(disc);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.3, metalness: 0.9, emissive: 0xffc860, emissiveIntensity: 0.15 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.03, 6, 48), ringMat);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.07; g.add(ring);
      const glyphMat = new THREE.MeshStandardMaterial({ map: sigilTexture(t.sigil as SigilName, '#f0d078', 256), transparent: true, roughness: 0.4, emissive: 0x6a4a10, emissiveIntensity: 0.45 });
      const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), glyphMat);
      glyph.rotation.x = -Math.PI / 2; glyph.position.y = 0.075; g.add(glyph);
      // beat number, painted beside the sigil
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: numeralTex(String(DANCE.echoTiles.indexOf(t) >= 0 ? DANCE.echoTiles.indexOf(t) + 1 : DANCE.playerTiles.indexOf(t) + 1)), transparent: true, depthWrite: false }));
      num.rotation.x = -Math.PI / 2; num.position.set(0, 0.078, 1.15); g.add(num);
      g.position.set(t.x, 0, t.z);
      c.add(g);
      return { discMat, ringMat, glyphMat };
    };
    const E = DANCE.echoTiles.map(mkTile), Pt = DANCE.playerTiles.map(mkTile);
    c.animate((t) => {
      const apply = (arr: typeof E, states: number[]) => arr.forEach((tl, i) => {
        const st = states[i];
        const pulse = 0.5 + 0.5 * Math.sin(t * 5);
        const ring = st === 3 ? 1.2 + pulse * 1.6 : st === 2 ? 1.1 : st === 1 ? 0.7 : 0.15;
        const disc = st === 3 ? 0.35 + pulse * 0.3 : st === 2 ? 0.45 : st === 1 ? 0.25 : 0;
        tl.ringMat.emissiveIntensity += (ring - tl.ringMat.emissiveIntensity) * 0.2;
        tl.discMat.emissiveIntensity += (disc - tl.discMat.emissiveIntensity) * 0.2;
        tl.glyphMat.emissiveIntensity += ((st === 3 ? 1.2 : st === 2 ? 0.9 : 0.45) - tl.glyphMat.emissiveIntensity) * 0.2;
      });
      apply(E, danceState.tilesE); apply(Pt, danceState.tilesP);
    });
    // the Lady shows the figure: she glides to the middle of each pair in turn (and dances a slow circle once it is done)
    const lady = spectre(1.0, 'pale');
    lady.position.set(0, 0.1, 3.2);
    c.add(lady);
    let lx = 0, lz = 3.2, lt = 0;
    c.animate((t, dt) => {
      const u = lady.userData.update; if (u) u(t);
      if (danceState.done) { lady.position.set(Math.cos(t * 0.5) * 3.2, 0.1 + 0.15 * Math.sin(t * 1.2), Math.sin(t * 0.5) * 3.2); lady.rotation.y = -t * 0.5; return; }
      const k = danceState.shown;
      lt += dt;
      const tx = (DANCE.echoTiles[k].x + DANCE.playerTiles[k].x) / 2, tz = (DANCE.echoTiles[k].z + DANCE.playerTiles[k].z) / 2;
      lx += (tx - lx) * Math.min(1, dt * 1.4); lz += (tz - lz) * Math.min(1, dt * 1.4);
      lady.position.set(lx, 0.1 + 0.05 * Math.sin(t * 2), lz);
      lady.rotation.y = Math.atan2(tx - lx, tz - lz) + Math.PI;
    });
    const beatSprite = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: numeralTex('1'), transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    beatSprite.renderOrder = 40; c.add(beatSprite);
    let lastBeat = -1;
    c.animate((t) => {
      if (danceState.done) { beatSprite.visible = false; return; }
      beatSprite.visible = true;
      beatSprite.position.set(lady.position.x, 2.7 + 0.06 * Math.sin(t * 2), lady.position.z);
      beatSprite.quaternion.copy(c.room.cameraQuat);
      if (danceState.shown !== lastBeat) { lastBeat = danceState.shown; (beatSprite.material as THREE.MeshBasicMaterial).map = numeralTex(String(lastBeat + 1)); (beatSprite.material as THREE.MeshBasicMaterial).needsUpdate = true; }
    });
    // the organ, silent until the figure is danced
    const organ = P.pianoUpright();
    c.putBB(organ, 5.6, 7.0, PI);
    // chandeliers
    for (const z of [-3.5, 3.5]) {
      const ch = P.chandelier(1.1, 12);
      ch.position.set(0, h, z);
      c.add(ch);
      c.lightUp(ch, z < 0 ? { intensity: 14, dist: 16, shadow: true, dy: -0.4 } : { intensity: 11, dist: 14, dy: -0.4 });
    }
    // candelabra on plinths along the long walls, statues in the corners
    for (const z of [-6.2, 0.3]) for (const x of [-6.4]) {
      const pl = P.pedestal(0.95); c.putBB(pl, x, z, 0);
      const cd = P.candelabra(5); cd.position.set(x, c.topOf(pl), z); c.add(cd); c.lightUp(cd, z < -5 ? { intensity: 4, dist: 9 } : undefined);
    }
    c.putBB(dimWhite(P.statue('angel')), -6.2, -7.0, 0.5);
    c.putBB(dimWhite(P.statue('bust')), 6.3, -7.0, -0.5);
    c.putBB(P.urn(3), 6.3, -3.0, 0);
    paintings(c, 'W', [-6.2, -2.0], 3.1, 160, 1.3, 1.7);
    paintings(c, 'N', [-4.6, 4.6], 3.4, 170, 1.3, 1.7);
    sconce(c, 'N', -2.0, 2.4); sconce(c, 'N', 2.0, 2.4);
    cobweb(c, 'N', 6.3, h - 1.6, 2.0); cobweb(c, 'S', -6.3, h - 1.6, 2.0);
    placeNotes(c, { n_ball: 0.4 });
  },
};

export const THEMES: Record<RoomId, ThemeSpec> = {
  hall, library, dining, kitchen, mirrors, gallery, conservatory, cellar, crypt, clock: clockRoom, upper, atticstair, attic, ballroom,
};
