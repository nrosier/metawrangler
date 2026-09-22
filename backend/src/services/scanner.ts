/**
 * MKV scanner service
 * Reads metadata from .mkv files using `mkvmerge -J` (preferred) with
 * `ffprobe` as fallback. Both are bundled in the Docker image.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, stat } from "fs/promises";
import { readdirSync, statSync } from "fs";
import path from "path";
import type { MkvFileMetadata, MkvTrack, TrackType } from "../types/index.js";
import { logger } from "../lib/logger.js";

const execFileAsync = promisify(execFile);

// EBML magic bytes: 0x1A 0x45 0xDF 0xA3
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

/**
 * Validate that a file starts with EBML magic bytes (i.e., is actually a Matroska file).
 */
export async function isValidMkv(filePath: string): Promise<boolean> {
  try {
    const fd = await readFile(filePath);
    return fd.subarray(0, 4).equals(EBML_MAGIC);
  } catch {
    return false;
  }
}

/**
 * Walk a directory and return all .mkv file paths (recursively).
 */
export function walkMkvFiles(dirPath: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch (err) {
      logger.warn({ dir, err }, "Could not read directory, skipping");
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      let s;
      try {
        s = statSync(fullPath);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        walk(fullPath);
      } else if (
        s.isFile() &&
        entry.toLowerCase().endsWith(".mkv")
      ) {
        results.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return results;
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
    const { stdout } = await execFileAsync("mkvmerge", ["-J", filePath], {
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    });
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
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      "-show_format",
      filePath,
    ],
    { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 }
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
 * Check that both mkvmerge and mkvpropedit are present and executable.
 * Called at startup.
 */
export async function checkToolchain(): Promise<void> {
  for (const tool of ["mkvmerge", "mkvpropedit", "ffprobe"]) {
    try {
      await execFileAsync(tool, ["--version"], { timeout: 5_000 });
    } catch (err) {
      throw new Error(
        `Required tool '${tool}' not found or not executable. ` +
        `Ensure mkvtoolnix and ffmpeg are installed in the container.`
      );
    }
  }
}
