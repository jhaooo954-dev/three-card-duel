#!/bin/sh
set -eu
SDK=/opt/android
BT="$SDK/build-tools/34.0.0"
JAR="$SDK/platforms/android-34/android.jar"
mkdir -p /tmp/dice-build/classes /tmp/dice-build/dex public
"$BT/aapt" package -f -M android/AndroidManifest.xml -S android/res -I "$JAR" -F /tmp/dice-build/unsigned.apk
javac -source 8 -target 8 -bootclasspath "$JAR" -d /tmp/dice-build/classes android/src/com/jh/diceduel/MainActivity.java
jar cf /tmp/dice-build/classes.jar -C /tmp/dice-build/classes .
"$BT/d8" --lib "$JAR" --min-api 26 --output /tmp/dice-build/dex /tmp/dice-build/classes.jar
zip -j /tmp/dice-build/unsigned.apk /tmp/dice-build/dex/classes.dex
"$BT/zipalign" -f 4 /tmp/dice-build/unsigned.apk /tmp/dice-build/aligned.apk
keytool -genkeypair -noprompt -keystore /tmp/dice-build/signing.jks -storepass android -keypass android -alias diceduel -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Dice Duel, O=Personal Games, C=CN"
"$BT/apksigner" sign --ks /tmp/dice-build/signing.jks --ks-pass pass:android --key-pass pass:android --out public/DiceDuel-v1.0.apk /tmp/dice-build/aligned.apk
"$BT/apksigner" verify --verbose public/DiceDuel-v1.0.apk
"$BT/aapt" dump badging public/DiceDuel-v1.0.apk
cd public
zip DiceDuel-v1.0.zip DiceDuel-v1.0.apk
sha256sum DiceDuel-v1.0.apk DiceDuel-v1.0.zip
