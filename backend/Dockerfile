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

# ── Stage 3: Runtime — UBI9 minimal + mkvtoolnix + ffmpeg ─────────────────────
# IBM security policy: images from registry.redhat.io, non-root user.
FROM registry.redhat.io/ubi9/nodejs-22-minimal:latest

ARG GITHUB_SHA=unknown
LABEL org.opencontainers.image.revision="${GITHUB_SHA}"

USER root

# Install mkvtoolnix (mkvmerge + mkvpropedit) and ffmpeg.
# These are available in the EPEL/RPM Fusion repos for UBI9.
# In an air-gapped environment, replace with pre-approved RPMs.
RUN microdnf install -y --nodocs \
      mkvtoolnix \
      ffmpeg \
    && microdnf clean all \
    && rm -rf /var/cache/dnf

# Create data directory owned by uid 1001 (default non-root user in ubi-minimal)
RUN mkdir -p /app/data && chown -R 1001:0 /app/data

WORKDIR /app

# Copy compiled JS from build stage
COPY --from=build --chown=1001:0 /app/dist ./dist

# Copy production node_modules from deps stage
COPY --from=deps --chown=1001:0 /app/node_modules ./node_modules

# Drop to non-root
USER 1001

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/index.js"]
