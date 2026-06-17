/**
 * Tests for the caching functions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCached, setCache, isCacheFresh, clearCache } from './cache';

describe('getCached', () => {
  beforeEach(() => localStorage.clear());

  it('should return cached data', async () => {
    await setCache('test_key', { foo: 'bar' });
    const result = await getCached<{ foo: string }>('test_key');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('should return null for missing keys', async () => {
    const result = await getCached('nonexistent');
    expect(result).toBeNull();
  });

  it('should return null for expired cache', async () => {
    await setCache('expire_key', { data: true }, 1);
    await new Promise(r => setTimeout(r, 50));
    const result = await getCached('expire_key');
    expect(result).toBeNull();
  });
});

describe('setCache', () => {
  beforeEach(() => localStorage.clear());

  it('should store data in localStorage', async () => {
    await setCache('store_key', { stored: true });
    const result = await getCached('store_key');
    expect(result).toEqual({ stored: true });
  });

  it('should handle localStorage errors gracefully', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    // Should not throw
    await expect(setCache('key', { data: 1 })).resolves.toBeUndefined();
  });
});

describe('isCacheFresh', () => {
  beforeEach(() => localStorage.clear());

  it('should return false for missing keys', async () => {
    const result = await isCacheFresh('nonexistent');
    expect(result).toBe(false);
  });
});

describe('clearCache', () => {
  it('should clear all cached values', async () => {
    await setCache('key1', { a: 1 });
    await setCache('key2', { b: 2 });
    clearCache();
    const result1 = await getCached('key1');
    const result2 = await getCached('key2');
    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });
});
