import { useCallback, useEffect } from "preact/compat";
import {
  startAuthFlow,
  handleCallbackUrl,
  restoreSession,
  checkMockMode,
  getAccessToken,
  clearToken,
} from "../lib/spotify";
import {
  authState as isAuthSignal,
  isMockMode,
  authError,
  isAuthLoading,
  isRestoring,
  appError,
  loadRecentActivity,
  refreshPlayback,
  validateToken,
} from "../stores/spotify";
import { refreshSpotifyDevices, refreshLocalDevices, startDevicePolling, stopDevicePolling } from "../stores/devices";

export function useAuth() {
  const isAuthed = isAuthSignal.value;
  const authErr = authError.value;
  const isAuthLoad = isAuthLoading.value;

  // Error helper using dialog
  const showError = useCallback(async (msg: string) => {
    console.error(msg);
    try {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message(msg, { title: 'SPX Error', kind: 'error' });
    } catch (e) {
      appError.value = msg;
    }
  }, []);

  // Initialize auth on mount
  useEffect(() => {
    async function init() {
      isRestoring.value = true;
      // Safety: never show restoring for more than 8 seconds
      const safetyTimeout = setTimeout(() => {
        console.warn("Auth init safety timeout reached — forcing isRestoring = false");
        isRestoring.value = false;
      }, 8000);

      try {
        const mock = await checkMockMode();
        isMockMode.value = mock;
        const authed = await restoreSession();
        isAuthSignal.value = authed || mock;

        if (authed || mock) {
          authError.value = null;
          const token = getAccessToken();
          if (token) {
            const valid = await validateToken();
            if (!valid) {
              console.warn("Token validation failed — clearing session");
              await clearToken();
              isAuthSignal.value = false;
              isRestoring.value = false;
              return;
            }
          }
          // Start these independently — don't block auth init on device scanning
          loadRecentActivity();
          refreshPlayback();
          refreshSpotifyDevices().catch(console.error);
          // Scan local devices in background after auth is ready
          setTimeout(() => refreshLocalDevices(true).catch(console.error), 500);
          // Start device polling now that auth is ready
          startDevicePolling();
        }
      } catch (e) {
        console.error("Auth init failed:", e);
      } finally {
        clearTimeout(safetyTimeout);
        isRestoring.value = false;
      }
    }
    init();
    return () => stopDevicePolling();
  }, []);

  // Listen for deep link callbacks
  useEffect(() => {
    let ignore = false;

    async function handleDeepLink(url: string) {
      if (ignore) return;
      try {
        await handleCallbackUrl(url);
        isAuthSignal.value = true;
        loadRecentActivity();
        refreshPlayback();
        refreshSpotifyDevices();
        startDevicePolling();
      } catch (e) {
        console.error("Deep link auth error:", e);
        showError(e instanceof Error ? e.message : String(e));
      }
    }

    async function setupDeepLinks() {
      // Using localhost callback server, no deep links needed
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

  const handleStartAuth = useCallback(async () => {
    if (isAuthLoading.value || isAuthSignal.value) return;
    isAuthLoading.value = true;
    appError.value = null;
    authError.value = null;
    try {
      await startAuthFlow();
      isAuthSignal.value = true;
      authError.value = null;
      loadRecentActivity();
      refreshPlayback();
      await refreshSpotifyDevices();
      startDevicePolling();
    } catch (e) {
      console.error("Failed to start auth:", e);
      authError.value = e instanceof Error ? e.message : 'Authentication failed';
      showError(e instanceof Error ? e.message : String(e));
    } finally {
      isAuthLoading.value = false;
    }
  }, [showError]);

  return {
    isAuthed,
    authErr,
    isAuthLoad,
    isRestoring,
    handleStartAuth,
  };
}
