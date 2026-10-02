import * as THREE from 'three';
import type { EchoSave, RoomId } from './types';
import { spectre } from '../world/ghostStyle';

const SAMPLE_DT = 0.1;
const MAX_SECONDS = 30;

/**
 * Ghost echo: the player records their footsteps in one room. On release the echo walks the recorded route and then
 * stands where the recording ended, holding any pressure plate under it - even while the player is in another room.
 */
export class Echo {
  recording = false;
  recRoom: RoomId | null = null;
  private buf: number[] = [];
  private acc = 0;
  recTime = 0;
  data: EchoSave | null = null;
  /** seconds since playback started (large = finished) */
  playT = 1e9;
  ghost: THREE.Group | null = null;
  private ghostUpdate: ((t: number) => void) | null = null;

  start(room: RoomId, x: number, z: number, yaw: number) {
    this.recording = true;
    this.recRoom = room;
    this.buf = [x, z, yaw];
    this.acc = 0;
    this.recTime = 0;
  }

  cancel() {
    this.recording = false;
    this.recRoom = null;
    this.buf = [];
  }

  /** returns true if the recording hit its time limit */
  sample(dt: number, x: number, z: number, yaw: number): boolean {
    if (!this.recording) return false;
    this.recTime += dt;
    this.acc += dt;
    while (this.acc >= SAMPLE_DT) {
      this.acc -= SAMPLE_DT;
      this.buf.push(x, z, yaw);
    }
    return this.recTime >= MAX_SECONDS;
  }

  stop(x: number, z: number): EchoSave | null {
    if (!this.recording || !this.recRoom) return null;
    this.recording = false;
    const path = this.buf.slice();
    const save: EchoSave = { room: this.recRoom, path, final: [x, z] };
    this.data = save;
    this.playT = 0;
    this.recRoom = null;
    return save;
  }

  load(d: EchoSave | null) {
    this.data = d;
    this.playT = 1e9;
  }

  clear() {
    this.data = null;
    this.recording = false;
  }

  update(dt: number) {
    if (this.data) this.playT += dt;
  }

  /** current position of the echo, or null if none */
  position(out = new THREE.Vector3()): { x: number; z: number; yaw: number; walking: boolean } | null {
    const d = this.data;
    if (!d) return null;
    const n = d.path.length / 3;
    let pt = this.playT;
    if (d.room === 'ballroom') { const dur = (n - 1) * SAMPLE_DT; pt = Math.max(0, (this.playT % (dur + 2.5 + 2.0)) - 2.5); } // in the ballroom the echo keeps dancing: 2.5 s lead-in, the figure, 3.5 s rest
    const f = pt / SAMPLE_DT;
    if (f >= n - 1) return { x: d.final[0], z: d.final[1], yaw: d.path[(n - 1) * 3 + 2], walking: false };
    const i = Math.floor(f), a = f - i;
    const x = d.path[i * 3] * (1 - a) + d.path[(i + 1) * 3] * a;
    const z = d.path[i * 3 + 1] * (1 - a) + d.path[(i + 1) * 3 + 1] * a;
    const yaw = d.path[i * 3 + 2];
    void out;
    return { x, z, yaw, walking: true };
  }

  getGhost(): THREE.Group {
    if (!this.ghost) {
      this.ghost = spectre(1, 'cold');
      this.ghostUpdate = this.ghost.userData.update ?? null;
      this.ghost.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
    }
    return this.ghost;
  }

  animate(t: number) {
    this.ghostUpdate?.(t);
  }
}
