import { useEffect, useState, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { getQueue } from "../lib/spotify";
import { SpotifyTrack, SpotifyQueueResponse } from "../types";
import { IconPlay, IconDrag, IconTrash } from "../components/icons";

interface Props {
  onPlayUris: (uris: string[], offset?: number) => void;
}

export default function Queue({ onPlayUris }: Props) {
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [current, setCurrent] = useState<SpotifyTrack | null>(null);
  const [loading, setLoading] = useState(true);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getQueue() as SpotifyQueueResponse;
      setCurrent(data.currently_playing || null);
      setQueue(data.queue || []);
    } catch (e) {
      console.error("Failed to load queue:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    loadQueue(); 
  }, [loadQueue]);

  const playFromQueue = useCallback((index: number) => {
    const uris = ([current?.uri, ...queue.map((q) => q.uri)].filter(Boolean) as string[]);
    const adjustedOffset = current?.uri ? index : Math.max(0, index - 1);
    onPlayUris(uris, adjustedOffset);
  }, [current, queue, onPlayUris]);

  const handleQueueItemKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      playFromQueue(index + 1);
    }
  }, [playFromQueue]);

  // Drag and drop for reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    setQueue(prev => {
      const newQueue = [...prev];
      const [removed] = newQueue.splice(draggedIndex, 1);
      newQueue.splice(index, 0, removed);
      return newQueue;
    });
    setDraggedIndex(index);
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

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
        {queue.length > 0 && (
          <button 
            className="queue-clear-btn"
            onClick={clearQueue}
            aria-label="Clear queue"
          >
            <IconTrash size={14} />
            <span>Clear queue</span>
          </button>
        )}
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
              <div className="queue-item-artist">{current.artists?.map((a) => a.name).join(", ")}</div>
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
            {queue.map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                className={`queue-item ${draggedIndex === i ? 'dragging' : ''}`}
                role="listitem"
                tabIndex={0}
                draggable
                onClick={() => playFromQueue(i + 1)}
                onKeyDown={(e) => handleQueueItemKeyDown(e, i)}
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                aria-label={`${item.name} by ${item.artists?.map((a) => a.name).join(", ")}`}
              >
                <span className="drag-handle">
                  <IconDrag size={14} />
                </span>
                <div className="queue-item-img" style={{
                  background: item.album?.images?.[0]?.url ? `url(${item.album.images[0].url}) center/cover` : undefined
                }} />
                <div className="queue-item-info">
                  <div className="queue-item-title">{item.name}</div>
                  <div className="queue-item-artist">{item.artists?.map((a) => a.name).join(", ")}</div>
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
