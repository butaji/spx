import { IconHeart } from "./icons";
import { Artwork } from "./Artwork";
import { AudioFeatures } from "./AudioFeatures";

interface Track {
  id?: string;
  name?: string;
  artist?: string;
  artistName?: string;
  album?: string;
  albumName?: string;
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
        <div className="np-artwork-large skeleton" />
        <div className="np-info">
          <div className="skeleton-text" style={{ width: 240, height: 32 }} />
          <div className="skeleton-text" style={{ width: 160, height: 24, marginTop: 8 }} />
        </div>
      </div>
    );
  }

  const trackName = track.name || "Nothing playing";
  const artistName = track.artist || track.artistName || "Start playback on Spotify";
  const albumName = track.album || track.albumName;

  return (
    <div className={`np-hero${isLoading ? " no-animation" : ""}`}>
      <Artwork src={track.imageUrl} alt="" size="hero" />

      <div className="np-info">
        <div className="np-track-name">{trackName}</div>
        <div className="np-artist-name">{artistName}</div>
        {albumName && <div className="np-album-name">from {albumName}</div>}

        {tags.length > 0 && (
          <div className="np-tags">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="np-tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        {track?.id && (
          <AudioFeatures trackId={track.id} />
        )}

        <div className="np-actions">
          <button
            className={`np-action-btn np-action-like${liked ? " liked" : ""}${isLoading ? " no-animation" : ""}`}
            onClick={onToggleLike}
          >
            <IconHeart filled={liked} size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
