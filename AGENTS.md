# Agent & Maintainer Responsibilities

This document maps critical system boundaries, trusted external dependencies, and agent ownership areas for MetaWrangler.

**Last verified:** 2026-10-12 (commit 4162645)  
**Status:** Active maintenance — keep in sync as ownership changes

---

## 🔐 Security Boundaries

### Authentication & Authorization
**Owners:** Security team / Auth maintainer  
**Scope:** `backend/src/lib/auth.ts`; nginx/Traefik headers  
**Responsibility:**
- Verify Authentik headers (`X-Remote-User`, `X-Remote-Groups`)
- Enforce admin group membership for mount/purge operations (SEC-03)
- Block path traversal via `assertSafePath()` — critical for file edits
- Never trust client-side role claims
- Test: `backend/src/lib/__tests__/auth.test.ts`

**External Trust Boundary:** Traefik proxy (upstream) must validate Authentik tokens before forwarding requests to backend.

---

### Path Security
**Owners:** File system / job safety maintainer  
**Scope:** `backend/src/lib/pathSecurity.ts`; `backend/src/services/scanner.ts`  
**Responsibility:**
- Reject attempts to escape mount boundaries (`../../../etc/passwd`)
- Skip directory symlinks during traversal (no cycles)
- Validate file existence before edit operations
- All file paths must go through `assertSafePath()` before tool invocation
- Test: `backend/src/lib/__tests__/pathSecurity.test.ts`

**External Trust Boundary:** Mounted volumes (NAS, local storage) are assumed trusted but may contain symlinks.

---

### Database & File Snapshots
**Owners:** Data integrity / backup maintainer  
**Scope:** `backend/src/db/`; `backend/drizzle/` migrations  
**Responsibility:**
- Keep schema_migrations table synchronized with applied versions
- Backup DB before any destructive purge operation
- Validate snapshots before undo — prevent corruption
- Test migrations: fresh install + upgrade paths
- Test: `backend/src/db/__tests__/migrations.test.ts`

**External Trust Boundary:** SQLite database file (may be on shared NAS).

---

## 🎯 Component Ownership

### Backend Core Services

#### Job Runner (`backend/src/services/jobRunner.ts`)
**Owner:** Job orchestration maintainer  
**Scope:** Job creation, status progression, event emission, undo workflow  
**Responsibility:**
- Persist `operations` JSON for crash recovery
- Emit job/file status events (WebSocket clients subscribe)
- Capture normalized snapshots for undo (not raw tool JSON)
- Mark jobs failed on startup if interrupted
- Store per-file before/after metadata

**Critical Paths:**
- `createJob()` → database insert + async processJob
- `processJob()` → runJobFiles → per-file try/catch + terminal status
- `undoJob()` → process undo via restored snapshots
- `reconcileInterruptedJobs()` → startup recovery

