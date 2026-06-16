import { useEffect, useState, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { getPlaylist, getPlaylistTracks } from "../lib/spotify";
import { IconPlay } from "../components/icons";
import { TrackRow } from "../components/TrackRow";
import { playbackTrack, isPlaying } from "../stores/spotify";
import { SpotifyTrack, SpotifyPlaylist } from "../types";

interface Props {
  id: string;
  name: string;
  onPlayContext: (uri: string, offsetUri?: string) => void;
  onPlayUris: (uris: string[], offset?: number) => void;
}

export default function PlaylistDetail({ id, name, onPlayUris }: Props) {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [playlist, setPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTracks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPlaylistTracks(id);
      setTracks((data.items || []).filter(Boolean).map((i: any) => i.track).filter(Boolean) as SpotifyTrack[]);
    } catch (e) {
      console.error("Failed to load playlist tracks:", e);
    }
    try {
      const pl = await getPlaylist(id);
      setPlaylist(pl);
    } catch (e) {
      console.error("Failed to load playlist:", e);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  const playAll = useCallback(() => {
    const uris = tracks.filter(Boolean).map((t) => t.uri).filter(Boolean);
    if (uris.length) onPlayUris(uris);
  }, [tracks, onPlayUris]);

  const playTrack = useCallback((index: number) => {
    const uris = tracks.filter(Boolean).map((t) => t.uri).filter(Boolean);
    onPlayUris(uris, index);
  }, [tracks, onPlayUris]);

  const handleTrackKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      playTrack(index);
    }
  }, [playTrack]);

  return (
    <div>
      <div className="detail-hero">
        <div className="detail-hero-image-wrap">
          {playlist?.images?.[0]?.url ? (
            <img
              src={playlist.images[0].url}
              alt={playlist?.name || name}
              className="detail-hero-img"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className="detail-hero-img" style={{ background: 'var(--surface)' }} />
          )}
        </div>
        <div className="detail-hero-info">
          <div className="eyebrow">Playlist</div>
          <h1>{playlist?.name || name}</h1>
          <p className="body-text">{playlist?.description || `${tracks.length} tracks`}</p>
          <div className="station-actions">
            <button className="play-btn-lg" onClick={playAll} aria-label="Play all tracks">
              <IconPlay />
            </button>
            <button className="btn-secondary" aria-label="Follow playlist">Follow +</button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} aria-live="polite">Loading...</p>
      ) : (
        <div className="tracklist">
          {tracks.filter(Boolean).map((track, i) => (
            <TrackRow
              key={track.id}
              index={i}
              name={track.name}
              artists={track.artists?.filter(Boolean).map((a) => a.name).join(", ")}
              durationMs={track.duration_ms || 0}
              imageUrl={track.album?.images?.[0]?.url}
              onClick={() => playTrack(i)}
              onKeyDown={(e) => handleTrackKeyDown(e, i)}
              isActive={track.id === playbackTrack.value?.id}
              isPlaying={track.id === playbackTrack.value?.id && isPlaying.value}
              ariaLabel={`${track.name} by ${track.artists?.filter(Boolean).map((a) => a.name).join(", ")}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
