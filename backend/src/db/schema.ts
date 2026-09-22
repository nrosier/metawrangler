/**
 * Database schema — Drizzle ORM + SQLite
 * Tables: mounts, jobs, job_files, audit_log
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ── Mount points ──────────────────────────────────────────────────────────────
export const mounts = sqliteTable("mounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Absolute path inside the container */
  path: text("path").notNull().unique(),
  /** "movies" | "series" */
  type: text("type", { enum: ["movies", "series"] }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Edit jobs ─────────────────────────────────────────────────────────────────
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  /** User id from Authentik header */
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  /** "pending" | "running" | "done" | "failed" | "cancelled" */
  status: text("status").notNull().default("pending"),
  /** true = dry run, don't write anything */
  dryRun: integer("dry_run", { mode: "boolean" }).notNull().default(false),
  totalFiles: integer("total_files").notNull().default(0),
  processedFiles: integer("processed_files").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Per-file results within a job ─────────────────────────────────────────────
export const jobFiles = sqliteTable("job_files", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  /** "pending" | "running" | "success" | "failed" | "skipped" */
  status: text("status").notNull().default("pending"),
  /** JSON string: the changes applied (or that would be applied in dry-run) */
  changesSummary: text("changes_summary"),
  /** JSON string: snapshot of metadata BEFORE the edit (used for undo) */
  snapshotBefore: text("snapshot_before"),
  /** stderr / error message if failed */
  errorMessage: text("error_message"),
  /** mkvpropedit exit code */
  exitCode: integer("exit_code"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Audit log ─────────────────────────────────────────────────────────────────
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  /** "scan" | "edit" | "undo" | "mount_add" | "mount_remove" | "mount_update" */
  action: text("action").notNull(),
  /** Optional: which job this relates to */
  jobId: text("job_id"),
  /** Free-form detail JSON */
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
});
