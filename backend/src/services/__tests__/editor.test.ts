import { describe, it, expect } from "vitest";
import { buildMkvpropeditArgs } from "../editor.js";
import type { EditOperation, MkvFileMetadata } from "../../types/index.js";

/** Minimal metadata fixture for a typical MKV with 1 video, 2 audio, 1 subtitle track */
const sampleMetadata: MkvFileMetadata = {
  filePath: "/media/movies/test.mkv",
  title: "Original Title",
  rawJson: "{}",
  tracks: [
    {
      id: 0, type: "video", codecId: "V_MPEG4/ISO/AVC",
      language: null, languageIETF: null, name: null,
      flagDefault: true, flagEnabled: true, flagForced: false,
    },
    {
      id: 1, type: "audio", codecId: "A_DTS",
      language: "eng", languageIETF: "en", name: "English DTS-HD",
      flagDefault: true, flagEnabled: true, flagForced: false,
      channels: 6,
    },
    {
      id: 2, type: "audio", codecId: "A_AC3",
      language: "fra", languageIETF: "fr", name: "French AC3",
      flagDefault: false, flagEnabled: true, flagForced: false,
      channels: 2,
    },
    {
      id: 3, type: "subtitles", codecId: "S_TEXT/ASS",
      language: "eng", languageIETF: "en", name: "English SDH",
      flagDefault: false, flagEnabled: true, flagForced: false,
    },
  ],
};

describe("buildMkvpropeditArgs — title", () => {
  it("sets the segment title", () => {
    const ops: EditOperation[] = [{ field: "title", value: "New Title" }];
    const args = buildMkvpropeditArgs("/media/movies/test.mkv", ops, sampleMetadata);
    expect(args).toContain("--edit");
    expect(args).toContain("info");
    expect(args).toContain("--set");
    expect(args).toContain("title=New Title");
  });

  it("starts with the file path", () => {
    const ops: EditOperation[] = [{ field: "title", value: "X" }];
    const args = buildMkvpropeditArgs("/media/movies/test.mkv", ops, sampleMetadata);
    expect(args[0]).toBe("/media/movies/test.mkv");
  });
});

describe("buildMkvpropeditArgs — track language", () => {
  it("targets audio track 0 (id=1 in global order) for language", () => {
    const ops: EditOperation[] = [
      {
        field: "trackLanguage",
        trackSelector: { trackType: "audio", trackIndex: 0 },
        value: "jpn",
      },
    ];
    const args = buildMkvpropeditArgs("/media/movies/test.mkv", ops, sampleMetadata);
    // Track id 1 → mkvpropedit target is "track:2" (1-based)
    expect(args).toContain("track:2");
    expect(args).toContain("language=jpn");
  });

  it("targets all audio tracks when trackIndex is '*'", () => {
    const ops: EditOperation[] = [
      {
        field: "trackLanguage",
        trackSelector: { trackType: "audio", trackIndex: "*" },
        value: "und",
      },
    ];
    const args = buildMkvpropeditArgs("/media/movies/test.mkv", ops, sampleMetadata);
    // Should target both track:2 and track:3
    const trackArgs = args.filter((a) => a.startsWith("track:"));
    expect(trackArgs).toContain("track:2");
    expect(trackArgs).toContain("track:3");
    // language=und should appear twice
    expect(args.filter((a) => a === "language=und").length).toBe(2);
  });

  it("skips operation when track index does not exist", () => {
    const ops: EditOperation[] = [
      {
        field: "trackLanguage",
        trackSelector: { trackType: "audio", trackIndex: 99 },
        value: "eng",
      },
    ];
    const args = buildMkvpropeditArgs("/media/movies/test.mkv", ops, sampleMetadata);
    // Only the filename — no operations appended
    expect(args.length).toBe(1);
  });
});

describe("buildMkvpropeditArgs — flags", () => {
  it("sets flag-default to 1 for true", () => {
    const ops: EditOperation[] = [
      {
        field: "trackFlagDefault",
        trackSelector: { trackType: "subtitles", trackIndex: 0 },
        value: true,
      },
    ];
    const args = buildMkvpropeditArgs("/media/movies/test.mkv", ops, sampleMetadata);
    expect(args).toContain("flag-default=1");
  });

  it("sets flag-default to 0 for false", () => {
    const ops: EditOperation[] = [
      {
        field: "trackFlagDefault",
        trackSelector: { trackType: "audio", trackIndex: 0 },
        value: false,
      },
    ];
    const args = buildMkvpropeditArgs("/media/movies/test.mkv", ops, sampleMetadata);
    expect(args).toContain("flag-default=0");
  });

  it("sets flag-enabled to 0 to disable a track", () => {
    const ops: EditOperation[] = [
      {
        field: "trackFlagEnabled",
        trackSelector: { trackType: "subtitles", trackIndex: 0 },
        value: false,
      },
    ];
    const args = buildMkvpropeditArgs("/media/movies/test.mkv", ops, sampleMetadata);
    expect(args).toContain("flag-enabled=0");
  });
});

describe("buildMkvpropeditArgs — track name", () => {
  it("sets the track name", () => {
    const ops: EditOperation[] = [
      {
        field: "trackName",
        trackSelector: { trackType: "audio", trackIndex: 0 },
        value: "Director's Commentary",
      },
    ];
    const args = buildMkvpropeditArgs("/media/movies/test.mkv", ops, sampleMetadata);
    expect(args).toContain("name=Director's Commentary");
  });
});

describe("buildMkvpropeditArgs — missing selector", () => {
  it("skips a track-level operation with no trackSelector", () => {
    const ops: EditOperation[] = [
      { field: "trackLanguage", value: "eng" }, // no trackSelector
    ];
    const args = buildMkvpropeditArgs("/media/movies/test.mkv", ops, sampleMetadata);
    expect(args.length).toBe(1); // only filename
  });
});
