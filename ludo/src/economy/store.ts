import { useSyncExternalStore } from 'react';
import type { Results } from '../game/types';
import { loadScores } from '../storage';
import type { SocialCred } from './social';
import {
  AD_DAILY_LIMIT, AD_REWARD, API_URL, DEFAULT_EQUIPPED, DEFAULT_OWNED, FOLLOW_REWARD, FOLLOW_WAIT_SEC,
  POINTS_PER_COIN, TASKS, shopItem, type Category,
} from './config';

export type Provider = 'google' | 'facebook';
export type Social = 'instagram' | 'facebook';

export interface Account {
  id: string;
  name: string;
  email: string;
  salt: string;
  hash: string; // '' for social-only accounts
  providers: Partial<Record<Provider, { email: string; name: string }>>;
  createdAt: number;
}
export interface Counters { games: number; wins: number; captures: number; playSec: number; points: number; best: number; login: number }
export interface Eco {
  coins: number;
  bank: number; // leftover points (< POINTS_PER_COIN)
  owned: string[];
  equipped: Record<Category, string>;
  life: Counters;
  daily: Counters & { key: string; claimed: string[]; ads: number };
  weekly: Counters & { key: string; claimed: string[] };
  follow: Partial<Record<Social, { at: number; claimed: boolean }>>;
}
export interface Snap { user: Account | null; eco: Eco }

const K_ACC = 'ludo-accounts-v1';
const K_SESSION = 'ludo-session-v1';
const K_ECO = 'ludo-eco-v1:';

/* ---------------- helpers ---------------- */
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const weekKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
};
const counters = (): Counters => ({ games: 0, wins: 0, captures: 0, playSec: 0, points: 0, best: 0, login: 0 });
const newDaily = () => ({ ...counters(), login: 1, key: dayKey(), claimed: [] as string[], ads: 0 });
const newWeekly = () => ({ ...counters(), key: weekKey(), claimed: [] as string[] });
export function newEco(): Eco {
  return { coins: 0, bank: 0, owned: [...DEFAULT_OWNED], equipped: { ...DEFAULT_EQUIPPED }, life: counters(), daily: newDaily(), weekly: newWeekly(), follow: {} };
}
function rollPeriods(e: Eco) {
  if (e.daily.key !== dayKey()) e.daily = newDaily();
  if (e.weekly.key !== weekKey()) e.weekly = newWeekly();
}
function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
function normalizeEco(p: Partial<Eco> | null): Eco {
  const base = newEco();
  if (!p) return base;
  const e: Eco = {
    ...base, ...p,
    equipped: { ...base.equipped, ...(p.equipped ?? {}) },
    life: { ...base.life, ...(p.life ?? {}) },
    daily: { ...base.daily, ...(p.daily ?? {}) },
    weekly: { ...base.weekly, ...(p.weekly ?? {}) },
    follow: p.follow ?? {},
  };
  rollPeriods(e);
  return e;
}
const loadEco = (id: string): Eco => normalizeEco(readJSON<Partial<Eco> | null>(K_ECO + id, null));

/* ---------------- state ---------------- */
export const serverMode = API_URL !== '';
const K_TOKEN = 'ludo-token-v1';
const K_USER = 'ludo-user-v1';
let token: string | null = serverMode ? readJSON<string | null>(K_TOKEN, null) : null;
let accounts: Account[] = serverMode ? [] : readJSON<Account[]>(K_ACC, []);
const sessionId = readJSON<string | null>(K_SESSION, null);
const startUser: Account | null = serverMode
  ? token ? readJSON<Account | null>(K_USER, null) : null
  : accounts.find((a) => a.id === sessionId) ?? null;
let state: Snap = { user: startUser, eco: loadEco(startUser ? startUser.id : 'guest') };
const listeners = new Set<() => void>();
const uid = () => (state.user ? state.user.id : 'guest');

function emit() {
  state = { user: state.user, eco: state.eco };
  listeners.forEach((l) => l());
}
function commit(fn: (e: Eco) => void) {
  rollPeriods(state.eco);
  fn(state.eco);
  writeJSON(K_ECO + uid(), state.eco);
  emit();
  schedulePush();
}
function setSession(user: Account | null) {
  writeJSON(K_SESSION, user ? user.id : null);
  state = { user, eco: loadEco(user ? user.id : 'guest') };
  listeners.forEach((l) => l());
}
function saveAccounts() {
  writeJSON(K_ACC, accounts);
}

