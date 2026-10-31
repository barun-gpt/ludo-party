#!/usr/bin/env bash
# Builds Ludo Party into an installable Android APK (+ AAB for Google Play).
# Needs: Node 20+, JDK 17+ and the Android SDK (ANDROID_HOME set). Internet required once.
set -euo pipefail
cd "$(dirname "$0")"

npm install
[ -d android ] || npx cap add android
node scripts/setup-native.mjs
npm run icons || echo "icon generation skipped"
npm run android:sync

# Google Play (since 2026-08-31) only accepts new apps/updates that target Android 16 = API 36 or higher
TSDK=$(grep -E "^\s*targetSdkVersion" android/variables.gradle | grep -oE "[0-9]+" | head -1 || true)
if [ "${TSDK:-0}" -lt 36 ]; then
  echo "ERROR: targetSdkVersion is ${TSDK:-unknown}; Google Play needs 36+. Make sure package.json uses Capacitor 8 (@capacitor/*@^8)."
  echo "       If an old android/ folder exists from Capacitor 7, delete it and run this script again."
  exit 1
fi

# Every upload to Google Play needs a HIGHER versionCode than the one before (CI: the run number is used automatically)
VERSION_CODE="${VERSION_CODE:-${GITHUB_RUN_NUMBER:-1}}"
VERSION_NAME="${VERSION_NAME:-1.0.${VERSION_CODE}}"
sed -i -E "s/versionCode[ =]+[0-9]+/versionCode ${VERSION_CODE}/; s/versionName[ =]+\"[^\"]*\"/versionName \"${VERSION_NAME}\"/" android/app/build.gradle
echo "versionCode=${VERSION_CODE} versionName=${VERSION_NAME}"

# Lock to portrait + keep screen on
MANIFEST=android/app/src/main/AndroidManifest.xml
grep -q screenOrientation "$MANIFEST" || sed -i '0,/<activity /s//<activity android:screenOrientation="portrait" /' "$MANIFEST"

# Release signing key (created once - BACK IT UP, Google Play needs the same key for every update)
if [ ! -f ludo-release.jks ]; then
  echo "!! No ludo-release.jks found - creating a NEW signing key. If this is a CI run, do NOT upload this build to Google Play:"
  echo "!! run the 'Create signing key' workflow once and save KEYSTORE_BASE64 + KEYSTORE_PASSWORD as repository secrets first."
  [ -n "${KEYSTORE_PASSWORD:-}" ] || echo "!! KEYSTORE_PASSWORD not set - using the public default password. Fine for a test APK only."
  keytool -genkeypair -v -keystore ludo-release.jks -alias ludo -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "${KEYSTORE_PASSWORD:-ludoparty123}" -keypass "${KEYSTORE_PASSWORD:-ludoparty123}" \
    -dname "CN=Ludo Party, O=Ludo, C=US"
fi
cat > android/keystore.properties <<PROPS
storeFile=../../ludo-release.jks
storePassword=${KEYSTORE_PASSWORD:-ludoparty123}
keyAlias=ludo
keyPassword=${KEYSTORE_PASSWORD:-ludoparty123}
PROPS
if ! grep -q keystore.properties android/app/build.gradle; then
cat >> android/app/build.gradle <<'GRADLE'

def ksProps = new Properties()
def ksFile = rootProject.file("keystore.properties")
if (ksFile.exists()) {
    ksProps.load(new FileInputStream(ksFile))
    android.signingConfigs {
        release {
            storeFile file(ksProps['storeFile'])
            storePassword ksProps['storePassword']
            keyAlias ksProps['keyAlias']
            keyPassword ksProps['keyPassword']
        }
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.release
}
GRADLE
fi

cd android
./gradlew assembleRelease bundleRelease
cd ..
mkdir -p release
cp android/app/build/outputs/apk/release/app-release.apk release/LudoParty.apk
cp android/app/build/outputs/bundle/release/app-release.aab release/LudoParty.aab
echo "---- Signing key fingerprints (register SHA-1 in Google Cloud for Google sign-in) ----"
keytool -list -v -keystore ludo-release.jks -alias ludo -storepass "${KEYSTORE_PASSWORD:-ludoparty123}" 2>/dev/null | grep -E "SHA1|SHA256" || true
echo "---- Facebook key hash (paste into Facebook app > Android > Key Hashes) ----"
keytool -exportcert -alias ludo -keystore ludo-release.jks -storepass "${KEYSTORE_PASSWORD:-ludoparty123}" 2>/dev/null | openssl sha1 -binary | openssl base64 || true
echo "Done: release/LudoParty.apk (install on phone)  release/LudoParty.aab (upload to Google Play)"
