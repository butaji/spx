import { useState, useEffect, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { search } from "../lib/spotify";
import { View } from "../App";
import { SpotifyTrack, SpotifyAlbum, SpotifyArtist, SpotifyPlaylist, SpotifySearchResults } from "../types";

type Filter = "all" | "tracks" | "albums" | "artists" | "playlists";

interface Props {
  onPlayContext: (uri: string, offsetUri?: string) => void;
  onPlayUris: (uris: string[], offset?: number) => void;
  onNavigate: (v: View) => void;
  initialQuery?: string;
}

type SearchItem = { type: "track" | "album" | "artist" | "playlist"; data: SpotifyTrack | SpotifyAlbum | SpotifyArtist | SpotifyPlaylist };

export default function Search({ onPlayUris, onNavigate, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery || "");
  const [results, setResults] = useState<SpotifySearchResults | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await search(q);
      setResults(data);
    } catch (e) {
      console.error("Failed to search:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      doSearch(initialQuery);
    }
  }, [initialQuery, doSearch]);

  const handleSearch = useCallback(async () => { doSearch(query); }, [query, doSearch]);

  const playTrack = useCallback((t: SpotifyTrack) => { onPlayUris([t.uri]); }, [onPlayUris]);

  const filters: Filter[] = ["all", "tracks", "albums", "artists", "playlists"];

  const getItems = (): SearchItem[] => {
    if (!results) return [];
    if (filter === "all") {
      return [
        ...(results.tracks?.items || []).map((t) => ({ type: "track" as const, data: t })),
        ...(results.albums?.items || []).map((a) => ({ type: "album" as const, data: a })),
        ...(results.artists?.items || []).map((a) => ({ type: "artist" as const, data: a })),
        ...(results.playlists?.items || []).map((p) => ({ type: "playlist" as const, data: p })),
      ];
    }
    const key = filter === "tracks" ? "tracks"
      : filter === "albums" ? "albums"
      : filter === "artists" ? "artists"
      : "playlists";
    const items = results[key]?.items || [];
    const type = filter.slice(0, -1) as "track" | "album" | "artist" | "playlist";
    return items.map((d) => ({ type, data: d }));
  };

  const handleItemClick = useCallback((item: SearchItem) => {
    if (item.type === "track") playTrack(item.data as SpotifyTrack);
    else if (item.type === "album") onNavigate({ type: "album", id: (item.data as SpotifyAlbum).id, name: (item.data as SpotifyAlbum).name });
    else if (item.type === "artist") onNavigate({ type: "artist", id: (item.data as SpotifyArtist).id, name: (item.data as SpotifyArtist).name });
    else if (item.type === "playlist") onNavigate({ type: "playlist", id: (item.data as SpotifyPlaylist).id, name: (item.data as SpotifyPlaylist).name });
  }, [playTrack, onNavigate]);

  const handleItemKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, item: SearchItem) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleItemClick(item);
    }
  }, [handleItemClick]);

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Search</h2>

      <div className="search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="What do you want to listen to?"
          aria-label="Search query"
        />
        <button onClick={handleSearch} aria-label="Search" className="search-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        </button>
      </div>

      {results && (
        <div className="filter-tabs" role="tablist" aria-label="Search filters">
          {filters.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={filter === f ? "filter-tab active" : "filter-tab"}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} aria-live="polite">Searching...</p>
      ) : (
        <div className="tracklist">
          {getItems().map((item, i) => (
            <div
              key={`${item.type}-${("id" in item.data ? item.data.id : i)}-${i}`}
              className="track"
              role="button"
              tabIndex={0}
              onClick={() => handleItemClick(item)}
              onKeyDown={(e) => handleItemKeyDown(e, item)}
              aria-label={`${item.data.name} - ${item.type === "track" ? (item.data as SpotifyTrack).artists?.map((a) => a.name).join(", ") : item.type}`}
            >
              <div className="track-num">{i + 1}</div>
              <div className="track-art" style={{
                background: ("images" in item.data && item.data.images?.[0]?.url) || ("album" in item.data && (item.data as SpotifyTrack).album?.images?.[0]?.url)
                  ? `url(${(("images" in item.data && item.data.images?.[0]?.url) ? (item.data as SpotifyTrack | SpotifyArtist).images?.[0]?.url : (item.data as SpotifyTrack).album?.images?.[0]?.url)}) center/cover`
                  : undefined
              }} />
              <div className="track-info">
                <div className="track-title">{item.data.name}</div>
                <div className="track-album">
                  {item.type === "track" ? (item.data as SpotifyTrack).artists?.map((a) => a.name).join(", ") : item.type.toUpperCase()}
                </div>
              </div>
              <div />
              <div />
              <div className="track-dur" />
            </div>
          ))}
          {getItems().length === 0 && results && (
            <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} role="status">No results</p>
          )}
        </div>
      )}
    </div>
  );
}
