// Reads native.config.json and wires the optional native plugins into the Android project.
// Runs automatically from build-android.sh. Safe to run repeatedly. Does nothing if no keys are filled in.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const c = JSON.parse(fs.readFileSync('native.config.json', 'utf8'));
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
const stringsPath = 'android/app/src/main/res/values/strings.xml';

const wantSocial = Boolean(c.googleWebClientId || c.facebookAppId);
const wantAds = Boolean(c.admobAppId && c.admobRewardedUnitId);

const pkgs = [];
if (wantSocial) pkgs.push('@capgo/capacitor-social-login@^8');
if (wantAds) pkgs.push('@capacitor-community/admob@^8');
if (pkgs.length) execSync(`npm install --save ${pkgs.join(' ')}`, { stdio: 'inherit' });

let manifest = fs.readFileSync(manifestPath, 'utf8');
const meta = (name, value) => {
  if (!manifest.includes(`"${name}"`)) manifest = manifest.replace('</application>', `        <meta-data android:name="${name}" android:value="${value}" />\n    </application>`);
};
if (wantAds) meta('com.google.android.gms.ads.APPLICATION_ID', c.admobAppId);
if (c.facebookAppId) {
  meta('com.facebook.sdk.ApplicationId', '@string/facebook_app_id');
  meta('com.facebook.sdk.ClientToken', '@string/facebook_client_token');
  let strings = fs.readFileSync(stringsPath, 'utf8');
  const add = (name, value) => {
    if (!strings.includes(`name="${name}"`)) strings = strings.replace('</resources>', `    <string name="${name}">${value}</string>\n</resources>`);
  };
  add('facebook_app_id', c.facebookAppId);
  add('fb_login_protocol_scheme', `fb${c.facebookAppId}`);
  add('facebook_client_token', c.facebookClientToken || 'not-set');
  fs.writeFileSync(stringsPath, strings);
}
if (c.facebookAppId) {
  // Facebook's login screen returns to the app through these two activities (official Facebook Android SDK setup)
  if (!manifest.includes('com.facebook.CustomTabActivity')) {
    manifest = manifest.replace('</application>', `        <activity android:name="com.facebook.FacebookActivity" android:configChanges="keyboard|keyboardHidden|screenLayout|screenSize|orientation" android:label="@string/app_name" />
        <activity android:name="com.facebook.CustomTabActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="@string/fb_login_protocol_scheme" />
            </intent-filter>
        </activity>
    </application>`);
  }
}
fs.writeFileSync(manifestPath, manifest);

// ---- release warnings (these do not stop the build) ----
if (!c.apiUrl) console.warn('\n!! apiUrl is empty: accounts + worldwide leaderboard will NOT work in this build.');
if (wantAds && c.admobTesting) console.warn('\n!! admobTesting is true: only Google TEST ads are shown. Set it to false for the build you upload to Google Play.');
if (!wantAds) console.warn('\n!! AdMob is not configured: the 5-second PLACEHOLDER ad is used (players get coins for a fake ad). Fill admobAppId + admobRewardedUnitId before publishing.');
if (c.apiUrl && !c.apiUrl.startsWith('https://')) console.warn('\n!! apiUrl must start with https:// - Android blocks plain http.');
console.log(`native setup done (social: ${wantSocial}, ads: ${wantAds})`);
