import { useState } from 'react';
import { AVATARS, BOT_NAMES, type BotLevel, type EndMode, type GameOptions, type PlayerKind, type PlayerSetup, type Settings } from '../game/types';
import type { Theme } from '../themes';
import { rgba } from '../themes';
import { fixColors, mergeSlots } from '../setup';
import { audio } from '../audio/audio';
import { Btn, IconBtn, Segmented, Toggle } from './ui';
import { SPEED_OPTS } from './Settings';

interface Props {
  theme: Theme;
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  onBack: () => void;
  onStart: (o: GameOptions) => void;
}

const BOARD_INFO: Record<number, string> = {
  2: '✚ Classic cross board · head-to-head!',
  3: '🔺 Triangle board · 3 arms',
  4: '✚ Classic cross board · 4 arms',
  5: '⬟ Pentagon board · 5 arms',
  6: '⬢ Hexagon board · 6 arms',
};

export default function SetupScreen({ theme, settings, update, onBack, onStart }: Props) {
  const saved = settings.setup;
  const [players, setPlayers] = useState<PlayerSetup[]>(() => mergeSlots(saved?.players));
  const [count, setCount] = useState(() => (saved ? Math.min(6, Math.max(2, saved.players.length)) : 4));
  const [tokens, setTokens] = useState(saved?.tokens ?? 4);
  const [endMode, setEndMode] = useState<EndMode>(saved?.endMode ?? 'first');
  const [easyStart, setEasyStart] = useState(saved?.easyStart ?? true);

  const active = players.slice(0, count);
  const setP = (i: number, patch: Partial<PlayerSetup>) => setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const changeCount = (n: number) => {
    setCount(n);
    setPlayers((ps) => [...fixColors(ps.slice(0, n)), ...ps.slice(n)]);
  };
  const cycleColor = (i: number) => {
    const used = new Set(active.filter((_, j) => j !== i).map((p) => p.color));
    let c = players[i].color;
    for (let k = 0; k < 6; k++) {
      c = (c + 1) % 6;
      if (!used.has(c)) break;
    }
    setP(i, { color: c });
  };
  const cycleAvatar = (i: number) => {
    const idx = AVATARS.indexOf(players[i].avatar);
    setP(i, { avatar: AVATARS[(idx + 1) % AVATARS.length] });
    audio.play('pop', { pitch: idx % 6 });
  };
  const setKind = (i: number, kind: PlayerKind) => {
    const p = players[i];
    let name = p.name;
    if (kind === 'bot' && (/^Player \d$/.test(name) || !name.trim())) name = BOT_NAMES[i];
    if (kind === 'human' && BOT_NAMES.includes(name)) name = `Player ${i + 1}`;
    setP(i, { kind, name });
  };
  const preset = (mode: 'bots' | 'friends') => {
    setPlayers((ps) =>
      ps.map((p, i) => {
        const kind: PlayerKind = mode === 'friends' || i === 0 ? 'human' : 'bot';
        let name = p.name;
        if (kind === 'bot' && /^Player \d$/.test(name)) name = BOT_NAMES[i];
        if (kind === 'human' && BOT_NAMES.includes(name)) name = `Player ${i + 1}`;
        return { ...p, kind, name };
      }),
    );
  };

  const start = () => {
    const ps = fixColors(active).map((p, i) => ({
      ...p,
      name: p.name.trim() || (p.kind === 'bot' ? BOT_NAMES[i] : `Player ${i + 1}`),
    }));
    update({ setup: { players: ps, tokens, endMode, easyStart } });
    onStart({ players: ps, tokens, endMode, easyStart, autoMove: settings.autoMove, speed: settings.speed });
  };

  const humans = active.filter((p) => p.kind === 'human').length;

  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-3 pb-8 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-4">
        <div className="flex items-center gap-3">
          <IconBtn label="Back" onClick={onBack}>
            ⬅️
          </IconBtn>
          <h2 className="flex-1 text-3xl font-bold drop-shadow-sm">Multiplayer</h2>
        </div>

        <section className="panel rounded-3xl p-4">
          <div className="mb-2 font-bold">👥 How many players?</div>
          <div className="grid grid-cols-5 gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={(e) => {
                  audio.play('click');
                  (e.currentTarget as HTMLElement).blur();
                  changeCount(n);
                }}
                className={`chip py-3 text-2xl font-bold ${n === count ? 'on scale-105' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--sub)]">
            <span>{BOARD_INFO[count]}</span>
            <span className="flex gap-1.5">
              <button type="button" className="chip px-2.5 py-1 text-xs" onClick={() => preset('bots')}>
                👤 vs 🤖
              </button>
              <button type="button" className="chip px-2.5 py-1 text-xs" onClick={() => preset('friends')}>
                👥 Pass &amp; Play
              </button>
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          {active.map((p, i) => {
            const color = theme.players[p.color];
            return (
              <div
                key={i}
                className="panel pop-in flex items-center gap-2.5 rounded-3xl p-2.5"
                style={{ borderColor: rgba(color, 0.7), background: `linear-gradient(90deg, ${rgba(color, 0.22)}, var(--panel) 60%)` }}
              >
                <button
                  type="button"
                  onClick={() => cycleAvatar(i)}
                  title="Tap to change avatar"
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-3xl transition-transform active:scale-90"
                  style={{ background: color, boxShadow: 'inset 0 -4px 0 rgba(0,0,0,.22), 0 3px 8px rgba(0,0,0,.2)', border: '3px solid #fff' }}
                >
                  {p.avatar}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={p.name}
                      maxLength={12}
                      onChange={(e) => setP(i, { name: e.target.value })}
                      aria-label={`Player ${i + 1} name`}
                      className="min-w-0 flex-1 rounded-xl border-2 border-white/70 bg-white/85 px-2.5 py-1.5 font-semibold text-slate-800 outline-none focus:border-[var(--btn)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        audio.play('click');
                        cycleColor(i);
                      }}
                      title="Change color"
                      aria-label="Change color"
                      className="h-9 w-9 shrink-0 rounded-full border-[3px] border-white shadow-md transition-transform active:scale-90"
                      style={{ background: color }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Segmented<PlayerKind>
                      size="sm"
                      className="min-w-[150px] flex-1"
                      value={p.kind}
                      onChange={(k) => setKind(i, k)}
                      options={[
                        { value: 'human', label: '👤 Human' },
                        { value: 'bot', label: '🤖 Bot' },
                      ]}
                    />
                    {p.kind === 'bot' && (
                      <Segmented<BotLevel>
                        size="sm"
                        className="min-w-[180px] flex-1"
                        value={p.level}
                        onChange={(l) => setP(i, { level: l })}
                        options={[
                          { value: 'easy', label: '😊 Easy' },
                          { value: 'normal', label: '😎 Normal' },
                          { value: 'hard', label: '😈 Hard' },
                        ]}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="panel grid gap-3 rounded-3xl p-4">
          <div>
            <div className="mb-1.5 font-bold">🔵 Tokens per player</div>
            <Segmented
              value={tokens}
              onChange={setTokens}
              options={[
                { value: 1, label: '1 · Blitz' },
                { value: 2, label: '2 · Quick' },
                { value: 3, label: '3' },
                { value: 4, label: '4 · Classic' },
              ]}
              size="sm"
            />
          </div>
          <div>
            <div className="mb-1.5 font-bold">🏁 Game ends when</div>
            <Segmented<EndMode>
              value={endMode}
              onChange={setEndMode}
              options={[
                { value: 'first', label: '🥇 First player finishes' },
                { value: 'all', label: '🏅 Everyone is ranked' },
              ]}
              size="sm"
            />
          </div>
          <div>
            <div className="mb-1.5 font-bold">⏩ Speed</div>
            <Segmented value={settings.speed} onChange={(v) => update({ speed: v })} options={SPEED_OPTS} size="sm" />
          </div>
          <div className="rounded-2xl bg-black/5 px-2 py-1">
            <Toggle
              checked={easyStart}
              onChange={setEasyStart}
              label="🍀 Lucky start"
              hint="First roll is a 6, plus extra sixes while stuck at base"
            />
            <Toggle
              checked={settings.autoMove}
              onChange={(v) => update({ autoMove: v })}
              label="⚡ Auto-move"
              hint="Moves for you when there's only one choice"
            />
          </div>
        </section>

        <Btn onClick={start} className="py-4 text-2xl">
          🎲 Start Game
          <div className="text-xs font-semibold opacity-90">
            {count} players · {humans} {humans === 1 ? 'human' : 'humans'} · {count - humans} {count - humans === 1 ? 'bot' : 'bots'} · {tokens}{' '}
            {tokens === 1 ? 'token' : 'tokens'} each
          </div>
        </Btn>
      </div>
    </div>
  );
}
