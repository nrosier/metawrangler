# MetaWrangler

MKV metadata editor — bulk-edit Matroska file metadata via a web UI.  
Designed to drop into an existing **Traefik + Authentik + DockFlare** homelab stack.

## Features

- Browse configured mounts (Movies / Series)
- Scan `.mkv` files and inspect all track metadata
- Bulk-edit: File Title, Track Language (ISO 639-2 / BCP 47), Track Name, Default/Enabled/Forced flags
- Dry-run mode: preview changes without writing
- Undo: restore any completed job's files to their pre-edit state
- Live job progress via WebSocket
- Per-file results with exact error output from `mkvpropedit`
- Track conflict detection: warns before applying ops to non-existent tracks
- Audit log: every scan, edit, undo, and mount change is recorded
- All edits use `mkvpropedit` — header-only rewrite, no re-encoding

## Stack

| Layer | Technology |
|---|---|
| Backend | Node 22 + Hono + TypeScript |
| Database | SQLite (via Drizzle ORM) |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Reverse proxy | Traefik (external, existing stack) |
| Auth | Authentik forward-auth via Traefik middleware |
| MKV read | `mkvmerge -J` + `ffprobe` (fallback) |
| MKV write | `mkvpropedit` (bundled in backend container) |
| Container base | `registry.redhat.io/ubi9/nodejs-22-minimal` |

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
- **UBI9 base images** from `registry.redhat.io`

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

Every successful edit job stores a full `mkvmerge -J` snapshot of the original metadata.  
Click **Undo** on any completed job to restore all files to their pre-edit state.  
Undo itself creates a new job (which is also undoable).
