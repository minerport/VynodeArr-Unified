import { ReadOnlyEngineClient } from '../../platform/src/read-only-engine-client.js';
import { engineError } from '../../platform/src/engine-errors.js';
import { calendarItem, historyItem, movieDetails, movieSummary, queueItem } from '../../contracts/src/mappers.js';

const records = (value) => Array.isArray(value) ? value : Array.isArray(value?.records) ? value.records : null;
const numericId = (id) => Number(String(id).replace(/^movie_/, ''));

export class MovieEngineAdapter {
  constructor(config, client = new ReadOnlyEngineClient(config, 'Movie')) { this.config = config; this.client = client; }
  async #context() {
    const [queue, cutoff] = await Promise.allSettled([this.getQueue(), this.client.get('wanted/cutoff', { page: 1, pageSize: 1000 })]);
    const queueById = new Map((queue.value || []).filter((item) => item.mediaId).map((item) => [numericId(item.mediaId), item]));
    const cutoffIds = new Set((records(cutoff.value) || []).map((item) => item.id));
    return { queueById, cutoffIds };
  }
  async listMovies({ limit = 5000 } = {}) {
    const value = await this.client.get('movie');
    if (!Array.isArray(value)) throw engineError.invalid();
    const context = await this.#context();
    try { return value.slice(0, limit).map((record) => movieSummary(record, context)); }
    catch { throw engineError.invalid(); }
  }
  async getMovie(id) {
    const engineId = numericId(id);
    if (!Number.isFinite(engineId)) return null;
    try {
      const [record, history, calendar, context] = await Promise.all([
        this.client.get(`movie/${engineId}`),
        this.getHistory({ mediaId: engineId, limit: 20 }),
        this.getCalendar(),
        this.#context()
      ]);
      return movieDetails(record, { ...context, history, calendar: calendar.filter((item) => item.mediaId === `movie_${engineId}`) });
    } catch (error) { if (error.code) throw error; throw engineError.invalid(); }
  }
  async getQueue() {
    const value = await this.client.get('queue', { page: 1, pageSize: 1000, includeMovie: true });
    const items = records(value); if (!items) throw engineError.invalid();
    return items.map((record) => queueItem(record, 'movie'));
  }
  async getHistory({ mediaId, limit = 100 } = {}) {
    const value = await this.client.get('history', { page: 1, pageSize: limit, movieId: mediaId, includeMovie: true });
    const items = records(value); if (!items) throw engineError.invalid();
    return items.map((record) => historyItem(record, 'movie'));
  }
  async getCalendar() {
    const value = await this.client.get('calendar', { unmonitored: true });
    if (!Array.isArray(value)) throw engineError.invalid();
    return value.map((record) => calendarItem(record, 'movie'));
  }
  async getHealth() {
    const value = await this.client.get('health'); if (!Array.isArray(value)) throw engineError.invalid();
    return value.map((item, index) => ({ id: `movie_health_${index}`, domain: 'movie', severity: item.type || 'notice', message: item.message || 'Movie service notice' }));
  }
  async getSystemStatus() {
    const value = await this.client.get('system/status');
    return { domain: 'movie', version: String(value?.version || ''), compatible: Boolean(value?.version), mode: 'read_only' };
  }
  async testConnection() {
    const started = Date.now();
    try {
      const status = await this.getSystemStatus();
      return { enabled: this.config.enabled, reachable: true, authenticated: true, compatible: status.compatible, latencyMs: Date.now() - started, capabilities: ['library','details','queue','history','calendar','health','status'], safeError: null };
    } catch (error) {
      return { enabled: this.config.enabled, reachable: false, authenticated: error.code !== 'engine_authentication_failed', compatible: false, latencyMs: Date.now() - started, capabilities: [], safeError: error.safeMessage || 'Movie service unavailable' };
    }
  }
}
