/**
 * Path security utilities
 * All file access must go through assertSafePath() to prevent traversal attacks.
 *
 * Both helpers resolve paths with fs.realpath (not just path.resolve) and compare
 * with path.relative. This matters for two reasons:
 *  - path.resolve alone only collapses ".." lexically; it does not know whether a
 *    path component is actually a symlink pointing outside the allowed root.
 *  - A caller that bypasses this module entirely (e.g. a hand-rolled
 *    `startsWith(mount.path + "/")` check against an unresolved path) is not
 *    protected against ".." either, since that's a pure string comparison.
 * realpath forces every caller through one canonical, filesystem-verified check.
 * Note this requires the target to exist — callers must do existence/stat checks
 * (or create-then-check, for new paths) using the returned canonical path.
 */
import path from "path";
import { realpath } from "fs/promises";
import { db } from "../db/index.js";
import { mounts } from "../db/schema.js";

/**
 * Returns true if `target` is equal to, or nested inside, `root`, given two
 * already-canonicalized (realpath'd) absolute paths.
 */
function isWithin(root: string, target: string): boolean {
  if (target === root) return true;
  const relative = path.relative(root, target);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

/**
 * Resolves a file path (following symlinks) and asserts it is within one of the
 * registered mount paths' canonical locations.
 * Throws a 403-style error if the path escapes the allowed mount roots.
 *
 * @param filePath - The requested file path (absolute, inside container)
 * @returns The resolved, canonical absolute path (safe to pass to child processes)
 */
export async function assertSafePath(filePath: string): Promise<string> {
  let resolved: string;
  try {
    resolved = await realpath(path.resolve(filePath));
  } catch {
    throw new PathTraversalError(`Access denied: path '${filePath}' does not exist`);
  }

  const allowedMounts = db.select({ path: mounts.path }).from(mounts).all();

  for (const m of allowedMounts) {
    let canonicalMount: string;
    try {
      canonicalMount = await realpath(path.resolve(m.path));
    } catch {
      // Mount is currently unreachable — fail closed for this mount, keep checking others.
      continue;
    }
    if (isWithin(canonicalMount, resolved)) {
      return resolved;
    }
  }

  throw new PathTraversalError(
    `Access denied: path '${filePath}' is outside all registered mounts`
  );
}

/**
 * Asserts a path is within a specific base path (used when you already have the mount),
 * resolving both via realpath so symlinks can't escape the base.
 */
export async function assertWithinBase(filePath: string, basePath: string): Promise<string> {
  let resolvedBase: string;
  try {
    resolvedBase = await realpath(path.resolve(basePath));
  } catch {
    throw new PathTraversalError(`Access denied: base '${basePath}' does not exist`);
  }

  let resolvedFile: string;
  try {
    resolvedFile = await realpath(path.resolve(filePath));
  } catch {
    throw new PathTraversalError(`Access denied: path '${filePath}' does not exist`);
  }

  if (!isWithin(resolvedBase, resolvedFile)) {
    throw new PathTraversalError(
      `Access denied: path '${resolvedFile}' escapes base '${resolvedBase}'`
    );
  }

  return resolvedFile;
}

export class PathTraversalError extends Error {
  readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "PathTraversalError";
  }
}
