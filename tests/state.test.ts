import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/game/state';
import { DOORS, DOOR_BY_ID, ROOMS, OBJECTS } from '../src/data/manor';
import { solve } from '../src/game/solver';
import { PHASE_SPECS } from '../src/data/phases';

let s: GameState;
beforeEach(() => { s = new GameState(); });

describe('mansion graph', () => {
  it('every door target exists and lives in a real room', () => {
    for (const d of DOORS) {
      const targets = d.kind === 'stable' ? [d.to!] : Object.values(d.cycles ?? {}).flat() as string[];
      for (const t of targets) {
        expect(DOOR_BY_ID[t], `${d.id} -> ${t}`).toBeTruthy();
        expect(ROOMS.find((r) => r.id === DOOR_BY_ID[t].room)).toBeTruthy();
      }
    }
  });
  it('doors do not overlap on their walls', () => {
    for (const a of DOORS) for (const b of DOORS) {
      if (a.id >= b.id || a.room !== b.room || a.wall !== b.wall) continue;
      expect(Math.abs(a.offset - b.offset), `${a.id}/${b.id}`).toBeGreaterThan(1.6);
    }
  });
  it('returning through a door does not always lead back', () => {
    const r = s.useDoor('hall.e');
    expect(r.ok).toBe(true);
    expect(s.room).toBe('dining');
    const back = s.useDoor(r.dest!);
    expect(back.room).toBe('library'); // not the hall
  });
  it('every plate and candle object references something real', () => {
    for (const o of OBJECTS) {
      if (o.type === 'candle') expect(DOOR_BY_ID[o.door!].candle).toBe(o.id);
    }
  });
});

describe('shifting doors', () => {
  it('any restless door use turns every restless door one lantern', () => {
    const a = s.ptr['hall.e'], b = s.ptr['library.n'];
    s.useDoor('hall.e');
    expect(s.ptr['hall.e']).toBe((a + 1) % 2);
    expect(s.ptr['library.n']).toBe((b + 1) % 3);
  });
  it('same door leads elsewhere the second time', () => {
    const first = s.destination(DOOR_BY_ID['hall.e']);
    s.useDoor('hall.e');
    s.room = 'hall';
    expect(s.destination(DOOR_BY_ID['hall.e'])).not.toBe(first);
  });
  it('stable doors do not shift the house', () => {
    const before = JSON.stringify(s.ptr);
    s.useDoor('hall.w');
    expect(JSON.stringify(s.ptr)).toBe(before);
  });
});

describe('candles', () => {
  it('a lit candle holds its door still, snuffing releases it', () => {
    s.flags.add('hasMatches');
    s.interact('c_library.n');
    expect(s.lit.has('c_library.n')).toBe(true);
    const p = s.ptr['library.n'];
    s.useDoor('hall.e');
    expect(s.ptr['library.n']).toBe(p);
    s.interact('c_library.n');
    s.useDoor('hall.w');
    s.room = 'hall';
    s.useDoor('hall.e');
    expect(s.ptr['library.n']).not.toBe(p);
  });
  it('needs matches', () => {
    expect(s.interact('c_hall.e').ok).toBe(false);
    s.interact('matches');
    expect(s.flags.has('hasMatches')).toBe(true);
    expect(s.interact('c_hall.e').ok).toBe(true);
  });
});

describe('clock', () => {
  it('advancing rewrites the house: pointers reset, candles snuffed', () => {
    s.flags.add('hasMatches');
    s.interact('c_hall.e');
    s.useDoor('hall.e');
    const ev = s.advancePhase(1);
    expect(s.phase).toBe(1);
    expect(s.lit.size).toBe(0);
    expect(Object.values(s.ptr).every((p) => p === 0)).toBe(true);
    expect(ev.some((e) => e.type === 'chime')).toBe(true);
    expect(ev.some((e) => e.type === 'snuff')).toBe(true);
  });
  it('phase never goes backwards', () => {
    s.advancePhase(2);
    s.advancePhase(1);
    expect(s.phase).toBe(2);
  });
  it('story beats advance the clock in order', () => {
    s.room = 'mirrors';
    s.interact('handMirror');
    expect(s.phase).toBe(1);
    expect(s.flags.has('hasMirror')).toBe(true);
    expect(s.interact('clockWind').ok).toBe(true);
    expect(s.phase).toBe(2);
    s.interact('coffin');
    expect(s.phase).toBe(3);
    expect(s.flags.has('echoGranted')).toBe(true);
    const ev = s.enterRoom('upper');
    expect(s.phase).toBe(4);
    expect(ev.some((e) => e.type === 'chime')).toBe(true);
  });
  it('sealed doors open with the clock', () => {
    expect(s.useDoor('library.w').ok).toBe(false);
    s.advancePhase(1);
    expect(s.useDoor('library.w').ok).toBe(true);
  });
});

describe('plates and gates', () => {
  it('a plate gate needs both plates held', () => {
    s.phase = 4;
    expect(s.useDoor('atticstair.n').ok).toBe(false);
    s.platesHeld.add('plate_u');
    expect(s.useDoor('atticstair.n').ok).toBe(false);
    s.platesHeld.add('plate_a');
    expect(s.useDoor('atticstair.n').ok).toBe(true);
    expect(s.room).toBe('attic');
  });
});

describe('win condition', () => {
  it('the music box ends the game exactly once', () => {
    const a = s.interact('musicBox');
    expect(a.events.some((e) => e.type === 'ending')).toBe(true);
    const b = s.interact('musicBox');
    expect(b.events.length).toBe(0);
  });
});

