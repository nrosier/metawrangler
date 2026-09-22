# ── Stage 1: Build the React app ─────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx (UBI9 minimal) ─────────────────────────────────
FROM registry.redhat.io/ubi9/nginx-122:latest

USER root
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# nginx-122 runs as uid 1001 by default on UBI9
RUN chown -R 1001:0 /usr/share/nginx/html /var/log/nginx /var/cache/nginx

USER 1001

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
