/** A cancellable, bounded frame window. It never preloads the complete sequence. */
export class FrameBuffer<T> {
  private cache = new Map<number, T>();
  private pending = new Map<number, AbortController>();
  private wanted: number[] = [];
  private failed = new Set<number>();
  private stopped = false;

  constructor(private options: {
    count: number; radius: number; concurrency?: number;
    load: (index: number, signal: AbortSignal) => Promise<T>;
    release: (frame: T) => void;
    onReady: (index: number, frame: T) => void;
    onError?: (index: number) => void;
  }) {}

  request(index: number) {
    if (this.stopped) return;
    index = Math.max(0, Math.min(this.options.count - 1, Math.round(index)));
    const wanted = [index];
    for (let distance = 1; distance <= this.options.radius; distance++) {
      if (index + distance < this.options.count) wanted.push(index + distance);
      if (index - distance >= 0) wanted.push(index - distance);
    }
    if (!wanted.includes(0)) wanted.push(0);
    this.wanted = wanted;
    for (const [i, controller] of this.pending) if (!wanted.includes(i)) controller.abort();
    for (const [i, frame] of this.cache) {
      if (!wanted.includes(i)) { this.options.release(frame); this.cache.delete(i); }
    }
    this.pump();
  }

  nearest(index: number): T | undefined {
    let best: T | undefined;
    let distance = Infinity;
    for (const [i, frame] of this.cache) {
      if (Math.abs(i - index) < distance) { distance = Math.abs(i - index); best = frame; }
    }
    return best;
  }

  get size() { return this.cache.size; }

  private pump() {
    if (this.stopped) return;
    while (this.pending.size < (this.options.concurrency ?? 2)) {
      const index = this.wanted.find(i => !this.cache.has(i) && !this.pending.has(i) && !this.failed.has(i));
      if (index === undefined) break;
      const controller = new AbortController();
      this.pending.set(index, controller);
      this.options.load(index, controller.signal).then(frame => {
        if (this.stopped || controller.signal.aborted || !this.wanted.includes(index)) {
          this.options.release(frame);
          return;
        }
        this.cache.set(index, frame);
        this.options.onReady(index, frame);
      }).catch(() => {
        if (!controller.signal.aborted && !this.stopped) {
          this.failed.add(index);
          this.options.onError?.(index);
        }
      }).finally(() => { this.pending.delete(index); this.pump(); });
    }
  }

  dispose() {
    this.stopped = true;
    for (const controller of this.pending.values()) controller.abort();
    for (const frame of this.cache.values()) this.options.release(frame);
    this.pending.clear(); this.cache.clear(); this.wanted = [];
  }
}