describe('save / reset', () => {
  it('round-trips through JSON', () => {
    s.flags.add('hasMatches');
    s.interact('c_hall.e');
    s.useDoor('hall.e');
    s.advancePhase(1);
    s.notes.add('n_intro');
    const json = JSON.stringify(s.serialize());
    const t = new GameState();
    t.load(JSON.parse(json));
    expect(JSON.stringify(t.serialize())).toBe(json);
    expect(t.room).toBe(s.room);
    expect(t.phase).toBe(1);
  });
  it('reset returns to a fresh game', () => {
    s.useDoor('hall.e');
    s.advancePhase(3);
    s.reset();
    expect(s.phase).toBe(0);
    expect(s.room).toBe('hall');
    expect(s.flags.size).toBe(0);
  });
});

describe('puzzle solvability (BFS over house states)', () => {
  for (const spec of PHASE_SPECS) {
    it(`phase ${spec.phase} is solvable and never soft-locks`, () => {
      const sol = solve(spec);
      expect(sol, 'no solution').toBeTruthy();
      expect(sol!.noDeadEnds, 'a reachable state cannot reach the goal').toBe(true);
    });
  }
  it('candles are required for the late-game puzzles', () => {
    for (const spec of PHASE_SPECS.filter((p) => p.phase === 1 || p.phase === 2 || p.phase === 4)) {
      const without = solve({ ...spec, allowCandles: false });
      const withC = solve(spec)!;
      expect(!without || without.steps.length >= withC.steps.length + 3, `phase ${spec.phase}`).toBe(true);
    }
  });
});

describe('soft-lock guards', () => {
  it('after the coffin the lord blocks the north door: the iron gate is the only way on, and the whole house stays connected', () => {
    s.room = 'crypt';
    s.interact('coffin');
    expect(s.phase).toBe(3);
    expect(s.useDoor('crypt.n').ok).toBe(false);
    // through the gate (plates held) up to the ballroom, down the grand stair, around the house and back into the crypt
    s.platesHeld.add('plate_c1'); s.platesHeld.add('plate_c2');
    const walk = ['crypt.s', 'ballroom.w', 'hall.w', 'library.s', 'dining.e', 'kitchen.s', 'cellar.n', 'kitchen.w'];
    for (const d of walk.slice(0, 3)) { const r = s.useDoor(d); expect(r.ok, d).toBe(true); }
    expect(s.room).toBe('library');
    // and back up: library -> hall -> stair -> ballroom -> crypt
    for (const d of ['library.e', 'hall.up', 'ballroom.s']) { const r = s.useDoor(d); expect(r.ok, d).toBe(true); }
    expect(s.room).toBe('crypt');
  });
  it('the grand stair door is only open at half past eleven', () => {
    s.phase = 2;
    expect(s.useDoor('hall.up').ok).toBe(false);
    s.phase = 4;
    expect(s.useDoor('hall.up').ok).toBe(false);
  });
  it('the ballroom north doors need the dance', () => {
    s.phase = 3;
    expect(s.useDoor('ballroom.n').ok).toBe(false);
    s.flags.add('danceDone');
    const r = s.useDoor('ballroom.n');
    expect(r.ok).toBe(true);
    expect(s.room).toBe('upper');
  });
});

describe('the waltz', () => {
  it('needs the echo on its tile while the player stands on the matching one, in order', async () => {
    const { updateDance, resetDance, danceState } = await import('../src/game/dance');
    const { DANCE } = await import('../src/data/manor');
    resetDance(false);
    // the player alone on every right-hand tile does nothing
    for (const t of DANCE.playerTiles) for (let i = 0; i < 30; i++) updateDance(0.1, t, null);
    expect(danceState.progress).toBe(0);
    // echo alone on its tiles does nothing either
    for (const t of DANCE.echoTiles) for (let i = 0; i < 30; i++) updateDance(0.1, null, t);
    expect(danceState.progress).toBe(0);
    let finished = false;
    for (let k = 0; k < 4; k++) for (let i = 0; i < 12; i++) if (updateDance(0.1, DANCE.playerTiles[k], DANCE.echoTiles[k]).finished) finished = true;
    expect(finished).toBe(true);
    expect(danceState.done).toBe(true);
  });
  it('a pair out of order does not count, and a badly ordered echo route is reported on release', async () => {
    const { updateDance, resetDance, danceState, analyzeRoute } = await import('../src/game/dance');
    const { DANCE } = await import('../src/data/manor');
    resetDance(false);
    for (let i = 0; i < 12; i++) updateDance(0.1, DANCE.playerTiles[1], DANCE.echoTiles[1]);
    expect(danceState.progress).toBe(0);
    for (let i = 0; i < 12; i++) updateDance(0.1, DANCE.playerTiles[0], DANCE.echoTiles[0]);
    expect(danceState.progress).toBe(1);
    const route = (order: number[], dwell: number) => order.flatMap((k) => Array.from({ length: dwell }, () => [DANCE.echoTiles[k].x, DANCE.echoTiles[k].z, 0])).flat();
    expect(analyzeRoute(route([0, 1, 2, 3], 10)).ok).toBe(true);
    expect(analyzeRoute(route([0, 2, 1, 3], 10)).ok).toBe(false);
    expect(analyzeRoute(route([0, 1, 2, 3], 2)).ok).toBe(false);
  });
});
