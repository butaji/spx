import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store reference for direct manipulation
let mockStore: Map<string, any>;

// Mock the Tauri store with a shared Map instance
vi.mock('@tauri-apps/plugin-store', () => {
  mockStore = new Map<string, any>();
  return {
    load: vi.fn().mockResolvedValue({
      get: vi.fn(async (key: string) => mockStore.get(key) ?? null),
      set: vi.fn(async (key: string, value: any) => { mockStore.set(key, value); }),
      save: vi.fn(async () => {}),
      delete: vi.fn(async (key: string) => { mockStore.delete(key); }),
      clear: vi.fn(async () => { mockStore.clear(); }),
    }),
  };
});

// Need to reset the module to get fresh _store reference
let cache: typeof import('./cache');
let clearModuleCache: () => void;

beforeEach(async () => {
  // Reset module state between tests
  vi.resetModules();
  // Clear mock store
  mockStore?.clear();
  // Import fresh module
  cache = await import('./cache');
});

describe('cache - basic operations', () => {
  // Test 1: getCached returns null for missing keys
  it('returns null for missing key', async () => {
    const result = await cache.getCached('nonexistent-key');
    expect(result).toBeNull();
  });

  it('returns null for empty store', async () => {
    const result = await cache.getCached('');
    expect(result).toBeNull();
  });

  // Test 2: setCache stores data with TTL
  it('stores data with TTL', async () => {
    const testData = { tracks: [{ id: '1', name: 'Test Track' }] };
    await cache.setCache('test-key', testData, 60000);

    const stored = await cache.getCached('test-key');
    expect(stored).toEqual(testData);
  });

  it('stores primitive values', async () => {
    await cache.setCache('string-key', 'hello', 60000);
    expect(await cache.getCached('string-key')).toBe('hello');

    await cache.setCache('number-key', 42, 60000);
    expect(await cache.getCached('number-key')).toBe(42);

    await cache.setCache('array-key', [1, 2, 3], 60000);
    expect(await cache.getCached('array-key')).toEqual([1, 2, 3]);
  });

  // Test 3: isCacheFresh returns false for expired entries
  it('returns false for expired entries (negative TTL)', async () => {
    await cache.setCache('expired-key', 'data', -1000);
    const isFresh = await cache.isCacheFresh('expired-key');
    expect(isFresh).toBe(false);
  });

  it('returns false for expired entries (past expiresAt)', async () => {
    // Manually set an entry that is already expired
    mockStore.set('already-expired', {
      data: 'old-data',
      expiresAt: Date.now() - 5000, // 5 seconds in the past
    });

    const isFresh = await cache.isCacheFresh('already-expired');
    expect(isFresh).toBe(false);
  });

  it('returns false for non-existent keys', async () => {
    const isFresh = await cache.isCacheFresh('does-not-exist');
    expect(isFresh).toBe(false);
  });

  // Test 4: isCacheFresh returns true for fresh entries
  it('returns true for fresh entries', async () => {
    await cache.setCache('fresh-key', 'data', 60000);
    const isFresh = await cache.isCacheFresh('fresh-key');
    expect(isFresh).toBe(true);
  });

  it('returns true for entries expiring in the future', async () => {
    const farFuture = Date.now() + 3600000; // 1 hour from now
    mockStore.set('future-key', {
      data: 'data',
      expiresAt: farFuture,
    });

    const isFresh = await cache.isCacheFresh('future-key');
    expect(isFresh).toBe(true);
  });

  it('returns true exactly at expiration boundary', async () => {
    const now = Date.now();
    mockStore.set('boundary-key', {
      data: 'data',
      expiresAt: now, // exactly at expiration time
    });

    // Date.now() <= entry.expiresAt means it's still fresh
    const isFresh = await cache.isCacheFresh('boundary-key');
    expect(isFresh).toBe(true);
  });
});

