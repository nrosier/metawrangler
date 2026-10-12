/**
 * WebSocket route — streams job progress to the browser.
 * Clients connect to /ws/jobs/:id and receive JSON messages until job completes.
 */
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { jobs } from "../db/schema.js";
import { jobEvents } from "../services/jobRunner.js";
import { logger } from "../lib/logger.js";
import type { Job, JobStatus, WsMessage } from "../types/index.js";

export const wsRouter = new Hono();

wsRouter.get(
  "/jobs/:id",
  upgradeWebSocket((c) => {
    const jobId = c.req.param("id") ?? "";
    // Populated by authMiddleware, which is mounted on "/ws/*" in index.ts.
    const user = c.get("user");

    // Per-connection event handler reference, so onClose can remove exactly
    // this socket's listener instead of every listener for the job (removing
    // all of them would silently kill live updates for every other viewer).
    let handler: ((msg: WsMessage) => void) | null = null;

    return {
      onOpen(_, ws) {
        logger.debug({ jobId, user: user.uid }, "WebSocket client connected");

        if (!jobId) {
          ws.send(JSON.stringify({ type: "error", message: "Missing job id" } satisfies WsMessage));
          ws.close();
          return;
        }

        // Send current job state immediately
        const row = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
        if (!row) {
          ws.send(JSON.stringify({ type: "error", message: "Job not found" } satisfies WsMessage));
          ws.close();
          return;
        }

        // Cast the DB row's string status to the typed JobStatus
        const job = row as unknown as Job;

        // Ownership check — mirrors the same check already enforced on the
        // REST job routes (GET /api/jobs/:id, POST /api/jobs/:id/undo).
        if (job.userId !== user.uid) {
          logger.warn(
            { jobId, user: user.uid, owner: job.userId },
            "WebSocket job access denied — not the owner"
          );
          ws.send(JSON.stringify({ type: "error", message: "Forbidden" } satisfies WsMessage));
          ws.close();
          return;
        }

        ws.send(JSON.stringify({ type: "job_update", job } satisfies WsMessage));

        // If job is already complete, close immediately
        const doneStatuses: JobStatus[] = ["done", "failed", "cancelled"];
        if (doneStatuses.includes(job.status)) {
          ws.send(JSON.stringify({ type: "job_complete", job } satisfies WsMessage));
          ws.close();
          return;
        }

        // Subscribe to live events
        handler = (msg: WsMessage) => {
          try {
            ws.send(JSON.stringify(msg));
            if (msg.type === "job_complete") {
              ws.close();
              jobEvents.off(`job:${jobId}`, handler as (msg: WsMessage) => void);
            }
          } catch {
            jobEvents.off(`job:${jobId}`, handler as (msg: WsMessage) => void);
          }
        };

        jobEvents.on(`job:${jobId}`, handler);
      },

      onClose() {
        if (handler) {
          jobEvents.off(`job:${jobId}`, handler);
          handler = null;
        }
        logger.debug({ jobId }, "WebSocket closed — listener cleaned up");
      },

      onError(err) {
        logger.error({ jobId, err }, "WebSocket error");
      },
    };
  })
);
