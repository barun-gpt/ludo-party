import { THEMES, type TokenShape } from '../themes';
import native from '../../native.config.json';

/* ============ EDIT THESE ============ */
/** 10 game points = 1 coin  (so 100 points = 10 coins) */
export const POINTS_PER_COIN = 10;
export const AD_REWARD = 20; // coins per rewarded ad
export const AD_DAILY_LIMIT = 5; // ads per day
export const AD_SECONDS = 5; // length of the placeholder ad
export const FOLLOW_REWARD = 250; // coins per social follow (one time each)
export const FOLLOW_WAIT_SEC = 10; // seconds before "Claim" unlocks after opening the page
/** Everything below comes from native.config.json (project root) - edit that file, not this one. */
export const LINKS = { instagram: native.instagramUrl, facebook: native.facebookPageUrl };
export const API_URL: string = native.apiUrl.trim().replace(/\/+$/, '');
export const GOOGLE_WEB_CLIENT_ID: string = native.googleWebClientId.trim();
export const FACEBOOK_APP_ID: string = native.facebookAppId.trim();
export const FACEBOOK_CLIENT_TOKEN: string = native.facebookClientToken.trim();
export const ADMOB_REWARDED_ID: string = native.admobRewardedUnitId.trim();
export const ADMOB_TESTING: boolean = native.admobTesting;
/* ==================================== */

export type Category = 'token' | 'dice' | 'board' | 'ui';

export interface BoardColors {
  boardBg: string;
  boardEdge: string;
  boardShadow: string;
  cell: string;
  cellStroke: string;
  star: string;
}

export interface ShopItem {
  id: string;
  cat: Category;
  name: string;
  price: number;
  emoji: string;
  shape?: TokenShape;
  dice?: { face: string; pip: string };
  board?: BoardColors;
}

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'token', label: 'Tokens', emoji: '🔴' },
  { id: 'dice', label: 'Dice', emoji: '🎲' },
  { id: 'board', label: 'Boards', emoji: '🧩' },
  { id: 'ui', label: 'Themes', emoji: '🎨' },
];

const UI_PRICES: Record<string, number> = {
  sunny: 0, midnight: 700, ocean: 800, candy: 900, jungle: 1000,
  sunset: 1100, snowy: 1200, rainbow: 1400, neon: 1600, galaxy: 2000,
};

export const SHOP: ShopItem[] = [
  // tokens (from 250)
  { id: 't_classic', cat: 'token', name: 'Classic', price: 0, emoji: '🔴', shape: 'circle' },
  { id: 't_flat', cat: 'token', name: 'Flat Dot', price: 250, emoji: '⚪', shape: 'flat' },
  { id: 't_gem', cat: 'token', name: 'Gem', price: 350, emoji: '💎', shape: 'hexagon' },
  { id: 't_star', cat: 'token', name: 'Star', price: 450, emoji: '⭐', shape: 'star' },
  { id: 't_heart', cat: 'token', name: 'Heart', price: 550, emoji: '❤️', shape: 'heart' },
  // dice (from 300)
  { id: 'd_classic', cat: 'dice', name: 'Classic', price: 0, emoji: '🎲', dice: { face: '', pip: '' } },
  { id: 'd_gold', cat: 'dice', name: 'Gold', price: 300, emoji: '🟡', dice: { face: '#fde68a', pip: '#78350f' } },
  { id: 'd_ruby', cat: 'dice', name: 'Ruby', price: 400, emoji: '🟥', dice: { face: '#fecaca', pip: '#991b1b' } },
  { id: 'd_ocean', cat: 'dice', name: 'Ocean', price: 500, emoji: '🟦', dice: { face: '#bae6fd', pip: '#075985' } },
  { id: 'd_night', cat: 'dice', name: 'Night', price: 650, emoji: '⬛', dice: { face: '#111827', pip: '#fbbf24' } },
  // boards (from 500)
  { id: 'b_classic', cat: 'board', name: 'Classic', price: 0, emoji: '⬜' },
  {
    id: 'b_wood', cat: 'board', name: 'Wooden', price: 500, emoji: '🪵',
    board: { boardBg: '#f3dfbf', boardEdge: '#8a5a2b', boardShadow: 'rgba(80,45,10,0.45)', cell: '#fff6e5', cellStroke: '#c9a36b', star: '#8a5a2b' },
  },
  {
    id: 'b_mint', cat: 'board', name: 'Mint Garden', price: 600, emoji: '🌿',
    board: { boardBg: '#ecfdf5', boardEdge: '#34d399', boardShadow: 'rgba(5,80,60,0.3)', cell: '#ffffff', cellStroke: '#a7f3d0', star: '#10b981' },
  },
  {
    id: 'b_royal', cat: 'board', name: 'Royal Purple', price: 750, emoji: '👑',
    board: { boardBg: '#ede9fe', boardEdge: '#7c3aed', boardShadow: 'rgba(60,20,120,0.4)', cell: '#faf5ff', cellStroke: '#c4b5fd', star: '#7c3aed' },
  },
  {
    id: 'b_chalk', cat: 'board', name: 'Chalkboard', price: 900, emoji: '🖍️',
    board: { boardBg: '#1f3d2f', boardEdge: '#a16207', boardShadow: 'rgba(0,0,0,0.6)', cell: '#2a5240', cellStroke: '#3f7a5f', star: '#fde68a' },
  },
  // UI themes (from 700)
  ...THEMES.map((t): ShopItem => ({ id: 'u_' + t.id, cat: 'ui', name: t.name, price: UI_PRICES[t.id] ?? 1500, emoji: t.emoji })),
];

