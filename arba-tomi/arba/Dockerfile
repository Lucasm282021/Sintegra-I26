FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src

ENV PORT=3003
ENV DB_PATH=/data/arba.db
RUN mkdir -p /data

EXPOSE 3003

CMD ["npm", "start"]
