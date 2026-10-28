FROM eclipse-temurin:17-jdk-jammy AS android
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip zip && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /opt/android/cmdline-tools && curl -fSL --retry 3 https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o /tmp/sdk.zip && unzip -q /tmp/sdk.zip -d /tmp/sdk && mv /tmp/sdk/cmdline-tools /opt/android/cmdline-tools/latest && rm /tmp/sdk.zip
RUN yes | /opt/android/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android --licenses >/dev/null
RUN /opt/android/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android "platforms;android-34" "build-tools;34.0.0"
WORKDIR /src
COPY hub-android ./hub-android
RUN sh hub-android/build.sh
FROM node:24-bookworm-slim AS tested
WORKDIR /app
COPY engine.cjs server.cjs club-server.cjs test.cjs club-test.cjs hub-test.cjs preserve-apk.cjs ./
COPY club-engines ./club-engines
COPY public ./public
RUN node --check public/club/app.js && node --check public/club-games/gomoku/app.js && node --check public/table-dealer.js && node --test test.cjs club-test.cjs hub-test.cjs
RUN node preserve-apk.cjs
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=tested /app ./
COPY --from=android /src/public/FriendsClub-v2.0.apk /src/public/FriendsClub-v2.0.zip ./public/
USER node
EXPOSE 10000
CMD ["node","server.cjs"]
