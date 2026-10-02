import type { DoorDef, ObjDef, RoomDef, RoomId } from '../game/types';
import { CYCLES } from './cycles';

/**
 * The mansion as data. Rooms are nodes, doors are edges.
 * A door's `to` (stable) or cycle entries (shifting) name the DOOR the player emerges from.
 * Coordinates: room-local metres, x = east, z = south. N wall is z = -d/2.
 */

export const START_ROOM: RoomId = 'hall';
export const START_DOOR = 'hall.s'; // the (locked) front door

export const ROOMS: RoomDef[] = [
  { id: 'hall', name: 'Entrance Hall', w: 9, d: 11, h: 5.4, sigil: 'key', theme: 'hall' },
  { id: 'library', name: 'Library', w: 10, d: 8, h: 4.4, sigil: 'moon', theme: 'library' },
  { id: 'dining', name: 'Dining Room', w: 8, d: 10, h: 4.2, sigil: 'chalice', theme: 'dining' },
  { id: 'kitchen', name: 'Kitchen', w: 8, d: 7, h: 3.6, sigil: 'flame', theme: 'kitchen' },
  { id: 'mirrors', name: 'Hall of Mirrors', w: 6, d: 12, h: 4.4, sigil: 'eye', theme: 'mirrors' },
  { id: 'gallery', name: 'Portrait Gallery', w: 5.5, d: 14, h: 4.4, sigil: 'raven', theme: 'gallery' },
  { id: 'conservatory', name: 'Conservatory', w: 9, d: 9, h: 5.6, sigil: 'rose', theme: 'conservatory' },
  { id: 'cellar', name: 'Wine Cellar', w: 8, d: 8, h: 4.2, sigil: 'spider', theme: 'cellar' },
  { id: 'crypt', name: 'Family Crypt', w: 7, d: 9, h: 4.4, sigil: 'skull', theme: 'crypt' },
  { id: 'clock', name: 'Clock Room', w: 7, d: 7, h: 6, sigil: 'bell', theme: 'clock' },
  { id: 'upper', name: 'Upper Hall', w: 6, d: 12, h: 4.4, sigil: 'crown', theme: 'upper' },
  { id: 'atticstair', name: 'Attic Stair', w: 4, d: 10, h: 5.6, sigil: 'star', theme: 'stair' },
  { id: 'attic', name: 'Attic', w: 8, d: 10, h: 5.6, theme: 'attic' },
  { id: 'ballroom', name: 'Grand Ballroom', w: 14, d: 16, h: 7, theme: 'ballroom' },
];

const shift = (id: string, room: RoomId, wall: DoorDef['wall'], offset: number, extra: Partial<DoorDef> = {}): DoorDef => ({
  id, room, wall, offset, kind: 'shifting', cycles: CYCLES[id], candle: 'c_' + id, style: 'wood', ...extra,
});
const stable = (id: string, room: RoomId, wall: DoorDef['wall'], offset: number, to: string, extra: Partial<DoorDef> = {}): DoorDef => ({
  id, room, wall, offset, kind: 'stable', to, style: 'wood', ...extra,
});

