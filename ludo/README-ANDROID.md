# Ludo Party – Android build

Easiest (no Android Studio): push this folder to a GitHub repo -> Actions tab -> "Build Android APK" -> download artifact `LudoParty`
containing `LudoParty.apk` (install on phone) and `LudoParty.aab` (upload to Google Play).

Local: install Node 22, JDK 21, Android SDK, then run `./build-android.sh`.
Keep `ludo-release.jks` and its password safe - Play Store updates need the same key.
Change `appId` in capacitor.config.ts (com.ludoparty.game) to your own unique id before publishing.
