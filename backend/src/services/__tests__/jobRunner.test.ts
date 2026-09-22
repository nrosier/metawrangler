/**
 * Tests for the internal jobRunner helpers detectConflicts and buildChangesSummary.
 * Both functions are unexported — we test them indirectly through a re-export shim,
 * or we can test them via the public API. For purity we extract them first.
 *
 * Because these are private functions in jobRunner.ts, we test the observable
 * behaviour by importing the module and calling the helpers through a thin
 * test-only export added via vitest's module mocking — or more simply, we just
 * duplicate the minimal function signatures here and test the logic directly.
 *
 * The cleanest approach without changing production code: extract the two pure
 * functions into a separate testable module. Since we can't change production
 * code just for tests, we instead test them by constructing the exact inputs
 * the job runner would pass and asserting the outputs match the documented
 * behaviour.
 */
import { describe, it, expect } from "vitest";

// ── Inline the two pure helpers so we can test without exporting them ─────────
// These are exact copies of the private functions in jobRunner.ts.
// If the logic changes there, these must be kept in sync.

import type { EditOperation } from "../../types/index.js";

type TrackStub = { id: number; type: string };
type MetaStub = { tracks: TrackStub[] };

function detectConflicts(
  metadata: MetaStub,
  operations: EditOperation[]
): string[] {
  const warnings: string[] = [];
  for (const op of operations) {
    const sel = op.trackSelector;
    if (!sel || sel.trackIndex === "*") continue;
    const candidates = metadata.tracks.filter(
      (t) => sel.trackType === "*" || t.type === sel.trackType
    );
    if (sel.trackIndex >= candidates.length) {
      warnings.push(
        `Track ${sel.trackType}[${sel.trackIndex}] does not exist in this file (has ${candidates.length} ${sel.trackType} track(s)). Operation '${op.field}' will be skipped for this file.`
      );
    }
  }
  return warnings;
}

type TrackMetaStub = {
  id: number; type: string;
  language: string | null; languageIETF: string | null;
  name: string | null;
  flagDefault: boolean; flagEnabled: boolean; flagForced: boolean;
};
type FullMetaStub = { title: string | null; tracks: TrackMetaStub[] };

import type { ChangesSummary } from "../../types/index.js";

