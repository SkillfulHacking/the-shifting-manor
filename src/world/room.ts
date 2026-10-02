import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { DoorDef, ObjDef, RoomDef, Wall } from '../game/types';
import { DOORS, OBJECTS, ROOM_BY_ID } from '../data/manor';
import type { GameState } from '../game/state';
import { getMaterial, sigilTexture, canvasTexture, type MaterialName } from '../rendering/textures';
import * as P from './props';
import { archPlane, boxMesh, buildWall, DOOR_H, DOOR_W, planeMesh, spawnAt, uOf, wallFrame, wallLength, WALL_THICK, type Hole } from './wall';
import type { Box, Colliders } from '../player/player';
import { Weather } from './weather';

export interface Interactable {
  kind: 'door' | 'obj';
  id: string;
  hit: THREE.Mesh;
  glow: THREE.Object3D[];
  center: THREE.Vector3;
}

export interface WindowSpec { wall: Wall; u: number; w?: number; h?: number; sill?: number }

export interface ThemeSpec {
  wall: MaterialName;
  wainscot?: MaterialName;
  floor: MaterialName;
  ceiling: MaterialName;
  beams?: boolean;
  windows: WindowSpec[];
  moonWall: Wall;
  hemi: [number, number, number]; // sky colour, ground colour, intensity
  footstep: 'wood' | 'stone' | 'carpet';
  crest?: { wall: Wall; u: number; v?: number; size?: number };
  fog?: [number, number]; // colour, density
  skylight?: boolean;
  wallTint?: number;
  decor: (c: DecorCtx) => void;
}

export const POINT_SLOTS = 7;
const WARM = 0xffa858;
const LIGHT_GAIN = 2.8;

