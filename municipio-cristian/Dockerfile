FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3005 \
    DB_PATH=/data/municipio.db

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node server.js ./
RUN mkdir -p /data && chown -R node:node /app /data

USER node
EXPOSE 3005
VOLUME ["/data"]

CMD ["npm", "start"]
