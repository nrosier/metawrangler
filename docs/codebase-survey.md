# MetaWrangler — Codebase Survey

Research pass over the existing implementation (built by IBM BOB from the original spec), done ahead of a modernization proposal. Findings only — no design opinions.

## 1. Overall structure

Monorepo with a clean frontend/backend split, but no workspace tooling (no npm/pnpm workspaces, no Turborepo/Nx) — the two projects are independent and glued together only by `docker-compose.yml` and hand-mirrored types.

Top level: `docker-compose.yml`, `.env.example`, `README.md`, `renovate.json`, `.github/workflows/{ci,docker}.yml`, `backend/`, `frontend/`.

```
backend/src/
  index.ts                 entry point
  db/{index.ts,schema.ts}  Drizzle + bun:sqlite, inline migrations
  lib/{auth.ts,logger.ts,pathSecurity.ts} + __tests__/
  routes/{mounts,scan,jobs,audit,ws}.ts
  services/{scanner,editor,jobRunner,audit}.ts + __tests__/
  types/index.ts

frontend/src/
  App.tsx, main.tsx, index.css
  components/{Sidebar,StatusBadge,TrackList}.tsx
  hooks/useJobSocket.ts
  lib/{api.ts,utils.ts}
  pages/{Browse,BulkEdit,Jobs,JobDetail,Settings,AuditLog}.tsx
  types/index.ts
```

`backend/dist/` exists locally but is git-ignored — a stray build artifact, not part of the repo.

## 2. Backend

