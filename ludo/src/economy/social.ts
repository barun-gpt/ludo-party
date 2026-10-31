import { registerPlugin } from '@capacitor/core';
import { FACEBOOK_APP_ID, FACEBOOK_CLIENT_TOKEN, GOOGLE_WEB_CLIENT_ID } from './config';
import type { Provider } from './store';

export interface SocialCred { token: string; name: string; email: string }

/* Talks to the native "SocialLogin" plugin (@capgo/capacitor-social-login). The build installs it
   automatically when googleWebClientId / facebookAppId are filled in native.config.json. */
interface SocialPlugin {
  initialize(o: unknown): Promise<void>;
  login(o: unknown): Promise<{ result: Record<string, any> }>;
}
const Social = registerPlugin<SocialPlugin>('SocialLogin');
let ready = false;

async function init() {
  if (ready) return;
  await Social.initialize({
    ...(GOOGLE_WEB_CLIENT_ID ? { google: { webClientId: GOOGLE_WEB_CLIENT_ID } } : {}),
    ...(FACEBOOK_APP_ID ? { facebook: { appId: FACEBOOK_APP_ID, clientToken: FACEBOOK_CLIENT_TOKEN } } : {}),
  });
  ready = true;
}

export const socialConfigured = (p: Provider) => (p === 'google' ? GOOGLE_WEB_CLIENT_ID !== '' : FACEBOOK_APP_ID !== '');

export async function nativeLogin(p: Provider): Promise<SocialCred | { error: string }> {
  if (!socialConfigured(p)) return { error: `${p === 'google' ? 'Google' : 'Facebook'} sign-in is not set up yet.` };
  try {
    await init();
    const res = await Social.login({
      provider: p,
      options: p === 'google' ? { scopes: ['email', 'profile'] } : { permissions: ['email', 'public_profile'] },
    });
    const r = res.result ?? {};
    const token: string = p === 'google' ? r.idToken : r.accessToken?.token;
    if (!token) return { error: 'Sign-in did not return a token. Please try again.' };
    return { token, name: r.profile?.name ?? '', email: r.profile?.email ?? '' };
  } catch {
    return { error: 'Sign-in was cancelled or is not available on this device.' };
  }
}
