import { useEffect, useState, useCallback } from "preact/hooks";
import { recentContainers, type RecentContainer } from "../stores/content";
import type { View } from "../types";
import { Artwork } from "./Artwork";

interface Props {
  onPlayContext: (uri: string, offsetUri?: string) => void;
  onNavigate: (v: View) => void;
}

export default function RecentlyPlayedSection({ onPlayContext, onNavigate }: Props) {
  // Local state mirrors the store signal so renders are stable
  const [items, setItems] = useState<RecentContainer[]>(recentContainers.value);

  // Sync when store signal changes
  useEffect(() => {
    const cleanup = recentContainers.subscribe(() => {
      setItems(recentContainers.value);
    });
    return cleanup;
  }, []);

  const handleClick = useCallback((item: RecentContainer) => {
    if (!item.uri) return;
    // Navigate or play context
    if (item.type === "playlist") {
      if (item.id) onNavigate({ type: "playlist", id: item.id, name: item.name });
    } else if (item.type === "album") {
      if (item.id) onNavigate({ type: "album", id: item.id, name: item.name });
    } else if (item.type === "artist" || item.type === "radio") {
      const id = item.id.replace(/^(radio-)/, "");
      if (id) onNavigate({ type: "artist", id, name: item.name });
    } else {
      // Default: play context
      onPlayContext(item.uri);
    }
  }, [onPlayContext, onNavigate]);

  // No items — show empty state
  if (items.length === 0) {
    return (
      <section style={{ marginTop: 24, paddingRight: 16 }}>
        <h2 className="section-title">Recently Played</h2>
        <div style={{
          padding: "32px 0",
          textAlign: "center",
          color: "var(--fg-muted)",
          fontSize: 13,
        }}>
          <p>Start playing music to see your history here.</p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 24, paddingRight: 16 }}>
      <h2 className="section-title">Recently Played</h2>
      <div className="lib-grid">
        {items.slice(0, 12).map((item) => (
          <div
            key={item.id}
            className={`lib-item ${item.type === "artist" || item.type === "radio" ? "artist" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => handleClick(item)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick(item);
              }
            }}
            aria-label={`${item.name} — ${item.type}`}
          >
            <Artwork
              src={item.images?.[0]?.url}
              alt={item.name}
              size={160}
              shape={item.type === "artist" || item.type === "radio" ? "round" : "square"}
              className="lib-item-img"
            />
            <div className="lib-item-title">{item.name}</div>
            <div className="lib-item-sub">
              {item.type === "radio" ? "Radio" : item.artistName || item.owner || item.type}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
