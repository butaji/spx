import { useCallback, useEffect } from "preact/compat";
import { message } from "@tauri-apps/plugin-dialog";
import {
  startAuthFlow,
  handleCallbackUrl,
  restoreSession,
  checkMockMode,
  getAccessToken,
} from "../lib/spotify";
import { initPlayer, onPlaybackEvent } from "../lib/playback";
import {
  authState as isAuthSignal,
  isMockMode,
  authError,
  isAuthLoading,
  appError,
  loadRecentActivity,
  refreshPlayback,
  validateToken,
} from "../stores/spotify";
import { refreshSpotifyDevices, refreshLocalDevices } from "../stores/devices";

export function useAuth() {
  const isAuthed = isAuthSignal.value;
  const authErr = authError.value;
  const isAuthLoad = isAuthLoading.value;

  // Error helper using dialog
  const showError = useCallback(async (msg: string) => {
    console.error(msg);
    try {
      await message(msg, { title: 'SPX Error', kind: 'error' });
    } catch (e) {
      appError.value = msg;
    }
  }, []);

  // Initialize auth on mount
  useEffect(() => {
    async function init() {
      const mock = await checkMockMode();
      isMockMode.value = mock;
      const authed = await restoreSession();
      isAuthSignal.value = authed || mock;
      if (authed || mock) {
        authError.value = false;
        const token = getAccessToken();
        if (token) {
          console.log('[Debug] Access token:', token);
        }
        const valid = await validateToken();
        if (!valid) {
          console.log("Token validation failed, forcing re-auth");
          isAuthSignal.value = false;
          authError.value = true;
          return;
        }
        try {
          const token = getAccessToken();
          if (token) {
            await initPlayer(token);
            console.log("Web Playback SDK initialized");
          }
        } catch (e) {
          console.error("Failed to init Web Playback SDK:", e);
        }
        loadRecentActivity();
        refreshPlayback();
        await refreshSpotifyDevices();
        await refreshLocalDevices(true);
      }
    }
    init();
  }, []);

  // Listen for deep link callbacks
  useEffect(() => {
    let ignore = false;

    async function handleDeepLink(url: string) {
      if (ignore) return;
      try {
        await handleCallbackUrl(url);
        isAuthSignal.value = true;
        try {
          const token = getAccessToken();
          if (token) {
            await initPlayer(token);
            console.log("Web Playback SDK initialized");
          }
        } catch (e) {
          console.error("Failed to init Web Playback SDK:", e);
        }
        loadRecentActivity();
        refreshPlayback();
        refreshSpotifyDevices();
      } catch (e) {
        console.error("Deep link auth error:", e);
        showError(e instanceof Error ? e.message : String(e));
      }
    }

    async function setupDeepLinks() {
      console.log("Using localhost callback server, no deep links needed");
    }

    setupDeepLinks();

    const checkUrl = async () => {
      try {
        const url = window.location.href;
        if (url.includes("com.spx.app://callback") && url.includes("code=")) {
          handleDeepLink(url);
        }
      } catch (e) {
        // Not in Tauri
      }
    };
    checkUrl();

    return () => { ignore = true; };
  }, [showError]);

  // Listen for Web Playback SDK ready event
  useEffect(() => {
    const unsub = onPlaybackEvent((event) => {
      if (event.type === 'ready') {
        console.log("SPX Player connected and ready, device:", event.data?.device_id);
        refreshPlayback();
      }
    });
    return unsub;
  }, []);

  const handleStartAuth = useCallback(async () => {
    if (isAuthLoading.value || isAuthSignal.value) return;
    isAuthLoading.value = true;
    appError.value = null;
    authError.value = false;
    try {
      await startAuthFlow();
      console.log("Auth flow completed successfully");
      isAuthSignal.value = true;
      authError.value = false;
      loadRecentActivity();
      refreshPlayback();
      await refreshSpotifyDevices();
    } catch (e) {
      console.error("Failed to start auth:", e);
      authError.value = true;
      showError(e instanceof Error ? e.message : String(e));
    } finally {
      isAuthLoading.value = false;
    }
  }, [showError]);

  return {
    isAuthed,
    authErr,
    isAuthLoad,
    handleStartAuth,
  };
}
