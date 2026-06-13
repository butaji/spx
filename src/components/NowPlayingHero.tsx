import { useState } from "preact/compat";
import { IconHeart, IconTag, IconShare, IconClose } from "./icons";
import { Artwork } from "./Artwork";
import { AudioFeatures } from "./AudioFeatures";
import { userPlaylists } from "../stores/content";
import { addTracksToPlaylist } from "../lib/spotify";

interface Track {
  id?: string;
  name?: string;
  artist?: string;
  artistName?: string;
  album?: string;
  albumName?: string;
  imageUrl?: string;
  uri?: string;
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
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [addingPlaylistId, setAddingPlaylistId] = useState<string | null>(null);

  const handleShare = () => {
    if (track?.id) {
      const url = `https://open.spotify.com/track/${track.id}`;
      navigator.clipboard.writeText(url).then(() => {
        // Could show a toast notification here
      });
    }
  };

  const handleAddToPlaylist = () => {
    setShowPlaylistDialog(true);
  };

  const handleSelectPlaylist = async (playlistId: string) => {
    if (!track?.uri) return;
    setAddingPlaylistId(playlistId);
    try {
      await addTracksToPlaylist(playlistId, [track.uri]);
      setShowPlaylistDialog(false);
    } catch (e) {
      console.error("Failed to add to playlist:", e);
    } finally {
      setAddingPlaylistId(null);
    }
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

      {showPlaylistDialog && (
        <div
          className="dialog-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPlaylistDialog(false); }}
          role="dialog"
          aria-modal="true"
          aria-label="Add to playlist"
        >
          <div className="dialog-content" style={{ maxWidth: 400 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Add to Playlist</h3>
              <button className="ctrl-btn" onClick={() => setShowPlaylistDialog(false)} aria-label="Close">
                <IconClose size={18} />
              </button>
            </div>
            <div style={{ maxHeight: 320, overflow: "auto" }}>
              {userPlaylists.value.length === 0 ? (
                <p className="text-sm text-muted">No playlists found</p>
              ) : (
                userPlaylists.value.map((pl) => (
                  <button
                    key={pl.id}
                    className="playlist-select-row"
                    onClick={() => handleSelectPlaylist(pl.id)}
                    disabled={addingPlaylistId === pl.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      opacity: addingPlaylistId === pl.id ? 0.6 : 1,
                    }}
                  >
                    <Artwork src={pl.images?.[0]?.url} alt="" size={40} />
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {pl.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--fg-dim)" }}>
                        {pl.tracks?.total ?? 0} tracks
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
