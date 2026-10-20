FROM node:24-bookworm-slim AS tested
WORKDIR /app
COPY engine.cjs server.cjs test.cjs preserve-apk.cjs ./
COPY public ./public
RUN node --check public/app.js && node --test test.cjs
RUN node preserve-apk.cjs
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=tested /app ./
USER node
EXPOSE 10000
CMD ["node","server.cjs"]