export const DOORS: DoorDef[] = [
  // ---- Entrance Hall
  stable('hall.w', 'hall', 'W', -1.5, 'library.e'),
  shift('hall.e', 'hall', 'E', -1.5),
  // the front door is a set piece, not an edge: it "leads" nowhere (handled as locked door with self target)
  stable('hall.s', 'hall', 'S', 0, 'hall.s', { style: 'iron', lock: { flag: 'ending', msg: 'The front door will not open. The wood is warm, like something breathing.' } }),

  // the grand stair climbs to a landing and a sealed door (set dressing: the way up is not through here)
  stable('hall.up', 'hall', 'N', 0, 'ballroom.w', { elev: 2.72, lock: { minPhase: 3, maxPhase: 3, msg: 'Planks and iron straps, nailed from the other side. Whatever is upstairs will not be ready for company until the half hour.', lateMsg: 'The planks are back, thicker than before. The way up is not through here any more.', visual: 'boards' } }),

  // ---- Library
  stable('library.e', 'library', 'E', 1.5, 'hall.w'),
  stable('library.s', 'library', 'S', 3, 'dining.w'),
  shift('library.n', 'library', 'N', 0),
  stable('library.w', 'library', 'W', -1.5, 'gallery.e', { lock: { minPhase: 1, msg: 'Boarded shut from the other side. Nails, hundreds of them.', visual: 'boards' } }),

  // ---- Dining Room
  stable('dining.w', 'dining', 'W', -2, 'library.s'),
  stable('dining.e', 'dining', 'E', -2, 'kitchen.w'),

  // ---- Kitchen
  stable('kitchen.w', 'kitchen', 'W', -1, 'dining.e'),
  stable('kitchen.s', 'kitchen', 'S', 2, 'cellar.n', { lock: { minPhase: 2, msg: 'The cellar door is nailed shut.', visual: 'boards' } }),

  // ---- Hall of Mirrors
  stable('mirrors.s', 'mirrors', 'S', 0, 'hall.w'),
  shift('mirrors.e', 'mirrors', 'E', -2),

  // ---- Portrait Gallery
  stable('gallery.e', 'gallery', 'E', 4.5, 'library.w'),
  stable('gallery.w', 'gallery', 'W', 4.5, 'conservatory.e', { lock: { minPhase: 1, msg: 'The door is stuck fast. Something heavy leans on the other side.', visual: 'boards' } }),
  shift('gallery.n', 'gallery', 'N', 0),

  // ---- Conservatory
  stable('conservatory.e', 'conservatory', 'E', 0, 'gallery.w'),
  shift('conservatory.w', 'conservatory', 'W', 0),

  // ---- Wine Cellar
  stable('cellar.n', 'cellar', 'N', -2, 'kitchen.s'),
  shift('cellar.e', 'cellar', 'E', -1),

  // ---- Crypt
  stable('crypt.n', 'crypt', 'N', 0, 'cellar.n', { lock: { blockPhase: 3, msg: "The lord's shade hangs in the doorway and will not let you pass. It points at the iron gate behind you." } }),
  stable('crypt.s', 'crypt', 'S', 0, 'ballroom.s', { style: 'iron', lock: { plates: ['plate_c1', 'plate_c2'], msg: 'An iron portcullis. Two stone plates in the floor are worn smooth by other feet.', visual: 'seal' } }),

  // ---- Clock Room
  stable('clock.s', 'clock', 'S', -1.5, 'gallery.n'),
  shift('clock.e', 'clock', 'E', 0),

  // ---- Upper Hall
  stable('upper.s', 'upper', 'S', 0, 'crypt.s', { style: 'iron' }),
  shift('upper.n', 'upper', 'N', 0),
  shift('upper.w', 'upper', 'W', -2),
  shift('upper.e', 'upper', 'E', -2),

  // ---- Attic Stair
  stable('atticstair.s', 'atticstair', 'S', 0, 'upper.n'),
  stable('atticstair.n', 'atticstair', 'N', 0, 'attic.s', { style: 'attic', elev: 2.7, lock: { plates: ['plate_u', 'plate_a'], msg: 'The attic door is sealed by a ring of pale light. Two plates, two hands - one of them is in the Upper Hall, not here.', visual: 'seal' } }),

  // ---- Grand Ballroom (opens at half past eleven; the iron gate in the crypt and the sealed door at the top of the grand stair both lead here)
  stable('ballroom.s', 'ballroom', 'S', -4, 'crypt.s'),
  stable('ballroom.w', 'ballroom', 'W', 5, 'hall.up'),
  stable('ballroom.n', 'ballroom', 'N', 0, 'upper.s', { lock: { flag: 'danceDone', msg: 'The great doors are barred from this side. The orchestra has not begun.', visual: 'boards' } }),

  // ---- Attic
  stable('attic.s', 'attic', 'S', 0, 'atticstair.n', { style: 'attic' }),
];

