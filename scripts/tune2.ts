// Random search for puzzle cycles (v2). Usage: npx tsx scripts/tune2.ts <phase> <tries> [seed]
import { writeFileSync } from 'node:fs';
import { DOORS, DOOR_BY_ID } from '../src/data/manor';
import { solve } from '../src/game/solver';
import type { Phase, RoomId } from '../src/game/types';

const phase = Number(process.argv[2]) as Phase;
const tries = Number(process.argv[3] ?? 2000);

interface Cfg {
  start: RoomId; goal: string; active: { id: string; lens: number[] }[]; pool: RoomId[]; mustContain: string; minLen: number; maxLen: number;
  requireCandle: boolean; forbidCandle?: boolean; softCandle?: boolean; echoRoom?: RoomId; flags?: string[]; minMoves: number;
}
const cfgs: Record<number, Cfg> = {
  0: { start: 'hall', goal: 'handMirror', active: [{ id: 'hall.e', lens: [2, 3] }, { id: 'library.n', lens: [2, 3] }],
    pool: ['hall', 'library', 'dining', 'kitchen', 'mirrors'], mustContain: 'mirrors.s', minLen: 6, maxLen: 10, requireCandle: true, flags: ['hasMatches'], minMoves: 4 },
  1: { start: 'mirrors', goal: 'clockWind', active: [{ id: 'mirrors.e', lens: [3] }, { id: 'gallery.n', lens: [3] }, { id: 'library.n', lens: [2, 3] }],
    pool: ['hall', 'library', 'dining', 'kitchen', 'mirrors', 'gallery', 'conservatory', 'clock'], mustContain: 'clock.s', minLen: 4, maxLen: (process.env.P1MAX ? Number(process.env.P1MAX) : 9), requireCandle: !!process.env.P1REQ, forbidCandle: false, softCandle: !process.env.P1REQ, flags: ['hasMatches', 'hasMirror'], minMoves: 4 },
  2: { start: 'clock', goal: 'coffin', active: [{ id: 'clock.e', lens: [2, 3] }, { id: 'gallery.n', lens: [3] }, { id: 'cellar.e', lens: [3] }, { id: 'library.n', lens: [2, 3] }],
    pool: ['hall', 'library', 'dining', 'kitchen', 'gallery', 'conservatory', 'cellar', 'crypt', 'clock'], mustContain: 'crypt.n', minLen: 9, maxLen: 15, requireCandle: true, flags: ['hasMatches', 'hasMirror', 'clockWound'], minMoves: 5 },
  4: { start: 'upper', goal: 'musicBox', active: [{ id: 'upper.n', lens: [3] }, { id: 'upper.w', lens: [2, 3] }, { id: 'upper.e', lens: [2, 3] }, { id: 'clock.e', lens: [2] }, { id: 'cellar.e', lens: [2] }],
    pool: ['hall', 'library', 'dining', 'kitchen', 'gallery', 'conservatory', 'cellar', 'clock', 'upper', 'atticstair'], mustContain: 'atticstair.s', minLen: 11, maxLen: 20, requireCandle: true, echoRoom: 'upper', flags: ['hasMatches', 'hasMirror', 'clockWound', 'lordFreed'], minMoves: 6 },
};
const cfg = cfgs[phase];
const doorsByRoom = (r: RoomId) => DOORS.filter((d) => d.room === r).map((d) => d.id).filter((id) => id !== 'hall.s' && id !== 'hall.up');
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rnd(a.length)];

let best: any = null;
const stats: Record<string, number> = {};
for (let t = 0; t < tries; t++) {
  for (const d of DOORS) if (d.kind === 'shifting') { d.cycles = { ...(d.cycles ?? {}) }; d.cycles![phase] = []; }
  const destPool = cfg.pool.flatMap(doorsByRoom).filter((id) => id !== cfg.mustContain);
  const holder = pick(cfg.active).id;
  for (const a of cfg.active) {
    const d = DOOR_BY_ID[a.id];
    const L = pick(a.lens);
    const list: string[] = [];
    for (let i = 0; i < L; i++) {
      let c: string, guard = 0;
      do { c = pick(destPool); guard++; } while ((DOOR_BY_ID[c].room === d.room || list.some((x) => DOOR_BY_ID[x].room === DOOR_BY_ID[c].room)) && guard < 80);
      list.push(c);
    }
    if (a.id === holder) list[rnd(L)] = cfg.mustContain;
    d.cycles![phase] = list;
  }
  const spec = { phase, start: cfg.start, goalObject: cfg.goal, flags: cfg.flags, echoRoom: cfg.echoRoom };
  const a = solve(spec);
  const key = !a ? 'unsolvable' : !a.noDeadEnds ? 'deadend' : 'ok';
  stats[key] = (stats[key] ?? 0) + 1;
  if (!a || !a.noDeadEnds) continue;
  const moves = a.steps.filter((s) => s.startsWith('use')).length;
  if (a.steps.length < cfg.minLen || a.steps.length > cfg.maxLen || moves < cfg.minMoves) continue;
  const b = solve({ ...spec, allowCandles: false });
  const nc = b ? b.steps.length : 999;
  if (cfg.requireCandle && nc < a.steps.length + (phase === 0 ? 2 : 4)) continue;
  if (cfg.forbidCandle && nc > a.steps.length + 2) continue;
  if (cfg.softCandle && (nc >= 999 || nc < a.steps.length + 3 || nc > a.steps.length + 9)) continue;
  const lights = a.steps.filter((s) => s.startsWith('light')).length;
  const score = (cfg.requireCandle ? Math.min(nc, 30) - a.steps.length : 0) + moves * 0.3 + lights * 0.5 - (a.states > 20000 ? 2 : 0);
  if (!best || score > best.score) {
    best = { score, len: a.steps.length, noCandleLen: nc, steps: a.steps, cycles: Object.fromEntries(cfg.active.map((x) => [x.id, [...DOOR_BY_ID[x.id].cycles![phase]!]])) };
    writeFileSync(`scripts/best-${phase}${process.argv[4] ?? ''}.json`, JSON.stringify(best, null, 1));
  }
}
console.log(JSON.stringify(stats), best ? `best score ${best.score} len ${best.len} nc ${best.noCandleLen}` : 'none');
