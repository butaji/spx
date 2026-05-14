import { useState } from "preact/compat";
import { formatTime, formatFollowers } from "../lib/utils";
import { playUris } from "../lib/spotify";
import { IconFlame, IconPlay } from "./icons";
import type { SpotifyArtist } from "../types";
import { Artwork } from "./Artwork";

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
    <div className="artist-panel">
      <ArtistHeader
        name={artistName}
        image={artistImage}
        followers={followerCount}
        popularity={popularity}
        tags={tags}
      />

      <div className="artist-tracks">
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
    <div className="artist-header">
      <Artwork
        src={image}
        alt={name}
        size={160}
        className="artist-header-image"
      />

      <div className="artist-header-info">
        <div className="artist-header-name">
          <span>{name}</span>
          {popularity != null && <PopularityBadge value={popularity} />}
        </div>

        <div className="artist-header-meta">
          <span>{formatFollowers(followers)} followers</span>
          {tags.length > 0 && (
            <>
              <span className="artist-header-meta-sep">·</span>
              <span className="artist-header-meta-genre">{tags.slice(0, 2).join(", ")}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PopularityBadge({ value }: { value: number }) {
  return (
    <span className="popularity-badge">
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
      className="song-row"
      onClick={handleClick}
    >
      <div className="song-row-index">
        {index + 1}
      </div>

      <AlbumArtwork image={track.album?.images?.[0]?.url} />

      <div className="song-row-info">
        <div className="song-row-title">
          {track.name}
        </div>
        <div className="song-row-album">
          {track.album?.name}
        </div>
      </div>

      <div className="song-row-duration">
        {formatTime(track.duration_ms)}
      </div>

      <PlayButton onClick={handlePlay} />
    </div>
  );
}

function AlbumArtwork({ image }: { image?: string }) {
  return (
    <div className="song-row-art">
      <Artwork src={image} alt="" size={40} className="song-row-art-img" />
    </div>
  );
}

function PlayButton({ onClick }: { onClick: (e: Event) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      className="song-play-btn"
      style={{
        background: hovered ? "var(--accent)" : undefined,
        color: hovered ? "#000" : undefined,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <IconPlay size={12} />
    </button>
  );
}
