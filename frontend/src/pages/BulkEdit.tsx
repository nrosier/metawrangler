/**
 * BulkEdit page — a fixed set of modifiable fields (container title, plus
 * language/name/flags per track), pre-filled from the selected files' current
 * metadata. No ad hoc operation builder: every field that can be changed is
 * always shown, and only fields the user actually touches become operations.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconAlertTriangle, IconChevronLeft, IconClock, IconFlask, IconPencil, IconXCircle } from "@/icons";
import { api } from "@/lib/api";
import { QueryError } from "@/components/QueryError";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft";
import { formatDate } from "@/lib/utils";
import type { EditOperation, EditableField, MkvTrack, TrackType } from "@/types";

type LocationState = { filePaths: string[] } | null;

const ISO_639_2 = /^[a-z]{3}$/;

// Must match the backend's own `fileMetaSchema`/`createJobSchema` cap
// (backend/src/routes/scan.ts, backend/src/routes/jobs.ts) — previously the
// frontend's own query was disabled above 100 with no message at all, even
// though the backend already accepted up to this many (UX-03).
const MAX_FILES_PER_BATCH = 500;

interface Aggregate<T> {
  same: boolean;
  value: T;
}

function aggregate<T>(values: T[]): Aggregate<T> {
  const first = values[0]!;
  return { same: values.every((v) => v === first), value: first };
}

interface TrackSlot {
  index: number;
  filesPresent: number;
  language: Aggregate<string>;
  name: Aggregate<string>;
  flagDefault: Aggregate<boolean>;
  flagEnabled: Aggregate<boolean>;
  flagForced: Aggregate<boolean>;
}

function buildSlots(filesMeta: Array<{ tracks: MkvTrack[] }>, type: TrackType): TrackSlot[] {
  const maxCount = filesMeta.reduce((max, m) => Math.max(max, m.tracks.filter((t) => t.type === type).length), 0);
  const slots: TrackSlot[] = [];
  for (let i = 0; i < maxCount; i++) {
    const tracksAtSlot = filesMeta
      .map((m) => m.tracks.filter((t) => t.type === type)[i])
      .filter((t): t is MkvTrack => !!t);
    slots.push({
      index: i,
      filesPresent: tracksAtSlot.length,
      language: aggregate(tracksAtSlot.map((t) => t.language ?? "")),
      name: aggregate(tracksAtSlot.map((t) => t.name ?? "")),
      flagDefault: aggregate(tracksAtSlot.map((t) => t.flagDefault)),
      flagEnabled: aggregate(tracksAtSlot.map((t) => t.flagEnabled)),
      flagForced: aggregate(tracksAtSlot.map((t) => t.flagForced)),
    });
  }
  return slots;
}

const trackKey = (type: TrackType, index: number, field: EditableField): string => `${type}:${index}:${field}`;

function TextField(props: {
  label: string;
  agg: Aggregate<string>;
  edited: string | undefined;
  onChange: (value: string) => void;
  maxLength?: number;
  hint?: string;
  lowercase?: boolean;
}): ReactNode {
  const displayValue = props.edited ?? (props.agg.same ? props.agg.value : "");
  return (
    <div className="field">
      <label className="field__label">{props.label}</label>
      <input
        className="field__input"
        type="text"
        value={displayValue}
        placeholder={props.agg.same ? undefined : "Multiple values"}
        maxLength={props.maxLength}
        onChange={(e) => props.onChange(props.lowercase ? e.target.value.toLowerCase() : e.target.value)}
      />
      {props.hint && (
        <span className="muted" style={{ fontSize: "var(--type-xs)" }}>
          {props.hint}
        </span>
      )}
    </div>
  );
}

function TriCheckbox(props: {
  label: string;
  agg: Aggregate<boolean>;
  edited: boolean | undefined;
  onChange: (value: boolean) => void;
}): ReactNode {
  const ref = useRef<HTMLInputElement>(null);
  const indeterminate = props.edited === undefined && !props.agg.same;
  const checked = props.edited ?? (props.agg.same ? props.agg.value : false);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className="field field--inline">
      <input
        ref={ref}
        type="checkbox"
        className="field__checkbox"
        checked={checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span>{props.label}</span>
    </label>
  );
}

export function BulkEditPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  // A fresh navigation from Browse (real router state) always wins over a
  // leftover draft — only fall back to the draft when there's no state at
  // all, i.e. a reload, direct link, or restored tab (LOCAL-02).
  const [draft, setDraft] = useState(() =>
    state?.filePaths && state.filePaths.length > 0 ? null : loadDraft()
  );
  const [draftDiscarded, setDraftDiscarded] = useState(false);

  const filePaths = useMemo(
    () => (draftDiscarded ? [] : state?.filePaths ?? draft?.filePaths ?? []),
    [draftDiscarded, state?.filePaths, draft?.filePaths]
  );

  const [edits, setEdits] = useState<Record<string, string | boolean>>(() => draft?.edits ?? {});
  const [dryRun, setDryRun] = useState(() => draft?.dryRun ?? false);
  // Files the user has explicitly removed after a failed preview scan — see
  // the "failed to scan" panel below (UX-03).
  const [excludedPaths, setExcludedPaths] = useState<Set<string>>(new Set());

  function discardDraft() {
    clearDraft();
    setDraft(null);
    setDraftDiscarded(true);
  }

  // Persist on every change so a reload/crash never loses more than whatever
  // happened between this render and the last one. Re-scanning a restored
  // draft's files (below, via the existing meta-bulk query) is what keeps a
  // stale draft honest — this alone doesn't claim the saved edits are still
  // valid against current file state.
  useEffect(() => {
    if (filePaths.length === 0) return;
    saveDraft({ filePaths, edits, dryRun });
  }, [filePaths, edits, dryRun]);

  const overLimit = filePaths.length > MAX_FILES_PER_BATCH;
  const activeFilePaths = filePaths.filter((p) => !excludedPaths.has(p));

  const {
    data: metaResults,
    isLoading: metaLoading,
    isError: metaIsError,
    error: metaError,
    refetch: refetchMeta,
  } = useQuery({
    queryKey: ["meta-bulk", activeFilePaths],
    queryFn: () => api.scan.getMetadata(activeFilePaths),
    enabled: activeFilePaths.length > 0 && !overLimit,
  });

  const createJob = useMutation({
    mutationFn: api.jobs.create,
    onSuccess: ({ jobId }) => {
      // The job now owns these changes — a leftover draft would just be
      // confusing (or get silently re-applied) the next time this page loads.
      clearDraft();
      toast.success(dryRun ? "Dry-run job started" : "Edit job started");
      void navigate(`/jobs/${jobId}`);
    },
    onError: (err: Error) => {
      toast.error(`Failed to start job: ${err.message}`);
    },
  });

  if (filePaths.length === 0) {
    return (
      <div className="stack" style={{ textAlign: "center" }}>
        <p className="muted">No files selected.</p>
        <button className="button button--quiet" onClick={() => { void navigate("/"); }}>
          <IconChevronLeft /> Back to Browse
        </button>
      </div>
    );
  }

  if (overLimit) {
    return (
      <div className="stack" style={{ textAlign: "center" }}>
        <p className="notice notice--warn">
          <IconAlertTriangle /> {filePaths.length} files selected, but a single bulk edit is limited
          to {MAX_FILES_PER_BATCH}. Go back and select {MAX_FILES_PER_BATCH} or fewer, or split this
          into multiple batches.
        </p>
        <button className="button button--quiet" onClick={() => { void navigate("/"); }}>
          <IconChevronLeft /> Back to Browse
        </button>
      </div>
    );
  }

  function setText(key: string, value: string, agg: Aggregate<string>) {
    setEdits((prev) => {
      const next = { ...prev };
      if (value === "" || (agg.same && value === agg.value)) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function setBool(key: string, value: boolean, agg: Aggregate<boolean>) {
    setEdits((prev) => {
      const next = { ...prev };
      if (agg.same && value === agg.value) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  const failedResults = (metaResults ?? []).filter((r) => !r.metadata);
  const scannedPaths = (metaResults ?? []).filter((r) => r.metadata).map((r) => r.filePath);

  function handleSubmit() {
    const operations: EditOperation[] = Object.entries(edits).map(([key, value]) => {
      if (key === "title") return { field: "title", value };
      const [trackType, indexStr, field] = key.split(":");
      return {
        field: field as EditableField,
        trackSelector: { trackType: trackType as TrackType, trackIndex: Number(indexStr) },
        value,
      };
    });

    if (operations.length === 0) {
      toast.warning("Change at least one field before applying");
      return;
    }

    const badLanguage = operations.find(
      (op) => op.field === "trackLanguage" && !ISO_639_2.test(String(op.value))
    );
    if (badLanguage) {
      toast.error("Track language must be a 3-letter ISO 639-2 code (e.g. eng, jpn)");
      return;
    }

    if (failedResults.length > 0) {
      // Belt-and-suspenders: the submit button is already disabled while
      // this is true, but never submit against files the preview never
      // actually confirmed metadata for (UX-03).
      toast.error("Remove or retry the files that failed to scan before applying.");
      return;
    }

    // Submit exactly the files the preview actually succeeded on — not the
    // original selection — so an edit inferred from a partial preview can
    // never be applied to a file the user never previewed (UX-03).
    createJob.mutate({ filePaths: scannedPaths, operations, dryRun });
  }

  const filesMeta = (metaResults ?? []).filter((r) => r.metadata).map((r) => r.metadata!);
  const totalFiles = filesMeta.length;
  const titleAgg = aggregate(filesMeta.map((m) => m.title ?? ""));

  const videoSlots = buildSlots(filesMeta, "video");
  const audioSlots = buildSlots(filesMeta, "audio");
  const subtitleSlots = buildSlots(filesMeta, "subtitles");

  const availabilityNotes: string[] = [];
  for (const [label, slots] of [
    ["Video", videoSlots],
    ["Audio", audioSlots],
    ["Subtitle", subtitleSlots],
  ] as const) {
    for (const slot of slots) {
      if (slot.filesPresent < totalFiles) {
        availabilityNotes.push(
          `${label} track ${slot.index + 1} is present in ${slot.filesPresent} of ${totalFiles} files — edits to it only apply to those files.`
        );
      }
    }
  }

  return (
    <div className="stack" style={{ maxWidth: "48rem" }}>
      <div className="page__heading">
        <button className="button button--quiet button--icon" onClick={() => { void navigate("/"); }} aria-label="Back to Browse">
          <IconChevronLeft />
        </button>
        <h1 className="page__title">Bulk Edit</h1>
        <span className="muted">
          — {filePaths.length} file{filePaths.length !== 1 ? "s" : ""}
        </span>
      </div>

      {draft && !draftDiscarded && (
        <div className="notice notice--warn">
          <p className="notice__lead">
            <IconClock />
            Restored an unsaved draft from {formatDate(draft.savedAt)} — files are being
            re-scanned below to confirm they still match before you apply anything.
          </p>
          <button className="button button--quiet" onClick={discardDraft}>
            Discard draft
          </button>
        </div>
      )}

      <section className="card card--sunken">
        <p className="section-label">Selected files</p>
        <ul className="file-list">
          {filePaths.map((f) => (
            <li key={f} className="file-list__item">
              {f}
            </li>
          ))}
        </ul>
      </section>

      {metaLoading && <p className="muted">Loading current metadata…</p>}
      {metaIsError && <QueryError error={metaError} onRetry={() => { void refetchMeta(); }} />}

      {failedResults.length > 0 && (
        <div className="notice notice--error">
          <p className="notice__lead">
            <IconXCircle />
            {failedResults.length} file{failedResults.length !== 1 ? "s" : ""} failed to scan — remove
            them or retry before applying
          </p>
          <ul className="notice__list">
            {failedResults.map((r) => (
              <li key={r.filePath} className="toolbar" style={{ justifyContent: "space-between" }}>
                <span className="table__cell--path">{r.filePath}</span>
                <span className="toolbar" style={{ gap: "var(--space-2)" }}>
                  {r.error && <span className="muted" style={{ fontSize: "var(--type-xs)" }}>{r.error}</span>}
                  <button
                    className="button button--quiet button--sm"
                    onClick={() => setExcludedPaths((prev) => new Set(prev).add(r.filePath))}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button className="button button--quiet" onClick={() => { void refetchMeta(); }}>
            Retry scan
          </button>
        </div>
      )}

      {availabilityNotes.length > 0 && (
        <div className="notice notice--warn">
          <p className="notice__lead">
            <IconAlertTriangle />
            Track counts differ across the selected files
          </p>
          <ul className="notice__list">
            {availabilityNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {!metaLoading && totalFiles > 0 && (
        <>
          <section className="card stack">
            <p className="card__title">General</p>
            <TextField
              label="Title"
              agg={titleAgg}
              edited={edits.title as string | undefined}
              onChange={(v) => setText("title", v, titleAgg)}
            />
          </section>

          {videoSlots.length > 0 && (
            <section className="card stack">
              <p className="card__title">Video track{videoSlots.length !== 1 ? "s" : ""}</p>
              {videoSlots.map((slot) => {
                const key = trackKey("video", slot.index, "trackLanguage");
                return (
                  <TextField
                    key={key}
                    label={`Track ${slot.index + 1} — Language (ISO 639-2)`}
                    agg={slot.language}
                    edited={edits[key] as string | undefined}
                    onChange={(v) => setText(key, v, slot.language)}
                    maxLength={3}
                    hint="e.g. eng, jpn, fre"
                    lowercase
                  />
                );
              })}
            </section>
          )}

          {([
            ["audio", "Audio", audioSlots],
            ["subtitles", "Subtitle", subtitleSlots],
          ] as const).map(([type, label, slots]) =>
            slots.length > 0 ? (
              <section key={type} className="card stack">
                <p className="card__title">
                  {label} track{slots.length !== 1 ? "s" : ""}
                </p>
                {slots.map((slot) => {
                  const langKey = trackKey(type, slot.index, "trackLanguage");
                  const nameKey = trackKey(type, slot.index, "trackName");
                  const defaultKey = trackKey(type, slot.index, "trackFlagDefault");
                  const enabledKey = trackKey(type, slot.index, "trackFlagEnabled");
                  const forcedKey = trackKey(type, slot.index, "trackFlagForced");
                  return (
                    <div key={slot.index} className="stack" style={{ gap: "var(--space-2)" }}>
                      <p className="section-label">Track {slot.index + 1}</p>
                      <div className="form-grid">
                        <TextField
                          label="Language (ISO 639-2)"
                          agg={slot.language}
                          edited={edits[langKey] as string | undefined}
                          onChange={(v) => setText(langKey, v, slot.language)}
                          maxLength={3}
                          hint="e.g. eng, jpn, fre"
                          lowercase
                        />
                        <TextField
                          label="Name / Title"
                          agg={slot.name}
                          edited={edits[nameKey] as string | undefined}
                          onChange={(v) => setText(nameKey, v, slot.name)}
                        />
                      </div>
                      <div className="toolbar">
                        <TriCheckbox
                          label="Default"
                          agg={slot.flagDefault}
                          edited={edits[defaultKey] as boolean | undefined}
                          onChange={(v) => setBool(defaultKey, v, slot.flagDefault)}
                        />
                        <TriCheckbox
                          label="Enabled"
                          agg={slot.flagEnabled}
                          edited={edits[enabledKey] as boolean | undefined}
                          onChange={(v) => setBool(enabledKey, v, slot.flagEnabled)}
                        />
                        <TriCheckbox
                          label="Forced"
                          agg={slot.flagForced}
                          edited={edits[forcedKey] as boolean | undefined}
                          onChange={(v) => setBool(forcedKey, v, slot.flagForced)}
                        />
                      </div>
                    </div>
                  );
                })}
              </section>
            ) : null
          )}
        </>
      )}

      <div className="toolbar form-grid--divider" style={{ justifyContent: "space-between" }}>
        <label className="field--inline" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            className="field__checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          <IconFlask className="table__cell--muted" />
          Dry run (preview changes without writing)
        </label>

        <button
          className={dryRun ? "button button--quiet" : "button"}
          onClick={handleSubmit}
          disabled={createJob.isPending || failedResults.length > 0 || scannedPaths.length === 0}
          title={failedResults.length > 0 ? "Remove or retry the failed files above first" : undefined}
        >
          {dryRun ? (
            <>
              <IconFlask /> Preview changes
            </>
          ) : (
            <>
              <IconPencil /> Apply to {scannedPaths.length} file{scannedPaths.length !== 1 ? "s" : ""}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
