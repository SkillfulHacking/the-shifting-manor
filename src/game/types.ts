/** Pure-data types for the mansion graph. No THREE / DOM dependencies so the logic is unit-testable. */

export type RoomId =
  | 'hall' | 'library' | 'dining' | 'kitchen' | 'mirrors' | 'gallery'
  | 'conservatory' | 'cellar' | 'crypt' | 'clock' | 'upper' | 'atticstair' | 'attic' | 'ballroom';

export type Wall = 'N' | 'E' | 'S' | 'W';
/** 0 = 9 PM, 1 = 10 PM, 2 = 11 PM, 3 = 11:30 PM, 4 = MIDNIGHT */
export type Phase = 0 | 1 | 2 | 3 | 4;
export const PHASE_LABELS = ['9:00 PM', '10:00 PM', '11:00 PM', '11:30 PM', 'MIDNIGHT'] as const;

export type SigilName =
  | 'moon' | 'chalice' | 'flame' | 'raven' | 'eye' | 'rose' | 'spider' | 'skull' | 'bell' | 'crown' | 'star' | 'key';

export interface LockRule {
  /** flag that must be set */
  flag?: string;
  /** minimum clock phase */
  minPhase?: Phase;
  /** locked while the clock is exactly at this phase */
  blockPhase?: Phase;
  /** locked once the clock has passed this phase */
  maxPhase?: Phase;
  /** message shown instead of `msg` once the clock has passed maxPhase */
  lateMsg?: string;
  /** plate ids that must all be held right now (by the player or an echo) */
  plates?: string[];
  /** text shown when locked */
  msg: string;
  /** visual: 'boards' (nailed planks, vanish when unlocked), 'gate' (iron seal), 'chain' */
  visual?: 'boards' | 'seal';
}

export interface DoorDef {
  id: string;
  room: RoomId;
  wall: Wall;
  /** metres along the wall from its centre (x for N/S walls, z for E/W walls) */
  offset: number;
  kind: 'stable' | 'shifting';
  /** stable: id of the door the player emerges from */
  to?: string;
  /** shifting: for each clock phase, the ordered list of door ids the door cycles through */
  cycles?: Partial<Record<Phase, string[]>>;
  /** shifting: candle object that can hold this door still */
  candle?: string;
  lock?: LockRule;
  style?: 'wood' | 'iron' | 'attic' | 'stairs';
  /** door sits on a raised landing (metres above the room floor) */
  elev?: number;
}

export type ObjType =
  | 'candle' | 'plate' | 'note' | 'matches' | 'handMirror' | 'clockWind' | 'coffin' | 'atticThrone';

export interface ObjDef {
  id: string;
  room: RoomId;
  type: ObjType;
  /** room-local position */
  x: number;
  z: number;
  /** candle: which door it holds */
  door?: string;
  /** note text (may contain \n) */
  text?: string;
  title?: string;
  /** requires flag before it can be used */
  requires?: { flag: string; msg: string };
}

export interface RoomDef {
  id: RoomId;
  name: string;
  w: number; // x extent
  d: number; // z extent
  h: number;
  sigil?: SigilName;
  theme: string;
}

export type GameEvent =
  | { type: 'shift' }
  | { type: 'chime'; phase: Phase }
  | { type: 'candle'; id: string; lit: boolean }
  | { type: 'flag'; name: string }
  | { type: 'note'; id: string }
  | { type: 'snuff' }
  | { type: 'ending' };

export interface SaveData {
  v: 1;
  room: RoomId;
  arriveDoor: string | null;
  phase: Phase;
  ptr: Record<string, number>;
  lit: string[];
  flags: string[];
  visited: RoomId[];
  learned: string[];
  notes: string[];
  playTime: number;
  echo: EchoSave | null;
  turns?: number;
}

export interface EchoSave {
  room: RoomId;
  /** samples [x,z,yaw] at fixed dt */
  path: number[];
  final: [number, number];
}
