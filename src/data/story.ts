import type { Phase } from '../game/types';

export const CHIME_TEXT: Record<number, string> = {
  1: 'Ten strokes in the walls. Every restless door forgets what it knew.',
  2: 'The great clock ticks again, and the house changes its mind.',
  3: 'One stroke, and something in the crypt has been let go.',
  4: 'Twelve. The house tears open in every direction.',
};

export const ENDING_LINES = [
  'The music box plays a tune you have never heard, and somehow know.',
  'Below you, the house exhales. Every door that ever lost its way remembers where it goes.',
  'Ismene stands at the attic window, as she has stood every Halloween for thirty years. This time she turns around.',
  '"You were quicker than I was," she says. "It only ever wanted someone to finish the song."',
  'The rain stops. The clock in the hall strikes its last stroke, and for the first time in a long time it is only a clock.',
  'When you reach the front door, it is not locked. Beyond it, the sky over the moor is the colour of ash and roses.',
  'Somewhere below, every clock in the house agrees on the hour. Nobody has to be anywhere before midnight again.',
  'You stay at the window a long while. The rain has stopped, the moon has come out of the cloud, and the house, for the first time since you crossed its threshold, is quiet.',
  '#THE HOUSE IS STILL',
  'Thank you for playing.',
];

export type { Phase };
