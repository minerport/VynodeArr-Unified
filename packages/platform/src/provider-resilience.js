const now = () => Date.now();

export class ProviderResilience {
  constructor({ failureThreshold = 3, cooldownMs = 5 * 60_000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.providers = new Map();
  }
  snapshot() {
    return [...this.providers.entries()].map(([id, value]) => ({
      id,
      state: value.openUntil > now() ? "open" : "closed",
      failures: value.failures,
      openUntil: value.openUntil ? new Date(value.openUntil).toISOString() : null,
      lastError: value.lastError || null,
      lastSuccessAt: value.lastSuccessAt || null,
    }));
  }
  async run(id, operation) {
    const state = this.providers.get(id) || { failures: 0, openUntil: 0 };
    if (state.openUntil > now())
      throw new Error(`Provider ${id} is temporarily paused after repeated failures`);
    try {
      const result = await operation();
      state.failures = 0;
      state.openUntil = 0;
      state.lastError = null;
      state.lastSuccessAt = new Date().toISOString();
      this.providers.set(id, state);
      return result;
    } catch (error) {
      state.failures += 1;
      state.lastError = String(error?.message || error).slice(0, 500);
      if (state.failures >= this.failureThreshold)
        state.openUntil = now() + this.cooldownMs;
      this.providers.set(id, state);
      throw error;
    }
  }
}
