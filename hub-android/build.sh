#!/bin/sh
set -eu
SDK=/opt/android
BT="$SDK/build-tools/34.0.0"
JAR="$SDK/platforms/android-34/android.jar"
mkdir -p /tmp/club-build/classes /tmp/club-build/dex /tmp/club-tests public
javac -encoding UTF-8 -source 8 -target 8 -d /tmp/club-tests hub-android/src/com/jh/friendgames/GameCatalog.java hub-android/tests/CatalogTest.java
java -cp /tmp/club-tests CatalogTest
"$BT/aapt" package -f -M hub-android/AndroidManifest.xml -S hub-android/res -I "$JAR" -F /tmp/club-build/unsigned.apk
javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$JAR" -d /tmp/club-build/classes hub-android/src/com/jh/friendgames/GameCatalog.java hub-android/src/com/jh/friendgames/MainActivity.java
jar cf /tmp/club-build/classes.jar -C /tmp/club-build/classes .
"$BT/d8" --lib "$JAR" --min-api 26 --output /tmp/club-build/dex /tmp/club-build/classes.jar
zip -j /tmp/club-build/unsigned.apk /tmp/club-build/dex/classes.dex
"$BT/zipalign" -f 4 /tmp/club-build/unsigned.apk /tmp/club-build/aligned.apk
keytool -genkeypair -noprompt -keystore /tmp/club-build/signing.jks -storepass android -keypass android -alias friendsclub -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Friends Games Club, O=Personal Games, C=CN"
"$BT/apksigner" sign --ks /tmp/club-build/signing.jks --ks-pass pass:android --key-pass pass:android --out public/FriendsClub-v1.0.apk /tmp/club-build/aligned.apk
"$BT/apksigner" verify --verbose public/FriendsClub-v1.0.apk
"$BT/aapt" dump badging public/FriendsClub-v1.0.apk
cd public
zip FriendsClub-v1.0.zip FriendsClub-v1.0.apk
sha256sum FriendsClub-v1.0.apk FriendsClub-v1.0.zip
