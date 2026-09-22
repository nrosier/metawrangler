/**
 * Mounts router — CRUD for mountpoint configuration
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { mounts } from "../db/schema.js";
import { writeAuditEntry } from "../services/audit.js";
import { walkMkvFiles } from "../services/scanner.js";
import { stat, access, constants } from "fs/promises";
import { logger } from "../lib/logger.js";

export const mountsRouter = new Hono();

const createMountSchema = z.object({
  name: z.string().min(1).max(100),
  path: z.string().min(1),
  type: z.enum(["movies", "series"]),
});

const updateMountSchema = createMountSchema.partial();

// GET /api/mounts — list all mounts with health info
mountsRouter.get("/", async (c) => {
  const allMounts = db.select().from(mounts).all();

  const withHealth = await Promise.all(
    allMounts.map(async (m) => {
      let reachable = false;
      let writable = false;
      let mkvCount = 0;

      try {
        const s = await stat(m.path);
        reachable = s.isDirectory();
        await access(m.path, constants.W_OK);
        writable = true;
      } catch {
        // not reachable or not writable
      }

      if (reachable) {
        try {
          mkvCount = walkMkvFiles(m.path).length;
        } catch {
          // ignore count errors
        }
      }

      return { ...m, health: { reachable, writable, mkvCount } };
    })
  );

  return c.json(withHealth);
});

// POST /api/mounts — add a new mount
mountsRouter.post("/", zValidator("json", createMountSchema), async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  // Validate path exists and is a directory
  try {
    const s = await stat(body.path);
    if (!s.isDirectory()) {
      return c.json({ error: "Path is not a directory" }, 400);
    }
  } catch {
    return c.json({ error: "Path does not exist or is not accessible" }, 400);
  }

  const now = new Date().toISOString();
  const id = uuidv4();

  try {
    db.insert(mounts)
      .values({ id, name: body.name, path: body.path, type: body.type, createdAt: now, updatedAt: now })
      .run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE")) {
      return c.json({ error: "A mount with this path already exists" }, 409);
    }
    throw err;
  }

  writeAuditEntry({
    userId: user.uid,
    userEmail: user.email,
    action: "mount_add",
    detail: { mountId: id, path: body.path, type: body.type },
  });

  logger.info({ user: user.uid, mount: id }, "Mount added");
  return c.json(db.select().from(mounts).where(eq(mounts.id, id)).get(), 201);
});

// PATCH /api/mounts/:id — update name or type (not path)
mountsRouter.patch("/:id", zValidator("json", updateMountSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = c.req.valid("json");

  const existing = db.select().from(mounts).where(eq(mounts.id, id)).get();
  if (!existing) return c.json({ error: "Mount not found" }, 404);

  const now = new Date().toISOString();
  db.update(mounts).set({ ...body, updatedAt: now }).where(eq(mounts.id, id)).run();

  writeAuditEntry({
    userId: user.uid,
    userEmail: user.email,
    action: "mount_update",
    detail: { mountId: id, changes: body },
  });

  logger.info({ user: user.uid, mount: id }, "Mount updated");
  return c.json(db.select().from(mounts).where(eq(mounts.id, id)).get());
});

// DELETE /api/mounts/:id
mountsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const existing = db.select().from(mounts).where(eq(mounts.id, id)).get();
  if (!existing) return c.json({ error: "Mount not found" }, 404);

  db.delete(mounts).where(eq(mounts.id, id)).run();

  writeAuditEntry({
    userId: user.uid,
    userEmail: user.email,
    action: "mount_remove",
    detail: { mountId: id, path: existing.path },
  });

  logger.info({ user: user.uid, mount: id }, "Mount removed");
  return c.json({ success: true });
});
