import type { ReactNode } from 'react';

export function CoinChip({ coins }: { coins: number }) {
  return (
    <div className="panel flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-bold">
      <span>🪙</span>
      <span>{coins.toLocaleString()}</span>
    </div>
  );
}

export default function Page({ title, coins, children }: { title: string; coins?: number; children: ReactNode }) {
  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto">
      <div className="mx-auto max-w-lg px-4 pb-6 pt-[max(env(safe-area-inset-top),1rem)] text-[var(--text)]">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="flex-1 text-3xl font-bold">{title}</h1>
          {coins !== undefined && <CoinChip coins={coins} />}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {hint && <span className="text-xs text-[var(--sub)]">{hint}</span>}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
