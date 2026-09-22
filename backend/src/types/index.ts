/**
 * Shared TypeScript types — mirrored in the frontend via the shared package
 */

// ── MKV track metadata ────────────────────────────────────────────────────────

export type TrackType = "video" | "audio" | "subtitles" | "unknown";

export interface MkvTrack {
  /** mkvmerge track id (0-based within its type) */
  id: number;
  type: TrackType;
  codecId: string;
  /** ISO 639-2 or BCP-47 language code */
  language: string | null;
  languageIETF: string | null;
  name: string | null;
  flagDefault: boolean;
  flagEnabled: boolean;
  flagForced: boolean;
  /** Channel count for audio */
  channels?: number;
  /** Pixel dimensions for video */
  pixelWidth?: number;
  pixelHeight?: number;
}

export interface MkvFileMetadata {
  filePath: string;
  title: string | null;
  tracks: MkvTrack[];
  /** Raw mkvmerge -J output stored for undo snapshots */
  rawJson: string;
}

// ── Editable field spec ───────────────────────────────────────────────────────

/** Which fields can be bulk-edited */
export type EditableField =
  | "title"
  | "trackLanguage"
  | "trackLanguageIETF"
  | "trackName"
  | "trackFlagDefault"
  | "trackFlagEnabled"
  | "trackFlagForced";

export interface TrackSelector {
  /** "audio" | "subtitles" | "video" | "*" (all tracks of the type) */
  trackType: TrackType | "*";
  /** 0-based index within that type, or "*" for all */
  trackIndex: number | "*";
}

export interface EditOperation {
  field: EditableField;
  trackSelector?: TrackSelector; // only needed for track-level fields
  value: string | boolean;
}

export interface BulkEditRequest {
  filePaths: string[];
  operations: EditOperation[];
  dryRun: boolean;
}

// ── Job types ─────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "running" | "done" | "failed" | "cancelled";
export type FileStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export interface Job {
  id: string;
  userId: string;
  userEmail: string;
  status: JobStatus;
  dryRun: boolean;
  totalFiles: number;
  processedFiles: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobFile {
  id: string;
  jobId: string;
  filePath: string;
  status: FileStatus;
  changesSummary?: { changes: ChangesSummary[]; warnings?: string[] } | null;
  errorMessage?: string;
  exitCode?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChangesSummary {
  field: EditableField;
  trackSelector?: TrackSelector;
  before: string | boolean | null;
  after: string | boolean;
}

// ── Mount types ───────────────────────────────────────────────────────────────

export type MountType = "movies" | "series";

export interface Mount {
  id: string;
  name: string;
  path: string;
  type: MountType;
  createdAt: string;
  updatedAt: string;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export type AuditAction =
  | "scan"
  | "edit"
  | "undo"
  | "mount_add"
  | "mount_remove"
  | "mount_update";

export interface AuditEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: AuditAction;
  jobId?: string;
  detail?: Record<string, unknown>;
  createdAt: string;
}

// ── WebSocket messages ────────────────────────────────────────────────────────

export type WsMessage =
  | { type: "job_update"; job: Job }
  | { type: "file_update"; file: JobFile }
  | { type: "job_complete"; job: Job }
  | { type: "error"; message: string };