export function useStore(): Snap {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
export const refresh = () => commit(() => {});

/* ---------------- gameplay hooks ---------------- */
export function recordGameResult(r: Results): number {
  const hs = r.rows.filter((x) => x.kind === 'human');
  if (!hs.length) return 0;
  const pts = hs.reduce((a, x) => a + x.score, 0);
  const caps = hs.reduce((a, x) => a + x.captures, 0);
  const best = Math.max(...hs.map((x) => x.score));
  const won = hs.some((x) => x.rank === 1);
  let earned = 0;
  commit((e) => {
    for (const c of [e.life, e.daily, e.weekly]) {
      c.games += 1;
      if (won) c.wins += 1;
      c.captures += caps;
      c.points += pts;
      c.best = Math.max(c.best, best);
    }
    e.bank += pts;
    earned = Math.floor(e.bank / POINTS_PER_COIN);
    e.bank -= earned * POINTS_PER_COIN;
    e.coins += earned;
  });
  return earned;
}
export function addPlaySeconds(n: number) {
  commit((e) => {
    e.life.playSec += n;
    e.daily.playSec += n;
    e.weekly.playSec += n;
  });
}

/* ---------------- tasks & bonuses ---------------- */
export function taskValue(e: Eco, id: string): number {
  const t = TASKS.find((x) => x.id === id);
  return t ? (t.scope === 'daily' ? e.daily : e.weekly)[t.stat] : 0;
}
export function claimTask(id: string) {
  const t = TASKS.find((x) => x.id === id);
  if (!t) return;
  commit((e) => {
    const sc = t.scope === 'daily' ? e.daily : e.weekly;
    if (sc.claimed.includes(id) || sc[t.stat] < t.goal) return;
    sc.claimed.push(id);
    e.coins += t.reward;
  });
}
export function claimAd(): boolean {
  let ok = false;
  commit((e) => {
    if (e.daily.ads >= AD_DAILY_LIMIT) return;
    e.daily.ads += 1;
    e.coins += AD_REWARD;
    ok = true;
  });
  return ok;
}
export function startFollow(k: Social) {
  if (state.eco.follow[k]) return;
  commit((e) => {
    e.follow[k] = { at: Date.now(), claimed: false };
  });
}
export function followReady(e: Eco, k: Social, now: number): number {
  const f = e.follow[k];
  return f && !f.claimed ? Math.max(0, FOLLOW_WAIT_SEC - Math.floor((now - f.at) / 1000)) : 0;
}
export function claimFollow(k: Social): boolean {
  let ok = false;
  commit((e) => {
    const f = e.follow[k];
    if (!f || f.claimed || Date.now() - f.at < FOLLOW_WAIT_SEC * 1000) return;
    f.claimed = true;
    e.coins += FOLLOW_REWARD;
    ok = true;
  });
  return ok;
}

/* ---------------- shop ---------------- */
export function buyItem(id: string): 'ok' | 'owned' | 'poor' {
  const it = shopItem(id);
  if (!it) return 'poor';
  if (state.eco.owned.includes(id)) return 'owned';
  if (state.eco.coins < it.price) return 'poor';
  commit((e) => {
    e.coins -= it.price;
    e.owned.push(id);
    e.equipped[it.cat] = id;
  });
  return 'ok';
}
export function equipItem(id: string) {
  const it = shopItem(id);
  if (!it || !state.eco.owned.includes(id)) return;
  commit((e) => {
    e.equipped[it.cat] = id;
  });
}

/* ---------------- server connection ---------------- */
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };
async function api<T>(path: string, method = 'GET', body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(API_URL + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? 'Something went wrong.', status: res.status };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Can't reach the server. Check your internet connection.", status: 0 };
  }
}
interface ServerUser { id: string; name: string; email: string; providers: Account['providers'] }
interface LoginData { token: string; user: ServerUser; eco: Partial<Eco> | null; created?: boolean }
const toAccount = (u: ServerUser): Account => ({ ...u, salt: '', hash: '', createdAt: 0 });
const notify = () => listeners.forEach((l) => l());

