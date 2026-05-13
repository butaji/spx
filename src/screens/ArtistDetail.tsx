import { useEffect, useState, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { getArtist, getArtistTopTracks, getArtistAlbums } from "../lib/spotify";
import { IconPlay } from "../App";
import { SpotifyArtist, SpotifyTrack } from "../types";

interface Props {
  id: string;
  name: string;
  onPlayContext: (uri: string, offsetUri?: string) => void;
  onPlayUris: (uris: string[], offset?: number) => void;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  images?: { url: string }[];
  album_type: string;
  release_date?: string;
}

export default function ArtistDetail({ id, name, onPlayUris }: Props) {
  const [artist, setArtist] = useState<SpotifyArtist | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const a = await getArtist(id);
      setArtist(a);
    } catch (e) {
      console.error("Failed to load artist:", e);
    }
    try {
      const tt = await getArtistTopTracks(id);
      setTopTracks((tt.tracks || []) as SpotifyTrack[]);
    } catch (e) {
      console.error("Failed to load artist top tracks:", e);
    }
    try {
      const ab = await getArtistAlbums(id);
      setAlbums(ab.items || []);
    } catch (e) {
      console.error("Failed to load artist albums:", e);
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

  const popularityPct = artist?.popularity ?? 0;

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
          {artist?.genres && artist.genres.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {artist.genres.map((g) => (
                <span key={g} style={{ background: "var(--bg-3)", padding: "2px 8px", borderRadius: 12, fontSize: 11, textTransform: "capitalize" }}>{g}</span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Popularity</span>
              <div style={{ width: 80, height: 4, background: "var(--bg-3)", borderRadius: 2 }}>
                <div style={{ width: `${popularityPct}%`, height: "100%", background: "var(--accent)", borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{popularityPct}%</span>
            </div>
          </div>
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

          {albums.length > 0 && (
            <>
              <h2 style={{ marginTop: 32, marginBottom: 16 }}>Discography</h2>
              <div className="lib-grid">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    className="lib-item"
                    onClick={() => onPlayUris([`spotify:album:${album.id}`])}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPlayUris([`spotify:album:${album.id}`]);
                      }
                    }}
                  >
                    <div className="lib-item-img" style={{ background: album.images?.[0]?.url ? `url(${album.images[0].url}) center/cover` : undefined }} />
                    <div className="lib-item-title">{album.name}</div>
                    <div className="lib-item-sub">{album.album_type} · {album.release_date?.split("-")[0]}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
