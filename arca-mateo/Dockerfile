FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY public ./public
ENV PORT=3004
EXPOSE 3004
VOLUME ["/app/data"]
CMD ["npm", "start"]
