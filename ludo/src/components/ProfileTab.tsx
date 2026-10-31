import { useState, type ReactNode } from 'react';
import { deleteAccount, linkProvider, serverMode, signIn, signOut, signUp, socialSignIn, unlinkProvider, useStore, type Provider } from '../economy/store';
import { nativeLogin } from '../economy/social';
import { Btn, Modal } from './ui';
import Page, { Section } from './Page';

const inputCls =
  'w-full rounded-2xl border-2 border-[var(--panel-border)] bg-white/90 px-4 py-3 text-base text-slate-900 outline-none focus:border-[var(--btn)]';
const NAMES: Record<Provider, string> = { google: 'Google', facebook: 'Facebook' };

function SocialBtn({ p, onClick, label }: { p: Provider; onClick: () => void; label: string }) {
  const g = p === 'google';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 px-4 py-3 text-base font-bold shadow active:scale-[0.98]"
      style={g ? { background: '#fff', color: '#1f2937', borderColor: '#d1d5db' } : { background: '#1877f2', color: '#fff', borderColor: '#1877f2' }}
    >
      <span className="grid h-6 w-6 place-items-center rounded-full text-sm font-black" style={g ? { background: '#ea4335', color: '#fff' } : { background: '#fff', color: '#1877f2' }}>
        {g ? 'G' : 'f'}
      </span>
      {label}
    </button>
  );
}

