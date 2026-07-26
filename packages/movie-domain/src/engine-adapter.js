import { ReadOnlyEngineClient } from '../../platform/src/read-only-engine-client.js';
import { engineError } from '../../platform/src/engine-errors.js';
import { calendarItem, completedQueueItemHasArrived, completedQueueItemIsTerminal, historyItem, movieDetails, movieSummary, queueItem } from '../../contracts/src/mappers.js';

const records = (value) => Array.isArray(value) ? value : Array.isArray(value?.records) ? value.records : null;
const numericId = (id) => Number(String(id).replace(/^movie_/, ''));

export class MovieEngineAdapter {
  constructor(config, client = new ReadOnlyEngineClient(config, 'Movie')) { this.config = config; this.client = client; }
  async getAttentionSummary() {
    const [missing, cutoff] = await Promise.all([
      this.client.get('wanted/missing', { page: 1, pageSize: 1, monitored: true }),
      this.client.get('wanted/cutoff', { page: 1, pageSize: 1, monitored: true })
    ]);
    const count = value => Number.isFinite(Number(value?.totalRecords)) ? Number(value.totalRecords) : (records(value) || []).length;
    return { missing: count(missing), cutoff: count(cutoff) };
  }
  async #cutoffIds() {
    const pageSize=1000,ids=new Set();
    for(let page=1;page<=100;page+=1){
      const value=await this.client.get('wanted/cutoff',{page,pageSize});
      const pageRecords=records(value);
      if(!pageRecords)break;
      for(const item of pageRecords)ids.add(item.id);
      const total=Number(value?.totalRecords);
      if(pageRecords.length<pageSize||(Number.isFinite(total)&&ids.size>=total))break;
    }
    return ids;
  }
  async #context({includeCutoff=true}={}) {
    const [queue, cutoff] = await Promise.allSettled([this.getQueue(), includeCutoff?this.#cutoffIds():Promise.resolve(new Set())]);
    const queueById = new Map((queue.value || []).filter((item) => item.mediaId).map((item) => [numericId(item.mediaId), item]));
    const cutoffIds = cutoff.value instanceof Set ? cutoff.value : new Set();
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
      const [record, context] = await Promise.all([
        this.client.get(`movie/${engineId}`),
        this.#context({includeCutoff:false})
      ]);
      return movieDetails(record, context);
    } catch (error) { if (error.code) throw error; throw engineError.invalid(); }
  }
  async getQueue() {
    const value = await this.client.get('queue', { page: 1, pageSize: 1000, includeMovie: true });
    const items = records(value); if (!items) throw engineError.invalid();
    return items.filter((record) => !completedQueueItemIsTerminal(record) && !completedQueueItemHasArrived(record, 'movie')).map((record) => queueItem(record, 'movie'));
  }
  async getHistory({ mediaId, limit = 100 } = {}) {
    const value = await this.client.get('history', { page: 1, pageSize: limit, movieId: mediaId, includeMovie: true });
    const items = records(value); if (!items) throw engineError.invalid();
    return items.map((record) => historyItem(record, 'movie'));
  }
  async getHistorySince({ since, pageSize = 250 } = {}) {
    const cutoff=new Date(since),items=[];
    if(Number.isNaN(cutoff.getTime()))throw new TypeError('A valid history start date is required');
    for(let page=1;page<=200;page+=1){
      const value=await this.client.get('history',{page,pageSize,includeMovie:true,sortKey:'date',sortDirection:'descending'});
      const pageRecords=records(value);if(!pageRecords)throw engineError.invalid();
      for(const record of pageRecords){
        const timestamp=new Date(record.date);
        if(!Number.isNaN(timestamp.getTime())&&timestamp>=cutoff)items.push(historyItem(record,'movie'));
      }
      const oldest=pageRecords.at(-1)?.date,total=Number(value?.totalRecords);
      if(!pageRecords.length||pageRecords.length<pageSize||(Number.isFinite(total)&&page*pageSize>=total)||(oldest&&!Number.isNaN(new Date(oldest).getTime())&&new Date(oldest)<cutoff))break;
    }
    return items;
  }
  async getCalendar() {
    const value = await this.client.get('calendar', { unmonitored: true });
    if (!Array.isArray(value)) throw engineError.invalid();
    return value.map((record) => calendarItem(record, 'movie'));
  }
  async getHealth() {
    const value = await this.client.get('health'); if (!Array.isArray(value)) throw engineError.invalid();
    const neutralize=value=>String(value||'').replace(/\bradarr\b/gi,'movie service').replace(/\bsonarr\b/gi,'television service');
    return value.map((item, index) => ({ id: `movie_health_${index}`, domain: 'movie', severity: item.type || 'notice', message: neutralize(item.message)||'Movie service notice', source:item.source?neutralize(item.source):null, wikiUrl:item.wikiUrl||null }));
  }
  async getSystemStatus() {
    const value = await this.client.get('system/status');
    return { domain: 'movie', version: String(value?.version || ''), compatible: Boolean(value?.version), mode: 'read_only' };
  }
  async getArtwork(id,type){return this.client.getArtwork(numericId(id),type);}
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
