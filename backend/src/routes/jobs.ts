/**
 * Jobs router — create, list, get, cancel, undo edit jobs
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { jobs, jobFiles } from "../db/schema.js";
import { createJob, undoJob } from "../services/jobRunner.js";
import { logger } from "../lib/logger.js";

export const jobsRouter = new Hono();

const editOperationSchema = z.object({
  field: z.enum([
    "title",
    "trackLanguage",
    "trackLanguageIETF",
    "trackName",
    "trackFlagDefault",
    "trackFlagEnabled",
    "trackFlagForced",
  ]),
  trackSelector: z
    .object({
      trackType: z.enum(["video", "audio", "subtitles", "unknown", "*"]),
      trackIndex: z.union([z.number().int().min(0), z.literal("*")]),
    })
    .optional(),
  value: z.union([z.string(), z.boolean()]),
});

const createJobSchema = z.object({
  filePaths: z.array(z.string().min(1)).min(1).max(500),
  operations: z.array(editOperationSchema).min(1).max(20),
  dryRun: z.boolean().default(false),
});

// POST /api/jobs — create a new bulk edit job
jobsRouter.post("/", zValidator("json", createJobSchema), async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  const jobId = await createJob(user.uid, user.email, body);

  logger.info(
    { user: user.uid, jobId, files: body.filePaths.length, dryRun: body.dryRun },
    "Job created"
  );

  return c.json({ jobId }, 202);
});

// GET /api/jobs — list recent jobs for this user
jobsRouter.get("/", async (c) => {
  const user = c.get("user");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);

  const userJobs = db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, user.uid))
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .all();

  return c.json(userJobs);
});

// GET /api/jobs/:id — get job + all file results
jobsRouter.get("/:id", async (c) => {
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
      changesSummary: f.changesSummary ? JSON.parse(f.changesSummary) : null,
      // Never expose snapshotBefore in list — it's large and only needed for undo
      snapshotBefore: undefined,
    }));

  return c.json({ ...job, files });
});

// POST /api/jobs/:id/undo — create an undo job for a completed edit job
jobsRouter.post("/:id/undo", async (c) => {
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
    const undoJobId = await undoJob(id, user.uid, user.email);
    logger.info({ user: user.uid, originalJobId: id, undoJobId }, "Undo job created");
    return c.json({ jobId: undoJobId }, 202);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Undo failed";
    return c.json({ error: message }, 400);
  }
});
