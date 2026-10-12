/**
 * Audit log page — paginated, read-only audit trail.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { IconChevronRight, IconClipboard } from "@/icons";
import { api } from "@/lib/api";
import { QueryError } from "@/components/QueryError";
import { formatDate } from "@/lib/utils";
import type { AuditAction } from "@/types";

const ACTION_LABELS: Record<AuditAction, string> = {
  scan: "Scan",
  edit: "Edit",
  undo: "Undo",
  mount_add: "Mount added",
  mount_remove: "Mount removed",
  mount_update: "Mount updated",
};

const ACTION_BADGE: Record<AuditAction, string> = {
  scan: "badge",
  edit: "badge badge--info",
  undo: "badge badge--warn",
  mount_add: "badge badge--ok",
  mount_remove: "badge badge--alert",
  mount_update: "badge",
};

export function AuditLogPage() {
  const navigate = useNavigate();
  const { data: entries, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["audit"],
    queryFn: () => api.audit.list(200),
  });

  return (
    <div className="stack">
      <div className="page__header">
        <h1 className="page__heading page__title">
          <IconClipboard />
          Audit Log
        </h1>
      </div>

      {isLoading && <p className="muted">Loading…</p>}
      {isError && <QueryError error={error} onRetry={() => { void refetch(); }} />}
      {!isLoading && !isError && (!entries || entries.length === 0) && <p className="muted">No audit entries yet.</p>}

      {entries && entries.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Action</th>
                <th scope="col">User</th>
                <th scope="col">Detail</th>
                <th className="table__cell--icon" scope="col" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="table__cell--muted">{formatDate(e.createdAt)}</td>
                  <td>
                    <span className={ACTION_BADGE[e.action] ?? "badge"}>{ACTION_LABELS[e.action] ?? e.action}</span>
                  </td>
                  <td className="table__cell--muted">{e.userEmail}</td>
                  <td className="table__cell--path">{e.detail ? JSON.stringify(e.detail).slice(0, 80) : "—"}</td>
                  <td>
                    {e.jobId && (
                      <button
                        onClick={() => { void navigate(`/jobs/${e.jobId}`); }}
                        className="button--icon button--quiet"
                        aria-label={`View job details for ${ACTION_LABELS[e.action] ?? e.action} action`}
                      >
                        <IconChevronRight className="table__cell--muted" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
