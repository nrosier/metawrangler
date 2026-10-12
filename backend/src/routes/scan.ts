/**
 * Scan router — list and scan MKV files in mounts
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { mounts } from "../db/schema.js";
import { walkMkvFiles, listDirectory, scanFile } from "../services/scanner.js";
import { assertSafePath, assertWithinBase } from "../lib/pathSecurity.js";
import { writeAuditEntry } from "../services/audit.js";
import { logger } from "../lib/logger.js";

export const scanRouter = new Hono();

// GET /api/scan/:mountId — list all MKV files in a mount
scanRouter.get("/:mountId", (c) => {
  const user = c.get("user");
  const mountId = c.req.param("mountId");

  const mount = db.select().from(mounts).where(eq(mounts.id, mountId)).get();
  if (!mount) return c.json({ error: "Mount not found" }, 404);

  const files = walkMkvFiles(mount.path);

  writeAuditEntry({
    userId: user.uid,
    userEmail: user.email,
    action: "scan",
    detail: { mountId, path: mount.path, fileCount: files.length },
  });

  logger.info({ user: user.uid, mountId, fileCount: files.length }, "Mount scanned");
  return c.json({ mountId, path: mount.path, files });
});

// GET /api/scan/:mountId/list — list the immediate directories and MKV files
// of a directory (defaults to the mount root). This is the non-recursive,
// directory-by-directory browsing view.
const listSchema = z.object({ path: z.string().min(1).optional() });

scanRouter.get("/:mountId/list", zValidator("query", listSchema), async (c) => {
  const mountId = c.req.param("mountId");
  const { path: reqPath } = c.req.valid("query");

  const mount = db.select().from(mounts).where(eq(mounts.id, mountId)).get();
  if (!mount) return c.json({ error: "Mount not found" }, 404);

  let safePath: string;
  try {
    safePath = await assertWithinBase(reqPath ?? mount.path, mount.path);
  } catch {
    return c.json({ error: "Invalid path" }, 403);
  }

  const { directories, files } = listDirectory(safePath);
  return c.json({ mountId, path: safePath, directories, files });
});

// GET /api/scan/:mountId/subdir — list files under a specific subdir
const subdirSchema = z.object({ subdir: z.string().min(1) });

scanRouter.get("/:mountId/subdir", zValidator("query", subdirSchema), async (c) => {
  const mountId = c.req.param("mountId");
  const { subdir } = c.req.valid("query");

  const mount = db.select().from(mounts).where(eq(mounts.id, mountId)).get();
  if (!mount) return c.json({ error: "Mount not found" }, 404);

  // Path traversal check — subdir must stay within the mount
  let safePath: string;
  try {
    safePath = await assertWithinBase(subdir, mount.path);
  } catch {
    return c.json({ error: "Invalid subdir path" }, 403);
  }

  const files = walkMkvFiles(safePath);
  return c.json({ mountId, subdir: safePath, files });
});

// POST /api/scan/file — get metadata for specific files
const fileMetaSchema = z.object({
  filePaths: z.array(z.string().min(1)).min(1).max(500),
});

scanRouter.post("/file", zValidator("json", fileMetaSchema), async (c) => {
  const user = c.get("user");
  const { filePaths } = c.req.valid("json");

  const results = await Promise.allSettled(
    filePaths.map(async (filePath) => {
      // Canonical, symlink-resolved path security check against all registered
      // mounts (NOT a raw string prefix check — that admits "../" traversal).
      const safePath = await assertSafePath(filePath);
      return scanFile(safePath);
    })
  );

  const output = results.map((r, i) => ({
    filePath: filePaths[i],
    success: r.status === "fulfilled",
    metadata: r.status === "fulfilled" ? r.value : null,
    error: r.status === "rejected" ? String(r.reason) : null,
  }));

  logger.info(
    { user: user.uid, requested: filePaths.length },
    "File metadata batch requested"
  );

  return c.json(output);
});