/** Demo mode: asks for name + email. Swap for the real Google / Facebook SDK (see README-ANDROID.md). */
function SocialDialog({ p, mode, onClose }: { p: Provider; mode: 'signin' | 'link'; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const go = async () => {
    const cred = { token: '', name, email };
    const e = mode === 'link' ? await linkProvider(p, cred) : await socialSignIn(p, cred);
    if (e) setErr(e);
    else onClose();
  };
  return (
    <Modal title={`${mode === 'link' ? 'Link' : 'Continue with'} ${NAMES[p]}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="rounded-xl bg-amber-100 p-3 text-xs font-semibold text-amber-900">
          Demo mode: real {NAMES[p]} login needs your own {NAMES[p]} app keys. Until they are added, this only links a {NAMES[p]} email on this device.
        </p>
        <input className={inputCls} placeholder={`${NAMES[p]} display name`} value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder={`${NAMES[p]} email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {err && <div className="text-sm font-bold text-red-600">{err}</div>}
        <Btn onClick={go}>Continue</Btn>
      </div>
    </Modal>
  );
}

function Field({ children }: { children: ReactNode }) {
  return <label className="block">{children}</label>;
}

function AuthForms({ onSocial }: { onSocial: (p: Provider) => Promise<string> }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const up = mode === 'signup';
  const submit = async () => {
    setBusy(true);
    setErr('');
    const e = up ? await signUp(name, email, pw) : await signIn(email, pw);
    setBusy(false);
    if (e) setErr(e);
  };
  return (
    <div className="panel rounded-3xl p-4">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-black/10 p-1">
        {(['signin', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setErr('');
            }}
            className="rounded-xl py-2 text-base font-bold"
            style={mode === m ? { background: 'var(--btn)', color: '#fff' } : { color: 'var(--sub)' }}
          >
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <SocialBtn p="google" onClick={async () => setErr(await onSocial('google'))} label={`${up ? 'Sign up' : 'Sign in'} with Google`} />
        <SocialBtn p="facebook" onClick={async () => setErr(await onSocial('facebook'))} label={`${up ? 'Sign up' : 'Sign in'} with Facebook`} />
        <div className="flex items-center gap-3 text-xs font-bold text-[var(--sub)]">
          <div className="h-px flex-1 bg-current opacity-30" />
          OR
          <div className="h-px flex-1 bg-current opacity-30" />
        </div>
        {up && (
          <Field>
            <input className={inputCls} placeholder="User name" maxLength={20} autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        )}
        <Field>
          <input className={inputCls} placeholder="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field>
          <input
            className={inputCls}
            placeholder="Password (6+ characters)"
            type="password"
            autoComplete={up ? 'new-password' : 'current-password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </Field>
        {err && <div className="text-sm font-bold text-red-600">{err}</div>}
        <Btn onClick={submit} disabled={busy}>
          {busy ? 'Please wait…' : up ? 'Create account' : 'Sign in'}
        </Btn>
        <p className="text-center text-xs text-[var(--sub)]">
          {up ? 'Your guest coins and progress move into the new account.' : 'No account? You can keep playing as a guest anytime.'}
        </p>
      </div>
    </div>
  );
}

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function ProfileTab({ onShop, onSettings, onHelp }: { onShop: () => void; onSettings: () => void; onHelp: () => void }) {
  const { user, eco } = useStore();
  const [dlg, setDlg] = useState<{ p: Provider; mode: 'signin' | 'link' } | null>(null);
  const [msg, setMsg] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const L = eco.life;

  /** Real mode: native Google/Facebook SDK -> server verifies. Demo mode (no server): small dialog. */
  const startSocial = async (p: Provider, mode: 'signin' | 'link'): Promise<string> => {
    if (!serverMode) {
      setDlg({ p, mode });
      return '';
    }
    const r = await nativeLogin(p);
    if ('error' in r) return r.error;
    return (mode === 'link' ? await linkProvider(p, r) : await socialSignIn(p, r)) ?? '';
  };

  return (
    <Page title="Profile" coins={eco.coins}>
      <div className="panel mb-5 flex items-center gap-4 rounded-3xl p-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-3xl font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--btn), var(--btn2))' }}>
          {user ? user.name.slice(0, 1).toUpperCase() : '👤'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-bold">{user ? user.name : 'Guest player'}</div>
          <div className="truncate text-sm text-[var(--sub)]">{user ? user.email || 'Signed in' : 'Progress is saved on this device'}</div>
        </div>
      </div>

      {!user && <AuthForms onSocial={(p) => startSocial(p, 'signin')} />}

      <div className={user ? '' : 'mt-5'}>
        <Section title="Stats">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['🎮 Games', L.games],
              ['🏆 Wins', L.wins],
              ['⭐ Best score', L.best],
              ['⏱️ Play time', fmtTime(L.playSec)],
            ].map(([k, v]) => (
              <div key={String(k)} className="panel rounded-2xl p-3 text-center">
                <div className="text-xs text-[var(--sub)]">{k}</div>
                <div className="text-xl font-bold">{typeof v === 'number' ? v.toLocaleString() : v}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {user && (
        <Section title="Linked accounts" hint="Bind for faster sign-in">
          {(['google', 'facebook'] as const).map((p) => {
            const linked = user.providers[p];
            return (
              <div key={p} className="panel flex items-center gap-3 rounded-2xl p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{NAMES[p]}</div>
                  <div className="truncate text-xs text-[var(--sub)]">{linked ? `Linked · ${linked.email}` : 'Not linked'}</div>
                </div>
                {linked ? (
                  <Btn variant="secondary" className="!px-4 !py-2 text-sm" onClick={async () => setMsg((await unlinkProvider(p)) ?? '')}>
                    Unlink
                  </Btn>
                ) : (
                  <Btn className="!px-4 !py-2 text-sm" onClick={async () => setMsg(await startSocial(p, 'link'))}>
                    Link
                  </Btn>
                )}
              </div>
            );
          })}
          {msg && <div className="text-sm font-bold text-red-600">{msg}</div>}
        </Section>
      )}

      <Section title="More">
        <div className="grid grid-cols-3 gap-2">
          <Btn variant="secondary" onClick={onShop} className="!px-2 !py-2.5 text-2xl">
            🛒<div className="text-xs font-semibold">Shop</div>
          </Btn>
          <Btn variant="secondary" onClick={onSettings} className="!px-2 !py-2.5 text-2xl">
            ⚙️<div className="text-xs font-semibold">Settings</div>
          </Btn>
          <Btn variant="secondary" onClick={onHelp} className="!px-2 !py-2.5 text-2xl">
            ❓<div className="text-xs font-semibold">How to</div>
          </Btn>
        </div>
      </Section>

      {user && (
        <div className="flex flex-col gap-2">
          {msg && <div className="text-sm font-bold text-red-600">{msg}</div>}
          <Btn variant="secondary" onClick={signOut}>
            Sign out
          </Btn>
          <button type="button" className="py-2 text-sm font-bold text-red-600 underline" onClick={() => setConfirmDel(true)}>
            Delete account
          </button>
        </div>
      )}

      {dlg && <SocialDialog p={dlg.p} mode={dlg.mode} onClose={() => setDlg(null)} />}
      {confirmDel && (
        <Modal title="Delete account?" onClose={() => setConfirmDel(false)}>
          <p className="mb-4 text-sm">This permanently removes your account, coins and purchases from this device. This cannot be undone.</p>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="secondary" onClick={() => setConfirmDel(false)}>
              Cancel
            </Btn>
            <Btn
              onClick={async () => {
                const e = await deleteAccount();
                if (e) setMsg(e);
                setConfirmDel(false);
              }}
            >
              Delete
            </Btn>
          </div>
        </Modal>
      )}
    </Page>
  );
}
