# --- Etapa de build ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Etapa final (imagen liviana, sin devDependencies) ---
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY public ./public

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]
