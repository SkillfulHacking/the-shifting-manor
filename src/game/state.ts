import type { DoorDef, GameEvent, ObjDef, Phase, RoomId, SaveData, EchoSave } from './types';
import { DOORS, OBJECTS, START_ROOM, START_DOOR } from '../data/manor';

/**
 * Deterministic core of the mansion. Rooms are nodes, doors are edges.
 *
 * THE HOUSE RULES (what the player learns):
 *  1. Stable doors always lead to the same place - but not necessarily back where you came from.
 *  2. Shifting doors (marked by hanging lanterns) lead to one of several places. The lit lantern shows which.
 *  3. Whenever you pass through a shifting door, the house shifts: EVERY shifting door advances one lantern.
 *  4. A lit candle beside a shifting door holds it still while the rest of the house shifts.
 *  5. The clock's chime rewrites the house (new destinations, candles snuffed).
 *  6. Mirrors show the truth: the sigils of every destination a door cycles through.
 */

export interface UseDoorResult {
  ok: boolean;
  msg?: string;
  dest?: string; // door id the player emerges from
  room?: RoomId;
  events: GameEvent[];
}

export class GameState {
  room: RoomId = START_ROOM;
  arriveDoor: string | null = START_DOOR;
  phase: Phase = 0;
  ptr: Record<string, number> = {};
  lit = new Set<string>();
  flags = new Set<string>();
  visited = new Set<RoomId>();
  /** shifting doors whose full cycle the player has seen in a mirror (or by walking) */
  learned = new Set<string>();
  notes = new Set<string>();
  playTime = 0;
  echo: EchoSave | null = null;
  /** how many times the house has turned since the last chime */
  turns = 0;
  /** runtime only: plates currently held (by player or echo) */
  platesHeld = new Set<string>();

  constructor() {
    this.reset();
  }

  reset() {
    this.room = START_ROOM;
    this.arriveDoor = START_DOOR;
    this.phase = 0;
    this.ptr = {};
    for (const d of DOORS) if (d.kind === 'shifting') this.ptr[d.id] = 0;
    this.lit.clear();
    this.flags.clear();
    this.visited = new Set([START_ROOM]);
    this.learned.clear();
    this.notes.clear();
    this.playTime = 0;
    this.echo = null;
    this.turns = 0;
    this.platesHeld.clear();
  }

  door(id: string): DoorDef {
    const d = DOORS.find((x) => x.id === id);
    if (!d) throw new Error('unknown door ' + id);
    return d;
  }

  cycle(door: DoorDef, phase: Phase = this.phase): string[] {
    const c = door.cycles;
    if (!c) return [];
    for (let p = phase; p >= 0; p--) if (c[p as Phase]) return c[p as Phase]!;
    return [];
  }

  /** a shifting door that currently has more than one destination (otherwise it behaves like a plain door) */
  isRestless(door: DoorDef): boolean {
    return door.kind === 'shifting' && this.cycle(door).length > 1;
  }

  /** the door id this door leads to right now */
  destination(door: DoorDef): string {
    if (door.kind === 'stable') return door.to!;
    const c = this.cycle(door);
    return c[this.ptr[door.id] % c.length];
  }

  /** the room a door currently leads to */
  destinationRoom(door: DoorDef): RoomId {
    return this.door(this.destination(door)).room;
  }

  isHeld(door: DoorDef): boolean {
    return !!door.candle && this.lit.has(door.candle);
  }

  /** null if unlocked, otherwise the message to display */
  lockReason(door: DoorDef): string | null {
    if (door.kind === 'shifting' && this.cycle(door).length === 0) return 'This door is asleep. It will wake at a later hour.';
    const l = door.lock;
    if (!l) return null;
    if (l.blockPhase !== undefined && this.phase === l.blockPhase) return l.msg;
    if (l.maxPhase !== undefined && this.phase > l.maxPhase) return l.lateMsg ?? l.msg;
    if (l.minPhase !== undefined && this.phase < l.minPhase) return l.msg;
    if (l.flag && !this.flags.has(l.flag)) return l.msg;
    if (l.plates && !l.plates.every((p) => this.platesHeld.has(p))) return l.msg;
    return null;
  }

  /** visual "sealed" state without plates (plate gates are only checked on use) */
  isBoarded(door: DoorDef): boolean {
    const l = door.lock;
    if (!l) return false;
    if (l.minPhase !== undefined && this.phase < l.minPhase) return true;
    if (l.maxPhase !== undefined && this.phase > l.maxPhase) return true;
    if (l.flag && !this.flags.has(l.flag)) return true;
    return false;
  }

  useDoor(doorId: string): UseDoorResult {
    const door = this.door(doorId);
    const events: GameEvent[] = [];
    const lock = this.lockReason(door);
    if (lock) return { ok: false, msg: lock, events };
    const dest = this.destination(door);
    const room = this.door(dest).room;
    if (this.isRestless(door)) {
      this.learn(door.id);
      this.shiftHouse();
      events.push({ type: 'shift' });
    }
    this.room = room;
    this.arriveDoor = dest;
    this.visited.add(room);
    return { ok: true, dest, room, events };
  }

  /** every non-held shifting door advances one lantern */
  shiftHouse() {
    this.turns++;
    for (const d of DOORS) {
      if (!this.isRestless(d)) continue;
      if (this.isHeld(d)) continue;
      this.ptr[d.id] = (this.ptr[d.id] + 1) % this.cycle(d).length;
    }
  }

