interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttlMs: number;
}

export class StorybookCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs = this.DEFAULT_TTL): void {
    this.cache.set(key, { data, fetchedAt: Date.now(), ttlMs });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}
