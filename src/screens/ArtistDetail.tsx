import { useEffect, useState, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { getArtist, getArtistTopTracks, getArtistAlbums } from "../lib/spotify";
import { IconPlay } from "../components/icons";
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

export default function ArtistDetail({ id, name, onPlayContext, onPlayUris }: Props) {
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
      <div className="detail-hero detail-hero--artist">
        <div className="detail-hero-image-wrap detail-hero-image-wrap--round">
          {artist?.images?.[0]?.url ? (
            <img
              src={artist.images[0].url}
              alt={artist.name || name}
              className="detail-hero-img"
            />
          ) : (
            <div className="detail-hero-img detail-hero-img--placeholder" />
          )}
        </div>
        <div className="detail-hero-info">
          <div className="eyebrow">Artist</div>
          <h1>{artist?.name || name}</h1>
          <div className="artist-meta">
            <span className="artist-meta-item">{artist?.followers?.total?.toLocaleString()} followers</span>
            {artist?.genres && artist.genres.length > 0 && (
              <>
                <span className="artist-meta-sep">·</span>
                <span className="artist-meta-genres">{artist.genres.slice(0, 3).join(", ")}</span>
              </>
            )}
          </div>
          <div className="artist-popularity">
            <span className="artist-popularity-label">Popularity</span>
            <div className="artist-popularity-bar">
              <div className="artist-popularity-fill" style={{ width: `${popularityPct}%` }} />
            </div>
            <span className="artist-popularity-value">{popularityPct}%</span>
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
                    onClick={() => onPlayContext(`spotify:album:${album.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPlayContext(`spotify:album:${album.id}`);
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
