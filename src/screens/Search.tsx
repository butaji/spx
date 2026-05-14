import { useState, useEffect, useCallback } from "preact/compat";
import type { KeyboardEvent } from "preact/compat";
import { search } from "../lib/spotify";
import { View } from "../App";
import { SpotifyTrack, SpotifyAlbum, SpotifyArtist, SpotifyPlaylist, SpotifySearchResults } from "../types";
import { formatTime } from "../lib/utils";

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
    else if (item.type === "album") {
      const id = (item.data as SpotifyAlbum).id;
      if (id) onNavigate({ type: "album", id, name: (item.data as SpotifyAlbum).name ?? "" });
    }
    else if (item.type === "artist") {
      const id = (item.data as SpotifyArtist).id;
      if (id) onNavigate({ type: "artist", id, name: (item.data as SpotifyArtist).name ?? "" });
    }
    else if (item.type === "playlist") {
      const id = (item.data as SpotifyPlaylist).id;
      if (id) onNavigate({ type: "playlist", id, name: (item.data as SpotifyPlaylist).name ?? "" });
    }
  }, [playTrack, onNavigate]);

  const handleItemKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, item: SearchItem) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleItemClick(item);
    }
  }, [handleItemClick]);

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Search</h1>

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
      ) : results ? (
        <>
          {filter === "all" ? (
            <>
              {(results.tracks?.items || []).length > 0 && (
                <section style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--fg)" }}>Tracks</h2>
                  <div className="tracklist">
                    {(results.tracks?.items || []).map((track, i) => (
                      <div
                        key={track.id}
                        className="track"
                        role="button"
                        tabIndex={0}
                        onClick={() => playTrack(track)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playTrack(track); } }}
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
                </section>
              )}

              {(results.albums?.items || []).length > 0 && (
                <section style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--fg)" }}>Albums</h2>
                  <div className="lib-grid">
                    {(results.albums?.items || []).map((album) => (
                      <div
                        key={album.id}
                        className="lib-item"
                        role="button"
                        tabIndex={0}
                        onClick={() => album.id && onNavigate({ type: "album", id: album.id, name: album.name ?? "" })}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (album.id) onNavigate({ type: "album", id: album.id, name: album.name ?? "" }); } }}
                        aria-label={`${album.name} - Album`}
                      >
                        <div className="lib-item-img" style={{
                          background: album.images?.[0]?.url ? `url(${album.images[0].url}) center/cover` : undefined
                        }} />
                        <div className="lib-item-title">{album.name}</div>
                        <div className="lib-item-sub">{album.artists?.map((a) => a.name).join(", ")}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(results.artists?.items || []).length > 0 && (
                <section style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--fg)" }}>Artists</h2>
                  <div className="lib-grid">
                    {(results.artists?.items || []).map((artist) => (
                      <div
                        key={artist.id}
                        className="lib-item"
                        role="button"
                        tabIndex={0}
                        onClick={() => artist.id && onNavigate({ type: "artist", id: artist.id, name: artist.name ?? "" })}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (artist.id) onNavigate({ type: "artist", id: artist.id, name: artist.name ?? "" }); } }}
                        aria-label={`${artist.name} - Artist`}
                      >
                        <div className="lib-item-img" style={{
                          background: artist.images?.[0]?.url ? `url(${artist.images[0].url}) center/cover` : undefined
                        }} />
                        <div className="lib-item-title">{artist.name}</div>
                        <div className="lib-item-sub">Artist</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(results.playlists?.items || []).length > 0 && (
                <section style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--fg)" }}>Playlists</h2>
                  <div className="lib-grid">
                    {(results.playlists?.items || []).map((playlist) => (
                      <div
                        key={playlist.id}
                        className="lib-item"
                        role="button"
                        tabIndex={0}
                        onClick={() => playlist.id && onNavigate({ type: "playlist", id: playlist.id, name: playlist.name ?? "" })}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (playlist.id) onNavigate({ type: "playlist", id: playlist.id, name: playlist.name ?? "" }); } }}
                        aria-label={`${playlist.name} - Playlist`}
                      >
                        <div className="lib-item-img" style={{
                          background: playlist.images?.[0]?.url ? `url(${playlist.images[0].url}) center/cover` : undefined
                        }} />
                        <div className="lib-item-title">{playlist.name}</div>
                        <div className="lib-item-sub">Playlist</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {getItems().length === 0 && (
                <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} role="status">No results</p>
              )}
            </>
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
              {getItems().length === 0 && (
                <p className="text-sm text-muted" style={{ textAlign: "center", padding: 30 }} role="status">No results</p>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
