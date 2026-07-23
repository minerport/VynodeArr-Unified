import { ReadOnlyEngineClient } from '../../platform/src/read-only-engine-client.js';
import { engineError } from '../../platform/src/engine-errors.js';
import { calendarItem, historyItem, queueItem, seriesDetails, seriesSummary } from '../../contracts/src/mappers.js';

const records = (value) => Array.isArray(value) ? value : Array.isArray(value?.records) ? value.records : null;
const numericId = (id) => Number(String(id).replace(/^series_/, ''));

export class TvEngineAdapter {
  constructor(config, client = new ReadOnlyEngineClient(config, 'TV')) { this.config = config; this.client = client; }
  async #context() {
    const queue = await this.getQueue().catch(() => []);
    return { queueById: new Map(queue.filter((item) => item.mediaId).map((item) => [numericId(item.mediaId), item])) };
  }
  async listSeries({ limit = 5000 } = {}) {
    const value = await this.client.get('series');
    if (!Array.isArray(value)) throw engineError.invalid();
    const context = await this.#context();
    try { return value.slice(0, limit).map((record) => seriesSummary(record, context)); }
    catch { throw engineError.invalid(); }
  }
  async getSeries(id) {
    const engineId = numericId(id); if (!Number.isFinite(engineId)) return null;
    try {
      const [record, episodes, context] = await Promise.all([
        this.client.get(`series/${engineId}`), this.client.get('episode', { seriesId: engineId, includeEpisodeFile: true }),
        this.#context()
      ]);
      if (!Array.isArray(episodes)) throw engineError.invalid();
      return seriesDetails(record, episodes, context);
    } catch (error) { if (error.code) throw error; throw engineError.invalid(); }
  }
  async getQueue() {
    const value = await this.client.get('queue', { page: 1, pageSize: 1000, includeSeries: true, includeEpisode: true });
    const items = records(value); if (!items) throw engineError.invalid();
    return items.map((record) => queueItem(record, 'tv'));
  }
  async getHistory({ mediaId, limit = 100 } = {}) {
    const value = await this.client.get('history', { page: 1, pageSize: limit, seriesId: mediaId, includeSeries: true });
    const items = records(value); if (!items) throw engineError.invalid();
    return items.map((record) => historyItem(record, 'tv'));
  }
  async getCalendar() {
    const value = await this.client.get('calendar', { unmonitored: true, includeSeries: true });
    if (!Array.isArray(value)) throw engineError.invalid();
    return value.map((record) => calendarItem(record, 'tv'));
  }
  async getHealth() {
    const value = await this.client.get('health'); if (!Array.isArray(value)) throw engineError.invalid();
    const neutralize=value=>String(value||'').replace(/\bradarr\b/gi,'movie service').replace(/\bsonarr\b/gi,'television service');
    return value.map((item, index) => ({ id: `tv_health_${index}`, domain: 'tv', severity: item.type || 'notice', message: neutralize(item.message)||'TV service notice', source:item.source?neutralize(item.source):null, wikiUrl:item.wikiUrl||null }));
  }
  async getSystemStatus() {
    const value = await this.client.get('system/status');
    return { domain: 'tv', version: String(value?.version || ''), compatible: Boolean(value?.version), mode: 'read_only' };
  }
  async getArtwork(id,type){return this.client.getArtwork(numericId(id),type);}
  async testConnection() {
    const started = Date.now();
    try {
      const status = await this.getSystemStatus();
      return { enabled: this.config.enabled, reachable: true, authenticated: true, compatible: status.compatible, latencyMs: Date.now() - started, capabilities: ['library','details','episodes','queue','history','calendar','health','status'], safeError: null };
    } catch (error) {
      return { enabled: this.config.enabled, reachable: false, authenticated: error.code !== 'engine_authentication_failed', compatible: false, latencyMs: Date.now() - started, capabilities: [], safeError: error.safeMessage || 'TV service unavailable' };
    }
  }
}
