import { signal } from "@preact/signals";
import { getAccessToken } from "../lib/spotify";

export const authState = signal<boolean>(false);
export const isMockMode = signal<boolean>(false);
export const authError = signal<string | null>(null);
export const isAuthLoading = signal<boolean>(false);
export const isRestoring = signal<boolean>(true);
export const appError = signal<string | null>(null);

export async function validateToken(): Promise<boolean> {
  const accessToken = getAccessToken();
  if (!accessToken) return false;

  try {
    const isBrowser = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__?.__is_spx_shim__ === true;
    const apiUrl = isBrowser ? "/spotify-api/v1/me" : "https://api.spotify.com/v1/me";
    const response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 401/403 = token invalid or expired, but DON'T clear it here.
    // Let restoreSession/useAuth decide whether to clear or retry.
    if (response.status === 401 || response.status === 403) {
      return false;
    }

    if (response.status >= 500) {
      // Server error — Spotify is having issues, don't clear the token.
      // Assume token is still valid and let next request retry.
      return true;
    }

    return response.ok;
  } catch {
    // Network error — can't validate, assume token is still good.
    return true;
  }
}

export { clearToken } from "../lib/spotify";
