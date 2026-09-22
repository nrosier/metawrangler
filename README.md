# MetaWrangler

MKV metadata editor — bulk-edit Matroska file metadata via a web UI.  
Auth is handled by [Authentik](https://goauthentik.io/) via Caddy forward-auth.

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
| Backend | Bun + Hono + TypeScript |
| Database | SQLite (via Drizzle ORM) |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| MKV read | `mkvmerge -J` + `ffprobe` (fallback) |
| MKV write | `mkvpropedit` (bundled in container) |
| Auth | Authentik forward-auth via Caddy |
| Container base | `registry.redhat.io/ubi9/nodejs-22-minimal` |

## Quick Start

### 1. Configure mounts

Edit `docker-compose.yml` and add your media volumes under `backend.volumes`:

```yaml
volumes:
  - /your/nas/movies:/media/movies   # read-write for editing
  - /your/nas/series:/media/series
```

### 2. Configure Caddy + Authentik

Edit `proxy/Caddyfile`:
- Replace `metawrangler.example.com` with your domain
- Replace `authentik:9000` with your Authentik outpost address

### 3. Start

```bash
docker compose up -d
```

### 4. Add mounts in the UI

Open the app → **Settings** → **Add mount** — register the container paths you mounted above.

## Security

- Authentik forward-auth: all requests validated before reaching the app
- Path traversal protection: every file operation is checked against registered mounts
- `mkvpropedit` called via `execFile` (not shell `exec`) — no injection risk
- SQLite WAL mode, foreign keys enforced
- Non-root container execution (uid 1001)
- TLS enforced by Caddy (HTTPS only)
- Structured logging via Pino — sensitive fields auto-redacted
- CSP + security headers on all responses
- Audit log is append-only — no entries are ever deleted

## Development

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

The Vite dev server proxies `/api` and `/ws` to `localhost:3001`.

## Undo

Every successful edit job stores a full `mkvmerge -J` snapshot of the original  
metadata. Click **Undo** on any completed job to restore all files to their  
pre-edit state. Undo itself creates a new job (also undoable).
