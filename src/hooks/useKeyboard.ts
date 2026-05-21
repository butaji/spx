import { useEffect, useCallback } from "preact/compat";
import { listen } from "@tauri-apps/api/event";
import { registerHotkey, setupHotkeys, clearHotkeys, teardownHotkeys } from "../lib/hotkeys";

interface KeyboardHandlers {
  handlePlayPause: () => void;
  handleNext: () => void;
  handlePrev: () => void;
  adjustVolume: (delta: number) => void;
  handleShuffle: () => void;
  handleRepeat: () => void;
  handleToggleLike: () => void;
  handleMuteToggle: () => void;
  focusSearch: () => void;
  handleEscape: () => void;
  setHotkeyHelpOpen: (open: boolean) => void;
  goBack: () => void;
  setHistory: (h: any[]) => void;
}

export function useKeyboard(handlers: KeyboardHandlers) {
  const {
    handlePlayPause,
    handleNext,
    handlePrev,
    adjustVolume,
    handleShuffle,
    handleRepeat,
    handleToggleLike,
    handleMuteToggle,
    focusSearch,
    handleEscape,
    setHotkeyHelpOpen,
    setHistory,
  } = handlers;

  const hideWindow = useCallback(() => {
    // Tauri window hide - imports dynamically to avoid issues in web
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().hide();
    }).catch(() => {
      console.warn('Window hide not available');
    });
  }, []);

  /* ── Keyboard Shortcuts ── */
  useEffect(() => {
    clearHotkeys();

    // Navigation
    registerHotkey({ key: '1', modifiers: ['meta'], handler: () => setHistory([{ type: "home" }]), description: 'Now Playing' });
    registerHotkey({ key: '2', modifiers: ['meta'], handler: () => setHistory([{ type: "search" }]), description: 'Search' });
    registerHotkey({ key: '3', modifiers: ['meta'], handler: () => setHistory([{ type: "library", tab: "playlists" }]), description: 'Library' });
    registerHotkey({ key: '4', modifiers: ['meta'], handler: () => setHistory([{ type: "queue" }]), description: 'Queue' });

    // Playback
    registerHotkey({ key: ' ', handler: handlePlayPause, description: 'Play/Pause' });
    registerHotkey({ key: 'ArrowRight', modifiers: ['meta'], handler: handleNext, description: 'Next Track' });
    registerHotkey({ key: 'ArrowLeft', modifiers: ['meta'], handler: handlePrev, description: 'Previous Track' });
    registerHotkey({ key: 'ArrowUp', modifiers: ['meta'], handler: () => adjustVolume(5), description: 'Volume Up' });
    registerHotkey({ key: 'ArrowDown', modifiers: ['meta'], handler: () => adjustVolume(-5), description: 'Volume Down' });

    // Actions
    registerHotkey({ key: 'l', handler: handleToggleLike, description: 'Like/Unlike' });
    registerHotkey({ key: 's', handler: handleShuffle, description: 'Shuffle' });
    registerHotkey({ key: 'r', handler: handleRepeat, description: 'Repeat' });
    registerHotkey({ key: 'm', handler: handleMuteToggle, description: 'Mute' });

    // Quick nav
    registerHotkey({ key: '/', handler: focusSearch, description: 'Focus Search' });
    registerHotkey({ key: 'Escape', handler: handleEscape, description: 'Close/Cancel' });
    registerHotkey({ key: '?', handler: () => setHotkeyHelpOpen(true), description: 'Hotkey Help' });

    // macOS window
    registerHotkey({ key: 'w', modifiers: ['meta'], handler: hideWindow, description: 'Hide Window' });

    setupHotkeys();

    return () => {
      teardownHotkeys();
    };
  }, [handlePlayPause, handleNext, handlePrev, adjustVolume, handleShuffle, handleRepeat, handleToggleLike, handleMuteToggle, focusSearch, handleEscape, setHotkeyHelpOpen, setHistory, hideWindow]);

  /* ── macOS Native Menu Events ── */
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const menuHandlers: Record<string, () => void> = {
      'menu:play_pause': handlePlayPause,
      'menu:next_track': handleNext,
      'menu:prev_track': handlePrev,
      'menu:vol_up': () => adjustVolume(5),
      'menu:vol_down': () => adjustVolume(-5),
      'menu:shuffle': handleShuffle,
      'menu:repeat': handleRepeat,
      'menu:now_playing': () => setHistory([{ type: 'home' }]),
      'menu:search': () => setHistory([{ type: 'search' }]),
      'menu:library': () => setHistory([{ type: 'library' }]),
      'menu:queue': () => setHistory([{ type: 'queue' }]),
    };

    Object.entries(menuHandlers).forEach(([event, handler]) => {
      listen(event, handler).then(unsub => unsubs.push(unsub));
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [handlePlayPause, handleNext, handlePrev, adjustVolume, handleShuffle, handleRepeat, setHistory]);
}
