import { describe, it, expect } from "vitest";
import { editOperationSchema } from "../../validation/editOperation.js";

/**
 * QUAL-02: editOperationSchema used to accept `value: string | boolean` for
 * every field and an optional trackSelector for every field, which let a
 * boolean-flag field receive a truthy *string* like "false" (the opposite
 * of the caller's intent) and let track-scoped fields through with no
 * selector at all. These tests pin the discriminated-union replacement.
 */
describe("editOperationSchema", () => {
  it("accepts a valid title operation with no trackSelector", () => {
    const result = editOperationSchema.safeParse({ field: "title", value: "New Title" });
    expect(result.success).toBe(true);
  });

  it("rejects a title operation carrying a trackSelector", () => {
    const result = editOperationSchema.safeParse({
      field: "title",
      value: "New Title",
      trackSelector: { trackType: "video", trackIndex: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects the string 'false' for a boolean flag field (the original exploit)", () => {
    const result = editOperationSchema.safeParse({
      field: "trackFlagForced",
      trackSelector: { trackType: "subtitles", trackIndex: 0 },
      value: "false",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an actual boolean for a flag field", () => {
    const result = editOperationSchema.safeParse({
      field: "trackFlagForced",
      trackSelector: { trackType: "subtitles", trackIndex: 0 },
      value: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects the literal string 'true' for the title field (type-mismatch exploit)", () => {
    const result = editOperationSchema.safeParse({ field: "title", value: true as unknown });
    expect(result.success).toBe(false);
  });

  it("rejects a track-scoped field with no trackSelector", () => {
    const result = editOperationSchema.safeParse({ field: "trackName", value: "Commentary" });
    expect(result.success).toBe(false);
  });

  it("rejects a trackLanguage value that is not a 3-letter ISO 639-2 code", () => {
    const result = editOperationSchema.safeParse({
      field: "trackLanguage",
      trackSelector: { trackType: "audio", trackIndex: 0 },
      value: "english",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid ISO 639-2 trackLanguage value", () => {
    const result = editOperationSchema.safeParse({
      field: "trackLanguage",
      trackSelector: { trackType: "audio", trackIndex: 0 },
      value: "eng",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid BCP 47 trackLanguageIETF value", () => {
    const result = editOperationSchema.safeParse({
      field: "trackLanguageIETF",
      trackSelector: { trackType: "audio", trackIndex: 0 },
      value: "zh-Hans-CN",
    });
    expect(result.success).toBe(true);
  });
});
