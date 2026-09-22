import type { MkvTrack } from "@/types";
import { cn } from "@/lib/utils";

interface TrackListProps {
  tracks: MkvTrack[];
  compact?: boolean;
}

const typeColors: Record<string, string> = {
  video: "bg-purple-100 text-purple-700",
  audio: "bg-blue-100 text-blue-700",
  subtitles: "bg-amber-100 text-amber-800",
  unknown: "bg-gray-100 text-gray-600",
};

export function TrackList({ tracks, compact = false }: TrackListProps) {
  if (tracks.length === 0) {
    return <p className="text-xs text-muted italic">No tracks found</p>;
  }

  return (
    <div className={cn("space-y-1", compact ? "text-xs" : "text-sm")}>
      {tracks.map((t) => (
        <div
          key={t.id}
          className="flex flex-wrap items-center gap-1.5 py-1 border-b border-gray-100 last:border-0"
        >
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0",
              typeColors[t.type] ?? typeColors.unknown
            )}
          >
            {t.type}
          </span>
          <span className="font-mono text-xs text-muted shrink-0">#{t.id}</span>
          {t.codecId && (
            <span className="font-mono text-xs">{t.codecId}</span>
          )}
          {t.language && (
            <span className="font-mono text-xs text-accent">{t.languageIETF ?? t.language}</span>
          )}
          {t.name && (
            <span className="text-xs italic truncate max-w-xs">&ldquo;{t.name}&rdquo;</span>
          )}
          {t.type === "audio" && t.channels !== undefined && (
            <span className="text-xs text-muted">{t.channels}ch</span>
          )}
          <span className="flex gap-1 ml-auto shrink-0">
            {t.flagDefault && (
              <span className="badge badge-success py-0">default</span>
            )}
            {t.flagForced && (
              <span className="badge badge-warning py-0">forced</span>
            )}
            {!t.flagEnabled && (
              <span className="badge badge-danger py-0">disabled</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
