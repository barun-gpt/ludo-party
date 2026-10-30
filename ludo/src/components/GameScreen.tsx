import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LudoGame, SPEED_MUL } from '../game/engine';
import { Renderer } from '../game/renderer';
import type { BannerMsg, GameOptions, Results, Settings, Snapshot } from '../game/types';
import type { Theme } from '../themes';
import { audio } from '../audio/audio';
import { addScore } from '../storage';
import { useMedia } from '../hooks/useMedia';
import { IconBtn } from './ui';
import { Banner, DicePanel, PlayersPanel } from './Hud';
import { GameOver, PauseMenu } from './Overlays';
import { CompactBadge, FloatingDice } from './CompactUI';

interface Props {
  options: GameOptions;
  theme: Theme;
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  onExit: () => void;
  onRestart: () => void;
  onScores: () => void;
  modalOpen: boolean;
}

export default function GameScreen({ options, theme, settings, update, onExit, onRestart, onScores, modalOpen }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<LudoGame | null>(null);
  const rendRef = useRef<Renderer | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [paused, setPausedState] = useState(false);
  const [banner, setBanner] = useState<BannerMsg | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [newHigh, setNewHigh] = useState<number[]>([]);
  const landscape = useMedia('(orientation: landscape)');
  // Compact mode: portrait phones (narrow + portrait). Tablets and landscape phones use the full layout.
  const compact = useMedia('(max-width: 560px) and (orientation: portrait)');

  // Canvas size in CSS pixels, updated on resize. Used to position floating overlays.
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  // Pixel positions of each arm's yard center relative to the canvas element.
  const [armPos, setArmPos] = useState<{ x: number; y: number }[]>([]);

  const pausedRef = useRef(false);
  const resultsRef = useRef<Results | null>(null);
  const modalRef = useRef(modalOpen);
  modalRef.current = modalOpen;
  resultsRef.current = results;

  const initial = useRef({ options, theme, settings });

  // ------------------------------------------------------------ game lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const { options: opts, theme: th, settings: st } = initial.current;
    const game = new LudoGame({ ...opts, autoMove: st.autoMove, speed: st.speed }, th.players);
    game.shakeEnabled = st.shake;
    gameRef.current = game;
    const rend = new Renderer(canvas, th);
    rendRef.current = rend;

    let queued = false;
    game.onChange = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        setSnap(game.snapshot());
      });
    };
    game.onBanner = (b) => setBanner(b);
    game.onGameOver = (r) => {
      const marks: number[] = [];
      for (const row of r.rows) {
        if (row.kind !== 'human') continue;
        const idx = addScore({
          name: row.name,
          avatar: row.avatar,
          score: row.score,
          rank: row.rank,
          players: r.rows.length,
          won: row.rank === 1,
          date: Date.now(),
          color: row.color,
          captures: row.captures,
        });
        if (idx >= 0) marks.push(row.pi);
      }
      setNewHigh(marks);
      setResults(r);
    };

    const measure = () => {
      const r = wrap.getBoundingClientRect();
      rend.resize(r.width, r.height);
      setCanvasSize({ w: r.width, h: r.height });
      setArmPos(rend.armCanvasPositions(game));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      game.update(dt);
      rend.render(game);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    game.start();
    setSnap(game.snapshot());

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  // live settings
  useEffect(() => {
    const g = gameRef.current;
    if (g) g.palette = theme.players;
    rendRef.current?.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    g.shakeEnabled = settings.shake;
    g.speedMul = SPEED_MUL[settings.speed];
    g.opts.autoMove = settings.autoMove;
  }, [settings.shake, settings.speed, settings.autoMove]);

  // banner auto-clear
  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner((b) => (b && b.id === banner.id ? null : b)), 1600);
    return () => clearTimeout(id);
  }, [banner]);

  const setPaused = useCallback((p: boolean) => {
    if (resultsRef.current && p) return;
    pausedRef.current = p;
    setPausedState(p);
    gameRef.current?.setPaused(p);
    audio.duck(p);
  }, []);

  useEffect(() => () => audio.duck(false), []);

  // auto-pause when the tab is hidden
  useEffect(() => {
    const h = () => {
      if (document.hidden && gameRef.current && !gameRef.current.over) setPaused(true);
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [setPaused]);

  // ------------------------------------------------------------ keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g || modalRef.current) return;
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key;
      if (resultsRef.current) {
        if (k === 'Enter' || k === ' ' || k === 'r' || k === 'R') {
          e.preventDefault();
          onRestart();
        } else if (k === 'Escape') onExit();
        return;
      }
      if (k === 'Escape' || k === 'p' || k === 'P') {
        e.preventDefault();
        setPaused(!pausedRef.current);
        return;
      }
      if (pausedRef.current) {
        if (k === 'r' || k === 'R') onRestart();
        else if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          setPaused(false);
        }
        return;
      }
      if (k === 'm' || k === 'M') {
        update({ music: !audio.musicOn });
        return;
      }
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        if (!e.repeat) g.confirm();
        return;
      }
      if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'a' || k === 'A' || k === 'w' || k === 'W') {
        e.preventDefault();
        g.cycle(-1);
        return;
      }
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'd' || k === 'D' || k === 's' || k === 'S' || k === 'Tab') {
        e.preventDefault();
        g.cycle(1);
        return;
      }
      if (k >= '1' && k <= '4') g.selectNumber(Number(k));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit, onRestart, setPaused, update]);

  // ------------------------------------------------------------ pointer
  const toBoard = (e: React.PointerEvent) => {
    const r = rendRef.current;
    const c = canvasRef.current;
    if (!r || !c) return null;
    const rect = c.getBoundingClientRect();
    return r.toBoard(e.clientX - rect.left, e.clientY - rect.top);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    audio.unlock();
    const g = gameRef.current;
    const b = toBoard(e);
    if (!g || !b || pausedRef.current) return;
    g.tapAt(b.x, b.y);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const g = gameRef.current;
    const b = toBoard(e);
    const c = canvasRef.current;
    if (!g || !b || !c) return;
    const over = g.hoverAt(b.x, b.y);
    const clickable = over || (g.phase === 'roll' && g.isHuman(g.current) && !g.over);
    c.style.cursor = clickable ? 'pointer' : 'default';
  };

  const roll = useCallback(() => {
    audio.unlock();
    gameRef.current?.requestRoll();
  }, []);

  // ------------------------------------------------------------ compact-mode positions
  const g = gameRef.current;

  /** Floating positions for the compact overlay (portrait phone). */
  const badgeStyles = useMemo(() => {
    if (!canvasSize.w || armPos.length === 0) return [];
    return armPos.map((a) => {
      // Direction from canvas center to this arm
      const dx = a.x - canvasSize.w / 2;
      const dy = a.y - canvasSize.h / 2;
      const len = Math.hypot(dx, dy) || 1;
      // Push further toward the edge, then clamp to keep badges visible
      const padX = 36;
      const padY = 32;
      const bx = Math.max(padX, Math.min(canvasSize.w - padX, a.x + (dx / len) * 36));
      const by = Math.max(padY, Math.min(canvasSize.h - padY, a.y + (dy / len) * 36));
      return { left: `${bx}px`, top: `${by}px`, transform: 'translate(-50%, -50%)', zIndex: 5 };
    });
  }, [armPos, canvasSize]);

  const diceStyle = useMemo(() => {
    if (!canvasSize.w || !snap || snap.over || armPos.length === 0) return {};
    const pi = snap.current;
    const arm = g?.players[pi]?.arm ?? pi;
    const a = armPos[arm];
    if (!a) return {};
    // Direction from canvas center to this arm's yard
    const dx = a.x - canvasSize.w / 2;
    const dy = a.y - canvasSize.h / 2;
    const len = Math.hypot(dx, dy) || 1;
    // Push further outward so the dice sits in the screen corner nearest to the yard
    const pad = 52;
    let x = a.x + (dx / len) * 56;
    let y = a.y + (dy / len) * 56;
    // Clamp to canvas (keep the dice fully visible)
    x = Math.max(pad, Math.min(canvasSize.w - pad, x));
    y = Math.max(pad, Math.min(canvasSize.h - pad, y));
    return { left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -50%)', zIndex: 15 };
  }, [canvasSize, snap, g, armPos]);

  const showCompact = compact && snap && !results;
  const activePlayer = snap?.players[snap.current];
  const activeColor = activePlayer ? theme.players[activePlayer.color] : theme.btn;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 pb-1 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <IconBtn label="Pause (P)" onClick={() => setPaused(true)}>
          ⏸️
        </IconBtn>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-xl font-bold tracking-wide drop-shadow-sm sm:text-2xl">
            <span className="shimmer-text">Ludo Party</span> <span className="text-base">{theme.emoji}</span>
          </div>
        </div>
        <IconBtn label="Toggle music (M)" onClick={() => update({ music: !settings.music })}>
          {settings.music ? '🎵' : '🔇'}
        </IconBtn>
        <IconBtn label="Toggle sound effects" onClick={() => update({ sfx: !settings.sfx })}>
          {settings.sfx ? '🔊' : '🔈'}
        </IconBtn>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] landscape:flex-row">
        {!showCompact && snap && <PlayersPanel snap={snap} theme={theme} />}
        <div ref={wrapRef} className="relative min-h-0 min-w-0 flex-1">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onContextMenu={(e) => e.preventDefault()}
          />
          {banner && <Banner b={banner} theme={theme} />}

          {/* Compact overlays (portrait phone) */}
          {showCompact && snap && (
            <>
              {snap.players.map((p, i) => (
                <CompactBadge
                  key={i}
                  p={p}
                  active={i === snap.current}
                  color={theme.players[p.color]}
                  style={badgeStyles[i]}
                  snap={snap}
                />
              ))}
              {snap.humanTurn && activePlayer && (
                <FloatingDice
                  snap={snap}
                  theme={theme}
                  color={activeColor}
                  style={diceStyle}
                  onRoll={roll}
                />
              )}
              {!snap.humanTurn && !snap.over && (
                <div
                  className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur"
                >
                  {activePlayer?.avatar} {activePlayer?.name}'s turn…
                </div>
              )}
            </>
          )}
        </div>
        {!showCompact && snap && <DicePanel snap={snap} theme={theme} onRoll={roll} landscape={landscape} />}
      </div>

      {paused && !results && (
        <PauseMenu
          settings={settings}
          update={update}
          onResume={() => setPaused(false)}
          onRestart={onRestart}
          onQuit={onExit}
        />
      )}
      {results && !modalOpen && (
        <GameOver results={results} theme={theme} newHigh={newHigh} onRestart={onRestart} onMenu={onExit} onScores={onScores} />
      )}
    </div>
  );
}
