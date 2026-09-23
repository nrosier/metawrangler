# ── Stage 1: Install production dependencies ──────────────────────────────────
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN bun install --production

# ── Stage 2: Runtime — Alpine + mkvtoolnix + ffmpeg ───────────────────────────
FROM oven/bun:1.2-alpine

ARG GITHUB_SHA=unknown
LABEL org.opencontainers.image.revision="${GITHUB_SHA}"

# Install mkvtoolnix (mkvmerge + mkvpropedit) and ffmpeg from Alpine repos
RUN apk add --no-cache mkvtoolnix ffmpeg

# Create data directory owned by the 'bun' user (uid 1000 in oven/bun:alpine)
RUN mkdir -p /app/data /data && chown -R bun:bun /app/data /data

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun src ./src
COPY --chown=bun:bun package.json tsconfig.json ./

# Drop to non-root (bun user, uid 1000)
USER bun

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["bun", "run", "src/index.ts"]
