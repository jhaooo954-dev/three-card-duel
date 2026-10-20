# 双人十点半 v1.2
Android APK + server, independent package com.jh.tenhalf. Node 24, no runtime third-party dependencies.
https://ten-half-duel-jh.onrender.com ; /download.apk ; /download.zip .
Run node --test test.cjs ; node server.cjs . Docker builds the signed APK, verifies it, creates ZIP, runs engine/API/UI tests and serves both game and downloads.
Rules: 52 cards, A=1, 2–10 face value, J/Q/K=0.5. Threshold 10.5. First dealer is host. Keep the same dealer and the same 52-card shoe across small hands; rotate only when the shoe ends. If no cards remain during a hand, settle current hands automatically. If one card remains after a hand, it cannot provide two initial cards and is discarded before the next dealer shuffles a fresh shoe.
Dealer starts the round, each player receives one private hole card. Every later card is public. Both hole cards stay private during the guest's ordinary drawing phase. After the guest stands or completes drawing, the banker's hole card and total are public. If the guest has exact10.5 or five non-bust cards, the guest's hole card and total are also public immediately; otherwise the ordinary guest's hole card stays private until settlement. New hands reset both hole cards to private. Guest requests one card and dealer explicitly deals it. Guest can stop; banker then draws or stands. Guest bust ends round immediately. Guest exact10.5 or five non-bust cards ends guest turn and banker plays.
Banker bust loses. Banker exact10.5 or five non-bust cards wins with priority, including versus guest specials, per requested custom rule. Otherwise guest special wins, else compare points; equal points banker wins.
Base10; winner normal x1, exact10.5 x2, five non-bust x3. Five-card exact10.5 is x3 and multipliers do not compound. Totals computed using integer half-point units to avoid floating point errors. Scores are zero-sum, cumulative and retained after settlement. No money value.
Server shuffles a fresh deck only at the start of each shoe with crypto.randomInt Fisher-Yates. State is in memory with 12h idle expiry; restarts and deploys clear rooms. Requests carry round+revision+id for authorization, stale protection and deduplication. Future client rebuilds require a persistent signing key to support in-place upgrades; do not silently regenerate keys for releases.


## 双人游戏厅 Android v1.0
Unified native Android app, package com.jh.friendgames, label 双人游戏厅.
The home screen is native and available offline; three buttons open the latest existing games in one in-app WebView, with native 大厅 and Android back returning to the chooser.
- 炸金花: https://three-card-duel-jh.onrender.com
- 大话骰: https://dice-duel-jh.onrender.com
- 十点半: https://ten-half-duel-jh.onrender.com
Players choose the same game and use that game's room code. Game rules and backend/session isolation are retained; DOM storage stays separated by HTTPS origin. Returning home stops loading and clears the current page to about:blank without clearing persistent game sessions. Re-entering a game attempts to restore an unexpired room.
No Google Play services dependency, Android 8+, INTERNET permission only. Only the three allowed HTTPS hosts load inside the app; downloads and external HTTPS links open the system browser.
Downloads served at https://ten-half-duel-jh.onrender.com/club.apk and /club.zip . Existing single-game downloads remain at /download.apk and /download.zip, with signed bytes verified before preserving them.
Build validates catalog URL routing, original game tests, new download routes, all three live game pages, APK signatures and manifest. No emulator or two-device hardware tests are included.
