FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=deploy /docker/frontend/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=deploy /docker/frontend/40-tpv-config.sh /docker-entrypoint.d/40-tpv-config.sh
RUN chmod +x /docker-entrypoint.d/40-tpv-config.sh
EXPOSE 8080
