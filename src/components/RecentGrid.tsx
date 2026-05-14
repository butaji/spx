import { homeFeed } from "../stores/spotify";
import type { View } from "../App";
import { Artwork } from "./Artwork";

interface RecentGridProps {
  onNavigate: (v: View) => void;
  onPlayContext: (uri: string, offsetUri?: string) => void;
}

export default function RecentGrid({ onNavigate, onPlayContext }: RecentGridProps) {
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
            onPlayContext={onPlayContext}
          />
        ))}
      </div>
    </section>
  );
}

function FeedItem({
  item,
  onNavigate,
  onPlayContext,
}: {
  item: (typeof homeFeed.value)[0];
  onNavigate: (v: View) => void;
  onPlayContext: (uri: string, offsetUri?: string) => void;
}) {
  const handleClick = () => {
    if (item.type === "artist") {
      const artistId = item.id.replace("artist-", "");
      onNavigate({ type: "artist", id: artistId, name: item.name });
    } else if (item.type === "playlist") {
      onNavigate({ type: "playlist", id: item.id, name: item.name });
    } else if (item.type === "radio") {
      if (item.uri) onPlayContext(item.uri);
    } else {
      if (item.uri) onPlayContext(item.uri);
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
        item.type === "artist"
          ? `View artist ${item.name}`
          : item.type === "playlist"
          ? `Open playlist ${item.name}`
          : `Play ${item.name}${item.subtitle ? ` by ${item.subtitle}` : ""}`
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
