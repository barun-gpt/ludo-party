# Ludo Party – Android build

**Full step-by-step launch guide:** see the "Ludo Party – Launch Guide" document that came with this project.

## Quick version
1. Edit `native.config.json` (server URL, Google / Facebook / AdMob keys, your Instagram + Facebook page links).
2. Change `appId` in `capacitor.config.ts` to your own unique id (e.g. `com.yourname.ludoparty`) BEFORE the first build. It cannot change after publishing.
3. Push this folder to a private GitHub repo (project files at the repo root).
4. Actions → "Create signing key (run ONCE)" (after adding the `KEYSTORE_PASSWORD` secret) → save the key → add `KEYSTORE_BASE64` secret.
5. Actions → "Build Android (APK + AAB)" → download artifact `LudoParty`: `LudoParty.apk` (test on a phone) and `LudoParty.aab` (upload to Google Play).

Local build instead: Node 22, JDK 21, Android SDK, then `./build-android.sh`.

## Rules you can edit (`src/economy/config.ts`)
- `POINTS_PER_COIN = 10`  → 10 points = 1 coin, so **100 points = 10 coins**
- `AD_REWARD`, `AD_DAILY_LIMIT`, `AD_SECONDS` (length of the placeholder ad), `FOLLOW_REWARD`, task list, shop prices.

## Google Play requirements built into this project
- Capacitor 8 → targets Android 16 (API 36), which Google Play requires for new apps/updates since 2026-08-31. The build stops with an error if the target is lower.
- `versionCode` goes up automatically on every CI build (Play rejects a repeated one).
- Account creation → in-app "Delete account" + a public delete-account web page (`/delete-account` on your server) + a privacy page (`/privacy`).
- Rewarded ads show Google's consent form (EEA/UK) when AdMob requires it.

Never commit `ludo-release.jks` (it is in `.gitignore`). Losing it means you can no longer update the app unless Play App Signing key reset is approved.
