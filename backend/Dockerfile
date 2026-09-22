# ── Stage 1: Install production dependencies ──────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: Compile TypeScript ────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
# Install all deps (including dev) for the compile step
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npx tsc --outDir dist

# ── Stage 3: Runtime — Alpine + mkvtoolnix + ffmpeg ───────────────────────────
FROM node:22-alpine

ARG GITHUB_SHA=unknown
LABEL org.opencontainers.image.revision="${GITHUB_SHA}"

# Install mkvtoolnix (mkvmerge + mkvpropedit) and ffmpeg from Alpine repos
RUN apk add --no-cache mkvtoolnix ffmpeg

# Create data directory owned by the 'node' user (uid 1000 in node:alpine)
RUN mkdir -p /app/data && chown -R node:node /app/data

WORKDIR /app

# Copy compiled JS from build stage
COPY --from=build --chown=node:node /app/dist ./dist

# Copy production node_modules from deps stage
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# Drop to non-root (node user, uid 1000)
USER node

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/index.js"]