export const OBJECTS: ObjDef[] = [
  // candles beside every shifting door are generated below
  { id: 'matches', room: 'hall', type: 'matches', x: -2.4, z: 3.8, title: 'Matchbox', text: 'A box of matches, half-empty. You pocket it. A lit candle might steady a restless door.' },

  // ---- Notes (the house explains itself, a sentence at a time)
  { id: 'n_intro', room: 'hall', type: 'note', x: 2.5, z: 3.4, title: 'A letter, left open',
    text: 'Niece -\nIf you are reading this, the house has let you in, and it will not let you out until you have done what I could not.\nThe attic. Before midnight. Every Halloween the house comes awake, and a house that is awake does not keep its doors.\nDo not trust a door to lead you back the way you came.\n- Ismene' },
  { id: 'n_lantern', room: 'library', type: 'note', x: -3.2, z: 1.6, title: "Ismene's journal, p. 3",
    text: 'The restless doors are hung with lanterns. Count them. One burns brighter than the rest: that is where the door leads, right now.\nAnd when anyone passes through one of them, the whole house turns a lantern. Every restless door. Every time.\nI mapped the two I could reach on this floor, the east door of the hall and the north door of this library. I have copied what I found into your journal.' },
  { id: 'n_kitchen', room: 'kitchen', type: 'note', x: 2.0, z: -1.2, title: 'Cook\'s scrawl',
    text: 'Doors that turn only ever go forward. If one leads somewhere useless, use it again. It will not lead there twice in a row.' },
  { id: 'n_mirrors', room: 'mirrors', type: 'note', x: 1.6, z: -4.6, title: 'Scratched into the pedestal',
    text: 'GLASS DOES NOT FLATTER, IT TELLS.\nLook at a restless door through the glass and see every place it will ever take you.' },
  { id: 'n_mirror', room: 'mirrors', type: 'note', x: -1.6, z: -4.6, title: 'A pinned card',
    text: 'Room sigils are carved in every room of the house. The glass shows the sigil of each place a door will lead. Choose your door by its sigil. The great mirror here writes what it knows, in writing only glass can read; look into it again at every hour. Remember: arriving through a restless door turns the house too.' },
  { id: 'n_clock', room: 'gallery', type: 'note', x: -1.2, z: -5.0, title: "Ismene's journal, p. 9",
    text: 'The great clock stopped the night Ambrose was laid in the crypt. It is the heart of the house, and it lives in the room of the Bell. When it runs, the house changes its mind about everything.' },
  { id: 'n_candle', room: 'mirrors', type: 'note', x: -2.0, z: -2.6, title: 'Wax-stained page',
    text: 'A candle lit beside a restless door (E) holds that door still. The rest of the house keeps turning around it.\nDoors with the same number of lanterns turn in lockstep: they stay a fixed distance apart forever.\nTo change that distance, hold one door with a candle, let the others turn, then snuff it. Light it when the lantern shows the place you want, and it will still be waiting.' },
  { id: 'n_ambrose', room: 'clock', type: 'note', x: 2.3, z: -2.2, title: "Ismene's journal, p. 14",
    text: 'Ambrose lies below the cellar, in the room of the Skull. When this clock runs, the house is rewritten and every flame goes out.\nThe way to him will be a door that shows the Skull after the right number of turns. Find it with the glass, count the turns, and remember that a candle can hold one door still while the rest of the house turns around it.' },
  { id: 'n_crypt', room: 'crypt', type: 'note', x: 2.4, z: -2.6, title: 'Stone tablet',
    text: 'HERE LIES AMBROSE VANE, WHO KEPT THE HOUSE.\nHe rests until the great clock runs again. Lift the lid to let him go.' },
  { id: 'n_echo', room: 'crypt', type: 'note', x: -2.6, z: 1.0, title: 'Scrap of lace',
    text: 'The dead do not leave. They repeat. Press Q to begin an echo of yourself, and Q again to let it go: it will walk your steps and stand where you stopped. It keeps standing there even after you leave the room, and it will hold what you cannot.' },
  { id: 'n_upper', room: 'upper', type: 'note', x: 1.8, z: 3.0, title: "Ismene's last page",
    text: 'The Attic Stair. Two plates: one below, one at the head of the stair. I could never be in two places at once.\nAt midnight the house tears itself in every direction. Hold the door you need. Trust the glass.\nI have copied the doors of this hall into your journal. And houses keep their old stairs: the iron door behind you still opens down into the crypt, and the crypt still opens into the cellar.' },
  { id: 'n_attic', room: 'atticstair', type: 'note', x: 1.4, z: -4.0, title: 'Chalk on the stair',
    text: 'One plate is up here. The other is in the Upper Hall, where you must leave your echo.\nLight a candle before you look: every door you pass turns the whole house.' },

  // ---- Story beats
  { id: 'handMirror', room: 'mirrors', type: 'handMirror', x: 0, z: -5.0 },
  { id: 'clockWind', room: 'clock', type: 'clockWind', x: 0, z: -2.8 },
  { id: 'coffin', room: 'crypt', type: 'coffin', x: 0, z: -0.6 },
  { id: 'musicBox', room: 'attic', type: 'atticThrone', x: 0, z: -1.5 },

  // ---- Plates
  { id: 'plate_c1', room: 'crypt', type: 'plate', x: -2.4, z: -2.6 },
  { id: 'plate_c2', room: 'crypt', type: 'plate', x: 0, z: 3.0 },
  { id: 'plate_u', room: 'upper', type: 'plate', x: -1.6, z: -3.6 },
  { id: 'plate_a', room: 'atticstair', type: 'plate', x: 0, z: -3.6 },
  { id: 'n_ball', room: 'ballroom', type: 'note', x: -6.0, z: 6.4, title: 'A dance card, left on the lectern',
    text: 'The Lady Eleanora opened every Halloween with the same waltz: four steps, and every step has a mirror. Lit sigils on the left are for one partner, lit sigils on the right are for the other, and both must stand on their own at the same moment.\nA duet cannot be danced alone - but you are not alone, if you have left yourself behind. Walk the left-hand sigils in the Lady\'s order and let your echo take them (Q to begin, Q to release). Then take the right-hand sigils in step with it.' },
];

