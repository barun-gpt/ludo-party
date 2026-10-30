#!/usr/bin/env bash
# Builds Ludo Party into an installable Android APK (+ AAB for Google Play).
# Needs: Node 20+, JDK 17+ and the Android SDK (ANDROID_HOME set). Internet required once.
set -euo pipefail
cd "$(dirname "$0")"

npm install
[ -d android ] || npx cap add android
npm run icons || echo "icon generation skipped"
npm run android:sync

# Lock to portrait + keep screen on
MANIFEST=android/app/src/main/AndroidManifest.xml
grep -q screenOrientation "$MANIFEST" || sed -i 's/<activity /<activity android:screenOrientation="portrait" /' "$MANIFEST"

# Release signing key (created once - BACK IT UP, Google Play needs the same key for every update)
if [ ! -f ludo-release.jks ]; then
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
echo "Done: release/LudoParty.apk (install on phone)  release/LudoParty.aab (upload to Google Play)"
