import { AVATARS, BOT_NAMES, type GameOptions, type PlayerSetup, type Settings } from './game/types';

export function defaultPlayers(): PlayerSetup[] {
  return [
    { name: 'Player 1', kind: 'human', level: 'normal', color: 0, avatar: '🦁' },
    { name: BOT_NAMES[1], kind: 'bot', level: 'normal', color: 1, avatar: '🐸' },
    { name: BOT_NAMES[2], kind: 'bot', level: 'normal', color: 2, avatar: '🐼' },
    { name: BOT_NAMES[3], kind: 'bot', level: 'normal', color: 3, avatar: '🦊' },
    { name: BOT_NAMES[4], kind: 'bot', level: 'normal', color: 4, avatar: '🐯' },
    { name: BOT_NAMES[5], kind: 'bot', level: 'normal', color: 5, avatar: '🐨' },
  ];
}

/** Makes sure every active player has a unique palette color. */
export function fixColors(ps: PlayerSetup[]): PlayerSetup[] {
  const used = new Set<number>();
  return ps.map((p) => {
    let c = p.color;
    if (used.has(c) || c < 0 || c > 5) {
      c = [0, 1, 2, 3, 4, 5].find((x) => !used.has(x)) ?? 0;
    }
    used.add(c);
    return c === p.color ? p : { ...p, color: c };
  });
}

export function mergeSlots(saved?: PlayerSetup[]): PlayerSetup[] {
  const base = defaultPlayers();
  if (!saved) return base;
  return base.map((p, i) => (saved[i] ? { ...p, ...saved[i] } : p));
}

export function quickOptions(s: Settings): GameOptions {
  const me = s.setup?.players.find((p) => p.kind === 'human');
  const myName = me && me.name.trim() && !/^Player \d$/.test(me.name) ? me.name : 'You';
  const myAvatar = me?.avatar ?? '🦁';
  const botAvatars = AVATARS.filter((a) => a !== myAvatar);
  return {
    players: [
      { name: myName, kind: 'human', level: 'normal', color: 0, avatar: myAvatar },
      { name: BOT_NAMES[0], kind: 'bot', level: 'normal', color: 1, avatar: botAvatars[0] },
      { name: BOT_NAMES[1], kind: 'bot', level: 'normal', color: 2, avatar: botAvatars[1] },
      { name: BOT_NAMES[2], kind: 'bot', level: 'normal', color: 3, avatar: botAvatars[2] },
    ],
    tokens: 2,
    endMode: 'first',
    autoMove: s.autoMove,
    easyStart: true,
    speed: s.speed,
  };
}
