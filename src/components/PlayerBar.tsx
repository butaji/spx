import type { CSSProperties } from "preact/compat";
import { useState, useEffect, useCallback } from "preact/compat";
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
import { activeDevice } from "../stores/devices";

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

// Helper to get device icon SVG
function DeviceIconSmall({ type, className }: { type: string; className?: string }) {
  const iconClass = className || "remote-device-icon";
  switch (type?.toLowerCase()) {
    case "computer":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case "smartphone":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      );
    case "speaker":
    case "cast_audio":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
      );
    case "tv":
    case "cast_video":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case "avr":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-3.39 0l-1.32-.377a2.25 2.25 0 01-1.632-2.163v-3.75z" />
          <path d="M19.5 10.5c0 .466-.164.9-.442 1.237l-1.32 1.598a2.25 2.25 0 01-3.336 0l-1.32-1.598A1.875 1.875 0 0112.75 10.5h6.75z" />
        </svg>
      );
  }
}

export function PlayerBar({
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

  // Get remote device info
  const remoteDevice = activeDevice.value;
  const isPlayingRemotely = remoteDevice && remoteDevice.id !== 'spx-player';

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
      {/* Remote Device Banner - IMPROVEMENT #1: Show when playing remotely */}
      {isPlayingRemotely && remoteDevice && (
        <div className="remote-device-banner">
          <DeviceIconSmall type={remoteDevice.type || ""} className="remote-device-icon" />
          <span>Playing on {remoteDevice.name}</span>
        </div>
      )}

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