describe('searchWithCache', () => {
  // Test 5: searchWithCache returns cached data when fresh
  it('returns cached data when fresh', async () => {
    const cachedResults = { tracks: [{ id: '1', name: 'Cached' }] };

    // Pre-populate cache with fresh data
    await cache.setCache('search:test query', cachedResults, 60000);

    // Fetcher should NOT be called
    const fetcher = vi.fn().mockResolvedValue({ tracks: [{ id: '2', name: 'Fresh' }] });

    const result = await cache.searchWithCache('test query', fetcher);

    expect(result).toEqual(cachedResults);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('handles case-insensitive queries', async () => {
    const cachedResults = { tracks: [] };

    // Cache with lowercase
    await cache.setCache('search:test query', cachedResults, 60000);

    const fetcher = vi.fn().mockResolvedValue({ tracks: [] });

    // Query with different case
    const result = await cache.searchWithCache('TEST Query', fetcher);

    expect(result).toEqual(cachedResults);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('trims whitespace from queries', async () => {
    const cachedResults = { tracks: [] };

    // Cache without whitespace
    await cache.setCache('search:test', cachedResults, 60000);

    const fetcher = vi.fn().mockResolvedValue({ tracks: [] });

    // Query with whitespace
    const result = await cache.searchWithCache('  test  ', fetcher);

    expect(result).toEqual(cachedResults);
    expect(fetcher).not.toHaveBeenCalled();
  });

  // Test 6: searchWithCache fetches fresh data when cache expired
  it('fetches fresh data when cache expired', async () => {
    const freshResults = { tracks: [{ id: '2', name: 'Fresh' }] };

    // Pre-populate cache with expired data
    mockStore.set('search:old query', {
      data: { tracks: [{ id: '1', name: 'Old' }] },
      expiresAt: Date.now() - 1000, // 1 second ago
    });

    const fetcher = vi.fn().mockResolvedValue(freshResults);

    const result = await cache.searchWithCache('old query', fetcher);

    expect(result).toEqual(freshResults);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fetches fresh data when cache missing', async () => {
    const freshResults = { tracks: [{ id: '1', name: 'Fresh' }] };
    const fetcher = vi.fn().mockResolvedValue(freshResults);

    const result = await cache.searchWithCache('never cached', fetcher);

    expect(result).toEqual(freshResults);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  // Test 7: searchWithCache caches fresh results
  it('caches fresh results after fetching', async () => {
    const freshResults = { tracks: [{ id: '1', name: 'Fetched' }] };
    const fetcher = vi.fn().mockResolvedValue(freshResults);

    // First call - should fetch and cache
    const result1 = await cache.searchWithCache('new query', fetcher);
    expect(result1).toEqual(freshResults);

    // Verify it was cached
    const cached = await cache.getCached('search:new query');
    expect(cached).toEqual(freshResults);

    // Verify isCacheFresh returns true for the cached search
    const isFresh = await cache.isCacheFresh('search:new query');
    expect(isFresh).toBe(true);
  });

  it('subsequent call returns cached data without calling fetcher', async () => {
    const freshResults = { tracks: [{ id: '1', name: 'Fetched' }] };
    const fetcher = vi.fn().mockResolvedValue(freshResults);

    // First call
    await cache.searchWithCache('cached query', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const result2 = await cache.searchWithCache('cached query', fetcher);
    expect(result2).toEqual(freshResults);
    expect(fetcher).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it('handles different queries independently', async () => {
    const results1 = { tracks: [{ id: '1', name: 'Query 1' }] };
    const results2 = { tracks: [{ id: '2', name: 'Query 2' }] };

    const fetcher1 = vi.fn().mockResolvedValue(results1);
    const fetcher2 = vi.fn().mockResolvedValue(results2);

    const result1 = await cache.searchWithCache('query one', fetcher1);
    const result2 = await cache.searchWithCache('query two', fetcher2);

    expect(result1).toEqual(results1);
    expect(result2).toEqual(results2);
    expect(fetcher1).toHaveBeenCalledTimes(1);
    expect(fetcher2).toHaveBeenCalledTimes(1);
  });

  it('handles complex nested data structures', async () => {
    const complexResults = {
      tracks: [
        { id: '1', name: 'Track 1', artists: [{ id: 'a', name: 'Artist A' }] },
        { id: '2', name: 'Track 2', artists: [{ id: 'b', name: 'Artist B' }] },
      ],
      total: 2,
      pagination: { page: 1, totalPages: 10 },
    };

    const fetcher = vi.fn().mockResolvedValue(complexResults);

    const result = await cache.searchWithCache('complex', fetcher);

    expect(result).toEqual(complexResults);
    expect(result.tracks[0].artists[0].name).toBe('Artist A');
  });
});

describe('content cache', () => {
  // Test 8: content cache with specific TTLs

  it('getContentCache returns null for missing key', async () => {
    const result = await cache.getContentCache('nonexistent-content');
    expect(result).toBeNull();
  });

  it('getContentCache returns null for expired content', async () => {
    // Content cache TTL is 2 minutes, set it to expired
    mockStore.set('content:playlist-123', {
      data: { name: 'Old Playlist' },
      expiresAt: Date.now() - 1000,
    });

    const result = await cache.getContentCache('playlist-123');
    expect(result).toBeNull();
  });

  it('getContentCache returns data when fresh', async () => {
    const playlistData = { name: 'My Playlist', tracks: ['track1', 'track2'] };
    await cache.setContentCache('playlist-123', playlistData);

    const result = await cache.getContentCache('playlist-123');
    expect(result).toEqual(playlistData);
  });

  it('setContentCache stores with correct TTL (2 minutes)', async () => {
    const albumData = { name: 'Album', year: 2024 };
    await cache.setContentCache('album-456', albumData);

    // Verify it's cached
    const cached = await cache.getCached('content:album-456');
    expect(cached).toEqual(albumData);

    // Verify it's fresh (should be within 2 minutes)
    const isFresh = await cache.isCacheFresh('content:album-456');
    expect(isFresh).toBe(true);

    // Verify the TTL is approximately 2 minutes (120000ms)
    const entry = mockStore.get('content:album-456');
    const ttl = entry.expiresAt - Date.now();
    expect(ttl).toBeGreaterThan(119000); // Allow 1 second tolerance
    expect(ttl).toBeLessThanOrEqual(120000);
  });

  it('content cache uses "content:" prefix', async () => {
    await cache.setContentCache('my-key', { data: 'value' });

    // Should be stored under content: prefix
    const entry = mockStore.get('content:my-key');
    expect(entry).toBeDefined();
    expect(entry.data).toEqual({ data: 'value' });

    // Should NOT be accessible without prefix
    const noPrefix = await cache.getCached('my-key');
    expect(noPrefix).toBeNull();
  });

  it('content cache is independent of search cache', async () => {
    // Set search cache
    await cache.setSearchCache('test search', { search: 'results' });

    // Set content cache
    await cache.setContentCache('playlist-1', { playlist: 'data' });

    // Verify they are stored separately
    const searchCached = await cache.getCached('search:test search');
    const contentCached = await cache.getCached('content:playlist-1');

    expect(searchCached).toEqual({ search: 'results' });
    expect(contentCached).toEqual({ playlist: 'data' });

    // Verify prefixes are different
    const searchEntry = mockStore.get('search:test search');
    const contentEntry = mockStore.get('content:playlist-1');

    expect(searchEntry).toBeDefined();
    expect(contentEntry).toBeDefined();
    expect(searchEntry).not.toBe(contentEntry);
  });

  it('different content types can be cached independently', async () => {
    const playlist = { type: 'playlist', name: 'My Playlist' };
    const album = { type: 'album', name: 'My Album' };
    const artist = { type: 'artist', name: 'My Artist' };

    await cache.setContentCache('playlist-1', playlist);
    await cache.setContentCache('album-1', album);
    await cache.setContentCache('artist-1', artist);

    const resultPlaylist = await cache.getContentCache('playlist-1');
    const resultAlbum = await cache.getContentCache('album-1');
    const resultArtist = await cache.getContentCache('artist-1');

    expect(resultPlaylist).toEqual(playlist);
    expect(resultAlbum).toEqual(album);
    expect(resultArtist).toEqual(artist);
  });

  it('content cache can store various data types', async () => {
    // Array
    await cache.setContentCache('array-content', [1, 2, 3]);
    expect(await cache.getContentCache('array-content')).toEqual([1, 2, 3]);

    // String
    await cache.setContentCache('string-content', 'hello');
    expect(await cache.getContentCache('string-content')).toBe('hello');

    // Number
    await cache.setContentCache('number-content', 42);
    expect(await cache.getContentCache('number-content')).toBe(42);

    // Boolean
    await cache.setContentCache('boolean-content', true);
    expect(await cache.getContentCache('boolean-content')).toBe(true);

    // Null
    await cache.setContentCache('null-content', null);
    expect(await cache.getContentCache('null-content')).toBeNull();
  });
});

describe('clearCache', () => {
  it('clears all cached data', async () => {
    // Add various types of cache
    await cache.setCache('simple-key', 'value', 60000);
    await cache.setSearchCache('search term', { results: [] });
    await cache.setContentCache('playlist-1', { name: 'Playlist' });

    // Verify they exist
    expect(await cache.getCached('simple-key')).toBe('value');
    expect(await cache.getSearchCache('search term')).not.toBeNull();
    expect(await cache.getContentCache('playlist-1')).not.toBeNull();

    // Clear
    await cache.clearCache();

    // Verify all are gone
    expect(await cache.getCached('simple-key')).toBeNull();
    expect(await cache.getSearchCache('search term')).toBeNull();
    expect(await cache.getContentCache('playlist-1')).toBeNull();
  });

  it('isCacheFresh returns false for all keys after clear', async () => {
    await cache.setCache('key-1', 'data', 60000);
    await cache.setCache('key-2', 'data', 60000);

    await cache.clearCache();

    expect(await cache.isCacheFresh('key-1')).toBe(false);
    expect(await cache.isCacheFresh('key-2')).toBe(false);
  });
});

describe('search cache TTL', () => {
  it('search cache uses 5 minute TTL', async () => {
    await cache.setSearchCache('ttl-test', { results: [] });

    const entry = mockStore.get('search:ttl-test');
    const ttl = entry.expiresAt - Date.now();

    // 5 minutes = 300000ms, allow 1 second tolerance
    expect(ttl).toBeGreaterThan(299000);
    expect(ttl).toBeLessThanOrEqual(300000);
  });

  it('search cache entries expire after TTL', async () => {
    // Manually set search cache with past expiration
    mockStore.set('search:expired-search', {
      data: { tracks: [] },
      expiresAt: Date.now() - 1000,
    });

    const cached = await cache.getSearchCache('expired-search');
    expect(cached).toBeNull();
  });
});
