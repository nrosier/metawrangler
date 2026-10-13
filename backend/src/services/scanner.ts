/**
 * MKV scanner service
 * Reads metadata from .mkv files using `mkvmerge -J` (preferred) with
 * `ffprobe` as fallback. Both are bundled in the Docker image.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { open, opendir, stat, lstat } from "fs/promises";
import path from "path";
import type { MkvFileMetadata, MkvTrack, TrackType } from "../types/index.js";
import { logger } from "../lib/logger.js";
import { withToolSlot } from "../lib/toolConcurrency.js";

const execFileAsync = promisify(execFile);

// EBML magic bytes: 0x1A 0x45 0xDF 0xA3
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

export interface MkvHeaderCheck {
  valid: boolean;
  /** Human-readable reason, suitable for error messages and logs. */
  reason: string;
  sizeBytes?: number;
  /** First up to 16 bytes, hex-encoded. */
  headerHex?: string;
  errorCode?: string;
}

/**
 * Inspect the first bytes of a file and report whether they are the EBML magic
 * (i.e., the file is actually a Matroska file), with diagnostics for when not.
 *
 * Reads only the first 16 bytes via a file handle — do NOT use fs.readFile here,
 * it loads the whole file into memory and throws ERR_FS_FILE_TOO_LARGE for
 * anything over 2 GiB, which is most real MKV rips.
 */
export async function inspectMkvHeader(filePath: string): Promise<MkvHeaderCheck> {
  let handle;
  try {
    handle = await open(filePath, "r");
    const { size } = await handle.stat();
    const { buffer, bytesRead } = await handle.read({
      buffer: Buffer.alloc(16),
      position: 0,
    });
    const headerHex = buffer.subarray(0, bytesRead).toString("hex");
    const valid = bytesRead >= 4 && buffer.subarray(0, 4).equals(EBML_MAGIC);
    const result: MkvHeaderCheck = {
      valid,
      reason: valid
        ? "EBML magic found"
        : `expected EBML magic 1a45dfa3, got "${headerHex}" (read ${bytesRead} bytes, file size ${size})`,
      sizeBytes: size,
      headerHex,
    };
    if (!valid) logger.warn({ filePath, ...result }, "MKV magic byte check failed");
    return result;
  } catch (err) {
    const errorCode = (err as NodeJS.ErrnoException).code;
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ filePath, err }, "Failed to read file for MKV magic byte check");
    return {
      valid: false,
      reason: `could not read file: ${errorCode ?? message}`,
      ...(errorCode !== undefined ? { errorCode } : {}),
    };
  } finally {
    await handle?.close();
  }
}

export async function isValidMkv(filePath: string): Promise<boolean> {
  return (await inspectMkvHeader(filePath)).valid;
}

/**
 * Walk a directory and return all .mkv file paths (recursively).
 *
 * Async (opendir/lstat) rather than the old readdirSync/statSync, so a large
 * library doesn't block the whole Bun event loop — including auth, the
 * WebSocket, and every other in-flight API request — for the duration of
 * the walk (PERF-01).
 *
 * Symlinks (file or directory) are never followed: a directory symlink
 * cycle (self or parent link) would otherwise recurse until the stack or
 * CPU is exhausted, and a followed file symlink could silently read
 * something outside the registered mount.
 */
export async function walkMkvFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];
  await walkDirRecursive(dirPath, new Set(), results);
  return results;
}

async function walkDirRecursive(
  dirPath: string,
  visited: Set<string>,
  results: string[]
): Promise<void> {
  // Identify this directory by (device, inode) rather than its path, so a
  // symlink cycle that reaches the same directory via a different path is
  // still caught.
  let dirId: string;
  try {
    const s = await stat(dirPath);
    dirId = `${s.dev}:${s.ino}`;
  } catch (err) {
    logger.warn({ dirPath, err }, "Could not stat directory, skipping");
    return;
  }
  if (visited.has(dirId)) {
    logger.warn({ dirPath }, "Skipping directory already visited in this scan (symlink cycle guard)");
    return;
  }
  visited.add(dirId);

  let dir;
  try {
    dir = await opendir(dirPath);
  } catch (err) {
    logger.warn({ dirPath, err }, "Could not read directory, skipping");
    return;
  }

  for await (const entry of dir) {
    const fullPath = path.join(dirPath, entry.name);
    let s;
    try {
      s = await lstat(fullPath);
    } catch {
      continue;
    }
    if (s.isSymbolicLink()) {
      logger.warn({ fullPath }, "Skipping symlink during scan (not followed)");
      continue;
    }
    if (s.isDirectory()) {
      await walkDirRecursive(fullPath, visited, results);
    } else if (s.isFile() && entry.name.toLowerCase().endsWith(".mkv")) {
      results.push(fullPath);
    }
  }
}

export interface DirectoryListing {
  directories: string[];
  files: string[];
}

/**
 * List the immediate children of a directory: subdirectories and .mkv files,
 * without recursing. Used for directory-by-directory browsing.
 */
