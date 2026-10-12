-- Add operations column to jobs table (post-initial-release)
-- Stores the operation payload a job was created to run, for restart recovery.
-- Idempotent: only adds if missing.

-- Note: bun:sqlite doesn't support ALTER TABLE ... ADD COLUMN IF NOT EXISTS,
-- so this migration must handle it manually in the migration runner.
-- This file documents the intent; the runner checks column existence.
ALTER TABLE jobs ADD COLUMN operations TEXT;
