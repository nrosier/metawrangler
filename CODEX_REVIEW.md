# Repository Audit & Review Report — MetaWrangler

## Executive Summary
- **Overall Code Health Score:** 55%
- **Overall Score Justification & Path to 100%:** The repository has strict TypeScript settings, small and understandable modules, hardened containers, safe subprocess invocation through `execFile`, and a clean production dependency audit. The score is held down by two exploitable filesystem boundary gaps, missing WebSocket authorization, non-durable background jobs, an undo implementation that cannot restore several valid states, synchronous and unbounded filesystem/process work, inaccessible row interactions, no frontend or end-to-end tests, and documentation that contradicts the deployed runtime. Reaching 100% requires one canonical realpath-based filesystem policy, authenticated and owner-scoped WebSockets, a bounded durable job worker with recovery and retention, lossless undo, discriminated request validation, accessible/error-complete UI flows, integration/E2E coverage, and documentation generated or checked against the actual configuration.
- **Key Strengths:**
  - TypeScript is strict on both sides; the backend also enables `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (`backend/tsconfig.json:3-17`).
  - Subprocesses use argument arrays with `execFile`, bounded timeouts, and output buffers (`backend/src/services/scanner.ts:155-159`, `backend/src/services/editor.ts:117-121`).
  - Containers drop privileges and capabilities, use read-only roots, and keep the backend off the proxy network (`docker-compose.yml:16-44`, `backend/Dockerfile:40-52`, `frontend/Dockerfile:22-31`).
  - Current verification passes 55 backend tests, both type checks, both builds/lints (one frontend warning), Compose parsing, and production dependency audits with zero known advisories.
  - The UI shell includes a skip link, semantic navigation, focus-visible styles, reduced-motion handling, and explicit theme controls (`frontend/src/shell/AppShell.tsx:25-43`, `frontend/src/shell/Nav.tsx:21-30`, `frontend/src/theme/base.css:72-76`, `frontend/src/theme/base.css:122-129`).
- **Primary Risk Areas:**
  - Filesystem authorization is lexical and inconsistent, allowing `..` and symlink escapes during metadata reads and edits.
  - WebSocket upgrades bypass application authentication and job ownership checks.
  - Jobs are in-process, unbounded, and unrecoverable after restart; snapshots and logs have no retention.
  - Undo is not lossless and can report completion after failed restores.
  - The most consequential routes, job workflow, undo workflow, WebSocket behavior, and entire frontend have no production-path tests.

**Audit basis:** `main` at `1c9e0ce`, plus the existing uncommitted `backend/src/services/scanner.ts` change that reads only four magic bytes. The pre-existing `.playwright-mcp/` directory was excluded as untracked user tooling. No application code was changed by this audit.

### Domain Health & Findings Summary
| Domain | Score (%) | Critical | High | Medium | Low | Total Findings |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Application Security & Data Privacy | 54% | 0 | 2 | 2 | 1 | 5 |
| Architectural Integrity & Boundaries | 64% | 0 | 1 | 2 | 0 | 3 |
| Code Quality, Maintainability & Types | 64% | 0 | 1 | 2 | 1 | 4 |
| Performance & Resource Management | 52% | 0 | 2 | 1 | 0 | 3 |
| UI, UX & Accessibility (a11y) | 68% | 0 | 0 | 3 | 0 | 3 |
| i18n & Local-First Integrity | 40% | 0 | 1 | 2 | 0 | 3 |
| Test Coverage & Quality Assurance | 48% | 0 | 2 | 0 | 1 | 3 |
| Documentation & Agent Maintainability | 50% | 0 | 0 | 2 | 1 | 3 |

---

## Gap Analysis & Pathway to 100% by Domain
*Note: For any domain scoring below 100%, detail the exact gaps preventing a perfect score and the precise remediation steps required.*

### 1. Application Security & Data Privacy (54% / 100%)
- **Deduction Reasons:** `POST /api/scan/file` authorizes the raw string rather than the resolved path; the shared helpers do not resolve symlinks; mount paths can be changed without revalidation; WebSockets have neither application auth nor owner checks; every authenticated user can manage global roots; the frontend does not set a Content Security Policy; and both development lockfiles resolve a build-time dependency with a high-severity advisory.
- **Actionable Remediation to Reach 100%:** (1) Resolve and canonicalize both roots and targets with `realpath`, then compare using `path.relative`. (2) Reject symlinks or prove their canonical targets stay below the registered root. (3) make mount paths immutable in the backend schema or revalidate every update. (4) Run auth middleware on WebSocket upgrades, verify `job.userId`, and validate `Origin`. (5) Add an admin role for global mount management. (6) Ship and smoke-test a restrictive CSP. (7) Update the Vite/PostCSS dependency chain until `source-map-js` is at least 1.2.2, then gate full-tree audits separately from production audits.

### 2. Architectural Integrity & Boundaries (64% / 100%)
- **Deduction Reasons:** API contracts are manually duplicated, WebSocket subscriptions share a process-global emitter whose cleanup crosses client boundaries, and database changes are represented by an idempotent bootstrap script without schema versions.
- **Actionable Remediation to Reach 100%:** (1) Publish shared schemas/types from one package and infer both client and server types. (2) Return an unsubscribe closure per WebSocket and never call `removeAllListeners` for a shared job channel. (3) Introduce ordered Drizzle migrations, a schema version table, and migration tests against the prior release.

### 3. Code Quality, Maintainability & Type Safety (64% / 100%)
- **Deduction Reasons:** Undo cannot represent deletions or ffprobe snapshots, edit operation values are not discriminated by field, failure aggregation reports misleading job states, and pagination accepts `NaN`/negative values.
- **Actionable Remediation to Reach 100%:** (1) Store a normalized reversible snapshot and implement both `--set` and `--delete`. (2) Use a discriminated Zod union that ties fields to value and selector types. (3) centralize terminal status calculation for edit and undo jobs and wrap runners in a top-level failure boundary. (4) validate all query parameters with bounded integer schemas.

### 4. Performance & Resource Management (52% / 100%)
- **Deduction Reasons:** recursive scans use synchronous I/O on the Bun event loop and run on every mount health request; metadata batches can start 500 tool processes at once; unlimited jobs run concurrently; and snapshots/audit rows are retained indefinitely.
- **Actionable Remediation to Reach 100%:** (1) Use async `opendir`, cycle detection, caching, and a scan index. (2) Apply a global bounded process pool and per-user job limits. (3) add backpressure/429 responses. (4) Define retention, expose purge/archival operations, and monitor database size.

### 5. UI, UX & Accessibility (68% / 100%)
- **Deduction Reasons:** clickable table rows and disclosure cells are not keyboard controls, several visible labels are unattached, progress lacks semantics, query failures often look like empty/loading states, and selecting more than 100 files produces a silent dead end.
- **Actionable Remediation to Reach 100%:** (1) Put links/buttons inside table cells and add `scope`/captions. (2) bind labels with `htmlFor`/`id`; add `role="progressbar"` or `<progress>`. (3) Render actionable query error states and retry controls. (4) align the selection limit with the API and surface partial metadata failures before submit. (5) add automated axe and keyboard-flow checks.

### 6. Internationalization & Local-First Integrity (40% / 100%)
- **Deduction Reasons:** user-facing text is embedded throughout components, `<html lang="en">` is fixed, dates use implicit browser locale, jobs cannot resume after a local service restart, and edit selection exists only in router memory.
- **Actionable Remediation to Reach 100%:** (1) Add a locale catalog, locale negotiation/persistence, explicit date/number formatting, and parity tests. (2) Persist queued operations and leases so interrupted jobs recover deterministically. (3) persist draft selection/edit state locally and provide explicit stale/offline UI. (4) add a service worker only if offline browsing is an actual product requirement.

### 7. Test Coverage & Quality Assurance (48% / 100%)
- **Deduction Reasons:** job-runner tests duplicate private code, no tests execute create/process/undo routes or WebSockets, the frontend has zero tests, there is no E2E suite, Docker PR validation ignores source-only changes, and no coverage floor exists.
- **Actionable Remediation to Reach 100%:** (1) Extract and import pure job helpers rather than copying them. (2) test routes and the real runner against temporary SQLite/filesystem/tool fixtures. (3) add React Testing Library tests for validation/error/accessibility states and Playwright tests for browse/edit/dry-run/undo/restart. (4) trigger image smoke tests for source changes. (5) enforce branch coverage on security and lifecycle modules.

### 8. Documentation & Agent Maintainability (50% / 100%)
- **Deduction Reasons:** README runtime, UI stack, and undo claims are false; the survey contains stale paths and dependencies; and the requested agent/dependency maps and consistent module contracts are absent.
- **Actionable Remediation to Reach 100%:** (1) Correct the README from checked source. (2) refresh or replace the survey and add a verification date/commit. (3) add `AGENTS.md`, area `MAP.md` files where useful, and `docs/DEPENDENCIES.md` covering external binaries, services, trust boundaries, and upgrade ownership. (4) check documented commands/runtime names in CI.

---

## Prioritized Action Plan

### 🚨 Urgent / Immediate Priority (P0)
| ID | Finding | Location | Criticality | Effort | Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| SEC-01 | Canonical path policy can be bypassed by `..`, symlinks, and path updates | `backend/src/routes/scan.ts:92`; `backend/src/lib/pathSecurity.ts:16`; `backend/src/routes/mounts.ts:24` | HIGH | MODERATE | TARGETED_REFACTOR |
| SEC-02 | WebSocket job stream has no application auth or ownership check | `backend/src/index.ts:65`; `backend/src/routes/ws.ts:16` | HIGH | MODERATE | TARGETED_REFACTOR |
| QUAL-01 | Undo cannot restore valid prior states and misreports restore failures | `backend/src/services/jobRunner.ts:292`; `backend/src/services/jobRunner.ts:317` | HIGH | COMPLEX | TARGETED_REFACTOR |
| LOCAL-01 | In-process jobs are abandoned on restart with no recovery | `backend/src/services/jobRunner.ts:63`; `backend/src/index.ts:24` | HIGH | COMPLEX | MAJOR_REWRITE |

### ⚠️ High Priority / Next Release (P1)
| ID | Finding | Location | Criticality | Effort | Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ARCH-02 | One WebSocket disconnect removes every listener for that job | `backend/src/routes/ws.ts:53`; `backend/src/routes/ws.ts:69` | HIGH | EASY | QUICK_FIX |
| PERF-01 | Recursive synchronous scans block requests and can follow directory cycles | `backend/src/services/scanner.ts:46`; `backend/src/routes/mounts.ts:45` | HIGH | MODERATE | TARGETED_REFACTOR |
| PERF-02 | Metadata and job execution have no global concurrency/backpressure limits | `backend/src/routes/scan.ts:95`; `backend/src/services/jobRunner.ts:63` | HIGH | MODERATE | TARGETED_REFACTOR |
| TEST-01 | Job tests execute copied helpers and omit the production workflow | `backend/src/services/__tests__/jobRunner.test.ts:1` | HIGH | MODERATE | TARGETED_REFACTOR |
| TEST-02 | Frontend/E2E coverage is absent and image CI skips source-only PRs | `.github/workflows/docker.yml:23`; `frontend/package.json:6` | HIGH | COMPLEX | TARGETED_REFACTOR |
| SEC-03 | Proxy-header trust and global mount administration are not role-bound | `backend/src/lib/auth.ts:24`; `backend/src/routes/mounts.ts:60` | MEDIUM | MODERATE | TARGETED_REFACTOR |
| SEC-05 | Both development lockfiles contain vulnerable `source-map-js@1.2.1` | `backend/package-lock.json:4288`; `frontend/package-lock.json:3230` | MEDIUM | EASY | QUICK_FIX |
| QUAL-02 | Edit request schema accepts field/value/selector mismatches | `backend/src/routes/jobs.ts:15` | MEDIUM | EASY | QUICK_FIX |
| QUAL-03 | Terminal status and runner rejection handling hide partial/outer failures | `backend/src/services/jobRunner.ts:168`; `backend/src/services/jobRunner.ts:256` | MEDIUM | MODERATE | TARGETED_REFACTOR |
| PERF-03 | Snapshots and audit data have no size or retention policy | `backend/src/db/schema.ts:44`; `backend/src/db/schema.ts:56` | MEDIUM | MODERATE | TARGETED_REFACTOR |
| UX-01 | Core table interactions and form labels are not keyboard/screen-reader complete | `frontend/src/pages/Browse.tsx:256`; `frontend/src/pages/Settings.tsx:127` | MEDIUM | MODERATE | TARGETED_REFACTOR |
| UX-02 | Query failures render as empty or indefinitely loading states | `frontend/src/pages/Jobs.tsx:13`; `frontend/src/pages/JobDetail.tsx:81` | MEDIUM | EASY | QUICK_FIX |
| UX-03 | Bulk edit silently stops loading metadata above 100 files and hides failures | `frontend/src/pages/BulkEdit.tsx:128`; `frontend/src/pages/BulkEdit.tsx:201` | MEDIUM | EASY | QUICK_FIX |
| I18N-01 | UI text and locale behavior are hardcoded | `frontend/index.html:2`; `frontend/src/lib/utils.ts:12` | MEDIUM | COMPLEX | TARGETED_REFACTOR |
| LOCAL-02 | Selection/draft state is ephemeral and there is no offline/stale-state model | `frontend/src/pages/Browse.tsx:132`; `frontend/src/pages/BulkEdit.tsx:120` | MEDIUM | MODERATE | TARGETED_REFACTOR |
| ARCH-01 | Client/server contracts are manually duplicated | `frontend/src/types/index.ts:1`; `backend/src/types/index.ts:1` | MEDIUM | MODERATE | TARGETED_REFACTOR |
| ARCH-03 | Inline `CREATE TABLE IF NOT EXISTS` is not a schema migration system | `backend/src/db/index.ts:26` | MEDIUM | MODERATE | TARGETED_REFACTOR |
| DOC-01 | README describes the wrong runtime/UI stack and impossible undo behavior | `README.md:23`; `README.md:129` | MEDIUM | EASY | QUICK_FIX |
| DOC-02 | Codebase survey is stale and internally inconsistent | `docs/codebase-survey.md:7`; `docs/codebase-survey.md:51` | MEDIUM | EASY | QUICK_FIX |

### 📋 Backlog / Technical Debt (P2)
| ID | Finding | Location | Criticality | Effort | Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| SEC-04 | Frontend HTML lacks a Content Security Policy | `frontend/nginx.conf:36`; `frontend/index.html:3` | LOW | EASY | QUICK_FIX |
| QUAL-04 | Pagination accepts `NaN`, infinity, and negative values | `backend/src/routes/jobs.ts:58`; `backend/src/routes/audit.ts:14` | LOW | EASY | QUICK_FIX |
| TEST-03 | Test coverage is neither measured nor gated | `backend/vitest.config.ts:3`; `.github/workflows/ci.yml:41` | LOW | EASY | QUICK_FIX |
| DOC-03 | Agent maps, dependency ownership docs, and consistent module headers are absent | repository root; `docs/` | LOW | MODERATE | TARGETED_REFACTOR |

---

## Detailed Findings by Theme

### 1. Security & Data Privacy

#### [SEC-01] Filesystem authorization is bypassable and inconsistently applied
- **Location:** `backend/src/routes/scan.ts:92-104`; `backend/src/lib/pathSecurity.ts:16-22`; `backend/src/lib/pathSecurity.ts:36-47`; `backend/src/routes/mounts.ts:18-24`; `backend/src/routes/mounts.ts:101-111`
- **Classification:** `Criticality: HIGH` | `Urgency: IMMEDIATE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** The metadata endpoint checks the unnormalized request with `filePath.startsWith(m.path + "/")`. A request for `/media/movies/../private/secret.mkv` passes for a `/media/movies` mount but resolves to `/media/private/secret.mkv`; this was reproduced directly. The shared helpers call `path.resolve`, which removes `..` but does not resolve symlinks, while `statSync` follows symlinks. A symlink below a mount can therefore expose or edit a target outside it. Finally, `updateMountSchema = createMountSchema.partial()` includes `path`, so the PATCH route changes roots without the existence/directory checks used by POST even though its comment says path is immutable.
- **Impact:** An authenticated caller can read metadata outside an allowed root through the scan endpoint. A symlinked MKV or directory can cross the boundary for browse, scan, edit, and undo. A direct API client can also repoint a mount to any container-visible directory, expanding every user's edit boundary.
- **Recommended Remediation:** Canonicalize on registration and access, compare with `path.relative`, reject path changes or revalidate them, and decide explicitly whether symlinks are forbidden.
```typescript
const root = await realpath(mount.path);
const target = await realpath(requestedPath);
const relative = path.relative(root, target);
if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
  throw new PathTraversalError("Path is outside the registered mount");
}
```

