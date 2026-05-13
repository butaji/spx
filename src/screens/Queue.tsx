import { useEffect, useState, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { getQueue } from "../lib/spotify";
import { SpotifyTrack } from "../types";

interface Props {
  onPlayUris: (uris: string[], offset?: number) => void;
}

export default function Queue({ onPlayUris }: Props) {
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [current, setCurrent] = useState<SpotifyTrack | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const data = await getQueue();
      setQueue(data.queue || []);
    } catch (e) {
      console.error("Failed to load queue:", e);
    }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const playFromQueue = useCallback((index: number) => {
    const uris = ([current?.uri, ...queue.map((q) => q.uri)].filter(Boolean) as string[]);
    onPlayUris(uris, index);
  }, [current, queue, onPlayUris]);

  const handleQueueItemKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      playFromQueue(index + 1);
    }
  }, [playFromQueue]);

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Up Next</h2>

      {current && (
        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow">Now Playing</div>
          <div className="queue-item" style={{ background: "oklch(100% 0 0 / 0.06)" }}>
            <div className="queue-item-img" style={{
              background: current.album?.images?.[0]?.url ? `url(${current.album.images[0].url}) center/cover` : undefined
            }} />
            <div className="queue-item-info">
              <div className="queue-item-title">{current.name}</div>
              <div className="queue-item-artist">{current.artists?.map((a) => a.name).join(", ")}</div>
            </div>
          </div>
        </div>
      )}

      <div className="eyebrow">Next Up</div>
      <div className="queue-list" role="list">
        {queue.map((item, i) => (
          <div
            key={item.id}
            className="queue-item"
            role="listitem"
            tabIndex={0}
            onClick={() => playFromQueue(i + 1)}
            onKeyDown={(e) => handleQueueItemKeyDown(e, i)}
            aria-label={`${item.name} by ${item.artists?.map((a) => a.name).join(", ")}`}
          >
            <div className="queue-item-img" style={{
              background: item.album?.images?.[0]?.url ? `url(${item.album.images[0].url}) center/cover` : undefined
            }} />
            <div className="queue-item-info">
              <div className="queue-item-title">{item.name}</div>
              <div className="queue-item-artist">{item.artists?.map((a) => a.name).join(", ")}</div>
            </div>
            <div className="queue-item-dur">{i + 1}</div>
          </div>
        ))}
        {queue.length === 0 && (
          <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} role="status">
            Queue is empty
          </p>
        )}
      </div>
    </div>
  );
}
