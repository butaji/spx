import { homeFeed } from "../stores/spotify";
import type { View } from "../types";

interface RecentGridProps {
  onNavigate: (v: View) => void;
  onPlayContext: (uri: string, offsetUri?: string) => void;
}

export default function RecentGrid({ onNavigate }: RecentGridProps) {
  if (!homeFeed.value.length) return null;

  return (
    <section style={{ marginTop: 24, paddingRight: 16 }}>
      <h2 className="section-title">Recent</h2>
      <div className="lib-grid">
        {homeFeed.value.map((item) => (
          <FeedItem
            key={item.id}
            item={item}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}

function FeedItem({
  item,
  onNavigate,
}: {
  item: (typeof homeFeed.value)[0];
  onNavigate: (v: View) => void;
}) {
  const handleClick = () => {
    if (item.type === "artist") {
      onNavigate({ type: "artist", id: item.id, name: item.name });
    } else if (item.type === "playlist") {
      onNavigate({ type: "playlist", id: item.id, name: item.name });
    } else if (item.type === "radio") {
      onNavigate({ type: "artist", id: item.id, name: item.name.replace(" Radio", "") });
    } else {
      // album
      onNavigate({ type: "album", id: item.id, name: item.name });
    }
  };

  const typeLabel = item.type === "playlist" ? "Playlist"
    : item.type === "radio" ? "Radio"
    : item.type === "artist" ? "Artist"
    : "Album";

  return (
    <div
      className={`lib-item ${item.type === "artist" ? "artist" : ""}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      aria-label={item.name}
    >
      <div style={{ position: "relative" }}>
        <div
          className="lib-item-img"
          style={{
            background: item.image
              ? `url(${item.image}) center/cover`
              : undefined,
          }}
        />
        <span
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            fontSize: 9,
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: "var(--radius-full)",
            background: "var(--accent)",
            color: "#000",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            lineHeight: "16px",
            backdropFilter: "none",
          }}
        >
          {typeLabel}
        </span>
      </div>
      <div className="lib-item-title">{item.name}</div>
      <div className="lib-item-sub">{item.subtitle}</div>
    </div>
  );
}
