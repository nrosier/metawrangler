/**
 * Job detail page — live progress stream + per-file results + undo button.
 */
import { useState, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconChevronLeft,
  IconClock,
  IconLoader,
  IconRotateCcw,
  IconSkipForward,
  IconXCircle,
} from "@/icons";
import { api } from "@/lib/api";
import { useJobSocket } from "@/hooks/useJobSocket";
import { StatusBadge } from "@/components/StatusBadge";
import { formatPath, formatDate } from "@/lib/utils";
import type { JobFile, FileStatus } from "@/types";

const fileStatusIcon: Record<FileStatus, ReactNode> = {
  pending: <IconClock className="table__cell--muted" />,
  running: <IconLoader className="spin icon--accent" />,
  success: <IconCheckCircle className="badge--ok" />,
  failed: <IconXCircle className="icon--danger" />,
  skipped: <IconSkipForward />,
};

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: initialJob } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.jobs.get(id!),
    enabled: !!id,
    // Fallback for when the WebSocket never delivers a completion event (e.g. it
    // fails to connect through a proxy/auth layer) — keep polling until terminal.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "pending" ? 2000 : false;
    },
  });

  const ws = useJobSocket(id ?? null);

  // Prefer whichever source has the freshest data — the WebSocket can stall or
  // fail silently (e.g. a proxy/auth layer blocking the upgrade), in which case
  // the polling fallback above is the only thing still advancing job status.
  const job =
    !ws.job || (initialJob && new Date(initialJob.updatedAt) > new Date(ws.job.updatedAt))
      ? initialJob ?? ws.job
      : ws.job;
  const liveFiles = ws.files;

  const finalJobData = useQuery({
    queryKey: ["job-final", id],
    queryFn: () => api.jobs.get(id!),
    enabled: ws.complete,
  }).data;

  const displayFiles: JobFile[] =
    finalJobData?.files ?? (initialJob?.files.map((f) => liveFiles.get(f.filePath) ?? f) ?? []);

  const undoMutation = useMutation({
    mutationFn: () => api.jobs.undo(id!),
    onSuccess: ({ jobId }) => {
      toast.success("Undo job started");
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void navigate(`/jobs/${jobId}`);
    },
    onError: (err: Error) => {
      toast.error(`Undo failed: ${err.message}`);
    },
  });

  if (!job) {
    return <p className="muted">Loading…</p>;
  }

  const progress = job.totalFiles > 0 ? Math.round((job.processedFiles / job.totalFiles) * 100) : 0;

  const canUndo = job.status === "done" && !job.dryRun;

  return (
    <div className="stack" style={{ maxWidth: "48rem" }}>
      <div className="page__heading">
        <button className="button button--quiet button--icon" onClick={() => { void navigate("/jobs"); }} aria-label="Back to jobs">
          <IconChevronLeft />
        </button>
        <h1 className="page__title">Job</h1>
        <StatusBadge status={job.status} />
        {job.dryRun && <span className="badge badge--warn">dry-run</span>}
        {canUndo && (
          <button
            className="button button--quiet"
            style={{ marginLeft: "auto" }}
            onClick={() => undoMutation.mutate()}
            disabled={undoMutation.isPending}
            title="Undo all changes made by this job"
          >
            <IconRotateCcw />
            Undo
          </button>
        )}
      </div>

      <div className="stat-grid">
        {[
          { label: "Created", value: formatDate(job.createdAt) },
          { label: "User", value: job.userEmail },
          { label: "Files", value: `${job.processedFiles} / ${job.totalFiles}` },
          { label: "Status", value: <StatusBadge status={job.status} /> },
        ].map(({ label, value }) => (
          <div key={label} className="stat">
            <p className="stat__label">{label}</p>
            <p className="stat__value">{value}</p>
          </div>
        ))}
      </div>

      {(job.status === "running" || job.status === "pending") && (
        <div className="progress">
          <div className="progress__fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {ws.connected && (
        <p className="notice__lead icon--accent" style={{ fontSize: "var(--type-xs)" }}>
          <IconLoader className="spin" />
          Live updates active
        </p>
      )}
      {ws.error && (
        <p className="notice__lead icon--danger" style={{ fontSize: "var(--type-xs)" }}>
          <IconAlertTriangle />
          {ws.error}
        </p>
      )}

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th className="table__cell--icon" />
              <th>File</th>
              <th>Status</th>
              <th>Changes</th>
            </tr>
          </thead>
          <tbody>
            {displayFiles.map((f) => (
              <FileRow key={f.id} file={f} />
            ))}
            {displayFiles.length === 0 && (
              <tr>
                <td colSpan={4} className="table__caption">
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
      <tr className={hasDetail ? "tr--clickable" : undefined} onClick={() => hasDetail && setExpanded((v) => !v)}>
        <td>{fileStatusIcon[file.status]}</td>
        <td>
          <div className="table__cell--name">{formatPath(file.filePath)}</div>
          <div className="table__cell--path">{file.filePath}</div>
        </td>
        <td>
          <StatusBadge status={file.status} />
        </td>
        <td className="table__cell--muted">
          {file.changesSummary?.changes?.length
            ? `${file.changesSummary.changes.length} change(s)`
            : file.status === "skipped"
              ? "No matching tracks"
              : "—"}
        </td>
      </tr>

      {expanded && hasDetail && (
        <tr className="tr--expanded">
          <td colSpan={4}>
            <div className="stack" style={{ gap: "var(--space-2)" }}>
              {file.errorMessage && (
                <div className="notice notice--error" style={{ fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap" }}>
                  {file.errorMessage}
                  {file.exitCode !== null && file.exitCode !== undefined && (
                    <span className="table__cell--muted"> (exit {file.exitCode})</span>
                  )}
                </div>
              )}

              {file.changesSummary?.changes?.map((c, i) => (
                <div key={i} className="diff">
                  <span className="diff__field">{c.field}</span>
                  {c.trackSelector && (
                    <span className="diff__field">
                      [{c.trackSelector.trackType}:{c.trackSelector.trackIndex}]
                    </span>
                  )}
                  <span className="diff__before">{String(c.before ?? "∅")}</span>
                  <span className="diff__field">→</span>
                  <span className="diff__after">{String(c.after)}</span>
                </div>
              ))}

              {file.changesSummary?.warnings?.map((w, i) => (
                <p key={i} className="notice__lead" style={{ color: "var(--warn)", fontSize: "var(--type-xs)" }}>
                  <IconAlertTriangle />
                  {w}
                </p>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
