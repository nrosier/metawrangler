import type { FileStatus, JobStatus } from "@/types";

interface StatusBadgeProps {
  status: FileStatus | JobStatus;
}

const labels: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  success: "Success",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

const classes: Record<string, string> = {
  pending: "badge-muted",
  running: "badge-running",
  success: "badge-success",
  done: "badge-success",
  failed: "badge-danger",
  skipped: "badge-warning",
  cancelled: "badge-muted",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={classes[status] ?? "badge-muted"}>
      {labels[status] ?? status}
    </span>
  );
}