function applyLogin(d: LoginData, wipeGuest: boolean) {
  token = d.token;
  writeJSON(K_TOKEN, token);
  const user = toAccount(d.user);
  writeJSON(K_USER, user);
  const eco = d.eco ? normalizeEco(d.eco) : newEco();
  writeJSON(K_ECO + user.id, eco);
  if (wipeGuest) writeJSON(K_ECO + 'guest', newEco()); // guest progress moved into the new account
  state = { user, eco };
  notify();
}

let pushTimer: number | undefined;
function schedulePush() {
  if (!serverMode || !token) return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(flushPush, 1500);
}
function flushPush() {
  window.clearTimeout(pushTimer);
  if (serverMode && token) void api('/api/sync', 'PUT', { eco: state.eco });
}
/** Loads the latest progress from the server (keeps local data if it is further ahead). */
export async function pull() {
  if (!serverMode || !token) return;
  const r = await api<{ user: ServerUser; eco: Partial<Eco> | null }>('/api/me');
  if (!r.ok) {
    if (r.status === 401) {
      token = null;
      writeJSON(K_TOKEN, null);
      setSession(null);
    }
    return;
  }
  const user = toAccount(r.data.user);
  writeJSON(K_USER, user);
  const remote = r.data.eco ? normalizeEco(r.data.eco) : null;
  if (remote && remote.life.points >= state.eco.life.points) {
    state = { user, eco: remote };
    writeJSON(K_ECO + user.id, remote);
  } else {
    state = { user, eco: state.eco };
    schedulePush();
  }
  notify();
}
if (serverMode && typeof document !== 'undefined') {
  void pull();
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? flushPush() : void pull()));
}

export interface WorldRow { rank: number; name: string; points: number; best: number; wins: number; games: number }
export async function fetchLeaderboard(): Promise<{ top: WorldRow[]; me: WorldRow | null } | null> {
  if (!serverMode) return null;
  const r = await api<{ top: WorldRow[]; me: WorldRow | null }>('/api/leaderboard');
  return r.ok ? r.data : null;
}

