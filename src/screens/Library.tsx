import { useEffect, useState, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { invoke } from "@tauri-apps/api/core";
import { View } from "../App";
import { SpotifyPlaylist, SpotifyTrack, SpotifyAlbum, SpotifySavedTracks, SpotifySavedAlbums, SpotifyUserPlaylists } from "../types";

type Tab = "playlists" | "tracks" | "albums";

interface Props {
  onPlayContext: (uri: string, offsetUri?: string) => void;
  onPlayUris: (uris: string[], offset?: number) => void;
  onNavigate: (v: View) => void;
}

type LibraryItem = SpotifyPlaylist | SpotifyTrack | SpotifyAlbum;

export default function Library({ onPlayContext, onNavigate }: Props) {
  const [tab, setTab] = useState<Tab>("playlists");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "playlists") {
        const d = await invoke<SpotifyUserPlaylists>("spotify_user_playlists");
        setItems(d.items || []);
      } else if (tab === "tracks") {
        const d = await invoke<SpotifySavedTracks>("spotify_saved_tracks");
        setItems((d.items || []).map((i) => i.track).filter(Boolean) as SpotifyTrack[]);
      } else if (tab === "albums") {
        const d = await invoke<SpotifySavedAlbums>("spotify_saved_albums");
        setItems((d.items || []).map((i) => i.album).filter(Boolean) as SpotifyAlbum[]);
      }
    } catch (e) {
      console.error("Failed to load library:", e);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => { loadData(); }, [loadData]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "playlists", label: "Playlists" },
    { key: "tracks", label: "Songs" },
    { key: "albums", label: "Albums" },
  ];

  const handleItemClick = useCallback((item: LibraryItem) => {
    if (tab === "playlists") {
      onNavigate({ type: "playlist", id: (item as SpotifyPlaylist).id, name: (item as SpotifyPlaylist).name });
    } else if (tab === "albums") {
      onNavigate({ type: "album", id: (item as SpotifyAlbum).id, name: (item as SpotifyAlbum).name });
    }
  }, [tab, onNavigate]);

  const handleItemKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, item: LibraryItem) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleItemClick(item);
    }
  }, [handleItemClick]);

  const handleTrackClick = useCallback((item: SpotifyTrack) => {
    if (item.uri) onPlayContext(item.uri);
  }, [onPlayContext]);

  const handleTrackKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, item: SpotifyTrack) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleTrackClick(item);
    }
  }, [handleTrackClick]);

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Your Library</h2>

      <div className="filter-tabs" role="tablist" aria-label="Library tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? "filter-tab active" : "filter-tab"}
            aria-label={`Show ${t.label}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} aria-live="polite">Loading...</p>
      ) : tab === "playlists" || tab === "albums" ? (
        <div className="lib-grid">
          {items.map((item) => (
            <div
              key={item.id}
              className="lib-item"
              role="button"
              tabIndex={0}
              onClick={() => handleItemClick(item)}
              onKeyDown={(e) => handleItemKeyDown(e, item)}
              aria-label={`${item.name} - ${tab === "playlists" ? "playlist" : "album"}`}
            >
              <div className="lib-item-img" style={{
                background: ("images" in item && item.images?.[0]?.url) || ("album" in item && (item as SpotifyTrack).album?.images?.[0]?.url)
                  ? `url(${("images" in item ? (item as SpotifyPlaylist).images?.[0]?.url : undefined) || (item as SpotifyTrack).album?.images?.[0]?.url}) center/cover`
                  : undefined
              }} />
              <div className="lib-item-title">{item.name}</div>
              <div className="lib-item-sub">
                {tab === "playlists" ? `${("tracks" in item ? item.tracks?.total || 0 : 0)} tracks` : ("artists" in item && item.artists?.[0]?.name) || ""}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30, gridColumn: "1 / -1" }} role="status">
              No {tab} found
            </p>
          )}
        </div>
      ) : (
        <div className="tracklist">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="track"
              role="button"
              tabIndex={0}
              onClick={() => handleTrackClick(item as SpotifyTrack)}
              onKeyDown={(e) => handleTrackKeyDown(e, item as SpotifyTrack)}
              aria-label={`${item.name} by ${(item as SpotifyTrack).artists?.map((a) => a.name).join(", ")}`}
            >
              <div className="track-num">{i + 1}</div>
              <div className="track-art" style={{
                background: (item as SpotifyTrack).album?.images?.[0]?.url ? `url(${(item as SpotifyTrack).album?.images?.[0]?.url}) center/cover` : undefined
              }} />
              <div className="track-info">
                <div className="track-title">{item.name}</div>
                <div className="track-album">{(item as SpotifyTrack).artists?.map((a) => a.name).join(", ")}</div>
              </div>
              <div />
              <div />
              <div className="track-dur" />
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} role="status">
              No tracks found
            </p>
          )}
        </div>
      )}
    </div>
  );
}
