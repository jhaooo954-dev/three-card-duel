FROM node:24-bookworm-slim AS tested
WORKDIR /app
COPY engine.cjs server.cjs club-server.cjs club-assets.cjs test.cjs club-test.cjs hub-test.cjs landlord-test.cjs deluxe-test.cjs practice-test.cjs preserve-apk.cjs ./
COPY club-engines ./club-engines
COPY public ./public
RUN node --check public/club/app.js && node --check public/table-dealer.js && node --check public/club/preferences.js && node --test test.cjs club-test.cjs hub-test.cjs landlord-test.cjs deluxe-test.cjs practice-test.cjs
RUN node preserve-apk.cjs
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=tested /app ./
USER node
EXPOSE 10000
CMD ["node","server.cjs"]
