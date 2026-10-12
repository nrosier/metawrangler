# MetaWrangler

MKV metadata editor — bulk-edit Matroska file metadata via a web UI.  
Designed to drop into an existing **Traefik + Authentik + DockFlare** homelab stack.

## Features

- Browse configured mounts (Movies / Series)
- Scan `.mkv` files and inspect all track metadata
- Bulk-edit: File Title, Track Language (ISO 639-2 / BCP 47), Track Name, Default/Enabled/Forced flags
- Dry-run mode: preview changes without writing
- Undo: restore a completed (or partially-successful) job's successfully-edited files to their pre-edit state — see [Undo](#undo) below for its real, current limits
- Live job progress via WebSocket
- Per-file results with exact error output from `mkvpropedit`
- Track conflict detection: warns before applying ops to non-existent tracks
- Audit log: every scan, edit, undo, and mount change is recorded
- All edits use `mkvpropedit` — header-only rewrite, no re-encoding

## Stack

| Layer | Technology |
|---|---|
| Backend | Bun + Hono + TypeScript (runs `src/*.ts` directly, no compile step) |
| Database | SQLite via `bun:sqlite` + Drizzle ORM |
| Frontend | React 19 + TypeScript + Vite, hand-written CSS (no Tailwind/CSS framework) |
| Reverse proxy | Traefik (external, existing stack) |
| Auth | Authentik forward-auth via Traefik middleware |
| MKV read | `mkvmerge -J` + `ffprobe` (fallback) |
| MKV write | `mkvpropedit` (bundled in backend container) |
| Container base | `oven/bun:1.4-alpine` (backend) · `nginx:1.31-alpine` (frontend) |

## Architecture

```
Cloudflare Tunnel → Traefik → Authentik (forward-auth)
                           ↓
              metawrangler-frontend :8080  (Nginx)
                     /api/* and /ws/*
                           ↓
              metawrangler-backend  :3001  (Hono)
                           ↓
                 /media/movies, /media/series
```

Traefik handles TLS and injects `X-authentik-uid` / `X-authentik-email` headers.  
Nginx in the frontend container proxies `/api/*` and `/ws/*` to the backend.  
The backend rejects any request missing those headers (401), so it's unusable without Authentik in front.

## Quick Start

### 1. Configure your media volumes

Edit `docker-compose.yml` and add bind mounts under `backend.volumes`:

```yaml
volumes:
  - metawrangler-data:/data
  - /your/nas/movies:/media/movies
  - /your/nas/series:/media/series
```

### 2. Set your domain

Update the Traefik hostname labels in `docker-compose.yml`:

```yaml
traefik.http.routers.metawrangler.rule: Host(`metawrangler.yourdomain.com`)
cloudflare.tunnel.hostname: metawrangler.yourdomain.com
cloudflare.tunnel.service: http://metawrangler-frontend:8080
```

### 3. Create a `.env` file

```bash
ALLOWED_ORIGIN=https://metawrangler.yourdomain.com
AUTHENTIK_HEADER_UID=x-authentik-uid
AUTHENTIK_HEADER_EMAIL=x-authentik-email
LOG_LEVEL=info
```

### 4. Deploy

```bash
docker compose pull && docker compose up -d
```

### 5. Add mounts in the UI

Open the app → **Settings** → **Add mount** — register the container paths you mounted in step 1.

## Security

- **Authentik forward-auth**: all requests validated by Traefik before reaching the app
- **Path traversal protection**: every file operation checked against registered mounts
- **No shell injection**: `mkvpropedit` called via `execFile`, never shell `exec`
- **Read-only containers**: everything writable lives in the named volume or tmpfs
- **Non-root execution**: uid 1001 in both containers
- **`cap_drop: ALL`**: no Linux capabilities beyond the minimum
- **Undo snapshots**: full `mkvmerge -J` JSON stored before every write
- **Append-only audit log**: no update/delete endpoints on `audit_log`
- **Structured logging** via Pino — sensitive fields auto-redacted
- **Alpine base images** (`oven/bun:1.4-alpine`, `nginx:1.31-alpine`) — non-root, minimal attack surface

## Development

```bash
# Backend (runs on :3001)
cd backend && npm install && npm run dev

# Frontend (runs on :5173, proxies /api and /ws to :3001)
cd frontend && npm install && npm run dev
```

## Releasing

Tag a commit to publish to Docker Hub:

```bash
git tag v1.0.0 && git push --tags
```

This builds and pushes `niqck/metawrangler-backend` and `niqck/metawrangler-frontend`  
with tags `1.0.0`, `1.0`, `1`, and `latest`.

## Undo

Every edit job stores a normalized before-snapshot (title + per-track language/name/flags, including
fields that were *absent* before the edit) for each file it successfully changes. Click **Undo** on
any `done` or `partial` job to restore those files to their pre-edit state; undo jobs themselves store
their own before-snapshot too, so an undo job can itself be undone.

Real limits, not guarantees beyond what the implementation can back up:

- Only files whose own edit **succeeded** are undoable — `failed` and `skipped` files in the original
  job have no snapshot to restore from, and are silently skipped by Undo (not currently called out
  per-file in the UI before you click it).
- Snapshots created before the current snapshot schema (schema version 2) fall back to a legacy,
  set-only restore path: it can reproduce values but can't *remove* a field that didn't exist
  originally, and if the stored shape can't be converted into restore operations at all, that file
  is marked `skipped` with an explanation rather than silently left unchanged or incorrectly "restored".
