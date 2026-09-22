/**
 * Path security utilities
 * All file access must go through assertSafePath() to prevent traversal attacks.
 */
import path from "path";
import { db } from "../db/index.js";
import { mounts } from "../db/schema.js";

/**
 * Resolves a file path and asserts it is within one of the registered mount paths.
 * Throws a 403-style error if the path escapes the allowed mount roots.
 *
 * @param filePath - The requested file path (absolute, inside container)
 * @returns The resolved, normalised absolute path
 */
export function assertSafePath(filePath: string): string {
  const resolved = path.resolve(filePath);

  const allowedMounts = db.select({ path: mounts.path }).from(mounts).all();
  const isAllowed = allowedMounts.some((m) =>
    resolved.startsWith(m.path + path.sep) || resolved === m.path
  );

  if (!isAllowed) {
    throw new PathTraversalError(
      `Access denied: path '${resolved}' is outside all registered mounts`
    );
  }

  return resolved;
}

/**
 * Asserts a path is within a specific base path (used when you already have the mount).
 */
export function assertWithinBase(filePath: string, basePath: string): string {
  const resolvedFile = path.resolve(filePath);
  const resolvedBase = path.resolve(basePath);

  if (
    !resolvedFile.startsWith(resolvedBase + path.sep) &&
    resolvedFile !== resolvedBase
  ) {
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
