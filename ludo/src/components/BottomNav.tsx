export type Tab = 'play' | 'activity' | 'leaderboard' | 'profile';
export const NAV_H = 64;

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'play', icon: '🎲', label: 'Play' },
  { id: 'activity', icon: '🎯', label: 'Activity' },
  { id: 'leaderboard', icon: '🏆', label: 'Leaderboard' },
  { id: 'profile', icon: '👤', label: 'Profile' },
];

export default function BottomNav({ tab, onTab, badge }: { tab: Tab; onTab: (t: Tab) => void; badge?: Tab | null }) {
  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-40 flex items-stretch border-t px-1 backdrop-blur-md"
      style={{
        height: `calc(${NAV_H}px + env(safe-area-inset-bottom))`,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--panel)',
        borderColor: 'var(--panel-border)',
      }}
    >
      {TABS.map((t) => {
        const on = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-transform active:scale-90"
            style={{ color: on ? 'var(--btn)' : 'var(--sub)' }}
          >
            <span className="text-2xl leading-none" style={{ filter: on ? 'none' : 'grayscale(0.6)', transform: on ? 'scale(1.15)' : 'none' }}>
              {t.icon}
            </span>
            <span className="text-[11px] font-bold">{t.label}</span>
            {badge === t.id && <span className="absolute right-[28%] top-2 h-2.5 w-2.5 rounded-full bg-red-500" />}
          </button>
        );
      })}
    </nav>
  );
}
