/**
 * Shared types, schemas, and utilities — can be imported by both backend
 * and frontend (via manual copying or a future monorepo package structure).
 */

// Re-export all core types from the backend's types module
export type {
  TrackType,
  MkvTrack,
  MkvFileMetadata,
  EditableField,
  TrackSelector,
  EditOperation,
  BulkEditRequest,
  JobStatus,
  FileStatus,
  Job,
  JobFile,
  ChangesSummary,
  MountType,
  Mount,
  AuditAction,
  AuditEntry,
  WsMessage,
} from "../types/index.js";

// Re-export validation schemas
export { editOperationSchema } from "../validation/editOperation.js";

// Export regex patterns used in validation
export const ISO_639_2_REGEX = /^[a-z]{3}$/;
export const BCP_47_REGEX = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/;

// ── Undo snapshot types and version ────────────────────────────────────────

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

/**
 * Type guard to check if a stored snapshot matches the current schema version.
 * Used for versioning undo snapshots and supporting schema evolution.
 */
export function isUndoSnapshot(snapshot: unknown): snapshot is UndoSnapshot {
  return (
    !!snapshot &&
    typeof snapshot === "object" &&
    (snapshot as { schemaVersion?: unknown }).schemaVersion === UNDO_SNAPSHOT_VERSION
  );
}

// ── Pure helper functions (re-exported from jobRunner.ts) ──────────────────

/**
 * Detects track selector conflicts in bulk-edit operations.
 * Returns a list of warnings for operations that target non-existent tracks.
 */
export function detectConflicts(
  metadata: { tracks: Array<{ id: number; type: string }> },
  operations: Array<{ field: string; trackSelector?: { trackType: string; trackIndex: number | "*" } }>
): string[] {
  const warnings: string[] = [];

  for (const op of operations) {
    const sel = op.trackSelector;
    if (!sel || sel.trackIndex === "*") continue;

    const candidates = metadata.tracks.filter(
      (t) => sel.trackType === "*" || t.type === sel.trackType
    );

    if (typeof sel.trackIndex === "number" && sel.trackIndex >= candidates.length) {
      warnings.push(
        `Track ${sel.trackType}[${sel.trackIndex}] does not exist in this file (has ${candidates.length} ${sel.trackType} track(s)). Operation '${op.field}' will be skipped for this file.`
      );
    }
  }

  return warnings;
}

/**
 * Builds a before/after summary of changes from bulk-edit operations.
 * Used for audit logs, job file results, and UI display.
 */
export function buildChangesSummary(
  operations: Array<{
    field: string;
    value: string | boolean;
    trackSelector?: { trackType: string; trackIndex: number | "*" };
  }>,
  metadata: {
    title: string | null;
    tracks: Array<{
      id: number;
      type: string;
      language: string | null;
      name: string | null;
      flagDefault: boolean;
      flagEnabled: boolean;
      flagForced: boolean;
      languageIETF: string | null;
    }>;
  }
): Array<{
  field: string;
  trackSelector?: { trackType: string; trackIndex: number | "*" };
  before: string | boolean | null;
  after: string | boolean;
}> {
  const summaries: Array<{
    field: string;
    trackSelector?: { trackType: string; trackIndex: number | "*" };
    before: string | boolean | null;
    after: string | boolean;
  }> = [];

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
        case "trackLanguage":
          before = track.language;
          break;
        case "trackLanguageIETF":
          before = track.languageIETF;
          break;
        case "trackName":
          before = track.name;
          break;
        case "trackFlagDefault":
          before = track.flagDefault;
          break;
        case "trackFlagEnabled":
          before = track.flagEnabled;
          break;
        case "trackFlagForced":
          before = track.flagForced;
          break;
      }

      summaries.push({
        field: op.field,
        trackSelector: { trackType: sel.trackType, trackIndex: track.id },
        before,
        after: op.value,
      });
    }
  }

  return summaries;
}
