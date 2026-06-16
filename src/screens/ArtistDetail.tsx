import { useEffect, useState, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { getArtist, getArtistTopTracks, getArtistAlbums } from "../lib/spotify";
import { IconPlay, IconUsers, IconStar, IconDisc } from "../components/icons";
import { TrackRow } from "../components/TrackRow";
import { playbackTrack, isPlaying } from "../stores/spotify";
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
      setTopTracks(((tt.tracks || []).filter(Boolean)) as SpotifyTrack[]);
    } catch (e) {
      console.error("Failed to load artist top tracks:", e);
    }
    try {
      const ab = await getArtistAlbums(id);
      setAlbums((ab.items || []).filter(Boolean));
    } catch (e) {
      console.error("Failed to load artist albums:", e);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const playTopTracks = useCallback(() => {
    const uris = topTracks.filter(Boolean).map((t) => t.uri).filter(Boolean);
    if (uris.length) onPlayUris(uris);
  }, [topTracks, onPlayUris]);

  const handleTrackKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, track: SpotifyTrack) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPlayUris([track.uri]);
    }
  }, [onPlayUris]);

  const popularityPct = artist?.popularity ?? 0;
  const followerCount = artist?.followers?.total ?? 0;

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
          
          {/* Artist Stats */}
          <div className="artist-stats">
            <div className="artist-stat">
              <IconUsers size={16} />
              <span className="stat-value">{followerCount > 0 ? formatNumber(followerCount) : "—"}</span>
              <span className="stat-label">Followers</span>
            </div>
            <div className="artist-stat">
              <IconStar size={16} />
              <span className="stat-value">{popularityPct}%</span>
              <span className="stat-label">Popularity</span>
            </div>
            <div className="artist-stat">
              <IconDisc size={16} />
              <span className="stat-value">{albums.length}</span>
              <span className="stat-label">Albums</span>
            </div>
          </div>
          
          {/* Genres */}
          {artist?.genres && artist.genres.length > 0 && (
            <div className="artist-genres">
              {artist.genres.slice(0, 5).map((genre, i) => (
                <span key={i} className="artist-genre-tag">{genre}</span>
              ))}
            </div>
          )}
          
          <div className="station-actions">
            <button className="play-btn-lg" onClick={playTopTracks} aria-label="Play popular tracks">
              <IconPlay />
            </button>
          </div>
        </div>
      </div>

      {/* Popularity Bar */}
      <div className="artist-popularity-section">
        <div className="artist-popularity">
          <span className="artist-popularity-label">Popularity Score</span>
          <div className="artist-popularity-bar">
            <div className="artist-popularity-fill" style={{ width: `${popularityPct}%` }} />
          </div>
          <span className="artist-popularity-value">{popularityPct}%</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <span>Loading artist...</span>
        </div>
      ) : (
        <div>
          <h2 className="section-heading">Popular</h2>
          <div className="tracklist">
            {topTracks.filter(Boolean).map((track, i) => (
              <TrackRow
                key={track.id}
                index={i}
                name={track.name}
                album={track.album?.name}
                durationMs={track.duration_ms || 0}
                imageUrl={track.album?.images?.[0]?.url}
                onClick={() => onPlayUris([track.uri])}
                onKeyDown={(e) => handleTrackKeyDown(e, track)}
                isActive={track.id === playbackTrack.value?.id}
                isPlaying={track.id === playbackTrack.value?.id && isPlaying.value}
                ariaLabel={`${track.name} from ${track.album?.name}`}
              />
            ))}
          </div>

          {albums.length > 0 && (
            <>
              <h2 className="section-heading" style={{ marginTop: 32 }}>Discography</h2>
              <div className="lib-grid">
                {albums.filter(Boolean).map((album) => (
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
                    <div className="lib-item-play-overlay">
                      <IconPlay size={24} />
                    </div>
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

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}