  learn(doorId: string) {
    this.learned.add(doorId + ':' + this.phase);
  }
  hasLearned(doorId: string) {
    return this.learned.has(doorId + ':' + this.phase);
  }

  objects(room: RoomId = this.room): ObjDef[] {
    return OBJECTS.filter((o) => o.room === room);
  }

  object(id: string): ObjDef {
    const o = OBJECTS.find((x) => x.id === id);
    if (!o) throw new Error('unknown object ' + id);
    return o;
  }

  /** the player uses (presses E on) an object */
  interact(objId: string): { ok: boolean; msg?: string; events: GameEvent[] } {
    const o = this.object(objId);
    const events: GameEvent[] = [];
    if (o.requires && !this.flags.has(o.requires.flag)) return { ok: false, msg: o.requires.msg, events };
    switch (o.type) {
      case 'candle': {
        const cd = DOORS.find((d) => d.id === o.door);
        if (cd && this.cycle(cd).length === 0) return { ok: false, msg: 'The candle will not take: this door is asleep.', events };
        if (this.lit.has(o.id)) {
          this.lit.delete(o.id);
          events.push({ type: 'candle', id: o.id, lit: false });
        } else {
          this.lit.add(o.id);
          events.push({ type: 'candle', id: o.id, lit: true });
        }
        break;
      }
      case 'note': {
        this.notes.add(o.id);
        if (o.id === 'n_lantern' && this.phase === 0) { this.learn('hall.e'); this.learn('library.n'); } // Ismene had mapped the two doors she could reach
        if (o.id === 'n_upper' && this.phase === 4) { for (const d of ['upper.n', 'upper.w', 'upper.e', 'cellar.e']) this.learn(d); } // her last page lists the doors of the upper hall
        events.push({ type: 'note', id: o.id });
        break;
      }
      case 'handMirror': {
        if (this.flags.has('hasMirror')) break;
        this.setFlag('hasMirror', events);
        this.notes.add('n_mirror');
        this.advancePhase(1, events);
        break;
      }
      case 'clockWind': {
        if (this.flags.has('clockWound')) break;
        this.setFlag('clockWound', events);
        this.advancePhase(2, events);
        break;
      }
      case 'coffin': {
        if (this.flags.has('lordFreed')) break;
        this.setFlag('lordFreed', events);
        this.setFlag('echoGranted', events);
        this.advancePhase(3, events);
        break;
      }
      case 'atticThrone': {
        if (this.flags.has('ending')) break;
        this.setFlag('ending', events);
        events.push({ type: 'ending' });
        break;
      }
      case 'matches': {
        if (!this.flags.has('hasMatches')) this.setFlag('hasMatches', events);
        this.notes.add(o.id);
        events.push({ type: 'note', id: o.id });
        break;
      }
      case 'plate':
        break;
    }
    return { ok: true, events };
  }

  setFlag(name: string, events?: GameEvent[]) {
    if (this.flags.has(name)) return;
    this.flags.add(name);
    events?.push({ type: 'flag', name });
  }

  /** The clock moves: house is rewritten, candles snuffed. */
  advancePhase(to: Phase, events: GameEvent[] = []) {
    if (to <= this.phase) return events;
    this.phase = to;
    this.turns = 0;
    for (const d of DOORS) if (d.kind === 'shifting') this.ptr[d.id] = 0;
    if (this.lit.size) events.push({ type: 'snuff' });
    this.lit.clear();
    events.push({ type: 'chime', phase: to });
    return events;
  }

  /** Entering a room can trigger story beats (returns events). */
  enterRoom(room: RoomId): GameEvent[] {
    const events: GameEvent[] = [];
    if (room === 'upper' && this.phase === 3 && this.flags.has('lordFreed')) {
      this.setFlag('upperReached', events);
      this.advancePhase(4, events);
    }
    return events;
  }

  serialize(): SaveData {
    return {
      v: 1,
      room: this.room,
      arriveDoor: this.arriveDoor,
      phase: this.phase,
      ptr: { ...this.ptr },
      lit: [...this.lit],
      flags: [...this.flags],
      visited: [...this.visited],
      learned: [...this.learned],
      notes: [...this.notes],
      playTime: this.playTime,
      echo: this.echo,
      turns: this.turns,
    };
  }

  load(s: SaveData) {
    this.reset();
    this.room = s.room;
    this.arriveDoor = s.arriveDoor;
    this.phase = s.phase;
    for (const [k, v] of Object.entries(s.ptr ?? {})) if (k in this.ptr && Number.isInteger(v) && v >= 0 && v < 16) this.ptr[k] = v;
    this.lit = new Set(s.lit);
    this.flags = new Set(s.flags);
    this.visited = new Set(s.visited);
    this.learned = new Set(s.learned);
    this.notes = new Set(s.notes);
    this.playTime = s.playTime ?? 0;
    this.echo = s.echo ?? null;
    this.turns = s.turns ?? 0;
  }

  /** compact key of everything that matters for puzzle solving (used by the solver/tests) */
  key(): string {
    const ptrs = DOORS.filter((d) => d.kind === 'shifting').map((d) => this.ptr[d.id]).join('');
    return [this.room, this.phase, ptrs, [...this.lit].sort().join(','), [...this.flags].sort().join(',')].join('|');
  }
}
