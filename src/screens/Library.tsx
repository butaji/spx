import { useEffect, useState, useCallback, useRef } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { getUserPlaylists, getSavedTracks, getSavedAlbums, getTopTracks } from "../lib/spotify";
import { getCached, setCache } from "../lib/cache";
import { View } from "../types";
import { SpotifyPlaylist, SpotifyTrack, SpotifyAlbum } from "../types";
import { Artwork } from "../components/Artwork";
import { TrackRow } from "../components/TrackRow";
import { playbackTrack, isPlaying } from "../stores/spotify";

type Tab = "playlists" | "tracks" | "albums" | "top";

interface Props {
  onPlayUris: (uris: string[], offset?: number) => void;
  onNavigate: (v: View) => void;
}

type LibraryItem = SpotifyPlaylist | SpotifyTrack | SpotifyAlbum;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cacheKey = (tab: Tab) => `library:${tab}`;

export default function Library({ onPlayUris, onNavigate }: Props) {
  const [tab, setTab] = useState<Tab>("playlists");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);

  const loadData = useCallback(async (fromCache = true) => {
    const key = cacheKey(tab);

    // Check cache first - render immediately if available
    if (fromCache) {
      const cached = await getCached(key);
      if (cached && cached.length > 0) {
        setItems(cached);
        setInitialLoading(false);
        // Background refresh
        loadData(false);
        return;
      }
    }

    // No cache or background refresh
    if (fromCache) {
      setInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      let freshItems: LibraryItem[] = [];
      if (tab === "playlists") {
        const d = await getUserPlaylists();
        freshItems = (d.items || []).filter(Boolean);
      } else if (tab === "tracks") {
        const d = await getSavedTracks();
        freshItems = (d.items || []).filter(Boolean).map((i: any) => i.track).filter(Boolean) as SpotifyTrack[];
      } else if (tab === "albums") {
        const d = await getSavedAlbums();
        freshItems = (d.items || []).filter(Boolean).map((i: any) => i.album).filter(Boolean) as SpotifyAlbum[];
      } else if (tab === "top") {
        const d = await getTopTracks(50, 'short_term');
        freshItems = (d || []).filter(Boolean);
      }

      if (isMountedRef.current) {
        setItems(freshItems);
        setInitialLoading(false);
        setIsRefreshing(false);
        // Cache the fresh data
        await setCache(key, freshItems, CACHE_TTL_MS);
      }
    } catch (e) {
      console.error("Failed to load library:", e);
      if (isMountedRef.current) {
        setInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [tab]);

  useEffect(() => {
    isMountedRef.current = true;
    loadData(true);
    return () => { isMountedRef.current = false; };
  }, [loadData]);

  // Re-load when tab changes
  const handleTabChange = useCallback((newTab: Tab) => {
    setTab(newTab);
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: "playlists", label: "Playlists" },
    { key: "tracks", label: "Songs" },
    { key: "albums", label: "Albums" },
    { key: "top", label: "Top" },
  ];

  const handleItemClick = useCallback((item: LibraryItem) => {
    if (tab === "playlists") {
      onNavigate({ type: "playlist", id: (item as SpotifyPlaylist).id, name: (item as SpotifyPlaylist).name });
    } else if (tab === "albums" || tab === "top") {
      const albumId = (item as SpotifyAlbum).id;
      if (albumId) onNavigate({ type: "album", id: albumId, name: (item as SpotifyAlbum).name });
    }
  }, [tab, onNavigate]);

  const handleItemKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, item: LibraryItem) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleItemClick(item);
    }
  }, [handleItemClick]);

  const handleTrackClick = useCallback((item: SpotifyTrack) => {
    if (item.uri) onPlayUris([item.uri]);
  }, [onPlayUris]);

  const handleTrackKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, item: SpotifyTrack) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleTrackClick(item);
    }
  }, [handleTrackClick]);

  // Full loading state - only when no cache AND fetching
  if (initialLoading && items.length === 0) {
    return (
      <div>
        <h1 className="screen-title">Your Library</h1>
        <div className="filter-tabs" role="tablist" aria-label="Library tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => handleTabChange(t.key)}
              className={tab === t.key ? "filter-tab active" : "filter-tab"}
              aria-label={`Show ${t.label}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} aria-live="polite">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 className="screen-title" style={{ marginBottom: 0 }}>Your Library</h1>
        {isRefreshing && (
          <span className="text-sm text-muted" style={{ opacity: 0.6 }} aria-live="polite">Updating...</span>
        )}
      </div>

      <div className="filter-tabs" role="tablist" aria-label="Library tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => handleTabChange(t.key)}
            className={tab === t.key ? "filter-tab active" : "filter-tab"}
            aria-label={`Show ${t.label}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "playlists" || tab === "albums" ? (
        <div className="lib-grid">
          {items.filter(Boolean).map((item) => (
            <div
              key={item.id}
              className="lib-item"
              role="button"
              tabIndex={0}
              onClick={() => handleItemClick(item)}
              onKeyDown={(e) => handleItemKeyDown(e, item)}
              aria-label={`${item.name} - ${tab === "playlists" ? "playlist" : "album"}`}
            >
              <Artwork
                src={("images" in item ? (item as SpotifyPlaylist).images?.[0]?.url : undefined) || ((item as SpotifyTrack).album?.images?.[0]?.url)}
                alt={item.name}
                size={160}
                className="lib-item-img"
              />
              <div className="lib-item-title">{item.name}</div>
              <div className="lib-item-sub">
                {tab === "playlists" ? `${("tracks" in item ? item.tracks?.total || 0 : 0)} tracks` : ("artists" in item && item.artists?.filter(Boolean)?.[0]?.name) || ""}
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
          {items.filter(Boolean).map((item, i) => {
            const track = item as SpotifyTrack;
            return (
              <TrackRow
                key={track.id}
                index={i}
                name={track.name}
                album={track.album?.name}
                artists={track.artists?.filter(Boolean).map((a) => a.name).join(", ")}
                durationMs={track.duration_ms || 0}
                imageUrl={track.album?.images?.[0]?.url}
                onClick={() => handleTrackClick(track)}
                onKeyDown={(e) => handleTrackKeyDown(e, track)}
                isActive={track.id === playbackTrack.value?.id}
                isPlaying={track.id === playbackTrack.value?.id && isPlaying.value}
                ariaLabel={`${track.name} by ${track.artists?.filter(Boolean).map((a) => a.name).join(", ")}`}
              />
            );
          })}
          {items.length === 0 && (
            <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} role="status">
              No {tab === "top" ? "top tracks" : "tracks"} found
            </p>
          )}
        </div>
      )}
    </div>
  );
}
