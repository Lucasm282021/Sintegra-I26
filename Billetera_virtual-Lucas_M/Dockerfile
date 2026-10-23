FROM node:24-alpine

WORKDIR /app

ENV PORT=3006 DB_PATH=/data/billetera.db

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY public ./public

RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 3006
VOLUME ["/data"]

CMD ["npm", "start"]
