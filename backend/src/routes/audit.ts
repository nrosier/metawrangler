/**
 * Audit log router — read-only access to the audit trail
 */
import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLog } from "../db/schema.js";

export const auditRouter = new Hono();

// GET /api/audit — paginated audit log for the current user
auditRouter.get("/", (c) => {
  const user = c.get("user");
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
  const offset = Number(c.req.query("offset") ?? 0);

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
