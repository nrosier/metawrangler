# Dependency Map & Ownership

This document visualizes the data flow, service boundaries, and dependency ownership for MetaWrangler.

**Last verified:** 2026-10-12 (commit 4162645)  
**Scope:** Docker-based deployment with Traefik, Authentik, NAS storage

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet / HTTPS                        │
└────────────────┬────────────────────────────────────────────────┘
                 │
        ┌────────▼─────────┐
        │  Traefik Proxy   │ ← Terminates TLS, routes, auth check
        │   (443 / 80)     │
        └────────┬─────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Frontend │ │ Authentik│ │ Internal │
│  nginx   │ │  (auth)  │ │ network  │
│  :8080   │ │          │ │ only     │
└──────────┘ └──────────┘ └──────────┘
    │                          │
    │  /api/* & /ws/*         │
    └──────────┬──────────────┘
               │
        ┌──────▼──────┐
        │   Backend   │ ← Bun + Hono + SQLite + mkvtoolnix
        │   :3001     │
        └──────┬──────┘
               │
    ┌──────────┼──────────┐
    │          │          │
    ▼          ▼          ▼
┌─────────┐ ┌────────┐ ┌──────────┐
│ SQLite  │ │ Mounts │ │mkvmerge/ │
│  .db    │ │(NAS)   │ │ ffprobe  │
└─────────┘ └────────┘ └──────────┘
```

---

## 📦 Dependency Graph

### Frontend Dependencies

```
frontend/
├── package.json
│   ├── Runtime:
│   │   ├── react@19           ← UI framework
│   │   ├── react-router@6     ← Client routing
│   │   ├── @tanstack/react-query@5 ← Data fetching & caching
│   │   ├── sonner             ← Toast notifications
│   │   └── clsx               ← Class name utilities
│   │
│   └── Dev:
│       ├── typescript@5        ← Type checking
│       ├── vite               ← Build tool
│       ├── eslint             ← Linting (shared config)
│       └── @types/*           ← Type definitions
│
├── src/
│   ├── i18n/                  ← Localization (NEW in #48)
│   │   ├── messages.ts        ← en/es catalogs
│   │   └── LocaleContext.tsx  ← useLocale hook
│   │
│   ├── pages/                 ← Route pages
│   │   ├── Browse.tsx         ← [UX-01] keyboard nav fixed
│   │   ├── BulkEdit.tsx       ← Edit form
│   │   ├── JobDetail.tsx      ← [UX-01] progress bar a11y
│   │   ├── Jobs.tsx           ← [UX-01] table scope
│   │   ├── Settings.tsx       ← [UX-01] label htmlFor
│   │   └── AuditLog.tsx       ← [UX-01] table scope
│   │
│   ├── shell/                 ← Layout & theme
│   │   ├── AppShell.tsx       ← Main frame
│   │   ├── LocaleToggle.tsx   ← [NEW] language selector
│   │   └── ThemeToggle.tsx    ← Dark mode toggle
│   │
│   ├── hooks/
│   │   ├── useJobSocket.ts    ← WebSocket listener [ARCH-02 bug]
│   │   └── useQuery          ← From @tanstack/react-query
│   │
│   ├── lib/
│   │   ├── api.ts             ← HTTP client (fetch wrapper)
│   │   └── utils.ts           ← formatPath, formatDate, etc.
│   │
│   └── theme/                 ← Styling
│       ├── ThemeContext.tsx   ← Dark/light mode
│       └── *.css              ← Hand-written CSS (not Tailwind)
│
└── public/
    └── index.html             ← Entry point (no CSP before SEC-04 fix)
```

**Type Safety:**
- `frontend/src/types/index.ts` — mirrors backend types (manual sync)
- Shared in `backend/src/shared/index.ts` (NEW in #45)

---

### Backend Dependencies

```
backend/
├── package.json
│   ├── Runtime:
│   │   ├── hono@4              ← HTTP server
│   │   ├── drizzle-orm         ← ORM for SQLite
│   │   ├── zod                 ← Schema validation [used in #47 fix]
│   │   ├── uuid@14             ← ID generation
│   │   └── pino                ← Structured logging
│   │
│   └── Dev:
│       ├── bun                 ← Runtime (bunx, not installed)
│       ├── vitest              ← Test runner [#51 added coverage]
│       ├── typescript           ← Type checking
│       ├── drizzle-kit         ← Migration generator (installed, not used)
│       └── @types/*            ← Type definitions
│
├── src/
│   ├── db/
│   │   ├── index.ts            ← Database init & migrations [#46]
│   │   ├── schema.ts           ← Drizzle schema definition
│   │   └── drizzle/            ← Versioned migrations [#46]
│   │       ├── 0001_initial_schema.sql
│   │       ├── 0002_add_operations_column.sql
│   │       └── 0003_add_retention_columns.sql [#40]
│   │
│   ├── services/
│   │   ├── jobRunner.ts        ← Job orchestration [#34 tests]
│   │   ├── scanner.ts          ← Metadata extraction [PERF-01 issue]
│   │   ├── editor.ts           ← mkvpropedit wrapper [QUAL-02 issue]
│   │   ├── audit.ts            ← Audit log writing
│   │   │
│   │   └── __tests__/
│   │       ├── jobRunner.test.ts [#34] ← 82 tests
│   │       ├── scanner.test.ts
│   │       ├── editor.test.ts
│   │       └── audit.test.ts
│   │
│   ├── routes/
│   │   ├── jobs.ts             ← [#47] Validated pagination
│   │   ├── scan.ts             ← File/dir listing
│   │   ├── mounts.ts           ← Mount CRUD
│   │   ├── audit.ts            ← [#47] Validated pagination
│   │   ├── admin.ts            ← [#40] Stats & purge
│   │   ├── ws.ts               ← WebSocket [ARCH-02 bug]
│   │   │
│   │   └── __tests__/
│   │       └── jobs.schema.test.ts
│   │
│   ├── lib/
│   │   ├── auth.ts             ← Authentik header validation
│   │   ├── pathSecurity.ts     ← Path traversal prevention
│   │   ├── logger.ts           ← Pino config
│   │   └── toolConcurrency.ts  ← mkvmerge/ffprobe semaphore
│   │
│   ├── shared/                 ← [#45] Shared with frontend
│   │   └── index.ts            ← Re-exported types, helpers
│   │
│   ├── types/
│   │   └── index.ts            ← Core type definitions
│   │
│   ├── validation/
│   │   └── editOperation.ts    ← EditOperation schema
│   │
│   └── index.ts                ← App entry point
│
├── vitest.config.ts            ← [#51] Coverage config
├── drizzle.config.ts           ← [#46] Migration config
└── Dockerfile                  ← Bun 1.4-alpine + tools
```

**External Invocations:**
```
mkvmerge --output-to-stdout → JSON metadata → scanner.ts
ffprobe -print_format json  → JSON metadata → scanner.ts (fallback)
mkvpropedit                 → Edit metadata → editor.ts
```

---

## 🔄 Data Flow: Edit Job Lifecycle

```
1. User selects files (Browse.tsx) ──────────────┐
                                                  │
2. User edits metadata (BulkEdit.tsx) ◄──────────┤
   - Validates form                              │
   - Calls POST /api/jobs                        │
                                                  ▼
3. Backend: createJob() ┌────────────────────────────────────┐
   - Validate EditOperation[] (zod schema)       │ Transaction│
   - Insert job row (status: pending)            │            │
   - Insert job_files rows (one per file)        │            │
   - Return jobId + 202                          │            │
   └────────────────────────────────────────────┘
          ▲
          │ Async fire-and-forget: processJob()
          │
          ├─── For each file:
          │    1. assertSafePath() ────────────── Check boundary
          │    2. isValidMkv() ────────────────── Check EBML magic
          │    3. checkWritable() ─────────────── Check permissions
          │    4. scanFile() ──────────────────── mkvmerge/ffprobe
          │    5. detectConflicts() ──────────── Track validation
          │    6. buildMkvpropeditArgs() ──────── Generate args
          │    7. runMkvpropedit() ────────────── Execute tool
          │    8. buildChangesSummary() ──────── Capture changes
          │    9. updateFileStatusFull() ──────── Store result
          │   10. emitFileUpdate() ────────────── WebSocket
          │
          └─── Update job status ────────────── "done" | "partial" | "failed"
               emitJobComplete() ────────────── WebSocket event
               writeAuditEntry() ────────────── Audit log
```

**WebSocket Flow:**
```
Browser ──── /ws/jobs/:jobId ──── Backend (onOpen)
             ▲                     │
             │                     └─── jobEvents.on(`job:${jobId}`)
             │                           ├─ emitFileUpdate()
             │                           ├─ emitJobUpdate()
             │                           └─ emitJobComplete()
             └─────────────────────────── Forward as JSON
```

---

## 🗄️ Database Schema (v2)

```sql
┌─ jobs
│  ├─ id (PK, UUID)
│  ├─ user_id (FK → Authentik)
│  ├─ user_email
│  ├─ status: pending|running|done|partial|failed
│  ├─ operations (JSON EditOperation[])
│  ├─ total_files, processed_files
│  ├─ dry_run (boolean)
│  ├─ retention_days [#40]
│  ├─ created_at, updated_at (ISO 8601)
│  └─ Indexes: user, status, created
│
├─ job_files
│  ├─ id (PK, UUID)
│  ├─ job_id (FK → jobs, CASCADE)
│  ├─ file_path
│  ├─ status: pending|running|success|failed|skipped
│  ├─ snapshot_before (JSON MkvFileMetadata)
│  ├─ snapshot_size_bytes [#40]
│  ├─ changes_summary (JSON {changes[], warnings[]})
│  ├─ error_message
│  ├─ exit_code
│  ├─ created_at, updated_at
│  └─ Indexes: job
│
├─ audit_log
│  ├─ id (PK, UUID)
│  ├─ user_id (FK → Authentik)
│  ├─ user_email
│  ├─ action: scan|edit|undo|mount_add|mount_remove|mount_update
│  ├─ job_id (nullable)
│  ├─ detail (JSON free-form)
│  ├─ created_at
│  └─ Indexes: user, created
│
├─ mounts
│  ├─ id (PK, UUID)
│  ├─ name
│  ├─ path (absolute, inside container)
│  ├─ type: movies|series
│  ├─ created_at, updated_at
│  └─ Indexes: path (unique)
│
└─ schema_migrations [#46]
   ├─ version (PK, "0001_initial_schema", etc.)
   └─ applied_at (timestamp)
```

**Migration History:**
- `0001_initial_schema.sql` — Core tables (jobs, job_files, audit_log, mounts, indexes)
- `0002_add_operations_column.sql` — Store EditOperation[] on job for recovery
- `0003_add_retention_columns.sql` — Add retention_days, snapshot_size_bytes

---

## 🔀 External Service Contracts

### Authentik (auth)
**Input:** Browser → Traefik → Authentik (via Traefik middleware)  
**Output:** Traefik → Backend as headers
```
X-Remote-User: <uid>
X-Remote-Groups: <group1>,<group2>,...
```
**Trust:** Backend trusts these headers only when Traefik validated them (upstream check).

---

### Traefik (proxy)
**Role:** TLS termination, auth validation, routing  
**Routes:**
- `GET /* → nginx:8080` (frontend SPA)
- `POST /api/* → backend:3001` (API)
- `GET /ws/* → backend:3001` (WebSocket upgrade)

**Header Injection:**
- Validates Authentik token
- Forwards `X-Remote-User`, `X-Remote-Groups`

---

### nginx (static server)
**Role:** Serve React SPA, static assets, CSP headers  
**Endpoints:**
- `GET /` → `index.html`
- `GET /*.{js,css,woff2,...}` → cached assets
- `POST /api/* → backend` (proxy)
- `GET /ws/* → backend` (proxy)

**Security Headers:** [#50 SEC-04]
```
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

---

### mkvtoolnix & ffmpeg
**Invocation:** Via `child_process.spawn()` in `editor.ts` and `scanner.ts`  
**Inputs:** File paths (validated via `assertSafePath()`)  
**Outputs:** Exit code, stdout (JSON), stderr

**mkvmerge:**
```bash
mkvmerge --output-to-stdout file.mkv | jq . > metadata.json
```

**ffprobe (fallback):**
```bash
ffprobe -print_format json -show_format -show_streams file.mkv
```

**Trust Model:** Assume binaries are legitimate and not compromised. Path validation prevents directory traversal.

---

## 📊 Deployment Topology

```
Host Machine (NAS + Docker)
│
├─ Volume: /media/movies (NAS mount)
├─ Volume: /media/series (NAS mount)
├─ Volume: /app/data (SQLite DB)
│
└─ Docker Compose Network
   │
   ├─ Service: traefik_network (external)
   │  └─ Acts as reverse proxy, auth gateway
   │
   ├─ Container: frontend (nginx:latest)
   │  ├─ Listen: 8080 (internal only)
   │  ├─ Volume: dist/ (build output)
   │  └─ Proxy: /api → backend:3001
   │
   ├─ Container: backend (oven/bun:1.4-alpine)
   │  ├─ Listen: 3001
   │  ├─ Volume: /app/data → host /data
   │  ├─ Volume: /media → host /media (read/write)
   │  ├─ Tool: mkvtoolnix (pre-installed)
   │  ├─ Tool: ffmpeg (pre-installed)
   │  └─ Env: AUTHENTIK_ADMIN_GROUP, DATA_DIR, etc.
   │
   └─ External: Authentik (auth provider, Docker or self-hosted)
```

---

## ✅ Ownership Checklist

| Component | Owner | Status | Notes |
|-----------|-------|--------|-------|
| Auth (Authentik) | Security team | ✓ Implemented | See AGENTS.md |
| Path security | FS maintainer | ✓ Implemented | `assertSafePath()` |
| Job runner | Job orchestration | ✓ Implemented | See known issues in AGENTS.md |
| Scanner | Metadata extraction | ⚠️ Has issues | PERF-01, QUAL-01 |
| Editor | mkvpropedit wrapper | ⚠️ Has issues | QUAL-02 |
| WebSocket | Real-time comms | ❌ Bug: ARCH-02 | Needs fix |
| Database | Data integrity | ✓ Implemented | Migrations working |
| Admin API | Maintenance | ✓ Implemented | #40 complete |
| Frontend | UI/UX | ✓ Mostly OK | #41 accessibility done, UX-02/03 remain |
| i18n | Localization | ✓ Implemented | #48 en/es infrastructure |
| Tests | QA | ✓ Growing | #34 added tests, #51 coverage config |

---

## 🚨 Known Issues & Risks

| Issue | Location | Severity | Owner | Status |
|-------|----------|----------|-------|--------|
| ARCH-02 | WebSocket cleanup | HIGH | Real-time comms | Needs fix |
| QUAL-01 | Undo lossless | HIGH | Job orchestration | Complex fix needed |
| QUAL-02 | Edit validation | MEDIUM | mkvpropedit wrapper | Needs discriminated union |
| QUAL-03 | Job final status | MEDIUM | Job orchestration | Needs terminal state fix |
| PERF-01 | Sync traversal | HIGH | Metadata extraction | Needs async refactor |
| PERF-02 | Tool concurrency | HIGH | Tool executor | Needs semaphore |
| UX-02 | Error visibility | MEDIUM | All pages | Needs error UI |
| UX-03 | File limit | MEDIUM | BulkEdit | Needs enforcement |

See CODEX_REVIEW.md for full details.

---

## 📞 Quick Links

- **AGENTS.md** — Detailed ownership & responsibilities
- **CODEX_REVIEW.md** — Full audit findings
- **README.md** — Deployment & usage
- **Dockerfile** — Runtime environment
- **docker-compose.yml** — Service orchestration

---

## Version History

| Date | Change | Owner |
|------|--------|-------|
| 2026-10-12 | Initial MAP.md (DOC-03) | Claude Code (agent) |