- **Runtime**: TypeScript on **Bun** (not Node — the README's stack table is stale, see §11). `backend/package.json`: `bun run --watch src/index.ts`. `backend/Dockerfile`: `FROM oven/bun:1.4-alpine`, runs `src/index.ts` directly, no compile step.
- **Framework**: Hono (`hono`, `@hono/zod-validator`, `hono/bun`, `hono/secure-headers`, `hono/cors`). `Bun.serve(...)` in `backend/src/index.ts:91-100`, binds `0.0.0.0` (fixed in `99aeff9`).
- **DB driver**: `bun:sqlite` + `drizzle-orm/bun-sqlite` (switched from `better-sqlite3` in `4f6aa4f`).
- **Logging**: Pino, structured JSON, redacts sensitive fields.
- **Validation**: Zod.
- **MKV scanning** (`backend/src/services/scanner.ts`): shells out via `execFile` (never `exec` — no shell-injection risk).
  - Primary: `mkvmerge -J <file>` → JSON (`scanFile()`, ~line 96).
  - Fallback: `ffprobe -v quiet -print_format json -show_streams -show_format <file>` (`scanFileWithFfprobe()`, ~line 170).
  - `walkMkvFiles()` recursively walks a directory (sync `readdirSync`/`statSync`).
  - `isValidMkv()` checks the EBML magic bytes (`0x1A 0x45 0xDF 0xA3`) before any write.
  - `checkToolchain()` startup gate verifies `mkvmerge --version`, `mkvpropedit --version`, `ffprobe -version` — the double/single-dash mismatch for ffprobe was the bug fixed in `3f7d433`.
- **Editing** (`backend/src/services/editor.ts`): `buildMkvpropeditArgs()` (pure) builds the arg list, `runMkvpropedit()` executes via `execFile`. Supports dry-run. Header-only edits, no re-encoding. No metadata-parsing library — 100% CLI-tool-driven (mkvtoolnix + ffmpeg, bundled into the Alpine image via `apk add`).
- **Job orchestration** (`backend/src/services/jobRunner.ts`): in-process, sequential, `EventEmitter`-based (no queue/worker library). Persists per-file status to SQLite, streams events over WebSocket. Implements **undo** by replaying a stored `mkvmerge -J` snapshot back through `mkvpropedit` (`buildRestoreArgs()`).

## 3. Frontend

- React 18 + TypeScript + Vite 6 (`tsc && vite build`).
- Routing: `react-router-dom` v7 — `/`, `/bulk-edit`, `/jobs`, `/jobs/:id`, `/settings`, `/audit`.
- UI: no component library (no shadcn/MUI) — hand-rolled Tailwind v3 + `lucide-react` icons + `sonner` toasts + `clsx`/`tailwind-merge`.
- State: `@tanstack/react-query` v5 for all server state; plain `useState` for local UI state (selection sets, forms). No Redux/Zustand.
- Backend communication: REST via a thin `fetch` wrapper (`frontend/src/lib/api.ts`, `credentials: "include"`, `/api/*`); WebSocket for live job progress (`frontend/src/hooks/useJobSocket.ts`, `wss?://<host>/ws/jobs/:id`, `job_update`/`file_update`/`job_complete`/`error` messages merged into React Query cache).
- **Likely-unused dependencies**: `react-hook-form` + `@hookform/resolvers` (forms actually use plain `useState`); `@tanstack/react-table` (tables are hand-written `<table>` markup). Worth a full grep before removing but they look like scaffold leftovers.

## 4. Mountpoints / movies vs series

Modeled as a **DB table**, not env vars: `mounts` (`id`, `name`, `path`, `type: "movies"|"series"`, timestamps, `UNIQUE(path)`) in `backend/src/db/schema.ts`. CRUD via `backend/src/routes/mounts.ts`, managed through `frontend/src/pages/Settings.tsx`.

- `GET /api/mounts` also computes live, **uncached** health info (`reachable`, `writable`, `mkvCount`) by walking the filesystem on every request (`mounts.ts:30-55`) — a perf concern for large libraries.
- Container bind-mount paths come from `docker-compose.yml`; the in-app Settings UI then registers those container-visible paths.
- Path-traversal protection exists (`backend/src/lib/pathSecurity.ts`: `assertSafePath()`/`assertWithinBase()`), but `routes/scan.ts` (`POST /api/scan/file`, line ~76) re-implements the same check inline with a hardcoded `startsWith(m.path + "/")` instead of reusing the shared helper — two slightly different implementations of the same security check.

## 5. Database

SQLite via `bun:sqlite` + Drizzle. File at `${DATA_DIR}/metawrangler.db` (default `/app/data`, backed by the `metawrangler-data` named volume). WAL mode enabled.

- No versioned migrations: `runMigrations()` runs inline `CREATE TABLE IF NOT EXISTS` SQL, even though `drizzle-kit` is a devDependency (no `drizzle.config.ts`, no `migrations/` folder). Schema evolution has no `ALTER TABLE` story.
- Persisted: `mounts`, `jobs`, `job_files` (`changes_summary`, `snapshot_before`, `error_message`, `exit_code`), `audit_log` (append-only).
- Not persisted: file listings and scanned metadata — every Browse-page load and mount health check re-walks the filesystem and re-shells to mkvmerge/ffprobe live. Only the per-job `snapshotBefore` is stored, for undo.

## 6. Docker setup

Two services in `docker-compose.yml`:

- **backend**: `read_only: true` root FS, `tmpfs:/tmp`, `cap_drop: ALL`, `no-new-privileges`, only on the `internal` network (never `proxy`), volume `metawrangler-data:/data`; media bind-mounts are left commented-out for the user to fill in.
- **frontend**: also `read_only: true`, tmpfs for `/tmp`, `/var/cache/nginx`, `/var/run`; `cap_drop: ALL` + `cap_add: NET_BIND_SERVICE`; on both `proxy` and `internal` — the only container reachable from outside.
- Nginx (`frontend/nginx.conf`) proxies `/api/*` and `/ws/*` to `http://metawrangler-backend:3001` via a lazily-resolved `$backend` variable + Docker's embedded DNS (`127.0.0.11`) — added in `5d940fb` to fix a startup-order crash.
- **Auth**: this compose file does not itself integrate Authentik — it assumes an **external** Traefik + Authentik stack (labels reference `authentik@file` middleware) plus a Cloudflare Tunnel ("DockFlare" labels). The backend's `authMiddleware` (`backend/src/lib/auth.ts`) only checks for `x-authentik-uid`/`x-authentik-email` headers (names configurable via env) and 401s if absent — it fully trusts whatever sits in front of it; there is no token/session validation inside the app.
- Both Dockerfiles are multi-stage, non-root, with `HEALTHCHECK`s.

## 7. Bulk-edit / multi-select UI

Already exists and is reasonably complete, not a stub:

- **Selection** (`frontend/src/pages/Browse.tsx`): checkbox column, tri-state "select all", per-row `Set<string>` selection, filter/search box, expandable rows lazy-loading per-file tracks (`TrackList`). An "Edit N files" button appears once ≥1 file is selected and navigates to `/bulk-edit`, passing `filePaths` via router state.
- **Bulk edit form** (`frontend/src/pages/BulkEdit.tsx`): add multiple `EditOperation`s (field: title / trackLanguage / trackLanguageIETF / trackName / 3 boolean flags; per-op track-type + index, or "all tracks of type"); client-side conflict warnings (fetches metadata for up to 100 selected files); dry-run toggle; submits to `POST /api/jobs`.

## 8. Error handling / per-file results

Exists and is fairly well-built, not missing:

- `job_files` table stores `status` (`pending|running|success|failed|skipped`), `error_message`, `exit_code`, `changes_summary` per file. `jobRunner.ts` populates these as it goes and streams updates over WebSocket.
- `frontend/src/pages/JobDetail.tsx` renders a per-file table with status icon/badge, an expandable row with raw `mkvpropedit` stderr + exit code on failure, a before→after diff, and track-conflict warnings.

**Gaps found:**
- Job-level status is muddled: `jobRunner.ts:169-179` computes `finalStatus = allFailed ? "failed" : anyFailed ? "done" : "done"` — a job with some failed and some successful files is marked `"done"`, indistinguishable from a fully-successful job at the job level. No "partially failed" status, no top-of-page summary banner ("3 of 10 files failed").
- `undoJob()` silently skips files with no `snapshotBefore` or whose original status wasn't `"success"` (`jobRunner.ts:210-216`), with no UI indication of which files won't be undoable before the user clicks Undo.

## 9. Tests

Backend only — vitest, no frontend tests at all (no Vitest/Jest/RTL config in `frontend/package.json`):

- `backend/src/lib/__tests__/pathSecurity.test.ts` (64 lines) — real exported functions.
- `backend/src/lib/__tests__/auth.test.ts` (88 lines) — real `authMiddleware` against a Hono app.
- `backend/src/services/__tests__/scanner.test.ts` (143 lines) — real `isValidMkv`/`walkMkvFiles` against real temp files.
- `backend/src/services/__tests__/editor.test.ts` (159 lines) — real `buildMkvpropeditArgs`.
- `backend/src/services/__tests__/jobRunner.test.ts` (234 lines) — **does not test the real module**. The file's own header admits it re-implements `detectConflicts`/`buildChangesSummary` (private/unexported in `jobRunner.ts`) as copies inside the test file, then tests the copies. Zero coverage guarantee on the real logic — it would keep passing even if the real functions diverged during a refactor.

No tests for `routes/*.ts` (the actual HTTP surface), no DB-migration tests, no integration/e2e tests. CI (`ci.yml`) runs backend `vitest run` + typecheck/lint/`npm audit` on both projects + a `gitleaks` scan. `docker.yml` builds images, runs a smoke test (health endpoint + security headers), runs Trivy, and pushes on tag.

## 10. Git history — what kept breaking

Young repo, 20 commits. Last 5, examined in detail:

1. **`99aeff9`** — backend bound to `127.0.0.1`, unreachable from the nginx sidecar on the internal network → `0.0.0.0`.
2. **`fb54dcf`** — `bun.lock` not regenerated after adding `@types/node`/`@types/bun`, so `bun install --frozen-lockfile` failed in CI/Docker.
3. **`5d940fb`** — three simultaneous frontend crashes: nginx creating temp dirs under a read-only root (fixed by pointing `*_temp_path` at the tmpfs), nginx resolving the backend hostname at config-parse time before the backend container existed (fixed with `resolver 127.0.0.11` + lazy `$backend` variable), and `error_log` writing to a read-only path (redirected to `/dev/stderr`). Bundled with a backend `tsconfig.json` fix needed after the `better-sqlite3` removal.
4. **`3f7d433`** — `ffprobe` only accepts `-version` (single dash), not `--version`; the toolchain check used the wrong flag and false-negatived on startup.
5. **`822a317`** — a failed build (bun install crash mid `apk add`) got cached by GitHub Actions as a "successful" layer, so later builds silently shipped images missing mkvmerge/mkvpropedit/ffprobe. Fixed by merging `apk add` + `which` + `--version` checks into one atomic `RUN` (fail fast) and bumping the cache scope to force a clean rebuild.

**Pattern**: nearly every fix commit is a runtime/infra integration bug (wrong bind address, wrong CLI flag, read-only-FS assumptions, DNS timing, lockfile drift, cache poisoning, wrong base runtime entirely — Node→Bun in `3385c68`/`4f6aa4f`) — not application-logic bugs. The core metadata-editing logic (scanner/editor/jobRunner/pathSecurity, the parts with real unit tests) has had no fix commits since the initial commit. The app was assembled from a spec without ever being run end-to-end in its actual target environment (rootless/read-only Docker + Bun + Alpine + an internal-only backend network).

## 11. Docs and staleness

Only doc file is the root `README.md` (~140 lines) — no prior `/docs`, no ADRs, no in-repo copy of the original spec.

Known-stale content:
- README's "Stack" table still says `Node 22 + Hono` / `node:22-alpine`; actual runtime is Bun (`oven/bun:1.4-alpine`).
- Comments reference **Caddy** (an earlier reverse-proxy choice, replaced by Traefik in `fbc1b04`) in some places but not others: `backend/src/routes/ws.ts:20` says Traefik, but `backend/src/lib/auth.ts:2` and `backend/src/index.ts:68` still say Caddy. `frontend/src/lib/api.ts:3` still says Caddy proxies `/api/*`, but it's nginx now.
- `frontend/src/types/index.ts:1-4` self-documents as a manual mirror of `backend/src/types/index.ts` ("keep in sync manually or replace with a shared package") — acknowledged tech debt, no shared-types package exists.

## Reference: key files

| Area | Path |
|---|---|
| Entry/runtime | `backend/src/index.ts`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml` |
| MKV logic | `backend/src/services/scanner.ts`, `backend/src/services/editor.ts`, `backend/src/services/jobRunner.ts` |
| DB | `backend/src/db/schema.ts`, `backend/src/db/index.ts` |
| Auth/security | `backend/src/lib/auth.ts`, `backend/src/lib/pathSecurity.ts` |
| Routes | `backend/src/routes/{mounts,scan,jobs,audit,ws}.ts` |
| Bulk-edit UI | `frontend/src/pages/Browse.tsx`, `frontend/src/pages/BulkEdit.tsx`, `frontend/src/pages/JobDetail.tsx` |
| Duplicated types | `backend/src/types/index.ts` vs `frontend/src/types/index.ts` |
| Tests | `backend/src/**/__tests__/*.test.ts` (note: `jobRunner.test.ts` tests copied logic, not the real module) |
| CI/CD | `.github/workflows/{ci,docker}.yml` |
