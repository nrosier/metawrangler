/**
 * Jobs list page — recent jobs with status and link to detail.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/utils";
import { IconChevronRight, IconList } from "@/icons";

export function JobsPage() {
  const navigate = useNavigate();
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.jobs.list(100),
    refetchInterval: 5_000, // poll while any job is running
  });

  return (
    <div className="stack">
      <div className="page__header">
        <h1 className="page__heading page__title">
          <IconList />
          Jobs
        </h1>
      </div>

      {isLoading && <p className="muted">Loading…</p>}
      {!isLoading && (!jobs || jobs.length === 0) && <p className="muted">No jobs yet.</p>}

      {jobs && jobs.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Status</th>
                <th>Files</th>
                <th>Type</th>
                <th className="table__cell--icon" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="tr--clickable" onClick={() => { void navigate(`/jobs/${j.id}`); }}>
                  <td className="table__cell--muted">{formatDate(j.createdAt)}</td>
                  <td>
                    <StatusBadge status={j.status} />
                  </td>
                  <td className="table__cell--muted">
                    {j.processedFiles} / {j.totalFiles}
                  </td>
                  <td>{j.dryRun && <span className="badge badge--warn">dry-run</span>}</td>
                  <td>
                    <IconChevronRight className="table__chevron" />
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