**Known Issues (QUAL-01):**
- Fallback snapshots (ffprobe) may not restore losslessly
- Undo job snapshots not captured (can't undo an undo yet)
- Always reports terminal status as "done" (see QUAL-03 fix)

**Test:** `backend/src/services/__tests__/jobRunner.test.ts` (pure functions only; DB integration deferred to Bun)

---

#### Scanner (`backend/src/services/scanner.ts`)
**Owner:** Metadata extraction maintainer  
**Scope:** MKV scanning, metadata detection, file traversal  
**Responsibility:**
- Invoke `mkvmerge --output-to-stdout` for metadata
- Fallback to `ffprobe` if mkvmerge unavailable (with warnings)
- Walk directory tree async, skip symlinks, detect cycles
- Return normalized metadata in `MkvFileMetadata` shape
- Cap snapshot size to prevent storage explosion (PERF-03)

**Critical Paths:**
- `scanFile()` → mkvmerge or ffprobe → normalize to MkvFileMetadata
- `walkMkvFiles()` → async directory walk with cycle detection
- `checkToolchain()` → verify mkvmerge and ffprobe at startup

**Known Issues (PERF-01):**
- Synchronous traversal in some request handlers blocks server
- No depth limit or entry count cap
- Symlink cycle detection exists but not well tested

**Test:** `backend/src/services/__tests__/scanner.test.ts`

---

#### Editor (`backend/src/services/editor.ts`)
**Owner:** mkvpropedit interface maintainer  
**Scope:** Building mkvpropedit command lines, executing edits  
**Responsibility:**
- Build correct `mkvpropedit` arguments from EditOperation[] and metadata
- Handle title, language, name, and flag edits
- Write to temporary file, then move to original (atomic)
- Return exit code and stderr on failure

**Critical Paths:**
- `buildMkvpropeditArgs()` → operation → mkvpropedit argument list
- `runMkvpropedit()` → spawn process, capture output

**Known Issues (QUAL-02):**
- Accepts mismatched field/value types (e.g., flag="false")
- No field-specific validation (should be discriminated union)
- Missing operations (e.g., delete absent fields) generate no-op

**Test:** `backend/src/services/__tests__/editor.test.ts`

---

### Frontend Pages

#### Browse (`frontend/src/pages/Browse.tsx`)
**Owner:** File selection UI maintainer  
**Scope:** Mount selection, directory navigation, file listing  
**Responsibility:**
- List mounts with health status
- Navigate directory tree (recursive or flat)
- Select/deselect files for bulk edit
- Display file metadata (tracks, title) on expand
- All row interactions must be keyboard-accessible (UX-01)

**Critical Paths:**
- Mount selection → queryKey change
- Directory navigation → currentPath state update
- File selection → selectedFiles Set mutation
- Metadata fetch on expand

**Accessibility:** Buttons not onClick on rows (FIXED in #41)

---

#### Bulk Edit (`frontend/src/pages/BulkEdit.tsx`)
**Owner:** Edit form UI maintainer  
**Scope:** Operation form, dry-run preview, submission  
**Responsibility:**
- Build EditOperation[] from form inputs
- Call `/api/jobs` (POST) with filePaths and operations
- Enforce max 100 files with clear error message (UX-03)
- Display changes summary and warnings from preview

**Critical Paths:**
- Form submission → validation → API call
- Dry-run response → preview changes/warnings
- Actual job submit → job created event → navigate to JobDetail

**Known Issues (UX-03):**
- Metadata query disabled above 100 files with no message
- Partial metadata failures filtered silently
- No batch fetching of metadata

---

#### Job Detail (`frontend/src/pages/JobDetail.tsx`)
**Owner:** Job monitoring UI maintainer  
**Scope:** Live progress, file results, undo button  
**Responsibility:**
- Subscribe to WebSocket for live job/file updates
- Display progress bar with ARIA attributes (UX-01)
- Show file statuses and changes/errors
- Offer undo button if job succeeded (partial or full)
- Fallback polling if WebSocket fails

**Critical Paths:**
- Job query (polling)
- WebSocket subscribe (job:${jobId} event)
- File update subscription
- Undo mutation on button click

**Known Issues (ARCH-02):**
- WebSocket handler not scoped — closing one tab stops all tabs

---

### Backend Routes

#### Jobs (`backend/src/routes/jobs.ts`)
**Owner:** Job API maintainer  
**Scope:** `POST /api/jobs`, `GET /api/jobs`  
**Responsibility:**
- Validate bulk edit request (EditOperation[], filePaths)
- Call `createJob()` and return jobId (202)
- List jobs with pagination (FIXED limit validation in P2)
- Return operations undefined in response (don't leak recovery payload)

**Critical Paths:**
- POST: validate → createJob → return jobId + 202
- GET: validate limit/offset → query db → map operations to undefined

**Test:** `backend/src/routes/__tests__/jobs.schema.test.ts`

---

#### WebSocket (`backend/src/routes/ws.ts`)
**Owner:** Real-time comms maintainer  
**Scope:** `/ws/jobs/:jobId`  
**Responsibility:**
- Accept WebSocket upgrades
- Subscribe to `job:${jobId}` events (jobEvents emitter)
- Forward job/file updates to client as JSON
- Handle disconnects and cleanup

**Critical Paths:**
- onOpen → subscribe to events
- onMessage → forward to client
- onClose → cleanup (BROKEN in ARCH-02 — uses removeAllListeners)

**Known Issues (ARCH-02):**
- `removeAllListeners()` removes handlers for ALL clients
- Per-socket handler not stored → cannot unsubscribe individually
- Closing one tab stops live updates for all tabs

**Fix Required:** Store handler reference, call `off(event, handler)` on close

---

#### Admin (`backend/src/routes/admin.ts`)
**Owner:** Database maintenance maintainer  
**Scope:** `GET /api/admin/db-stats`, `POST /api/admin/purge-old-records`  
**Responsibility:**
- Report DB volume, record counts, oldest records
- Delete jobs older than retention window
- Delete audit entries older than window
- Support dry-run to preview deletions
- Require admin authentication

**Critical Paths:**
- GET: query counts → aggregate sizes → return stats
- POST: validate retention windows → count deletions → (if !dryRun) delete → return report

**Test:** Manual (no test harness for DB mutations yet)

---

## 🔗 External Dependencies & Trust

### Trusted Binaries

#### mkvtoolnix (mkvmerge, mkvpropedit)
**Location:** Host or Docker image  
**Used by:** `scanner.ts`, `editor.ts`  
**Interface:**
- `mkvmerge --output-to-stdout file.mkv` → JSON metadata on stdout
- `mkvpropedit file.mkv --edit info --set "title=X"` → exit code

**Trust Model:** Assumes mkvtoolnix is correctly installed and not compromised. Path safety validated before invocation.

**Version:** Unspecified (inherits from Docker image `oven/bun:1.4-alpine`)

---

#### ffmpeg (ffprobe)
**Location:** Host or Docker image  
**Used by:** `scanner.ts` (fallback when mkvmerge unavailable)  
**Interface:**
- `ffprobe -print_format json file.mkv` → JSON metadata on stdout

**Trust Model:** Fallback only. Output converted to MkvFileMetadata shape (lossy, cannot undo later).

**Version:** Unspecified

---

### External Services

#### Authentik (auth provider)
**Contacted by:** Traefik (proxy)  
**Trust Model:** 
- Traefik validates token and forwards `X-Remote-User`, `X-Remote-Groups` headers
- Backend trusts these headers as auth source-of-truth
- **Never** trust client claims — always validate against these headers

**Interface:**
- HTTP headers only (no direct backend contact)
- `X-Remote-User: uid`
- `X-Remote-Groups: group1,group2,...`

---

#### Traefik (reverse proxy)
**Contacts:** Backend + frontend + Authentik  
**Ports:** 80 (HTTP redirect) / 443 (HTTPS)  
**Trust Model:**
- Terminates TLS
- Validates Authentik token
- Forwards auth headers to backend
- Routes `/api/**` to backend, others to frontend

**Interface:**
- `docker-compose.yml` network: `external: traefik_network`
- Backend at `http://metawrangler-backend:3001`
- Frontend at `http://metawrangler-frontend:8080`

---

#### nginx (static frontend server)
**Contacts:** Browsers (public), backend (private)  
**Ports:** 8080 (internal only)  
**Trust Model:**
- Serves pre-built React SPA + assets
- Proxies `/api/**` and `/ws/**` to backend
- Sets security headers (CSP, nosniff, frame-denial)

**Interface:**
- Static assets with long cache headers
- SPA fallback: unmatched routes → `index.html`

---

### Volumes & Storage

#### SQLite Database
**Location:** `$DATA_DIR/metawrangler.db` (Docker `/app/data/`)  
**Trust Model:** Local to container, may be on shared NAS  
**Schema Version:** 2 (via migrations)  
**Backup:** Recommended before purge operations

---

#### Mount Points (NAS/local storage)
**Location:** Docker volumes (e.g., `/media/movies`, `/media/series`)  
**Trust Model:**
- Assumed trusted (you mounted it)
- May contain symlinks → must skip directory cycles
- Files are read, metadata extracted, and conditionally modified
- All paths validated via `assertSafePath()` before tool invocation

---

## 📋 Handoff Checklist for Maintainers

When taking over a component, verify:

### Security
- [ ] All file paths go through `assertSafePath()`
- [ ] No shell injection vectors (use array args, not string concat)
- [ ] Authentik headers validated on every request
- [ ] Admin-only routes protected by `requireAdmin` middleware
- [ ] No sensitive data in logs or error responses

### Reliability
- [ ] Database mutations are transactional or idempotent
- [ ] Error handling includes terminal state persistence
- [ ] Startup reconciliation catches interrupted work
- [ ] All promises have `.catch()` or `.finally()`
- [ ] Cleanup (DB, sockets, files) on error

### Testing
- [ ] Unit tests for pure functions
- [ ] Integration tests for state transitions
- [ ] Error paths tested (400, 403, 500 responses)
- [ ] Edge cases: empty selections, NaN inputs, symlinks, cycles

### Documentation
- [ ] Add module header with owner and scope
- [ ] Link to GitHub issues (QUAL-01, ARCH-02, etc.) for known bugs
- [ ] Document external interface (API shape, events, CLI args)
- [ ] Update this file when boundaries change

---

## 📞 Escalation Path

**Security Issues** → auth.ts owner  
**File/Path Issues** → pathSecurity owner  
**Job Failures** → jobRunner owner  
**Metadata Problems** → scanner owner  
**WebSocket Hangs** → WebSocket route owner  
**Database Corruption** → DB/migration owner  
**UI/UX Regressions** → relevant page owner

---

## Version History

| Date | Change | Owner |
|------|--------|-------|
| 2026-10-12 | Initial AGENTS.md | Claude Code (agent) |
