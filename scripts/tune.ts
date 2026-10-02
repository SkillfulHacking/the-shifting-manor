// Random search for puzzle cycles. Usage: npx tsx scripts/tune.ts <phase> [tries]
import { DOORS, DOOR_BY_ID } from '../src/data/manor';
import { solve } from '../src/game/solver';
import type { Phase, RoomId } from '../src/game/types';

const phase = Number(process.argv[2]) as Phase;
const tries = Number(process.argv[3] ?? 4000);

interface Cfg {
  start: RoomId; goal: string; active: string[]; pool: RoomId[]; mustContain: string; minLen: number; maxLen: number;
  requireCandle: boolean; echoRoom?: RoomId; flags?: string[]; lens: number[]; fixed?: Record<string, string[]>;
}
const cfgs: Record<number, Cfg> = {
  1: { start: 'mirrors', goal: 'clockWind', active: ['mirrors.e', 'gallery.n', 'conservatory.w', 'hall.e', 'library.n'],
    pool: ['hall', 'library', 'dining', 'kitchen', 'mirrors', 'gallery', 'conservatory', 'clock'], mustContain: 'clock.s', minLen: 7, maxLen: 14, requireCandle: false, flags: ['hasMatches'], lens: [2, 3, 3, 4] },
  2: { start: 'clock', goal: 'coffin', active: ['clock.e', 'gallery.n', 'cellar.e', 'library.n', 'hall.e', 'conservatory.w'],
    pool: ['hall', 'library', 'dining', 'kitchen', 'gallery', 'conservatory', 'cellar', 'crypt', 'clock'], mustContain: 'crypt.n', minLen: 8, maxLen: 16, requireCandle: true, flags: ['hasMatches'], lens: [2, 3, 3, 4] },
  4: { start: 'upper', goal: 'musicBox', active: ['upper.n', 'upper.w', 'upper.e', 'gallery.n', 'clock.e', 'cellar.e'],
    pool: ['hall', 'library', 'dining', 'kitchen', 'gallery', 'conservatory', 'cellar', 'clock', 'upper', 'atticstair'], mustContain: 'atticstair.s', minLen: 10, maxLen: 22, requireCandle: true, echoRoom: 'upper', flags: ['hasMatches'], lens: [2, 3, 3, 4] },
};
const cfg = cfgs[phase];
const doorsByRoom = (r: RoomId) => DOORS.filter((d) => d.room === r).map((d) => d.id).filter((id) => id !== 'hall.s');
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rnd(a.length)];

let best: any = null;
const stats: Record<string, number> = {};
for (let t = 0; t < tries; t++) {
  // dormant everything, then assign active
  for (const d of DOORS) if (d.kind === 'shifting') { d.cycles = { ...(d.cycles ?? {}) }; d.cycles![phase] = []; }
  const allDestPool = cfg.pool.flatMap(doorsByRoom).filter((id) => id !== cfg.mustContain);
  const holder = pick(cfg.active);
  for (const id of cfg.active) {
    const d = DOOR_BY_ID[id];
    const L = pick(cfg.lens);
    const list: string[] = [];
    for (let i = 0; i < L; i++) {
      let c: string, guard = 0;
      do { c = pick(allDestPool); guard++; } while ((DOOR_BY_ID[c].room === d.room || list.includes(c) || list.some((x) => DOOR_BY_ID[x].room === DOOR_BY_ID[c].room)) && guard < 50);
      list.push(c);
    }
    if (id === holder) list[rnd(L)] = cfg.mustContain;
    d.cycles![phase] = list;
  }
  const a = solve({ phase, start: cfg.start, goalObject: cfg.goal, flags: cfg.flags, echoRoom: cfg.echoRoom });
  stats[!a ? 'unsolvable' : !a.noDeadEnds ? 'deadend' : 'len' + a.steps.length] = (stats[!a ? 'unsolvable' : !a.noDeadEnds ? 'deadend' : 'len' + a.steps.length] ?? 0) + 1;
  if (!a || !a.noDeadEnds) continue;
  if (a.steps.length < cfg.minLen || a.steps.length > cfg.maxLen) continue;
  const b = solve({ phase, start: cfg.start, goalObject: cfg.goal, flags: cfg.flags, echoRoom: cfg.echoRoom, allowCandles: false });
  const noCandleLen = b ? b.steps.length : 999;
  if (cfg.requireCandle && noCandleLen < a.steps.length + 4) continue;
  const usesCandle = a.steps.filter((s) => s.startsWith('light')).length;
  const score = (cfg.requireCandle ? Math.min(noCandleLen, 40) - a.steps.length : 0) + a.steps.filter((s) => s.startsWith('use') && s.includes('->')).length * 0.2 + usesCandle;
  if (!best || score > best.score) {
    best = { score, len: a.steps.length, noCandleLen, steps: a.steps, cycles: Object.fromEntries(cfg.active.map((id) => [id, [...DOOR_BY_ID[id].cycles![phase]!]])) };
    console.log(JSON.stringify(best, null, 1));
  }
}
console.log(JSON.stringify(stats));
console.log('done', best ? 'found' : 'none');
