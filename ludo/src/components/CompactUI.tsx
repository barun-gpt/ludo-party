import type { CSSProperties } from 'react';
import type { RuleOptions, Snapshot } from '../game/types';
import type { Theme } from '../themes';
import Dice from './Dice';

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
          className="pointer-events-none rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg"
          style={{ background: color, textShadow: '0 1px 0 rgba(0,0,0,.25)' }}
        >
          Tap the dice!
        </span>
      )}
      {!snap.canRoll && snap.humanTurn && snap.phase === 'select' && (
        <span className="pointer-events-none rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-900 shadow-lg">
          {snap.cutReady ? (rules?.missedCut ? '⚔️ Cut or lose one!' : '⚔️ Capture!') : 'Pick a token!'}
        </span>
      )}
    </div>
  );
}
