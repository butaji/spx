import { useEffect, useState } from "preact/hooks";
import { contextPanelItem } from "../stores/spotify";
import {
  getArtist,
  getArtistTopTracks,
  getArtistRelatedArtists,
  getAlbum,
  getPlaylist,
} from "../lib/spotify";

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  onClose: () => void;
  onPlayUris?: (uris: string[], offset?: number) => void;
  onNavigate?: (view: { type: "artist"; id: string; name: string } | { type: "album"; id: string; name: string } | { type: "playlist"; id: string; name: string }) => void;
}

export default function ContextPanel({ onClose, onPlayUris, onNavigate }: Props) {
  const item = contextPanelItem.value;
  const [data, setData] = useState<any>(null);
  const [topTracks, setTopTracks] = useState<any[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    setData(null);
    setTopTracks([]);
    setRelatedArtists([]);

    const itemId = item.id;
    const itemType = item.type;

    async function load() {
      try {
        if (itemType === "artist") {
          const [artist, tracks, related] = await Promise.all([
            getArtist(itemId),
            getArtistTopTracks(itemId),
            getArtistRelatedArtists(itemId),
          ]);
          setData(artist);
          setTopTracks(tracks?.tracks?.slice(0, 5) ?? []);
          setRelatedArtists(related?.artists?.slice(0, 6) ?? []);
        } else if (itemType === "album") {
          const album = await getAlbum(itemId);
          setData(album);
        } else if (itemType === "playlist") {
          const playlist = await getPlaylist(itemId);
          setData(playlist);
        }
      } catch (e) {
        console.warn("ContextPanel failed to load:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [item?.id, item?.type]);

  if (!item) return null;

  return (
    <div className="context-panel">
      <div className="context-panel-header">
        <span className="context-panel-title">
          {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
        </span>
        <button className="context-panel-close" onClick={onClose} title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="context-panel-content">
        {loading && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--fg-muted)" }}>
            <span className="spinner-small" style={{ display: "inline-block" }} />
          </div>
        )}

        {!loading && data && item.type === "artist" && (
          <ArtistContext data={data} topTracks={topTracks} relatedArtists={relatedArtists} onNavigate={onNavigate} onPlayUris={onPlayUris} />
        )}

        {!loading && data && item.type === "album" && (
          <AlbumContext data={data} />
        )}

        {!loading && data && item.type === "playlist" && (
          <PlaylistContext data={data} />
        )}

        {!loading && !data && (
          <p style={{ color: "var(--fg-muted)", fontSize: "13px", textAlign: "center", padding: "16px 0" }}>
            No data available
          </p>
        )}
      </div>
    </div>
  );
}

function ArtistContext({ data, topTracks, relatedArtists, onNavigate, onPlayUris }: {
  data: any;
  topTracks: any[];
  relatedArtists: any[];
  onNavigate?: Props["onNavigate"];
  onPlayUris?: Props["onPlayUris"];
}) {
  const image = data.images?.[0]?.url;
  const followers = data.followers?.total ?? 0;
  const genres = data.genres?.slice(0, 5) ?? [];

  return (
    <>
      <div className="context-artist-header">
        {image ? (
          <img src={image} alt={data.name} className="context-artist-image" />
        ) : (
          <div className="context-artist-image" style={{ background: "var(--surface)" }} />
        )}
        <div className="context-artist-name">{data.name}</div>
        <div className="context-artist-followers">{formatFollowers(followers)} followers</div>
      </div>

      {genres.length > 0 && (
        <div>
          <div className="context-section-title">Genres</div>
          <div className="context-tags">
            {genres.map((g: string) => (
              <span key={g} className="context-tag">{g}</span>
            ))}
          </div>
        </div>
      )}

      {relatedArtists.length > 0 && (
        <div>
          <div className="context-section-title">Similar Artists</div>
          <div className="context-similar-list">
            {relatedArtists.map((a: any) => (
              <div
                key={a.id}
                className="context-similar-item"
                onClick={() => onNavigate?.({ type: "artist", id: a.id, name: a.name })}
              >
                {a.images?.[0]?.url ? (
                  <img src={a.images[0].url} alt={a.name} className="context-similar-image" />
                ) : (
                  <div className="context-similar-image" style={{ background: "var(--surface)" }} />
                )}
                <span className="context-similar-name">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topTracks.length > 0 && (
        <div>
          <div className="context-section-title">Top Tracks</div>
          <div>
            {topTracks.map((t: any, i: number) => (
              <div
                key={t.id}
                className="context-mini-track"
                onClick={() => onPlayUris?.([t.uri], i)}
              >
                <span style={{ fontSize: "11px", color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                  {i + 1}
                </span>
                <span className="context-mini-track-name">{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function AlbumContext({ data }: { data: any }) {
  const image = data.images?.[0]?.url;
  const year = data.release_date?.split("-")[0] ?? "";
  const tracks = data.tracks?.items ?? [];

  return (
    <>
      <div className="context-artist-header">
        {image ? (
          <img src={image} alt={data.name} className="context-artist-image" style={{ borderRadius: "var(--radius-md)" }} />
        ) : (
          <div className="context-artist-image" style={{ background: "var(--surface)", borderRadius: "var(--radius-md)" }} />
        )}
        <div className="context-artist-name">{data.name}</div>
        <div className="context-artist-followers">
          {data.artists?.map((a: any) => a.name).join(", ")} &middot; {year}
        </div>
      </div>

      <div>
        <div className="context-section-title">{tracks.length} Tracks</div>
        <div>
          {tracks.slice(0, 8).map((t: any, i: number) => (
            <div key={t.id} className="context-mini-track">
              <span style={{ fontSize: "11px", color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                {i + 1}
              </span>
              <span className="context-mini-track-name">{t.name}</span>
              <span style={{ fontSize: "10px", color: "var(--fg-faint)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>
                {formatDuration(t.duration_ms)}
              </span>
            </div>
          ))}
          {tracks.length > 8 && (
            <div style={{ fontSize: "11px", color: "var(--fg-muted)", padding: "4px 0", textAlign: "center" }}>
              +{tracks.length - 8} more tracks
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function PlaylistContext({ data }: { data: any }) {
  const image = data.images?.[0]?.url;
  const trackCount = data.tracks?.total ?? 0;
  const owner = data.owner?.display_name ?? "Unknown";

  return (
    <>
      <div className="context-artist-header">
        {image ? (
          <img src={image} alt={data.name} className="context-artist-image" style={{ borderRadius: "var(--radius-md)" }} />
        ) : (
          <div className="context-artist-image" style={{ background: "var(--surface)", borderRadius: "var(--radius-md)" }} />
        )}
        <div className="context-artist-name">{data.name}</div>
        <div className="context-artist-followers">by {owner}</div>
      </div>

      {data.description && (
        <div>
          <div className="context-section-title">About</div>
          <p style={{ fontSize: "12px", color: "var(--fg-secondary)", lineHeight: "1.5" }}
            dangerouslySetInnerHTML={{ __html: data.description }}
          />
        </div>
      )}

      <div>
        <div className="context-section-title">{trackCount} Tracks</div>
      </div>
    </>
  );
}
