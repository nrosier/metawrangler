/**
 * Browse page — select a mount, browse files, select files for bulk edit.
 */
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { TrackList } from "@/components/TrackList";
import { formatPath } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  IconAlertCircle,
  IconChevronRight,
  IconCheckbox,
  IconPencil,
  IconRefresh,
  IconSearch,
} from "@/icons";
import type { Mount, MkvFileMetadata } from "@/types";

export function BrowsePage() {
  const navigate = useNavigate();
  const [selectedMount, setSelectedMount] = useState<Mount | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const { data: mounts, isLoading: mountsLoading } = useQuery({
    queryKey: ["mounts"],
    queryFn: api.mounts.list,
  });

  const {
    data: scanData,
    isFetching: scanning,
    refetch: rescan,
  } = useQuery({
    queryKey: ["scan", selectedMount?.id],
    queryFn: () => api.scan.listFiles(selectedMount!.id),
    enabled: !!selectedMount,
  });

  const { data: metaResults } = useQuery({
    queryKey: ["meta", expandedFile],
    queryFn: () => api.scan.getMetadata([expandedFile!]),
    enabled: !!expandedFile,
  });

  const expandedMeta: MkvFileMetadata | null = metaResults?.[0]?.metadata ?? null;

  const allFiles = scanData?.files ?? [];
  const filteredFiles = filter
    ? allFiles.filter((f) => f.toLowerCase().includes(filter.toLowerCase()))
    : allFiles;

  const allSelected = filteredFiles.length > 0 && filteredFiles.every((f) => selectedFiles.has(f));
  const someSelected = !allSelected && filteredFiles.some((f) => selectedFiles.has(f));

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
    <div className="stack">
      <div className="page__header">
        <h1 className="page__title">Browse</h1>
        {selectedFiles.size > 0 && (
          <button className="button" onClick={handleBulkEdit}>
            <IconPencil />
            Edit {selectedFiles.size} file{selectedFiles.size !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      <div className="toolbar">
        {mountsLoading && <p className="muted">Loading mounts…</p>}
        {mounts?.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setSelectedMount(m);
              setSelectedFiles(new Set());
              setFilter("");
            }}
            className={cn("chip", selectedMount?.id === m.id && "chip--active")}
          >
            {m.name}
            <span className="chip__meta">{m.type}</span>
            {m.health && !m.health.reachable && <IconAlertCircle className="icon--danger" />}
          </button>
        ))}
        {!mountsLoading && (!mounts || mounts.length === 0) && (
          <p className="muted">
            No mounts configured. <a href="/settings">Add one in Settings.</a>
          </p>
        )}
      </div>

      {selectedMount && (
        <div className="stack">
          <div className="toolbar">
            <div className="field--search">
              <IconSearch className="field__icon" />
              <input
                type="search"
                placeholder="Filter files…"
                className="field__input"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <button
              className="button button--quiet button--icon"
              onClick={() => {
                void rescan();
              }}
              disabled={scanning}
              title="Re-scan mount"
              aria-label="Re-scan mount"
            >
              <IconRefresh className={scanning ? "spin" : ""} />
            </button>
            <span className="muted" style={{ whiteSpace: "nowrap" }}>
              {filteredFiles.length} file{filteredFiles.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="table-scroll">
            {scanning && <p className="table__caption">Scanning…</p>}
            {!scanning && filteredFiles.length === 0 && <p className="table__caption">No MKV files found.</p>}
            {!scanning && filteredFiles.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th className="table__cell--icon">
                      <button
                        onClick={toggleAll}
                        className="button--icon button--sm button--quiet"
                        title="Select all"
                        aria-label="Select all"
                      >
                        <IconCheckbox state={allSelected ? "checked" : someSelected ? "indeterminate" : "unchecked"} />
                      </button>
                    </th>
                    <th>File</th>
                    <th className="table__cell--icon" />
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((f) => (
                    <Fragment key={f}>
                      <tr
                        className={cn("tr--clickable", selectedFiles.has(f) && "tr--selected")}
                        onClick={() => toggleFile(f)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleFile(f)}
                            className="button--icon button--sm button--quiet"
                            aria-label={selectedFiles.has(f) ? "Deselect file" : "Select file"}
                          >
                            <IconCheckbox
                              state={selectedFiles.has(f) ? "checked" : "unchecked"}
                              className={selectedFiles.has(f) ? "icon--accent" : undefined}
                            />
                          </button>
                        </td>
                        <td>
                          <div className="table__cell--name">{formatPath(f)}</div>
                          <div className="table__cell--path">{f}</div>
                        </td>
                        <td
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedFile(expandedFile === f ? null : f);
                          }}
                        >
                          <IconChevronRight
                            className={expandedFile === f ? "table__chevron table__chevron--open" : "table__chevron"}
                          />
                        </td>
                      </tr>
                      {expandedFile === f && (
                        <tr className="tr--expanded">
                          <td colSpan={3}>
                            {!expandedMeta && <p className="track-list__empty">Loading metadata…</p>}
                            {expandedMeta && (
                              <>
                                {expandedMeta.title && (
                                  <p className="table__cell--muted" style={{ marginBottom: "var(--space-2)" }}>
                                    Title: <strong>{expandedMeta.title}</strong>
                                  </p>
                                )}
                                <TrackList tracks={expandedMeta.tracks} />
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