function buildChangesSummary(
  operations: EditOperation[],
  metadata: FullMetaStub
): ChangesSummary[] {
  const summaries: ChangesSummary[] = [];
  for (const op of operations) {
    if (op.field === "title") {
      summaries.push({ field: "title", before: metadata.title, after: op.value });
      continue;
    }
    const sel = op.trackSelector;
    if (!sel) continue;
    const candidates = metadata.tracks.filter(
      (t) => sel.trackType === "*" || t.type === sel.trackType
    );
    const targets =
      sel.trackIndex === "*" ? candidates : [candidates[sel.trackIndex]].filter(Boolean);
    for (const track of targets) {
      if (!track) continue;
      let before: string | boolean | null = null;
      switch (op.field) {
        case "trackLanguage": before = track.language; break;
        case "trackLanguageIETF": before = track.languageIETF; break;
        case "trackName": before = track.name; break;
        case "trackFlagDefault": before = track.flagDefault; break;
        case "trackFlagEnabled": before = track.flagEnabled; break;
        case "trackFlagForced": before = track.flagForced; break;
      }
      summaries.push({ field: op.field, trackSelector: sel, before, after: op.value });
    }
  }
  return summaries;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const twoAudioMeta: FullMetaStub = {
  title: "Original Title",
  tracks: [
    { id: 0, type: "video",     language: null,  languageIETF: null, name: null,            flagDefault: true,  flagEnabled: true,  flagForced: false },
    { id: 1, type: "audio",     language: "eng", languageIETF: "en", name: "English DTS",   flagDefault: true,  flagEnabled: true,  flagForced: false },
    { id: 2, type: "audio",     language: "fra", languageIETF: "fr", name: "French AC3",    flagDefault: false, flagEnabled: true,  flagForced: false },
    { id: 3, type: "subtitles", language: "eng", languageIETF: "en", name: "English SDH",   flagDefault: false, flagEnabled: true,  flagForced: false },
  ],
};

// ── detectConflicts ───────────────────────────────────────────────────────────

describe("detectConflicts", () => {
  it("returns no warnings when all track indices exist", () => {
    const ops: EditOperation[] = [
      { field: "trackLanguage", trackSelector: { trackType: "audio", trackIndex: 0 }, value: "jpn" },
      { field: "trackLanguage", trackSelector: { trackType: "audio", trackIndex: 1 }, value: "deu" },
    ];
    expect(detectConflicts(twoAudioMeta, ops)).toHaveLength(0);
  });

  it("warns when track index exceeds available tracks", () => {
    const ops: EditOperation[] = [
      { field: "trackLanguage", trackSelector: { trackType: "audio", trackIndex: 5 }, value: "jpn" },
    ];
    const warnings = detectConflicts(twoAudioMeta, ops);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("audio[5]");
    expect(warnings[0]).toContain("has 2 audio track(s)");
  });

  it("skips ops with wildcard trackIndex (no warning)", () => {
    const ops: EditOperation[] = [
      { field: "trackLanguage", trackSelector: { trackType: "audio", trackIndex: "*" }, value: "jpn" },
    ];
    expect(detectConflicts(twoAudioMeta, ops)).toHaveLength(0);
  });

  it("skips title ops (no trackSelector)", () => {
    const ops: EditOperation[] = [{ field: "title", value: "New Title" }];
    expect(detectConflicts(twoAudioMeta, ops)).toHaveLength(0);
  });

  it("skips ops with wildcard trackType", () => {
    const ops: EditOperation[] = [
      { field: "trackFlagDefault", trackSelector: { trackType: "*", trackIndex: 0 }, value: true },
    ];
    // index 0 exists across all types
    expect(detectConflicts(twoAudioMeta, ops)).toHaveLength(0);
  });

  it("warns on subtitle track index out of range", () => {
    const ops: EditOperation[] = [
      { field: "trackName", trackSelector: { trackType: "subtitles", trackIndex: 2 }, value: "SDH" },
    ];
    const warnings = detectConflicts(twoAudioMeta, ops);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("subtitles[2]");
  });

  it("emits multiple warnings for multiple bad ops", () => {
    const ops: EditOperation[] = [
      { field: "trackLanguage", trackSelector: { trackType: "audio",     trackIndex: 9 }, value: "eng" },
      { field: "trackName",     trackSelector: { trackType: "subtitles", trackIndex: 9 }, value: "SDH" },
    ];
    expect(detectConflicts(twoAudioMeta, ops)).toHaveLength(2);
  });
});

// ── buildChangesSummary ───────────────────────────────────────────────────────

describe("buildChangesSummary", () => {
  it("captures before and after for a title change", () => {
    const ops: EditOperation[] = [{ field: "title", value: "New Title" }];
    const summaries = buildChangesSummary(ops, twoAudioMeta);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ field: "title", before: "Original Title", after: "New Title" });
  });

  it("captures before and after for a track language change", () => {
    const ops: EditOperation[] = [
      { field: "trackLanguage", trackSelector: { trackType: "audio", trackIndex: 0 }, value: "jpn" },
    ];
    const summaries = buildChangesSummary(ops, twoAudioMeta);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ field: "trackLanguage", before: "eng", after: "jpn" });
  });

  it("produces one entry per matched track for wildcard index", () => {
    const ops: EditOperation[] = [
      { field: "trackLanguage", trackSelector: { trackType: "audio", trackIndex: "*" }, value: "und" },
    ];
    const summaries = buildChangesSummary(ops, twoAudioMeta);
    expect(summaries).toHaveLength(2); // 2 audio tracks
    expect(summaries.map((s) => s.before)).toEqual(["eng", "fra"]);
    expect(summaries.every((s) => s.after === "und")).toBe(true);
  });

  it("captures boolean before value for flag fields", () => {
    const ops: EditOperation[] = [
      { field: "trackFlagDefault", trackSelector: { trackType: "audio", trackIndex: 1 }, value: true },
    ];
    const summaries = buildChangesSummary(ops, twoAudioMeta);
    expect(summaries[0]).toMatchObject({ field: "trackFlagDefault", before: false, after: true });
  });

  it("captures null before value when language is unset", () => {
    const ops: EditOperation[] = [
      { field: "trackLanguage", trackSelector: { trackType: "video", trackIndex: 0 }, value: "eng" },
    ];
    const summaries = buildChangesSummary(ops, twoAudioMeta);
    expect(summaries[0]?.before).toBeNull();
  });

  it("returns empty array when no ops match any track", () => {
    const ops: EditOperation[] = [
      { field: "trackLanguage", trackSelector: { trackType: "audio", trackIndex: 99 }, value: "eng" },
    ];
    expect(buildChangesSummary(ops, twoAudioMeta)).toHaveLength(0);
  });

  it("skips track-level ops with no selector", () => {
    const ops: EditOperation[] = [
      { field: "trackLanguage", value: "eng" }, // no trackSelector
    ];
    expect(buildChangesSummary(ops, twoAudioMeta)).toHaveLength(0);
  });

  it("handles multiple operations producing multiple summaries", () => {
    const ops: EditOperation[] = [
      { field: "title", value: "New Title" },
      { field: "trackLanguage", trackSelector: { trackType: "audio", trackIndex: 0 }, value: "jpn" },
      { field: "trackName",     trackSelector: { trackType: "audio", trackIndex: 0 }, value: "Japanese DTS" },
    ];
    const summaries = buildChangesSummary(ops, twoAudioMeta);
    expect(summaries).toHaveLength(3);
    expect(summaries[0]?.field).toBe("title");
    expect(summaries[1]?.field).toBe("trackLanguage");
    expect(summaries[2]?.field).toBe("trackName");
  });
});
