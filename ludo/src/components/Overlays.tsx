import { useState } from 'react';
import type { Results, Settings } from '../game/types';
import type { Theme } from '../themes';
import { rgba } from '../themes';
import { clearScores, loadScores } from '../storage';
import { Btn, Modal } from './ui';
import { SettingsPanel, ThemeGrid } from './Settings';
import { MEDALS } from './Hud';
import { POINTS_PER_COIN } from '../economy/config';

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function PauseMenu({
  settings,
  update,
  onResume,
  onRestart,
  onQuit,
}: {
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}) {
  return (
    <Modal title="⏸️ Paused" onClose={onResume} closeLabel="Resume">
      <div className="flex flex-col gap-3">
        <Btn onClick={onResume} className="w-full text-xl">
          ▶ Resume
        </Btn>
        <div className="grid grid-cols-2 gap-3">
          <Btn variant="secondary" onClick={onRestart}>
            🔄 Restart
          </Btn>
          <Btn variant="secondary" onClick={onQuit}>
            🏠 Menu
          </Btn>
        </div>
        <SettingsPanel settings={settings} update={update} />
        <p className="kbd-hint text-center text-xs text-[var(--sub)]">
          <kbd>P</kbd> / <kbd>Esc</kbd> resume · <kbd>R</kbd> restart
        </p>
      </div>
    </Modal>
  );
}