export const DEFAULT_OWNED = ['t_classic', 'd_classic', 'b_classic', 'u_sunny'];
export const DEFAULT_EQUIPPED: Record<Category, string> = { token: 't_classic', dice: 'd_classic', board: 'b_classic', ui: 'u_sunny' };

export const shopItem = (id: string) => SHOP.find((s) => s.id === id);

/* ---------------- tasks ---------------- */
export type Stat = 'games' | 'wins' | 'captures' | 'playSec' | 'points' | 'best' | 'login';
export interface Task {
  id: string;
  scope: 'daily' | 'weekly';
  icon: string;
  title: string;
  stat: Stat;
  goal: number;
  reward: number;
}

export const TASKS: Task[] = [
  { id: 'd_login', scope: 'daily', icon: '📅', title: 'Daily check-in', stat: 'login', goal: 1, reward: 5 },
  { id: 'd_games', scope: 'daily', icon: '🎮', title: 'Play 3 games', stat: 'games', goal: 3, reward: 15 },
  { id: 'd_time', scope: 'daily', icon: '⏱️', title: 'Play for 30 minutes', stat: 'playSec', goal: 1800, reward: 30 },
  { id: 'd_win', scope: 'daily', icon: '🏆', title: 'Win a game', stat: 'wins', goal: 1, reward: 20 },
  { id: 'd_cap', scope: 'daily', icon: '💥', title: 'Capture 5 tokens', stat: 'captures', goal: 5, reward: 15 },
  { id: 'd_score', scope: 'daily', icon: '⭐', title: 'Score 200+ in one game', stat: 'best', goal: 200, reward: 20 },
  { id: 'w_games', scope: 'weekly', icon: '🎮', title: 'Play 15 games', stat: 'games', goal: 15, reward: 100 },
  { id: 'w_win', scope: 'weekly', icon: '🏆', title: 'Win 5 games', stat: 'wins', goal: 5, reward: 150 },
  { id: 'w_time', scope: 'weekly', icon: '⏱️', title: 'Play for 3 hours', stat: 'playSec', goal: 10800, reward: 120 },
  { id: 'w_cap', scope: 'weekly', icon: '💥', title: 'Capture 25 tokens', stat: 'captures', goal: 25, reward: 80 },
  { id: 'w_points', scope: 'weekly', icon: '🔥', title: 'Earn 1,500 points', stat: 'points', goal: 1500, reward: 100 },
];
