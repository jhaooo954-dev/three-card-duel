# Android 1.1

Native Android WebView client. Local UI and default server `https://three-card-duel-jh.onrender.com`. Same five game rules as the server.

Run `node tests/peer.test.cjs` for simulated fallback transport verification. No device emulator is bundled. Build using `python build.py --tools PATH --android-jar PATH --ecj PATH --output ThreeCard-Android-v1.1.apk`. The original signing key is held privately and must be placed under `private/` to produce an in-place update. Signing keys and built APKs are intentionally excluded from Git.

Offline practice retains the original classic practice rules; the updated rules apply to online rooms and fallback direct matches.