export function GameOver({
  results,
  theme,
  newHigh,
  coins,
  onRestart,
  onMenu,
  onScores,
}: {
  coins?: number;
  results: Results;
  theme: Theme;
  newHigh: number[];
  onRestart: () => void;
  onMenu: () => void;
  onScores: () => void;
}) {
  const winner = results.rows[0];
  const humans = results.rows.filter((r) => r.kind === 'human');
  const solo = humans.length === 1 ? humans[0] : null;
  const title = solo ? (solo.rank === 1 ? 'You Win!' : `You placed ${ordinal(solo.rank)}!`) : `${winner.name} Wins!`;
  const emoji = solo ? (solo.rank === 1 ? '🎉' : solo.rank === 2 ? '🥈' : solo.rank === 3 ? '🥉' : '💪') : '🏆';
  const mins = Math.floor(results.durationMs / 60000);
  const secs = Math.floor((results.durationMs % 60000) / 1000);
  return (
    <Modal
      title={
        <>
          <span className="shimmer-text">{title}</span> <span>{emoji}</span>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <div className="trophy-bounce relative mt-10">
          <div
            className="grid h-24 w-24 place-items-center rounded-full text-6xl shadow-xl"
            style={{ background: theme.players[winner.color], boxShadow: `0 0 0 5px #fff, 0 0 40px ${theme.players[winner.color]}` }}
          >
            {winner.avatar}
          </div>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-5xl">👑</span>
        </div>
        <div className="text-sm text-[var(--sub)]">
          ⏱️ {mins}:{String(secs).padStart(2, '0')} · {results.rows.length} players
        </div>
        <div className="panel rounded-full px-4 py-1.5 text-base font-bold">
          🪙 +{coins ?? 0} coins <span className="text-xs font-semibold text-[var(--sub)]">({POINTS_PER_COIN * 10} points = 10 coins)</span>
        </div>
        <div className="flex w-full flex-col gap-1.5">
          {results.rows.map((r) => {
            const c = theme.players[r.color];
            return (
              <div
                key={r.pi}
                className="flex items-center gap-2 rounded-2xl px-3 py-2"
                style={{ background: rgba(c, 0.16), border: `2px solid ${rgba(c, 0.55)}` }}
              >
                <span className="w-8 text-center text-xl font-bold">{MEDALS[r.rank] || r.rank}</span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl" style={{ background: c }}>
                  {r.avatar}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">
                    {r.name} {r.kind === 'bot' && <span className="text-sm">🤖</span>}
                  </div>
                  <div className="text-xs text-[var(--sub)]">
                    🏠 {r.home} home · 💥 {r.captures} captures
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">{r.score}</div>
                  {newHigh.includes(r.pi) && <div className="animate-pulse text-[10px] font-bold text-amber-500">★ NEW HIGH SCORE!</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid w-full grid-cols-2 gap-3">
          <Btn onClick={onRestart} className="col-span-2 text-xl">
            🔄 Play Again
          </Btn>
          <Btn variant="secondary" onClick={onMenu}>
            🏠 Menu
          </Btn>
          <Btn variant="secondary" onClick={onScores}>
            🏆 Scores
          </Btn>
        </div>
        <p className="kbd-hint text-xs text-[var(--sub)]">
          <kbd>Enter</kbd> / <kbd>R</kbd> play again · <kbd>Esc</kbd> menu
        </p>
      </div>
    </Modal>
  );
}

export function HighScoresModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const [scores, setScores] = useState(loadScores);
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal title="🏆 High Scores" onClose={onClose}>
      {scores.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-6xl">🎲</div>
          <p className="mt-3 font-semibold">No scores yet!</p>
          <p className="text-sm text-[var(--sub)]">Play a game to get on the board.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {scores.map((s, i) => {
            const c = theme.players[s.color] ?? theme.btn;
            return (
              <div
                key={s.date + '-' + i}
                className="flex items-center gap-2 rounded-2xl px-3 py-2"
                style={{ background: rgba(c, i < 3 ? 0.2 : 0.1), border: `1.5px solid ${rgba(c, 0.45)}` }}
              >
                <span className="w-8 text-center text-lg font-bold">{i < 3 ? MEDALS[i + 1] : i + 1}</span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl" style={{ background: c }}>
                  {s.avatar}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{s.name}</div>
                  <div className="text-xs text-[var(--sub)]">
                    {s.won ? '🏆 Won' : `${ordinal(s.rank)} place`} · {s.players}P · 💥{s.captures} ·{' '}
                    {new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="text-xl font-bold">{s.score}</div>
              </div>
            );
          })}
          <button
            type="button"
            className={`chip mt-2 px-3 py-2 text-sm ${confirm ? 'text-red-500' : ''}`}
            onClick={() => {
              if (!confirm) {
                setConfirm(true);
                return;
              }
              clearScores();
              setScores([]);
              setConfirm(false);
            }}
          >
            {confirm ? 'Tap again to clear all scores' : '🗑️ Clear scores'}
          </button>
        </div>
      )}
    </Modal>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const rules: [string, string][] = [
    ['🎲', 'Roll a 6 to move a token out of your base onto your start square.'],
    ['➡️', 'Tokens race clockwise around the board, then up your colored lane to the center.'],
    ['💥', 'Land exactly on an opponent to send them back to base (+25 points)!'],
    ['⭐', 'Stars and start squares are safe — nobody can capture you there.'],
    ['🏠', 'You need the exact number to reach home in the center (+50 points).'],
    ['🔁', 'Rolling a 6, capturing, or reaching home gives you a bonus roll.'],
    ['😵', 'Three 6s in a row and your turn is skipped!'],
    ['🏆', 'Get all your tokens home first to win. Finishing bonus: +150 for 1st place.'],
  ];
  return (
    <Modal title="❓ How to Play" onClose={onClose} wide>
      <div className="flex flex-col gap-2">
        {rules.map(([e, t]) => (
          <div key={t} className="flex items-start gap-3 rounded-2xl bg-black/5 px-3 py-2">
            <span className="text-2xl">{e}</span>
            <span className="pt-0.5 text-sm font-medium">{t}</span>
          </div>
        ))}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl bg-black/5 p-3 text-sm">
            <div className="mb-1 font-bold">👆 Touch</div>
            Tap the dice (or the board) to roll. Tap a glowing token to move it. A dotted path shows where it will land — a red target means
            a capture!
          </div>
          <div className="rounded-2xl bg-black/5 p-3 text-sm">
            <div className="mb-1 font-bold">⌨️ Keyboard</div>
            <kbd>Space</kbd>/<kbd>Enter</kbd> roll &amp; move · <kbd>←</kbd>
            <kbd>→</kbd> choose token · <kbd>1</kbd>-<kbd>4</kbd> pick token · <kbd>P</kbd> pause · <kbd>M</kbd> music · <kbd>R</kbd> restart
          </div>
        </div>
        <div className="rounded-2xl bg-black/5 p-3 text-sm">
          <div className="mb-1 font-bold">👥 Multiplayer</div>
          Play with 2–6 players on one device: friends and family take turns (pass &amp; play), and you can fill any seat with a computer
          bot (Easy, Normal or Hard). The board changes shape with the player count — triangle, classic cross, pentagon or hexagon!
        </div>
        <div className="rounded-2xl bg-black/5 p-3 text-sm">
          <div className="mb-1 font-bold">🇳🇵 Nepali House Rules (optional)</div>
          <p className="mb-1.5 text-xs text-[var(--sub)]">Switch these on in Multiplayer setup before starting a game — leave them off for classic rules:</p>
          <ul className="flex flex-col gap-1.5">
            <li>
              😵 <b>Three 6s taken back</b> — roll three 6s in a row and your turn is over <i>and</i> every move you made with those sixes is
              undone (captures go back too)!
            </li>
            <li>
              ⚔️ <b>Cut or get cut</b> — if you skip a capture you could have made, the token that could have cut gets sent home as a
              penalty. Bots never skip a cut.
            </li>
            <li>
              🏠 <b>Six must open the yard</b> — while any token is still in base, a 6 has to bring one out. Only once all your tokens are
              out can a 6 move them along the board.
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

export function ThemesModal({ value, onPick, onClose }: { value: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Modal title="🎨 Pick a Theme" onClose={onClose} wide>
      <ThemeGrid value={value} onPick={onPick} />
      <p className="mt-3 text-center text-xs text-[var(--sub)]">Each theme has its own colors, background and music!</p>
    </Modal>
  );
}

export function SettingsModal({
  settings,
  update,
  onClose,
}: {
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="⚙️ Settings" onClose={onClose}>
      <SettingsPanel settings={settings} update={update} />
    </Modal>
  );
}
