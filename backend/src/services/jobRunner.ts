/**
 * Job runner — processes a bulk edit job asynchronously.
 * Streams per-file progress via WebSocket event emitter.
 * Stores before-snapshots for undo in job_files.snapshot_before.
 */
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { jobs, jobFiles } from "../db/schema.js";
import { scanFile, isValidMkv } from "./scanner.js";
import {
  buildMkvpropeditArgs,
  runMkvpropedit,
  checkWritable,
} from "./editor.js";
import { writeAuditEntry } from "./audit.js";
import { assertSafePath, PathTraversalError } from "../lib/pathSecurity.js";
import { logger } from "../lib/logger.js";
import type { BulkEditRequest, EditOperation, ChangesSummary, TrackSelector } from "../types/index.js";
import { EventEmitter } from "events";

// Global event emitter — WebSocket route subscribes to job events
export const jobEvents = new EventEmitter();
jobEvents.setMaxListeners(100);

// ── Create job ────────────────────────────────────────────────────────────────

export async function createJob(
  userId: string,
  userEmail: string,
  request: BulkEditRequest
): Promise<string> {
  const jobId = uuidv4();
  const now = new Date().toISOString();

  db.insert(jobs)
    .values({
      id: jobId,
      userId,
      userEmail,
      status: "pending",
      dryRun: request.dryRun,
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

// ── Process job ───────────────────────────────────────────────────────────────

async function processJob(
  jobId: string,
  userId: string,
  userEmail: string,
  request: BulkEditRequest
): Promise<void> {
  updateJobStatus(jobId, "running");
  emitJobUpdate(jobId);

  let processedCount = 0;

  for (const filePath of request.filePaths) {
    const fileRow = getJobFile(jobId, filePath);
    if (!fileRow) continue;

    updateFileStatus(fileRow.id, "running");
    emitFileUpdate(fileRow.id);

    try {
      // 1. Path security check
      const safePath = assertSafePath(filePath);

      // 2. EBML magic byte validation
      const valid = await isValidMkv(safePath);
      if (!valid) {
        throw new Error("File does not appear to be a valid Matroska (MKV) file");
      }

      // 3. Write permission check (skip in dry-run)
      if (!request.dryRun) {
        await checkWritable(safePath);
      }

      // 4. Scan current metadata (for undo snapshot + conflict detection)
      const metadata = await scanFile(safePath);
      const snapshotBefore = metadata.rawJson;

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
  const allFailed = allFiles.every((f) => f.status === "failed");
  const finalStatus = allFailed ? "failed" : anyFailed ? "done" : "done";

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

export async function undoJob(
  jobId: string,
  userId: string,
  userEmail: string
): Promise<string> {
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

      const safePath = assertSafePath(originalFile.filePath);
      await checkWritable(safePath);

      // Parse snapshot and rebuild the mkvpropedit restore args
      const snapshot = JSON.parse(originalFile.snapshotBefore);
      const restoreArgs = buildRestoreArgs(safePath, snapshot);

      if (restoreArgs.length <= 1) {
        updateFileStatusFull(fileRow.id, "skipped", null, null, null, null);
      } else {
        const result = await runMkvpropedit(restoreArgs, false);
        if (result.success) {
          updateFileStatusFull(fileRow.id, "success", null, null, null, result.exitCode);
        } else {
          updateFileStatusFull(fileRow.id, "failed", null, null, result.stderr, result.exitCode);
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

  updateJobStatus(undoJobId, "done");
  emitJobComplete(undoJobId);
}

// ── Restore from mkvmerge -J snapshot ────────────────────────────────────────

function buildRestoreArgs(filePath: string, snapshot: unknown): string[] {
  // snapshot is the raw mkvmerge -J output
  // We restore: title (info), and per-track: language, name, flags
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

  // Restore global title
  const title = s.container?.properties?.title;
  if (title !== undefined) {
    args.push("--edit", "info", "--set", `title=${title}`);
  }

  // Restore each track
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

function detectConflicts(
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

function buildChangesSummary(
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
        trackSelector: sel as TrackSelector,
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
