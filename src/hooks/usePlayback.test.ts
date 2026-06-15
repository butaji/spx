import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { h } from 'preact';
import type { SpotifyTrack } from '../types';

// ─── Mock dependencies before importing the hook ──────────────────────────────

vi.mock('../lib/utils', () => ({
  debug: vi.fn(),
}));

vi.mock('../lib/spotify', () => ({
  setShuffle: vi.fn(),
  setRepeat: vi.fn(),
  playContext: vi.fn(),
  playUris: vi.fn(),
  saveTracks: vi.fn(),
  removeSavedTracks: vi.fn(),
}));

vi.mock('../lib/playerController', () => ({
  controllerNext: vi.fn(),
  controllerPrevious: vi.fn(),
  controllerSeek: vi.fn(),
  controllerSetVolume: vi.fn(),
}));

vi.mock('../stores/playCounts', () => ({
  recordPlay: vi.fn(),
}));

vi.mock('../lib/errors', () => ({
  handleError: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../stores/spotify', async () => {
  const { signal } = await import('@preact/signals');
  return {
    playbackTrack: signal<SpotifyTrack | null>(null),
    playbackVolume: signal<number>(100),
    playbackShuffle: signal<boolean>(false),
    playbackRepeat: signal<'off' | 'context' | 'track'>('off'),
    isPlaying: signal<boolean>(false),
    likedTrack: signal<boolean>(false),
    refreshPlayback: vi.fn(),
    refreshLikedStatus: vi.fn(),
    playTrack: vi.fn(),
    pauseTrack: vi.fn(),
    startPlaybackPolling: vi.fn(() => () => {}),
  };
});

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { usePlayback } from './usePlayback';
import {
  playbackTrack,
  playbackVolume,
  playbackShuffle,
  playbackRepeat,
  isPlaying,
  likedTrack,
  refreshPlayback,
  refreshLikedStatus,
  playTrack as storePlayTrack,
  pauseTrack as storePauseTrack,
  startPlaybackPolling,
} from '../stores/spotify';
import {
  setShuffle as apiSetShuffle,
  setRepeat as apiSetRepeat,
  playContext as apiPlayContext,
  playUris as apiPlayUris,
  saveTracks as apiSaveTracks,
  removeSavedTracks as apiRemoveSavedTracks,
} from '../lib/spotify';
import {
  controllerNext,
  controllerPrevious,
  controllerSeek,
  controllerSetVolume,
} from '../lib/playerController';
import { recordPlay } from '../stores/playCounts';
import { handleError, showError } from '../lib/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type UsePlaybackResult = ReturnType<typeof usePlayback>;

function createHarness(resultRef: { current: UsePlaybackResult | null }) {
  return function Harness({
    ensureActiveDevice,
  }: {
    ensureActiveDevice: () => Promise<string | null>;
  }) {
    resultRef.current = usePlayback({ ensureActiveDevice });
    return null;
  };
}

let lastContainer: HTMLElement | null = null;

async function renderHook(ensureActiveDevice: () => Promise<string | null>) {
  const resultRef: { current: UsePlaybackResult | null } = { current: null };
  const Harness = createHarness(resultRef);
  const container = document.createElement('div');
  document.body.appendChild(container);
  lastContainer = container;
  await act(() => render(h(Harness, { ensureActiveDevice }), container));
  if (!resultRef.current) {
    throw new Error('usePlayback did not return a result');
  }
  return { result: resultRef.current, container };
}

function makeTrack(overrides: Partial<SpotifyTrack> = {}): SpotifyTrack {
  return {
    id: 'track-1',
    name: 'Test Track',
    uri: 'spotify:track:1',
    duration_ms: 180_000,
    artists: [{ id: 'artist-1', name: 'Test Artist' }],
    album: { id: 'album-1', name: 'Test Album', images: [{ url: 'img.jpg' }] },
    ...overrides,
  };
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });

  // Reset mock signals
  playbackTrack.value = null;
  playbackVolume.value = 100;
  playbackShuffle.value = false;
  playbackRepeat.value = 'off';
  isPlaying.value = false;
  likedTrack.value = false;
});

