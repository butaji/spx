import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Tauri store
vi.mock('@tauri-apps/plugin-store', () => {
  const store = new Map<string, any>();
  return {
    load: vi.fn().mockResolvedValue({
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: any) => { store.set(key, value); }),
      save: vi.fn(async () => {}),
      clear: vi.fn(async () => { store.clear(); }),
    }),
  };
});

import { getCached, setCache, isCacheFresh, clearCache } from './cache';

describe('cache', () => {
  beforeEach(async () => {
    await clearCache();
  });

  it('returns null for missing key', async () => {
    const result = await getCached('nonexistent');
    expect(result).toBeNull();
  });

  it('stores and retrieves data', async () => {
    await setCache('test-key', { hello: 'world' }, 60000);
    const result = await getCached('test-key');
    expect(result).toEqual({ hello: 'world' });
  });

  it('returns stale data but reports not fresh', async () => {
    await setCache('stale-key', 'data', -1000); // negative TTL = expired
    const data = await getCached('stale-key');
    expect(data).toBe('data'); // stale-while-revalidate
    const fresh = await isCacheFresh('stale-key');
    expect(fresh).toBe(false);
  });

  it('reports fresh data correctly', async () => {
    await setCache('fresh-key', 'data', 60000);
    const fresh = await isCacheFresh('fresh-key');
    expect(fresh).toBe(true);
  });
});
