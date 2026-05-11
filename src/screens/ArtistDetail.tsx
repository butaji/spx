import { useEffect, useState, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { invoke } from "@tauri-apps/api/core";
import { IconPlay } from "../App";
import { SpotifyArtist, SpotifyTrack } from "../types";

interface Props {
  id: string;
  name: string;
  onPlayContext: (uri: string, offsetUri?: string) => void;
  onPlayUris: (uris: string[], offset?: number) => void;
}

export default function ArtistDetail({ id, name, onPlayUris }: Props) {
  const [artist, setArtist] = useState<SpotifyArtist | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const a = await invoke<SpotifyArtist>("spotify_get_artist", { artistId: id });
      setArtist(a);
    } catch (e) {
      console.error("Failed to load artist:", e);
    }
    try {
      const tt = await invoke<{ tracks: SpotifyTrack[] }>("spotify_get_artist_top_tracks", { artistId: id });
      setTopTracks(tt.tracks || []);
    } catch (e) {
      console.error("Failed to load artist top tracks:", e);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const playTopTracks = useCallback(() => {
    const uris = topTracks.map((t) => t.uri).filter(Boolean);
    if (uris.length) onPlayUris(uris);
  }, [topTracks, onPlayUris]);

  const handleTrackKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, track: SpotifyTrack) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPlayUris([track.uri]);
    }
  }, [onPlayUris]);

  return (
    <div>
      <div className="detail-hero">
        <div className="detail-hero-img" style={{
          background: artist?.images?.[0]?.url ? `url(${artist.images[0].url}) center/cover` : undefined
        }} />
        <div className="detail-hero-info">
          <div className="eyebrow">Artist</div>
          <h1>{artist?.name || name}</h1>
          <p className="body-text">{artist?.followers?.total?.toLocaleString()} followers</p>
          <p className="text-xs text-muted" style={{ marginTop: 4 }}>{artist?.genres?.join(", ")}</p>
          <div className="station-actions">
            <button className="play-btn-lg" onClick={playTopTracks} aria-label="Play popular tracks">
              <IconPlay />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} aria-live="polite">Loading...</p>
      ) : (
        <div>
          <h2 style={{ marginBottom: 16 }}>Popular</h2>
          <div className="tracklist">
            {topTracks.map((track, i) => (
              <div
                key={track.id}
                className="track"
                role="button"
                tabIndex={0}
                onClick={() => onPlayUris([track.uri])}
                onKeyDown={(e) => handleTrackKeyDown(e, track)}
                aria-label={`${track.name} from ${track.album?.name}`}
              >
                <div className="track-num">{i + 1}</div>
                <div className="track-art" style={{
                  background: track.album?.images?.[0]?.url ? `url(${track.album.images[0].url}) center/cover` : undefined
                }} />
                <div className="track-info">
                  <div className="track-title">{track.name}</div>
                  <div className="track-album">{track.album?.name}</div>
                </div>
                <div />
                <div />
                <div className="track-dur" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
