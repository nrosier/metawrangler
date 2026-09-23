# ── Stage 1: Build the React app ─────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx (Alpine) ───────────────────────────────────────
FROM nginx:1.27-alpine

ARG GITHUB_SHA=unknown
LABEL org.opencontainers.image.revision="${GITHUB_SHA}"

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

RUN chown -R nginx:nginx /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
