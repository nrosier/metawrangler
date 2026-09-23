/**
 * BulkEdit page — configure operations, preview, and submit edit job.
 * Receives filePaths via router location state.
 */
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconAlertTriangle, IconChevronLeft, IconFlask, IconPencil, IconPlus, IconTrash } from "@/icons";
import { api } from "@/lib/api";
import { formatPath } from "@/lib/utils";
import type { EditOperation, EditableField, TrackType } from "@/types";

type LocationState = { filePaths: string[] } | null;

const FIELD_LABELS: Record<EditableField, string> = {
  title: "File Title",
  trackLanguage: "Track Language (ISO 639-2)",
  trackLanguageIETF: "Track Language (BCP 47 / IETF)",
  trackName: "Track Name",
  trackFlagDefault: "Default Flag",
  trackFlagEnabled: "Enabled Flag",
  trackFlagForced: "Forced Flag",
};

const FLAG_FIELDS: EditableField[] = ["trackFlagDefault", "trackFlagEnabled", "trackFlagForced"];

const TRACK_FIELDS: EditableField[] = [
  "trackLanguage",
  "trackLanguageIETF",
  "trackName",
  "trackFlagDefault",
  "trackFlagEnabled",
  "trackFlagForced",
];

const TRACK_TYPES: Array<{ value: TrackType | "*"; label: string }> = [
  { value: "*", label: "All tracks" },
  { value: "audio", label: "Audio" },
  { value: "subtitles", label: "Subtitles" },
  { value: "video", label: "Video" },
];

interface OperationForm {
  id: number;
  field: EditableField;
  trackType: TrackType | "*";
  trackIndex: number | "*";
  value: string;
  boolValue: boolean;
}

let nextId = 1;

function newOp(): OperationForm {
  return {
    id: nextId++,
    field: "trackLanguage",
    trackType: "audio",
    trackIndex: 0,
    value: "",
    boolValue: false,
  };
}

function toEditOperation(form: OperationForm): EditOperation {
  const isFlag = FLAG_FIELDS.includes(form.field);
  const value: string | boolean = isFlag ? form.boolValue : form.value;

  if (form.field === "title") {
    return { field: form.field, value };
  }

  return {
    field: form.field,
    trackSelector: {
      trackType: form.trackType,
      trackIndex: form.trackIndex,
    },
    value,
  };
}

export function BulkEditPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;
  const filePaths = state?.filePaths ?? [];

  const [ops, setOps] = useState<OperationForm[]>([newOp()]);
  const [dryRun, setDryRun] = useState(false);

  const { data: metaResults } = useQuery({
    queryKey: ["meta-bulk", filePaths],
    queryFn: () => api.scan.getMetadata(filePaths),
    enabled: filePaths.length > 0 && filePaths.length <= 100,
  });

  const createJob = useMutation({
    mutationFn: api.jobs.create,
    onSuccess: ({ jobId }) => {
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

  // Conflict detection: find ops targeting track indices that don't exist in all files
  const conflicts: string[] = [];
  if (metaResults) {
    for (const op of ops) {
      if (op.field === "title" || op.trackIndex === "*") continue;
      for (const result of metaResults) {
        if (!result.metadata) continue;
        const tracks = result.metadata.tracks.filter((t) => op.trackType === "*" || t.type === op.trackType);
        if (typeof op.trackIndex === "number" && op.trackIndex >= tracks.length) {
          conflicts.push(
            `"${formatPath(result.filePath)}" has only ${tracks.length} ${op.trackType} track(s) — operation on index ${op.trackIndex} will be skipped.`,
          );
        }
      }
    }
  }

  function addOp() {
    setOps((prev) => [...prev, newOp()]);
  }

  function removeOp(id: number) {
    setOps((prev) => prev.filter((o) => o.id !== id));
  }

  function updateOp(id: number, patch: Partial<OperationForm>) {
    setOps((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function handleSubmit() {
    const validOps = ops.filter((o) => {
      if (FLAG_FIELDS.includes(o.field)) return true;
      return o.value.trim().length > 0;
    });
    if (validOps.length === 0) {
      toast.warning("Add at least one operation with a value");
      return;
    }

    createJob.mutate({
      filePaths,
      operations: validOps.map(toEditOperation),
      dryRun,
    });
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

      {conflicts.length > 0 && (
        <div className="notice notice--warn">
          <p className="notice__lead">
            <IconAlertTriangle />
            Track index conflicts detected
          </p>
          <ul className="notice__list">
            {conflicts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="stack">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <p className="card__title" style={{ marginBottom: 0 }}>Operations</p>
          <button className="button button--quiet button--sm" onClick={addOp}>
            <IconPlus /> Add operation
          </button>
        </div>
        <div className="stack">
          {ops.map((op) => (
            <div key={op.id} className="card stack">
              <div className="form-grid">
                <div className="field">
                  <label className="field__label">Field</label>
                  <select
                    className="field__input"
                    value={op.field}
                    onChange={(e) => {
                      const field = e.target.value as EditableField;
                      updateOp(op.id, {
                        field,
                        value: "",
                        boolValue: false,
                        trackIndex: TRACK_FIELDS.includes(field) ? 0 : op.trackIndex,
                      });
                    }}
                  >
                    {Object.entries(FIELD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field__label">Value</label>
                  {FLAG_FIELDS.includes(op.field) ? (
                    <select
                      className="field__input"
                      value={op.boolValue ? "true" : "false"}
                      onChange={(e) => updateOp(op.id, { boolValue: e.target.value === "true" })}
                    >
                      <option value="true">Yes / 1 (enabled)</option>
                      <option value="false">No / 0 (disabled)</option>
                    </select>
                  ) : (
                    <input
                      className="field__input"
                      type="text"
                      placeholder={
                        op.field === "trackLanguage" ? "e.g. eng" : op.field === "trackLanguageIETF" ? "e.g. en-US" : "Enter value…"
                      }
                      value={op.value}
                      onChange={(e) => updateOp(op.id, { value: e.target.value })}
                    />
                  )}
                </div>
              </div>

              {TRACK_FIELDS.includes(op.field) && op.field !== "title" && (
                <div className="form-grid form-grid--divider">
                  <div className="field">
                    <label className="field__label">Track type</label>
                    <select
                      className="field__input"
                      value={op.trackType}
                      onChange={(e) => updateOp(op.id, { trackType: e.target.value as TrackType | "*" })}
                    >
                      {TRACK_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label">Track index</label>
                    <select
                      className="field__input"
                      value={op.trackIndex === "*" ? "*" : String(op.trackIndex)}
                      onChange={(e) =>
                        updateOp(op.id, {
                          trackIndex: e.target.value === "*" ? "*" : Number(e.target.value),
                        })
                      }
                    >
                      <option value="*">All tracks of this type</option>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <option key={i} value={i}>
                          Index {i}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {ops.length > 1 && (
                <div className="toolbar toolbar--end">
                  <button className="button button--danger button--sm" onClick={() => removeOp(op.id)}>
                    <IconTrash /> Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

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
          disabled={createJob.isPending}
        >
          {dryRun ? (
            <>
              <IconFlask /> Preview changes
            </>
          ) : (
            <>
              <IconPencil /> Apply to {filePaths.length} file{filePaths.length !== 1 ? "s" : ""}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
