import { clsx } from "clsx";

export function cn(...inputs: Parameters<typeof clsx>): string {
  return clsx(...inputs);
}

export function formatPath(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? filePath;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