afterEach(() => {
  if (lastContainer) {
    render(null, lastContainer);
    lastContainer.remove();
    lastContainer = null;
  }
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Initialization
// ═══════════════════════════════════════════════════════════════════════════════

describe('initialization', () => {
  it('starts playback polling on mount', async () => {
    await renderHook(async () => 'device-123');
    expect(startPlaybackPolling).toHaveBeenCalledTimes(1);
  });

  it('stops playback polling on unmount', async () => {
    const cleanup = vi.fn();
    (startPlaybackPolling as ReturnType<typeof vi.fn>).mockReturnValue(cleanup);

    const { container } = await renderHook(async () => 'device-123');
    expect(startPlaybackPolling).toHaveBeenCalledTimes(1);

    await act(() => render(null, container));
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('refreshes liked status when a track is present', async () => {
    await renderHook(async () => 'device-123');
    playbackTrack.value = makeTrack({ id: 'liked-track' });

    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(refreshLikedStatus).toHaveBeenCalledWith('liked-track');
  });

  it('resets likedTrack when no track is present', async () => {
    likedTrack.value = true;
    playbackTrack.value = makeTrack();
    await renderHook(async () => 'device-123');

    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(likedTrack.value).toBe(true);

    playbackTrack.value = null;
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(likedTrack.value).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: handlePlayPause
// ═══════════════════════════════════════════════════════════════════════════════

describe('handlePlayPause', () => {
  it('pauses when currently playing', async () => {
    (storePauseTrack as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackTrack.value = makeTrack();
    isPlaying.value = true;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handlePlayPause());

    expect(isPlaying.value).toBe(false);
    expect(storePauseTrack).toHaveBeenCalledTimes(1);
  });

  it('plays when paused and a device is available', async () => {
    (storePlayTrack as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackTrack.value = makeTrack();
    isPlaying.value = false;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handlePlayPause());

    expect(isPlaying.value).toBe(true);
    expect(storePlayTrack).toHaveBeenCalledTimes(1);
  });

  it('shows an error and reverts optimism when no device is available', async () => {
    playbackTrack.value = makeTrack();
    isPlaying.value = false;

    const { result } = await renderHook(async () => null);
    await act(() => result.handlePlayPause());

    expect(isPlaying.value).toBe(false);
    expect(storePlayTrack).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith(
      'No Playback Device',
      expect.stringContaining("couldn't find a device"),
      expect.objectContaining({
        solution: expect.arrayContaining([expect.stringContaining('SPX Player')]),
      })
    );
  });

  it('ignores clicks while an action is already loading', async () => {
    playbackTrack.value = makeTrack();
    isPlaying.value = true;

    const { result } = await renderHook(async () => 'device-123');
    // Start first action but do not await so loading stays true
    act(() => result.handlePlayPause());
    // Second click should be ignored
    await act(() => result.handlePlayPause());

    expect(storePauseTrack).toHaveBeenCalledTimes(1);
  });

  it('reverts optimistic update on error', async () => {
    (storePlayTrack as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('play failed'));
    playbackTrack.value = makeTrack();
    isPlaying.value = false;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handlePlayPause());

    expect(isPlaying.value).toBe(false);
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'Play/Pause');
  });

  it('does not optimistically update isPlaying when no track is loaded', async () => {
    isPlaying.value = false;
    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handlePlayPause());

    expect(isPlaying.value).toBe(false);
    expect(storePlayTrack).toHaveBeenCalledTimes(1);
  });

  it('refreshes playback state 500ms after success', async () => {
    (storePauseTrack as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackTrack.value = makeTrack();
    isPlaying.value = true;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handlePlayPause());

    expect(refreshPlayback).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(refreshPlayback).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: handleNext / handlePrev
// ═══════════════════════════════════════════════════════════════════════════════

describe('handleNext', () => {
  it('skips to the next track when a device is available', async () => {
    (controllerNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { result } = await renderHook(async () => 'device-123');

    await act(() => result.handleNext());

    expect(controllerNext).toHaveBeenCalledTimes(1);
    expect(refreshPlayback).toHaveBeenCalledTimes(1);
  });

  it('shows an error when no device is available', async () => {
    const { result } = await renderHook(async () => null);
    await act(() => result.handleNext());

    expect(controllerNext).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith(
      'No Active Device',
      expect.stringContaining('SPX Player'),
      expect.objectContaining({ solution: expect.any(Array) })
    );
  });

  it('handles controller errors', async () => {
    (controllerNext as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('next failed'));
    const { result } = await renderHook(async () => 'device-123');

    await act(() => result.handleNext());

    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'Skip Next');
  });
});

describe('handlePrev', () => {
  it('goes to the previous track when a device is available', async () => {
    (controllerPrevious as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { result } = await renderHook(async () => 'device-123');

    await act(() => result.handlePrev());

    expect(controllerPrevious).toHaveBeenCalledTimes(1);
    expect(refreshPlayback).toHaveBeenCalledTimes(1);
  });

  it('shows an error when no device is available', async () => {
    const { result } = await renderHook(async () => null);
    await act(() => result.handlePrev());

    expect(controllerPrevious).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalled();
  });

  it('handles controller errors', async () => {
    (controllerPrevious as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('prev failed'));
    const { result } = await renderHook(async () => 'device-123');

    await act(() => result.handlePrev());

    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'Previous Track');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: handleSeekPosition
// ═══════════════════════════════════════════════════════════════════════════════

describe('handleSeekPosition', () => {
  it('seeks to the requested position', async () => {
    (controllerSeek as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { result } = await renderHook(async () => 'device-123');

    await act(() => result.handleSeekPosition(30_000));

    expect(controllerSeek).toHaveBeenCalledWith(30_000);
    expect(refreshPlayback).toHaveBeenCalledTimes(1);
  });

  it('handles seek errors', async () => {
    (controllerSeek as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('seek failed'));
    const { result } = await renderHook(async () => 'device-123');

    await act(() => result.handleSeekPosition(10_000));

    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'Seek');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: handleShuffle
// ═══════════════════════════════════════════════════════════════════════════════

describe('handleShuffle', () => {
  it('toggles shuffle optimistically and calls API after debounce', async () => {
    (apiSetShuffle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackShuffle.value = false;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleShuffle());

    expect(playbackShuffle.value).toBe(true);
    expect(apiSetShuffle).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(apiSetShuffle).toHaveBeenCalledWith(true);
  });

  it('cancels a pending shuffle call when toggled again', async () => {
    (apiSetShuffle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackShuffle.value = false;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleShuffle());
    expect(playbackShuffle.value).toBe(true);

    await act(() => result.handleShuffle());
    expect(playbackShuffle.value).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(apiSetShuffle).toHaveBeenCalledTimes(1);
    expect(apiSetShuffle).toHaveBeenLastCalledWith(false);
  });

  it('reverts shuffle on API error', async () => {
    (apiSetShuffle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('shuffle failed'));
    playbackShuffle.value = true;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleShuffle());
    expect(playbackShuffle.value).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(playbackShuffle.value).toBe(true);
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'Shuffle');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: handleRepeat
// ═══════════════════════════════════════════════════════════════════════════════

describe('handleRepeat', () => {
  it('cycles repeat mode off -> context -> track -> off', async () => {
    (apiSetRepeat as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { result } = await renderHook(async () => 'device-123');

    for (const expected of ['context', 'track', 'off'] as const) {
      playbackRepeat.value = expected === 'context' ? 'off' : expected === 'track' ? 'context' : 'track';
      await act(() => result.handleRepeat());
      await act(() => vi.advanceTimersByTimeAsync(300));
      expect(apiSetRepeat).toHaveBeenLastCalledWith(expected);
    }
  });

  it('debounces repeat API calls', async () => {
    (apiSetRepeat as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackRepeat.value = 'off';

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleRepeat());
    await act(() => result.handleRepeat());

    expect(apiSetRepeat).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(apiSetRepeat).toHaveBeenCalledTimes(1);
  });

  it('reverts repeat on API error', async () => {
    (apiSetRepeat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('repeat failed'));
    playbackRepeat.value = 'off';

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleRepeat());
    expect(playbackRepeat.value).toBe('context');

    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(playbackRepeat.value).toBe('off');
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'Repeat');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Volume controls
// ═══════════════════════════════════════════════════════════════════════════════

describe('handleMuteToggle', () => {
  it('mutes when volume is above zero', async () => {
    (controllerSetVolume as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackVolume.value = 50;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleMuteToggle());

    expect(controllerSetVolume).toHaveBeenCalledWith(0);
    expect(playbackVolume.value).toBe(0);
  });

  it('unmutes to 74 when volume is zero', async () => {
    (controllerSetVolume as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackVolume.value = 0;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleMuteToggle());

    expect(controllerSetVolume).toHaveBeenCalledWith(74);
    expect(playbackVolume.value).toBe(74);
  });

  it('does not update volume signal when API fails', async () => {
    (controllerSetVolume as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('volume failed'));
    playbackVolume.value = 50;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleMuteToggle());

    expect(playbackVolume.value).toBe(50);
  });
});

describe('adjustVolume', () => {
  it('increases volume by delta', async () => {
    (controllerSetVolume as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackVolume.value = 50;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.adjustVolume(10));

    expect(controllerSetVolume).toHaveBeenCalledWith(60);
    expect(playbackVolume.value).toBe(60);
  });

  it('clamps volume to a maximum of 100', async () => {
    (controllerSetVolume as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackVolume.value = 95;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.adjustVolume(20));

    expect(controllerSetVolume).toHaveBeenCalledWith(100);
    expect(playbackVolume.value).toBe(100);
  });

  it('clamps volume to a minimum of 0', async () => {
    (controllerSetVolume as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackVolume.value = 5;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.adjustVolume(-20));

    expect(controllerSetVolume).toHaveBeenCalledWith(0);
    expect(playbackVolume.value).toBe(0);
  });
});

describe('handleVolumeChange', () => {
  it('sets volume to the requested value', async () => {
    (controllerSetVolume as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { result } = await renderHook(async () => 'device-123');

    await act(() => result.handleVolumeChange(42));

    expect(controllerSetVolume).toHaveBeenCalledWith(42);
    expect(playbackVolume.value).toBe(42);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: playContextFn / playUrisFn
// ═══════════════════════════════════════════════════════════════════════════════

describe('playContextFn', () => {
  it('plays a context on the active device', async () => {
    (apiPlayContext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { result } = await renderHook(async () => 'device-123');

    await act(() => result.playContextFn('spotify:playlist:abc', 'spotify:track:1'));

    expect(apiPlayContext).toHaveBeenCalledWith('spotify:playlist:abc', 'spotify:track:1', 'device-123');
    expect(refreshPlayback).toHaveBeenCalledTimes(1);
  });

  it('shows an error when no device is available', async () => {
    const { result } = await renderHook(async () => null);
    await act(() => result.playContextFn('spotify:album:xyz'));

    expect(apiPlayContext).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalled();
  });

  it('handles API errors', async () => {
    (apiPlayContext as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('context failed'));
    const { result } = await renderHook(async () => 'device-123');

    await act(() => result.playContextFn('spotify:playlist:abc'));

    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'Play Context');
  });
});

describe('playUrisFn', () => {
  it('plays URIs on the active device', async () => {
    (apiPlayUris as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { result } = await renderHook(async () => 'device-123');

    await act(() => result.playUrisFn(['spotify:track:1', 'spotify:track:2'], 1));

    expect(apiPlayUris).toHaveBeenCalledWith(['spotify:track:1', 'spotify:track:2'], 1, 'device-123');
    expect(refreshPlayback).toHaveBeenCalledTimes(1);
  });

  it('shows an error when no device is available', async () => {
    const { result } = await renderHook(async () => null);
    await act(() => result.playUrisFn(['spotify:track:1']));

    expect(apiPlayUris).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalled();
  });

  it('handles API errors', async () => {
    (apiPlayUris as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('uris failed'));
    const { result } = await renderHook(async () => 'device-123');

    await act(() => result.playUrisFn(['spotify:track:1']));

    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'Play Tracks');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: handleToggleLike
// ═══════════════════════════════════════════════════════════════════════════════

describe('handleToggleLike', () => {
  it('saves a track when not currently liked', async () => {
    (apiSaveTracks as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackTrack.value = makeTrack({ id: 'track-like' });
    likedTrack.value = false;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleToggleLike());

    expect(apiSaveTracks).toHaveBeenCalledWith(['track-like']);
    expect(likedTrack.value).toBe(true);
  });

  it('removes a track when currently liked', async () => {
    (apiRemoveSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    playbackTrack.value = makeTrack({ id: 'track-unlike' });
    likedTrack.value = true;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleToggleLike());

    expect(apiRemoveSavedTracks).toHaveBeenCalledWith(['track-unlike']);
    expect(likedTrack.value).toBe(false);
  });

  it('does nothing when no track is loaded', async () => {
    playbackTrack.value = null;
    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleToggleLike());

    expect(apiSaveTracks).not.toHaveBeenCalled();
    expect(apiRemoveSavedTracks).not.toHaveBeenCalled();
  });

  it('handles API errors', async () => {
    (apiSaveTracks as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('save failed'));
    playbackTrack.value = makeTrack({ id: 'track-err' });
    likedTrack.value = false;

    const { result } = await renderHook(async () => 'device-123');
    await act(() => result.handleToggleLike());

    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'Like Song');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Play count tracking
// ═══════════════════════════════════════════════════════════════════════════════

describe('play count tracking', () => {
  it('records a play after 30 seconds of continuous playback', async () => {
    playbackTrack.value = makeTrack({ id: 'count-track', name: 'Count Track', artists: [{ id: 'a1', name: 'Count Artist' }] });
    isPlaying.value = true;

    const { result } = await renderHook(async () => 'device-123');
    expect(result.isPlayActionLoading).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(recordPlay).toHaveBeenCalledWith('Count Artist', 'Count Track');
  });

  it('does not record a play if playback stops before 30 seconds', async () => {
    playbackTrack.value = makeTrack({ id: 'count-track', name: 'Count Track' });
    isPlaying.value = true;

    await renderHook(async () => 'device-123');
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    await act(() => {
      isPlaying.value = false;
    });
    await act(() => vi.advanceTimersByTimeAsync(20_000));

    expect(recordPlay).not.toHaveBeenCalled();
  });

  it('does not double-record the same track', async () => {
    playbackTrack.value = makeTrack({ id: 'count-track', name: 'Count Track', artists: [{ id: 'a1', name: 'Count Artist' }] });
    isPlaying.value = true;

    await renderHook(async () => 'device-123');
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(recordPlay).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(recordPlay).toHaveBeenCalledTimes(1);
  });

  it('resets the play count timer when the track changes', async () => {
    playbackTrack.value = makeTrack({ id: 'track-a', name: 'Track A', artists: [{ id: 'a1', name: 'Artist A' }] });
    isPlaying.value = true;

    await renderHook(async () => 'device-123');
    await act(() => vi.advanceTimersByTimeAsync(20_000));

    await act(() => {
      playbackTrack.value = makeTrack({ id: 'track-b', name: 'Track B', artists: [{ id: 'a2', name: 'Artist B' }] });
    });
    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(recordPlay).toHaveBeenCalledTimes(1);
    expect(recordPlay).toHaveBeenCalledWith('Artist B', 'Track B');
  });

  it('does not record if the track changes during the 30-second window', async () => {
    playbackTrack.value = makeTrack({ id: 'track-a', name: 'Track A' });
    isPlaying.value = true;

    await renderHook(async () => 'device-123');
    await act(() => vi.advanceTimersByTimeAsync(20_000));

    await act(() => {
      playbackTrack.value = makeTrack({ id: 'track-b', name: 'Track B' });
    });
    await act(() => vi.advanceTimersByTimeAsync(15_000));

    expect(recordPlay).not.toHaveBeenCalled();
  });
});
