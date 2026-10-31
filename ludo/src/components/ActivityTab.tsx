import { useEffect, useState } from 'react';
import { AD_DAILY_LIMIT, AD_REWARD, AD_SECONDS, FOLLOW_REWARD, LINKS, TASKS, type Task } from '../economy/config';
import { realAdsAvailable, showRewardedAd } from '../economy/ads';
import { claimAd, claimFollow, claimTask, followReady, refresh, startFollow, taskValue, useStore, type Eco, type Social } from '../economy/store';
import { Btn } from './ui';
import Page, { Section } from './Page';

const fmt = (t: Task, v: number) => (t.stat === 'playSec' ? `${Math.floor(Math.min(v, t.goal) / 60)}/${t.goal / 60} min` : `${Math.min(v, t.goal).toLocaleString()}/${t.goal.toLocaleString()}`);

function TaskRow({ t, eco }: { t: Task; eco: Eco }) {
  const v = taskValue(eco, t.id);
  const claimed = (t.scope === 'daily' ? eco.daily : eco.weekly).claimed.includes(t.id);
  const done = v >= t.goal;
  return (
    <div className="panel flex items-center gap-3 rounded-2xl p-3">
      <div className="text-3xl">{t.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">{t.title}</div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (v / t.goal) * 100)}%`, background: 'var(--btn)' }} />
        </div>
        <div className="mt-0.5 text-xs text-[var(--sub)]">{fmt(t, v)}</div>
      </div>
      {claimed ? (
        <div className="w-24 text-center text-sm font-bold text-[var(--sub)]">✓ Claimed</div>
      ) : (
        <Btn onClick={() => claimTask(t.id)} disabled={!done} className="w-24 !px-2 !py-2 text-sm">
          {done ? `Claim 🪙${t.reward}` : `🪙 ${t.reward}`}
        </Btn>
      )}
    </div>
  );
}

function AdOverlay({ onClose }: { onClose: () => void }) {
  const [left, setLeft] = useState(AD_SECONDS);
  const [got, setGot] = useState(false);
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center text-white">
      <div className="text-xs uppercase tracking-widest opacity-60">Advertisement</div>
      <div className="grid h-48 w-72 place-items-center rounded-2xl bg-white/10 text-sm opacity-80">
        Your rewarded ad plays here
        <br />
        (connect AdMob before publishing)
      </div>
      {left > 0 ? (
        <div className="text-lg font-bold">Reward in {left}s…</div>
      ) : got ? (
        <Btn onClick={onClose}>Done</Btn>
      ) : (
        <Btn
          onClick={() => {
            setGot(claimAd());
            onClose();
          }}
        >
          Claim 🪙 {AD_REWARD}
        </Btn>
      )}
      {left > 0 && (
        <button type="button" className="text-sm underline opacity-70" onClick={onClose}>
          Close (no reward)
        </button>
      )}
    </div>
  );
}

export default function ActivityTab() {
  const { eco } = useStore();
  const [ad, setAd] = useState(false);
  const [adMsg, setAdMsg] = useState('');
  const [adBusy, setAdBusy] = useState(false);
  const watchAd = async () => {
    if (!realAdsAvailable()) {
      setAd(true); // placeholder ad (browser / AdMob not configured)
      return;
    }
    setAdBusy(true);
    setAdMsg('');
    const r = await showRewardedAd();
    setAdBusy(false);
    setAdMsg(r === 'rewarded' && claimAd() ? `+${AD_REWARD} coins!` : 'No ad available right now — try again in a moment.');
  };
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    refresh();
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const adsLeft = AD_DAILY_LIMIT - eco.daily.ads;

  const follow = (k: Social, label: string, icon: string) => {
    const f = eco.follow[k];
    const wait = followReady(eco, k, now);
    return (
      <div className="panel flex items-center gap-3 rounded-2xl p-3">
        <div className="text-3xl">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="font-bold">Follow us on {label}</div>
          <div className="text-xs text-[var(--sub)]">One-time bonus · 🪙 {FOLLOW_REWARD}</div>
        </div>
        {f?.claimed ? (
          <div className="w-24 text-center text-sm font-bold text-[var(--sub)]">✓ Claimed</div>
        ) : f ? (
          <Btn onClick={() => claimFollow(k)} disabled={wait > 0} className="w-24 !px-2 !py-2 text-sm">
            {wait > 0 ? `Wait ${wait}s` : `Claim 🪙${FOLLOW_REWARD}`}
          </Btn>
        ) : (
          <a
            href={LINKS[k]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => startFollow(k)}
            className="btn3d block w-24 px-2 py-2 text-center text-sm"
          >
            Follow
          </a>
        )}
      </div>
    );
  };

  return (
    <Page title="Activity" coins={eco.coins}>
      <Section title="Daily tasks" hint="Resets every day">
        {TASKS.filter((t) => t.scope === 'daily').map((t) => (
          <TaskRow key={t.id} t={t} eco={eco} />
        ))}
      </Section>
      <Section title="Weekly tasks" hint="Resets every Monday">
        {TASKS.filter((t) => t.scope === 'weekly').map((t) => (
          <TaskRow key={t.id} t={t} eco={eco} />
        ))}
      </Section>
      <Section title="Bonus coins">
        <div className="panel flex items-center gap-3 rounded-2xl p-3">
          <div className="text-3xl">📺</div>
          <div className="min-w-0 flex-1">
            <div className="font-bold">Watch an ad</div>
            <div className="text-xs text-[var(--sub)]">
              +🪙 {AD_REWARD} each · {adsLeft > 0 ? `${adsLeft} left today` : 'come back tomorrow'}
              {adMsg && <span className="ml-1 font-bold">· {adMsg}</span>}
            </div>
          </div>
          <Btn onClick={watchAd} disabled={adsLeft <= 0 || adBusy} className="w-24 !px-2 !py-2 text-sm">
            {adBusy ? '…' : 'Watch'}
          </Btn>
        </div>
        {follow('instagram', 'Instagram', '📸')}
        {follow('facebook', 'Facebook', '👍')}
      </Section>
      {ad && <AdOverlay onClose={() => setAd(false)} />}
    </Page>
  );
}
