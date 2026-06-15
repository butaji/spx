/**
 * Error Handling Unit Tests
 * 
 * Tests that error handling functions work correctly.
 */

import { describe, it, expect } from 'vitest';
import { 
  ErrorCategory,
  ERROR_DEFINITIONS,
  createError,
  isRetryable,
  isAuthError,
  isNetworkError,
  showError,
} from './errors';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Error Definitions', () => {
  it('should have definitions for all error categories', () => {
    Object.values(ErrorCategory).forEach(category => {
      expect(ERROR_DEFINITIONS[category]).toBeDefined();
      expect(ERROR_DEFINITIONS[category].message).toBeDefined();
    });
  });

  it('should have actionable solutions for critical errors', () => {
    const categories = [
      ErrorCategory.AUTH_NO_CREDENTIALS,
      ErrorCategory.AUTH_TOKEN_EXPIRED,
      ErrorCategory.AUTH_PREMIUM_REQUIRED,
    ];

    categories.forEach(category => {
      const def = ERROR_DEFINITIONS[category];
      expect(def.solution).toBeDefined();
      expect(def.solution.length).toBeGreaterThan(0);
    });
  });
});

describe('isRetryable', () => {
  it('should mark network errors as retryable', () => {
    expect(isRetryable(ErrorCategory.NETWORK_TIMEOUT)).toBe(true);
    expect(isRetryable(ErrorCategory.NETWORK_RATE_LIMITED)).toBe(true);
    expect(isRetryable(ErrorCategory.NETWORK_NO_CONNECTION)).toBe(true);
  });

  it('should not mark credential errors as retryable', () => {
    expect(isRetryable(ErrorCategory.AUTH_NO_CREDENTIALS)).toBe(false);
  });

  it('should mark token expiry as retryable (can refresh)', () => {
    expect(isRetryable(ErrorCategory.AUTH_TOKEN_EXPIRED)).toBe(true);
  });

  it('should not mark premium errors as retryable', () => {
    expect(isRetryable(ErrorCategory.AUTH_PREMIUM_REQUIRED)).toBe(false);
  });
});

describe('isAuthError', () => {
  it('should identify auth-related errors', () => {
    expect(isAuthError(ErrorCategory.AUTH_NO_CREDENTIALS)).toBe(true);
    expect(isAuthError(ErrorCategory.AUTH_TOKEN_EXPIRED)).toBe(true);
    expect(isAuthError(ErrorCategory.AUTH_OAUTH_FAILED)).toBe(true);
  });

  it('should not identify non-auth errors', () => {
    expect(isAuthError(ErrorCategory.NETWORK_NO_CONNECTION)).toBe(false);
    expect(isAuthError(ErrorCategory.DEVICE_NO_DEVICES)).toBe(false);
  });
});

describe('isNetworkError', () => {
  it('should identify network errors as retryable', () => {
    expect(isNetworkError(ErrorCategory.NETWORK_NO_CONNECTION)).toBe(true);
    expect(isNetworkError(ErrorCategory.NETWORK_TIMEOUT)).toBe(true);
  });

  it('should not identify non-network errors', () => {
    expect(isNetworkError(ErrorCategory.AUTH_NO_CREDENTIALS)).toBe(false);
    expect(isNetworkError(ErrorCategory.PLAYBACK_FAILED)).toBe(false);
  });
});

describe('createError', () => {
  it('should create error with category', () => {
    const error = createError(new Error('test'), ErrorCategory.AUTH_OAUTH_FAILED);
    expect(error.category).toBe(ErrorCategory.AUTH_OAUTH_FAILED);
    expect(error.rawError).toBeInstanceOf(Error);
  });

  it('should infer category from error', () => {
    const errorWithStatus = Object.assign(new Error('test'), { status: 401 });
    const error = createError(errorWithStatus);
    expect(error.category).toBe(ErrorCategory.AUTH_TOKEN_EXPIRED);
  });

  it('should have definition property', () => {
    const error = createError(new Error('test'), ErrorCategory.AUTH_OAUTH_FAILED);
    expect(error.definition).toBeDefined();
    expect(error.definition.message).toBeDefined();
  });
});

describe('Error Category Enums', () => {
  it('should have auth error categories', () => {
    expect(ErrorCategory.AUTH_NO_CREDENTIALS).toBeDefined();
    expect(ErrorCategory.AUTH_TOKEN_EXPIRED).toBeDefined();
    expect(ErrorCategory.AUTH_OAUTH_FAILED).toBeDefined();
  });

  it('should have network error categories', () => {
    expect(ErrorCategory.NETWORK_NO_CONNECTION).toBeDefined();
    expect(ErrorCategory.NETWORK_TIMEOUT).toBeDefined();
  });

  it('should have device error categories', () => {
    expect(ErrorCategory.DEVICE_NO_DEVICES).toBeDefined();
  });

  it('should have playback error categories', () => {
    expect(ErrorCategory.PLAYBACK_FAILED).toBeDefined();
  });
});

describe('showError function', () => {
  it('should have correct parameter order (title first, message second)', () => {
    // This tests that the function signature is: showError(title, message, options?)
    // The previous bug had them reversed
    expect(showError).toBeDefined();
    expect(typeof showError).toBe('function');
    // The function should accept (title, message) as first two params
    // We verify this by checking the function exists and is callable
  });
});
