#!/bin/sh
set -eu
SDK=/opt/android
BT="$SDK/build-tools/34.0.0"
JAR="$SDK/platforms/android-34/android.jar"
mkdir -p /tmp/tenhalf-build/classes /tmp/tenhalf-build/dex public
"$BT/aapt" package -f -M android/AndroidManifest.xml -S android/res -I "$JAR" -F /tmp/tenhalf-build/unsigned.apk
javac -source 8 -target 8 -bootclasspath "$JAR" -d /tmp/tenhalf-build/classes android/src/com/jh/tenhalf/MainActivity.java
jar cf /tmp/tenhalf-build/classes.jar -C /tmp/tenhalf-build/classes .
"$BT/d8" --lib "$JAR" --min-api 26 --output /tmp/tenhalf-build/dex /tmp/tenhalf-build/classes.jar
zip -j /tmp/tenhalf-build/unsigned.apk /tmp/tenhalf-build/dex/classes.dex
"$BT/zipalign" -f 4 /tmp/tenhalf-build/unsigned.apk /tmp/tenhalf-build/aligned.apk
keytool -genkeypair -noprompt -keystore /tmp/tenhalf-build/signing.jks -storepass android -keypass android -alias tenhalf -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Ten Half, O=Personal Games, C=CN"
"$BT/apksigner" sign --ks /tmp/tenhalf-build/signing.jks --ks-pass pass:android --key-pass pass:android --out public/TenHalf-v1.0.apk /tmp/tenhalf-build/aligned.apk
"$BT/apksigner" verify --verbose public/TenHalf-v1.0.apk
"$BT/aapt" dump badging public/TenHalf-v1.0.apk
cd public
zip TenHalf-v1.0.zip TenHalf-v1.0.apk
sha256sum TenHalf-v1.0.apk TenHalf-v1.0.zip
