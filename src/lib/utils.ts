/**
 * Custom error class for Spotify API errors with context information.
 * Provides better error handling and debugging than generic Error.
 */
export class SpotifyAPIError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'SpotifyAPIError';
    
    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SpotifyAPIError);
    }
  }

  /**
   * Check if this error should trigger a retry
   */
  isRetryable(): boolean {
    return this.retryable || this.statusCode === 429 || 
           (this.statusCode !== undefined && this.statusCode >= 500);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.statusCode) {
      case 401:
        return "Session expired. Please sign in again.";
      case 403:
        return "Access denied. Spotify Premium may be required.";
      case 404:
        return "Content not found.";
      case 429:
        return "Rate limited. Please wait a moment.";
      case 500:
      case 502:
      case 503:
        return "Spotify service unavailable. Please try again later.";
      default:
        return this.message;
    }
  }

  toString(): string {
    return `[${this.endpoint}] ${this.statusCode ? `HTTP ${this.statusCode}: ` : ''}${this.message}`;
  }
}

/**
 * Check if an error is a SpotifyAPIError
 */
export function isSpotifyAPIError(error: unknown): error is SpotifyAPIError {
  return error instanceof SpotifyAPIError;
}

export function formatTime(ms: number | undefined): string {
  if (!ms || isNaN(ms) || ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatFollowers(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(0) + 'K';
  }
  return count.toString();
}

/** Debug logger that only prints in development. */
export const DEBUG = import.meta.env.DEV;
export function debug(...args: any[]): void {
  if (DEBUG) console.log(...args);
}