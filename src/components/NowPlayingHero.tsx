import { IconHeart, IconTag, IconShare } from "./icons";
import { Artwork } from "./Artwork";
import { AudioFeatures } from "./AudioFeatures";
import { playCounts } from "../stores/playCounts";

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
  const handleShare = () => {
    if (track?.id) {
      const url = `https://open.spotify.com/track/${track.id}`;
      navigator.clipboard.writeText(url).then(() => {
        // Could show a toast notification here
      });
    }
  };

  const handleAddToPlaylist = () => {
    // Placeholder - would open a playlist selection dialog
    alert("Add to Playlist coming soon!");
  };

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

  // Get play counts for current track/artist
  const artistPlayCount = playCounts.value.artists[artistName] || 0;
  const trackPlayCount = playCounts.value.tracks[trackName] || 0;

  return (
    <div className={`np-hero${isLoading ? " no-animation" : ""}`}>
      <Artwork src={track.imageUrl} alt="" size="hero" />

      <div className="np-info">
        <div className="np-track-name">{trackName}</div>
        <div className="np-artist-name">{artistName}</div>
        {albumName && <div className="np-album-name">from {albumName}</div>}

        <div className="np-listening-info">
          You've listened to <strong>{artistName}</strong> {artistPlayCount} times and <strong>{trackName}</strong> {trackPlayCount} times.
        </div>

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
          <button
            className="np-action-btn"
            onClick={handleAddToPlaylist}
            title="Add to Playlist"
          >
            <IconTag size={20} />
          </button>
          <button
            className="np-action-btn"
            onClick={handleShare}
            title="Share"
          >
            <IconShare size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
