import { useState } from "preact/compat";
import { formatTime, formatFollowers } from "../lib/utils";
import { playUris } from "../lib/spotify";
import { IconFlame, IconPlay } from "./icons";
import type { SpotifyArtist } from "../types";

interface Track {
  id: string;
  name: string;
  uri?: string;
  duration_ms: number;
  album?: {
    name?: string;
    images?: { url: string }[];
  };
}

interface ArtistTopSongsProps {
  artist: SpotifyArtist | null;
  topTracks: Track[];
  tags: string[];
}

export default function ArtistTopSongs({
  artist,
  topTracks,
  tags,
}: ArtistTopSongsProps) {
  if (!topTracks.length) return null;

  const artistName = artist?.name || "Unknown Artist";
  const artistImage = artist?.images?.[0]?.url;
  const followerCount = artist?.followers?.total ?? 0;
  const popularity = artist?.popularity;

  return (
    <div
      style={{
        background: "var(--glass)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--edge)",
        marginTop: 24,
        overflow: "hidden",
      }}
    >
      <ArtistHeader
        name={artistName}
        image={artistImage}
        followers={followerCount}
        popularity={popularity}
        tags={tags}
      />

      <div style={{ padding: "8px 16px" }}>
        {topTracks.map((track, i) => (
          <SongRow key={track.id} track={track} index={i} />
        ))}
      </div>
    </div>
  );
}

function ArtistHeader({
  name,
  image,
  followers,
  popularity,
  tags,
}: {
  name: string;
  image?: string;
  followers: number;
  popularity?: number;
  tags: string[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "48px 1fr",
        alignItems: "center",
        gap: 12,
        padding: "12px 20px 12px 16px",
        borderBottom: "1px solid var(--edge)",
      }}
    >
      <img
        src={image}
        alt={name}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--fg)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{name}</span>
          {popularity != null && <PopularityBadge value={popularity} />}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--fg-muted)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 2,
            flexWrap: "wrap",
          }}
        >
          <span>{formatFollowers(followers)} followers</span>
          {tags.length > 0 && (
            <>
              <span style={{ color: "var(--fg-faint)" }}>·</span>
              <span style={{ color: "var(--accent)" }}>{tags.slice(0, 2).join(", ")}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PopularityBadge({ value }: { value: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "1px 5px",
        borderRadius: 9999,
        background: "oklch(72% 0.17 145 / 0.12)",
        border: "1px solid oklch(72% 0.17 145 / 0.2)",
        fontSize: 10,
        color: "var(--accent)",
        fontWeight: 600,
        cursor: "default",
        flexShrink: 0,
      }}
    >
      <IconFlame size={8} />
      {value}/100
    </span>
  );
}

function SongRow({ track, index }: { track: Track; index: number }) {
  const handleClick = () => {
    if (track.uri) playUris([track.uri]);
  };

  const handlePlay = (e: Event) => {
    e.stopPropagation();
    if (track.uri) playUris([track.uri]);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "36px 40px 1fr auto 44px",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.background = "oklch(100% 0 0 / 0.04)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.background = "transparent")
      }
      onClick={handleClick}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--fg-faint)",
          textAlign: "center",
          fontFamily: "var(--font-mono)",
        }}
      >
        {index + 1}
      </div>

      <AlbumArtwork image={track.album?.images?.[0]?.url} />

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--fg)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {track.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-faint)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {track.album?.name}
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          color: "var(--fg-faint)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {formatTime(track.duration_ms)}
      </div>

      <PlayButton onClick={handlePlay} />
    </div>
  );
}

function AlbumArtwork({ image }: { image?: string }) {
  return (
    <div style={{ width: 40, height: 40, borderRadius: 4, overflow: "hidden" }}>
      {image ? (
        <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: "var(--bg-elevated)" }} />
      )}
    </div>
  );
}

function PlayButton({ onClick }: { onClick: (e: Event) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: hovered ? "var(--accent)" : "oklch(100% 0 0 / 0.06)",
        border: "none",
        color: hovered ? "#000" : "var(--fg-dim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.15s, background 0.15s, color 0.15s",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <IconPlay size={12} />
    </button>
  );
}


