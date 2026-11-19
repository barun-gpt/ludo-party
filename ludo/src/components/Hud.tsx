import type { CSSProperties } from 'react';
import type { BannerMsg, PlayerSnap, RuleOptions, Snapshot } from '../game/types';
import type { Theme } from '../themes';
import { rgba, shade } from '../themes';
import Dice from './Dice';

export const MEDALS = ['', '🥇', '🥈', '🥉', '🏅', '🏅', '🏅'];

function TokenDots({ p, color, className }: { p: PlayerSnap; color: string; className?: string }) {
  const items = [];
  for (let i = 0; i < p.tokens; i++) {
    const state = i < p.home ? 'home' : i < p.home + p.out ? 'out' : 'yard';
    items.push(
      state === 'home' ? (
        <span key={i} className="text-[11px] leading-none">⭐</span>
      ) : (
        <span
          key={i}
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={state === 'out' ? { background: color, boxShadow: '0 0 0 1.5px rgba(255,255,255,.8)' } : { border: `2px solid ${color}`, opacity: 0.6 }}
        />
      ),
    );
  }
  return <div className={`mt-0.5 items-center gap-1 ${className ?? 'flex'}`}>{items}</div>;
}

export function PlayerCard({ p, active, color, dense }: { p: PlayerSnap; active: boolean; color: string; dense: boolean }) {
  return (
    <div
      className={`panel relative flex min-w-0 items-center gap-2 overflow-visible rounded-2xl px-2 pb-2 pt-1.5 transition-all duration-300 ${
        active ? 'active-glow scale-[1.03]' : 'opacity-80'
      } ${p.rank ? 'saturate-50' : ''}`}
      style={{ '--pc': color } as CSSProperties}
    >
      <div
        className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg landscape:h-10 landscape:w-10 landscape:text-2xl"
        style={{ background: color, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.22), 0 2px 6px rgba(0,0,0,.2)' }}
      >
        <span className={active ? 'wiggle' : ''}>{p.avatar}</span>
        {p.kind === 'bot' && <span className="absolute -left-1.5 -top-1.5 text-[11px] leading-none">🤖</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold leading-tight">{p.name}</div>
        <div className="flex items-baseline gap-1 leading-tight">
          <span key={p.score} className="bump text-[15px] font-bold">
            {p.score}
          </span>
          <span className={`text-[10px] text-[var(--sub)] ${dense ? 'hidden landscape:inline' : ''}`}>pts</span>
        </div>
        <TokenDots p={p} color={color} className={dense ? 'hidden landscape:flex' : 'flex'} />
      </div>
      {p.rank > 0 && <span className="absolute -right-1 -top-2.5 text-xl drop-shadow">{MEDALS[p.rank]}</span>}
      <div className="absolute inset-x-2.5 bottom-1 h-1 overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(p.progress * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export function PlayersPanel({ snap, theme }: { snap: Snapshot; theme: Theme }) {
  const n = snap.players.length;
  const cols = n <= 4 ? n : 3;
  return (
    <div
      className="grid shrink-0 gap-2 px-0.5 pt-1 landscape:flex landscape:w-52 landscape:flex-col landscape:justify-center landscape:overflow-y-auto landscape:py-2 xl:landscape:w-60"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {snap.players.map((p, i) => (
        <PlayerCard key={i} p={p} active={i === snap.current && !snap.over} color={theme.players[p.color]} dense={n >= 4} />
      ))}
    </div>
  );
}

export function DicePanel({
  snap,
  theme,
  onRoll,
  landscape,
  rules,
}: {
  snap: Snapshot;
  theme: Theme;
  onRoll: () => void;
  landscape: boolean;
  rules?: RuleOptions;
}) {
  const cur = snap.players[snap.current];
  const color = theme.players[cur.color];
  let hint: string;
  if (snap.over) hint = 'Game over!';
  else if (snap.phase === 'intro') hint = 'Get ready…';
  else if (snap.humanTurn) {
    if (snap.phase === 'roll') hint = landscape ? 'Click the dice or press Space!' : 'Tap the dice to roll!';
    else if (snap.phase === 'rolling') hint = 'Rolling…';
    else if (snap.phase === 'select')
      hint = snap.cutReady
        ? rules?.missedCut
          ? '⚔️ Cut! Skipping costs a token'
          : '⚔️ Capture available!'
        : snap.movableCount > 1
          ? 'Pick a glowing token!'
          : 'Moving…';
    else hint = 'Moving…';
  } else {
    hint = snap.phase === 'rolling' ? 'Rolling…' : snap.phase === 'select' ? 'Thinking…' : snap.phase === 'moving' ? 'Moving…' : 'Getting ready…';
  }
  const size = landscape ? 84 : 66;
  return (
    <div
      className="panel flex shrink-0 items-center gap-3 rounded-3xl px-4 py-2 transition-colors landscape:w-52 landscape:flex-col landscape:justify-center landscape:py-5 xl:landscape:w-60"
      style={{ borderColor: rgba(color, 0.75), boxShadow: `0 8px 24px rgba(0,0,0,.12), inset 0 0 0 1px ${rgba(color, 0.25)}` }}
    >
      <div className="min-w-0 flex-1 landscape:flex-none landscape:text-center">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--sub)]">{snap.over ? 'Final' : 'Now playing'}</div>
        <div className="flex items-center gap-2 landscape:justify-center">
          <span className="text-2xl">{cur.avatar}</span>
          <span className="truncate text-xl font-bold" style={{ color: theme.dark ? shade(color, 0.25) : shade(color, -0.15) }}>
            {cur.name}
          </span>
          {cur.kind === 'bot' && <span className="text-sm">🤖</span>}
        </div>
        <div className="text-sm font-medium text-[var(--sub)]">{hint}</div>
        {snap.sixCount > 0 && !snap.over && (
          <div className="mt-0.5 text-xs font-bold text-amber-500">
            🔥 Six streak ×{snap.sixCount}
            {rules?.undoSixes && ' · beware the 3rd!'}
          </div>
        )}
      </div>
      <div className="relative grid place-items-center p-2">
        <Dice
          value={snap.dice}
          rollId={snap.rollId}
          rollMs={snap.rollMs}
          rolling={snap.rolling}
          size={size}
          faceColor={theme.diceFace}
          pipColor={theme.dicePip}
          accent={color}
          active={snap.canRoll}
          onRoll={onRoll}
        />
        {snap.canRoll && (
          <span
            className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow"
            style={{ background: color }}
          >
            ROLL!
          </span>
        )}
      </div>
      {landscape && (
        <div className="kbd-hint mt-1 text-center text-[11px] leading-relaxed text-[var(--sub)]">
          <kbd>Space</kbd> roll / move · <kbd>←</kbd>
          <kbd>→</kbd> pick
          <br />
          <kbd>1</kbd>-<kbd>4</kbd> token · <kbd>P</kbd> pause · <kbd>M</kbd> music
        </div>
      )}
    </div>
  );
}

export function Banner({ b, theme }: { b: BannerMsg; theme: Theme }) {
  const color = b.color !== undefined ? theme.players[b.color] : theme.btn;
  // Rendered inside the dedicated status strip below the top bar — its own space,
  // so it never covers the board, the top-bar buttons, or any other UI.
  return (
    <div className="flex w-full items-center justify-center px-3">
      <div
        key={b.id}
        className="banner-pop max-w-full rounded-2xl border-2 px-5 py-1.5 text-center text-white shadow-2xl"
        style={{
          background: `linear-gradient(180deg, ${color}, ${shade(color, -0.28)})`,
          borderColor: 'rgba(255,255,255,0.9)',
          textShadow: '0 2px 0 rgba(0,0,0,.28)',
        }}
      >
        <div className={`${b.big ? 'text-2xl' : 'text-lg sm:text-xl'} font-bold leading-tight`}>{b.text}</div>
        {b.sub && <div className="text-xs font-semibold opacity-95">{b.sub}</div>}
      </div>
    </div>
  );
}

/** Idle content of the status strip (non-compact layouts): whose turn it is + status. */
export function TurnChip({ snap, theme }: { snap: Snapshot; theme: Theme }) {
  const cur = snap.players[snap.current];
  const color = theme.players[cur.color];
  const status = snap.over
    ? 'Game over!'
    : snap.phase === 'intro'
      ? 'Get ready…'
      : cur.kind === 'bot'
        ? snap.phase === 'rolling'
          ? 'is rolling…'
          : 'is thinking…'
        : snap.canRoll
          ? 'tap the dice to roll!'
          : snap.phase === 'rolling'
            ? 'Rolling…'
            : snap.phase === 'select'
              ? 'pick a glowing token!'
              : 'Moving…';
  return (
    <div
      className="flex items-center gap-2 rounded-full px-3 py-1.5"
      style={{
        background: rgba(color, 0.16),
        border: `2px solid ${rgba(color, 0.55)}`,
      }}
    >
      <span
        className="grid h-7 w-7 place-items-center rounded-full text-base"
        style={{ background: color, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.18)' }}
      >
        {cur.avatar}
      </span>
      <span className="max-w-[36vw] truncate text-sm font-bold">
        {cur.name}
        {cur.kind === 'bot' && ' 🤖'}
      </span>
      <span className="text-xs font-medium text-[var(--sub)]">{status}</span>
      {snap.sixCount > 0 && !snap.over && <span className="text-xs font-bold text-amber-500">🔥 ×{snap.sixCount}</span>}
    </div>
  );
}

/** Idle content of the status strip (compact phones): slim score chips — no overlays on the board. */
export function ScoreChips({ snap, theme }: { snap: Snapshot; theme: Theme }) {
  return (
    <div className="scroll-thin flex w-full items-center overflow-x-auto">
      <div className="mx-auto flex w-max items-center gap-1.5 px-1">
        {snap.players.map((p, i) => {
          const c = theme.players[p.color];
          const active = i === snap.current && !snap.over;
          return (
            <div
              key={i}
              className={`flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 transition-all duration-300 ${
                active ? 'scale-105' : 'opacity-75'
              } ${p.rank ? 'saturate-50' : ''}`}
              style={
                {
                  '--pc': c,
                  background: rgba(c, 0.18),
                  border: `2px solid ${active ? c : rgba(c, 0.5)}`,
                  boxShadow: active ? `0 2px 12px ${rgba(c, 0.45)}` : 'none',
                } as CSSProperties
              }
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-base"
                style={{ background: c, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.18)' }}
              >
                {p.avatar}
              </span>
              <span className="text-sm font-bold tabular-nums" style={{ color: theme.dark ? shade(c, 0.3) : shade(c, -0.18) }}>
                {p.score}
              </span>
              {p.rank > 0 && <span className="text-xs">{MEDALS[p.rank]}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
