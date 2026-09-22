/**
 * Audit log service — append-only, never update/delete entries.
 */
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { auditLog } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import type { AuditAction } from "../types/index.js";

export interface AuditParams {
  userId: string;
  userEmail: string;
  action: AuditAction;
  jobId?: string;
  detail?: Record<string, unknown>;
}

export function writeAuditEntry(params: AuditParams): void {
  const now = new Date().toISOString();
  const id = uuidv4();

  try {
    db.insert(auditLog)
      .values({
        id,
        userId: params.userId,
        userEmail: params.userEmail,
        action: params.action,
        jobId: params.jobId ?? null,
        detail: params.detail ? JSON.stringify(params.detail) : null,
        createdAt: now,
      })
      .run();
  } catch (err) {
    // Audit failures must not crash the main flow — log and continue
    logger.error({ err, params }, "Failed to write audit log entry");
  }

  logger.info(
    {
      audit: {
        id,
        userId: params.userId,
        action: params.action,
        jobId: params.jobId,
      },
    },
    "Audit entry written"
  );
}
