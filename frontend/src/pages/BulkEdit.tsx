/**
 * BulkEdit page — configure operations, preview, and submit edit job.
 * Receives filePaths via router location state.
 */
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  FlaskConical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatPath } from "@/lib/utils";
import type {
  EditOperation,
  EditableField,
  TrackType,
} from "@/types";

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

const FLAG_FIELDS: EditableField[] = [
  "trackFlagDefault",
  "trackFlagEnabled",
  "trackFlagForced",
];

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

  // Pre-load metadata for all selected files (for conflict preview)
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
      <div className="p-8 text-center">
        <p className="text-muted">No files selected.</p>
        <button className="btn-ghost mt-3" onClick={() => { void navigate("/"); }}>
          <ChevronLeft size={14} /> Back to Browse
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
        const tracks = result.metadata.tracks.filter(
          (t) => op.trackType === "*" || t.type === op.trackType
        );
        if (typeof op.trackIndex === "number" && op.trackIndex >= tracks.length) {
          conflicts.push(
            `"${formatPath(result.filePath)}" has only ${tracks.length} ${op.trackType} track(s) — operation on index ${op.trackIndex} will be skipped.`
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
    setOps((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
    );
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
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={() => { void navigate("/"); }}>
          <ChevronLeft size={14} />
        </button>
        <h1 className="text-lg font-semibold">Bulk Edit</h1>
        <span className="text-muted text-sm">
          — {filePaths.length} file{filePaths.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Selected files summary */}
      <section className="border border-border rounded bg-surface px-4 py-3">
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
          Selected files
        </p>
        <ul className="space-y-0.5 max-h-36 overflow-y-auto">
          {filePaths.map((f) => (
            <li key={f} className="font-mono text-xs text-gray-700 truncate">
              {f}
            </li>
          ))}
        </ul>
      </section>

      {/* Conflict warnings */}
      {conflicts.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-1.5 text-amber-700 font-medium text-sm mb-1">
            <AlertTriangle size={14} />
            Track index conflicts detected
          </div>
          <ul className="space-y-0.5">
            {conflicts.map((c, i) => (
              <li key={i} className="text-xs text-amber-700">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Operations */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Operations</p>
          <button className="btn-ghost text-xs" onClick={addOp}>
            <Plus size={13} /> Add operation
          </button>
        </div>
        <div className="space-y-3">
          {ops.map((op) => (
            <div
              key={op.id}
              className="border border-border rounded p-3 bg-white grid gap-3"
            >
              {/* Field selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Field</label>
                  <select
                    className="select"
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

                {/* Value input */}
                <div>
                  <label className="block text-xs text-muted mb-1">Value</label>
                  {FLAG_FIELDS.includes(op.field) ? (
                    <select
                      className="select"
                      value={op.boolValue ? "true" : "false"}
                      onChange={(e) =>
                        updateOp(op.id, {
                          boolValue: e.target.value === "true",
                        })
                      }
                    >
                      <option value="true">Yes / 1 (enabled)</option>
                      <option value="false">No / 0 (disabled)</option>
                    </select>
                  ) : (
                    <input
                      className="input"
                      type="text"
                      placeholder={
                        op.field === "trackLanguage"
                          ? "e.g. eng"
                          : op.field === "trackLanguageIETF"
                          ? "e.g. en-US"
                          : "Enter value…"
                      }
                      value={op.value}
                      onChange={(e) =>
                        updateOp(op.id, { value: e.target.value })
                      }
                    />
                  )}
                </div>
              </div>

              {/* Track selector — only for track-level fields */}
              {TRACK_FIELDS.includes(op.field) && op.field !== "title" && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Track type
                    </label>
                    <select
                      className="select"
                      value={op.trackType}
                      onChange={(e) =>
                        updateOp(op.id, {
                          trackType: e.target.value as TrackType | "*",
                        })
                      }
                    >
                      {TRACK_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Track index
                    </label>
                    <select
                      className="select"
                      value={op.trackIndex === "*" ? "*" : String(op.trackIndex)}
                      onChange={(e) =>
                        updateOp(op.id, {
                          trackIndex:
                            e.target.value === "*"
                              ? "*"
                              : Number(e.target.value),
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
                <div className="flex justify-end">
                  <button
                    className="btn-ghost text-xs text-red-500 hover:text-red-700 border-red-200 hover:border-red-300"
                    onClick={() => removeOp(op.id)}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Dry-run toggle + submit */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          <FlaskConical size={14} className="text-muted" />
          Dry run (preview changes without writing)
        </label>

        <button
          className={dryRun ? "btn-ghost" : "btn-primary"}
          onClick={handleSubmit}
          disabled={createJob.isPending}
        >
          {dryRun ? (
            <>
              <FlaskConical size={14} /> Preview changes
            </>
          ) : (
            <>
              <Pencil size={14} /> Apply to {filePaths.length} file
              {filePaths.length !== 1 ? "s" : ""}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
