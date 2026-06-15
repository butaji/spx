import { useCallback, useEffect } from "preact/hooks";
import { listen } from "@tauri-apps/api/event";
import {
  startAuthFlow as sdkStartAuth,
  handleAuthCallback,
  isAuthenticated,
  logout as sdkLogout,
  getCurrentUser,
} from "../lib/spotify";
import {
  authState as isAuthSignal,
  authError,
  isAuthLoading,
  isRestoring,
  appError,
  loadRecentActivity,
  refreshPlayback,
} from "../stores/spotify";
import { 
  refreshSpotifyDevices, 
  refreshLocalDevices, 
  startDevicePolling, 
  stopDevicePolling,
} from "../stores/devices";
import { 
  handleAuthError, 
  setAuthStatus, 
  setConnectionStatus,
  setDeviceStatus,
  showError,
  showSuccess,
  showInfo,
} from "../stores/notifications";
import { ErrorCategory } from "../lib/errors";

// ─── OAuth Callback Handler ──────────────────────────────────────────────────

function parseAuthCallback(): string | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  
  if (error) {
    if (error === 'access_denied') {
      showInfo('Sign In Cancelled', 'You cancelled the Spotify sign-in.');
    } else {
      showError('Authentication Failed', `Spotify returned an error: ${error}`, {
        solution: ['Try signing in again'],
        category: ErrorCategory.AUTH_OAUTH_FAILED,
      });
    }
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    return null;
  }
  
  if (code) {
    // Clean URL immediately
    window.history.replaceState({}, '', window.location.pathname);
    return code;
  }
  
  return null;
}

// ─── Auth Hook ───────────────────────────────────────────────────────────────

