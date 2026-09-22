/**
 * Jobs list page — recent jobs with status and link to detail.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { List, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/utils";

export function JobsPage() {
  const navigate = useNavigate();
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.jobs.list(100),
    refetchInterval: 5_000, // poll while any job is running
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold flex items-center gap-2">
        <List size={18} />
        Jobs
      </h1>

      {isLoading && <p className="text-muted text-sm">Loading…</p>}
      {!isLoading && (!jobs || jobs.length === 0) && (
        <p className="text-muted text-sm">No jobs yet.</p>
      )}

      {jobs && jobs.length > 0 && (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted">Created</th>
                <th className="px-3 py-2 text-left font-medium text-muted">Status</th>
                <th className="px-3 py-2 text-left font-medium text-muted">Files</th>
                <th className="px-3 py-2 text-left font-medium text-muted hidden sm:table-cell">Type</th>
                <th className="w-8 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr
                  key={j.id}
                  className="border-b border-gray-100 hover:bg-surface cursor-pointer"
                  onClick={() => navigate(`/jobs/${j.id}`)}
                >
                  <td className="px-3 py-2 text-xs">{formatDate(j.createdAt)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={j.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {j.processedFiles} / {j.totalFiles}
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    {j.dryRun && <span className="badge badge-warning">dry-run</span>}
                  </td>
                  <td className="px-3 py-2">
                    <ChevronRight size={14} className="text-muted" />
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
