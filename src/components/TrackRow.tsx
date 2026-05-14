import type { ComponentChildren } from 'preact';

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
      className="track"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel || `${name}${artists ? ` by ${artists}` : ''}`}
    >
      {showIndex && index !== undefined && <div className="track-num">{index + 1}</div>}
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
