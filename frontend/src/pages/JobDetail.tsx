/**
 * Job detail page — live progress stream + per-file results + undo button.
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  SkipForward,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useJobSocket } from "@/hooks/useJobSocket";
import { StatusBadge } from "@/components/StatusBadge";
import { formatPath, formatDate } from "@/lib/utils";
import type { JobFile, FileStatus } from "@/types";

const fileStatusIcon: Record<FileStatus, React.ReactNode> = {
  pending: <Clock size={14} className="text-muted" />,
  running: <Loader2 size={14} className="text-blue-500 animate-spin" />,
  success: <CheckCircle2 size={14} className="text-green-600" />,
  failed: <XCircle size={14} className="text-red-600" />,
  skipped: <SkipForward size={14} className="text-amber-500" />,
};

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Initial load
  const { data: initialJob } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.jobs.get(id!),
    enabled: !!id,
  });

  // Live WebSocket stream
  const ws = useJobSocket(id ?? null);

  // Merge: WS data overrides REST data while job is running
  const job = ws.job ?? initialJob;
  const liveFiles = ws.files;

  // When job completes via WS, refresh the full job data (for final file details)
  useQuery({
    queryKey: ["job-final", id],
    queryFn: () => api.jobs.get(id!),
    enabled: ws.complete,
    staleTime: 0,
  });

  const finalJobData = useQuery({
    queryKey: ["job-final", id],
    queryFn: () => api.jobs.get(id!),
    enabled: ws.complete,
  }).data;

  const displayFiles: JobFile[] =
    finalJobData?.files ??
    (initialJob?.files.map((f) => liveFiles.get(f.filePath) ?? f) ?? []);

  // Undo mutation
  const undoMutation = useMutation({
    mutationFn: () => api.jobs.undo(id!),
    onSuccess: ({ jobId }) => {
      toast.success("Undo job started");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      navigate(`/jobs/${jobId}`);
    },
    onError: (err: Error) => {
      toast.error(`Undo failed: ${err.message}`);
    },
  });

  if (!job) {
    return <div className="p-6 text-muted text-sm">Loading…</div>;
  }

  const progress =
    job.totalFiles > 0
      ? Math.round((job.processedFiles / job.totalFiles) * 100)
      : 0;

  const canUndo =
    (job.status === "done") &&
    !job.dryRun;

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={() => navigate("/jobs")}>
          <ChevronLeft size={14} />
        </button>
        <h1 className="text-lg font-semibold">Job</h1>
        <StatusBadge status={job.status} />
        {job.dryRun && (
          <span className="badge badge-warning">dry-run</span>
        )}
        <div className="ml-auto flex gap-2">
          {canUndo && (
            <button
              className="btn-ghost"
              onClick={() => undoMutation.mutate()}
              disabled={undoMutation.isPending}
              title="Undo all changes made by this job"
            >
              <RotateCcw size={14} />
              Undo
            </button>
          )}
        </div>
      </div>

      {/* Job summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Created", value: formatDate(job.createdAt) },
          { label: "User", value: job.userEmail },
          { label: "Files", value: `${job.processedFiles} / ${job.totalFiles}` },
          {
            label: "Status",
            value: <StatusBadge status={job.status} />,
          },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface rounded px-3 py-2 border border-border">
            <p className="text-xs text-muted">{label}</p>
            <p className="text-sm font-medium mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {(job.status === "running" || job.status === "pending") && (
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Connection status */}
      {ws.connected && (
        <p className="text-xs text-blue-600 flex items-center gap-1">
          <Loader2 size={11} className="animate-spin" />
          Live updates active
        </p>
      )}
      {ws.error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle size={11} />
          {ws.error}
        </p>
      )}

      {/* Per-file results */}
      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="w-6 px-3 py-2" />
              <th className="px-3 py-2 text-left font-medium text-muted">File</th>
              <th className="px-3 py-2 text-left font-medium text-muted">Status</th>
              <th className="px-3 py-2 text-left font-medium text-muted hidden sm:table-cell">
                Changes
              </th>
            </tr>
          </thead>
          <tbody>
            {displayFiles.map((f) => (
              <FileRow key={f.id} file={f} />
            ))}
            {displayFiles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted text-xs">
                  No file data yet…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FileRow({ file }: { file: JobFile }) {
  const [expanded, setExpanded] = useState(false);

  const hasDetail =
    file.errorMessage ||
    (file.changesSummary?.changes && file.changesSummary.changes.length > 0) ||
    (file.changesSummary?.warnings && file.changesSummary.warnings.length > 0);

  return (
    <>
      <tr
        className={`border-b border-gray-100 ${hasDetail ? "cursor-pointer hover:bg-surface" : ""}`}
        onClick={() => hasDetail && setExpanded((v) => !v)}
      >
        <td className="px-3 py-2">{fileStatusIcon[file.status]}</td>
        <td className="px-3 py-2 font-mono text-xs truncate max-w-xs">
          <span className="font-sans text-sm text-gray-900">
            {formatPath(file.filePath)}
          </span>
          <div className="text-muted truncate">{file.filePath}</div>
        </td>
        <td className="px-3 py-2">
          <StatusBadge status={file.status} />
        </td>
        <td className="px-3 py-2 hidden sm:table-cell text-xs text-muted">
          {file.changesSummary?.changes?.length
            ? `${file.changesSummary.changes.length} change(s)`
            : file.status === "skipped"
            ? "No matching tracks"
            : "—"}
        </td>
      </tr>

      {expanded && hasDetail && (
        <tr className="bg-surface">
          <td colSpan={4} className="px-6 py-3 text-xs space-y-2">
            {/* Error */}
            {file.errorMessage && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 font-mono text-red-700 whitespace-pre-wrap">
                {file.errorMessage}
                {file.exitCode !== null && file.exitCode !== undefined && (
                  <span className="ml-2 text-red-400">(exit {file.exitCode})</span>
                )}
              </div>
            )}

            {/* Changes */}
            {file.changesSummary?.changes?.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-muted shrink-0">{c.field}</span>
                {c.trackSelector && (
                  <span className="text-muted shrink-0">
                    [{c.trackSelector.trackType}:{c.trackSelector.trackIndex}]
                  </span>
                )}
                <span className="font-mono line-through text-red-500">
                  {String(c.before ?? "∅")}
                </span>
                <span className="text-muted">→</span>
                <span className="font-mono text-green-700">{String(c.after)}</span>
              </div>
            ))}

            {/* Warnings */}
            {file.changesSummary?.warnings?.map((w, i) => (
              <div key={i} className="flex items-center gap-1 text-amber-700">
                <AlertTriangle size={11} />
                {w}
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

