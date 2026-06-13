import { homeFeed } from "../stores/spotify";
import type { View } from "../types";
import { Artwork } from "./Artwork";

interface RecentGridProps {
  onNavigate: (v: View) => void;
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
      const artistId = item.id.replace("artist-", "");
      onNavigate({ type: "artist", id: artistId, name: item.name });
    } else if (item.type === "playlist") {
      onNavigate({ type: "playlist", id: item.id, name: item.name });
    } else if (item.type === "album") {
      onNavigate({ type: "album", id: item.id, name: item.name });
    } else if (item.type === "radio") {
      // Radio items are based on artists — navigate to the artist page
      const artistId = item.id.replace("radio-", "");
      onNavigate({ type: "artist", id: artistId, name: item.name.replace(" Radio", "") });
    } else if (item.uri) {
      // Fallback: parse URI to determine navigation type
      const parts = item.uri.split(":");
      const type = parts[1];
      const id = parts[2];
      if (type && id) {
        onNavigate({ type: type as View["type"], id, name: item.name });
      }
    }
  };

  return (
    <div
      className={`lib-item ${item.type === "artist" ? "artist" : ""}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={
        item.type === "artist" || item.type === "radio"
          ? `View artist ${item.name}`
          : item.type === "playlist"
          ? `Open playlist ${item.name}`
          : item.type === "album"
          ? `Open album ${item.name}`
          : `Open ${item.name}`
      }
    >
      <Artwork
        src={item.image}
        alt={item.name}
        size={160}
        shape={item.type === "artist" ? "round" : "square"}
        className="lib-item-img"
      />
      <div className="lib-item-title">{item.name}</div>
      <div className="lib-item-sub">{item.subtitle}</div>
    </div>
  );
}
