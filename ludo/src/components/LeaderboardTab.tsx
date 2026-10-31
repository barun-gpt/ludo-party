import { useEffect, useMemo, useState } from 'react';
import { fetchLeaderboard, listPlayers, serverMode, topScores, useStore, type WorldRow } from '../economy/store';
import Page, { Section } from './Page';

const medal = (i: number) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}`;

function Row({ rank, name, sub, value, me }: { rank: number; name: string; sub?: string; value: number; me?: boolean }) {
  return (
    <div className="panel flex items-center gap-3 rounded-2xl p-3" style={me ? { outline: '2.5px solid var(--btn)' } : undefined}>
      <div className="w-8 text-center text-2xl font-bold">{medal(rank - 1)}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">
          {name}
          {me ? ' (you)' : ''}
        </div>
        {sub && <div className="text-xs text-[var(--sub)]">{sub}</div>}
      </div>
      <div className="text-lg font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

export default function LeaderboardTab() {
  const snap = useStore();
  const eco = snap.eco;
  const players = useMemo(() => listPlayers(), [snap]);
  const scores = useMemo(() => topScores(), [snap]);
  const [world, setWorld] = useState<{ top: WorldRow[]; me: WorldRow | null } | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>(serverMode ? 'loading' : 'idle');

  const load = () => {
    if (!serverMode) return;
    setState('loading');
    fetchLeaderboard().then((r) => {
      setWorld(r);
      setState(r ? 'idle' : 'error');
    });
  };
  useEffect(load, [snap.user?.id]);

  return (
    <Page title="Leaderboard" coins={eco.coins}>
      {serverMode && (
        <Section title="🌍 Worldwide" hint="Ranked by total points">
          {state === 'loading' && !world && <div className="panel rounded-2xl p-4 text-center text-sm text-[var(--sub)]">Loading…</div>}
          {state === 'error' && (
            <button type="button" onClick={load} className="panel rounded-2xl p-4 text-center text-sm font-bold">
              Couldn't load the leaderboard. Tap to retry.
            </button>
          )}
          {world?.top.length === 0 && <div className="panel rounded-2xl p-4 text-center text-sm text-[var(--sub)]">No ranked players yet — be the first!</div>}
          {world?.top.map((r) => (
            <Row key={r.rank} rank={r.rank} name={r.name} sub={`${r.games} games · ${r.wins} wins · best ${r.best}`} value={r.points} me={world.me?.rank === r.rank && world.me.name === r.name} />
          ))}
          {world?.me && world.me.rank > 50 && <Row rank={world.me.rank} name={world.me.name} sub="Your rank" value={world.me.points} me />}
          {!snap.user && <p className="text-center text-xs text-[var(--sub)]">Sign in (Profile tab) to join the worldwide ranking.</p>}
        </Section>
      )}
      <Section title="Players on this device" hint="Ranked by total points">
        {players.map((p, i) => (
          <Row key={p.id} rank={i + 1} name={p.name} sub={`${p.games} games · ${p.wins} wins · best ${p.best}`} value={p.points} me={p.me} />
        ))}
      </Section>
      <Section title="Top single-game scores">
        {scores.length === 0 && <div className="panel rounded-2xl p-4 text-center text-sm text-[var(--sub)]">Play a game to set your first score!</div>}
        {scores.map((s, i) => (
          <Row key={i} rank={i + 1} name={`${s.avatar} ${s.name}`} value={s.score} />
        ))}
      </Section>
    </Page>
  );
}
