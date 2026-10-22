FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
RUN mkdir -p /app/data

ENV PORT=3003
ENV DB_PATH=/app/data/db.json

EXPOSE 3003
CMD ["npm", "start"]
