import { useEffect, useState, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { getAlbum } from "../lib/spotify";
import { View } from "../types";
import { IconPlay } from "../components/icons";
import { TrackRow } from "../components/TrackRow";
import { playbackTrack, isPlaying } from "../stores/spotify";
import { SpotifyAlbum } from "../types";

interface Props {
  id: string;
  name: string;
  onPlayContext: (uri: string, offsetUri?: string) => void;
  onPlayUris: (uris: string[], offset?: number) => void;
  onNavigate: (v: View) => void;
}

export default function AlbumDetail({ id, name, onPlayContext, onPlayUris, onNavigate }: Props) {
  const [album, setAlbum] = useState<SpotifyAlbum | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAlbum = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAlbum(id);
      setAlbum(data);
    } catch (e) {
      console.error("Failed to load album:", e);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAlbum(); }, [loadAlbum]);

  const playAll = useCallback(() => {
    if (album?.uri) onPlayContext(album.uri);
  }, [album, onPlayContext]);

  const playTrack = useCallback((index: number) => {
    const uris = album?.tracks?.items?.filter(Boolean).map((t) => t.uri).filter(Boolean) || [];
    onPlayUris(uris, index);
  }, [album, onPlayUris]);

  const handleTrackKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      playTrack(index);
    }
  }, [playTrack]);

  const handleArtistClick = useCallback(() => {
    if (album?.artists?.[0]) {
      onNavigate({ type: "artist", id: album.artists[0].id, name: album.artists[0].name });
    }
  }, [album, onNavigate]);

  const handleArtistKeyDown = useCallback((e: KeyboardEvent<HTMLParagraphElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleArtistClick();
    }
  }, [handleArtistClick]);

  return (
    <div>
      <div className="detail-hero">
        <div className="detail-hero-image-wrap">
          {album?.images?.[0]?.url ? (
            <img
              src={album.images[0].url}
              alt={album?.name || name}
              className="detail-hero-img"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className="detail-hero-img" style={{ background: 'var(--surface)' }} />
          )}
        </div>
        <div className="detail-hero-info">
          <div className="eyebrow">Album</div>
          <h1>{album?.name || name}</h1>
          <p
            className="body-text"
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            onClick={handleArtistClick}
            onKeyDown={handleArtistKeyDown}
            aria-label={`Artist: ${album?.artists?.filter(Boolean).map((a) => a.name).join(", ")}`}
          >
            {album?.artists?.filter(Boolean).map((a) => a.name).join(", ")}
          </p>
          <p className="text-xs text-muted" style={{ marginTop: 4 }}>{album?.tracks?.items?.length || 0} tracks · {album?.release_date?.split("-")[0]}</p>
          <div className="station-actions">
            <button className="play-btn-lg" onClick={playAll} aria-label="Play album">
              <IconPlay />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} aria-live="polite">Loading...</p>
      ) : (
        <div className="tracklist">
          {album?.tracks?.items?.filter(Boolean).map((track, i) => (
            <TrackRow
              key={track.id}
              index={i}
              name={track.name}
              artists={track.artists?.filter(Boolean).map((a) => a.name).join(", ")}
              durationMs={track.duration_ms || 0}
              imageUrl={album?.images?.[0]?.url}
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
