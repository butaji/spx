/**
 * Simple localStorage-based caching for Spotify API responses.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  cachedAt: number;
}

const PREFIX = 'spx_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

function getEntry<T>(cacheKey: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + cacheKey);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(PREFIX + cacheKey);
      return null;
    }
    return entry;
  } catch { return null; }
}

// ─── Simple Cache Functions ─────────────────────────────────────────────────────

export async function getCached<T>(cacheKey: string): Promise<T | null> {
  const entry = getEntry<T>(cacheKey);
  return entry?.data ?? null;
}

export async function setCache<T>(cacheKey: string, data: T, ttlMs = DEFAULT_TTL): Promise<void> {
  const entry: CacheEntry<T> = { data, cachedAt: Date.now(), expiresAt: Date.now() + ttlMs };
  try {
    localStorage.setItem(PREFIX + cacheKey, JSON.stringify(entry));
  } catch (e) {
    console.warn('[Cache] Failed to write:', e);
  }
}

export async function isCacheFresh(cacheKey: string): Promise<boolean> {
  return getEntry(cacheKey) !== null;
}

export function clearCache(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
}


