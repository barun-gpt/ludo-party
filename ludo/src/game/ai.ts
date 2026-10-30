import type { LudoGame } from './engine';
import type { BotLevel } from './types';

/** Number of opponent tokens that could land on `cell` with a single roll. */
function threat(game: LudoGame, cell: number, pi: number): number {
  const g = game.geom;
  let n = 0;
  game.players.forEach((q, qi) => {
    if (qi === pi || q.rank) return;
    for (const u of game.tokens[qi]) {
      if (u.pos < 0 || u.pos > g.lastTrack) continue;
      const gu = game.globalCell(qi, u.pos);
      const dist = (cell - gu + g.T) % g.T;
      if (dist >= 1 && dist <= 6 && u.pos + dist <= g.lastTrack) n++;
    }
  });
  return n;
}

/** Number of opponent tokens sitting 1..6 cells ahead of `cell` (capture chances next turn). */
function chances(game: LudoGame, cell: number, pi: number, myPos: number): number {
  const g = game.geom;
  let n = 0;
  game.players.forEach((_q, qi) => {
    if (qi === pi) return;
    for (const u of game.tokens[qi]) {
      if (u.pos < 0 || u.pos > g.lastTrack) continue;
      const gu = game.globalCell(qi, u.pos);
      if (g.safe[gu]) continue;
      const dist = (gu - cell + g.T) % g.T;
      if (dist >= 1 && dist <= 6 && myPos + dist <= g.lastTrack) n++;
    }
  });
  return n;
}

function evaluate(game: LudoGame, pi: number, ti: number, dice: number, level: BotLevel): number {
  const g = game.geom;
  const t = game.tokens[pi][ti];
  const from = t.pos;
  const to = from < 0 ? 0 : from + dice;
  let s = 0;

  if (to === g.homeIndex) s += 90;
  else if (to > g.lastTrack) s += from <= g.lastTrack ? 55 : 8;
  if (from < 0) s += 62;

  if (to <= g.lastTrack) {
    const cell = game.globalCell(pi, to);
    const safe = g.safe[cell];
    if (!safe) {
      const victims = game.tokensOnCell(cell).filter((o) => o.player !== pi);
      if (victims.length) s += 85 + victims.reduce((a, v) => a + v.pos, 0) * 0.7;
      if (level !== 'easy') {
        const th = threat(game, cell, pi);
        s -= th * (level === 'hard' ? 24 : 14) * (1 + to / g.T);
      }
    } else {
      s += 18;
    }
    if (level === 'hard') s += chances(game, cell, pi, to) * 5;
  }

  if (level !== 'easy' && from >= 0 && from <= g.lastTrack) {
    const cf = game.globalCell(pi, from);
    if (!g.safe[cf]) s += threat(game, cf, pi) * (level === 'hard' ? 20 : 10) * (1 + from / g.T);
  }

  s += dice * 0.5 + (from >= 0 ? (from / g.T) * 4 : 0);
  return s;
}

export function chooseBotMove(game: LudoGame, pi: number, dice: number, movable: number[], levelOverride?: BotLevel): number {
  if (movable.length === 1) return movable[0];
  const level = levelOverride ?? game.players[pi].setup.level;
  if (level === 'easy' && Math.random() < 0.5) return movable[Math.floor(Math.random() * movable.length)];
  let best = movable[0];
  let bestS = -Infinity;
  const seen = new Set<number>();
  const noise = level === 'hard' ? 1 : level === 'normal' ? 4 : 12;
  for (const ti of movable) {
    const pos = game.tokens[pi][ti].pos;
    if (seen.has(pos)) continue;
    seen.add(pos);
    const s = evaluate(game, pi, ti, dice, level) + Math.random() * noise;
    if (s > bestS) {
      bestS = s;
      best = ti;
    }
  }
  return best;
}
