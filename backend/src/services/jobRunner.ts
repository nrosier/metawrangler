/**
 * Job runner — processes a bulk edit job asynchronously.
 * Streams per-file progress via WebSocket event emitter.
 * Stores before-snapshots for undo in job_files.snapshot_before.
 */
import { v4 as uuidv4 } from "uuid";
import { eq, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { jobs, jobFiles } from "../db/schema.js";
import { scanFile, inspectMkvHeader } from "./scanner.js";
import {
  buildMkvpropeditArgs,
  runMkvpropedit,
  checkWritable,
} from "./editor.js";
import { writeAuditEntry } from "./audit.js";
import { assertSafePath, PathTraversalError } from "../lib/pathSecurity.js";
import { logger } from "../lib/logger.js";
import type {
  BulkEditRequest,
  EditOperation,
  ChangesSummary,
  MkvFileMetadata,
} from "../types/index.js";
import { EventEmitter } from "events";

// Global event emitter — WebSocket route subscribes to job events
export const jobEvents = new EventEmitter();
jobEvents.setMaxListeners(100);

// ── Create job ────────────────────────────────────────────────────────────────

export function createJob(
  userId: string,
  userEmail: string,
  request: BulkEditRequest
): string {
  const jobId = uuidv4();
  const now = new Date().toISOString();

  db.insert(jobs)
    .values({
      id: jobId,
      userId,
      userEmail,
      status: "pending",
      dryRun: request.dryRun,
      // Persist what this job was asked to do *before* returning to the
      // caller — if the backend is killed before processJob finishes, the
      // startup reconciliation below needs this to report something more
      // useful than "a job existed and we don't know what it was doing".
      operations: JSON.stringify(request.operations),
      totalFiles: request.filePaths.length,
      processedFiles: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  for (const filePath of request.filePaths) {
    db.insert(jobFiles)
      .values({
        id: uuidv4(),
        jobId,
        filePath,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  // Kick off async processing — do not await
  void processJob(jobId, userId, userEmail, request);

  return jobId;
}

// ── Startup reconciliation ───────────────────────────────────────────────────

/**
 * Jobs only ever run as fire-and-forget in-process promises (see createJob
 * above) — there is no worker/lease model, so a job that was "pending" or
 * "running" when the backend stopped (crash, redeploy, power loss) has no
 * process left that will ever finish it. Call this once at startup, after
 * migrations, so such jobs get an explicit, truthful terminal state instead
 * of leaving the frontend polling forever and the on-disk files in an
 * unknown, un-flagged, partially-edited state.
 *
 * This does NOT attempt to resume or re-run anything — the mkvpropedit
 * process that was running (if any) may have been killed mid-write, so the
 * only safe thing to do is stop pretending the job is still in progress and
 * tell the user to manually verify affected files. A real resume/retry
 * model (claimable rows, leases, idempotent re-scan) is tracked separately
 * as a follow-up and intentionally out of scope here.
 */
export function reconcileInterruptedJobs(): void {
  const stuckJobs = db
    .select()
    .from(jobs)
    .where(or(eq(jobs.status, "pending"), eq(jobs.status, "running")))
    .all();

  if (stuckJobs.length === 0) return;

  const now = new Date().toISOString();
  const interruptedMessage =
    "Backend restarted while this file was being processed. Its on-disk " +
    "state is unknown — verify it manually before relying on it or retrying.";

  for (const job of stuckJobs) {
    const stuckFiles = db
      .select()
      .from(jobFiles)
      .where(eq(jobFiles.jobId, job.id))
      .all()
      .filter((f) => f.status === "pending" || f.status === "running");

    for (const file of stuckFiles) {
      updateFileStatusFull(file.id, "failed", null, null, interruptedMessage, null);
    }

    db.update(jobs)
      .set({ status: "failed", updatedAt: now })
      .where(eq(jobs.id, job.id))
      .run();

    logger.warn(
      { jobId: job.id, userId: job.userId, interruptedFiles: stuckFiles.length },
      "Marked job as failed on startup — it was pending/running when the backend last stopped"
    );

    writeAuditEntry({
      userId: job.userId,
      userEmail: job.userEmail,
      action: "edit",
      jobId: job.id,
      detail: {
        event: "interrupted_on_restart",
        interruptedFiles: stuckFiles.length,
        totalFiles: job.totalFiles,
      },
    });
  }
}

// ── Process job ───────────────────────────────────────────────────────────────

async function processJob(
  jobId: string,
  userId: string,
  userEmail: string,
  request: BulkEditRequest
): Promise<void> {
  updateJobStatus(jobId, "running");
  emitJobUpdate(jobId);

  try {
    await runJobFiles(jobId, userId, userEmail, request);
  } catch (err: unknown) {
    // processJob is invoked fire-and-forget (`void processJob(...)`) by
    // createJob — nothing else awaits this promise. A throw here (e.g. a DB
    // call failing outside the per-file try below) would otherwise become
    // an unhandled rejection, leaving the job stuck in "running" forever
    // with no terminal event ever emitted. Always persist a terminal status.
    logger.error({ jobId, err }, "Job processing failed outside per-file handling");
    updateJobStatus(jobId, "failed");
    emitJobComplete(jobId);
    writeAuditEntry({
      userId,
      userEmail,
      action: "edit",
      jobId,
      detail: {
        event: "job_runner_error",
        error: err instanceof Error ? err.message : "Unknown error",
      },
    });
  }
}

async function runJobFiles(
  jobId: string,
  userId: string,
  userEmail: string,
  request: BulkEditRequest
): Promise<void> {
  let processedCount = 0;

  for (const filePath of request.filePaths) {
    const fileRow = getJobFile(jobId, filePath);
    if (!fileRow) continue;

    updateFileStatus(fileRow.id, "running");
    emitFileUpdate(fileRow.id);

    try {
      // 1. Path security check
      const safePath = await assertSafePath(filePath);

      // 2. EBML magic byte validation
      const header = await inspectMkvHeader(safePath);
      if (!header.valid) {
        logger.error(
          { jobId, filePath, safePath, ...header },
          "File failed MKV validation"
        );
        throw new Error(
          `File does not appear to be a valid Matroska (MKV) file: ${header.reason}`
        );
      }

      // 3. Write permission check (skip in dry-run)
      if (!request.dryRun) {
        await checkWritable(safePath);
      }

      // 4. Scan current metadata (for undo snapshot + conflict detection)
      const metadata = await scanFile(safePath);
      // Store a normalized, tool-agnostic snapshot — not metadata.rawJson.
      // rawJson's shape depends on which tool produced it (mkvmerge vs the
      // ffprobe fallback), which buildRestoreArgs below has no reliable way
      // to tell apart; normalizing here means every undo-capable snapshot
      // this job runner creates from now on can be restored losslessly,
      // regardless of which tool scanned the file.
      const snapshotBefore = JSON.stringify(buildUndoSnapshot(metadata));

      // 5. Detect conflicts (tracks that don't exist in this file)
      const warnings = detectConflicts(metadata, request.operations);

      // 6. Build mkvpropedit args
      const args = buildMkvpropeditArgs(safePath, request.operations, metadata);

      if (args.length <= 1) {
        // Only the filename — no operations resolved
        updateFileStatusFull(fileRow.id, "skipped", snapshotBefore, null, null, null);
        emitFileUpdate(fileRow.id);
        processedCount++;
        updateJobProcessed(jobId, processedCount);
        emitJobUpdate(jobId);
        continue;
      }

      // 7. Run mkvpropedit
      const result = await runMkvpropedit(args, request.dryRun);

      // 8. Build changes summary
      const changesSummary = buildChangesSummary(request.operations, metadata);

      if (result.success) {
        updateFileStatusFull(
          fileRow.id,
          "success",
          snapshotBefore,
          JSON.stringify({ changes: changesSummary, warnings }),
          null,
          result.exitCode
        );
      } else {
        updateFileStatusFull(
          fileRow.id,
          "failed",
          snapshotBefore,
          null,
          result.stderr || "mkvpropedit returned non-zero exit code",
          result.exitCode
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof PathTraversalError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";

      logger.error({ jobId, filePath, err }, "File processing error");

      updateFileStatusFull(fileRow.id, "failed", null, null, message, null);
    }

    emitFileUpdate(fileRow.id);
    processedCount++;
    updateJobProcessed(jobId, processedCount);
    emitJobUpdate(jobId);
  }

  // Determine final job status
  const allFiles = db
    .select()
    .from(jobFiles)
    .where(eq(jobFiles.jobId, jobId))
    .all();

  const anyFailed = allFiles.some((f) => f.status === "failed");
  const allFailed = allFiles.length > 0 && allFiles.every((f) => f.status === "failed");
  // Distinguish full success/skip ("done"), total failure ("failed"), and a
  // mix of the two ("partial") — collapsing partial into "done" hid partial
  // failures from job status alone (QUAL-03).
  const finalStatus = allFailed ? "failed" : anyFailed ? "partial" : "done";

  updateJobStatus(jobId, finalStatus);
  emitJobComplete(jobId);

  writeAuditEntry({
    userId,
    userEmail,
    action: "edit",
    jobId,
    detail: {
      totalFiles: request.filePaths.length,
      processedFiles: processedCount,
      dryRun: request.dryRun,
      finalStatus,
    },
  });
}

// ── Undo a job ────────────────────────────────────────────────────────────────

export function undoJob(
  jobId: string,
  userId: string,
  userEmail: string
): string {
  const originalFiles = db
    .select()
    .from(jobFiles)
    .where(eq(jobFiles.jobId, jobId))
    .all();

  // Only undo files that succeeded and have a snapshot
  const undoable = originalFiles.filter(
    (f) => f.status === "success" && f.snapshotBefore
  );

  if (undoable.length === 0) {
    throw new Error("No undoable files found for this job");
  }

  const undoJobId = uuidv4();
  const now = new Date().toISOString();

  db.insert(jobs)
    .values({
      id: undoJobId,
      userId,
      userEmail,
      status: "pending",
      dryRun: false,
      totalFiles: undoable.length,
      processedFiles: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  for (const f of undoable) {
    db.insert(jobFiles)
      .values({
        id: uuidv4(),
        jobId: undoJobId,
        filePath: f.filePath,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  writeAuditEntry({
    userId,
    userEmail,
    action: "undo",
    jobId: undoJobId,
    detail: { originalJobId: jobId, undoableFiles: undoable.length },
  });

  // Process the undo job asynchronously using snapshot restore
  void processUndoJob(undoJobId, undoable);

  return undoJobId;
}

async function processUndoJob(
  undoJobId: string,
  originalFiles: Array<{ filePath: string; snapshotBefore: string | null; id: string }>
): Promise<void> {
  updateJobStatus(undoJobId, "running");
  emitJobUpdate(undoJobId);

  try {
    await runUndoJobFiles(undoJobId, originalFiles);
  } catch (err: unknown) {
    // Same reasoning as processJob's wrapper: undoJob() also fires this
    // off without awaiting it, so an exception here must not become an
    // unhandled rejection that leaves the undo job stuck in "running".
    logger.error({ undoJobId, err }, "Undo job processing failed outside per-file handling");
    updateJobStatus(undoJobId, "failed");
    emitJobComplete(undoJobId);
  }
}

async function runUndoJobFiles(
  undoJobId: string,
  originalFiles: Array<{ filePath: string; snapshotBefore: string | null; id: string }>
): Promise<void> {
  let processedCount = 0;

  for (const originalFile of originalFiles) {
    const fileRow = db
      .select()
      .from(jobFiles)
      .where(eq(jobFiles.jobId, undoJobId))
      .all()
      .find((f) => f.filePath === originalFile.filePath);

    if (!fileRow) continue;

    updateFileStatus(fileRow.id, "running");
    emitFileUpdate(fileRow.id);

    try {
      if (!originalFile.snapshotBefore) {
        throw new Error("No snapshot available for undo");
      }

      const safePath = await assertSafePath(originalFile.filePath);
      await checkWritable(safePath);

      // Snapshot the file's current (post-edit) state *before* restoring it,
      // and store it as this undo job's own before-snapshot. Without this,
      // undo jobs could never themselves be undone (there was nothing to
      // restore to) — contradicting the documented "undo is itself undoable"
      // behavior.
      const currentMetadata = await scanFile(safePath);
      const preUndoSnapshot = JSON.stringify(buildUndoSnapshot(currentMetadata));

      // Parse the original snapshot and rebuild the mkvpropedit restore args
      const snapshot = JSON.parse(originalFile.snapshotBefore) as unknown;
      const restoreArgs = buildRestoreArgs(safePath, snapshot);

      if (restoreArgs.length <= 1) {
        updateFileStatusFull(
          fileRow.id,
          "skipped",
          preUndoSnapshot,
          null,
          "Original snapshot could not be converted into restore operations " +
            "(it predates lossless-undo support, or came from an unrecognized " +
            "scan format) — nothing was changed on this file.",
          null
        );
      } else {
        const result = await runMkvpropedit(restoreArgs, false);
        if (result.success) {
          updateFileStatusFull(fileRow.id, "success", preUndoSnapshot, null, null, result.exitCode);
        } else {
          updateFileStatusFull(fileRow.id, "failed", preUndoSnapshot, null, result.stderr, result.exitCode);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      updateFileStatusFull(fileRow.id, "failed", null, null, message, null);
    }

    emitFileUpdate(fileRow.id);
    processedCount++;
    updateJobProcessed(undoJobId, processedCount);
    emitJobUpdate(undoJobId);
  }

  // Compute the final status from actual per-file outcomes instead of always
  // reporting "done" — a batch where every file failed to restore must not
  // look identical to one that fully succeeded.
  const allFiles = db
    .select()
    .from(jobFiles)
    .where(eq(jobFiles.jobId, undoJobId))
    .all();
  const anyFailed = allFiles.some((f) => f.status === "failed");
  const allFailed = allFiles.length > 0 && allFiles.every((f) => f.status === "failed");
  const finalStatus = allFailed ? "failed" : anyFailed ? "partial" : "done";

  updateJobStatus(undoJobId, finalStatus);
  emitJobComplete(undoJobId);
}

// ── Undo snapshot (normalized, tool-agnostic) ────────────────────────────────
//
// Stored as jobFiles.snapshotBefore. Captures exactly what buildRestoreArgs
// needs to losslessly reproduce the file's prior state — including fields
// that were *absent* before an edit, via explicit nulls restorable with
// `--delete` rather than only ever `--set`.

export const UNDO_SNAPSHOT_VERSION = 2;

export interface UndoSnapshotTrack {
  id: number;
  language: string | null;
  languageIETF: string | null;
  name: string | null;
  flagDefault: boolean;
  flagEnabled: boolean;
  flagForced: boolean;
}

export interface UndoSnapshot {
  schemaVersion: typeof UNDO_SNAPSHOT_VERSION;
  title: string | null;
  tracks: UndoSnapshotTrack[];
}

function buildUndoSnapshot(metadata: MkvFileMetadata): UndoSnapshot {
  return {
    schemaVersion: UNDO_SNAPSHOT_VERSION,
    title: metadata.title,
    tracks: metadata.tracks.map((t) => ({
      id: t.id,
      language: t.language,
      languageIETF: t.languageIETF,
      name: t.name,
      flagDefault: t.flagDefault,
      flagEnabled: t.flagEnabled,
      flagForced: t.flagForced,
    })),
  };
}

export function isUndoSnapshot(snapshot: unknown): snapshot is UndoSnapshot {
  return (
    !!snapshot &&
    typeof snapshot === "object" &&
    (snapshot as { schemaVersion?: unknown }).schemaVersion === UNDO_SNAPSHOT_VERSION
  );
}

// ── Restore (build mkvpropedit args from a stored undo snapshot) ────────────

function buildRestoreArgs(filePath: string, snapshot: unknown): string[] {
  if (isUndoSnapshot(snapshot)) {
    return buildRestoreArgsFromSnapshot(filePath, snapshot);
  }
  // Snapshot predates UNDO_SNAPSHOT_VERSION (created before this normalized
  // format existed) — fall back to the legacy mkvmerge-shape-only, --set-only
  // behavior so old jobs remain undoable to the same (limited) degree they
  // always were. New jobs never produce this shape, so this branch is purely
  // for jobs created before this fix shipped.
  return buildRestoreArgsLegacy(filePath, snapshot);
}

function buildRestoreArgsFromSnapshot(filePath: string, snapshot: UndoSnapshot): string[] {
  const args: string[] = [filePath];

  if (snapshot.title !== null) {
    args.push("--edit", "info", "--set", `title=${snapshot.title}`);
  } else {
    args.push("--edit", "info", "--delete", "title");
  }

  for (const track of snapshot.tracks) {
    const editTarget = `track:${track.id + 1}`; // mkvpropedit is 1-based
    const trackArgs: string[] = [];

    if (track.language !== null) trackArgs.push("--set", `language=${track.language}`);
    else trackArgs.push("--delete", "language");

    if (track.languageIETF !== null) trackArgs.push("--set", `language-ietf=${track.languageIETF}`);
    else trackArgs.push("--delete", "language-ietf");

    if (track.name !== null) trackArgs.push("--set", `name=${track.name}`);
    else trackArgs.push("--delete", "name");

    // Flags have no "absent" state in the normalized model (scanning always
    // yields a concrete boolean), so they're always restored with --set.
    trackArgs.push("--set", `flag-default=${track.flagDefault ? "1" : "0"}`);
    trackArgs.push("--set", `flag-enabled=${track.flagEnabled ? "1" : "0"}`);
    trackArgs.push("--set", `flag-forced=${track.flagForced ? "1" : "0"}`);

    args.push("--edit", editTarget, ...trackArgs);
  }

  return args;
}

/**
 * Legacy restore path for undo snapshots stored before UNDO_SNAPSHOT_VERSION
 * existed — these hold the raw mkvmerge -J output directly (and, for files
 * that fell back to ffprobe, raw ffprobe JSON which this never understood).
 * Best-effort only: can only --set fields that were present, never --delete
 * fields an edit added that weren't there originally.
 */
function buildRestoreArgsLegacy(filePath: string, snapshot: unknown): string[] {
  const args: string[] = [filePath];

  if (!snapshot || typeof snapshot !== "object") return args;

  const s = snapshot as {
    container?: { properties?: { title?: string } };
    tracks?: Array<{
      id: number;
      properties?: {
        language?: string;
        language_ietf?: string;
        track_name?: string;
        flag_default?: boolean;
        flag_enabled?: boolean;
        flag_forced?: boolean;
      };
    }>;
  };

  const title = s.container?.properties?.title;
  if (title !== undefined) {
    args.push("--edit", "info", "--set", `title=${title}`);
  }

  for (const track of s.tracks ?? []) {
    const p = track.properties ?? {};
    const editTarget = `track:${track.id + 1}`;
    const trackArgs: string[] = [];

    if (p.language !== undefined) trackArgs.push("--set", `language=${p.language}`);
    if (p.language_ietf !== undefined) trackArgs.push("--set", `language-ietf=${p.language_ietf}`);
    if (p.track_name !== undefined) trackArgs.push("--set", `name=${p.track_name}`);
    if (p.flag_default !== undefined) trackArgs.push("--set", `flag-default=${p.flag_default ? "1" : "0"}`);
    if (p.flag_enabled !== undefined) trackArgs.push("--set", `flag-enabled=${p.flag_enabled ? "1" : "0"}`);
    if (p.flag_forced !== undefined) trackArgs.push("--set", `flag-forced=${p.flag_forced ? "1" : "0"}`);

    if (trackArgs.length > 0) {
      args.push("--edit", editTarget, ...trackArgs);
    }
  }

  return args;
}

// ── Conflict detection ────────────────────────────────────────────────────────

export function detectConflicts(
  metadata: { tracks: Array<{ id: number; type: string }> },
  operations: EditOperation[]
): string[] {
  const warnings: string[] = [];

  for (const op of operations) {
    const sel = op.trackSelector;
    if (!sel || sel.trackIndex === "*") continue;

    const candidates = metadata.tracks.filter(
      (t) => sel.trackType === "*" || t.type === sel.trackType
    );

    if (sel.trackIndex >= candidates.length) {
      warnings.push(
        `Track ${sel.trackType}[${sel.trackIndex}] does not exist in this file (has ${candidates.length} ${sel.trackType} track(s)). Operation '${op.field}' will be skipped for this file.`
      );
    }
  }

  return warnings;
}

// ── Change summary builder ────────────────────────────────────────────────────

export function buildChangesSummary(
  operations: EditOperation[],
  metadata: { title: string | null; tracks: Array<{ id: number; type: string; language: string | null; name: string | null; flagDefault: boolean; flagEnabled: boolean; flagForced: boolean; languageIETF: string | null }> }
): ChangesSummary[] {
  const summaries: ChangesSummary[] = [];

  for (const op of operations) {
    if (op.field === "title") {
      summaries.push({
        field: "title",
        before: metadata.title,
        after: op.value,
      });
      continue;
    }

    const sel = op.trackSelector;
    if (!sel) continue;

    const candidates = metadata.tracks.filter(
      (t) => sel.trackType === "*" || t.type === sel.trackType
    );

    const targets =
      sel.trackIndex === "*" ? candidates : [candidates[sel.trackIndex]].filter(Boolean);

    for (const track of targets) {
      if (!track) continue;
      let before: string | boolean | null = null;

      switch (op.field) {
        case "trackLanguage": before = track.language; break;
        case "trackLanguageIETF": before = track.languageIETF; break;
        case "trackName": before = track.name; break;
        case "trackFlagDefault": before = track.flagDefault; break;
        case "trackFlagEnabled": before = track.flagEnabled; break;
        case "trackFlagForced": before = track.flagForced; break;
      }

      summaries.push({
        field: op.field,
        trackSelector: sel,
        before,
        after: op.value,
      });
    }
  }

  return summaries;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function updateJobStatus(jobId: string, status: string): void {
  db.update(jobs)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(jobs.id, jobId))
    .run();
}

function updateJobProcessed(jobId: string, count: number): void {
  db.update(jobs)
    .set({ processedFiles: count, updatedAt: new Date().toISOString() })
    .where(eq(jobs.id, jobId))
    .run();
}

function updateFileStatus(fileId: string, status: string): void {
  db.update(jobFiles)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(jobFiles.id, fileId))
    .run();
}

function updateFileStatusFull(
  fileId: string,
  status: string,
  snapshotBefore: string | null,
  changesSummary: string | null,
  errorMessage: string | null,
  exitCode: number | null
): void {
  db.update(jobFiles)
    .set({
      status,
      snapshotBefore: snapshotBefore ?? undefined,
      changesSummary: changesSummary ?? undefined,
      errorMessage: errorMessage ?? undefined,
      exitCode: exitCode ?? undefined,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(jobFiles.id, fileId))
    .run();
}

function getJobFile(
  jobId: string,
  filePath: string
): { id: string } | undefined {
  return db
    .select()
    .from(jobFiles)
    .where(eq(jobFiles.jobId, jobId))
    .all()
    .find((f) => f.filePath === filePath);
}

// ── Event emitters ────────────────────────────────────────────────────────────

function emitJobUpdate(jobId: string): void {
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (job) jobEvents.emit(`job:${jobId}`, { type: "job_update", job });
}

function emitFileUpdate(fileId: string): void {
  const file = db.select().from(jobFiles).where(eq(jobFiles.id, fileId)).get();
  if (file) {
    const jobId = file.jobId;
    jobEvents.emit(`job:${jobId}`, { type: "file_update", file });
  }
}

function emitJobComplete(jobId: string): void {
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (job) jobEvents.emit(`job:${jobId}`, { type: "job_complete", job });
}
