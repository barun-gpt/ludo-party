import { useEffect, useMemo, type CSSProperties } from 'react';
import type { Settings } from '../game/types';
import type { Theme } from '../themes';
import { loadScores } from '../storage';
import { Btn, IconBtn } from './ui';

export type MenuModal = 'themes' | 'scores' | 'help' | 'settings';

interface Props {
  theme: Theme;
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  onQuick: () => void;
  onSetup: () => void;
  onModal: (m: MenuModal) => void;
  modalOpen: boolean;
}

const DECOS: { kind: 'token' | 'emoji'; c?: number; e?: string; x: string; y: string; s: number; d: number; r: number }[] = [
  { kind: 'token', c: 0, x: '4%', y: '10%', s: 46, d: 0, r: -8 },
  { kind: 'token', c: 1, x: '86%', y: '16%', s: 40, d: 0.7, r: 10 },
  { kind: 'token', c: 2, x: '8%', y: '80%', s: 38, d: 1.3, r: 6 },
  { kind: 'token', c: 3, x: '84%', y: '74%', s: 48, d: 0.35, r: -6 },
  { kind: 'token', c: 4, x: '46%', y: '1%', s: 30, d: 1.7, r: 4 },
  { kind: 'token', c: 5, x: '50%', y: '93%', s: 32, d: 0.9, r: -4 },
  { kind: 'emoji', e: '🎲', x: '76%', y: '3%', s: 40, d: 0.9, r: 14 },
  { kind: 'emoji', e: '⭐', x: '0%', y: '44%', s: 30, d: 1.5, r: 0 },
  { kind: 'emoji', e: '🎲', x: '18%', y: '93%', s: 34, d: 0.4, r: -12 },
  { kind: 'emoji', e: '✨', x: '92%', y: '46%', s: 30, d: 1.1, r: 0 },
];

export default function StartScreen({ theme, settings, update, onQuick, onSetup, onModal, modalOpen }: Props) {
  const best = useMemo(() => loadScores()[0], []);

  useEffect(() => {
    if (modalOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        onQuick();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onQuick, modalOpen]);

  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto">
      <div className="relative mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-6 px-6 py-10">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {DECOS.map((d, i) =>
            d.kind === 'token' ? (
              <div
                key={i}
                className="deco-token float-y absolute"
                style={
                  {
                    left: d.x,
                    top: d.y,
                    width: d.s,
                    height: d.s,
                    background: theme.players[d.c ?? 0],
                    animationDelay: `${d.d}s`,
                    '--rot': `${d.r}deg`,
                  } as CSSProperties
                }
              />
            ) : (
              <div
                key={i}
                className="float-y absolute drop-shadow-lg"
                style={{ left: d.x, top: d.y, fontSize: d.s, animationDelay: `${d.d}s`, '--rot': `${d.r}deg` } as CSSProperties}
              >
                {d.e}
              </div>
            ),
          )}
        </div>

        <div className="relative text-center">
          <div className="flex justify-center gap-2 sm:gap-3">
            {['L', 'U', 'D', 'O'].map((l, i) => (
              <span
                key={l}
                className="title-letter h-16 w-16 place-items-center rounded-2xl text-4xl font-bold text-white sm:h-20 sm:w-20 sm:text-5xl"
                style={
                  {
                    background: `linear-gradient(180deg, ${theme.players[i]}, ${theme.players[i]}cc)`,
                    boxShadow: '0 6px 0 rgba(0,0,0,.25), 0 12px 24px rgba(0,0,0,.2), inset 0 3px 0 rgba(255,255,255,.4)',
                    border: '3px solid rgba(255,255,255,.9)',
                    textShadow: '0 3px 0 rgba(0,0,0,.25)',
                    animationDelay: `${i * 0.15}s`,
                    '--r': `${i % 2 ? 6 : -6}deg`,
                  } as CSSProperties
                }
              >
                {l}
              </span>
            ))}
          </div>
          <div className="shimmer-text mt-3 text-6xl font-bold tracking-wider drop-shadow sm:text-7xl">PARTY</div>
          <div className="mt-1 text-sm font-semibold text-[var(--sub)]">2–6 players · smart bots · 10 colorful themes</div>
        </div>

        <div className="relative flex w-full max-w-xs flex-col gap-3">
          <Btn onClick={onQuick} className="py-4 text-2xl">
            ▶ Play Now
            <div className="text-xs font-semibold opacity-90">You vs 3 bots · quick match</div>
          </Btn>
          <Btn variant="secondary" onClick={onSetup} className="text-xl">
            👥 Multiplayer
            <div className="text-xs font-medium text-[var(--sub)]">2–6 players · friends &amp; bots</div>
          </Btn>
          <div className="grid grid-cols-3 gap-3">
            <Btn variant="secondary" onClick={() => onModal('themes')} className="px-2 py-2.5 text-2xl">
              🎨<div className="text-xs font-semibold">Themes</div>
            </Btn>
            <Btn variant="secondary" onClick={() => onModal('scores')} className="px-2 py-2.5 text-2xl">
              🏆<div className="text-xs font-semibold">Scores</div>
            </Btn>
            <Btn variant="secondary" onClick={() => onModal('help')} className="px-2 py-2.5 text-2xl">
              ❓<div className="text-xs font-semibold">How to</div>
            </Btn>
          </div>
        </div>

        {best && (
          <div className="panel relative rounded-full px-4 py-1.5 text-sm font-semibold">
            🏆 Best: {best.avatar} {best.name} · <span className="font-bold">{best.score}</span>
          </div>
        )}

        <div className="relative flex gap-2">
          <IconBtn label="Toggle music" onClick={() => update({ music: !settings.music })}>
            {settings.music ? '🎵' : '🔇'}
          </IconBtn>
          <IconBtn label="Toggle sound effects" onClick={() => update({ sfx: !settings.sfx })}>
            {settings.sfx ? '🔊' : '🔈'}
          </IconBtn>
          <IconBtn label="Settings" onClick={() => onModal('settings')}>
            ⚙️
          </IconBtn>
        </div>
        <p className="kbd-hint relative text-xs text-[var(--sub)]">
          Press <kbd>Enter</kbd> to play now
        </p>
      </div>
    </div>
  );
}