/** Helpers handed to per-room decoration code. */
export class DecorCtx {
  constructor(public room: RoomView, public def: RoomDef) {}
  get w() { return this.def.w; }
  get d() { return this.def.d; }
  get h() { return this.def.h; }
  /** place an object on the floor with optional footprint collider (width along its x, depth along its z) */
  place(obj: THREE.Object3D, x: number, z: number, rotY = 0, col?: { w: number; d: number } | number, y = 0): THREE.Object3D {
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    this.room.group.add(obj);
    if (col) {
      const cw = typeof col === 'number' ? col : col.w;
      const cd = typeof col === 'number' ? col : col.d;
      const c = Math.cos(rotY), s = Math.sin(rotY);
      const ex = Math.abs(c) * cw / 2 + Math.abs(s) * cd / 2;
      const ez = Math.abs(s) * cw / 2 + Math.abs(c) * cd / 2;
      this.room.colliders.solids.push({ minX: x - ex, maxX: x + ex, minZ: z - ez, maxZ: z + ez, top: 99 });
    }
    return obj;
  }
  /** mount an object on a wall (u along wall, v height); object front (+z) points into the room */
  onWall(wall: Wall, u: number, v: number, obj: THREE.Object3D, inset = 0): THREE.Object3D {
    const f = wallFrame(wall, this.w, this.d);
    obj.position.set(u, v, inset);
    f.add(obj);
    this.room.group.add(f);
    return obj;
  }
  /** floor-standing object against a wall: u along wall, depth = its footprint depth; colliders included */
  againstWall(wall: Wall, u: number, obj: THREE.Object3D, wdt: number, dep: number, inset = 0.02) {
    const f = wallFrame(wall, this.w, this.d);
    obj.position.set(u, 0, dep / 2 + inset);
    f.add(obj);
    this.room.group.add(f);
    // collider in world space
    const cx = wall === 'N' ? u : wall === 'S' ? -u : wall === 'E' ? this.w / 2 - dep / 2 - inset : -this.w / 2 + dep / 2 + inset;
    const cz = wall === 'E' ? u : wall === 'W' ? -u : wall === 'N' ? -this.d / 2 + dep / 2 + inset : this.d / 2 - dep / 2 - inset;
    const alongX = wall === 'N' || wall === 'S';
    const hx = (alongX ? wdt : dep) / 2, hz = (alongX ? dep : wdt) / 2;
    this.room.colliders.solids.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz, top: 99 });
    return obj;
  }
  /** bounding box of an object at the origin (unrotated) */
  bbox(obj: THREE.Object3D) {
    obj.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(obj);
  }
  /** floor placement with automatic footprint collider from the object's bounding box */
  putBB(obj: THREE.Object3D, x: number, z: number, rotY = 0, opts: { shrink?: number; noCol?: boolean; y?: number } = {}) {
    const bb = this.bbox(obj);
    obj.position.set(x, opts.y ?? 0, z);
    obj.rotation.y = rotY;
    this.room.group.add(obj);
    if (!opts.noCol) {
      obj.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(obj);
      const sh = opts.shrink ?? 0.04;
      this.room.colliders.solids.push({ minX: b2.min.x + sh, maxX: b2.max.x - sh, minZ: b2.min.z + sh, maxZ: b2.max.z - sh, top: 99 });
    }
    void bb;
    return obj;
  }
  /** floor object with its back against a wall; u along the wall; collider from bounding box */
  wallItem(wall: Wall, u: number, obj: THREE.Object3D, opts: { inset?: number; noCol?: boolean; y?: number } = {}) {
    const bb = this.bbox(obj);
    const f = wallFrame(wall, this.w, this.d);
    obj.position.set(u, opts.y ?? 0, (opts.inset ?? 0.02) - bb.min.z);
    this.room.wallUse[wall].push([u + bb.min.x, u + bb.max.x]);
    f.add(obj);
    this.room.group.add(f);
    if (!opts.noCol) {
      f.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(obj);
      this.room.colliders.solids.push({ minX: b2.min.x + 0.03, maxX: b2.max.x - 0.03, minZ: b2.min.z + 0.03, maxZ: b2.max.z - 0.03, top: 99 });
    }
    return obj;
  }
  /** make every flame in a prop visible and flickering; optionally claim a warm light at its flame anchor */
  lightUp(obj: THREE.Object3D, light?: { intensity?: number; dist?: number; shadow?: boolean; dy?: number; color?: number }) {
    obj.updateMatrixWorld(true);
    const flames: THREE.Mesh[] = obj.userData.flames ?? (obj.userData.flame ? [obj.userData.flame] : []);
    obj.traverse((o) => { if (o.name === 'flame') { o.visible = true; if (!flames.includes(o as THREE.Mesh)) flames.push(o as THREE.Mesh); } });
    for (const f of flames) f.visible = true;
    const phase = Math.random() * 10;
    this.animate((t) => { for (let i = 0; i < flames.length; i++) { const s = 1 + Math.sin(t * 13 + phase + i * 2) * 0.09 + Math.sin(t * 21 + i) * 0.05; flames[i].scale.set(s, 1 + Math.sin(t * 17 + i + phase) * 0.12, s); } });
    if (light) {
      const anchors: THREE.Vector3[] = obj.userData.flameAnchors ?? (obj.userData.flameAnchor ? [obj.userData.flameAnchor] : []);
      const c = new THREE.Vector3();
      for (const a of anchors) c.add(a.clone().applyMatrix4(obj.matrixWorld));
      if (anchors.length) c.multiplyScalar(1 / anchors.length); else obj.getWorldPosition(c);
      return this.light(c.x, c.y + (light.dy ?? 0.15), c.z, light.intensity ?? 6, light.dist ?? 8, light.color ?? WARM, { shadow: light.shadow, flicker: 0.16 });
    }
    return null;
  }
  /** top surface height of a placed prop (so things sit ON tables instead of floating or sinking) */
  topOf(obj: THREE.Object3D) { obj.updateMatrixWorld(true); return new THREE.Box3().setFromObject(obj).max.y; }
  /** reserve wall space (u interval) so framed pictures never overlap doors, windows, sconces or furniture */
  reserve(wall: Wall, u: number, halfW: number) { this.room.wallUse[wall].push([u - halfW, u + halfW]); }
  /** hang a framed object on a wall at the nearest free spot (null if the wall has no room) */
  hang(wall: Wall, u: number, v: number, obj: THREE.Object3D, halfW: number, inset = 0.05) {
    const len = wall === 'N' || wall === 'S' ? this.w : this.d;
    const used = this.room.wallUse[wall];
    for (const dx of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5]) {
      const x = u + dx;
      if (Math.abs(x) + halfW > len / 2 - 0.2) continue;
      if (used.some(([a, b]) => x + halfW + 0.12 > a && x - halfW - 0.12 < b)) continue;
      used.push([x - halfW, x + halfW]);
      this.onWall(wall, x, v, obj, inset);
      return obj;
    }
    return null;
  }
  block(x: number, z: number, w: number, d: number) {
    this.room.colliders.solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: 99 });
  }
  add(obj: THREE.Object3D) { this.room.group.add(obj); return obj; }
  /** a steady-ish warm light that occupies a light slot; returns the light */
  light(x: number, y: number, z: number, intensity = 8, dist = 9, color = WARM, opts: { shadow?: boolean; flicker?: number } = {}) {
    return this.room.claimLight(x, y, z, intensity, dist, color, opts);
  }
  step(box: Box) { this.room.colliders.steps.push(box); }
  animate(fn: (t: number, dt: number) => void) { this.room.animators.push(fn); }
  glowTargets(...o: THREE.Object3D[]) { return o; }
  /** register a non-door interactable with a hitbox at world position */
  interactable(id: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, glow: THREE.Object3D[]) {
    return this.room.addInteractable('obj', id, new THREE.Vector3(x, y, z), new THREE.Vector3(sx, sy, sz), glow);
  }
  /** small table with a piece of paper (notes, matches). Returns the paper mesh. */
  noteTable(o: ObjDef, rot = 0) {
    // nudge the table to the nearest free floor spot (never inside furniture, never on a door spawn)
    {
      const hw = 0.55, hd = 0.4;
      const cols = this.room.colliders;
      const spawns = DOORS.filter((dd) => dd.room === this.def.id).map((dd) => this.room.spawnFor(dd.id));
      const bad = (x: number, z: number) =>
        x - hw < cols.bounds.minX + 0.3 || x + hw > cols.bounds.maxX - 0.3 || z - hd < cols.bounds.minZ + 0.3 || z + hd > cols.bounds.maxZ - 0.3 ||
        cols.solids.some((s) => x + hw > s.minX && x - hw < s.maxX && z + hd > s.minZ && z - hd < s.maxZ) ||
        spawns.some((sp) => {
          if (Math.hypot(sp.x - x, sp.z - z) < 1.1) return true;
          // keep the walkway in front of every door clear
          const fx = -Math.sin(sp.yaw), fz = -Math.cos(sp.yaw), dx = x - sp.x, dz = z - sp.z;
          const along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
          return along > -0.5 && along < 2.8 && lat < 1.15;
        });
      if (bad(o.x, o.z)) {
        let done = false;
        for (let r = 0.25; r <= 2.5 && !done; r += 0.25) for (let k = 0; k < 16 && !done; k++) {
          const a = (k / 16) * Math.PI * 2, nx = o.x + Math.cos(a) * r, nz = o.z + Math.sin(a) * r;
          if (!bad(nx, nz)) { o.x = nx; o.z = nz; done = true; }
        }
      }
    }
    const tab = P.table(0.8, 0.5, 0.85, 'side');
    let gy = 0;
    for (const st of this.room.colliders.steps) if (o.x > st.minX && o.x < st.maxX && o.z > st.minZ && o.z < st.maxZ) gy = Math.max(gy, st.top);
    this.place(tab, o.x, o.z, rot, { w: 0.85, d: 0.55 }, gy);
    const paper = makePaper(o.id);
    paper.position.set(o.x, 0.865 + gy, o.z);
    paper.rotation.y = rot + (o.id.length % 5) * 0.12 - 0.2;
    this.room.group.add(paper);
    return { tab, paper };
  }
}

