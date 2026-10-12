# Testing Guide — MetaWrangler

Complete testing strategy for backend, frontend, and E2E workflows.

---

## 📋 Quick Start

### Unit & Component Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Watch mode
cd frontend && npm test:watch
```

### E2E Tests
```bash
# Start services (from root)
docker-compose up -d

# Run Playwright tests
cd e2e && npm run test

# Run in UI mode
cd e2e && npm run test:ui

# Run in headed (visible browser) mode
cd e2e && npm run test:headed

# Stop services
docker-compose down
```

---

## 🏗️ Test Architecture

### Backend Tests
**Location:** `backend/src/**/__tests__/*.test.ts`  
**Framework:** Vitest  
**Coverage:** Enforced 70% lines/functions, 65% branches

#### Test Suites
- `lib/__tests__/auth.test.ts` — Authentication & authorization
- `lib/__tests__/pathSecurity.test.ts` — Path traversal protection
- `services/__tests__/scanner.test.ts` — MKV metadata extraction
- `services/__tests__/editor.test.ts` — mkvpropedit command building
- `services/__tests__/jobRunner.test.ts` — Job orchestration (82+ tests)
- `db/__tests__/migrations.test.ts` — Migration versioning & idempotency
- `routes/__tests__/jobs.schema.test.ts` — API request validation

#### Running Backend Tests
```bash
cd backend

# Run all tests
npm test

# Run single suite
npm test -- jobRunner

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Frontend Tests
**Location:** `frontend/src/**/__tests__/*.test.tsx`  
**Framework:** Vitest + @testing-library/react  
**Mocks:** API via `@/lib/api` vi.mock(), localStorage, window.matchMedia

#### Test Suites
- `components/__tests__/StatusBadge.test.tsx` — Status badge rendering & styling
- `components/__tests__/QueryError.test.tsx` — Error display & recovery UI
- `components/__tests__/TrackList.test.tsx` — Track table accessibility
- `pages/__tests__/Browse.test.tsx` — File selection & navigation
- `pages/__tests__/BulkEdit.test.tsx` — Form validation & submission
- `pages/__tests__/JobDetail.test.tsx` — Progress monitoring & undo
- `pages/__tests__/Jobs.test.tsx` — Job listing & pagination
- `pages/__tests__/Settings.test.tsx` — Mount management & form accessibility
- `pages/__tests__/AuditLog.test.tsx` — Audit entry display & filtering
- `hooks/__tests__/useJobSocket.test.ts` — WebSocket subscription & event handling

#### Running Frontend Tests
```bash
cd frontend

# Run all tests
npm test

# Run single suite
npm test -- Browse.test

# Watch mode
npm test:watch

# UI mode (visual test runner)
npm test -- --ui
```

### E2E Tests
**Location:** `e2e/tests/*.spec.ts`  
**Framework:** Playwright  
**Scope:** Full application workflows against running Docker containers

#### Test Suites
- `browse-edit-undo.spec.ts` — Complete user journey:
  - Browse & select files
  - Navigate to bulk edit
  - Fill form & preview
  - Submit job & monitor progress
  - Undo job & verify restoration
  - Test accessibility (keyboard navigation, ARIA)

- `mount-management.spec.ts` — Mount CRUD operations:
  - List mounts with health status
  - Add new mount with validation
  - Delete mount with confirmation
  - Test form accessibility (labels, inputs)

- `error-recovery.spec.ts` — Error handling:
  - Network error handling with retry
  - Form validation errors
  - Partial job failures
  - WebSocket disconnection & fallback
  - Technical error details display

#### Running E2E Tests

**Prerequisites:** Docker & docker-compose installed

```bash
# Start services
docker-compose up -d

# Wait for services to be ready
curl -s http://localhost/health

# Run tests
cd e2e
npm run test

# Run in headed mode (see browser)
npm run test:headed

# Run in UI mode (visual runner)
npm run test:ui

# Run single test
npx playwright test browse-edit-undo.spec.ts

# Run with debug mode (step through)
npm run test:debug

# Stop services
cd .. && docker-compose down
```

---

## 🔍 Test Coverage

### Backend Coverage
**Target:** 70% lines, 70% functions, 65% branches

Current coverage tracked via:
```bash
cd backend
npm test -- --coverage
```

**Critical paths to test:**
- Job creation & status progression (jobRunner.ts)
- File path validation (pathSecurity.ts)
- Authentication checks (auth.ts)
- Migration versioning (db/index.ts)
- API schema validation (routes)

### Frontend Coverage
**Target:** Broad component + page coverage, accessibility compliance

**Test strategy:**
- All components rendered without crashes
- Form validation & error states
- Loading & error states from queries
- Keyboard navigation
- ARIA attributes (progressbar, buttons, labels, scope)

---

## ✅ Accessibility Testing

### Manual Testing
All pages tested for keyboard navigation:
- Tab through all interactive elements
- Enter/Space activates buttons
- Arrow keys work in selects/dropdowns
- Focus visible throughout

### Automated Checks
- Table headers have `scope="col"` ✓
- Form inputs associated with labels via `htmlFor` ✓
- Buttons use `<button>` element, not onClick on divs ✓
- Progress bar has `role="progressbar"` + ARIA attributes ✓
- Error messages with accessible descriptions ✓

### Running Accessibility Audits
Frontend components can be audited with `@axe-core/react`:
```typescript
import { axe } from "@axe-core/react";

test("component is accessible", async () => {
  const { container } = render(<YourComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 📊 CI/CD Integration

### GitHub Actions Workflows

#### `.github/workflows/ci.yml` — Continuous Integration
Runs on every push to `main` and every PR:

**Jobs:**
1. `verify-backend` — typecheck, lint, test (82+ tests), audit
2. `verify-frontend` — typecheck, lint, test, build, audit
3. `docs` — README/survey consistency check
4. `e2e` — Playwright tests (PRs and main only)
5. `secrets` — gitleaks secret scanning

#### `.github/workflows/docker.yml` — Docker Build & Push
Runs on version tags, manual dispatch, or PRs with source changes:

**Changes:**
- PR trigger now includes `backend/src/**` and `frontend/src/**`
- Smoke tests run for both backend and frontend images
- Trivy vulnerability scan on critical/high severity

### Local Pre-commit
```bash
# Suggested git hook to run locally before push
# .git/hooks/pre-commit

#!/bin/bash
cd backend && npm test --silent || exit 1
cd ../frontend && npm test --silent || exit 1
cd ..
echo "✓ All tests passed"
```

---

## 🐛 Debugging Tests

### Backend Debugging
```bash
cd backend

# Run single test with verbose output
npm test -- jobRunner --reporter=verbose

# Debug in Node inspector
node --inspect-brk ./node_modules/.bin/vitest run

# Watch mode for TDD
npm test -- --watch
```

### Frontend Debugging
```bash
cd frontend

# UI mode shows each test with live browser
npm test -- --ui

# Watch mode
npm test:watch

# Debug in browser DevTools
npm test -- --inspect-brk
```

### E2E Debugging
```bash
cd e2e

# Step-by-step debugger with browser visible
npm run test:debug

# Run single test
npx playwright test browse-edit-undo.spec.ts

# Show browser during test
npm run test:headed

# Slow down execution (500ms between actions)
npx playwright test --headed --debug --slow-mo=500
```

---

## 🔧 Troubleshooting

### Backend Tests Fail: "Cannot find package 'bun:sqlite'"
**Solution:** Migration tests are structure-only (check file format, version numbering). Full DB tests require Bun runtime and are deferred.

### Frontend Tests Fail: "localStorage is not defined"
**Solution:** Verified in `test/setup.ts` — localStorage is mocked globally. Check that setup file is loaded in `vitest.config.ts`.

### E2E Tests Fail: "connect ECONNREFUSED"
**Solution:** Ensure docker-compose services are running:
```bash
docker-compose up -d
curl http://localhost/health  # Should return 200
```

### E2E Tests Timeout: "Timeout waiting for selector"
**Solution:** Services may be slow to start. Increase timeout in `playwright.config.ts` or add health check:
```typescript
await page.waitForURL(/./, { timeout: 60000 });
```

### Flaky E2E Tests
**Mitigation:**
- Retry on CI (2 retries configured)
- Use explicit waits, not timeouts
- Avoid race conditions with data setup
- Use `waitFor()` for async state changes

---

## 📈 Test Metrics

### Current Status (post-#35)
| Category | Count | Status |
|----------|-------|--------|
| Backend tests | 82 | ✅ Passing |
| Frontend tests | 8 | ✅ Passing |
| Component tests | 5 | ✅ Passing |
| Hook tests | 1 | ✅ Passing |
| E2E suites | 3 | ✅ Passing |
| Coverage (backend) | 70%+ | ✅ Enforced |
| Accessibility | ✓ | ✅ Verified |

---

## 🚀 Future Improvements

### Phase 2 (Post-MVP)
- [ ] Add Chromatic visual regression testing for components
- [ ] Increase frontend component test count to 30+
- [ ] Add performance benchmarks (lighthouse, web vitals)
- [ ] Integration tests for multi-client WebSocket scenarios
- [ ] Load testing for concurrent job submissions
- [ ] Visual accessibility testing (color contrast, font sizes)

### Known Limitations
- **DB Integration Tests:** Deferred until Bun test runtime is available
- **E2E Runs:** CI only on main/PRs (resource-intensive)
- **Axe Audit:** Manual only (not automated in CI yet)

---

## 📚 References

- [Vitest Docs](https://vitest.dev/)
- [Testing Library Docs](https://testing-library.com/react)
- [Playwright Docs](https://playwright.dev/)
- [AGENTS.md](./AGENTS.md) — Component ownership & responsibility
- [TESTING_STRATEGY.md](./docs/TESTING_STRATEGY.md) (if created)
