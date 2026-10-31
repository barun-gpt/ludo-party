import { Capacitor, registerPlugin } from '@capacitor/core';
import { ADMOB_REWARDED_ID, ADMOB_TESTING } from './config';

/* Talks to the native "AdMob" plugin (@capacitor-community/admob). The build installs it
   automatically when admobAppId + admobRewardedUnitId are filled in native.config.json. */
interface ConsentInfo { status?: string; isConsentFormAvailable?: boolean; canRequestAds?: boolean }
interface AdMobPlugin {
  initialize(o?: unknown): Promise<void>;
  requestConsentInfo(o?: unknown): Promise<ConsentInfo>;
  showConsentForm(): Promise<ConsentInfo>;
  prepareRewardVideoAd(o: unknown): Promise<unknown>;
  showRewardVideoAd(): Promise<unknown>;
}
const AdMob = registerPlugin<AdMobPlugin>('AdMob');

export const realAdsAvailable = () => Capacitor.isNativePlatform() && ADMOB_REWARDED_ID !== '';

/** Google's consent form (UMP). Only shows for players in regions that require it (EEA/UK...); needs the
    "Privacy & messaging" message to be published in your AdMob account. Never blocks ads if it errors. */
async function ensureConsent(): Promise<boolean> {
  try {
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
    return info.canRequestAds !== false;
  } catch {
    return true;
  }
}

/** Resolves 'rewarded' only if the player watched the ad to the end. */
export async function showRewardedAd(): Promise<'rewarded' | 'failed'> {
  try {
    await AdMob.initialize({});
    if (!(await ensureConsent())) return 'failed';
    await AdMob.prepareRewardVideoAd({ adId: ADMOB_REWARDED_ID, isTesting: ADMOB_TESTING });
    const r = (await AdMob.showRewardVideoAd()) as { amount?: number } | undefined;
    return r && typeof r.amount === 'number' ? 'rewarded' : 'failed';
  } catch {
    return 'failed';
  }
}
