/**
 * Bulk-edit draft persistence (LOCAL-02).
 *
 * Before this, the selected file list lived only in React Router's
 * `location.state` and in-progress edits lived only in component state — a
 * reload, direct link, or tab-restore silently dropped both with no recovery
 * path. This persists a small versioned snapshot to localStorage so a draft
 * survives those cases, while still treating it as untrusted/stale: the
 * caller is responsible for re-scanning the restored files' metadata before
 * letting the user apply anything (BulkEdit.tsx's existing scan-on-mount
 * query already does this — restoring a draft just seeds its input).
 */

const DRAFT_KEY = "metawrangler:bulk-edit-draft";

// Bump when the shape of BulkEditDraft changes — a version mismatch means
// "discard", never "guess how to migrate it".
const DRAFT_VERSION = 1;

export interface BulkEditDraft {
  version: typeof DRAFT_VERSION;
  filePaths: string[];
  edits: Record<string, string | boolean>;
  dryRun: boolean;
  savedAt: string; // ISO timestamp, so restored-draft UI can show how stale it is
}

export function saveDraft(draft: Omit<BulkEditDraft, "version" | "savedAt">): void {
  try {
    const full: BulkEditDraft = { ...draft, version: DRAFT_VERSION, savedAt: new Date().toISOString() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(full));
  } catch {
    // localStorage can throw (quota exceeded, private browsing) — losing the
    // recovery safety net is far better than crashing the page over it.
  }
}

export function loadDraft(): BulkEditDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BulkEditDraft>;
    if (parsed.version !== DRAFT_VERSION) return null;
    if (!Array.isArray(parsed.filePaths) || parsed.filePaths.length === 0) return null;
    if (typeof parsed.savedAt !== "string") return null;
    return {
      version: DRAFT_VERSION,
      filePaths: parsed.filePaths,
      edits: parsed.edits && typeof parsed.edits === "object" ? parsed.edits : {},
      dryRun: parsed.dryRun === true,
      savedAt: parsed.savedAt,
    };
  } catch {
    // Malformed JSON, non-array filePaths, etc. — same as "no draft".
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
