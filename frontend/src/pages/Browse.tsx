/**
 * Browse page — select a mount, browse files, select files for bulk edit.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  FolderOpen,
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  Pencil,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { TrackList } from "@/components/TrackList";
import { formatPath } from "@/lib/utils";
import type { Mount, MkvFileMetadata } from "@/types";

export function BrowsePage() {
  const navigate = useNavigate();
  const [selectedMount, setSelectedMount] = useState<Mount | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // ── Load mounts ────────────────────────────────────────────────────────────
  const { data: mounts, isLoading: mountsLoading } = useQuery({
    queryKey: ["mounts"],
    queryFn: api.mounts.list,
  });

  // ── Scan selected mount ────────────────────────────────────────────────────
  const {
    data: scanData,
    isFetching: scanning,
    refetch: rescan,
  } = useQuery({
    queryKey: ["scan", selectedMount?.id],
    queryFn: () => api.scan.listFiles(selectedMount!.id),
    enabled: !!selectedMount,
  });

  // ── Load metadata for expanded file ───────────────────────────────────────
  const { data: metaResults } = useQuery({
    queryKey: ["meta", expandedFile],
    queryFn: () => api.scan.getMetadata([expandedFile!]),
    enabled: !!expandedFile,
  });

  const expandedMeta: MkvFileMetadata | null =
    metaResults?.[0]?.metadata ?? null;

  const allFiles = scanData?.files ?? [];
  const filteredFiles = filter
    ? allFiles.filter((f) =>
        f.toLowerCase().includes(filter.toLowerCase())
      )
    : allFiles;

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allSelected =
    filteredFiles.length > 0 &&
    filteredFiles.every((f) => selectedFiles.has(f));
  const someSelected =
    !allSelected && filteredFiles.some((f) => selectedFiles.has(f));

  function toggleAll() {
    if (allSelected) {
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        filteredFiles.forEach((f) => next.delete(f));
        return next;
      });
    } else {
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        filteredFiles.forEach((f) => next.add(f));
        return next;
      });
    }
  }

  function toggleFile(f: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  function handleBulkEdit() {
    if (selectedFiles.size === 0) {
      toast.warning("Select at least one file to edit");
      return;
    }
    void navigate("/bulk-edit", { state: { filePaths: Array.from(selectedFiles) } });
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Browse</h1>
        {selectedFiles.size > 0 && (
          <button className="btn-primary" onClick={handleBulkEdit}>
            <Pencil size={14} />
            Edit {selectedFiles.size} file{selectedFiles.size !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Mount selector */}
      <div className="flex flex-wrap gap-2">
        {mountsLoading && <p className="text-muted text-sm">Loading mounts…</p>}
        {mounts?.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setSelectedMount(m);
              setSelectedFiles(new Set());
              setFilter("");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm transition-colors ${
              selectedMount?.id === m.id
                ? "border-accent bg-accent text-white"
                : "border-border bg-white hover:bg-surface"
            }`}
          >
            <FolderOpen size={14} />
            {m.name}
            <span
              className={`text-xs px-1 rounded ${
                selectedMount?.id === m.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-muted"
              }`}
            >
              {m.type}
            </span>
            {m.health && !m.health.reachable && (
              <AlertCircle size={12} className="text-red-400" />
            )}
          </button>
        ))}
        {!mountsLoading && (!mounts || mounts.length === 0) && (
          <p className="text-muted text-sm">
            No mounts configured.{" "}
            <a href="/settings" className="text-accent underline">
              Add one in Settings.
            </a>
          </p>
        )}
      </div>

      {/* File list */}
      {selectedMount && (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                placeholder="Filter files…"
                className="input pl-8"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <button
              className="btn-ghost"
              onClick={() => { void rescan(); }}
              disabled={scanning}
              title="Re-scan mount"
            >
              <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
            </button>
            <span className="text-xs text-muted whitespace-nowrap">
              {filteredFiles.length} file{filteredFiles.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex-1 overflow-auto border border-border rounded bg-white">
            {scanning && (
              <div className="p-6 text-center text-muted text-sm">
                Scanning…
              </div>
            )}
            {!scanning && filteredFiles.length === 0 && (
              <div className="p-6 text-center text-muted text-sm">
                No MKV files found.
              </div>
            )}
            {!scanning && filteredFiles.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-surface border-b border-border sticky top-0">
                  <tr>
                    <th className="w-8 px-3 py-2 text-left">
                      <button
                        onClick={toggleAll}
                        className="text-gray-500 hover:text-gray-900"
                        title="Select all"
                      >
                        {allSelected ? (
                          <CheckSquare size={15} />
                        ) : someSelected ? (
                          <MinusSquare size={15} />
                        ) : (
                          <Square size={15} />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted">
                      File
                    </th>
                    <th className="w-8 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((f) => (
                    <>
                      <tr
                        key={f}
                        className={`border-b border-gray-100 hover:bg-surface cursor-pointer ${
                          selectedFiles.has(f) ? "bg-blue-50" : ""
                        }`}
                        onClick={() => toggleFile(f)}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleFile(f)}
                            className="text-gray-500 hover:text-gray-900"
                          >
                            {selectedFiles.has(f) ? (
                              <CheckSquare size={15} className="text-accent" />
                            ) : (
                              <Square size={15} />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs truncate max-w-md">
                          <div className="font-medium text-gray-900 text-sm font-sans">
                            {formatPath(f)}
                          </div>
                          <div className="text-muted truncate">{f}</div>
                        </td>
                        <td
                          className="px-3 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedFile(expandedFile === f ? null : f);
                          }}
                        >
                          <ChevronRight
                            size={14}
                            className={`text-muted transition-transform ${
                              expandedFile === f ? "rotate-90" : ""
                            }`}
                          />
                        </td>
                      </tr>
                      {expandedFile === f && (
                        <tr key={`${f}-expanded`} className="bg-surface">
                          <td colSpan={3} className="px-6 py-3">
                            {!expandedMeta && (
                              <p className="text-xs text-muted">Loading metadata…</p>
                            )}
                            {expandedMeta && (
                              <>
                                {expandedMeta.title && (
                                  <p className="text-xs mb-2">
                                    <span className="text-muted">Title:</span>{" "}
                                    <strong>{expandedMeta.title}</strong>
                                  </p>
                                )}
                                <TrackList tracks={expandedMeta.tracks} compact />
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
