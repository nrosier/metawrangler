/**
 * Settings page — mount management.
 */
import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconAlertCircle, IconCheckCircle, IconHardDrive, IconPencil, IconPlus, IconTrash, IconXCircle } from "@/icons";
import { api } from "@/lib/api";
import type { Mount, MountType } from "@/types";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editMount, setEditMount] = useState<Mount | null>(null);

  const { data: mounts, isLoading } = useQuery({
    queryKey: ["mounts"],
    queryFn: api.mounts.list,
    refetchInterval: 30_000,
  });

  const addMount = useMutation({
    mutationFn: api.mounts.create,
    onSuccess: () => {
      toast.success("Mount added");
      void queryClient.invalidateQueries({ queryKey: ["mounts"] });
      setShowAdd(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMount = useMutation({
    mutationFn: api.mounts.remove,
    onSuccess: () => {
      toast.success("Mount removed");
      void queryClient.invalidateQueries({ queryKey: ["mounts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMount = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; type?: MountType } }) =>
      api.mounts.update(id, data),
    onSuccess: () => {
      toast.success("Mount updated");
      void queryClient.invalidateQueries({ queryKey: ["mounts"] });
      setEditMount(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="stack" style={{ maxWidth: "40rem" }}>
      <div className="page__header">
        <h1 className="page__title">Settings</h1>
        <button className="button" onClick={() => setShowAdd(true)}>
          <IconPlus /> Add mount
        </button>
      </div>

      {showAdd && (
        <MountForm
          title="Add mount"
          onSubmit={(data) => addMount.mutate(data)}
          onCancel={() => setShowAdd(false)}
          loading={addMount.isPending}
        />
      )}

      {editMount && (
        <MountForm
          title="Edit mount"
          initial={editMount}
          onSubmit={(data) => updateMount.mutate({ id: editMount.id, data })}
          onCancel={() => setEditMount(null)}
          loading={updateMount.isPending}
          pathReadOnly
        />
      )}

      {isLoading && <p className="muted">Loading…</p>}
      {!isLoading && (!mounts || mounts.length === 0) && <p className="muted">No mounts configured.</p>}
      {mounts && mounts.length > 0 && (
        <div className="stack" style={{ gap: "var(--space-2)" }}>
          {mounts.map((m) => (
            <MountCard
              key={m.id}
              mount={m}
              onEdit={() => setEditMount(m)}
              onRemove={() => {
                if (confirm(`Remove mount "${m.name}"?`)) {
                  removeMount.mutate(m.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MountFormProps {
  title: string;
  initial?: Mount;
  onSubmit: (data: { name: string; path: string; type: MountType }) => void;
  onCancel: () => void;
  loading: boolean;
  pathReadOnly?: boolean;
}

function MountForm({ title, initial, onSubmit, onCancel, loading, pathReadOnly }: MountFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [path, setPath] = useState(initial?.path ?? "");
  const [type, setType] = useState<MountType>(initial?.type ?? "movies");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    onSubmit({ name: name.trim(), path: path.trim(), type });
  }

  return (
    <form onSubmit={handleSubmit} className="card stack">
      <p className="card__title" style={{ marginBottom: 0 }}>{title}</p>
      <div className="form-grid form-grid--3">
        <div className="field">
          <label className="field__label">Display name</label>
          <input
            className="field__input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Movies"
            required
          />
        </div>
        <div className="field">
          <label className="field__label">Container path</label>
          <input
            className="field__input"
            style={{ fontFamily: "var(--font-mono)" }}
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/media/movies"
            required
            disabled={pathReadOnly}
          />
        </div>
        <div className="field">
          <label className="field__label">Type</label>
          <select className="field__input" value={type} onChange={(e) => setType(e.target.value as MountType)}>
            <option value="movies">Movies</option>
            <option value="series">Series</option>
          </select>
        </div>
      </div>
      <div className="toolbar toolbar--end">
        <button type="button" className="button button--quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button" disabled={loading}>
          {loading ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

interface MountCardProps {
  mount: Mount;
  onEdit: () => void;
  onRemove: () => void;
}

function MountCard({ mount, onEdit, onRemove }: MountCardProps) {
  const h = mount.health;

  return (
    <div className="card toolbar" style={{ alignItems: "flex-start" }}>
      <IconHardDrive className="table__cell--muted" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="toolbar" style={{ gap: "var(--space-2)" }}>
          <span className="table__cell--name">{mount.name}</span>
          <span className="badge">{mount.type}</span>
          {h && (
            <>
              {h.reachable ? (
                <span className="badge badge--ok">
                  <IconCheckCircle /> reachable
                </span>
              ) : (
                <span className="badge badge--alert">
                  <IconXCircle /> unreachable
                </span>
              )}
              {h.reachable && !h.writable && (
                <span className="badge badge--warn">
                  <IconAlertCircle /> read-only
                </span>
              )}
              {h.reachable && <span className="muted" style={{ fontSize: "var(--type-xs)" }}>{h.mkvCount} MKV files</span>}
            </>
          )}
        </div>
        <p className="table__cell--path" style={{ marginTop: "2px" }}>{mount.path}</p>
      </div>
      <div className="toolbar" style={{ gap: "var(--space-1)" }}>
        <button className="button--icon button--sm button--quiet" onClick={onEdit} title="Edit mount name or type" aria-label="Edit mount">
          <IconPencil />
        </button>
        <button className="button--icon button--sm button--quiet icon--danger" onClick={onRemove} title="Remove mount" aria-label="Remove mount">
          <IconTrash />
        </button>
      </div>
    </div>
  );
}