/* ---------------- accounts ---------------- */
const enc = (s: string) => new TextEncoder().encode(s);
async function hashPw(pw: string, salt: string): Promise<string> {
  if (!globalThis.crypto?.subtle) return 'x' + btoa(unescape(encodeURIComponent(salt + pw)));
  const key = await crypto.subtle.importKey('raw', enc(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
}
const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const norm = (s: string) => s.trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Local-only mode: new accounts inherit the guest's progress so nothing is lost. */
function createAccount(acc: Account) {
  accounts.push(acc);
  saveAccounts();
  const guest = loadEco('guest');
  writeJSON(K_ECO + acc.id, guest);
  writeJSON(K_ECO + 'guest', newEco());
  setSession(acc);
}

export async function signUp(name: string, email: string, password: string): Promise<string | null> {
  const n = name.trim();
  if (n.length < 2 || n.length > 20) return 'User name must be 2–20 characters.';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  if (serverMode) {
    const r = await api<LoginData>('/api/signup', 'POST', { name: n, email: norm(email), password, eco: loadEco('guest') });
    if (!r.ok) return r.error;
    applyLogin(r.data, true);
    return null;
  }
  if (accounts.some((a) => a.email === norm(email))) return 'An account with this email already exists. Try signing in.';
  const salt = randomId();
  createAccount({ id: randomId(), name: n, email: norm(email), salt, hash: await hashPw(password, salt), providers: {}, createdAt: Date.now() });
  return null;
}
export async function signIn(email: string, password: string): Promise<string | null> {
  if (serverMode) {
    const r = await api<LoginData>('/api/login', 'POST', { email: norm(email), password });
    if (!r.ok) return r.error;
    applyLogin(r.data, false);
    return null;
  }
  const acc = accounts.find((a) => a.email === norm(email));
  if (!acc) return 'No account found with this email.';
  if (!acc.hash) return 'This account uses Google/Facebook sign-in.';
  if ((await hashPw(password, acc.salt)) !== acc.hash) return 'Wrong password.';
  setSession(acc);
  return null;
}
/** Server mode: cred.token comes from the native Google/Facebook SDK. Local mode: demo (name + email only). */
export async function socialSignIn(p: Provider, cred: SocialCred): Promise<string | null> {
  if (serverMode) {
    if (!cred.token) return 'Sign-in failed. Please try again.';
    const r = await api<LoginData>('/api/social', 'POST', { provider: p, token: cred.token, eco: loadEco('guest') });
    if (!r.ok) return r.error;
    applyLogin(r.data, r.data.created === true);
    return null;
  }
  if (!EMAIL_RE.test(cred.email.trim())) return 'Enter a valid email address.';
  const e = norm(cred.email);
  const found = accounts.find((a) => a.providers[p]?.email === e || a.email === e);
  if (found) {
    found.providers[p] = { email: e, name: cred.name.trim() || found.name };
    saveAccounts();
    setSession(found);
    return null;
  }
  createAccount({ id: randomId(), name: cred.name.trim() || e.split('@')[0], email: e, salt: '', hash: '', providers: { [p]: { email: e, name: cred.name.trim() } }, createdAt: Date.now() });
  return null;
}
export async function linkProvider(p: Provider, cred: SocialCred): Promise<string | null> {
  if (!state.user) return 'Sign in first.';
  if (serverMode) {
    const r = await api<{ user: ServerUser }>('/api/link', 'POST', { provider: p, token: cred.token });
    if (!r.ok) return r.error;
    const user = toAccount(r.data.user);
    writeJSON(K_USER, user);
    state = { user, eco: state.eco };
    notify();
    return null;
  }
  if (!EMAIL_RE.test(cred.email.trim())) return 'Enter a valid email address.';
  const me = accounts.find((a) => a.id === state.user!.id);
  if (!me) return 'Account not found.';
  me.providers[p] = { email: norm(cred.email), name: cred.name.trim() || me.name };
  saveAccounts();
  state = { user: me, eco: state.eco };
  notify();
  return null;
}
export async function unlinkProvider(p: Provider): Promise<string | null> {
  if (serverMode) {
    const r = await api<{ user: ServerUser }>('/api/unlink', 'POST', { provider: p });
    if (!r.ok) return r.error;
    const user = toAccount(r.data.user);
    writeJSON(K_USER, user);
    state = { user, eco: state.eco };
    notify();
    return null;
  }
  const me = accounts.find((a) => a.id === state.user?.id);
  if (!me) return 'Sign in first.';
  if (!me.hash && Object.keys(me.providers).length <= 1) return 'Add a password-based login before unlinking your only sign-in method.';
  delete me.providers[p];
  saveAccounts();
  state = { user: me, eco: state.eco };
  notify();
  return null;
}
function leaveServerSession() {
  token = null;
  writeJSON(K_TOKEN, null);
  writeJSON(K_USER, null);
  setSession(null);
}
export function signOut() {
  if (serverMode && token) {
    flushPush();
    void api('/api/logout', 'POST');
    leaveServerSession();
    return;
  }
  setSession(null);
}
export async function deleteAccount(): Promise<string | null> {
  const id = state.user?.id;
  if (!id) return null;
  if (serverMode) {
    const r = await api('/api/account', 'DELETE');
    if (!r.ok) return r.error;
  } else {
    accounts = accounts.filter((a) => a.id !== id);
    saveAccounts();
  }
  try {
    localStorage.removeItem(K_ECO + id);
  } catch {
    /* ignore */
  }
  if (serverMode) leaveServerSession();
  else setSession(null);
  return null;
}

/* ---------------- leaderboard (this device) ---------------- */
export interface PlayerRow { id: string; name: string; points: number; best: number; wins: number; games: number; me: boolean }
export function listPlayers(): PlayerRow[] {
  const rows: PlayerRow[] = [];
  const add = (id: string, name: string, e: Eco) =>
    rows.push({ id, name, points: e.life.points, best: e.life.best, wins: e.life.wins, games: e.life.games, me: id === uid() });
  for (const a of accounts) add(a.id, a.name, a.id === uid() ? state.eco : loadEco(a.id));
  add('guest', 'Guest', uid() === 'guest' ? state.eco : loadEco('guest'));
  return rows.filter((r) => r.games > 0 || r.me).sort((a, b) => b.points - a.points);
}
export const topScores = loadScores;
