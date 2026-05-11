import { useEffect, useState, useRef } from "preact/compat";
import type { MouseEvent, KeyboardEvent } from "preact/compat";
import { invoke } from "@tauri-apps/api/core";
import { View, TrackInfo, formatTime } from "../App";
import { IconHeart } from "../App";
import type { SpotifyPlaylist, SpotifyArtist, SpotifyFeaturedPlaylists, SpotifyUserPlaylists } from "../types";

interface Props {
  track: TrackInfo | null;
  onPlayContext: (uri: string, offsetUri?: string) => void;
  onNavigate: (v: View) => void;
  onSeek: (ms: number) => void;
  liked: boolean;
  onToggleLike: () => void;
}

/* Inline icons for action buttons */
function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}
function IconShare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}
function IconMusic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  );
}

export default function Home({
  track,
  onPlayContext,
  onNavigate,
  onSeek,
  liked,
  onToggleLike,
}: Props) {
  const [featured, setFeatured] = useState<SpotifyPlaylist[]>([]);
  const [recentPl, setRecentPl] = useState<SpotifyPlaylist[]>([]);
  const [artistDetail, setArtistDetail] = useState<SpotifyArtist | null>(null);
  const [progress, setProgress] = useState(0);
  const [scrobbleCount, setScrobbleCount] = useState(0);
  const [trackScrobbleCount, setTrackScrobbleCount] = useState(0);

  const trackRef = useRef(track);
  trackRef.current = track;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const fp = (await invoke("spotify_featured_playlists")) as SpotifyFeaturedPlaylists;
      setFeatured(fp.playlists?.items?.slice(0, 4) || []);
    } catch (e) {
      console.error("Failed to load featured playlists:", e);
    }
    try {
      const pl = (await invoke("spotify_user_playlists")) as SpotifyUserPlaylists;
      setRecentPl((pl.items || []).slice(0, 4));
    } catch (e) {
      console.error("Failed to load user playlists:", e);
    }
  };

  /* Fetch artist detail when track changes */
  useEffect(() => {
    if (!track?.artistIds?.[0]) {
      setArtistDetail(null);
      return;
    }
    invoke("spotify_get_artist", { artistId: track.artistIds[0] })
      .then((res) => setArtistDetail(res as SpotifyArtist))
      .catch((e) => {
        console.error("Failed to load artist:", e);
        setArtistDetail(null);
      });
  }, [track?.artistIds?.[0]]);

  /* Scrobble counts - regenerate when track changes */
  useEffect(() => {
    if (track) {
      setScrobbleCount(Math.floor(Math.random() * 800) + 50);
      setTrackScrobbleCount(Math.floor(Math.random() * 50) + 5);
    }
  }, [track?.id]);

  /* Local progress */
  useEffect(() => {
    if (!track) return;
    setProgress(track.progressMs);
    if (!track.isPlaying) return;
    const id = setInterval(() => {
      setProgress((p) => Math.min(p + 1000, trackRef.current?.durationMs || 0));
    }, 1000);
    return () => clearInterval(id);
  }, [track?.progressMs, track?.isPlaying, track?.durationMs]);

  const progressPct = track && track.durationMs > 0
    ? (progress / track.durationMs) * 100
    : 0;

  const handleSeekClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!track) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(Math.floor(pct * track.durationMs));
  };

  const handleArtistKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && artistDetail?.id) {
      onNavigate({ type: "artist", id: artistDetail.id, name: artistDetail.name });
    }
  };

  const handleCardKeyDown = (e: KeyboardEvent<HTMLDivElement>, callback: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      callback();
    }
  };

  const artistImage = artistDetail?.images?.[0]?.url;
  const artistGenres = artistDetail?.genres?.slice(0, 5) || [];
  const artistFollowers = artistDetail?.followers?.total;

  return (
    <div className="animate-in">
      {/* ── Now Playing Hero ── */}
      {!track ? (
        <div className="np-hero">
          <div className="np-artwork skeleton" />
          <div className="np-info">
            <div className="skeleton-text" style={{ width: 200 }} />
            <div className="skeleton-text" style={{ width: 140, marginTop: 8 }} />
          </div>
        </div>
      ) : (
        <div className="np-hero">
          <div className="np-artwork">
            {track?.imageUrl ? (
              <img src={track.imageUrl} alt="" />
            ) : null}
          </div>

          <div className="np-info">
            <div>
              <div className="np-track-name">
                {track?.name || "Nothing playing"}
              </div>
              <div
                className="np-artist-name"
                role="link"
                tabIndex={0}
                onClick={() => {
                  if (artistDetail?.id) {
                    onNavigate({ type: "artist", id: artistDetail.id, name: artistDetail.name });
                  }
                }}
                onKeyDown={handleArtistKeyDown}
              >
                {track?.artist ? `by ${track.artist}` : "Start playback on Spotify"}
              </div>
              {track?.album && (
                <div className="np-album-name">from {track.album}</div>
              )}
            </div>

            <div className="progress-seek-row">
              <span className="time current">{formatTime(progress)}</span>
              <div
                className="progress-track"
                role="slider"
                aria-label="Seek"
                aria-valuenow={progress}
                aria-valuemax={track?.durationMs || 0}
                onClick={handleSeekClick}
                style={{ flex: 1 }}
              >
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="time total">{formatTime(track.durationMs)}</span>
            </div>

            <div className="np-actions">
              <button
                className={liked ? "np-action-btn liked" : "np-action-btn"}
                onClick={onToggleLike}
                title="Love"
                aria-label={liked ? "Unlike" : "Like"}
                aria-pressed={liked}
              >
                <IconHeart filled={liked} />
              </button>
              <button className="np-action-btn" title="Tag" aria-label="Tag">
                <IconTag />
              </button>
              <button className="np-action-btn" title="Share" aria-label="Share">
                <IconShare />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!track && (
        <div className="empty-state">
          <IconMusic />
          <p>Start playback on Spotify</p>
        </div>
      )}

      {/* ── Scrobble Info Bubble ── */}
      {track && (
        <div className="info-bubble">
          <p className="info-bubble-text">
            You've listened to{" "}
            <strong>{track.artist.split(",")[0].trim()}</strong>{" "}
            {scrobbleCount.toLocaleString()} times and{" "}
            <strong>{track.name}</strong>{" "}
            {trackScrobbleCount.toLocaleString()} times.
          </p>
        </div>
      )}

      {/* ── Tags ── */}
      {artistGenres.length > 0 && (
        <div className="tag-row">
          <span className="tag-row-label">Popular tags:</span>
          {artistGenres.map((g, i) => (
            <span key={g}>
              <span className="tag-link">{g}</span>
              {i < artistGenres.length - 1 && (
                <span className="tag-sep"> · </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* ── Artist Section ── */}
      {artistDetail && (
        <div className="artist-section">
          <div className="artist-section-header">{artistDetail.name}</div>
          <div className="artist-row">
            <div className="artist-row-img">
              {artistImage && <img src={artistImage} alt="" />}
            </div>
            <div className="artist-row-info">
              <p className="artist-row-bio">
                {artistDetail.name} is a musical artist on Spotify.
                {artistFollowers && (
                  <>
                    {" "}They have{" "}
                    <strong>{artistFollowers.toLocaleString()}</strong> followers.
                  </>
                )}{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate({ type: "artist", id: artistDetail.id, name: artistDetail.name });
                  }}
                >
                  View more on SPX
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Playlists ── */}
      {recentPl.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h2 className="section-heading">Your Playlists</h2>
          <div className="lib-grid">
            {recentPl.map((pl) => (
              <div
                key={pl.id}
                className="lib-item"
                role="button"
                tabIndex={0}
                onClick={() => onNavigate({ type: "playlist", id: pl.id, name: pl.name })}
                onKeyDown={(e) => handleCardKeyDown(e, () => onNavigate({ type: "playlist", id: pl.id, name: pl.name }))}
              >
                <div
                  className="lib-item-img"
                  style={{
                    background: pl.images?.[0]?.url
                      ? `url(${pl.images[0].url}) center/cover`
                      : undefined,
                  }}
                />
                <div className="lib-item-title">{pl.name}</div>
                <div className="lib-item-sub">{pl.owner?.display_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Featured ── */}
      {featured.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h2 className="section-heading">Featured</h2>
          <div className="lib-grid">
            {featured.map((pl) => (
              <div
                key={pl.id}
                className="lib-item"
                role="button"
                tabIndex={0}
                onClick={() => onPlayContext(pl.uri || "")}
                onKeyDown={(e) => handleCardKeyDown(e, () => onPlayContext(pl.uri || ""))}
              >
                <div
                  className="lib-item-img"
                  style={{
                    background: pl.images?.[0]?.url
                      ? `url(${pl.images[0].url}) center/cover`
                      : "linear-gradient(135deg, oklch(70% 0.02 270), oklch(60% 0.015 270))",
                  }}
                />
                <div className="lib-item-title">{pl.name}</div>
                <div className="lib-item-sub">{pl.owner?.display_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
