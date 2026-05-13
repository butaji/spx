import { IconHeart, IconTag, IconShare } from "./icons";

interface Track {
  name?: string;
  artist?: string;
  artistName?: string;
  album?: string;
  imageUrl?: string;
}

interface NowPlayingHeroProps {
  track: Track | null;
  liked: boolean;
  isLoading: boolean;
  tags: string[];
  onToggleLike: () => void;
}

export default function NowPlayingHero({
  track,
  liked,
  isLoading,
  tags,
  onToggleLike,
}: NowPlayingHeroProps) {
  if (!track) {
    return (
      <div className="np-hero">
        <div className="np-artwork skeleton" />
        <div className="np-info">
          <div className="skeleton-text" style={{ width: 200 }} />
          <div className="skeleton-text" style={{ width: 140, marginTop: 8 }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`np-hero${isLoading ? " no-animation" : ""}`}>
      <div className="np-artwork">
        {track.imageUrl ? <img src={track.imageUrl} alt="" /> : null}
      </div>

      <div className="np-info">
        <TrackMeta track={track} tags={tags} />
        <ActionButtons liked={liked} isLoading={isLoading} onToggleLike={onToggleLike} />
      </div>
    </div>
  );
}

function TrackMeta({ track, tags }: { track: Track; tags: string[] }) {
  return (
    <div>
      <div className="np-track-name">{track.name || "Nothing playing"}</div>
      <div className="np-artist-name">
        {track.artist
          ? `by ${track.artist}`
          : track.artistName
            ? `by ${track.artistName}`
            : "Start playback on Spotify"}
      </div>
      {track.album && <div className="np-album-name">from {track.album}</div>}
      <TagList tags={tags} />
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;

  return (
    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            padding: "2px 8px",
            borderRadius: "var(--radius-full)",
            background: "oklch(100% 0 0 / 0.06)",
            fontSize: 10,
            color: "var(--accent)",
            border: "1px solid oklch(72% 0.17 145 / 0.2)",
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function ActionButtons({
  liked,
  isLoading,
  onToggleLike,
}: {
  liked: boolean;
  isLoading: boolean;
  onToggleLike: () => void;
}) {
  const base = "np-action-btn";
  const noAnim = isLoading ? " no-animation" : "";

  return (
    <div className="np-actions" style={{ justifyContent: "flex-start" }}>
      <button
        className={`${base} np-action-like${liked ? " liked" : ""}${noAnim}`}
        onClick={onToggleLike}
      >
        <IconHeart filled={liked} />
      </button>
      <button className={`${base}${noAnim}`}>
        <IconTag />
      </button>
      <button className={`${base}${noAnim}`}>
        <IconShare />
      </button>
    </div>
  );
}
