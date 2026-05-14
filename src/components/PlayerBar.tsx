import type { CSSProperties } from "preact/compat";
import type { TrackInfo } from "../App";
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
  onTransferPlayback: () => void;
  onRefreshLocalDevices: () => void;
  onTransferToLocalDevice: (name: string) => void | Promise<void>;
  onMuteToggle: () => void;
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
  onTransferPlayback,
  onRefreshLocalDevices,
  onTransferToLocalDevice,
  onMuteToggle,
}: PlayerBarProps) {
  const progressPct = track && duration > 0 ? (progress / duration) * 100 : 0;

  const handleSeek = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    onSeek(pct * duration);
  };

  const handleVolumeClick = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const vol = Math.round((x / rect.width) * 100);
    onVolumeChange(Math.max(0, Math.min(100, vol)));
  };

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
          <button className="ctrl-btn" onClick={onShuffle} title="Shuffle" aria-label="Shuffle" role="button" tabIndex={0}>
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
          <button className="ctrl-btn" onClick={onRepeat} title="Repeat" aria-label={`Repeat: ${repeat}`} role="button" tabIndex={0}>
            <IconRepeat mode={repeat} />
          </button>
        </div>
        <div className="scrubber">
          <span className="time current">{formatTime(progress)}</span>
          <div
            className="progress-track"
            onClick={handleSeek}
            role="slider"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress"
            tabIndex={0}
            style={{ "--progress-width": `${progressPct}%`, "--progress-left": `${progressPct}%` } as CSSProperties}
          >
            <div className="progress-fill" />
            <div className="progress-thumb" />
          </div>
          <span className="time total">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <DeviceSelector
          onTransfer={onTransferPlayback}
          onRefreshLocal={onRefreshLocalDevices}
          onTransferLocal={onTransferToLocalDevice}
        />
        <button className="ctrl-btn" aria-label="Volume" role="button" tabIndex={0} onClick={onMuteToggle}>
          <IconVolume muted={volume === 0} />
        </button>
        <div
          className="volume-track"
          onClick={handleVolumeClick}
          role="slider"
          aria-valuenow={volume}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Volume"
          tabIndex={0}
          style={{ "--volume-width": `${volume}%` } as CSSProperties}
        >
          <div className="volume-fill" />
        </div>
      </div>
    </div>
  );
}
