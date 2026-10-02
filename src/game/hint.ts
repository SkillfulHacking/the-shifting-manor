import { DOOR_BY_ID, ROOM_BY_ID } from '../data/manor';
import { solve } from './solver';
import type { GameState } from './state';
import type { PhaseSpec } from './solver';

const WALL = { N: 'north', E: 'east', S: 'south', W: 'west' } as const;
const GOAL: Record<number, { goalObject: string; echoRoom?: 'upper' | 'crypt' }> = {
  0: { goalObject: 'handMirror' },
  1: { goalObject: 'clockWind' },
  2: { goalObject: 'coffin' },
  4: { goalObject: 'musicBox', echoRoom: 'upper' },
};

const doorName = (id: string) => {
  const d = DOOR_BY_ID[id];
  return `the ${WALL[d.wall]} door of the ${ROOM_BY_ID[d.room].name}`;
};

/** Plain-words next steps for the current act, found by the same solver that proves every act is winnable. */
export function whisper(st: GameState): string[] | null {
  if (st.phase === 3) {
    return st.flags.has('danceDone')
      ? ['Climb through the ballroom\'s north doors to the Upper Hall.']
      : ['Leave an echo on the far crypt plate (Q), stand on the near plate, and open the iron gate.', 'In the ballroom, record your echo walking the left-hand sigils I to IV, then dance the right-hand ones in step with it.'];
  }
  const g = GOAL[st.phase];
  if (!g) return null;
  const spec: PhaseSpec = {
    phase: st.phase, start: st.room, goalObject: g.goalObject, flags: [...st.flags, 'danceDone'], echoRoom: g.echoRoom,
    init: { room: st.room, ptr: st.ptr, lit: [...st.lit], echo: !!st.echo && st.echo.room === g.echoRoom },
  };
  const sol = solve(spec);
  if (!sol) return null;
  const out: string[] = [];
  if (!st.flags.has('hasMatches') && sol.steps.some((x) => x.startsWith('light '))) out.push('Fetch the matches from the table in the Entrance Hall first.');
  for (const step of sol.steps.slice(0, 4)) {
    let m: RegExpMatchArray | null;
    if ((m = step.match(/^use (\S+) -> (\S+)$/))) out.push(`Go through ${doorName(m[1])}.`);
    else if ((m = step.match(/^light (\S+)$/))) out.push(`Light the candle beside ${doorName(m[1])}.`);
    else if ((m = step.match(/^snuff (\S+)$/))) out.push(`Snuff the candle beside ${doorName(m[1])}.`);
    else if (step === 'record echo') out.push('Stand on the plate in the Upper Hall and leave an echo there (Q, then Q).');
  }
  if (sol.steps.length > 4) out.push(`... and about ${sol.steps.length - 4} more.`);
  return out;
}
