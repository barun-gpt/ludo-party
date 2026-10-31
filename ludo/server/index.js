// Ludo Party server: accounts, coin/progress sync, worldwide leaderboard.
// Zero npm dependencies. Needs Node 22.13+ (uses the built-in SQLite).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT || 8080);
const DB_PATH = process.env.DB_PATH || './data/ludo.db';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''; // the *Web* client ID
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'support@example.com';
const APP_NAME = process.env.APP_NAME || 'Ludo Party';
const TEST_SOCIAL = process.env.ALLOW_TEST_SOCIAL === '1'; // local testing only, never in production
const SESSION_DAYS = 180;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE,
  pw_hash TEXT, pw_salt TEXT,
  google_id TEXT UNIQUE, google_email TEXT, facebook_id TEXT UNIQUE, facebook_email TEXT,
  created_at INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0, best INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0, games INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS eco (user_id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_users_points ON users(points DESC);
`);
// anti-cheat: leaderboard points can only grow as fast as a human can really play (see saveEco)
for (const col of ['credit REAL NOT NULL DEFAULT 4000', 'credit_at INTEGER NOT NULL DEFAULT 0']) {
  try { db.exec('ALTER TABLE users ADD COLUMN ' + col); } catch { /* column already exists */ }
}
const CREDIT_MAX = 4000; // burst allowance (about 6-8 games) - also the starting allowance of a new account
const CREDIT_PER_MIN = 25; // sustained earn rate the leaderboard accepts, in points per minute (~36k/day)
const MAX_BEST = 3000; // highest believable score in one game

/* ---------- helpers ---------- */
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? rej(e) : res(k.toString('hex')))));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const normEmail = (e) => String(e || '').trim().toLowerCase();
const clampInt = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (s, m) => {
  throw new HttpError(s, m);
};

const hits = new Map();
function rateLimit(ip, max = 60, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) hits.set(ip, { n: 1, reset: now + windowMs });
  else if (++h.n > max) fail(429, 'Too many attempts. Please wait a few minutes.');
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
}, 60_000).unref();

function sanitizeEco(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const out = { ...e, coins: clampInt(e.coins, 10_000_000) };
  if (!Array.isArray(out.owned) || out.owned.length > 300) return null;
  const s = JSON.stringify(out);
  return s.length > 60_000 ? null : out;
}
function publicUser(u) {
  const providers = {};
  if (u.google_id) providers.google = { email: u.google_email || '', name: u.name };
  if (u.facebook_id) providers.facebook = { email: u.facebook_email || '', name: u.name };
  return { id: u.id, name: u.name, email: u.email || '', providers };
}
function saveEco(userId, eco) {
  const now = Date.now();
  db.prepare('INSERT INTO eco (user_id, json, updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at').run(userId, JSON.stringify(eco), now);
  const L = eco.life || {};
  const u = db.prepare('SELECT points, best, wins, games, credit, credit_at FROM users WHERE id=?').get(userId);
  // Leaderboard points only ever go up AND are limited by a refilling allowance, so a tampered client
  // cannot jump to #1 - it can only climb at roughly the speed of a very active human player.
  const credit = Math.min(CREDIT_MAX, u.credit + (u.credit_at ? ((now - u.credit_at) / 60000) * CREDIT_PER_MIN : 0));
  const gain = Math.max(0, clampInt(L.points, 5_000_000) - u.points);
  const granted = Math.min(gain, Math.floor(credit));
  const newPoints = u.points + granted;
  // a game is worth at least a few dozen points, so the games counter cannot run far ahead of the points
  const games = Math.max(u.games, Math.min(clampInt(L.games, 200_000), Math.ceil(newPoints / 20)));
  db.prepare('UPDATE users SET points=?, best=?, wins=?, games=?, credit=?, credit_at=? WHERE id=?').run(
    newPoints, Math.max(u.best, clampInt(L.best, MAX_BEST)),
    Math.min(games, Math.max(u.wins, clampInt(L.wins, 100_000))), games, credit - granted, now, userId);
  return now;
}
function getEco(userId) {
  const r = db.prepare('SELECT json, updated_at FROM eco WHERE user_id=?').get(userId);
  return r ? { eco: JSON.parse(r.json), updatedAt: r.updated_at } : { eco: null, updatedAt: 0 };
}
function newSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?,?,?)').run(sha(token), userId, Date.now());
  return token;
}
function authUser(req, required = true) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (m) {
    const s = db.prepare('SELECT user_id, created_at FROM sessions WHERE token_hash=?').get(sha(m[1]));
    if (s && Date.now() - s.created_at < SESSION_DAYS * 864e5) {
      const u = db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id);
      if (u) return { user: u, tokenHash: sha(m[1]) };
    }
  }
  if (required) fail(401, 'Please sign in again.');
  return null;
}
function loginResult(user, fallbackEco, created = false) {
  const { eco, updatedAt } = getEco(user.id);
  return { token: newSession(user.id), user: publicUser(user), eco: eco ?? fallbackEco ?? null, updatedAt, created };
}

/* ---------- social token verification ---------- */
async function verifySocial(provider, token) {
  if (!token || typeof token !== 'string') fail(400, 'Missing sign-in token.');
  if (TEST_SOCIAL && token.startsWith('test:')) {
    const [, id, email, name] = token.split(':');
    return { id, email: normEmail(email), name: name || 'Tester' };
  }
  if (provider === 'google') {
    if (!GOOGLE_CLIENT_ID) fail(501, 'Google sign-in is not configured on the server.');
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.aud !== GOOGLE_CLIENT_ID) fail(401, 'Google sign-in could not be verified.');
    return { id: String(d.sub), email: d.email_verified === 'true' || d.email_verified === true ? normEmail(d.email) : '', name: d.name || '' };
  }
  if (provider === 'facebook') {
    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) fail(501, 'Facebook sign-in is not configured on the server.');
    const appToken = encodeURIComponent(`${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`);
    const dbg = await (await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${appToken}`)).json().catch(() => ({}));
    if (!dbg.data?.is_valid || String(dbg.data.app_id) !== FACEBOOK_APP_ID) fail(401, 'Facebook sign-in could not be verified.');
    const me = await (await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`)).json().catch(() => ({}));
    if (!me.id) fail(401, 'Facebook sign-in could not be verified.');
    return { id: String(me.id), email: normEmail(me.email), name: me.name || '' };
  }
  return fail(400, 'Unknown provider.');
}
const col = (p) => (p === 'google' ? 'google' : 'facebook');

/* ---------- routes ---------- */
const routes = {
  'POST /api/signup': async (req, body, ip) => {
    rateLimit(ip);
    const name = String(body.name || '').trim();
    const email = normEmail(body.email);
    const pw = String(body.password || '');
    if (name.length < 2 || name.length > 20) fail(400, 'User name must be 2–20 characters.');
    if (!EMAIL_RE.test(email)) fail(400, 'Enter a valid email address.');
    if (pw.length < 6 || pw.length > 200) fail(400, 'Password must be at least 6 characters.');
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) fail(409, 'An account with this email already exists. Try signing in.');
    const salt = crypto.randomBytes(16).toString('hex');
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO users (id,name,email,pw_hash,pw_salt,created_at) VALUES (?,?,?,?,?,?)').run(id, name, email, await scrypt(pw, salt), salt, Date.now());
    const eco = sanitizeEco(body.eco);
    if (eco) saveEco(id, eco);
    return loginResult(db.prepare('SELECT * FROM users WHERE id=?').get(id), eco, true);
  },
  'POST /api/login': async (req, body, ip) => {
    rateLimit(ip);
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(normEmail(body.email));
    if (!u) fail(401, 'No account found with this email.');
    if (!u.pw_hash) fail(400, 'This account uses Google/Facebook sign-in.');
    const a = Buffer.from(await scrypt(String(body.password || ''), u.pw_salt), 'hex');
    if (!crypto.timingSafeEqual(a, Buffer.from(u.pw_hash, 'hex'))) fail(401, 'Wrong password.');
    return loginResult(u);
  },
  'POST /api/social': async (req, body, ip) => {
    rateLimit(ip);
    const p = body.provider;
    const s = await verifySocial(p, body.token);
    let u = db.prepare(`SELECT * FROM users WHERE ${col(p)}_id=?`).get(s.id);
    if (!u && s.email) u = db.prepare('SELECT * FROM users WHERE email=?').get(s.email);
    if (u) {
      db.prepare(`UPDATE users SET ${col(p)}_id=?, ${col(p)}_email=? WHERE id=?`).run(s.id, s.email || null, u.id);
      return loginResult(db.prepare('SELECT * FROM users WHERE id=?').get(u.id));
    }
    const id = crypto.randomUUID();
    const name = (s.name || s.email.split('@')[0] || 'Player').slice(0, 20);
    db.prepare(`INSERT INTO users (id,name,email,${col(p)}_id,${col(p)}_email,created_at) VALUES (?,?,?,?,?,?)`).run(id, name, s.email || null, s.id, s.email || null, Date.now());
    const eco = sanitizeEco(body.eco);
    if (eco) saveEco(id, eco);
    return loginResult(db.prepare('SELECT * FROM users WHERE id=?').get(id), eco, true);
  },
  'POST /api/link': async (req, body) => {
    const { user } = authUser(req);
    const s = await verifySocial(body.provider, body.token);
    const other = db.prepare(`SELECT id FROM users WHERE ${col(body.provider)}_id=?`).get(s.id);
    if (other && other.id !== user.id) fail(409, 'That account is already linked to another player.');
    db.prepare(`UPDATE users SET ${col(body.provider)}_id=?, ${col(body.provider)}_email=? WHERE id=?`).run(s.id, s.email || null, user.id);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) };
  },
  'POST /api/unlink': async (req, body) => {
    const { user } = authUser(req);
    const c = col(body.provider);
    const others = ['google', 'facebook'].filter((x) => x !== c && user[x + '_id']).length;
    if (!user.pw_hash && others === 0) fail(400, 'Add a password-based login before unlinking your only sign-in method.');
    db.prepare(`UPDATE users SET ${c}_id=NULL, ${c}_email=NULL WHERE id=?`).run(user.id);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) };
  },
  'GET /api/me': async (req) => {
    const { user } = authUser(req);
    const { eco, updatedAt } = getEco(user.id);
    return { user: publicUser(user), eco, updatedAt };
  },
  'PUT /api/sync': async (req, body) => {
    const { user } = authUser(req);
    const eco = sanitizeEco(body.eco);
    if (!eco) fail(400, 'Invalid progress data.');
    return { ok: true, updatedAt: saveEco(user.id, eco) };
  },
  'GET /api/leaderboard': async (req) => {
    const top = db.prepare('SELECT name, points, best, wins, games FROM users WHERE games > 0 ORDER BY points DESC LIMIT 50').all();
    const a = authUser(req, false);
    const me = a ? { name: a.user.name, points: a.user.points, best: a.user.best, wins: a.user.wins, games: a.user.games, rank: db.prepare('SELECT COUNT(*)+1 AS r FROM users WHERE points > ?').get(a.user.points).r } : null;
    return { top: top.map((r, i) => ({ rank: i + 1, ...r })), me };
  },
  'POST /api/logout': async (req) => {
    const a = authUser(req);
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(a.tokenHash);
    return { ok: true };
  },
  'DELETE /api/account': async (req) => {
    const { user } = authUser(req);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    db.prepare('DELETE FROM eco WHERE user_id=?').run(user.id);
    db.prepare('DELETE FROM users WHERE id=?').run(user.id);
    return { ok: true };
  },
  'GET /health': async () => ({ ok: true }),
};

/* ---------- static legal pages (needed for Google Play) ---------- */
const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1e293b}input,button{font-size:1rem;padding:.6rem;margin:.25rem 0;width:100%;box-sizing:border-box}button{background:#dc2626;color:#fff;border:0;border-radius:8px}</style></head><body>${body}</body></html>`;
const PRIVACY = page('Privacy Policy', `<h1>${APP_NAME} – Privacy Policy</h1>
<p>Last updated: ${new Date().toISOString().slice(0, 10)}</p>
<h2>What we collect</h2><p>If you create an account we store your user name, email address, a securely hashed password (or your Google/Facebook ID if you sign in with them), and your game progress (coins, purchases, scores, task progress). Guests play without an account and their data stays on their device.</p>
<h2>How we use it</h2><p>To run your account, save your progress between devices and show leaderboards (your user name and scores are visible to other players). We do not sell your data.</p>
<h2>Advertising</h2><p>The app shows rewarded ads through Google AdMob, which may use your device advertising ID. See Google's privacy policy for details.</p>
<h2>Children</h2><p>The app is not directed to children under 13.</p>
<h2>Deleting your data</h2><p>You can delete your account in the app (Profile → Delete account) or at <a href="/delete-account">/delete-account</a>. Your data is removed immediately.</p>
<h2>Contact</h2><p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>`);
const DELETE_PAGE = page('Delete account', `<h1>Delete your ${APP_NAME} account</h1>
<p>Enter your email and password to permanently delete your account and all saved progress. This cannot be undone. If you signed up with Google or Facebook, delete the account inside the app (Profile → Delete account) or email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
<input id="e" type="email" placeholder="Email"><input id="p" type="password" placeholder="Password"><button id="b">Delete my account</button><p id="m"></p>
<script>b.onclick=async()=>{m.textContent='Working…';try{let r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e.value,password:p.value})});let d=await r.json();if(!r.ok)throw new Error(d.error);r=await fetch('/api/account',{method:'DELETE',headers:{Authorization:'Bearer '+d.token}});if(!r.ok)throw new Error('Failed');m.textContent='Your account has been deleted.'}catch(x){m.textContent=x.message||'Failed'}}</script>`);

/* ---------- http ---------- */
async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 300_000) fail(413, 'Request too large.');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return fail(400, 'Invalid JSON.');
  }
}

http
  .createServer(async (req, res) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' };
    const send = (status, type, text) => {
      res.writeHead(status, { 'Content-Type': type, ...cors });
      res.end(text);
    };
    try {
      if (req.method === 'OPTIONS') return send(204, 'text/plain', '');
      const url = new URL(req.url, 'http://x');
      if (req.method === 'GET' && url.pathname === '/privacy') return send(200, 'text/html; charset=utf-8', PRIVACY);
      if (req.method === 'GET' && url.pathname === '/delete-account') return send(200, 'text/html; charset=utf-8', DELETE_PAGE);
      if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/plain', `${APP_NAME} server is running.`);
      const h = routes[`${req.method} ${url.pathname}`];
      if (!h) return send(404, 'application/json', JSON.stringify({ error: 'Not found.' }));
      const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      send(200, 'application/json', JSON.stringify(await h(req, body, ip)));
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, 'application/json', JSON.stringify({ error: e.message }));
      console.error(e);
      send(500, 'application/json', JSON.stringify({ error: 'Server error.' }));
    }
  })
  .listen(PORT, () => console.log(`${APP_NAME} server listening on :${PORT}`));
