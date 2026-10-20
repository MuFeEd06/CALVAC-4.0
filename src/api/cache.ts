type Entry = { expires: number; value: unknown };
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export const PUBLIC_CACHE_KEY = 'calvac_public_cache_v1';
const publicKey = (key: string) => /^\/api\/(products(?:\?|$)|site-settings$|offer$)/.test(key);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const productValue = (value: unknown) => record(value) && Number.isSafeInteger(value.id) && Number(value.id) > 0
  && typeof value.name === 'string' && typeof value.image === 'string' && typeof value.price === 'number' && Number.isFinite(value.price) && value.price >= 0;
function publicValue(key: string, value: unknown): boolean {
  if (key.startsWith('/api/products?')) {
    if (new URLSearchParams(key.split('?')[1]).has('id')) return value === null || productValue(value);
    return record(value) && Array.isArray(value.items) && value.items.every(productValue)
      && (value.nextCursor === null || typeof value.nextCursor === 'string');
  }
  return record(value);
}

/** Only public catalog/settings data may reach disk. Search text and accounts cannot. */
export class PublicCacheStorage {
  constructor(private storage: () => StorageLike | undefined, private now = () => Date.now(), private maxBytes = 512 * 1024) {}
  private read(): Record<string, Entry> {
    try {
      const raw = this.storage()?.getItem(PUBLIC_CACHE_KEY);
      if (!raw || raw.length * 2 > this.maxBytes) return {};
      const entries = JSON.parse(raw);
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return {};
      return Object.fromEntries(Object.entries(entries).filter(([key, value]) => {
        const entry = value as Entry | null;
        return publicKey(key) && entry && typeof entry === 'object' && Number.isFinite(entry.expires)
          && entry.expires > this.now() && publicValue(key, entry.value);
      })) as Record<string, Entry>;
    } catch { return {}; }
  }
  get(key: string, ttl: number): Entry | undefined {
    if (!publicKey(key)) return;
    const entry = this.read()[key];
    return entry && entry.expires <= this.now() + ttl ? entry : undefined;
  }
  set(key: string, entry: Entry) {
    if (!publicKey(key)) return;
    const entries = this.read();
    delete entries[key]; entries[key] = entry;
    let serialized = JSON.stringify(entries);
    while (Object.keys(entries).length > 40 || serialized.length * 2 > this.maxBytes) {
      delete entries[Object.keys(entries)[0]];
      serialized = JSON.stringify(entries);
    }
    try { this.storage()?.setItem(PUBLIC_CACHE_KEY, serialized); } catch { /* Quota/private mode: keep memory usable. */ }
  }
  invalidate(prefix: string) {
    const entries = this.read();
    for (const key of Object.keys(entries)) if (key.startsWith(prefix)) delete entries[key];
    try { this.storage()?.setItem(PUBLIC_CACHE_KEY, JSON.stringify(entries)); } catch { /* Storage is optional. */ }
  }
}

/** No background polling: expiry is checked on use; concurrent loads share one request. */
export class TimedCache {
  private values = new Map<string, Entry>();
  private pending = new Map<string, Promise<unknown>>();
  constructor(private now = () => Date.now(), private maxEntries = 100, private disk?: PublicCacheStorage) {}

  peek<T>(key: string): T | undefined {
    const entry = this.values.get(key);
    if (!entry || entry.expires <= this.now()) { this.values.delete(key); return; }
    this.values.delete(key); this.values.set(key, entry);
    return entry.value as T;
  }
  set<T>(key: string, ttl: number, value: T, persist = false) {
    const entry = { expires: this.now() + ttl, value };
    this.values.delete(key);
    if (this.values.size >= this.maxEntries) this.values.delete(this.values.keys().next().value!);
    this.values.set(key, entry);
    if (persist) this.disk?.set(key, entry);
  }

  async get<T>(key: string, ttl: number, load: () => Promise<T>, persist = false): Promise<T> {
    const cached = this.peek<T>(key);
    if (cached !== undefined) return cached;
    const saved = persist ? this.disk?.get(key, ttl) : undefined;
    if (saved) {
      if (this.values.size >= this.maxEntries) this.values.delete(this.values.keys().next().value!);
      this.values.set(key, saved); return saved.value as T;
    }
    const pending = this.pending.get(key);
    if (pending) return pending as Promise<T>;
    const request = Promise.resolve().then(load).then(value => {
      if (this.pending.get(key) === request) this.set(key, ttl, value, persist);
      return value;
    }).finally(() => { if (this.pending.get(key) === request) this.pending.delete(key); });
    this.pending.set(key, request);
    return request;
  }

  invalidateMemory(prefix = '') {
    for (const key of this.values.keys()) if (key.startsWith(prefix)) this.values.delete(key);
    for (const key of this.pending.keys()) if (key.startsWith(prefix)) this.pending.delete(key);
  }
  invalidate(prefix = '') { this.invalidateMemory(prefix); this.disk?.invalidate(prefix); }
}
