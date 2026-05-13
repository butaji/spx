import { load, type Store } from '@tauri-apps/plugin-store';

const CACHE_PATH = 'spx-cache.bin';

let _store: Store | null = null;
async function getCacheStore(): Promise<Store> {
  if (_store) return _store;
  _store = await load(CACHE_PATH);
  return _store;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Get cached data. Returns expired data too (stale-while-revalidate).
 * Caller should refresh in background.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const store = await getCacheStore();
    const entry = await store.get<CacheEntry<T>>(key);
    if (!entry) return null;
    return entry.data; // Return even if expired - caller decides
  } catch {
    return null;
  }
}

/**
 * Check if cached data exists and is still fresh (not expired)
 */
export async function isCacheFresh(key: string): Promise<boolean> {
  try {
    const store = await getCacheStore();
    const entry = await store.get<CacheEntry<unknown>>(key);
    if (!entry) return false;
    return Date.now() <= entry.expiresAt;
  } catch {
    return false;
  }
}

/**
 * Store data with TTL
 */
export async function setCache<T>(key: string, data: T, ttlMs: number): Promise<void> {
  try {
    const store = await getCacheStore();
    await store.set(key, { data, expiresAt: Date.now() + ttlMs });
    await store.save();
  } catch (e) {
    console.warn('[Cache] Failed to save:', key, e);
  }
}

/**
 * Clear all cached data (useful on logout)
 */
export async function clearCache(): Promise<void> {
  try {
    _store = null; // Force reload
    const store = await getCacheStore();
    await store.clear();
    await store.save();
  } catch (e) {
    console.warn('[Cache] Failed to clear:', e);
  }
}
