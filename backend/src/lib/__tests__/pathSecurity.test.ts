import { describe, it, expect, vi } from "vitest";
import path from "path";

// ── Mock the DB so assertSafePath can query registered mounts ────────────────
vi.mock("../../db/index.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        all: () => [
          { path: "/media/movies" },
          { path: "/media/series" },
        ],
      }),
    }),
  },
}));

import { assertSafePath, assertWithinBase, PathTraversalError } from "../pathSecurity.js";

describe("assertSafePath", () => {
  it("allows a path directly inside a registered mount", () => {
    const result = assertSafePath("/media/movies/Inception.mkv");
    expect(result).toBe(path.resolve("/media/movies/Inception.mkv"));
  });

  it("allows a deeply nested path inside a registered mount", () => {
    const result = assertSafePath("/media/series/Breaking Bad/Season 1/S01E01.mkv");
    expect(result).toContain("/media/series/");
  });

  it("rejects a path outside all mounts", () => {
    expect(() => assertSafePath("/etc/passwd")).toThrow(PathTraversalError);
  });

  it("rejects a traversal attempt that resolves outside the mount", () => {
    expect(() =>
      assertSafePath("/media/movies/../../../etc/passwd")
    ).toThrow(PathTraversalError);
  });

  it("rejects a path that only shares a prefix with a mount name", () => {
    // /media/movies-extra is NOT the same as /media/movies
    expect(() => assertSafePath("/media/movies-extra/file.mkv")).toThrow(PathTraversalError);
  });
});

describe("assertWithinBase", () => {
  it("allows a path inside the given base", () => {
    const result = assertWithinBase("/media/movies/sub/file.mkv", "/media/movies");
    expect(result).toBe(path.resolve("/media/movies/sub/file.mkv"));
  });

  it("rejects a path that escapes the given base via traversal", () => {
    expect(() =>
      assertWithinBase("/media/movies/../../etc/shadow", "/media/movies")
    ).toThrow(PathTraversalError);
  });

  it("rejects a sibling path that shares a prefix", () => {
    expect(() =>
      assertWithinBase("/media/movies-other/file.mkv", "/media/movies")
    ).toThrow(PathTraversalError);
  });
});
