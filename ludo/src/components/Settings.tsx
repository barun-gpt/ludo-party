import type { Settings, Speed } from '../game/types';
import { THEMES } from '../themes';
import { audio } from '../audio/audio';
import { Segmented, Toggle } from './ui';

export const SPEED_OPTS: { value: Speed; label: string }[] = [
  { value: 'slow', label: '🐢 Slow' },
  { value: 'normal', label: '🙂 Normal' },
  { value: 'fast', label: '🐇 Fast' },
  { value: 'turbo', label: '🚀 Turbo' },
];

export function ThemeGrid({ value, onPick, small }: { value: string; onPick: (id: string) => void; small?: boolean }) {
  return (
    <div className={`grid gap-2 ${small ? 'grid-cols-5' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {THEMES.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            title={t.name}
            onClick={(e) => {
              audio.unlock();
              audio.play('pop', { pitch: 3 });
              (e.currentTarget as HTMLElement).blur();
              onPick(t.id);
            }}
            className={`relative overflow-hidden rounded-2xl border-2 text-left transition-transform active:scale-95 ${
              on ? 'scale-[1.03] border-white shadow-lg ring-4 ring-[var(--btn)]' : 'border-white/30'
            }`}
            style={{ background: t.bg }}
          >
            {small ? (
              <div className="grid aspect-square place-items-center text-2xl">{t.emoji}</div>
            ) : (
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl drop-shadow">{t.emoji}</span>
                  <span
                    className="grid h-9 w-9 grid-cols-2 gap-0.5 rounded-lg p-1"
                    style={{ background: t.boardBg, boxShadow: `0 2px 6px ${t.boardShadow}` }}
                  >
                    {t.players.slice(0, 4).map((c) => (
                      <span key={c} className="rounded-sm" style={{ background: c }} />
                    ))}
                  </span>
                </div>
                <div className="mt-1 font-bold drop-shadow-sm" style={{ color: t.text }}>
                  {t.name}
                </div>
                <div className="mt-1 flex gap-1">
                  {t.players.map((c) => (
                    <span key={c} className="h-3.5 w-3.5 rounded-full border border-white/80" style={{ background: c }} />
                  ))}
                </div>
              </div>
            )}
            {on && (
              <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-bold text-emerald-600 shadow">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsPanel({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-black/5 px-3 py-2 text-sm font-semibold text-[var(--sub)]">
        🎨 Themes, tokens, dice and boards are unlocked with coins in the Shop (Profile tab).
      </div>
      <div className="rounded-2xl bg-black/5 px-2 py-1">
        <Toggle checked={settings.music} onChange={(v) => update({ music: v })} label="🎵 Music" />
        {settings.music && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.musicVolume}
            onChange={(e) => update({ musicVolume: Number(e.target.value) })}
            className="mb-1 w-full accent-[var(--btn)]"
            aria-label="Music volume"
          />
        )}
        <Toggle checked={settings.sfx} onChange={(v) => update({ sfx: v })} label="🔊 Sound effects" />
        {settings.sfx && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.sfxVolume}
            onChange={(e) => update({ sfxVolume: Number(e.target.value) })}
            onPointerUp={() => audio.play('six')}
            className="mb-1 w-full accent-[var(--btn)]"
            aria-label="Sound effects volume"
          />
        )}
        <Toggle checked={settings.shake} onChange={(v) => update({ shake: v })} label="📳 Screen shake" />
        <Toggle
          checked={settings.autoMove}
          onChange={(v) => update({ autoMove: v })}
          label="⚡ Auto-move"
          hint="Moves for you when there's only one choice"
        />
      </div>
      <div>
        <div className="mb-1.5 text-sm font-bold">⏩ Game speed</div>
        <Segmented value={settings.speed} options={SPEED_OPTS} onChange={(v) => update({ speed: v })} size="sm" />
      </div>
    </div>
  );
}