#### [SEC-02] WebSocket streams do not enforce authentication or job ownership
- **Location:** `backend/src/index.ts:65-69`; `backend/src/routes/ws.ts:16-43`; `frontend/nginx.conf:56-63`
- **Classification:** `Criticality: HIGH` | `Urgency: IMMEDIATE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** `authMiddleware` is registered only for `/api/*`; `/ws/jobs/:id` relies on a comment that Traefik authenticated the upgrade. The route loads a job by ID and sends it without comparing `job.userId` to the caller. Nginx forwards the upgrade but performs no ownership check. WebSocket handshakes also have no application `Origin` validation.
- **Impact:** Any party that reaches the backend or any authenticated user who learns another job UUID can receive that user's email, job state, file paths, changes, errors, and live updates. The randomized UUID reduces discovery but is not authorization.
- **Recommended Remediation:** Authenticate the upgrade from a trusted proxy assertion or signed session, reject untrusted origins, load the user into context, and require `row.userId === user.uid` before opening the socket. Add cross-user and unauthenticated WebSocket tests.

#### [SEC-03] Global administration relies on presence-only proxy headers
- **Location:** `backend/src/lib/auth.ts:8-41`; `backend/src/routes/mounts.ts:60-143`; `docker-compose.yml:38-44`; `docker-compose.yml:76-79`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** The backend treats any nonempty configured UID/email headers as authenticated and has no role or signature check. All authenticated users can add/update/delete global mounts, and all registered roots are accepted by every user's job. The backend sits on an externally managed shared network named `internal`; the repository cannot enforce which other containers can connect and forge those headers.
- **Impact:** A compromised peer container or proxy misconfiguration bypasses identity. In multi-user Authentik deployments, a regular user can alter global storage roots and edit media available to other users.
- **Recommended Remediation:** Strip identity headers at the edge, add a backend-verifiable assertion (mTLS, signed JWT, or trusted-proxy network plus header overwrite), fail startup when the trust configuration is absent, and require an administrator group for mount CRUD.

#### [SEC-04] Browser security headers omit CSP
- **Location:** `frontend/nginx.conf:36-40`; `frontend/index.html:3-10`; `backend/src/index.ts:43-44`
- **Classification:** `Criticality: LOW` | `Urgency: BACKLOG` | `Effort: EASY` | `Scope: QUICK_FIX`
- **Issue:** Nginx sets nosniff, frame denial, and referrer policy, but no `Content-Security-Policy`. Backend `secureHeaders()` applies to API responses, not the HTML/JavaScript origin served by Nginx.
- **Impact:** A future HTML/script injection has no browser-enforced allowlist limiting script, connection, style, frame, or object sources.
- **Recommended Remediation:** Start with `default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; connect-src 'self' ws: wss:` and tighten style/font directives to the emitted assets. Assert the header in the frontend image smoke test.

#### [SEC-05] Development dependency trees contain a high-severity source-map parser advisory
- **Location:** `backend/package-lock.json:4079-4086`; `backend/package-lock.json:4288-4293`; `frontend/package-lock.json:3008-3015`; `frontend/package-lock.json:3230-3235`; `.github/workflows/ci.yml:44-47`; `.github/workflows/ci.yml:76-77`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: EASY` | `Scope: QUICK_FIX`
- **Issue:** Full `npm audit --json` reports GHSA-68fv-2mgg-jv7q in `source-map-js@1.2.1` (CVSS 7.5, event-loop denial of service through indexed source-map section offsets). Backend reaches it through `vitest -> vite -> postcss`; frontend reaches it through `vite -> postcss`. CI runs only `npm audit --omit=dev`, so the check passes while both build/test trees remain affected.
- **Impact:** This is not shipped in the production dependency trees, but malicious or untrusted source-map input processed during development/CI can stall the Node process and disrupt builds or tests.
- **Recommended Remediation:** Upgrade the dependency chain or lockfile override to `source-map-js >= 1.2.2`, confirm builds/tests, retain the production audit, and add a second full-tree audit with an explicit policy for build-tool findings.

### 2. Architectural Integrity & Boundaries

#### [ARCH-01] API contracts are manually mirrored and already differ
- **Location:** `frontend/src/types/index.ts:1-4`; `frontend/src/types/index.ts:23-27`; `backend/src/types/index.ts:28-34`; `backend/src/routes/jobs.ts:15-38`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** The frontend explicitly says to keep its copy in sync manually. It omits backend-only `rawJson`, extends `Mount` with route-computed health, and has a separately named `ChangeEntry`; runtime Zod schemas are a third contract source.
- **Impact:** Server changes can compile while the client silently decodes a different shape. WebSocket casts then bypass runtime narrowing entirely.
- **Recommended Remediation:** Move Zod schemas and inferred public DTOs to a shared package. Keep storage-only fields in backend types and expose explicit route response schemas.

#### [ARCH-02] WebSocket cleanup crosses client boundaries
- **Location:** `backend/src/routes/ws.ts:53-70`; `backend/src/services/jobRunner.ts:22-24`
- **Classification:** `Criticality: HIGH` | `Urgency: NEXT_RELEASE` | `Effort: EASY` | `Scope: QUICK_FIX`
- **Issue:** Each open socket adds a handler to the shared `job:${jobId}` event. When any one socket closes, `removeAllListeners` removes handlers for every other browser/tab connected to that job. The per-socket handler is scoped inside `onOpen`, so `onClose` cannot remove only its own handler.
- **Impact:** Closing one tab silently stops live progress for all other viewers of the same job. Reconnect/StrictMode behavior makes this intermittent and difficult to diagnose.
- **Recommended Remediation:** Store the handler in the connection closure and call `off(event, handler)` on close/error. Add a two-client test that closes one client and proves the other still receives events.

#### [ARCH-03] Schema bootstrap cannot evolve existing databases safely
- **Location:** `backend/src/db/index.ts:26-80`; `backend/package.json:28`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** Startup runs only `CREATE TABLE/INDEX IF NOT EXISTS`. `drizzle-kit` is installed but there is no config or migrations directory. Adding or changing a column, constraint, index semantics, or data representation has no ordered upgrade path.
- **Impact:** A release can work on a fresh database and fail or silently retain the old schema on an existing volume. Rollback and migration testing are impossible.
- **Recommended Remediation:** Generate versioned SQL migrations, record applied versions transactionally, back up before destructive transformations, and test fresh install plus upgrade from the last release.

### 3. Code Quality, Maintainability & Type Safety

#### [QUAL-01] Undo is not a lossless inverse and reports false success
- **Location:** `backend/src/services/scanner.ts:223-254`; `backend/src/services/jobRunner.ts:292-317`; `backend/src/services/jobRunner.ts:323-369`; `README.md:125-129`
- **Classification:** `Criticality: HIGH` | `Urgency: IMMEDIATE` | `Effort: COMPLEX` | `Scope: TARGETED_REFACTOR`
- **Issue:** `scanFile` stores ffprobe JSON when mkvmerge fails, but `buildRestoreArgs` understands only `{container, tracks}` mkvmerge JSON; a valid fallback edit later produces an undo job that skips restoration. Absent title/name/language fields generate no `--delete`, so values added by the edit remain after undo. Undo jobs store no before-snapshot, despite README claiming they are undoable. `processUndoJob` always sets the job to `done` even when every file failed.
- **Impact:** Users can be told an undo completed while metadata remains changed. This violates the core safety promise for destructive file edits.
- **Recommended Remediation:** Persist a normalized snapshot with explicit presence markers and stable track identifiers; generate delete operations for absent original fields; capture a pre-undo snapshot if chained undo is supported; compute final status from file outcomes; integration-test add/change/delete and both scanner paths with real MKV fixtures.

#### [QUAL-02] Edit validation permits incompatible values and selectors
- **Location:** `backend/src/routes/jobs.ts:15-38`; `backend/src/services/editor.ts:47-88`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: EASY` | `Scope: QUICK_FIX`
- **Issue:** Every field accepts `string | boolean`, and every selector is optional. Thus `{field:"trackFlagForced", value:"false"}` passes and becomes truthy, setting the flag to `1`; `{field:"title", value:true}` becomes `title=true`; track fields without selectors are accepted and silently skipped.
- **Impact:** Direct API clients and future frontend regressions can apply the opposite flag or create misleading successful/skipped jobs.
- **Recommended Remediation:** Use a discriminated union: title/language/name fields require strings, flag fields require booleans, title forbids selectors, and track fields require them. Add bounds/format validation for language codes and text length.

#### [QUAL-03] Runner failures and partial outcomes produce misleading terminal states
- **Location:** `backend/src/services/jobRunner.ts:63-65`; `backend/src/services/jobRunner.ts:168-180`; `backend/src/services/jobRunner.ts:256-258`; `backend/src/services/jobRunner.ts:317-318`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** Fire-and-forget runner promises have no terminal `.catch` that marks the job failed. Database/event errors outside the per-file `try` leave an unhandled rejection and a stuck job. The edit expression reduces both partial success and success to `done`, and undo always reports `done`.
- **Impact:** Operators and users cannot distinguish complete success, partial failure, and abandoned work from the job status. Monitoring cannot reliably alert.
- **Recommended Remediation:** Wrap each runner in `try/catch/finally`, persist a job-level error, define `succeeded/partial/failed/cancelled/interrupted`, and emit exactly one terminal event after the persisted state is final.

#### [QUAL-04] Pagination inputs are not numeric-domain validated
- **Location:** `backend/src/routes/jobs.ts:55-65`; `backend/src/routes/audit.ts:11-23`
- **Classification:** `Criticality: LOW` | `Urgency: BACKLOG` | `Effort: EASY` | `Scope: QUICK_FIX`
- **Issue:** `Math.min(Number(query), max)` accepts `NaN`, negative numbers, and infinities; audit offset is unrestricted. These values reach Drizzle/SQLite and typically become 500 responses.
- **Impact:** Malformed requests create noisy internal errors and inconsistent pagination behavior.
- **Recommended Remediation:** Validate query strings with `z.coerce.number().int().min(0).max(...)` and return 400 on failure.

### 4. Performance & Resource Management

#### [PERF-01] Recursive synchronous traversal blocks the server and follows cycles
- **Location:** `backend/src/services/scanner.ts:46-78`; `backend/src/services/scanner.ts:90-119`; `backend/src/routes/mounts.ts:26-55`; `backend/src/routes/scan.ts:17-35`
- **Classification:** `Criticality: HIGH` | `Urgency: NEXT_RELEASE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** `readdirSync` and `statSync` run recursively in request handlers. Every `GET /api/mounts` walks every reachable library solely to compute a count, and Settings polls that route every 30 seconds. `statSync` follows directory symlinks; no visited-realpath set prevents a parent/self link from recurring indefinitely.
- **Impact:** Large libraries block health, auth, WebSocket setup, and all API requests. Symlink cycles can exhaust the stack or CPU, while repeated full counts cause persistent NAS I/O.
- **Recommended Remediation:** Traverse asynchronously with `opendir`, limit depth/entries, track `(device,inode)` or canonical paths, skip directory symlinks, move counts to a cached background index, and expose scan progress/cancellation.

#### [PERF-02] Tool process concurrency has no global bound
- **Location:** `backend/src/routes/scan.ts:84-106`; `backend/src/routes/jobs.ts:34-45`; `backend/src/services/jobRunner.ts:63-82`
- **Classification:** `Criticality: HIGH` | `Urgency: NEXT_RELEASE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** One metadata request can launch 500 `mkvmerge`/`ffprobe` operations through `Promise.allSettled`. Every accepted edit job starts its own sequential runner immediately, but the number of concurrent jobs is unlimited. There is no per-user limit, global semaphore, queue capacity, or rate limiter.
- **Impact:** A small number of authenticated requests can exhaust processes, file descriptors, CPU, memory, and NAS throughput, degrading the whole homelab service.
- **Recommended Remediation:** Add one global tool semaphore (for example 2-4 processes), a durable queue with bounded depth, per-user active-job quotas, deduplication, and 429/Retry-After responses. Keep the request maximum as a data limit, not a concurrency count.

#### [PERF-03] Snapshot and audit storage grows without bound
- **Location:** `backend/src/services/scanner.ts:156-170`; `backend/src/services/jobRunner.ts:104-146`; `backend/src/db/schema.ts:44-50`; `backend/src/db/schema.ts:56-67`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** Up to 10 MB of raw tool JSON can be stored for each successful file in every non-cleaned job. Jobs, file rows, snapshots, and audit entries have no expiration, compaction, quota, or purge route.
- **Impact:** Repeated 500-file jobs can grow the SQLite volume by gigabytes, increase backup/restore time, and eventually stop writes when disk is full. Absolute paths and metadata also remain indefinitely.
- **Recommended Remediation:** Store a minimal normalized undo payload, compress it if needed, cap accepted snapshot size, define retention separately for undo and audit, archive or purge expired jobs transactionally, and expose volume metrics.

### 5. UI, UX & Accessibility

#### [UX-01] Primary table interactions are mouse-only and labels are detached
- **Location:** `frontend/src/pages/Browse.tsx:190-198`; `frontend/src/pages/Browse.tsx:256-300`; `frontend/src/pages/Jobs.tsx:44-57`; `frontend/src/pages/JobDetail.tsx:173-199`; `frontend/src/pages/Settings.tsx:127-156`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** Folder/job/file-detail actions live on `<tr>` or `<td onClick>` with no focusability or keyboard event. The search input has only a placeholder. `TextField` and all three Settings labels lack `htmlFor`/nested controls. Table headers omit `scope`, empty header cells have no accessible text, and the visual progress div has no role/value.
- **Impact:** Keyboard and screen-reader users cannot perform central browse, job navigation, and disclosure tasks reliably or identify form fields/progress.
- **Recommended Remediation:** Render real links/buttons inside cells, attach labels by stable IDs, add visually hidden labels/captions, set header scopes, use `<progress>` or an ARIA progressbar, and test the full flow with keyboard plus axe.

#### [UX-02] Network failures are hidden as empty or loading states
- **Location:** `frontend/src/pages/Browse.tsx:44-47`; `frontend/src/pages/Jobs.tsx:13-29`; `frontend/src/pages/JobDetail.tsx:37-47`; `frontend/src/pages/JobDetail.tsx:81-83`; `frontend/src/pages/Settings.tsx:16-20`; `frontend/src/pages/AuditLog.tsx:31-46`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: EASY` | `Scope: QUICK_FIX`
- **Issue:** Queries generally destructure only `data/isLoading`; rejected mount/job/audit requests fall through to “No …” states. A failed job-detail request leaves `job` null and displays “Loading…” forever. Expanded metadata failures display “Loading metadata…” indefinitely because the error result is discarded.
- **Impact:** Authentication, backend, proxy, and filesystem failures are indistinguishable from valid empty data, causing users to retry destructive workflows or troubleshoot the wrong component.
- **Recommended Remediation:** Render `isError/error` with retry and status-aware messages on every query, preserve prior data during refetch, and give metadata rows explicit success/error states.

#### [UX-03] Bulk edit has a hidden 100-file limit and discards partial scan failures
- **Location:** `frontend/src/pages/Browse.tsx:104-138`; `frontend/src/pages/BulkEdit.tsx:128-132`; `frontend/src/pages/BulkEdit.tsx:201-207`; `backend/src/routes/scan.ts:84-86`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: EASY` | `Scope: QUICK_FIX`
- **Issue:** Browse permits an unbounded selection, while the bulk metadata query is disabled above 100 files without a message; the backend supports 500. For smaller selections, failed metadata rows are filtered out and the same original `filePaths` are submitted, so the edit form is based on only a subset.
- **Impact:** More than 100 files leads to a form with no editable fields and no explanation. Partial failures can apply operations inferred from one subset to files the user never previewed.
- **Recommended Remediation:** Enforce and display one shared maximum, batch metadata under a bounded backend pool, block submit until every file has an explicit preview decision, and list retry/remove actions for failed files.

### 6. Internationalization & Local-First Integrity

#### [I18N-01] Locale behavior and all user text are hardcoded
- **Location:** `frontend/index.html:2`; `frontend/src/components/StatusBadge.tsx:7-15`; `frontend/src/shell/Nav.tsx:14-19`; `frontend/src/lib/utils.ts:12-19`; `frontend/src/pages/BulkEdit.tsx:145-195`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: COMPLEX` | `Scope: TARGETED_REFACTOR`
- **Issue:** The document language is fixed to English, strings are embedded in components, pluralization is manual, and `toLocaleString(undefined)` delegates formatting to browser defaults without an application locale.
- **Impact:** A second locale requires invasive edits and can produce mixed-language UI, inconsistent dates, and incorrect plural rules. Locale parity cannot be tested.
- **Recommended Remediation:** Introduce message catalogs with ICU plurals, select/persist a locale, set `document.documentElement.lang`, pass it to `Intl.DateTimeFormat`, and add a CI parity check for missing/unused keys.

#### [LOCAL-01] Background work is not durable across local service restarts
- **Location:** `backend/src/services/jobRunner.ts:28-65`; `backend/src/services/jobRunner.ts:71-82`; `backend/src/index.ts:22-37`; `backend/src/db/schema.ts:19-33`
- **Classification:** `Criticality: HIGH` | `Urgency: IMMEDIATE` | `Effort: COMPLEX` | `Scope: MAJOR_REWRITE`
- **Issue:** Jobs are persisted, but work exists only in fire-and-forget promises. The operation list is not stored, and startup performs no reconciliation of `pending/running` rows. A container restart cannot resume or safely fail them.
- **Impact:** Local upgrades, crashes, and power loss leave jobs permanently pending/running with partially modified media and no reliable statement of which operation was next.
- **Recommended Remediation:** Persist the operation payload and attempt/lease state before acknowledging 202; have a bounded worker claim rows transactionally; on startup expire stale leases and resume idempotently or mark interrupted for explicit retry; reconcile each file by rescanning.

#### [LOCAL-02] Draft edit state exists only in transient router memory
- **Location:** `frontend/src/pages/Browse.tsx:132-138`; `frontend/src/pages/BulkEdit.tsx:119-126`; `frontend/src/theme/theme.ts:26-40`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** File selection is passed through `location.state`; reload, direct link, or tab recovery yields “No files selected.” Edits are component state only. The only local persistence is the theme preference; there is no draft schema, versioning, stale-data indicator, or offline response model.
- **Impact:** A refresh loses potentially lengthy selections and edits, and transient backend/network loss gives no recoverable local workflow.
- **Recommended Remediation:** Persist a versioned draft containing mount, files, edits, dry-run choice, and source metadata timestamps in IndexedDB/localStorage; validate paths and rescan before applying; expose stale/offline status and clear drafts after successful job creation.

### 7. Test Coverage & Quality Assurance

#### [TEST-01] Job tests validate copies instead of production behavior
- **Location:** `backend/src/services/__tests__/jobRunner.test.ts:1-21`; `backend/src/services/__tests__/jobRunner.test.ts:28-90`; `backend/src/services/jobRunner.ts:28-370`
- **Classification:** `Criticality: HIGH` | `Urgency: NEXT_RELEASE` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** The test states that it duplicates private helpers and requires manual synchronization. No test imports or executes `createJob`, `processJob`, `undoJob`, `buildRestoreArgs`, database transitions, event emission, fallback snapshots, or failures.
- **Impact:** The suite can remain green when production helper logic changes or core edit/undo behavior breaks; the confirmed undo defects are examples of paths it misses.
- **Recommended Remediation:** Extract pure helpers to a production module and import them. Add integration tests using temporary SQLite and filesystem/tool fakes or real tiny MKV fixtures for success, partial failure, invalid path, restart, fallback scan, and lossless undo.

#### [TEST-02] Frontend/E2E behavior is untested and Docker CI misses source changes
- **Location:** `frontend/package.json:6-12`; `.github/workflows/ci.yml:49-77`; `.github/workflows/docker.yml:23-33`
- **Classification:** `Criticality: HIGH` | `Urgency: NEXT_RELEASE` | `Effort: COMPLEX` | `Scope: TARGETED_REFACTOR`
- **Issue:** Frontend scripts have no test command, no test files/config exist, and CI only typechecks/lints/builds it. There is no E2E suite. Docker PR validation triggers for Docker/package/nginx/compose/workflow files, but not `backend/src/**` or `frontend/src/**`, so source-only runtime changes do not run container smoke tests or Trivy.
- **Impact:** Keyboard behavior, query errors, WebSocket multi-client handling, form validation, proxy integration, Bun runtime differences, and full browse/edit/undo flows can regress with green CI.
- **Recommended Remediation:** Add component/accessibility tests and Playwright flows against the built containers. Include both source trees in Docker workflow paths or remove the filter. Exercise authentication, path escape rejection, dry-run, edit, failure, undo, multi-client sockets, and restart recovery.

#### [TEST-03] Coverage is not measured or gated
- **Location:** `backend/vitest.config.ts:3-7`; `.github/workflows/ci.yml:41-42`
- **Classification:** `Criticality: LOW` | `Urgency: BACKLOG` | `Effort: EASY` | `Scope: QUICK_FIX`
- **Issue:** Vitest has no coverage provider, include rules, or thresholds, and CI runs only `vitest run`.
- **Impact:** Coverage can decline unnoticed, especially on security boundary and recovery branches.
- **Recommended Remediation:** Collect branch/function/line coverage, exclude only generated/type-only files, set module-specific thresholds for auth/path/job code, and raise them as production-path tests land.

### 8. Documentation & Agent Maintainability

#### [DOC-01] README contradicts the deployed runtime and undo implementation
- **Location:** `README.md:19-30`; `README.md:91-102`; `README.md:125-129`; `backend/Dockerfile:1-52`; `frontend/package.json:13-23`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: EASY` | `Scope: QUICK_FIX`
- **Issue:** README says the backend is Node 22 on `node:22-alpine`; it runs TypeScript directly on Bun `oven/bun:1.4-alpine`. It says Tailwind CSS, which is not installed and the UI uses hand-written CSS. It claims every successful job is undoable and an undo is itself undoable; fallback snapshots, absent fields, and undo jobs contradict both claims.
- **Impact:** Operators choose wrong troubleshooting commands and users may rely on a recovery guarantee the product cannot meet.
- **Recommended Remediation:** Correct the stack and security sections, document precise undo limits until QUAL-01 is fixed, and add CI assertions for runtime/base image names and documented scripts.

#### [DOC-02] Codebase survey is stale and contains false inventory
- **Location:** `docs/codebase-survey.md:5-28`; `docs/codebase-survey.md:47-54`; `docs/codebase-survey.md:124-131`; `frontend/src/shell/AppShell.tsx:1-47`; `frontend/src/icons.tsx:1-266`
- **Classification:** `Criticality: MEDIUM` | `Urgency: NEXT_RELEASE` | `Effort: EASY` | `Scope: QUICK_FIX`
- **Issue:** The survey lists a removed `components/Sidebar`, calls the hand-written UI Tailwind/lucide/tailwind-merge even though those dependencies are absent, says the root README is the only doc while residing in `docs/`, and describes comments/type state that have since changed.
- **Impact:** Maintainers and coding agents start from an inaccurate map and may reintroduce removed dependencies or edit the wrong boundary.
- **Recommended Remediation:** Regenerate the inventory from `rg --files` and package manifests, add “verified at commit/date,” link known risks to current lines, and fail a lightweight docs check when named files/packages disappear.

#### [DOC-03] Agent and dependency maintenance maps are absent
- **Location:** repository root; `docs/`; module headers across `backend/src/` and `frontend/src/`
- **Classification:** `Criticality: LOW` | `Urgency: BACKLOG` | `Effort: MODERATE` | `Scope: TARGETED_REFACTOR`
- **Issue:** There is no `AGENTS.md`, no `MAP.md`, and no `docs/DEPENDENCIES.md`. Headers are inconsistent and do not capture ownership/trust direction for Authentik/Traefik/Nginx, the external Docker networks, SQLite schema, or mkvtoolnix/ffmpeg contracts.
- **Impact:** Automated and human maintainers must rediscover critical boundaries, validation commands, and dependency ownership from implementation details.
- **Recommended Remediation:** Add concise repository instructions, area maps only where they reduce navigation cost, and a dependency document listing purpose, runtime/build scope, trust boundary, version source, upgrade checks, and owner. Keep it checked against manifests and container config.

---

## Validation Evidence

| Check | Result | Evidence / Limit |
| :--- | :--- | :--- |
| Backend typecheck | PASS | `npm run typecheck` |
| Backend lint | PASS | `npm run lint` |
| Backend tests | PASS | 5 files, 55 tests via `npm test` |
| Frontend typecheck | PASS | `npm run typecheck` |
| Frontend lint | PASS with warning | One `react-refresh/only-export-components` warning at `frontend/src/theme/ThemeContext.tsx:70` |
| Frontend production build | PASS | Vite: 294.99 kB JS / 91.42 kB gzip; 17.16 kB CSS / 4.24 kB gzip |
| Backend production dependency audit | PASS | `npm audit --omit=dev --json`: 0 vulnerabilities |
| Frontend production dependency audit | PASS | `npm audit --omit=dev --json`: 0 vulnerabilities |
| Backend full dependency audit | FAIL | One high advisory: GHSA-68fv-2mgg-jv7q in dev-only `source-map-js@1.2.1` via Vitest/Vite/PostCSS |
| Frontend full dependency audit | FAIL | One high advisory: GHSA-68fv-2mgg-jv7q in dev-only `source-map-js@1.2.1` via Vite/PostCSS |
| Secret history scan | PASS | Gitleaks 8.30.1 scanned 71 commits / about 985 kB with no leaks |
| Bun lock install resolution | PASS | Bun 1.4.2 accepted `bun install --frozen-lockfile --production --dry-run` |
| Compose parse | PASS | `docker compose config --no-env-resolution --quiet`; normal resolution requires the intentionally absent `.env` |
| Whitespace/diff check | PASS | `git diff --check` |
| Path bypass reproduction | CONFIRMED | Raw prefix returned true for `/media/movies/../private/secret.mkv`; `path.resolve` returned `/media/private/secret.mkv` |
| Container image builds / live MKV E2E | NOT RUN | Would require image pulls and representative writable MKV fixtures; existing CI workflow is the repository's only image smoke/Trivy path |

The report intentionally does not treat the sandbox's initial npm DNS failure as a repository defect; both audits were rerun with network access and passed.
