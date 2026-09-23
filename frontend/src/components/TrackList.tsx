import type { MkvTrack } from "@/types";
import { cn } from "@/lib/utils";

interface TrackListProps {
  tracks: MkvTrack[];
}

const typeTone: Record<string, string> = {
  video: "badge--info",
  audio: "badge--ok",
  subtitles: "badge--warn",
  unknown: "",
};

export function TrackList({ tracks }: TrackListProps) {
  if (tracks.length === 0) {
    return <p className="track-list__empty">No tracks found</p>;
  }

  return (
    <div className="track-list">
      {tracks.map((t) => (
        <div key={t.id} className="track-row">
          <span className={cn("badge", typeTone[t.type] ?? typeTone.unknown)}>{t.type}</span>
          <span className="track-row__id">#{t.id}</span>
          {t.codecId && <span className="track-row__codec">{t.codecId}</span>}
          {t.language && <span className="track-row__lang">{t.languageIETF ?? t.language}</span>}
          {t.name && <span className="track-row__name">&ldquo;{t.name}&rdquo;</span>}
          {t.type === "audio" && t.channels !== undefined && (
            <span className="track-row__codec">{t.channels}ch</span>
          )}
          <span className="track-row__flags">
            {t.flagDefault && <span className="badge badge--ok">default</span>}
            {t.flagForced && <span className="badge badge--warn">forced</span>}
            {!t.flagEnabled && <span className="badge badge--alert">disabled</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
