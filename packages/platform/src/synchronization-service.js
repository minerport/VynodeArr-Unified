export class SynchronizationService {
  constructor({ movie, tv, maxItems = 5000, pollIntervalMs = 300000 }) {
    this.engines = { movie, tv };
    this.maxItems = maxItems;
    this.pollIntervalMs = pollIntervalMs;
    this.cache = new Map();
    this.state = {
      movie: { status: 'idle', lastSuccess: null, lastFailure: null, durationMs: null, itemCount: 0 },
      tv: { status: 'idle', lastSuccess: null, lastFailure: null, durationMs: null, itemCount: 0 }
    };
  }
  async synchronize(domain) {
    const started = Date.now();
    this.state[domain].status = 'synchronizing';
    try {
      const items = domain === 'movie' ? await this.engines.movie.listMovies({ limit: this.maxItems }) : await this.engines.tv.listSeries({ limit: this.maxItems });
      const bounded = items.slice(0, this.maxItems);
      this.cache.set(domain, { items: bounded, cachedAt: new Date().toISOString() });
      Object.assign(this.state[domain], { status: 'ready', lastSuccess: new Date().toISOString(), lastFailure: null, durationMs: Date.now() - started, itemCount: bounded.length });
      return bounded;
    } catch (error) {
      Object.assign(this.state[domain], { status: this.cache.has(domain) ? 'stale' : 'unavailable', lastFailure: new Date().toISOString(), safeError: error.safeMessage || `${domain === 'movie' ? 'Movie' : 'TV'} service unavailable`, durationMs: Date.now() - started });
      if (this.cache.has(domain)) return this.cache.get(domain).items;
      throw error;
    }
  }
  async list(domain, { refresh = false } = {}) {
    if (!refresh && this.cache.has(domain)) return this.cache.get(domain).items;
    return this.synchronize(domain);
  }
  invalidate(domain) { if (domain) this.cache.delete(domain); else this.cache.clear(); }
  snapshot() { return structuredClone(this.state); }
  async startup() { return Promise.allSettled(['movie', 'tv'].map((domain) => this.synchronize(domain))); }
  startPolling() {
    this.stopPolling();
    this.timer = setInterval(() => this.startup(), this.pollIntervalMs);
    this.timer.unref?.();
  }
  stopPolling() { if (this.timer) clearInterval(this.timer); }
}
