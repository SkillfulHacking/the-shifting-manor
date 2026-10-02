import * as THREE from 'three';

export interface Box {
  minX: number; maxX: number; minZ: number; maxZ: number;
  /** top surface height; solids ignore this, steps use it as walkable floor height */
  top: number;
}

export interface Colliders {
  /** room bounds (walkable rectangle) */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  solids: Box[];
  steps: Box[];
}

export interface InputState {
  fwd: number; // -1..1
  right: number;
  sprint: boolean;
}

const RADIUS = 0.34;
const EYE = 1.66;

/** First-person controller: smoothed but snappy walking, circle-vs-AABB collision, walkable step boxes. */
export class Player {
  pos = new THREE.Vector3(0, 0, 0); // feet position
  yaw = 0;
  pitch = 0;
  vel = new THREE.Vector2();
  footDist = 0;
  private bob = 0;
  private stepEvent = false;
  moving = false;

  groundAt(c: Colliders, x: number, z: number, y: number): number {
    let g = 0;
    for (const s of c.steps) {
      if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.top <= y + 0.56 && s.top > g) g = s.top;
    }
    return g;
  }

  teleport(x: number, z: number, yaw: number, y = 0) {
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.vel.set(0, 0);
  }

  /** returns true when a footstep should sound */
  update(dt: number, input: InputState, c: Colliders): boolean {
    dt = Math.min(dt, 0.05);
    const speed = input.sprint ? 3.9 : 2.5;
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    // forward vector for yaw (camera looks down -Z at yaw 0)
    const fx = -sinY, fz = -cosY, rx = cosY, rz = -sinY;
    let tx = fx * input.fwd + rx * input.right;
    let tz = fz * input.fwd + rz * input.right;
    const len = Math.hypot(tx, tz);
    if (len > 1) { tx /= len; tz /= len; }
    tx *= speed; tz *= speed;
    // acceleration: quick but not instant
    const k = 1 - Math.exp(-dt * (len > 0 ? 14 : 18));
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.y += (tz - this.vel.y) * k;

    const dx = this.vel.x * dt, dz = this.vel.y * dt;
    this.moveAxis(c, dx, 0);
    this.moveAxis(c, 0, dz);

    // vertical: follow ground smoothly
    const g = this.groundAt(c, this.pos.x, this.pos.z, this.pos.y);
    this.pos.y += (g - this.pos.y) * (1 - Math.exp(-dt * 16));

    const sp = Math.hypot(this.vel.x, this.vel.y);
    this.moving = sp > 0.25;
    let step = false;
    if (this.moving) {
      this.footDist += sp * dt;
      const stride = input.sprint ? 1.55 : 1.25;
      if (this.footDist > stride) { this.footDist -= stride; step = true; }
      this.bob += sp * dt * 5.2;
    } else this.bob *= 0.9;
    return step;
  }

  private moveAxis(c: Colliders, dx: number, dz: number) {
    if (!dx && !dz) return;
    let nx = this.pos.x + dx, nz = this.pos.z + dz;
    const b = c.bounds;
    nx = Math.min(Math.max(nx, b.minX + RADIUS), b.maxX - RADIUS);
    nz = Math.min(Math.max(nz, b.minZ + RADIUS), b.maxZ - RADIUS);
    const y = this.pos.y;
    const blockers = c.solids;
    for (let iter = 0; iter < 2; iter++) {
      for (const s of blockers) {
        if (this.pos.y > s.top - 0.05 && s.top > 0.01) continue; // standing on it? (not used yet)
        const cx = Math.min(Math.max(nx, s.minX), s.maxX);
        const cz = Math.min(Math.max(nz, s.minZ), s.maxZ);
        const ddx = nx - cx, ddz = nz - cz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < RADIUS * RADIUS) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            nx = cx + (ddx / d) * RADIUS;
            nz = cz + (ddz / d) * RADIUS;
          } else {
            // centre inside box: push along axis of least penetration
            const l = nx - s.minX, r = s.maxX - nx, t = nz - s.minZ, bt = s.maxZ - nz;
            const m = Math.min(l, r, t, bt);
            if (m === l) nx = s.minX - RADIUS; else if (m === r) nx = s.maxX + RADIUS;
            else if (m === t) nz = s.minZ - RADIUS; else nz = s.maxZ + RADIUS;
          }
        }
      }
    }
    // stairs: a step taller than we can climb blocks like a wall
    for (const s of c.steps) {
      if (s.top <= y + 0.56) continue;
      const cx = Math.min(Math.max(nx, s.minX), s.maxX);
      const cz = Math.min(Math.max(nz, s.minZ), s.maxZ);
      const ddx = nx - cx, ddz = nz - cz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < RADIUS * RADIUS && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        nx = cx + (ddx / d) * RADIUS;
        nz = cz + (ddz / d) * RADIUS;
      }
    }
    this.pos.x = nx;
    this.pos.z = nz;
  }

  applyToCamera(cam: THREE.PerspectiveCamera) {
    const bobY = Math.sin(this.bob) * 0.018;
    const bobX = Math.cos(this.bob * 0.5) * 0.008;
    cam.position.set(this.pos.x + bobX, this.pos.y + EYE + bobY, this.pos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch;
    cam.rotation.z = 0;
  }
}
