import { DANCE } from '../data/manor';

/** 0 idle, 1 someone standing on it, 2 danced, 3 the current beat's target */
export type TileState = 0 | 1 | 2 | 3;

/**
 * The Lady's pas de deux. Eight sigil tiles in two mirrored columns. On beat k the pair (echo tile k, player tile k) is lit:
 * the ECHO must be on its tile while YOU are on yours, at the same moment. The echo replays the route you recorded
 * (and loops in this room), so the player has to dance in step with their own past self.
 * Runtime-only state; the result is saved as the `danceDone` flag.
 */
export const danceState = {
  progress: 0,
  tilesE: [0, 0, 0, 0] as TileState[],
  tilesP: [0, 0, 0, 0] as TileState[],
  dwell: 0,
  wrong: 0,
  done: false,
  t: 0,
  /** which beat the Lady is showing off while nobody is dancing */
  demo: 0,
  demoT: 0,
  /** the beat whose pair is highlighted (the Lady stands between them) */
  shown: 0,
  /** the last released route was wrong: the Lady dances the figure again */
  bad: false,
};

export interface DanceEvents { step?: number; wrong?: boolean; finished?: boolean; demoStart?: boolean }

// (out-of-order routes are judged once, when the echo is released: see analyzeRoute)

export function resetDance(done: boolean) {
  danceState.progress = done ? DANCE.echoTiles.length : 0;
  danceState.dwell = 0;
  danceState.wrong = 0;
  danceState.done = done;
  const fill = (v: TileState) => DANCE.echoTiles.map(() => v) as TileState[];
  danceState.tilesE = fill(done ? 2 : 0);
  danceState.tilesP = fill(done ? 2 : 0);
}

interface P2 { x: number; z: number }

/** What an echo route does on the tiles: the order of tiles it pauses on (>= 0.4 s) and any tile it only brushes past. */
export function analyzeRoute(path: number[]): { order: number[]; ok: boolean; message: string } {
  const n = path.length / 3, r2 = DANCE.radius * DANCE.radius;
  const order: number[] = []; // tiles paused on (>= 0.4 s)
  const visits: number[] = []; // every tile touched, in order
  let cur = -1, run = 0;
  for (let i = 0; i <= n; i++) {
    let at = -1;
    if (i < n && i >= 3) DANCE.echoTiles.forEach((t, k) => { if ((path[i * 3] - t.x) ** 2 + (path[i * 3 + 1] - t.z) ** 2 < r2) at = k; });
    if (at === cur && at >= 0) run++;
    else {
      if (cur >= 0) { visits.push(cur); if (run >= 4) order.push(cur); }
      cur = at; run = at >= 0 ? 1 : 0;
    }
  }
  const want = DANCE.echoTiles.map((_, i) => i);
  const ok = order.length === want.length && order.every((v, i) => v === want[i]);
  const inOrder = visits.every((v, i) => i === 0 || v > visits[i - 1]);
  let message: string;
  if (ok) message = 'Your echo has the figure by heart. Now dance with it: stand on the right-hand sigil of whichever pair it is on.';
  else if (visits.length === 0) message = 'Your echo never touched a left-hand sigil. Walk to each one and stand still on it for about a second.';
  else if (!inOrder) message = 'Wrong order: the Lady dances them I, II, III, IV. Watch her again, then record once more.';
  else if (visits.length < want.length) message = 'Your echo missed some sigils. It must visit all four, I to IV, and pause about a second on each.';
  else message = 'Right order, but too quick: pause for a full second on each sigil so the echo can hold its pose.';
  return { order, ok, message };
}

export function updateDance(dt: number, player: P2 | null, echo: P2 | null): DanceEvents {
  const ev: DanceEvents = {};
  const s = danceState;
  s.t += dt;
  const r2 = DANCE.radius * DANCE.radius;
  const near = (a: P2 | null, b: P2) => !!a && (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < r2;
  const n = DANCE.echoTiles.length;
  if (s.done) {
    s.tilesE = DANCE.echoTiles.map(() => 2) as TileState[];
    s.tilesP = DANCE.echoTiles.map(() => 2) as TileState[];
    return ev;
  }
  const k = s.progress;
  // with no echo yet, the Lady demonstrates the figure pair by pair
  let shown = k;
  if ((!echo || s.bad) && k === 0) {
    const prev = s.demo;
    s.demoT += dt; s.demo = Math.floor(s.demoT / 2.4) % n; shown = s.demo;
    if (s.demo === 0 && prev !== 0) ev.demoStart = true;
  }
  s.shown = shown;
  s.tilesE = DANCE.echoTiles.map((t, i) => (i < k ? 2 : i === shown ? 3 : near(echo, t) ? 1 : 0)) as TileState[];
  s.tilesP = DANCE.playerTiles.map((t, i) => (i < k ? 2 : i === shown ? 3 : near(player, t) ? 1 : 0)) as TileState[];
  if (echo && near(echo, DANCE.echoTiles[k]) && near(player, DANCE.playerTiles[k])) {
    s.dwell += dt;
    if (s.dwell > 0.4) {
      s.dwell = 0; s.progress++; ev.step = s.progress;
      if (s.progress >= n) { s.done = true; ev.finished = true; }
    }
  } else s.dwell = 0;
  return ev;
}
