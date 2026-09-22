/**
 * Tests for scanner utilities: EBML magic-byte validation and directory walker.
 * Both use the real filesystem via tmp directories — no mocks needed.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { isValidMkv, walkMkvFiles } from "../scanner.js";

// EBML magic: 0x1A 0x45 0xDF 0xA3
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const NOT_EBML   = Buffer.from([0x00, 0x00, 0x00, 0x00]);

// ── Temp directory helpers ────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = path.join(tmpdir(), `mw-test-${process.pid}-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function mkfile(relPath: string, content: Buffer | string = ""): string {
  const full = path.join(tmpDir, relPath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

// ── isValidMkv ────────────────────────────────────────────────────────────────

describe("isValidMkv", () => {
  it("returns true for a file starting with EBML magic bytes", async () => {
    const file = mkfile("valid.mkv", Buffer.concat([EBML_MAGIC, Buffer.alloc(100)]));
    expect(await isValidMkv(file)).toBe(true);
  });

  it("returns false for a file with wrong magic bytes", async () => {
    const file = mkfile("fake.mkv", Buffer.concat([NOT_EBML, Buffer.alloc(100)]));
    expect(await isValidMkv(file)).toBe(false);
  });

  it("returns false for an empty file", async () => {
    const file = mkfile("empty.mkv", Buffer.alloc(0));
    expect(await isValidMkv(file)).toBe(false);
  });

  it("returns false for a file with only 3 bytes (less than magic length)", async () => {
    const file = mkfile("short.mkv", Buffer.from([0x1a, 0x45, 0xdf]));
    expect(await isValidMkv(file)).toBe(false);
  });

  it("returns false for a non-existent file path", async () => {
    expect(await isValidMkv(path.join(tmpDir, "does-not-exist.mkv"))).toBe(false);
  });

  it("returns true when magic bytes are followed by arbitrary content", async () => {
    const file = mkfile("real.mkv", Buffer.concat([EBML_MAGIC, Buffer.from("hello world")]));
    expect(await isValidMkv(file)).toBe(true);
  });
});

// ── walkMkvFiles ──────────────────────────────────────────────────────────────

describe("walkMkvFiles", () => {
  it("finds .mkv files in the root directory", () => {
    mkfile("movie.mkv");
    mkfile("readme.txt");
    const files = walkMkvFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("movie.mkv");
  });

  it("finds .mkv files recursively in subdirectories", () => {
    mkfile("Season 1/S01E01.mkv");
    mkfile("Season 1/S01E02.mkv");
    mkfile("Season 2/S02E01.mkv");
    const files = walkMkvFiles(tmpDir);
    expect(files).toHaveLength(3);
  });

  it("ignores non-.mkv files", () => {
    mkfile("movie.mkv");
    mkfile("movie.mp4");
    mkfile("movie.avi");
    mkfile("subtitles.srt");
    const files = walkMkvFiles(tmpDir);
    expect(files).toHaveLength(1);
  });

  it("is case-insensitive for the .mkv extension", () => {
    mkfile("UPPER.MKV");
    mkfile("mixed.Mkv");
    mkfile("lower.mkv");
    const files = walkMkvFiles(tmpDir);
    expect(files).toHaveLength(3);
  });

  it("returns an empty array for a directory with no .mkv files", () => {
    mkfile("notes.txt");
    mkfile("image.jpg");
    expect(walkMkvFiles(tmpDir)).toHaveLength(0);
  });

  it("returns an empty array for an empty directory", () => {
    expect(walkMkvFiles(tmpDir)).toHaveLength(0);
  });

  it("returns full absolute paths", () => {
    mkfile("sub/movie.mkv");
    const files = walkMkvFiles(tmpDir);
    expect(path.isAbsolute(files[0]!)).toBe(true);
  });

  it("handles deeply nested directories", () => {
    mkfile("a/b/c/d/deep.mkv");
    const files = walkMkvFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("deep.mkv");
  });

  it("continues walking when a sibling directory is unreadable", async () => {
    // Create a readable dir with an MKV and an unreadable sibling
    mkfile("readable/movie.mkv");
    const unreadable = path.join(tmpDir, "unreadable");
    mkdirSync(unreadable);
    // Make unreadable (skip on platforms where this won't work as root)
    try {
      const { chmodSync } = await import("fs");
      chmodSync(unreadable, 0o000);
      const files = walkMkvFiles(tmpDir);
      expect(files).toHaveLength(1); // still finds the readable one
      chmodSync(unreadable, 0o755); // restore so cleanup works
    } catch {
      // chmod not supported or running as root — skip
    }
  });
});
