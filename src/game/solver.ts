import { DOORS, OBJECTS } from '../data/manor';
import type { DoorDef, Phase, RoomId } from './types';

/**
 * Breadth-first puzzle solver used by tests and by scripts/tune.ts to design and verify the puzzles.
 * It searches the state space of a single clock phase (the chime resets pointers and candles, so phases are independent).
 */

export interface PhaseSpec {
  phase: Phase;
  start: RoomId;
  /** object id that completes the phase (must be interacted in its room) */
  goalObject: string;
  /** flags assumed set on entry */
  flags?: string[];
  /** doors that count as open even though they have plate locks, keyed by room-state (echo assumed) */
  allowCandles?: boolean;
  /** if set, a gate needs this pseudo-flag (set by 'record' action in the given room) */
  echoRoom?: RoomId;
  /** plate gates that require echoFlag */
  gatedDoors?: string[];
  /** start from an arbitrary live state instead of the phase start (used for hints) */
  init?: { room: RoomId; ptr: Record<string, number>; lit: string[]; echo: boolean };
}

interface S {
  room: RoomId;
  ptr: number[];
  lit: number;
  echo: boolean;
}

export interface Solution {
  steps: string[];
  states: number;
  /** every reachable state can still reach the goal */
  noDeadEnds: boolean;
}

export function solve(spec: PhaseSpec): Solution | null {
  const phase = spec.phase;
  const flags = new Set(spec.flags ?? []);
  const restless: DoorDef[] = [];
  const cycles = new Map<string, string[]>();
  const cycleOf = (d: DoorDef): string[] => {
    const c = d.cycles;
    if (!c) return [];
    for (let p = phase; p >= 0; p--) if (c[p as Phase]) return c[p as Phase]!;
    return [];
  };
  for (const d of DOORS) {
    if (d.kind !== 'shifting') continue;
    const c = cycleOf(d);
    cycles.set(d.id, c);
    if (c.length > 1) restless.push(d);
  }
  const idx = new Map(restless.map((d, i) => [d.id, i]));
  const doorsIn = new Map<RoomId, DoorDef[]>();
  for (const d of DOORS) {
    if (!doorsIn.has(d.room)) doorsIn.set(d.room, []);
    doorsIn.get(d.room)!.push(d);
  }
  const goal = OBJECTS.find((o) => o.id === spec.goalObject)!;
  const doorById = new Map(DOORS.map((d) => [d.id, d]));

  const key = (s: S) => s.room + '|' + s.ptr.join('') + '|' + s.lit + '|' + (s.echo ? 1 : 0);
  const start: S = spec.init
    ? {
        room: spec.init.room,
        ptr: restless.map((d) => (spec.init!.ptr[d.id] ?? 0) % Math.max(1, cycles.get(d.id)!.length)),
        lit: restless.reduce((m, d, i) => (spec.init!.lit.includes('c_' + d.id) ? m | (1 << i) : m), 0),
        echo: spec.init.echo,
      }
    : { room: spec.start, ptr: restless.map(() => 0), lit: 0, echo: false };

  const canUse = (d: DoorDef, s: S): boolean => {
    const l = d.lock;
    if (!l) return true;
    if (l.blockPhase !== undefined && phase === l.blockPhase) return false;
    if (l.maxPhase !== undefined && phase > l.maxPhase) return false;
    if (l.minPhase !== undefined && phase < l.minPhase) return false;
    if (l.flag && !flags.has(l.flag)) return false;
    if (l.plates) {
      // plate gates need the echo mechanic
      return s.echo;
    }
    return true;
  };

  const nexts = (s: S): { label: string; s: S }[] => {
    const out: { label: string; s: S }[] = [];
    for (const d of doorsIn.get(s.room) ?? []) {
      if (d.id === 'hall.s') continue;
      if (!canUse(d, s)) continue;
      let dest: string;
      let ptr = s.ptr;
      const ri = idx.get(d.id);
      if (d.kind === 'shifting') {
        const c = cycles.get(d.id)!;
        if (!c.length) continue;
        dest = ri === undefined ? c[0] : c[s.ptr[ri] % c.length];
      } else dest = d.to!;
      if (ri !== undefined) {
        ptr = s.ptr.map((p, i) => {
          const rd = restless[i];
          if ((s.lit >> i) & 1) return p;
          return (p + 1) % cycles.get(rd.id)!.length;
        });
      } else if (d.kind === 'shifting') {
        // single-entry shifting door behaves as stable
      }
      out.push({ label: `use ${d.id} -> ${dest}`, s: { room: doorById.get(dest)!.room, ptr, lit: s.lit, echo: s.echo } });
    }
    if (spec.allowCandles !== false) {
      for (const d of doorsIn.get(s.room) ?? []) {
        const ri = idx.get(d.id);
        if (ri === undefined) continue;
        if ((s.lit >> ri) & 1) out.push({ label: `snuff ${d.id}`, s: { ...s, lit: s.lit & ~(1 << ri) } });
        else out.push({ label: `light ${d.id}`, s: { ...s, lit: s.lit | (1 << ri) } });
      }
    }
    if (spec.echoRoom && s.room === spec.echoRoom && !s.echo) out.push({ label: 'record echo', s: { ...s, echo: true } });
    return out;
  };

  const isGoal = (s: S) => s.room === goal.room;

  // forward BFS
  const seen = new Map<string, { prev: string | null; label: string; s: S }>();
  const q: S[] = [start];
  seen.set(key(start), { prev: null, label: 'start', s: start });
  let found: string | null = null;
  const order: S[] = [];
  const parents = new Map<string, string[]>(); // for dead-end analysis (reverse edges)
  for (let qi = 0; qi < q.length; qi++) {
    const s = q[qi];
    order.push(s);
    const k = key(s);
    if (isGoal(s) && !found) found = k;
    for (const n of nexts(s)) {
      const nk = key(n.s);
      if (!parents.has(nk)) parents.set(nk, []);
      parents.get(nk)!.push(k);
      if (!seen.has(nk)) {
        seen.set(nk, { prev: k, label: n.label, s: n.s });
        q.push(n.s);
        if (q.length > 3_000_000) return null;
      }
    }
  }
  if (!found) return null;
  const steps: string[] = [];
  for (let k: string | null = found; k; k = seen.get(k)!.prev) {
    const e = seen.get(k)!;
    if (e.prev) steps.push(e.label);
  }
  steps.reverse();

  // dead-end analysis: reverse reachability from goal states
  const good = new Set<string>();
  const stack: string[] = [];
  for (const s of order) if (isGoal(s)) { good.add(key(s)); stack.push(key(s)); }
  while (stack.length) {
    const k = stack.pop()!;
    for (const p of parents.get(k) ?? []) if (!good.has(p)) { good.add(p); stack.push(p); }
  }
  return { steps, states: seen.size, noDeadEnds: good.size === seen.size };
}
