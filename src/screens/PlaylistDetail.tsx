import { useEffect, useState, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { invoke } from "@tauri-apps/api/core";
import { formatTime } from "../App";
import { IconPlay } from "../App";
import { SpotifyTrack, SpotifyPlaylist, SpotifyPlaylistItem } from "../types";

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
      const data = await invoke<{ items: SpotifyPlaylistItem[] }>("spotify_playlist_tracks", { playlistId: id });
      setTracks((data.items || []).map((i) => i.track).filter(Boolean) as SpotifyTrack[]);
    } catch (e) {
      console.error("Failed to load playlist tracks:", e);
    }
    try {
      const pl = await invoke<SpotifyPlaylist>("spotify_get_playlist", { playlistId: id });
      setPlaylist(pl);
    } catch (e) {
      console.error("Failed to load playlist:", e);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  const playAll = useCallback(() => {
    const uris = tracks.map((t) => t.uri).filter(Boolean);
    if (uris.length) onPlayUris(uris);
  }, [tracks, onPlayUris]);

  const playTrack = useCallback((index: number) => {
    const uris = tracks.map((t) => t.uri).filter(Boolean);
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
        <div className="detail-hero-img" style={{
          background: playlist?.images?.[0]?.url ? `url(${playlist.images[0].url}) center/cover` : undefined
        }} />
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
          {tracks.map((track, i) => (
            <div
              key={track.id}
              className="track"
              role="button"
              tabIndex={0}
              onClick={() => playTrack(i)}
              onKeyDown={(e) => handleTrackKeyDown(e, i)}
              aria-label={`${track.name} by ${track.artists?.map((a) => a.name).join(", ")}`}
            >
              <div className="track-num">{i + 1}</div>
              <div className="track-art" style={{
                background: track.album?.images?.[0]?.url ? `url(${track.album.images[0].url}) center/cover` : undefined
              }} />
              <div className="track-info">
                <div className="track-title">{track.name}</div>
                <div className="track-album">{track.artists?.map((a) => a.name).join(", ")}</div>
              </div>
              <div />
              <div />
              <div className="track-dur">{formatTime(track.duration_ms || 0)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