// A sconce candle beside every shifting door. Physical placement is decided by the room builder.
for (const d of DOORS) {
  if (d.kind === 'shifting') {
    OBJECTS.push({ id: 'c_' + d.id, room: d.room, type: 'candle', x: 0, z: 0, door: d.id, requires: { flag: 'hasMatches', msg: 'Nothing to light it with.' } });
  }
}

export const ROOM_BY_ID: Record<string, RoomDef> = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
export const DOOR_BY_ID: Record<string, DoorDef> = Object.fromEntries(DOORS.map((d) => [d.id, d]));

/** The Lady's pas de deux in the ballroom: four mirrored pairs of floor sigils. The echo takes the left tile of each pair, the player the right. */
export const DANCE = {
  echoTiles: [
    { x: -4.6, z: 3.2, sigil: 'moon' },
    { x: -2.4, z: 0.6, sigil: 'rose' },
    { x: -4.6, z: -1.8, sigil: 'bell' },
    { x: -2.4, z: -4.4, sigil: 'star' },
  ] as { x: number; z: number; sigil: string }[],
  playerTiles: [
    { x: 4.6, z: 3.2, sigil: 'moon' },
    { x: 2.4, z: 0.6, sigil: 'rose' },
    { x: 4.6, z: -1.8, sigil: 'bell' },
    { x: 2.4, z: -4.4, sigil: 'star' },
  ] as { x: number; z: number; sigil: string }[],
  radius: 0.85,
};
