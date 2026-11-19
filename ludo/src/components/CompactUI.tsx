import type { CSSProperties } from 'react';
import type { PlayerSnap, RuleOptions, Snapshot } from '../game/types';
import type { Theme } from '../themes';
import { shade } from '../themes';
import Dice from './Dice';

/** Compact floating badge for compact (portrait phone) mode. */
export function CompactBadge({
  p,
  active,
  color,
  style,
  snap,
}: {
  p: PlayerSnap;
  active: boolean;
  color: string;
  style: CSSProperties;
  snap: Snapshot;
}) {
  const isCurrent = active && !snap.over;
  return (
    <div
      className={`pointer-events-none absolute flex flex-col items-center gap-0.5 transition-all duration-300 ${
        isCurrent ? 'scale-110' : 'opacity-70'
      } ${p.rank ? 'saturate-50' : ''}`}
      style={style}
    >
      <div
        className={`relative grid h-9 w-9 place-items-center rounded-full text-xl ${isCurrent ? 'active-glow' : ''}`}
        style={
          {
            '--pc': color,
            background: `linear-gradient(180deg, ${shade(color, 0.18)}, ${shade(color, -0.22)})`,
            border: '2.5px solid rgba(255,255,255,0.95)',
            boxShadow: '0 3px 8px rgba(0,0,0,.3)',
          } as CSSProperties
        }
      >
        <span className={isCurrent ? 'wiggle' : ''}>{p.avatar}</span>
        {p.kind === 'bot' && <span className="absolute -bottom-1 -right-1 text-[10px] leading-none">🤖</span>}
      </div>
      <div
        className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow"
        style={{ background: color }}
      >
        {p.score}
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: p.tokens }, (_, i) =>
          i < p.home ? (
            <span key={i} className="text-[9px] leading-none">⭐</span>
          ) : (
            <span
              key={i}
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={i < p.home + p.out ? { background: '#fff', border: `1.5px solid ${color}` } : { background: 'rgba(255,255,255,0.4)' }}
            />
          ),
        )}
      </div>
    </div>
  );
}

/** Big floating dice that appears near the active player in compact mode. */
export function FloatingDice({
  snap,
  theme,
  color,
  style,
  onRoll,
  rules,
}: {
  snap: Snapshot;
  theme: Theme;
  color: string;
  style: CSSProperties;
  onRoll: () => void;
  rules?: RuleOptions;
}) {
  if (snap.over) return null;
  return (
    <div className="absolute z-20 flex flex-col items-center gap-1" style={style}>
      <Dice
        value={snap.dice}
        rollId={snap.rollId}
        rollMs={snap.rollMs}
        rolling={snap.rolling}
        size={76}
        faceColor={theme.diceFace}
        pipColor={theme.dicePip}
        accent={color}
        active={snap.canRoll}
        onRoll={onRoll}
      />
      {snap.canRoll && (
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg"
          style={{ background: color, textShadow: '0 1px 0 rgba(0,0,0,.25)' }}
        >
          Tap to roll!
        </span>
      )}
      {!snap.canRoll && snap.humanTurn && snap.phase === 'select' && (
        <span className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-900 shadow-lg">
          {snap.cutReady ? (rules?.missedCut ? '⚔️ Cut or lose one!' : '⚔️ Capture!') : 'Pick a token!'}
        </span>
      )}
    </div>
  );
}


