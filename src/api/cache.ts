/** Pending requests are deduplicated only while in flight; values expire independently. */
export class TimedCache {
  private values = new Map<string, { expires: number; value: unknown }>();
  private pending = new Map<string, Promise<unknown>>();
  private generation = 0;
  constructor(private now = () => Date.now(), private maxEntries = 100) {}

  async get<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const cached = this.values.get(key);
    if (cached && cached.expires > this.now()) return cached.value as T;
    const pending = this.pending.get(key);
    if (pending) return pending as Promise<T>;
    const generation = this.generation;
    const request = Promise.resolve().then(load).then(value => {
      if (generation === this.generation) {
        if (this.values.size >= this.maxEntries) this.values.delete(this.values.keys().next().value!);
        this.values.set(key, { expires: this.now() + ttl, value });
      }
      return value;
    }).finally(() => { if (this.pending.get(key) === request) this.pending.delete(key); });
    this.pending.set(key, request);
    return request;
  }

  invalidate(prefix = '') {
    this.generation++;
    for (const key of this.values.keys()) if (key.startsWith(prefix)) this.values.delete(key);
    for (const key of this.pending.keys()) if (key.startsWith(prefix)) this.pending.delete(key);
  }
}
