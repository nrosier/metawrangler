/**
 * Settings page — mount management.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HardDrive,
  Pencil,
} from "lucide-react";
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
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add mount
        </button>
      </div>

      {/* Add mount form */}
      {showAdd && (
        <MountForm
          title="Add mount"
          onSubmit={(data) => addMount.mutate(data)}
          onCancel={() => setShowAdd(false)}
          loading={addMount.isPending}
        />
      )}

      {/* Edit mount form */}
      {editMount && (
        <MountForm
          title="Edit mount"
          initial={editMount}
          onSubmit={(data) =>
            updateMount.mutate({ id: editMount.id, data })
          }
          onCancel={() => setEditMount(null)}
          loading={updateMount.isPending}
          pathReadOnly
        />
      )}

      {/* Mount list */}
      {isLoading && <p className="text-muted text-sm">Loading…</p>}
      {!isLoading && (!mounts || mounts.length === 0) && (
        <p className="text-muted text-sm">No mounts configured.</p>
      )}
      {mounts && mounts.length > 0 && (
        <div className="space-y-2">
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    onSubmit({ name: name.trim(), path: path.trim(), type });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-border rounded p-4 bg-surface space-y-3"
    >
      <p className="font-medium text-sm">{title}</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Display name</label>
          <input
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Movies"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">
            Container path
          </label>
          <input
            className="input font-mono"
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/media/movies"
            required
            disabled={pathReadOnly}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Type</label>
          <select
            className="select"
            value={type}
            onChange={(e) => setType(e.target.value as MountType)}
          >
            <option value="movies">Movies</option>
            <option value="series">Series</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
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
    <div className="border border-border rounded p-3 bg-white flex items-start gap-3">
      <HardDrive size={18} className="text-muted mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{mount.name}</span>
          <span className="badge badge-muted">{mount.type}</span>
          {h && (
            <>
              {h.reachable ? (
                <span className="badge badge-success flex items-center gap-0.5">
                  <CheckCircle2 size={10} /> reachable
                </span>
              ) : (
                <span className="badge badge-danger flex items-center gap-0.5">
                  <XCircle size={10} /> unreachable
                </span>
              )}
              {h.reachable && !h.writable && (
                <span className="badge badge-warning flex items-center gap-0.5">
                  <AlertCircle size={10} /> read-only
                </span>
              )}
              {h.reachable && (
                <span className="text-xs text-muted">{h.mkvCount} MKV files</span>
              )}
            </>
          )}
        </div>
        <p className="font-mono text-xs text-muted mt-0.5 truncate">{mount.path}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          className="btn-ghost text-xs"
          onClick={onEdit}
          title="Edit mount name or type"
        >
          <Pencil size={12} />
        </button>
        <button
          className="btn-ghost text-xs text-red-500 border-red-200 hover:border-red-300"
          onClick={onRemove}
          title="Remove mount"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