export function useAuth() {
  const isAuthed = isAuthSignal.value;
  const authErr = authError.value;
  const isAuthLoad = isAuthLoading.value;

  // Initialize auth on mount
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    
    async function init() {
      isRestoring.value = true;
      setAuthStatus("unauthenticated");
      setConnectionStatus("connecting");
      
      // Safety timeout - never show restoring for more than 10 seconds
      const safetyTimeout = setTimeout(() => {
        console.warn("[Auth] Safety timeout reached — forcing isRestoring = false");
        isRestoring.value = false;
      }, 10000);

      try {
        // Listen for OAuth callback from Tauri backend
        unlisten = await listen<string>("oauth-callback", async (event) => {
          console.log("[Auth] OAuth callback received:", event.payload);
          const url = new URL(event.payload);
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          
          if (code) {
            try {
              await handleAuthCallback(code, state ?? undefined);
              console.log("[Auth] OAuth callback successful");
              isAuthSignal.value = true;
              setAuthStatus("authenticated");
              setConnectionStatus("connected");
              authError.value = null;
              
              showSuccess("Signed In", "Successfully connected to Spotify!");
              
              loadRecentActivity();
              refreshPlayback();
              refreshSpotifyDevices().catch(e => {
                console.error("[Auth] Device refresh failed:", e);
              });
              setTimeout(() => refreshLocalDevices(true).catch(console.error), 500);
              startDevicePolling();
            } catch (e: any) {
              console.error("[Auth] OAuth callback failed:", e);
              authError.value = e.message || "Authentication failed";
              handleAuthError(e);
              setAuthStatus("unauthenticated");
              setConnectionStatus("disconnected");
            }
          }
        });

        // Check for OAuth callback code in URL (fallback for dev)
        const code = parseAuthCallback();
        if (code) {
          console.log("[Auth] Processing OAuth callback...");
          setAuthStatus("unauthenticated");
          setConnectionStatus("connecting");
          
          try {
            await handleAuthCallback(code);
            console.log("[Auth] OAuth callback successful");
            isAuthSignal.value = true;
            setAuthStatus("authenticated");
            setConnectionStatus("connected");
            authError.value = null;
            
            showSuccess("Signed In", "Successfully connected to Spotify!");
            
            loadRecentActivity();
            refreshPlayback();
            refreshSpotifyDevices().catch(e => {
              console.error("[Auth] Device refresh failed:", e);
            });
            setTimeout(() => refreshLocalDevices(true).catch(console.error), 500);
            startDevicePolling();
            
            clearTimeout(safetyTimeout);
            isRestoring.value = false;
            return;
          } catch (e: any) {
            console.error("[Auth] OAuth callback failed:", e);
            authError.value = e.message || "Authentication failed";
            handleAuthError(e);
            setAuthStatus("unauthenticated");
            setConnectionStatus("disconnected");
            clearTimeout(safetyTimeout);
            isRestoring.value = false;
            return;
          }
        }
        
        // Check if already authenticated
        if (isAuthenticated()) {
          console.log("[Auth] Restoring session...");
          setAuthStatus("authenticated");
          setConnectionStatus("connected");
          authError.value = null;
          
          // Verify token by getting user
          try {
            await getCurrentUser();
          } catch (e: any) {
            console.warn("[Auth] Token may be invalid:", e);
            sdkLogout();
            setAuthStatus("unauthenticated");
            setConnectionStatus("disconnected");
            clearTimeout(safetyTimeout);
            isRestoring.value = false;
            return;
          }
          
          console.log("[Auth] Session restored successfully");
          showSuccess("Connected", "Successfully connected to Spotify");
          
          loadRecentActivity();
          refreshPlayback();
          refreshSpotifyDevices().catch(e => {
            console.error("[Auth] Device refresh failed:", e);
          });
          setTimeout(() => refreshLocalDevices(true).catch(console.error), 500);
          startDevicePolling();
          
          clearTimeout(safetyTimeout);
          isRestoring.value = false;
          return;
        }
        
        console.log("[Auth] No existing session found");
        setAuthStatus("unauthenticated");
        setConnectionStatus("disconnected");
        
      } catch (e: any) {
        console.error("[Auth] Init failed:", e);
        setConnectionStatus("disconnected");
        
        if (e.message?.includes('network') || e.message?.includes('fetch')) {
          showError(
            "Connection Failed",
            "Couldn't connect to Spotify. Check your internet connection.",
            {
              solution: [
                "Check your Wi-Fi connection",
                "Make sure Spotify.com is accessible",
                "Try again in a few moments"
              ],
              category: ErrorCategory.NETWORK_NO_CONNECTION,
            }
          );
        } else {
          showError(
            "Authentication Failed",
            e.message || "Failed to authenticate with Spotify",
            {
              solution: [
                "Try signing in again",
                "Make sure Spotify is accessible",
                "Check your internet connection"
              ],
              category: ErrorCategory.AUTH_OAUTH_FAILED,
            }
          );
        }
      } finally {
        clearTimeout(safetyTimeout);
        isRestoring.value = false;
      }
    }
    
    init();
    
    // Cleanup on unmount
    return () => {
      if (unlisten) unlisten();
      stopDevicePolling();
    };
  }, []);

  const handleStartAuth = useCallback(async () => {
    if (isAuthLoading.value || isAuthSignal.value) return;
    
    isAuthLoading.value = true;
    appError.value = null;
    authError.value = null;
    setAuthStatus("unauthenticated");
    
    try {
      console.log("[Auth] Starting OAuth flow...");
      await sdkStartAuth();
      // This will redirect to Spotify, so we don't reset isAuthLoading
    } catch (e: any) {
      console.error("[Auth] OAuth flow failed:", e);
      isAuthSignal.value = false;
      authError.value = e.message || "Authentication failed";
      handleAuthError(e);
      isAuthLoading.value = false;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      sdkLogout();
      isAuthSignal.value = false;
      setAuthStatus("unauthenticated");
      setConnectionStatus("disconnected");
      setDeviceStatus("none");
      stopDevicePolling();
      showInfo("Signed Out", "You have been signed out of Spotify.");
    } catch (e) {
      console.error("[Auth] Sign out failed:", e);
    }
  }, []);

  return {
    isAuthed,
    authErr,
    isAuthLoad,
    isRestoring,
    handleStartAuth,
    handleSignOut,
  };
}

// Export for callback handling
export { parseAuthCallback };
