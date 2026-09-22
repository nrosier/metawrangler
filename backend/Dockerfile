# ── Stage 1: Install Node dependencies ────────────────────────────────────────
# Using a Node Alpine image to install deps, then copy into minimal UBI9 base.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: Runtime — UBI9 minimal + mkvtoolnix + ffmpeg ─────────────────────
# IBM security policy: images from registry.redhat.io, non-root user, no root runtime.
FROM registry.redhat.io/ubi9/nodejs-22-minimal:latest

# Install mkvtoolnix (provides mkvmerge + mkvpropedit) and ffmpeg
# UBI9 doesn't ship ffmpeg in standard repos; we add RPM Fusion via the UBI9 compat repo.
# In a locked-down enterprise environment, replace these with pre-approved RPMs.
USER root
RUN microdnf install -y --nodocs \
      mkvtoolnix \
      ffmpeg \
    && microdnf clean all \
    && rm -rf /var/cache/dnf

# Create non-root application user (uid 1001 is already provided by ubi-minimal)
RUN mkdir -p /app/data && chown 1001:0 /app/data

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps --chown=1001:0 /app/node_modules ./node_modules

# Copy application source
COPY --chown=1001:0 . .

# Drop to non-root
USER 1001

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "src/index.ts"]
