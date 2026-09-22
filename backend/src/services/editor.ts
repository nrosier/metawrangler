/**
 * MKV editor service
 * Wraps mkvpropedit. Builds argument lists from EditOperation[] and executes
 * them via execFile (not exec — no shell expansion, no injection risk).
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { access, constants } from "fs/promises";
import type {
  EditOperation,
  MkvFileMetadata,
  TrackType,
} from "../types/index.js";
import { logger } from "../lib/logger.js";

const execFileAsync = promisify(execFile);

export interface EditResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  /** The mkvpropedit args that were (or would be) run — useful for dry-run display */
  args: string[];
}

/**
 * Check that the file is writable by the process.
 */
export async function checkWritable(filePath: string): Promise<void> {
  await access(filePath, constants.W_OK);
}

/**
 * Build the mkvpropedit argument list for a set of operations on one file.
 * This function is pure — it does not execute anything.
 */
export function buildMkvpropeditArgs(
  filePath: string,
  operations: EditOperation[],
  metadata: MkvFileMetadata
): string[] {
  const args: string[] = [filePath];

  for (const op of operations) {
    switch (op.field) {
      case "title":
        args.push("--edit", "info", "--set", `title=${String(op.value)}`);
        break;

      default: {
        // Track-level operation
        const selector = op.trackSelector;
        if (!selector) {
          logger.warn({ op }, "Track operation missing trackSelector, skipping");
          continue;
        }

        // Resolve which track IDs are targeted
        const targetIds = resolveTrackIds(metadata, selector);
        if (targetIds.length === 0) {
          logger.warn({ op, selector }, "No tracks matched selector, skipping");
          continue;
        }

        for (const trackId of targetIds) {
          const editTarget = `track:${trackId + 1}`; // mkvpropedit is 1-based
          args.push("--edit", editTarget);

          switch (op.field) {
            case "trackLanguage":
              args.push("--set", `language=${String(op.value)}`);
              break;
            case "trackLanguageIETF":
              args.push("--set", `language-ietf=${String(op.value)}`);
              break;
            case "trackName":
              args.push("--set", `name=${String(op.value)}`);
              break;
            case "trackFlagDefault":
              args.push("--set", `flag-default=${op.value ? "1" : "0"}`);
              break;
            case "trackFlagEnabled":
              args.push("--set", `flag-enabled=${op.value ? "1" : "0"}`);
              break;
            case "trackFlagForced":
              args.push("--set", `flag-forced=${op.value ? "1" : "0"}`);
              break;
          }
        }
        break;
      }
    }
  }

  return args;
}

/**
 * Execute mkvpropedit with the given argument list.
 * dryRun=true skips the actual execution but returns what would have run.
 */
export async function runMkvpropedit(
  args: string[],
  dryRun: boolean
): Promise<EditResult> {
  if (dryRun) {
    return {
      success: true,
      exitCode: 0,
      stdout: "[dry-run: not executed]",
      stderr: "",
      args,
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync("mkvpropedit", args, {
      timeout: 60_000,
      maxBuffer: 5 * 1024 * 1024,
    });
    return { success: true, exitCode: 0, stdout, stderr, args };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; code?: number };
    const exitCode = error.code ?? 1;
    const stderr = error.stderr ?? String(err);
    logger.error(
      { args: args[0], exitCode, stderr },
      "mkvpropedit failed"
    );
    return {
      success: false,
      exitCode,
      stdout: error.stdout ?? "",
      stderr,
      args,
    };
  }
}

// ── Track selector resolution ─────────────────────────────────────────────────

function resolveTrackIds(
  metadata: MkvFileMetadata,
  selector: { trackType: TrackType | "*"; trackIndex: number | "*" }
): number[] {
  const { trackType, trackIndex } = selector;

  const candidates = metadata.tracks.filter(
    (t) => trackType === "*" || t.type === trackType
  );

  if (trackIndex === "*") {
    return candidates.map((t) => t.id);
  }

  // trackIndex is a 0-based index within the type
  const track = candidates[trackIndex];
  return track !== undefined ? [track.id] : [];
}
