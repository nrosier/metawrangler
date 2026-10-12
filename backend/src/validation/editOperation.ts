/**
 * Zod validation for bulk-edit operations — split out from routes/jobs.ts so
 * it can be unit-tested without pulling in the db module (which imports
 * bun:sqlite and can't load under Node/Vitest).
 */
import { z } from "zod";

const trackSelectorSchema = z.object({
  trackType: z.enum(["video", "audio", "subtitles", "unknown", "*"]),
  trackIndex: z.union([z.number().int().min(0), z.literal("*")]),
});

// Discriminated on `field` so each variant pins down exactly which `value`
// type is accepted and whether `trackSelector` is required, forbidden, or
// absent (QUAL-02). Without this, e.g. `{field: "trackFlagForced", value:
// "false"}` passed validation and became truthy downstream — the opposite
// of what the string "false" means to a caller — and track-level fields
// with no selector were silently skipped rather than rejected.
export const editOperationSchema = z.discriminatedUnion("field", [
  // File-level title: a plain string, no track selector.
  z.strictObject({
    field: z.literal("title"),
    value: z.string().min(1).max(500),
  }),
  // Track-level text fields.
  z.strictObject({
    field: z.literal("trackName"),
    trackSelector: trackSelectorSchema,
    value: z.string().min(1).max(500),
  }),
  // ISO 639-2 (3-letter) language code — matches the frontend's own
  // ISO_639_2 regex so the backend can't accept what the UI would reject.
  z.strictObject({
    field: z.literal("trackLanguage"),
    trackSelector: trackSelectorSchema,
    value: z.string().regex(/^[a-z]{3}$/, "Must be a 3-letter ISO 639-2 code"),
  }),
  // BCP 47 language tag, e.g. "en", "en-US", "zh-Hans-CN".
  z.strictObject({
    field: z.literal("trackLanguageIETF"),
    trackSelector: trackSelectorSchema,
    value: z
      .string()
      .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/, "Must be a valid BCP 47 language tag"),
  }),
  // Track-level boolean flags — `value` must be an actual boolean, not a
  // truthy/falsy-looking string.
  z.strictObject({
    field: z.literal("trackFlagDefault"),
    trackSelector: trackSelectorSchema,
    value: z.boolean(),
  }),
  z.strictObject({
    field: z.literal("trackFlagEnabled"),
    trackSelector: trackSelectorSchema,
    value: z.boolean(),
  }),
  z.strictObject({
    field: z.literal("trackFlagForced"),
    trackSelector: trackSelectorSchema,
    value: z.boolean(),
  }),
]);
