export type PlayerKind = 'human' | 'bot';
export type BotLevel = 'easy' | 'normal' | 'hard';
export type EndMode = 'first' | 'all';
export type Speed = 'slow' | 'normal' | 'fast' | 'turbo';

export interface PlayerSetup {
  name: string;
  kind: PlayerKind;
  level: BotLevel;
  color: number; // palette index 0..5
  avatar: string;
}

export interface GameOptions {
  players: PlayerSetup[];
  tokens: number; // 1..4
  endMode: EndMode;
  autoMove: boolean;
  easyStart: boolean;
  speed: Speed;
}

export interface SetupPrefs {
  players: PlayerSetup[];
  tokens: number;
  endMode: EndMode;
  easyStart: boolean;
}

export interface Settings {
  theme: string;
  music: boolean;
  sfx: boolean;
  musicVolume: number;
  sfxVolume: number;
  speed: Speed;
  autoMove: boolean;
  shake: boolean;
  setup?: SetupPrefs;
}

export interface HighScore {
  name: string;
  avatar: string;
  score: number;
  rank: number;
  players: number;
  won: boolean;
  date: number;
  color: number;
  captures: number;
}

export type Phase = 'intro' | 'roll' | 'rolling' | 'select' | 'moving' | 'over';

export interface PlayerSnap {
  name: string;
  avatar: string;
  color: number;
  kind: PlayerKind;
  level: BotLevel;
  score: number;
  rank: number;
  home: number;
  out: number;
  tokens: number;
  progress: number;
  captures: number;
}

export interface Snapshot {
  phase: Phase;
  current: number;
  dice: number;
  rolling: boolean;
  rollId: number;
  rollMs: number;
  sixCount: number;
  players: PlayerSnap[];
  humanTurn: boolean;
  canRoll: boolean;
  canSelect: boolean;
  movableCount: number;
  over: boolean;
}

export interface ResultRow {
  pi: number;
  name: string;
  avatar: string;
  color: number;
  kind: PlayerKind;
  score: number;
  rank: number;
  home: number;
  captures: number;
}

export interface Results {
  rows: ResultRow[];
  winner: number;
  durationMs: number;
}

export interface BannerMsg {
  id: number;
  text: string;
  sub?: string;
  color?: number; // palette index
  big?: boolean;
}

export const AVATARS = ['🦁', '🐸', '🐼', '🦊', '🐯', '🐨', '🐵', '🦄', '🐙', '🐧', '🐶', '🐱', '🐰', '🐻', '🐲', '🦖', '🐳', '🦉'];
export const BOT_NAMES = ['Robo Rex', 'Beep Boop', 'Gizmo', 'Sparky', 'Bolt', 'Chip'];
export const COLOR_NAMES = ['Red', 'Green', 'Yellow', 'Blue', 'Purple', 'Orange'];
