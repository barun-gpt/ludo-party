export interface MusicStyle {
  bpm: number;
  lead: OscillatorType;
  bass: OscillatorType;
  root: number; // MIDI note of key
  minor: boolean;
  drums: 0 | 1 | 2;
  echo: boolean;
  leadVol: number;
  pluck?: boolean; // short decay (music box / marimba feel)
}

export type Ambient = 'bokeh' | 'dots' | 'grid' | 'sprinkles' | 'bubbles' | 'leaves' | 'stars' | 'hearts' | 'snow';

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  bg: string;
  animatedBg?: boolean;
  dark: boolean;
  text: string;
  subText: string;
  panel: string;
  panelBorder: string;
  btn: string;
  btn2: string;
  boardBg: string;
  boardEdge: string;
  boardShadow: string;
  cell: string;
  cellStroke: string;
  star: string;
  style: 'solid' | 'neon';
  glow: number;
  players: string[];
  ambient: Ambient;
  ambientColors: string[];
  music: MusicStyle;
  diceFace: string;
  dicePip: string;
}

export const THEMES: Theme[] = [
  {
    id: 'sunny', name: 'Sunny Day', emoji: '☀️',
    bg: 'linear-gradient(160deg, #e0f2fe 0%, #fef3c7 55%, #fce7f3 100%)',
    dark: false, text: '#1e293b', subText: '#64748b',
    panel: 'rgba(255,255,255,0.78)', panelBorder: 'rgba(15,23,42,0.08)',
    btn: '#f97316', btn2: '#ec4899',
    boardBg: '#ffffff', boardEdge: '#cbd5e1', boardShadow: 'rgba(30,41,59,0.28)',
    cell: '#ffffff', cellStroke: '#cbd5e1', star: '#94a3b8',
    style: 'solid', glow: 0,
    players: ['#ef4444', '#22c55e', '#facc15', '#3b82f6', '#a855f7', '#f97316'],
    ambient: 'bokeh', ambientColors: ['#fde68a', '#bae6fd', '#fbcfe8', '#bbf7d0'],
    music: { bpm: 118, lead: 'triangle', bass: 'triangle', root: 60, minor: false, drums: 1, echo: false, leadVol: 0.5 },
    diceFace: '#ffffff', dicePip: '#1e293b',
  },
  {
    id: 'midnight', name: 'Midnight', emoji: '🌙',
    bg: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
    dark: true, text: '#f1f5f9', subText: '#94a3b8',
    panel: 'rgba(30,41,59,0.78)', panelBorder: 'rgba(148,163,184,0.2)',
    btn: '#6366f1', btn2: '#a855f7',
    boardBg: '#1e293b', boardEdge: '#475569', boardShadow: 'rgba(0,0,0,0.65)',
    cell: '#273449', cellStroke: '#3b4a63', star: '#64748b',
    style: 'solid', glow: 0,
    players: ['#f43f5e', '#22c55e', '#eab308', '#3b82f6', '#a855f7', '#f97316'],
    ambient: 'dots', ambientColors: ['#6366f1', '#a855f7', '#38bdf8'],
    music: { bpm: 100, lead: 'sine', bass: 'triangle', root: 57, minor: true, drums: 1, echo: true, leadVol: 0.5 },
    diceFace: '#f8fafc', dicePip: '#0f172a',
  },
  {
    id: 'neon', name: 'Neon Arcade', emoji: '🕹️',
    bg: 'radial-gradient(ellipse at 50% 0%, #2a0a4a 0%, #0a0118 60%, #05010c 100%)',
    dark: true, text: '#f5f3ff', subText: '#c4b5fd',
    panel: 'rgba(20,6,40,0.72)', panelBorder: 'rgba(217,70,239,0.5)',
    btn: '#ff2e88', btn2: '#00b8d4',
    boardBg: '#0c0620', boardEdge: '#ff2e88', boardShadow: 'rgba(255,46,136,0.5)',
    cell: '#130a2c', cellStroke: '#3b2a7a', star: '#00e5ff',
    style: 'neon', glow: 14,
    players: ['#ff2e88', '#39ff14', '#ffe600', '#00e5ff', '#b026ff', '#ff8a00'],
    ambient: 'grid', ambientColors: ['#ff2e88', '#00e5ff', '#b026ff'],
    music: { bpm: 126, lead: 'sawtooth', bass: 'square', root: 57, minor: true, drums: 2, echo: true, leadVol: 0.3 },
    diceFace: '#1a0b33', dicePip: '#00e5ff',
  },
  {
    id: 'candy', name: 'Candy Land', emoji: '🍭',
    bg: 'linear-gradient(135deg, #ffd1e8 0%, #e9d5ff 50%, #c7f0ff 100%)',
    dark: false, text: '#6b2154', subText: '#a3517f',
    panel: 'rgba(255,255,255,0.72)', panelBorder: 'rgba(236,72,153,0.28)',
    btn: '#ec4899', btn2: '#a855f7',
    boardBg: '#fff0f7', boardEdge: '#f9a8d4', boardShadow: 'rgba(190,24,93,0.28)',
    cell: '#ffffff', cellStroke: '#fbcfe8', star: '#f472b6',
    style: 'solid', glow: 0,
    players: ['#ff5c8a', '#34d399', '#fbbf24', '#60a5fa', '#c084fc', '#fb923c'],
    ambient: 'sprinkles', ambientColors: ['#f472b6', '#60a5fa', '#fbbf24', '#34d399', '#c084fc'],
    music: { bpm: 132, lead: 'square', bass: 'triangle', root: 65, minor: false, drums: 1, echo: false, leadVol: 0.2 },
    diceFace: '#ffffff', dicePip: '#db2777',
  },
  {
    id: 'ocean', name: 'Ocean Splash', emoji: '🐳',
    bg: 'linear-gradient(180deg, #38bdf8 0%, #0369a1 55%, #0c4a6e 100%)',
    dark: true, text: '#f0f9ff', subText: '#bae6fd',
    panel: 'rgba(8,47,73,0.58)', panelBorder: 'rgba(186,230,253,0.32)',
    btn: '#06b6d4', btn2: '#3b82f6',
    boardBg: '#ecfeff', boardEdge: '#67e8f9', boardShadow: 'rgba(8,47,73,0.55)',
    cell: '#ffffff', cellStroke: '#a5f3fc', star: '#22d3ee',
    style: 'solid', glow: 0,
    players: ['#f43f5e', '#10b981', '#facc15', '#2563eb', '#8b5cf6', '#f97316'],
    ambient: 'bubbles', ambientColors: ['#e0f2fe', '#bae6fd', '#ffffff'],
    music: { bpm: 96, lead: 'sine', bass: 'sine', root: 62, minor: false, drums: 1, echo: true, leadVol: 0.5 },
    diceFace: '#ffffff', dicePip: '#0c4a6e',
  },
  {
    id: 'jungle', name: 'Jungle Safari', emoji: '🦁',
    bg: 'linear-gradient(180deg, #4d7c0f 0%, #166534 60%, #14532d 100%)',
    dark: true, text: '#fefce8', subText: '#d9f99d',
    panel: 'rgba(20,83,45,0.62)', panelBorder: 'rgba(217,249,157,0.32)',
    btn: '#eab308', btn2: '#65a30d',
    boardBg: '#fef9e7', boardEdge: '#a16207', boardShadow: 'rgba(20,40,10,0.6)',
    cell: '#fffdf5', cellStroke: '#d6c79a', star: '#a16207',
    style: 'solid', glow: 0,
    players: ['#dc2626', '#16a34a', '#eab308', '#0284c7', '#9333ea', '#ea580c'],
    ambient: 'leaves', ambientColors: ['#84cc16', '#22c55e', '#a3e635', '#facc15'],
    music: { bpm: 112, lead: 'triangle', bass: 'sine', root: 62, minor: false, drums: 2, echo: false, leadVol: 0.5, pluck: true },
    diceFace: '#fffbeb', dicePip: '#713f12',
  },
  {
    id: 'sunset', name: 'Sunset Beach', emoji: '🌅',
    bg: 'linear-gradient(180deg, #fb923c 0%, #f43f5e 45%, #7c3aed 100%)',
    dark: true, text: '#fff7ed', subText: '#fed7aa',
    panel: 'rgba(76,29,149,0.45)', panelBorder: 'rgba(254,215,170,0.38)',
    btn: '#f59e0b', btn2: '#ef4444',
    boardBg: '#fff7ed', boardEdge: '#fdba74', boardShadow: 'rgba(76,29,149,0.5)',
    cell: '#ffffff', cellStroke: '#fed7aa', star: '#fb923c',
    style: 'solid', glow: 0,
    players: ['#e11d48', '#059669', '#f59e0b', '#2563eb', '#7c3aed', '#ea580c'],
    ambient: 'bokeh', ambientColors: ['#fde68a', '#fecaca', '#fbcfe8'],
    music: { bpm: 104, lead: 'triangle', bass: 'triangle', root: 63, minor: false, drums: 1, echo: true, leadVol: 0.45 },
    diceFace: '#ffffff', dicePip: '#7c2d12',
  },
  {
    id: 'galaxy', name: 'Galaxy', emoji: '🚀',
    bg: 'radial-gradient(ellipse at 30% 20%, #312e81 0%, #1e1b4b 35%, #020617 100%)',
    dark: true, text: '#eef2ff', subText: '#a5b4fc',
    panel: 'rgba(30,27,75,0.68)', panelBorder: 'rgba(165,180,252,0.32)',
    btn: '#8b5cf6', btn2: '#ec4899',
    boardBg: '#1e1b4b', boardEdge: '#6366f1', boardShadow: 'rgba(99,102,241,0.5)',
    cell: '#2a2670', cellStroke: '#4338ca', star: '#fde047',
    style: 'solid', glow: 6,
    players: ['#fb7185', '#34d399', '#fde047', '#60a5fa', '#c084fc', '#fb923c'],
    ambient: 'stars', ambientColors: ['#ffffff', '#c7d2fe', '#fde68a'],
    music: { bpm: 88, lead: 'sine', bass: 'sine', root: 58, minor: true, drums: 0, echo: true, leadVol: 0.5 },
    diceFace: '#eef2ff', dicePip: '#312e81',
  },
  {
    id: 'rainbow', name: 'Rainbow Party', emoji: '🌈',
    bg: 'linear-gradient(120deg, #ff9a9e, #fecfef, #fdfd96, #a1ffce, #a0c4ff, #d5aaff, #ff9a9e)',
    animatedBg: true,
    dark: false, text: '#4c1d95', subText: '#7c3aed',
    panel: 'rgba(255,255,255,0.72)', panelBorder: 'rgba(124,58,237,0.28)',
    btn: '#f43f5e', btn2: '#8b5cf6',
    boardBg: '#ffffff', boardEdge: '#c4b5fd', boardShadow: 'rgba(124,58,237,0.32)',
    cell: '#ffffff', cellStroke: '#ddd6fe', star: '#f472b6',
    style: 'solid', glow: 0,
    players: ['#ef4444', '#22c55e', '#eab308', '#3b82f6', '#a855f7', '#f97316'],
    ambient: 'hearts', ambientColors: ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'],
    music: { bpm: 138, lead: 'square', bass: 'triangle', root: 60, minor: false, drums: 2, echo: false, leadVol: 0.2 },
    diceFace: '#ffffff', dicePip: '#7c3aed',
  },
  {
    id: 'snowy', name: 'Snowy Land', emoji: '❄️',
    bg: 'linear-gradient(180deg, #bfdbfe 0%, #e0f2fe 50%, #f8fafc 100%)',
    dark: false, text: '#0c4a6e', subText: '#0369a1',
    panel: 'rgba(255,255,255,0.72)', panelBorder: 'rgba(14,165,233,0.28)',
    btn: '#0ea5e9', btn2: '#6366f1',
    boardBg: '#f8fafc', boardEdge: '#93c5fd', boardShadow: 'rgba(14,116,144,0.3)',
    cell: '#ffffff', cellStroke: '#cfe8f7', star: '#7dd3fc',
    style: 'solid', glow: 0,
    players: ['#f43f5e', '#14b8a6', '#f59e0b', '#3b82f6', '#8b5cf6', '#fb923c'],
    ambient: 'snow', ambientColors: ['#ffffff', '#dbeafe', '#93c5fd'],
    music: { bpm: 108, lead: 'sine', bass: 'triangle', root: 67, minor: false, drums: 1, echo: true, leadVol: 0.5, pluck: true },
    diceFace: '#ffffff', dicePip: '#0c4a6e',
  },
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

// ---------- color helpers ----------
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** amt in -1..1 ; negative darkens, positive lightens */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex);
  const f = (c: number) => {
    const v = amt < 0 ? c * (1 + amt) : c + (255 - c) * amt;
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

const MODAL: Record<string, string> = {
  sunny: '#ffffff',
  midnight: '#1e293b',
  neon: '#140828',
  candy: '#fff5fa',
  ocean: '#0b3b5c',
  jungle: '#14532d',
  sunset: '#4c1d95',
  galaxy: '#1e1b4b',
  rainbow: '#ffffff',
  snowy: '#ffffff',
};

export function modalColor(t: Theme): string {
  return MODAL[t.id] ?? (t.dark ? '#1e293b' : '#ffffff');
}

export function themeVars(t: Theme): Record<string, string> {
  return {
    '--bg': t.bg,
    '--text': t.text,
    '--sub': t.subText,
    '--panel': t.panel,
    '--panel-border': t.panelBorder,
    '--btn': t.btn,
    '--btn2': t.btn2,
    '--modal': modalColor(t),
    color: t.text,
  };
}

/** true when a hex color is light (used to pick contrasting neutrals) */
export function isLight(hex: string): boolean {
  const [r, g, b] = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
