/**
 * Admin routes — database maintenance, purging, and statistics
 * All endpoints require admin authentication (SEC-03)
 */
import { Hono } from "hono";
import { db } from "../db/index.js";
import { jobs, jobFiles, auditLog } from "../db/schema.js";
import { lt, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireAdmin } from "../lib/auth.js";
import { writeAuditEntry } from "../services/audit.js";

export const adminRouter = new Hono();

// ── Database statistics ───────────────────────────────────────────────────────

/**
 * GET /api/admin/db-stats
 * Returns database size and record counts for monitoring
 */
adminRouter.get("/db-stats", requireAdmin, (c) => {
  try {
    const jobCount = db
      .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(jobs)
      .get()?.count ?? 0;

    const jobFileCount = db
      .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(jobFiles)
      .get()?.count ?? 0;

    const auditCount = db
      .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(auditLog)
      .get()?.count ?? 0;

    // Sum snapshot sizes (may be null for older records)
    const totalSnapshotBytes = db
      .select({ total: sql<number>`COALESCE(SUM(snapshot_size_bytes), 0)`.mapWith(Number) })
      .from(jobFiles)
      .get()?.total ?? 0;

    // Get date range of records
    const oldestRecord = db
      .select({ createdAt: jobs.createdAt })
      .from(jobs)
      .orderBy(jobs.createdAt)
      .limit(1)
      .get();

    return c.json({
      jobCount,
      jobFileCount,
      auditCount,
      totalSnapshotBytes,
      oldestJobCreatedAt: oldestRecord?.createdAt ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to get DB stats");
    return c.json({ error: "Failed to compute stats" }, 500);
  }
});

// ── Retention and purging ──────────────────────────────────────────────────────

interface PurgeRequest {
  dryRun?: boolean;
  retentionDaysJobs?: number;
  retentionDaysAudit?: number;
}

/**
 * POST /api/admin/purge-old-records
 * Deletes jobs and audit entries older than retention window
 *
 * Request body:
 * {
 *   dryRun: true,                    // Show what would be deleted, don't actually delete
 *   retentionDaysJobs: 90,           // Keep jobs for N days (default 90)
 *   retentionDaysAudit: 180          // Keep audit entries for N days (default 180)
 * }
 *
 * Response:
 * {
 *   jobsDeleted: 5,
 *   auditDeleted: 20,
 *   bytesFreed: 50000,
 *   dryRun: false,
 *   cutoffJobs: "2026-07-12T...",
 *   cutoffAudit: "2026-04-15T..."
 * }
 */
adminRouter.post("/purge-old-records", requireAdmin, async (c) => {
  try {
    const body = (await c.req.json()) as PurgeRequest;
    const dryRun = body.dryRun ?? true;
    const retentionDaysJobs = body.retentionDaysJobs ?? 90;
    const retentionDaysAudit = body.retentionDaysAudit ?? 180;

    // Calculate cutoff dates (UTC, ISO string)
    const now = new Date();
    const cutoffJobs = new Date(now.getTime() - retentionDaysJobs * 24 * 60 * 60 * 1000).toISOString();
    const cutoffAudit = new Date(
      now.getTime() - retentionDaysAudit * 24 * 60 * 60 * 1000
    ).toISOString();

    // Count what would be deleted
    const jobsToDelete = db
      .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(jobs)
      .where(lt(jobs.createdAt, cutoffJobs))
      .get()?.count ?? 0;

    const auditToDelete = db
      .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(auditLog)
      .where(lt(auditLog.createdAt, cutoffAudit))
      .get()?.count ?? 0;

    // Estimate bytes freed from snapshots (if collecting stats)
    const bytesFreed = db
      .select({ total: sql<number>`COALESCE(SUM(snapshot_size_bytes), 0)`.mapWith(Number) })
      .from(jobFiles)
      .where(
        sql`job_id IN (SELECT id FROM jobs WHERE created_at < ${cutoffJobs})`
      )
      .get()?.total ?? 0;

    // If dryRun, just report what would happen
    if (dryRun) {
      logger.info(
        { jobsToDelete, auditToDelete, bytesFreed, cutoffJobs, cutoffAudit },
        "Purge dry-run"
      );
      return c.json({
        jobsDeleted: jobsToDelete,
        auditDeleted: auditToDelete,
        bytesFreed,
        dryRun: true,
        cutoffJobs,
        cutoffAudit,
      });
    }

    // Actually delete (jobs cascade deletes job_files)
    db.delete(jobs)
      .where(lt(jobs.createdAt, cutoffJobs))
      .run();

    db.delete(auditLog)
      .where(lt(auditLog.createdAt, cutoffAudit))
      .run();

    const user = c.get("user");
    writeAuditEntry({
      userId: user.uid,
      userEmail: user.email,
      action: "edit",
      detail: {
        event: "database_purge",
        jobsDeleted: jobsToDelete,
        auditDeleted: auditToDelete,
        bytesFreed,
        retentionDaysJobs,
        retentionDaysAudit,
      },
    });

    logger.info(
      { jobsToDelete, auditToDelete, bytesFreed, cutoffJobs, cutoffAudit },
      "Database purge completed"
    );

    return c.json({
      jobsDeleted: jobsToDelete,
      auditDeleted: auditToDelete,
      bytesFreed,
      dryRun: false,
      cutoffJobs,
      cutoffAudit,
    });
  } catch (err) {
    logger.error({ err }, "Failed to purge old records");
    return c.json({ error: "Purge failed" }, 500);
  }
});
