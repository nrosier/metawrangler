/**
 * Jobs router — create, list, get, cancel, undo edit jobs
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, desc, and, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { jobs, jobFiles } from "../db/schema.js";
import { createJob, undoJob } from "../services/jobRunner.js";
import { logger } from "../lib/logger.js";
import { editOperationSchema } from "../validation/editOperation.js";

export const jobsRouter = new Hono();

const createJobSchema = z.object({
  filePaths: z.array(z.string().min(1)).min(1).max(500),
  operations: z.array(editOperationSchema).min(1).max(20),
  dryRun: z.boolean().default(false),
});

// Per-user cap on simultaneously active (pending/running) jobs. Each job
// already runs its own files sequentially and shares the global tool-process
// semaphore (see lib/toolConcurrency.ts), but with no cap at all a single
// user could still queue up an unbounded number of jobs (PERF-02).
const MAX_ACTIVE_JOBS_PER_USER = 3;

// POST /api/jobs — create a new bulk edit job
jobsRouter.post("/", zValidator("json", createJobSchema), (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  const activeJobCount = db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.userId, user.uid), or(eq(jobs.status, "pending"), eq(jobs.status, "running")))
    )
    .all().length;

  if (activeJobCount >= MAX_ACTIVE_JOBS_PER_USER) {
    c.header("Retry-After", "30");
    return c.json(
      {
        error:
          `You already have ${activeJobCount} active jobs (limit ${MAX_ACTIVE_JOBS_PER_USER}). ` +
          "Wait for one to finish before starting another.",
      },
      429
    );
  }

  const jobId = createJob(user.uid, user.email, body);

  logger.info(
    { user: user.uid, jobId, files: body.filePaths.length, dryRun: body.dryRun },
    "Job created"
  );

  return c.json({ jobId }, 202);
});

// GET /api/jobs — list recent jobs for this user
jobsRouter.get("/", (c) => {
  const user = c.get("user");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);

  const userJobs = db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, user.uid))
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .all()
    // operations is persisted for startup reconciliation (see jobRunner.ts),
    // not part of the public Job shape — don't leak it into API responses.
    .map((j) => ({ ...j, operations: undefined }));

  return c.json(userJobs);
});

// GET /api/jobs/:id — get job + all file results
jobsRouter.get("/:id", (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
  if (!job) return c.json({ error: "Job not found" }, 404);
  if (job.userId !== user.uid) return c.json({ error: "Forbidden" }, 403);

  const files = db
    .select()
    .from(jobFiles)
    .where(eq(jobFiles.jobId, id))
    .all()
    .map((f) => ({
      ...f,
      changesSummary: f.changesSummary
        ? (JSON.parse(f.changesSummary) as Record<string, unknown>)
        : null,
      // Never expose snapshotBefore in list — it's large and only needed for undo
      snapshotBefore: undefined,
    }));

  return c.json({ ...job, operations: undefined, files });
});

// POST /api/jobs/:id/undo — create an undo job for a completed edit job
jobsRouter.post("/:id/undo", (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
  if (!job) return c.json({ error: "Job not found" }, 404);
  if (job.userId !== user.uid) return c.json({ error: "Forbidden" }, 403);
  if (job.status !== "done") {
    return c.json({ error: "Only completed jobs can be undone" }, 400);
  }
  if (job.dryRun) {
    return c.json({ error: "Dry-run jobs cannot be undone" }, 400);
  }

  try {
    const undoJobId = undoJob(id, user.uid, user.email);
    logger.info({ user: user.uid, originalJobId: id, undoJobId }, "Undo job created");
    return c.json({ jobId: undoJobId }, 202);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Undo failed";
    return c.json({ error: message }, 400);
  }
});
