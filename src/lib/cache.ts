const CACHE_PATH = 'spx-cache.bin';

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
    if (Date.now() > entry.expiresAt) {
      await store.delete(key);
      await store.save();
      return null;
    }
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
