import type { CSSProperties } from "preact/compat";
import { useState, useEffect, useCallback, memo } from "preact/compat";
import type { TrackInfo } from "../types";
import DeviceSelector from "./DeviceSelector";
import {
  IconHeart,
  IconPlay,
  IconPause,
  IconPrev,
  IconNext,
  IconVolume,
  IconShuffle,
  IconRepeat,
} from "./icons";
import { formatTime } from "../lib/utils";

interface PlayerBarProps {
  track: TrackInfo | null;
  isPlaying: boolean;
  likedTrack: boolean;
  shuffle: boolean;
  repeat: string;
  progress: number;
  duration: number;
  volume: number;
  isPlayActionLoading: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (ms: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleLike: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onRefreshLocalDevices: () => void;
  onMuteToggle: () => void;
}

function PlayerBarComponent({
  track,
  isPlaying,
  likedTrack,
  shuffle,
  repeat,
  progress,
  duration,
  volume,
  isPlayActionLoading,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleLike,
  onShuffle,
  onRepeat,
  onRefreshLocalDevices,
  onMuteToggle,
}: PlayerBarProps) {
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const [dragVolume, setDragVolume] = useState<number | null>(null);
  const [showVolumeTooltip, setShowVolumeTooltip] = useState(false);

  const getPctFromMouse = useCallback((e: MouseEvent, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }, []);

  // Seek drag handlers
  const handleSeekMouseDown = useCallback((e: MouseEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    const pct = getPctFromMouse(e, target);
    setDragProgress(pct * duration);
    setIsDraggingSeek(true);
  }, [duration, getPctFromMouse]);

  useEffect(() => {
    if (!isDraggingSeek) return;
    const handleMove = (e: MouseEvent) => {
      const el = document.querySelector('.progress-track') as HTMLDivElement;
      if (!el) return;
      const pct = getPctFromMouse(e, el);
      setDragProgress(pct * duration);
    };
    const handleUp = () => {
      if (dragProgress !== null) {
        onSeek(dragProgress);
      }
      setIsDraggingSeek(false);
      setDragProgress(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingSeek, duration, getPctFromMouse]);

  // Volume drag handlers
  const handleVolumeMouseDown = useCallback((e: MouseEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    const pct = getPctFromMouse(e, target);
    const vol = Math.round(pct * 100);
    setDragVolume(vol);
    setIsDraggingVolume(true);
    onVolumeChange(Math.max(0, Math.min(100, vol)));
  }, [getPctFromMouse, onVolumeChange]);

  useEffect(() => {
    if (!isDraggingVolume) return;
    const handleMove = (e: MouseEvent) => {
      const el = document.querySelector('.volume-track') as HTMLDivElement;
      if (!el) return;
      const pct = getPctFromMouse(e, el);
      const vol = Math.round(pct * 100);
      setDragVolume(Math.max(0, Math.min(100, vol)));
    };
    const handleUp = () => {
      if (dragVolume !== null) {
        onVolumeChange(dragVolume);
      }
      setIsDraggingVolume(false);
      setDragVolume(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingVolume, dragVolume, getPctFromMouse, onVolumeChange]);

  const displayProgress = isDraggingSeek && dragProgress !== null ? dragProgress : progress;
  const displayProgressPct = track && duration > 0 ? (displayProgress / duration) * 100 : 0;
  const displayVolume = isDraggingVolume && dragVolume !== null ? dragVolume : volume;

  return (
    <div className="player-bar">
      <div className="player-track">
        <div className="player-art">
          {track?.imageUrl ? <img src={track.imageUrl} alt="" /> : null}
        </div>
        <div className="player-meta">
          <div className="player-title">{track?.name || "No track"}</div>
          <div className="player-artist">{track?.artist || "—"}</div>
        </div>
        <button
          className={likedTrack ? "player-like-btn liked" : "player-like-btn"}
          onClick={onToggleLike}
          aria-label={likedTrack ? "Remove from liked" : "Add to liked"}
          role="button"
          tabIndex={0}
        >
          <IconHeart filled={likedTrack} />
        </button>
      </div>

      <div className="player-center">
        <div className="player-controls" role="group" aria-label="Playback controls">
          <button className={`ctrl-btn ${shuffle ? "active" : ""}`} onClick={onShuffle} title="Shuffle" aria-label="Shuffle" role="button" tabIndex={0}>
            <IconShuffle active={shuffle} />
          </button>
          <button className="ctrl-btn" onClick={onPrev} aria-label="Previous track" role="button" tabIndex={0}>
            <IconPrev />
          </button>
          <button
            className={`ctrl-btn ${isPlaying ? "playing" : ""}`}
            onClick={onPlayPause}
            disabled={isPlayActionLoading}
          >
            {isPlayActionLoading ? (
              <span className="spinner-small" />
            ) : isPlaying ? (
              <IconPause />
            ) : (
              <IconPlay />
            )}
          </button>
          <button className="ctrl-btn" onClick={onNext} aria-label="Next track" role="button" tabIndex={0}>
            <IconNext />
          </button>
          <button className={`ctrl-btn ${repeat !== "off" ? "active" : ""}`} onClick={onRepeat} title="Repeat" aria-label={`Repeat: ${repeat}`} role="button" tabIndex={0}>
            <IconRepeat mode={repeat} />
          </button>
        </div>
        <div className="scrubber">
          <span className="time current">{formatTime(displayProgress)}</span>
          <div
            className="progress-track"
            onMouseDown={handleSeekMouseDown}
            role="slider"
            aria-valuenow={Math.round(displayProgressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress"
            tabIndex={0}
            style={{ "--progress-width": `${displayProgressPct}%`, "--progress-left": `${displayProgressPct}%` } as CSSProperties}
          >
            <div className="progress-fill" />
            <div className="progress-thumb" />
          </div>
          <span className="time total">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <DeviceSelector
          onRefreshLocal={onRefreshLocalDevices}
        />
        <button className="ctrl-btn" aria-label="Volume" role="button" tabIndex={0} onClick={onMuteToggle}>
          <IconVolume muted={volume === 0} />
        </button>
        
        {/* IMPROVEMENT #4: Enhanced volume slider with tooltip */}
        <div
          className="volume-track"
          onMouseDown={handleVolumeMouseDown}
          onMouseEnter={() => setShowVolumeTooltip(true)}
          onMouseLeave={() => setShowVolumeTooltip(false)}
          role="slider"
          aria-valuenow={displayVolume}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Volume"
          tabIndex={0}
          style={{ "--volume-width": `${displayVolume}%` } as CSSProperties}
        >
          <div className="volume-fill" />
          {/* Volume tooltip */}
          <div className="volume-tooltip-container">
            {showVolumeTooltip && (
              <div className="volume-tooltip">{displayVolume}%</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const PlayerBar = memo(PlayerBarComponent);
export default PlayerBar;
