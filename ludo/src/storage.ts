import type { HighScore, Settings } from './game/types';

const KEY_SETTINGS = 'ludo-party-settings-v1';
const KEY_SCORES = 'ludo-party-scores-v1';
const MAX_SCORES = 10;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'sunny',
  music: true,
  sfx: true,
  musicVolume: 0.55,
  sfxVolume: 0.85,
  speed: 'normal',
  autoMove: true,
  shake: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(KEY_SCORES);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => x && typeof x.score === 'number').slice(0, MAX_SCORES);
  } catch {
    return [];
  }
}

/** Returns the index the entry landed at (or -1 if it did not make the table). */
export function addScore(entry: HighScore): number {
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score || a.date - b.date);
  const idx = list.indexOf(entry);
  const trimmed = list.slice(0, MAX_SCORES);
  try {
    localStorage.setItem(KEY_SCORES, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
  return idx < MAX_SCORES ? idx : -1;
}

export function qualifies(score: number): boolean {
  const list = loadScores();
  if (list.length < MAX_SCORES) return score > 0;
  return score > list[list.length - 1].score;
}

export function clearScores() {
  try {
    localStorage.removeItem(KEY_SCORES);
  } catch {
    /* ignore */
  }
}
