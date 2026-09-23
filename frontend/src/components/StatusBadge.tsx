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

const tones: Record<string, string> = {
  pending: "badge",
  running: "badge badge--info",
  success: "badge badge--ok",
  done: "badge badge--ok",
  failed: "badge badge--alert",
  skipped: "badge badge--warn",
  cancelled: "badge",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={tones[status] ?? "badge"}>{labels[status] ?? status}</span>;
}
