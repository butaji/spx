import type { ComponentChildren } from 'preact';
import { IconPlay, IconPause } from './icons';

interface TrackRowProps {
  index?: number;
  name: string;
  album?: string;
  artists?: string;
  durationMs?: number;
  imageUrl?: string;
  onClick?: () => void;
  onKeyDown?: (e: any) => void;
  ariaLabel?: string;
  children?: ComponentChildren;
  showIndex?: boolean;
  showArt?: boolean;
  showAlbum?: boolean;
  showDuration?: boolean;
  extraColumns?: ComponentChildren[];
  /** Whether this row represents the currently loaded track. */
  isActive?: boolean;
  /** Whether playback is currently active (only meaningful when isActive is true). */
  isPlaying?: boolean;
  /** Whether a play action for this track is in progress. */
  isLoading?: boolean;
}

function TrackStatus({
  isActive,
  isPlaying,
  isLoading,
}: {
  isActive?: boolean;
  isPlaying?: boolean;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <span className="track-status-spinner" aria-hidden="true" />;
  }

  if (isActive && isPlaying) {
    return (
      <span className="track-equalizer" aria-label="Playing">
        <span />
        <span />
        <span />
      </span>
    );
  }

  if (isActive && !isPlaying) {
    return <IconPause size={14} className="track-status-icon track-status-pause" />;
  }

  return <IconPlay size={14} className="track-status-icon track-status-play" />;
}

export function TrackRow({
  index,
  name,
  album,
  artists,
  durationMs,
  imageUrl,
  onClick,
  onKeyDown,
  ariaLabel,
  children,
  showIndex = true,
  showArt = true,
  showAlbum = true,
  showDuration = true,
  extraColumns = [],
  isActive = false,
  isPlaying = false,
  isLoading = false,
}: TrackRowProps) {
  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const secsRem = secs % 60;
    return `${mins}:${secsRem.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`track ${isActive ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel || `${name}${artists ? ` by ${artists}` : ''}`}
      aria-current={isActive ? 'true' : undefined}
    >
      {showIndex && index !== undefined && (
        <div className="track-num">
          <span className="track-index">{index + 1}</span>
          <TrackStatus isActive={isActive} isPlaying={isPlaying} isLoading={isLoading} />
        </div>
      )}
      {showArt && imageUrl && (
        <div className="track-art" style={{ background: `url(${imageUrl}) center/cover` }} />
      )}
      <div className="track-info">
        <div className="track-title">{name}</div>
        {showAlbum && (album || artists) && (
          <div className="track-album">{album || artists}</div>
        )}
      </div>
      {extraColumns.map((col, i) => <div key={i}>{col}</div>)}
      {showDuration && durationMs !== undefined && (
        <div className="track-dur">{formatDuration(durationMs)}</div>
      )}
      {children}
    </div>
  );
}