export async function listDirectory(dirPath: string): Promise<DirectoryListing> {
  const directories: string[] = [];
  const files: string[] = [];

  let dir;
  try {
    dir = await opendir(dirPath);
  } catch (err) {
    logger.warn({ dirPath, err }, "Could not read directory, skipping");
    return { directories, files };
  }

  for await (const entry of dir) {
    const fullPath = path.join(dirPath, entry.name);
    let s;
    try {
      s = await lstat(fullPath);
    } catch {
      continue;
    }
    if (s.isSymbolicLink()) {
      logger.warn({ fullPath }, "Skipping symlink during directory listing (not followed)");
      continue;
    }
    if (s.isDirectory()) {
      directories.push(fullPath);
    } else if (s.isFile() && entry.name.toLowerCase().endsWith(".mkv")) {
      files.push(fullPath);
    }
  }

  directories.sort();
  files.sort();
  return { directories, files };
}

// ── mkvmerge -J output types (partial) ───────────────────────────────────────

interface MkvmergeTrack {
  id: number;
  type: string;
  codec: string;
  properties?: {
    language?: string;
    language_ietf?: string;
    track_name?: string;
    flag_default?: boolean;
    flag_enabled?: boolean;
    flag_forced?: boolean;
    audio_channels?: number;
    pixel_dimensions?: string;
  };
}

interface MkvmergeInfo {
  container?: { properties?: { title?: string } };
  tracks?: MkvmergeTrack[];
}

/**
 * Read MKV metadata using mkvmerge -J.
 * Returns parsed metadata and the raw JSON string (for undo snapshots).
 */
export async function scanFile(filePath: string): Promise<MkvFileMetadata> {
  logger.debug({ filePath }, "Scanning MKV file");

  let rawJson: string;
  let info: MkvmergeInfo;

  try {
    const { stdout } = await withToolSlot(() =>
      execFileAsync("mkvmerge", ["-J", filePath], {
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024, // 10 MB
      })
    );
    rawJson = stdout;
    info = JSON.parse(stdout) as MkvmergeInfo;
  } catch (err) {
    logger.warn({ filePath, err }, "mkvmerge failed, falling back to ffprobe");
    return scanFileWithFfprobe(filePath);
  }

  const title = info.container?.properties?.title ?? null;
  const tracks: MkvTrack[] = (info.tracks ?? []).map(parseTrack);

  return { filePath, title, tracks, rawJson };
}

function parseTrack(t: MkvmergeTrack): MkvTrack {
  const props = t.properties ?? {};

  const [pw, ph] = props.pixel_dimensions
    ? props.pixel_dimensions.split("x").map(Number)
    : [undefined, undefined];

  return {
    id: t.id,
    type: mapTrackType(t.type),
    codecId: t.codec,
    language: props.language ?? null,
    languageIETF: props.language_ietf ?? null,
    name: props.track_name ?? null,
    flagDefault: props.flag_default ?? false,
    flagEnabled: props.flag_enabled ?? true,
    flagForced: props.flag_forced ?? false,
    channels: props.audio_channels,
    pixelWidth: pw,
    pixelHeight: ph,
  };
}

function mapTrackType(type: string): TrackType {
  switch (type) {
    case "video": return "video";
    case "audio": return "audio";
    case "subtitles": return "subtitles";
    default: return "unknown";
  }
}

// ── ffprobe fallback ──────────────────────────────────────────────────────────

interface FfprobeStream {
  index: number;
  codec_type: string;
  codec_name: string;
  tags?: Record<string, string>;
  disposition?: Record<string, number>;
  channels?: number;
  width?: number;
  height?: number;
}

interface FfprobeOutput {
  format?: { tags?: Record<string, string> };
  streams?: FfprobeStream[];
}

async function scanFileWithFfprobe(filePath: string): Promise<MkvFileMetadata> {
  const { stdout } = await withToolSlot(() =>
    execFileAsync(
      "ffprobe",
      [
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        filePath,
      ],
      { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 }
    )
  );

  const output = JSON.parse(stdout) as FfprobeOutput;
  const title = output.format?.tags?.["title"] ?? null;

  const tracks: MkvTrack[] = (output.streams ?? []).map((s, i) => ({
    id: i,
    type: mapTrackType(s.codec_type),
    codecId: s.codec_name,
    language: s.tags?.["language"] ?? null,
    languageIETF: null,
    name: s.tags?.["title"] ?? null,
    flagDefault: (s.disposition?.["default"] ?? 0) === 1,
    flagEnabled: true,
    flagForced: (s.disposition?.["forced"] ?? 0) === 1,
    channels: s.channels,
    pixelWidth: s.width,
    pixelHeight: s.height,
  }));

  return { filePath, title, tracks, rawJson: stdout };
}

/**
 * Check that mkvmerge, mkvpropedit, and ffprobe are present and executable.
 * Called at startup.
 *
 * Flag note: mkvtoolnix tools use --version; ffprobe uses -version (single dash).
 * Both exit 0 on success. Using the wrong flag causes a non-zero exit which
 * child_process.execFile treats as an error — identical to "not found".
 */
export async function checkToolchain(): Promise<void> {
  const tools: Array<[string, string[]]> = [
    ["mkvmerge",    ["--version"]],
    ["mkvpropedit", ["--version"]],
    ["ffprobe",     ["-version"]],   // ffprobe uses single-dash -version
  ];
  for (const [tool, args] of tools) {
    try {
      await execFileAsync(tool, args, { timeout: 5_000 });
    } catch {
      throw new Error(
        `Required tool '${tool}' not found or not executable. ` +
        `Ensure mkvtoolnix and ffmpeg are installed in the container.`
      );
    }
  }
}
