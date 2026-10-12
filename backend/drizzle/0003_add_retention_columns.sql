-- Add retention configuration columns (post-initial-release)
-- Allows per-job or global retention policy configuration
-- Idempotent: only adds if missing (handled by migration runner)

ALTER TABLE jobs ADD COLUMN retention_days INTEGER DEFAULT 90;
ALTER TABLE job_files ADD COLUMN snapshot_size_bytes INTEGER;

-- Add index on jobs.created_at for efficient retention purge queries
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at);
