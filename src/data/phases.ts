import type { PhaseSpec } from '../game/solver';

/** Where each clock phase begins and what completes it. Used by the solver-based puzzle tests. */
export const PHASE_SPECS: PhaseSpec[] = [
  { phase: 0, start: 'hall', goalObject: 'handMirror', flags: ['hasMatches'] },
  { phase: 1, start: 'mirrors', goalObject: 'clockWind', flags: ['hasMatches', 'hasMirror'] },
  { phase: 2, start: 'clock', goalObject: 'coffin', flags: ['hasMatches', 'hasMirror', 'clockWound'] },
  { phase: 3, start: 'crypt', goalObject: 'n_upper', flags: ['hasMatches', 'hasMirror', 'clockWound', 'lordFreed', 'danceDone'], echoRoom: 'crypt' },
  { phase: 4, start: 'upper', goalObject: 'musicBox', flags: ['hasMatches', 'hasMirror', 'clockWound', 'lordFreed', 'danceDone'], echoRoom: 'upper' },
];
