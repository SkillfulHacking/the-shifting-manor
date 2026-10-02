export interface Settings {
  sensitivity: number;
  fov: number;
  master: number;
  music: number;
  sfx: number;
  quality: 'low' | 'medium' | 'high';
  headBob: boolean;
  invertY: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1, fov: 78, master: 0.8, music: 0.7, sfx: 0.9, quality: 'high', headBob: true, invertY: false,
};

const KEY = 'shifting-manor/settings/v1';
const SAVE_KEY = 'shifting-manor/save/v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function readSave(): string | null {
  try { return localStorage.getItem(SAVE_KEY); } catch { return null; }
}
export function writeSave(json: string) {
  try { localStorage.setItem(SAVE_KEY, json); } catch { /* ignore */ }
}
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
