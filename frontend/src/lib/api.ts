/**
 * API client — thin wrappers around fetch.
 * All requests go to /api/* which Caddy proxies to the backend.
 */
import type {
  Mount,
  Job,
  JobFile,
  MkvFileMetadata,
  BulkEditRequest,
  AuditEntry,
} from "@/types";

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // ignore JSON parse failure on error body
    }
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ── Mounts ────────────────────────────────────────────────────────────────────

export const api = {
  mounts: {
    list: () => request<Mount[]>("GET", "/mounts"),
    create: (data: { name: string; path: string; type: "movies" | "series" }) =>
      request<Mount>("POST", "/mounts", data),
    update: (id: string, data: Partial<{ name: string; type: "movies" | "series" }>) =>
      request<Mount>("PATCH", `/mounts/${id}`, data),
    remove: (id: string) => request<{ success: boolean }>("DELETE", `/mounts/${id}`),
  },

  scan: {
    listFiles: (mountId: string) =>
      request<{ mountId: string; path: string; files: string[] }>("GET", `/scan/${mountId}`),
    listSubdir: (mountId: string, subdir: string) =>
      request<{ files: string[] }>("GET", `/scan/${mountId}/subdir?subdir=${encodeURIComponent(subdir)}`),
    getMetadata: (filePaths: string[]) =>
      request<Array<{ filePath: string; success: boolean; metadata: MkvFileMetadata | null; error: string | null }>>(
        "POST",
        "/scan/file",
        { filePaths }
      ),
  },

  jobs: {
    create: (data: BulkEditRequest) =>
      request<{ jobId: string }>("POST", "/jobs", data),
    list: (limit = 50) =>
      request<Job[]>("GET", `/jobs?limit=${limit}`),
    get: (id: string) =>
      request<Job & { files: JobFile[] }>("GET", `/jobs/${id}`),
    undo: (id: string) =>
      request<{ jobId: string }>("POST", `/jobs/${id}/undo`),
  },

  audit: {
    list: (limit = 100, offset = 0) =>
      request<AuditEntry[]>("GET", `/audit?limit=${limit}&offset=${offset}`),
  },
};
