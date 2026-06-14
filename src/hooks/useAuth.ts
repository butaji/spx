import { useCallback, useEffect } from "preact/compat";
import {
  startAuthFlow,
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

export function useAuth() {
  const isAuthed = isAuthSignal.value;
  const authErr = authError.value;
  const isAuthLoad = isAuthLoading.value;

  // Initialize auth on mount
  useEffect(() => {
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
        // Check if running in mock mode
        const mock = await checkMockMode();
        isMockMode.value = mock;
        
        if (mock) {
          console.log("[Auth] Running in mock mode");
          isAuthSignal.value = true;
          setAuthStatus("authenticated");
          setConnectionStatus("connected");
          loadRecentActivity();
          refreshPlayback();
          showInfo("Mock Mode", "Running with mock data - no Spotify connection needed");
          setTimeout(() => refreshLocalDevices(true).catch(console.error), 500);
          startDevicePolling();
          clearTimeout(safetyTimeout);
          isRestoring.value = false;
          return;
        }

        // Try to restore session
        const authed = await restoreSession();
        
        if (authed) {
          setAuthStatus("authenticated");
          setConnectionStatus("connected");
          authError.value = null;
          
          // Validate the token
          const token = getAccessToken();
          if (token) {
            const valid = await validateToken();
            if (!valid) {
              console.warn("[Auth] Token validation failed — clearing session");
              await clearToken();
              isAuthSignal.value = false;
              setAuthStatus("expired");
              handleAuthError(new Error("Token validation failed"));
              clearTimeout(safetyTimeout);
              isRestoring.value = false;
              return;
            }
          }
          
          console.log("[Auth] Session restored successfully");
          showSuccess("Connected", "Successfully connected to Spotify");
          
          // Start background operations
          loadRecentActivity();
          refreshPlayback();
          refreshSpotifyDevices().catch(e => {
            console.error("[Auth] Device refresh failed:", e);
          });
          setTimeout(() => refreshLocalDevices(true).catch(console.error), 500);
          startDevicePolling();
        } else {
          console.log("[Auth] No existing session found");
          setAuthStatus("unauthenticated");
          setConnectionStatus("disconnected");
        }
      } catch (e) {
        console.error("[Auth] Init failed:", e);
        setConnectionStatus("disconnected");
        
        // Provide specific error messages
        if (e instanceof Error) {
          if (e.message.includes("network") || e.message.includes("fetch")) {
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
          } else if (e.message.includes("token") || e.message.includes("auth")) {
            handleAuthError(e);
          } else {
            showError(
              "Authentication Failed",
              e.message || "Failed to authenticate with Spotify",
              {
                solution: [
                  "Try signing in again",
                  "Make sure Spotify is accessible",
                  "Check your credentials"
                ],
                category: ErrorCategory.AUTH_OAUTH_FAILED,
              }
            );
          }
        } else {
          handleAuthError(e);
        }
      } finally {
        clearTimeout(safetyTimeout);
        isRestoring.value = false;
      }
    }
    
    init();
    
    // Cleanup on unmount
    return () => {
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
      await startAuthFlow();
      
      isAuthSignal.value = true;
      setAuthStatus("authenticated");
      setConnectionStatus("connected");
      authError.value = null;
      
      console.log("[Auth] OAuth flow completed successfully");
      showSuccess("Signed In", "Successfully connected to Spotify!");
      
      // Start operations
      loadRecentActivity();
      refreshPlayback();
      await refreshSpotifyDevices();
      startDevicePolling();
      
      // Set device status - will be updated by devices store
      setDeviceStatus("checking");
      
    } catch (e) {
      console.error("[Auth] OAuth flow failed:", e);
      isAuthSignal.value = false;
      
      if (e instanceof Error) {
        const msg = e.message.toLowerCase();
        
        if (msg.includes("popup") || msg.includes("blocked")) {
          showError(
            "Popup Blocked",
            "The sign-in popup was blocked by your browser.",
            {
              solution: [
                "Allow popups for this website",
                "Or click the URL in your address bar to allow",
                "Then try signing in again"
              ],
              category: ErrorCategory.AUTH_OAUTH_FAILED,
            }
          );
        } else if (msg.includes("cancelled") || msg.includes("denied")) {
          showInfo("Sign In Cancelled", "You cancelled the sign-in process.");
        } else if (msg.includes("network") || msg.includes("connection")) {
          showError(
            "Connection Error",
            "Couldn't connect to Spotify during sign-in.",
            {
              solution: [
                "Check your internet connection",
                "Make sure Spotify.com is accessible",
                "Try again in a few moments"
              ],
              category: ErrorCategory.NETWORK_NO_CONNECTION,
            }
          );
        } else {
          authError.value = e.message;
          handleAuthError(e);
        }
      } else {
        authError.value = "Authentication failed";
        handleAuthError(e);
      }
    } finally {
      isAuthLoading.value = false;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await clearToken();
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
