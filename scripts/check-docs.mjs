#!/usr/bin/env node
/**
 * Lightweight CI docs-consistency check (DOC-01 / DOC-02).
 *
 * This is deliberately shallow — it doesn't understand prose, it just checks
 * that specific, mechanically-verifiable claims in the docs still match the
 * repo:
 *
 *   1. README.md's documented container base images actually match the
 *      `FROM` line of each Dockerfile's final stage.
 *   2. Every repo-relative file path mentioned (in backticks) in
 *      docs/codebase-survey.md still exists.
 *
 * It is NOT a general doc-accuracy checker — prose claims (e.g. "React 19")
 * still require a human/reviewer to keep honest. Run from the repo root.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;

function fail(message) {
  console.error(`✗ ${message}`);
  failed = true;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

// ── 1. README base images vs Dockerfiles ────────────────────────────────────

function lastFromImage(dockerfilePath) {
  const content = readFileSync(path.join(repoRoot, dockerfilePath), "utf8");
  const fromLines = content
    .split("\n")
    .filter((l) => /^FROM\s/i.test(l.trim()))
    .map((l) => l.trim().split(/\s+/)[1]);
  if (fromLines.length === 0) {
    throw new Error(`No FROM line found in ${dockerfilePath}`);
  }
  // Final stage wins — multi-stage Dockerfiles list earlier build stages first.
  return fromLines[fromLines.length - 1];
}

const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");

for (const dockerfile of ["backend/Dockerfile", "frontend/Dockerfile"]) {
  const image = lastFromImage(dockerfile);
  if (readme.includes(image)) {
    ok(`README.md mentions ${image} (matches ${dockerfile}'s final FROM)`);
  } else {
    fail(
      `README.md does not mention "${image}" — ${dockerfile}'s final stage runs on this base image. ` +
        `Update README.md's Stack/Security sections (DOC-01).`
    );
  }
}

// ── 2. File paths referenced in the survey still exist ──────────────────────

const surveyPath = "docs/codebase-survey.md";
const survey = readFileSync(path.join(repoRoot, surveyPath), "utf8");

// Matches backtick-quoted repo-relative paths like `backend/src/lib/auth.ts`
// or `frontend/src/pages/Browse.tsx:42` (line numbers are stripped). Doesn't
// try to parse brace-expansion (`routes/{a,b}.ts`) — those are expanded below.
const pathPattern = /`((?:backend|frontend|docs|\.github)\/[^`]+)`/g;

// Paths the doc explicitly describes as gitignored/not part of the tracked
// tree (e.g. a local build artifact) — checking existsSync on these would
// just assert "did someone run a build locally", not doc accuracy.
const KNOWN_GITIGNORED = new Set(["backend/dist/"]);

const checked = new Set();
for (const match of survey.matchAll(pathPattern)) {
  let candidate = match[1].split(":")[0]; // strip any trailing :line or :line-range
  if (KNOWN_GITIGNORED.has(candidate)) continue;

  // Expand simple one-level brace lists, e.g. `routes/{mounts,scan}.ts` or
  // `lib/{auth,logger}.ts` — the common shorthand used throughout this doc.
  const braceMatch = candidate.match(/^(.*)\{([^}]+)\}(.*)$/);
  const expanded = braceMatch
    ? braceMatch[2].split(",").map((part) => `${braceMatch[1]}${part.trim()}${braceMatch[3]}`)
    : [candidate];

  for (const p of expanded) {
    if (p.includes("*")) continue; // glob patterns (e.g. __tests__/*.test.ts), not a single file
    if (checked.has(p)) continue;
    checked.add(p);
    if (existsSync(path.join(repoRoot, p))) continue;
    fail(`${surveyPath} references "${p}", which no longer exists in the repo (DOC-02).`);
  }
}

if (checked.size > 0 && !failed) {
  ok(`All ${checked.size} file paths referenced in ${surveyPath} still exist.`);
}

if (failed) {
  process.exit(1);
}
