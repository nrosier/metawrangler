/**
 * Audit log router — read-only access to the audit trail
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLog } from "../db/schema.js";

export const auditRouter = new Hono();

const listAuditQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(500)
    .default(100)
    .optional(),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .optional(),
});

// GET /api/audit — paginated audit log for the current user
auditRouter.get("/", zValidator("query", listAuditQuerySchema), (c) => {
  const user = c.get("user");
  const query = c.req.valid("query");
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;

  const entries = db
    .select()
    .from(auditLog)
    .where(eq(auditLog.userId, user.uid))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset)
    .all()
    .map((e) => ({
      ...e,
      detail: e.detail ? (JSON.parse(e.detail) as Record<string, unknown>) : null,
    }));

  return c.json(entries);
});
