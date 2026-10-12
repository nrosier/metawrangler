import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

// assertSafePath/assertWithinBase now resolve real filesystem paths (to catch
// symlink escapes), so these tests need an actual directory tree instead of
// fake string paths like "/media/movies".
let root: string;
let movies: string;
let series: string;
let outsideSecret: string;

beforeAll(async () => {
  // Resolve the temp root itself (on macOS, $TMPDIR is a symlink under
  // /private), so our own expected-value comparisons below use the same
  // canonical form that realpath() inside assertSafePath will return.
  root = await realpath(await mkdtemp(path.join(tmpdir(), "metawrangler-pathsec-")));
  movies = path.join(root, "media", "movies");
  series = path.join(root, "media", "series");
  const outside = path.join(root, "private");
  await mkdir(movies, { recursive: true });
  await mkdir(path.join(series, "Breaking Bad", "Season 1"), { recursive: true });
  await mkdir(outside, { recursive: true });

  await writeFile(path.join(movies, "Inception.mkv"), "data");
  await writeFile(path.join(series, "Breaking Bad", "Season 1", "S01E01.mkv"), "data");
  outsideSecret = path.join(outside, "secret.mkv");
  await writeFile(outsideSecret, "data");

  // A symlink inside the allowed "movies" mount that escapes to "private".
  await symlink(outsideSecret, path.join(movies, "escape.mkv"));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

// ── Mock the DB so assertSafePath can query registered mounts ────────────────
vi.mock("../../db/index.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        all: () => [{ path: movies }, { path: series }],
      }),
    }),
  },
}));

const { assertSafePath, assertWithinBase, PathTraversalError } = await import(
  "../pathSecurity.js"
);

describe("assertSafePath", () => {
  it("allows a path directly inside a registered mount", async () => {
    const result = await assertSafePath(path.join(movies, "Inception.mkv"));
    expect(result).toBe(path.join(movies, "Inception.mkv"));
  });

  it("allows a deeply nested path inside a registered mount", async () => {
    const result = await assertSafePath(
      path.join(series, "Breaking Bad", "Season 1", "S01E01.mkv")
    );
    expect(result).toContain(path.join(series, "Breaking Bad"));
  });

  it("rejects a path outside all mounts", async () => {
    await expect(assertSafePath(outsideSecret)).rejects.toThrow(PathTraversalError);
  });

  it("rejects a traversal attempt that resolves outside the mount", async () => {
    await expect(
      assertSafePath(path.join(movies, "..", "..", "private", "secret.mkv"))
    ).rejects.toThrow(PathTraversalError);
  });

  it("rejects a path that only shares a prefix with a mount name", async () => {
    // e.g. "/media/movies-extra" is NOT the same as "/media/movies"
    const sibling = `${movies}-extra`;
    await mkdir(sibling, { recursive: true });
    await writeFile(path.join(sibling, "file.mkv"), "data");
    await expect(assertSafePath(path.join(sibling, "file.mkv"))).rejects.toThrow(
      PathTraversalError
    );
  });

  it("rejects a symlink inside a mount that resolves outside it", async () => {
    // This is the SEC-01 regression case: a symlink physically located
    // inside an allowed mount, but pointing at a file outside every mount.
    await expect(assertSafePath(path.join(movies, "escape.mkv"))).rejects.toThrow(
      PathTraversalError
    );
  });

  it("rejects a path that does not exist", async () => {
    await expect(assertSafePath(path.join(movies, "nope.mkv"))).rejects.toThrow(
      PathTraversalError
    );
  });
});

describe("assertWithinBase", () => {
  it("allows a path inside the given base", async () => {
    const nested = path.join(movies, "sub");
    await mkdir(nested, { recursive: true });
    const file = path.join(nested, "file.mkv");
    await writeFile(file, "data");
    const result = await assertWithinBase(file, movies);
    expect(result).toBe(file);
  });

  it("rejects a path that escapes the given base via traversal", async () => {
    await expect(
      assertWithinBase(path.join(movies, "..", "..", "private", "secret.mkv"), movies)
    ).rejects.toThrow(PathTraversalError);
  });

  it("rejects a sibling path that shares a prefix", async () => {
    const sibling = `${movies}-other`;
    await mkdir(sibling, { recursive: true });
    await writeFile(path.join(sibling, "file.mkv"), "data");
    await expect(
      assertWithinBase(path.join(sibling, "file.mkv"), movies)
    ).rejects.toThrow(PathTraversalError);
  });

  it("rejects a symlink inside the base that resolves outside it", async () => {
    await expect(assertWithinBase(path.join(movies, "escape.mkv"), movies)).rejects.toThrow(
      PathTraversalError
    );
  });
});
