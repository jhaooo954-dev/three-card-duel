FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY shared ./shared
COPY public ./public
ENV PORT=3000
ENV DATA_DIR=/data
EXPOSE 3000
CMD ["node", "server.mjs"]
