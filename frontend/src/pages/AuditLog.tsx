/**
 * Audit log page — paginated, read-only audit trail.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ClipboardList, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
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
  scan: "badge-muted",
  edit: "badge-running",
  undo: "badge-warning",
  mount_add: "badge-success",
  mount_remove: "badge-danger",
  mount_update: "badge-muted",
};

export function AuditLogPage() {
  const navigate = useNavigate();
  const { data: entries, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: () => api.audit.list(200),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold flex items-center gap-2">
        <ClipboardList size={18} />
        Audit Log
      </h1>

      {isLoading && <p className="text-muted text-sm">Loading…</p>}
      {!isLoading && (!entries || entries.length === 0) && (
        <p className="text-muted text-sm">No audit entries yet.</p>
      )}

      {entries && entries.length > 0 && (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted">Time</th>
                <th className="px-3 py-2 text-left font-medium text-muted">Action</th>
                <th className="px-3 py-2 text-left font-medium text-muted">User</th>
                <th className="px-3 py-2 text-left font-medium text-muted hidden sm:table-cell">
                  Detail
                </th>
                <th className="w-8 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className={`border-b border-gray-100 ${
                    e.jobId
                      ? "hover:bg-surface cursor-pointer"
                      : ""
                  }`}
                  onClick={() => e.jobId && navigate(`/jobs/${e.jobId}`)}
                >
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {formatDate(e.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={ACTION_BADGE[e.action] ?? "badge-muted"}>
                      {ACTION_LABELS[e.action] ?? e.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{e.userEmail}</td>
                  <td className="px-3 py-2 hidden sm:table-cell text-xs text-muted font-mono truncate max-w-xs">
                    {e.detail
                      ? JSON.stringify(e.detail).slice(0, 80)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {e.jobId && (
                      <ChevronRight size={14} className="text-muted" />
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
