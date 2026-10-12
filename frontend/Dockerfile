# ── Stage 1: Build the React app ─────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
# When context=root, copy root lock file + frontend workspace
COPY package.json package-lock.json ./
COPY frontend ./frontend
# Install workspace dependencies
RUN npm ci --workspace=metawrangler-frontend
# Build frontend
WORKDIR /app/frontend
RUN npm run build

# ── Stage 2: Serve with Nginx (Alpine) ───────────────────────────────────────
FROM nginx:1.31-alpine

ARG GITHUB_SHA=unknown
LABEL org.opencontainers.image.revision="${GITHUB_SHA}"

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# apk upgrade: picks up patched packages (openssl, libxml2, zlib, etc.) not
# yet baked into the base image tag's cached layer.
RUN apk update \
    && apk upgrade --no-cache \
    && chown -R nginx:nginx /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
