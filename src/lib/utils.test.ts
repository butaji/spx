import { describe, it, expect } from 'vitest';
import { formatTime, formatFollowers, SpotifyAPIError, isSpotifyAPIError } from './utils';

describe('formatTime', () => {
  it('handles 0', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('handles undefined', () => {
    expect(formatTime(undefined)).toBe('0:00');
  });

  it('handles NaN', () => {
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('handles negative values', () => {
    expect(formatTime(-1000)).toBe('0:00');
  });

  it('handles seconds', () => {
    expect(formatTime(42000)).toBe('0:42');
  });

  it('handles minutes', () => {
    expect(formatTime(186000)).toBe('3:06');
  });

  it('handles hours', () => {
    expect(formatTime(3661000)).toBe('61:01');
  });
});

describe('formatFollowers', () => {
  it('formats thousands as K', () => {
    expect(formatFollowers(1500)).toBe('2K');
  });

  it('formats millions as M', () => {
    expect(formatFollowers(2500000)).toBe('2.5M');
  });

  it('removes trailing .0 from millions', () => {
    expect(formatFollowers(1000000)).toBe('1M');
  });

  it('returns original number for small counts', () => {
    expect(formatFollowers(500)).toBe('500');
  });

  it('handles exact thousand boundaries', () => {
    expect(formatFollowers(1000)).toBe('1K');
  });

  it('handles exact million boundaries', () => {
    expect(formatFollowers(2000000)).toBe('2M');
  });
});

describe('SpotifyAPIError', () => {
  describe('creation', () => {
    it('creates error with all fields', () => {
      const error = new SpotifyAPIError('Test error', '/v1/me', 401, false);
      
      expect(error.message).toBe('Test error');
      expect(error.endpoint).toBe('/v1/me');
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
      expect(error.name).toBe('SpotifyAPIError');
    });

    it('creates error without optional fields', () => {
      const error = new SpotifyAPIError('Simple error', '/v1/tracks');
      
      expect(error.message).toBe('Simple error');
      expect(error.endpoint).toBe('/v1/tracks');
      expect(error.statusCode).toBeUndefined();
      expect(error.retryable).toBe(false);
    });

    it('defaults retryable to false', () => {
      const error = new SpotifyAPIError('Test', '/v1/me');
      expect(error.retryable).toBe(false);
    });

    it('can set retryable to true', () => {
      const error = new SpotifyAPIError('Test', '/v1/me', 429, true);
      expect(error.retryable).toBe(true);
    });

    it('has proper stack trace', () => {
      const error = new SpotifyAPIError('Test', '/v1/me');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('SpotifyAPIError');
    });

    it('toString includes endpoint and status code', () => {
      const error = new SpotifyAPIError('Test error', '/v1/me', 401);
      expect(error.toString()).toBe('[/v1/me] HTTP 401: Test error');
    });

    it('toString without status code', () => {
      const error = new SpotifyAPIError('Test error', '/v1/me');
      expect(error.toString()).toBe('[/v1/me] Test error');
    });
  });

  describe('isRetryable()', () => {
    it('returns true for 429 (rate limit)', () => {
      const error = new SpotifyAPIError('Rate limited', '/v1/me', 429);
      expect(error.isRetryable()).toBe(true);
    });

    it('returns true for 500 (internal server error)', () => {
      const error = new SpotifyAPIError('Server error', '/v1/me', 500);
      expect(error.isRetryable()).toBe(true);
    });

    it('returns true for 502 (bad gateway)', () => {
      const error = new SpotifyAPIError('Bad gateway', '/v1/me', 502);
      expect(error.isRetryable()).toBe(true);
    });

    it('returns true for 503 (service unavailable)', () => {
      const error = new SpotifyAPIError('Service unavailable', '/v1/me', 503);
      expect(error.isRetryable()).toBe(true);
    });

    it('returns true for 504 (gateway timeout)', () => {
      const error = new SpotifyAPIError('Gateway timeout', '/v1/me', 504);
      expect(error.isRetryable()).toBe(true);
    });

    it('returns false for 4xx errors (non-retryable)', () => {
      const error400 = new SpotifyAPIError('Bad request', '/v1/me', 400);
      const error401 = new SpotifyAPIError('Unauthorized', '/v1/me', 401);
      const error403 = new SpotifyAPIError('Forbidden', '/v1/me', 403);
      const error404 = new SpotifyAPIError('Not found', '/v1/me', 404);

      expect(error400.isRetryable()).toBe(false);
      expect(error401.isRetryable()).toBe(false);
      expect(error403.isRetryable()).toBe(false);
      expect(error404.isRetryable()).toBe(false);
    });

    it('returns false when retryable flag is false for non-retryable status', () => {
      // 400 is not automatically retryable, so retryable flag matters
      const error = new SpotifyAPIError('Not retryable', '/v1/me', 400, false);
      expect(error.isRetryable()).toBe(false);
    });

    it('returns true when retryable flag is true even for non-5xx', () => {
      const error = new SpotifyAPIError('Forced retry', '/v1/me', 400, true);
      expect(error.isRetryable()).toBe(true);
    });

    it('returns false when no status code and not retryable', () => {
      const error = new SpotifyAPIError('Unknown error', '/v1/me');
      expect(error.isRetryable()).toBe(false);
    });
  });

  describe('getUserMessage()', () => {
    it('returns session expired message for 401', () => {
      const error = new SpotifyAPIError('Unauthorized', '/v1/me', 401);
      expect(error.getUserMessage()).toBe('Session expired. Please sign in again.');
    });

    it('returns access denied message for 403', () => {
      const error = new SpotifyAPIError('Forbidden', '/v1/me', 403);
      expect(error.getUserMessage()).toBe('Access denied. Spotify Premium may be required.');
    });

    it('returns not found message for 404', () => {
      const error = new SpotifyAPIError('Not found', '/v1/me', 404);
      expect(error.getUserMessage()).toBe('Content not found.');
    });

    it('returns rate limit message for 429', () => {
      const error = new SpotifyAPIError('Rate limited', '/v1/me', 429);
      expect(error.getUserMessage()).toBe('Rate limited. Please wait a moment.');
    });

    it('returns service unavailable message for 500', () => {
      const error = new SpotifyAPIError('Server error', '/v1/me', 500);
      expect(error.getUserMessage()).toBe('Spotify service unavailable. Please try again later.');
    });

    it('returns service unavailable message for 502', () => {
      const error = new SpotifyAPIError('Bad gateway', '/v1/me', 502);
      expect(error.getUserMessage()).toBe('Spotify service unavailable. Please try again later.');
    });

    it('returns service unavailable message for 503', () => {
      const error = new SpotifyAPIError('Service unavailable', '/v1/me', 503);
      expect(error.getUserMessage()).toBe('Spotify service unavailable. Please try again later.');
    });

    it('returns original message for unknown status codes', () => {
      const error = new SpotifyAPIError('Custom error message', '/v1/me', 418);
      expect(error.getUserMessage()).toBe('Custom error message');
    });

    it('returns original message when no status code', () => {
      const error = new SpotifyAPIError('Unknown error', '/v1/me');
      expect(error.getUserMessage()).toBe('Unknown error');
    });
  });
});

describe('isSpotifyAPIError', () => {
  it('returns true for SpotifyAPIError instance', () => {
    const error = new SpotifyAPIError('Test', '/v1/me', 401);
    expect(isSpotifyAPIError(error)).toBe(true);
  });

  it('returns false for regular Error', () => {
    const error = new Error('Regular error');
    expect(isSpotifyAPIError(error)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSpotifyAPIError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSpotifyAPIError(undefined)).toBe(false);
  });

  it('returns false for plain object', () => {
    expect(isSpotifyAPIError({ message: 'Test' })).toBe(false);
  });

  it('returns false for string', () => {
    expect(isSpotifyAPIError('error message')).toBe(false);
  });

  it('works as type guard narrowing', () => {
    function handleError(error: unknown): string {
      if (isSpotifyAPIError(error)) {
        // TypeScript should know error is SpotifyAPIError here
        return error.getUserMessage();
      }
      return 'Unknown error';
    }

    const spotifyError = new SpotifyAPIError('Auth failed', '/v1/me', 401);
    expect(handleError(spotifyError)).toBe('Session expired. Please sign in again.');
    expect(handleError(new Error('Regular'))).toBe('Unknown error');
  });
});
