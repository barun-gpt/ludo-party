import { useState } from 'react';
import { CATEGORIES, SHOP, shopItem, type Category, type ShopItem } from '../economy/config';
import { buyItem, equipItem, useStore } from '../economy/store';
import { getTheme } from '../themes';
import { Btn, Modal } from './ui';

function shapeEl(shape: string | undefined) {
  const c = '#ef4444';
  const common = { stroke: '#fff', strokeWidth: 3 } as const;
  if (shape === 'hexagon') return <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" fill={c} {...common} />;
  if (shape === 'star')
    return <polygon points="24,3 30,17 45,18 33,28 37,43 24,35 11,43 15,28 3,18 18,17" fill={c} {...common} />;
  if (shape === 'heart') return <path d="M24 42 C4 28 6 10 17 10 C21 10 24 13 24 16 C24 13 27 10 31 10 C42 10 44 28 24 42Z" fill={c} {...common} />;
  if (shape === 'flat') return <circle cx="24" cy="24" r="18" fill={c} {...common} />;
  return (
    <>
      <circle cx="24" cy="26" r="18" fill="#7f1d1d" />
      <circle cx="24" cy="24" r="18" fill={c} {...common} />
      <ellipse cx="18" cy="15" rx="6" ry="3" fill="#fff" opacity=".45" />
    </>
  );
}

function Preview({ it }: { it: ShopItem }) {
  if (it.cat === 'token')
    return (
      <svg viewBox="0 0 48 48" className="h-14 w-14">
        {shapeEl(it.shape)}
      </svg>
    );
  if (it.cat === 'dice') {
    const face = it.dice?.face || '#ffffff';
    const pip = it.dice?.pip || '#1e293b';
    return (
      <div className="relative h-12 w-12 rounded-xl shadow" style={{ background: face, border: '2px solid rgba(0,0,0,.15)' }}>
        {[[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]].map(([x, y]) => (
          <span key={`${x}${y}`} className="absolute h-2.5 w-2.5 rounded-full" style={{ left: `${x}%`, top: `${y}%`, background: pip, transform: 'translate(-50%,-50%)' }} />
        ))}
      </div>
    );
  }
  if (it.cat === 'board') {
    const b = it.board ?? { boardBg: '#ffffff', boardEdge: '#cbd5e1', cell: '#ffffff', cellStroke: '#cbd5e1' };
    return (
      <div className="grid h-14 w-14 grid-cols-3 gap-0.5 rounded-lg p-1" style={{ background: b.boardBg, border: `3px solid ${b.boardEdge}` }}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="rounded-sm" style={{ background: b.cell, border: `1px solid ${b.cellStroke}` }} />
        ))}
      </div>
    );
  }
  const t = getTheme(it.id.replace(/^u_/, ''));
  return (
    <div className="grid h-14 w-14 place-items-center rounded-2xl text-2xl shadow" style={{ background: t.bg, border: '2px solid rgba(255,255,255,.7)' }}>
      {t.emoji}
    </div>
  );
}

export default function ShopModal({ initial, onClose }: { initial: Category; onClose: () => void }) {
  const { eco } = useStore();
  const [cat, setCat] = useState<Category>(initial);
  const [msg, setMsg] = useState('');
  const items = SHOP.filter((s) => s.cat === cat);

  const act = (it: ShopItem) => {
    if (eco.owned.includes(it.id)) {
      equipItem(it.id);
      setMsg('');
      return;
    }
    const r = buyItem(it.id);
    setMsg(r === 'poor' ? `Not enough coins — you need ${(it.price - eco.coins).toLocaleString()} more. Complete tasks to earn more!` : `Bought ${it.name}! ✨`);
  };

  return (
    <Modal
      wide
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          🛒 Shop
          <span className="panel rounded-full px-3 py-1 text-base">🪙 {eco.coins.toLocaleString()}</span>
        </span>
      }
    >
      <div className="mb-3 grid grid-cols-4 gap-1 rounded-2xl bg-black/10 p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCat(c.id);
              setMsg('');
            }}
            className="rounded-xl py-2 text-sm font-bold"
            style={cat === c.id ? { background: 'var(--btn)', color: '#fff' } : { color: 'var(--sub)' }}
          >
            {c.emoji}
            <div>{c.label}</div>
          </button>
        ))}
      </div>
      {msg && <div className="mb-3 rounded-xl bg-black/10 p-2 text-center text-sm font-bold">{msg}</div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((it) => {
          const owned = eco.owned.includes(it.id);
          const on = eco.equipped[it.cat] === it.id;
          return (
            <div key={it.id} className="panel flex flex-col items-center gap-2 rounded-2xl p-3" style={on ? { outline: '2.5px solid var(--btn)' } : undefined}>
              <Preview it={it} />
              <div className="text-center text-sm font-bold leading-tight">{it.name}</div>
              <Btn onClick={() => act(it)} disabled={on} variant={owned ? 'secondary' : 'primary'} className="w-full !px-2 !py-1.5 text-sm">
                {on ? '✓ Equipped' : owned ? 'Equip' : `🪙 ${it.price.toLocaleString()}`}
              </Btn>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-[var(--sub)]">
        Equipped: {CATEGORIES.map((c) => shopItem(eco.equipped[c.id])?.name).join(' · ')}
      </p>
    </Modal>
  );
}
