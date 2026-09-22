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
import type { WsMessage } from "../types/index.js";

export const wsRouter = new Hono();

wsRouter.get(
  "/jobs/:id",
  upgradeWebSocket((c) => {
    const jobId = c.req.param("id");
    // Note: auth headers are not available in WS upgrade in all clients;
    // Caddy forward-auth already validates the session before the upgrade reaches us.

    return {
      onOpen(_, ws) {
        logger.debug({ jobId }, "WebSocket client connected");

        // Send current job state immediately
        const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
        if (!job) {
          ws.send(JSON.stringify({ type: "error", message: "Job not found" } satisfies WsMessage));
          ws.close();
          return;
        }

        ws.send(JSON.stringify({ type: "job_update", job } satisfies WsMessage));

        // If job is already complete, close immediately
        if (job.status === "done" || job.status === "failed") {
          ws.send(JSON.stringify({ type: "job_complete", job } satisfies WsMessage));
          ws.close();
          return;
        }

        // Subscribe to live events
        const handler = (msg: WsMessage) => {
          try {
            ws.send(JSON.stringify(msg));
            if (msg.type === "job_complete") {
              ws.close();
              jobEvents.off(`job:${jobId}`, handler);
            }
          } catch {
            jobEvents.off(`job:${jobId}`, handler);
          }
        };

        jobEvents.on(`job:${jobId}`, handler);
      },

      onClose() {
        jobEvents.removeAllListeners(`job:${jobId}`);
        logger.debug({ jobId }, "WebSocket closed — listeners cleaned up");
      },

      onError(err) {
        logger.error({ jobId, err }, "WebSocket error");
      },
    };
  })
);
