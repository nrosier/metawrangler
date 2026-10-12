# ── Stage 1: Install production dependencies ──────────────────────────────────
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
# When context=root, copy root lock file + backend workspace
COPY package.json package-lock.json ./
COPY backend/package.json backend/bun.lock* ./backend/
# Install using bun
RUN bun install --frozen-lockfile --production

# ── Stage 2: Runtime — Alpine + mkvtoolnix + ffmpeg ───────────────────────────
FROM oven/bun:1.4-alpine

ARG GITHUB_SHA=unknown
LABEL org.opencontainers.image.revision="${GITHUB_SHA}"

# Install mkvtoolnix (mkvmerge + mkvpropedit) and ffmpeg from Alpine repos.
RUN apk update \
    && apk upgrade --no-cache \
    && apk add --no-cache mkvtoolnix ffmpeg \
    && which mkvmerge mkvpropedit ffprobe \
    && mkvmerge --version \
    && ffprobe -version 2>&1 | head -1 \
    && mkvpropedit --version

# Create data directory owned by the 'bun' user (uid 1000 in oven/bun:alpine)
RUN mkdir -p /app/data && chown -R bun:bun /app/data

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=deps --chown=bun:bun /app/backend/node_modules ./backend/node_modules

# Copy source — Bun runs TypeScript natively, no compile step needed
COPY --chown=bun:bun backend/src ./backend/src
COPY --chown=bun:bun backend/package.json backend/tsconfig.json ./backend/

# Drop to non-root (bun user, uid 1000)
USER bun

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

WORKDIR /app/backend
CMD ["bun", "run", "src/index.ts"]