const paperTex = new Map<string, THREE.Texture>();
function makePaper(seed: string) {
  let tex = paperTex.get('p');
  if (!tex) {
    tex = canvasTexture(256, 180, (ctx, w, h) => {
      ctx.fillStyle = '#d8c79b'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(120,90,40,${Math.random() * 0.08})`; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 6, 1 + Math.random() * 3); }
      ctx.strokeStyle = 'rgba(40,30,20,0.55)'; ctx.lineWidth = 1.4;
      for (let y = 26; y < h - 14; y += 12) { ctx.beginPath(); let x = 18; ctx.moveTo(x, y); while (x < w - 24) { x += 3 + Math.random() * 5; ctx.lineTo(x, y + (Math.random() - 0.5) * 3); } ctx.stroke(); }
    });
    paperTex.set('p', tex);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.21), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0x2a2010, emissiveIntensity: 0.25 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  const g = new THREE.Group();
  g.add(m);
  void seed;
  return g;
}

interface DoorView {
  def: DoorDef;
  hinge: THREE.Group;
  open: number;
  target: number;
  lanterns: THREE.MeshBasicMaterial[];
  inlay?: THREE.MeshStandardMaterial;
  boards?: THREE.Group;
  seal?: THREE.Mesh;
  mist?: THREE.Mesh;
  webs?: THREE.Object3D;
  sigils: THREE.Mesh[];
  lanternGroup?: THREE.Group;
  rail?: THREE.Mesh;
  pips: { disc: THREE.MeshBasicMaterial; halo: THREE.MeshBasicMaterial }[];
  plaque?: THREE.Group;
  frameU: number;
  wall: Wall;
}
interface CandleView { flame: THREE.Mesh; light: THREE.PointLight | null; lit: boolean; anchor: THREE.Vector3; smoke?: number; sconce?: THREE.Object3D; door?: string }
interface PlateView { obj: ObjDef; rune: THREE.MeshStandardMaterial | null; plate: THREE.Object3D; held: boolean; y0: number; beam: THREE.Mesh; beamMat: THREE.ShaderMaterial }

const mistMaterialCache = { m: null as THREE.ShaderMaterial | null };
export function mistMaterial() {
  if (mistMaterialCache.m) return mistMaterialCache.m;
  mistMaterialCache.m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y);}
      void main(){
        vec2 p=(vUv-.5)*vec2(2.,3.4);
        float a=atan(p.y,p.x); float r=length(p);
        float sw=n(vec2(a*2.+uTime*.6, r*3.-uTime*.9))*.6+n(p*4.+uTime*.35)*.4;
        vec3 c=mix(vec3(.05,.02,.14), vec3(.34,.18,.62), smoothstep(.25,.95,sw));
        c=mix(c, vec3(.75,.55,.95), smoothstep(.72,1.,n(p*3.-uTime*.5))*.6);
        c*= (.35+.65*(1.-smoothstep(.3,1.4,r)));
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return mistMaterialCache.m;
}

export class RoomView {
  def: RoomDef;
  group = new THREE.Group();
  spectral = new THREE.Group();
  colliders: Colliders;
  interactables: Interactable[] = [];
  animators: ((t: number, dt: number) => void)[] = [];
  doors = new Map<string, DoorView>();
  candles = new Map<string, CandleView>();
  plates = new Map<string, PlateView>();
  theme: ThemeSpec;
  moon: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  pointLights: THREE.PointLight[] = [];
  private nextSlot = 0;
  private flickers: { light: THREE.PointLight; base: number; seed: number; amt: number }[] = [];
  reflector: Reflector | null = null;
  weather: Weather;
  objAnimators = new Map<string, (state: GameState, t: number, dt: number) => void>();
  windowMats: THREE.Material[] = [];
  wallUse: Record<Wall, [number, number][]> = { N: [], E: [], S: [], W: [] };
  cameraQuat = new THREE.Quaternion();
  hearthPos: THREE.Vector3 | null = null;
  clockPos: THREE.Vector3 | null = null;
  baseMoon = 1.15;
  baseHemi = 0.3;

  constructor(def: RoomDef, theme: ThemeSpec, weather: Weather) {
    this.def = def;
    this.theme = theme;
    this.weather = weather;
    const { w, d } = def;
    this.colliders = { bounds: { minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2 }, solids: [], steps: [] };
    this.group.name = 'room:' + def.id;
    this.spectral.visible = false;
    this.group.add(this.spectral);

    // fixed light rig (constant count => no shader recompiles when rooms swap)
    this.hemi = new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], theme.hemi[2] * 2.9);
    this.group.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x8fa8ff, 2.6);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(1024, 1024);
    const sc = this.moon.shadow.camera;
    const ext = Math.max(w, d) * 0.75;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 60;
    this.moon.shadow.bias = -0.0006;
    this.moon.shadow.normalBias = 0.04;
    const dirv = { N: [0, 0.75, -1], S: [0, 0.75, 1], E: [1, 0.75, 0], W: [-1, 0.75, 0] }[theme.moonWall];
    this.moon.position.set(dirv[0] * 14 + 1.5, dirv[1] * 14, dirv[2] * 14 - 1);
    this.moon.target.position.set(0, 0, 0);
    this.group.add(this.moon, this.moon.target);
    for (let i = 0; i < POINT_SLOTS; i++) {
      const pl = new THREE.PointLight(WARM, 0, 8, 2);
      if (i === 0) {
        pl.castShadow = true;
        pl.shadow.mapSize.set(512, 512);
        pl.shadow.bias = -0.001;
        pl.shadow.radius = 4;
      }
      pl.position.set(0, 2, 0);
      this.pointLights.push(pl);
      this.group.add(pl);
    }

    this.buildShell();
    this.buildDoors();
    this.buildSconces();
    for (const dd of DOORS.filter((x) => x.room === def.id)) { const u = uOf(dd.wall, dd.offset); this.wallUse[dd.wall].push([u - 0.85, u + 0.85]); if (dd.kind === 'shifting') { const su = u + (u > 0 ? -1.15 : 1.15); this.wallUse[dd.wall].push([su - 0.3, su + 0.3]); } }
    for (const win of theme.windows) { const hw = (win.w ?? 1.2) / 2 + 0.35; this.wallUse[win.wall].push([win.u - hw, win.u + hw]); }
    theme.decor(new DecorCtx(this, def));
    this.buildObjects();
    this.buildCrest();
    // shadows on everything static
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o !== this.reflector) {
        const m = o as THREE.Mesh;
        if (m.userData.noShadow) { m.castShadow = false; }
      }
    });
  }

  claimLight(x: number, y: number, z: number, intensity: number, dist: number, color: number, opts: { shadow?: boolean; flicker?: number } = {}) {
    let idx: number;
    if (opts.shadow) idx = 0;
    else { idx = Math.max(1, this.nextSlot); this.nextSlot = idx + 1; if (idx >= POINT_SLOTS) idx = POINT_SLOTS - 1; }
    if (opts.shadow) this.nextSlot = Math.max(this.nextSlot, 1);
    const l = this.pointLights[idx];
    l.position.set(x, y, z);
    l.intensity = intensity * LIGHT_GAIN;
    l.distance = dist * 1.15;
    l.color.set(color);
    if (opts.flicker) this.flickers.push({ light: l, base: intensity * LIGHT_GAIN, seed: Math.random() * 100, amt: opts.flicker });
    return l;
  }

  addInteractable(kind: 'door' | 'obj', id: string, center: THREE.Vector3, size: THREE.Vector3, glow: THREE.Object3D[]) {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(center);
    hit.userData.interactId = id;
    hit.userData.interactKind = kind;
    this.group.add(hit);
    const it: Interactable = { kind, id, hit, glow, center: center.clone() };
    this.interactables.push(it);
    return it;
  }

  // ---------------------------------------------------------------- shell
  private buildShell() {
    const { def, theme } = this;
    const { w, d, h } = def;
    // floor
    const floor = planeMesh(w, d, theme.floor, -Math.PI / 2);
    this.group.add(floor);
    // ceiling
    if (theme.skylight) {
      const back = this.weather.makeBackdrop(w + 6, d + 6, 3, true);
      back.rotation.x = Math.PI / 2;
      back.position.y = h + 2.5;
      this.group.add(back);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x1a2a3a, transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0.0, side: THREE.DoubleSide, depthWrite: false }));
      glass.rotation.x = Math.PI / 2;
      glass.position.y = h;
      glass.userData.noShadow = true;
      this.group.add(glass);
    }
    const ceil = planeMesh(w, d, theme.ceiling, Math.PI / 2);
    if (theme.skylight) ceil.visible = false;
    ceil.position.y = h;
    ceil.receiveShadow = true;
    ceil.castShadow = !theme.skylight;
    ceil.material = (ceil.material as THREE.Material).clone();
    (ceil.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    (ceil.material as THREE.MeshStandardMaterial).color.setHex(0x857d73);
    this.group.add(ceil);
    // outer ceiling slab so the directional shadow is blocked from above
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.4, d + 1.2), new THREE.MeshBasicMaterial({ visible: false }));
    slab.position.y = h + 0.25;
    slab.castShadow = true;
    slab.material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    if (!theme.skylight) this.group.add(slab);
    const under = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.4, d + 1.2), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    under.position.y = -0.25;
    under.castShadow = true;
    this.group.add(under);

    // per-wall holes
    const wallHoles: Record<Wall, Hole[]> = { N: [], E: [], S: [], W: [] };
    const doorsHere = DOORS.filter((dd) => dd.room === def.id);
    for (const dd of doorsHere) wallHoles[dd.wall].push({ u: uOf(dd.wall, dd.offset), v0: dd.elev ?? 0, v1: (dd.elev ?? 0) + DOOR_H, w: DOOR_W, arch: true });
    for (const win of theme.windows) {
      const ww = win.w ?? 1.2, wh = win.h ?? 2.2, sill = win.sill ?? 0.9;
      wallHoles[win.wall].push({ u: win.u, v0: sill, v1: sill + wh, w: ww });
    }
    for (const wall of ['N', 'E', 'S', 'W'] as Wall[]) {
      const len = wallLength(wall, w, d);
      const f = wallFrame(wall, w, d);
      const wg = buildWall(len, h, wallHoles[wall], theme.wall);
      if (theme.wallTint !== undefined) wg.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = (m.material as THREE.Material[]).map((mm) => tinted(mm as THREE.MeshStandardMaterial, theme.wallTint!)); });
      f.add(wg);
      // wainscot, baseboard, crown
      if (theme.wainscot) {
        const cuts = wallHoles[wall].filter((ho) => ho.v0 < 1.2).sort((a, b) => a.u - b.u);
        let x0 = -len / 2;
        const segs: [number, number][] = [];
        for (const c of cuts) {
          const a = c.u - c.w / 2;
          if (a - x0 > 0.05) segs.push([x0, a]);
          x0 = c.u + c.w / 2;
        }
        if (len / 2 - x0 > 0.05) segs.push([x0, len / 2]);
        for (const [a, b] of segs) {
          const m = boxMesh(b - a, 1.05, 0.07, theme.wainscot);
          m.position.set((a + b) / 2, 0.525, 0.035);
          f.add(m);
          const rail = boxMesh(b - a, 0.07, 0.11, 'darkWood');
          rail.position.set((a + b) / 2, 1.08, 0.055);
          f.add(rail);
        }
      }
      // baseboard segments around door cuts (simple full-length; hidden by door frame)
      const crown = boxMesh(len, 0.16, 0.16, 'darkWood');
      crown.position.set(0, h - 0.08, 0.08);
      f.add(crown);
      const base = boxMesh(len, 0.18, 0.05, 'darkWood');
      base.position.set(0, 0.09, 0.025);
      f.add(base);
      this.group.add(f);
    }
    // windows
    let wi = 0;
    for (const win of theme.windows) {
      const ww = win.w ?? 1.2, wh = win.h ?? 2.2, sill = win.sill ?? 0.9;
      const f = wallFrame(win.wall, w, d);
      const frame = P.windowFrame(ww, wh);
      frame.position.set(win.u, sill + wh / 2, 0.02);
      const glass = frame.getObjectByName('glass') as THREE.Mesh | undefined;
      if (glass) { glass.castShadow = false; glass.userData.noShadow = true; if ((glass.material as THREE.MeshStandardMaterial).emissive) this.windowMats.push(glass.material as THREE.Material); }
      f.add(frame);
      // sill
      const sl = boxMesh(ww + 0.3, 0.07, 0.22, 'darkWood');
      sl.position.set(win.u, sill - 0.02, 0.07);
      f.add(sl);
      // storm backdrop outside
      const back = this.weather.makeBackdrop(ww + 0.9, wh + 0.9, wi++);
      back.position.set(win.u, sill + wh / 2, -WALL_THICK - 0.9);
      f.add(back);
      // curtains on some windows
      if (wi % 2 === 0 && wh > 1.8) {
        const cur = P.curtains(ww + 0.5, wh + 0.75);
        cur.position.set(win.u, sill + wh + 0.25, 0.3);
        f.add(cur);
      }
      this.group.add(f);
    }
    // ceiling beams
    if (theme.beams) {
      for (let x = -w / 2 + 1.5; x < w / 2 - 0.5; x += 2.6) {
        const b = P.ceilingBeam(d);
        b.rotation.y = Math.PI / 2;
        b.position.set(x, h - 0.15, 0);
        this.group.add(b);
      }
    }
    // dust motes
    this.group.add(makeDust(w, d, h));
    // warm-ish/cool fog handled globally
  }

  // ---------------------------------------------------------------- doors
  private buildDoors() {
    const { def } = this;
    const { w, d } = def;
    for (const dd of DOORS.filter((x) => x.room === def.id)) {
      const wall = dd.wall;
      const u = uOf(wall, dd.offset);
      const f = wallFrame(wall, w, d);
      const elev = dd.elev ?? 0;
      f.position.y = elev;
      // recess behind
      const rec = new THREE.Group();
      const back = new THREE.Mesh(archPlane(DOOR_W, DOOR_H), new THREE.MeshBasicMaterial({ color: 0x050308, side: THREE.DoubleSide }));
      back.position.set(u, 0, -WALL_THICK + 0.05);
      rec.add(back);
      const resm = new THREE.Mesh(archPlane(DOOR_W, DOOR_H), new THREE.MeshBasicMaterial({ color: 0x040306, side: THREE.DoubleSide }));
      resm.position.set(u, 0, -0.25);
      let mist: THREE.Mesh | undefined;
      if (dd.kind === 'shifting') {
        mist = new THREE.Mesh(archPlane(DOOR_W, DOOR_H), mistMaterial());
        mist.position.set(u, 0, -0.28);
        mist.visible = false;
        rec.add(mist);
      } else rec.add(resm);
      f.add(rec);
      // trim
      const trim = P.archTrim(DOOR_W, DOOR_H);
      trim.position.set(u, 0, 0.01);
      f.add(trim);
      // leaf
      const hinge = new THREE.Group();
      hinge.position.set(u - DOOR_W / 2, 0, -0.1);
      const leaf = P.doorLeaf(DOOR_W - 0.02, DOOR_H - 0.03, dd.kind === 'shifting' ? 'shifting' : dd.style === 'iron' ? 'iron' : dd.style === 'attic' ? 'attic' : 'wood');
      hinge.add(leaf);
      f.add(hinge);
      const inlay: THREE.MeshStandardMaterial | undefined = leaf.userData?.inlayMaterial;
      const view: DoorView = { def: dd, hinge, open: 0, target: 0, lanterns: [], pips: [], inlay, sigils: [], mist, frameU: u, wall };
      // boards
      if (dd.lock?.visual === 'boards') {
        const bg = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const pl = boxMesh(DOOR_W + 0.5, 0.2, 0.05, 'darkWood');
          pl.position.set(u + (Math.sin(i * 7) * 0.03), 0.35 + i * 0.44, 0.1 + (i % 2) * 0.02);
          pl.rotation.z = (i % 2 ? 1 : -1) * (0.08 + 0.03 * i);
          bg.add(pl);
        }
        f.add(bg);
        view.boards = bg;
      }
      if (dd.lock?.visual === 'seal' || (dd.lock?.plates)) {
        const ring = new THREE.Mesh(
          new THREE.PlaneGeometry(DOOR_W + 0.3, DOOR_H + 0.3),
          new THREE.MeshBasicMaterial({ map: sealTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }),
        );
        ring.position.set(u, DOOR_H / 2, 0.08);
        f.add(ring);
        view.seal = ring;
      }
      // lantern row + spectral sigils for shifting doors
      if (dd.kind === 'shifting') {
        const lg = new THREE.Group();
        lg.position.set(u, 0, 0.12);
        f.add(lg);
        view.lanternGroup = lg;
        this.buildLanterns(view, f);
        // dead-door cobwebs
        const webs = P.cobwebs(DOOR_W + 0.3, DOOR_H + 0.2);
        webs.position.set(u, DOOR_H / 2, 0.16);
        webs.visible = false;
        f.add(webs);
        view.webs = webs;
      }
      this.group.add(f);
      this.doors.set(dd.id, view);
      // interactable hitbox in world space
      const wp = new THREE.Vector3(u, DOOR_H / 2, 0.15);
      void elev;
      f.updateMatrixWorld(true);
      f.localToWorld(wp);
      const hit = this.addInteractable('door', dd.id, wp, new THREE.Vector3(1.5, 2.4, 1.0), [leaf]);
      hit.hit.quaternion.copy(f.quaternion);
    }
  }

  private buildLanterns(view: DoorView, f: THREE.Group) {
    const dd = view.def;
    const maxN = Math.max(...Object.values(dd.cycles ?? {}).map((c) => c!.length), 2);
    const spacing = 0.62;
    // iron rail
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, maxN * spacing + 0.3, 8), getMaterial('ironBlack'));
    rail.rotation.z = Math.PI / 2;
    rail.position.set(view.frameU, 4.12, 0.16);
    f.add(rail);
    view.rail = rail;
    for (let i = 0; i < maxN; i++) {
      const lan = P.doorLantern(i, maxN);
      const x = view.frameU + (i - (maxN - 1) / 2) * spacing;
      lan.position.set(x, 4.1, 0.2);
      lan.userData.lanternIndex = i;
      f.add(lan);
      const gm: THREE.MeshBasicMaterial | undefined = lan.userData?.glowMaterial;
      view.lanterns.push(gm as THREE.MeshBasicMaterial);
      view.lanternGroup!.userData.lanterns = view.lanternGroup!.userData.lanterns ?? [];
      view.lanternGroup!.userData.lanterns.push(lan);
    }
    // index plaque: big glowing pips on a dark backing above the arch; the lit pip marks where the door leads now (readable across the room)
    {
      const pg = new THREE.Group();
      const back = new THREE.Mesh(new THREE.BoxGeometry(maxN * 0.62 + 0.18, 0.44, 0.05), new THREE.MeshStandardMaterial({ color: 0x120d09, roughness: 0.6, metalness: 0.3 }));
      back.position.set(view.frameU, 2.95, 0.15);
      pg.add(back);
      for (let i = 0; i < maxN; i++) {
        const x = view.frameU + (i - (maxN - 1) / 2) * 0.62;
        const disc = new THREE.MeshBasicMaterial({ color: 0x1a0f08 });
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.15, 28), disc);
        m.position.set(x, 2.95, 0.178); pg.add(m);
        const ringM = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.18, 28), new THREE.MeshBasicMaterial({ color: 0x8a7440 }));
        ringM.position.set(x, 2.95, 0.179); pg.add(ringM);
        const halo = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
        const hm = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28), halo);
        hm.position.set(x, 2.95, 0.185); hm.userData.noShadow = true; pg.add(hm);
        view.pips.push({ disc, halo });
      }
      f.add(pg);
      view.plaque = pg;
    }
    // spectral sigil row (visible only in mirrors): drawn ON the door face, clear of the lanterns, always on top
    const sp = 0.4;
    for (let i = 0; i < maxN; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.38, 0.38),
        new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, opacity: 0.7, color: 0xffffff }),
      );
      m.renderOrder = 60;
      m.position.set(view.frameU + (i - (maxN - 1) / 2) * sp, 1.5, 0.22);
      m.userData.idx = i;
      view.sigils.push(m);
      f.add(m);
      f.updateMatrixWorld(true);
      this.spectral.attach(m);
    }
  }

  /** set the sigil textures for the current phase */
  private applySigils(view: DoorView, state: GameState) {
    const c = state.cycle(view.def);
    view.sigils.forEach((m, i) => {
      if (i >= c.length) { m.visible = false; return; }
      m.visible = true;
      const room = ROOM_BY_ID[state.door(c[i]).room];
      const sg = room.sigil ?? 'star';
      const key = sg + i;
      if (m.userData.key !== sg) {
        (m.material as THREE.MeshBasicMaterial).map = sigilTexture(sg, '#9df3d0', 256);
        (m.material as THREE.MeshBasicMaterial).needsUpdate = true;
        m.userData.key = sg;
      }
      void key;
    });
  }

  // ---------------------------------------------------------------- sconces
  private buildSconces() {
    const { def } = this;
    for (const dd of DOORS.filter((x) => x.room === def.id && x.kind === 'shifting')) {
      const wall = dd.wall;
      const u = uOf(wall, dd.offset);
      // side away from wall centre
      const side = u > 0 ? -1 : 1; // toward the wall centre
      const su = u + side * 1.15;
      const f = wallFrame(wall, def.w, def.d);
      const sc = P.wallSconce();
      sc.position.set(su, 1.55, 0.0);
      f.add(sc);
      this.group.add(f);
      f.updateMatrixWorld(true);
      const flame: THREE.Mesh = sc.userData.flame;
      if (flame) flame.visible = false;
      const anchorLocal: THREE.Vector3 = sc.userData.flameAnchor ?? new THREE.Vector3(0, 0.2, 0.12);
      const anchor = anchorLocal.clone().applyMatrix4(sc.matrixWorld);
      anchor.set(0, 0, 0).add(anchorLocal).applyMatrix4(sc.matrixWorld);
      const cid = 'c_' + dd.id;
      // move object def to the actual place (x/z used for nothing else)
      const od = OBJECTS.find((o) => o.id === cid)!;
      od.x = anchor.x; od.z = anchor.z;
      const view: CandleView = { flame, light: null, lit: false, anchor, sconce: sc, door: dd.id };
      this.candles.set(cid, view);
      // lantern-side warm halo light claimed lazily
      const l = this.claimLight(anchor.x, anchor.y + 0.1, anchor.z, 0, 6.5, 0xffa050, { flicker: 0.18 });
      view.light = l;
      const hitCenter = anchor.clone();
      const inward = new THREE.Vector3(0, 0, 0.3).applyQuaternion(f.quaternion);
      hitCenter.add(inward);
      this.addInteractable('obj', cid, hitCenter, new THREE.Vector3(0.7, 0.9, 0.7), [sc]);
    }
  }

  // ---------------------------------------------------------------- objects with generic pedestals
  private buildObjects() {
    for (const o of OBJECTS.filter((x) => x.room === this.def.id)) {
      if (o.type === 'plate') {
        const p = P.pressurePlate();
        let gy = 0;
        for (const st of this.colliders.steps) if (o.x > st.minX && o.x < st.maxX && o.z > st.minZ && o.z < st.maxZ) gy = Math.max(gy, st.top);
        p.position.set(o.x, gy, o.z);
        this.group.add(p);
        // a pale shaft of light rises from a plate while something stands on it (you, or your echo)
        const beamMat = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
          uniforms: { uA: { value: 0 } },
          vertexShader: 'varying float vY; void main(){ vY=position.y/2.4; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
          fragmentShader: 'varying float vY; uniform float uA; void main(){ float a=uA*(1.-vY)*(1.-vY)*1.1; gl_FragColor=vec4(.6*a,1.*a,.8*a,a);} ',
        });
        const bg = new THREE.CylinderGeometry(0.3, 0.38, 2.4, 28, 1, true);
        bg.translate(0, 1.2, 0);
        const beam = new THREE.Mesh(bg, beamMat);
        beam.position.set(o.x, gy + 0.02, o.z);
        beam.visible = false;
        beam.userData.noShadow = true;
        this.group.add(beam);
        this.plates.set(o.id, { obj: o, rune: p.userData.runeMaterial ?? null, plate: p.userData.plate ?? p, held: false, y0: (p.userData.plate ?? p).position.y, beam, beamMat });
      }
    }
  }

  private buildCrest() {
    const c = this.theme.crest;
    const sg = this.def.sigil;
    if (!c || !sg) return;
    const size = c.size ?? 0.8;
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(size / 2 + 0.06, size / 2 + 0.08, 0.06, 40), getMaterial('brass'));
    disc.rotation.x = Math.PI / 2;
    disc.position.z = 0.03;
    g.add(disc);
    const face = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 40), new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.7, metalness: 0.2 }));
    face.position.z = 0.065;
    g.add(face);
    const glyph = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 0.92, size * 0.92),
      new THREE.MeshStandardMaterial({ map: sigilTexture(sg, '#d9b45a', 256), transparent: true, roughness: 0.4, metalness: 0.7, emissive: 0x3a2a08, emissiveIntensity: 0.6 }),
    );
    glyph.position.z = 0.07;
    g.add(glyph);
    const f = wallFrame(c.wall, this.def.w, this.def.d);
    g.position.set(c.u, c.v ?? 3.0, 0.02);
    f.add(g);
    this.group.add(f);
  }

  // ---------------------------------------------------------------- state sync + animation
  private spawnCache = new Map<string, { x: number; z: number; yaw: number; y: number }>();
  spawnFor(doorId: string) {
    let s = this.spawnCache.get(doorId);
    if (!s) {
      const dd = DOORS.find((x) => x.id === doorId)!;
      s = { ...spawnAt(dd.wall, dd.offset, this.def.w, this.def.d), y: dd.elev ?? 0 };
      this.spawnCache.set(doorId, s);
    }
    return s;
  }

  openDoor(doorId: string, open: boolean, instant = false) {
    const v = this.doors.get(doorId);
    if (!v) return;
    v.target = open ? 1 : 0;
    if (instant) v.open = v.target;
  }

  private t = 0;
  sync(state: GameState, platesHeld: Set<string>) {
    for (const v of this.doors.values()) {
      const dd = v.def;
      const restless = state.isRestless(dd);
      const dead = dd.kind === 'shifting' && state.cycle(dd).length === 0;
      if (v.boards) v.boards.visible = state.isBoarded(dd);
      if (v.seal) {
        const held = dd.lock?.plates?.every((p) => platesHeld.has(p)) ?? false;
        v.seal.visible = !!dd.lock?.plates && !state.flags.has('gateOpen:' + dd.id);
        (v.seal.material as THREE.MeshBasicMaterial).color.set(held ? 0x9dffd0 : 0xffa060);
      }
      if (v.webs) v.webs.visible = dead;
      if (dd.kind === 'shifting') {
        const c = state.cycle(dd);
        const ptr = state.ptr[dd.id] ?? 0;
        const held = state.isHeld(dd);
        if (v.rail) v.rail.visible = restless;
        if (v.plaque) v.plaque.visible = restless;
        v.pips.forEach((p, i) => {
          const on = i === ptr % Math.max(1, c.length);
          const vis = i < c.length && restless;
          p.disc.color.setRGB(vis ? (on ? 1.9 : 0.05) : 0, vis ? (on ? 0.95 : 0.03) : 0, vis ? (on ? 0.2 : 0.02) : 0);
          p.halo.opacity = vis && on ? 0.55 : 0;
          p.halo.color.setRGB(1.0, 0.45, 0.08);
        });
        (v.lanternGroup!.userData.lanterns as THREE.Object3D[]).forEach((lan, i) => {
          lan.visible = i < c.length && restless;
          const gm = v.lanterns[i];
          if (gm) {
            const on = i === ptr % Math.max(1, c.length);
            gm.color.setRGB(on ? 4.0 : 0.03, on ? 2.2 : 0.02, on ? 0.7 : 0.015);
            if (on && held) gm.color.setRGB(4.0, 3.2, 1.6);
            (lan as THREE.Object3D).scale.setScalar(on ? 1.35 : 1.1);
            const halo = (lan as THREE.Object3D).userData.haloMaterial as THREE.MeshBasicMaterial | undefined;
            if (halo) { halo.opacity = on ? 1 : 0; halo.color.setRGB(on ? 3.0 : 0, on ? 1.6 : 0, on ? 0.5 : 0); }
          }
        });
        v.sigils.forEach((m, i) => {
          const on = i === ptr % Math.max(1, c.length);
          (m.material as THREE.MeshBasicMaterial).opacity = on ? 1.0 : 0.62;
          m.scale.setScalar(on ? 1.1 : 0.88);
        });
        this.applySigils(v, state);
        if (v.inlay) v.inlay.emissiveIntensity = restless ? (held ? 0.2 : 1.1) : 0.05;
      }
    }
    for (const [id, cv] of this.candles) {
      if (cv.sconce && cv.door) cv.sconce.visible = state.cycle(state.door(cv.door)).length > 0;
      const lit = state.lit.has(id);
      if (lit !== cv.lit) cv.lit = lit;
      if (cv.flame) cv.flame.visible = lit;
    }
    for (const pv of this.plates.values()) pv.held = platesHeld.has(pv.obj.id);
    for (const fn of this.objAnimators.values()) fn(state, this.t, 0);
  }

  tick(t: number, dt: number) {
    this.t = t;
    const fl = this.weather.flash;
    for (const m of this.windowMats as THREE.MeshStandardMaterial[]) { m.emissive.setRGB(0.55, 0.65, 1.0); m.emissiveIntensity = fl * 2.4; }
    (mistMaterial().uniforms.uTime as { value: number }).value = t;
    for (const v of this.doors.values()) {
      const s = v.target > v.open ? 3.2 : 2.4;
      v.open += Math.sign(v.target - v.open) * Math.min(Math.abs(v.target - v.open), dt * s);
      v.hinge.rotation.y = -v.open * 1.75;
      if (v.mist) v.mist.visible = v.open > 0.02;
    }
    for (const [, cv] of this.candles) {
      if (!cv.light) continue;
      const target = cv.lit ? 7 * LIGHT_GAIN : 0;
      const base = (cv.light.userData.base ?? 0) as number;
      cv.light.userData.base = base + (target - base) * Math.min(1, dt * 6);
      const fl = this.flickers.find((f) => f.light === cv.light);
      if (fl) fl.base = cv.light.userData.base;
      if (cv.flame && cv.lit) {
        const s = 1 + Math.sin(t * 14 + cv.anchor.x * 3) * 0.08 + Math.sin(t * 23 + cv.anchor.z) * 0.05;
        cv.flame.scale.set(s, 1 + Math.sin(t * 17) * 0.12, s);
      }
    }
    for (const f of this.flickers) {
      const n = Math.sin(t * 9 + f.seed) * 0.5 + Math.sin(t * 17.3 + f.seed * 2) * 0.3 + Math.sin(t * 31 + f.seed) * 0.2;
      f.light.intensity = f.base * (1 + n * f.amt);
    }
    for (const pv of this.plates.values()) {
      const target = pv.held ? -0.025 : 0;
      pv.plate.position.y += (pv.y0 + target - pv.plate.position.y) * Math.min(1, dt * 12);
      if (pv.rune) pv.rune.emissiveIntensity += ((pv.held ? 2.4 : 0.6) - pv.rune.emissiveIntensity) * Math.min(1, dt * 8);
      const ua = pv.beamMat.uniforms.uA;
      ua.value += ((pv.held ? 1 : 0.3) - ua.value) * Math.min(1, dt * 6);
      pv.beam.visible = true;
    }
    for (const a of this.animators) a(t, dt);
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry && !m.userData.sharedGeo) { /* geometries owned by rooms are small; keep for reuse */ }
    });
    this.reflector?.dispose();
  }
}

const tintCache = new Map<string, THREE.Material>();
function tinted(m: THREE.MeshStandardMaterial, hex: number): THREE.Material {
  const k = m.uuid + hex;
  let t = tintCache.get(k);
  if (!t) { const c = m.clone(); c.color.multiply(new THREE.Color(hex)); t = c; tintCache.set(k, t); }
  return t;
}

let sealTex: THREE.Texture | null = null;
function sealTexture() {
  if (sealTex) return sealTex;
  sealTex = canvasTexture(256, 384, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, h / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.4, h * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.34, h * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = w / 2 + Math.cos(a) * w * 0.37, y = h / 2 + Math.sin(a) * h * 0.39;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
    }
  }, true);
  return sealTex;
}

function makeDust(w: number, d: number, h: number) {
  const n = 140;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * (w - 0.6);
    pos[i * 3 + 1] = 0.3 + Math.random() * (h - 0.6);
    pos[i * 3 + 2] = (Math.random() - 0.5) * (d - 0.6);
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
      void main(){ vec3 p=position; p.x+=sin(uTime*.1+seed)*.4; p.y+=sin(uTime*.07+seed*1.7)*.25; p.z+=cos(uTime*.09+seed*.6)*.4;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uScale*(0.012+0.01*fract(seed))/(-mv.z); vA=.25+.25*sin(uTime*.6+seed*3.);}`,
    fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d)*vA; gl_FragColor=vec4(1.,.85,.6,a*.7);} `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.dust = mat;
  pts.onBeforeRender = () => { (mat.uniforms.uTime as { value: number }).value = performance.now() / 1000; };
  return pts;
}
