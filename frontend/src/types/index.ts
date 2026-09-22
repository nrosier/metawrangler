/**
 * Shared types — mirrors backend/src/types/index.ts
 * Keep in sync manually or replace with a shared package.
 */

export type TrackType = "video" | "audio" | "subtitles" | "unknown";

export interface MkvTrack {
  id: number;
  type: TrackType;
  codecId: string;
  language: string | null;
  languageIETF: string | null;
  name: string | null;
  flagDefault: boolean;
  flagEnabled: boolean;
  flagForced: boolean;
  channels?: number;
  pixelWidth?: number;
  pixelHeight?: number;
}

export interface MkvFileMetadata {
  filePath: string;
  title: string | null;
  tracks: MkvTrack[];
}

export type EditableField =
  | "title"
  | "trackLanguage"
  | "trackLanguageIETF"
  | "trackName"
  | "trackFlagDefault"
  | "trackFlagEnabled"
  | "trackFlagForced";

export interface TrackSelector {
  trackType: TrackType | "*";
  trackIndex: number | "*";
}

export interface EditOperation {
  field: EditableField;
  trackSelector?: TrackSelector;
  value: string | boolean;
}

export interface BulkEditRequest {
  filePaths: string[];
  operations: EditOperation[];
  dryRun: boolean;
}

export type JobStatus = "pending" | "running" | "done" | "failed" | "cancelled";
export type FileStatus = "pending" | "running" | "success" | "failed" | "skipped";

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

export interface ChangeEntry {
  field: EditableField;
  trackSelector?: TrackSelector;
  before: string | boolean | null;
  after: string | boolean;
}

export interface JobFile {
  id: string;
  jobId: string;
  filePath: string;
  status: FileStatus;
  changesSummary?: { changes: ChangeEntry[]; warnings?: string[] } | null;
  errorMessage?: string | null;
  exitCode?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type MountType = "movies" | "series";

export interface Mount {
  id: string;
  name: string;
  path: string;
  type: MountType;
  createdAt: string;
  updatedAt: string;
  health?: { reachable: boolean; writable: boolean; mkvCount: number };
}

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

export type WsMessage =
  | { type: "job_update"; job: Job }
  | { type: "file_update"; file: JobFile }
  | { type: "job_complete"; job: Job }
  | { type: "error"; message: string };
