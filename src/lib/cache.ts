const CACHE_PATH = 'spx-cache.bin';

// Cache TTLs
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CONTENT_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

let _store: any = null;
async function getCacheStore(): Promise<any> {
  if (_store) return _store;
  try {
    const { load } = await import('@tauri-apps/plugin-store');
    _store = await load(CACHE_PATH);
  } catch {
    _store = {
      get: async () => null,
      set: async () => {},
      save: async () => {},
      delete: async () => {},
      clear: async () => {},
    };
  }
  return _store;
}

export async function getCached(key: string): Promise<any> {
  try {
    const store = await getCacheStore();
    const entry = await store.get(key);
    if (!entry) return null;
    // Return stale data (caller can check isCacheFresh to decide whether to refresh).
    return entry.data;
  } catch {
    return null;
  }
}

export async function setCache(key: string, data: any, ttl: number): Promise<void> {
  try {
    const store = await getCacheStore();
    await store.set(key, { data, expiresAt: Date.now() + ttl });
    await store.save();
  } catch {}
}

export async function isCacheFresh(key: string): Promise<boolean> {
  try {
    const store = await getCacheStore();
    const entry = await store.get(key);
    if (!entry) return false;
    return Date.now() <= entry.expiresAt;
  } catch {
    return false;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const store = await getCacheStore();
    await store.clear();
    await store.save();
  } catch {}
}

// ─── Search Cache ────────────────────────────────────────────────────────────

/**
 * Get cached search results if fresh
 */
export async function getSearchCache(query: string): Promise<any | null> {
  const cacheKey = `search:${query.toLowerCase().trim()}`;
  if (await isCacheFresh(cacheKey)) {
    return getCached(cacheKey);
  }
  return null;
}

/**
 * Cache search results with TTL
 */
export async function setSearchCache(query: string, results: any): Promise<void> {
  const cacheKey = `search:${query.toLowerCase().trim()}`;
  await setCache(cacheKey, results, SEARCH_CACHE_TTL);
}

/**
 * Search with caching - returns cached results if available and fresh,
 * otherwise fetches fresh results and caches them.
 */
export async function searchWithCache<T>(
  query: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await getSearchCache(query);
  if (cached !== null) {
    return cached;
  }
  
  const results = await fetcher();
  await setSearchCache(query, results);
  return results;
}

// ─── Content Cache ───────────────────────────────────────────────────────────

/**
 * Get cached content (playlists, albums, etc.) if fresh
 */
export async function getContentCache<T>(key: string): Promise<T | null> {
  const cacheKey = `content:${key}`;
  if (await isCacheFresh(cacheKey)) {
    return getCached(cacheKey);
  }
  return null;
}

/**
 * Cache content with TTL
 */
export async function setContentCache<T>(key: string, content: T): Promise<void> {
  const cacheKey = `content:${key}`;
  await setCache(cacheKey, content, CONTENT_CACHE_TTL);
}
