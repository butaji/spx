import { useEffect, useState, useCallback, useRef } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { getQueue } from "../lib/spotify";
import { SpotifyTrack, SpotifyQueueResponse } from "../types";
import { IconPlay, IconRefresh } from "../components/icons";

interface Props {
  onPlayUris: (uris: string[], offset?: number) => void;
}

export default function Queue({ onPlayUris }: Props) {
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [current, setCurrent] = useState<SpotifyTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  const loadQueue = useCallback(async () => {
    if (!isMountedRef.current) return;
    setLoading(true);
    try {
      const data = await getQueue() as SpotifyQueueResponse;
      if (!isMountedRef.current) return;
      setCurrent(data.currently_playing || null);
      setQueue((data.queue || []).filter(Boolean));
    } catch (e) {
      console.error("Failed to load queue:", e);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadQueue();
    return () => { isMountedRef.current = false; };
  }, [loadQueue]);

  // Refresh queue when screen becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadQueue();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadQueue]);

  const playFromQueue = useCallback((index: number) => {
    const uris = ([current?.uri, ...queue.filter(Boolean).map((q) => q.uri)].filter(Boolean) as string[]);
    const adjustedOffset = current?.uri ? index : Math.max(0, index - 1);
    onPlayUris(uris, adjustedOffset);
  }, [current, queue, onPlayUris]);

  const handleQueueItemKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      playFromQueue(index + 1);
    }
  }, [playFromQueue]);

  if (loading) {
    return (
      <div>
        <h1 className="screen-title">Up Next</h1>
        <div className="queue-loading">
          <div className="spinner" />
          <span>Loading queue...</span>
        </div>
      </div>
    );
  }

  const hasContent = current || queue.length > 0;

  return (
    <div>
      <div className="queue-header">
        <h1 className="screen-title">Up Next</h1>
        <button
          className="queue-refresh-btn"
          onClick={loadQueue}
          aria-label="Refresh queue"
        >
          <IconRefresh size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {current && (
        <div className="queue-section">
          <div className="eyebrow queue-now-playing-label">
            <IconPlay size={12} />
            Now Playing
          </div>
          <div className="queue-item queue-now-playing">
            <div className="queue-item-img" style={{
              background: current.album?.images?.[0]?.url ? `url(${current.album.images[0].url}) center/cover` : undefined
            }} />
            <div className="queue-item-info">
              <div className="queue-item-title">{current.name}</div>
              <div className="queue-item-artist">{current.artists?.filter(Boolean).map((a) => a.name).join(", ")}</div>
            </div>
          </div>
        </div>
      )}

      {queue.length > 0 && (
        <div className="queue-section">
          <div className="eyebrow">
            Next in Queue ({queue.length})
          </div>
          <div className="queue-list" role="list">
            {queue.filter(Boolean).map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                className="queue-item"
                role="listitem"
                tabIndex={0}
                onClick={() => playFromQueue(i + 1)}
                onKeyDown={(e) => handleQueueItemKeyDown(e, i)}
                aria-label={`${item.name} by ${item.artists?.filter(Boolean).map((a) => a.name).join(", ")}`}
              >
                <div className="queue-item-img" style={{
                  background: item.album?.images?.[0]?.url ? `url(${item.album.images[0].url}) center/cover` : undefined
                }} />
                <div className="queue-item-info">
                  <div className="queue-item-title">{item.name}</div>
                  <div className="queue-item-artist">{item.artists?.filter(Boolean).map((a) => a.name).join(", ")}</div>
                </div>
                <span className="queue-item-position">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasContent && (
        <div className="queue-empty">
          <div className="queue-empty-icon">
            <IconPlay size={48} />
          </div>
          <h3>Your queue is empty</h3>
          <p>Add songs to your queue to see them here</p>
        </div>
      )}
    </div>
  );
}
