import { ReadOnlyEngineClient } from '../../platform/src/read-only-engine-client.js';
import { engineError } from '../../platform/src/engine-errors.js';
import { calendarItem, completedQueueItemHasArrived, completedQueueItemIsTerminal, fileMetadata, historyItem, queueItem, seriesDetails, seriesSummary } from '../../contracts/src/mappers.js';

const records = (value) => Array.isArray(value) ? value : Array.isArray(value?.records) ? value.records : null;
const numericId = (id) => Number(String(id).replace(/^series_/, ''));

export class TvEngineAdapter {
  constructor(config, client = new ReadOnlyEngineClient(config, 'TV')) { this.config = config; this.client = client; }
  async getAttentionSummary() {
    const [missing, cutoff] = await Promise.all([
      this.client.get('wanted/missing', { page: 1, pageSize: 1, monitored: true }),
      this.client.get('wanted/cutoff', { page: 1, pageSize: 1, monitored: true })
    ]);
    const count = value => Number.isFinite(Number(value?.totalRecords)) ? Number(value.totalRecords) : (records(value) || []).length;
    return { missing: count(missing), cutoff: count(cutoff) };
  }
  async #context({includeMissing=true}={}) {
    const [queue, missing] = await Promise.all([
      this.getQueue().catch(() => []),
      includeMissing?this.client.get('wanted/missing', { page: 1, pageSize: 10000, monitored: true, includeSeries: false }).catch(() => null):Promise.resolve(null)
    ]);
    const monitoredMissingBySeriesId = new Map();
    for (const episode of records(missing) || []) {
      if (episode?.monitored === false) continue;
      const seriesId = Number(episode?.seriesId || episode?.series?.id);
      if (Number.isFinite(seriesId)) monitoredMissingBySeriesId.set(seriesId, (monitoredMissingBySeriesId.get(seriesId) || 0) + 1);
    }
    return {
      queueById: new Map(queue.filter((item) => item.mediaId).map((item) => [numericId(item.mediaId), item])),
      monitoredMissingBySeriesId
    };
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
      const [record, episodes] = await Promise.all([
        this.client.get(`series/${engineId}`), this.client.get('episode', { seriesId: engineId, includeEpisodeFile: true })
      ]);
      if (!Array.isArray(episodes)) throw engineError.invalid();
      const context={queueById:new Map(),monitoredMissingBySeriesId:new Map()};
      context.monitoredMissingBySeriesId.set(engineId, record?.monitored === false ? 0 : episodes.filter((episode) => episode.monitored !== false && !episode.hasFile).length);
      return seriesDetails(record, episodes, context);
    } catch (error) { if (error.code) throw error; throw engineError.invalid(); }
  }
  async getSeriesSummary(id) {
    const engineId=numericId(id);if(!Number.isFinite(engineId))return null;
    try { const [record,context]=await Promise.all([this.client.getOptional(`series/${engineId}`),this.#context({includeMissing:false})]);return record?seriesSummary(record,context):null; }
    catch(error){if(error.code)throw error;throw engineError.invalid();}
  }
  async getSeriesFileMetadata(id) {
    const engineId=numericId(id);if(!Number.isFinite(engineId))return[];
    const value=await this.client.get('episodefile',{seriesId:engineId});const items=records(value)||value;
    if(!Array.isArray(items))throw engineError.invalid();return items.map(fileMetadata).filter(Boolean);
  }
  async getSeriesOverlayMetadata(id) {
    const engineId=numericId(id);if(!Number.isFinite(engineId))return{};
    const value=await this.client.get('episode',{seriesId:engineId,includeEpisodeFile:false}),episodes=(records(value)||[]).filter(item=>Number(item.seasonNumber)>0),now=Date.now(),timestamp=item=>{const value=Date.parse(item?.airDateUtc||item?.airDate||'');return Number.isFinite(value)?value:null;};if(!records(value))throw engineError.invalid();
    const aired=episodes.filter(item=>timestamp(item)!=null&&timestamp(item)<=now).sort((a,b)=>timestamp(b)-timestamp(a)),upcoming=episodes.filter(item=>timestamp(item)!=null&&timestamp(item)>now).sort((a,b)=>timestamp(a)-timestamp(b)),seasonNumber=Math.max(0,...episodes.map(item=>Number(item.seasonNumber)||0)),season=episodes.filter(item=>Number(item.seasonNumber)===seasonNumber),available=season.filter(item=>item.hasFile).length;
    const episode=item=>item?{title:item.title||`Episode ${item.episodeNumber}`,seasonNumber:Number(item.seasonNumber),episodeNumber:Number(item.episodeNumber),airDateUtc:item.airDateUtc||item.airDate||null}:null;
    return{nextEpisode:episode(upcoming[0]),latestEpisode:episode(aired[0]),seasonCount:new Set(episodes.map(item=>Number(item.seasonNumber))).size,currentSeason:seasonNumber?{seasonNumber,progress:`${available} / ${season.length}`,missing:season.filter(item=>item.monitored!==false&&!item.hasFile).length}:null};
  }
  async getQueue() {
    const value = await this.client.get('queue', { page: 1, pageSize: 1000, includeSeries: true, includeEpisode: true });
    const items = records(value); if (!items) throw engineError.invalid();
    return items.filter((record) => !completedQueueItemIsTerminal(record) && !completedQueueItemHasArrived(record, 'tv')).map((record) => queueItem(record, 'tv'));
  }
  async getHistory({ mediaId, limit = 100 } = {}) {
    const value = await this.client.get('history', { page: 1, pageSize: limit, seriesId: mediaId, includeSeries: true });
    const items = records(value); if (!items) throw engineError.invalid();
    return items.map((record) => historyItem(record, 'tv'));
  }
  async getHistorySince({ since, pageSize = 250 } = {}) {
    const cutoff=new Date(since),items=[];
    if(Number.isNaN(cutoff.getTime()))throw new TypeError('A valid history start date is required');
    for(let page=1;page<=200;page+=1){
      const value=await this.client.get('history',{page,pageSize,includeSeries:true,includeEpisode:true,sortKey:'date',sortDirection:'descending'});
      const pageRecords=records(value);if(!pageRecords)throw engineError.invalid();
      for(const record of pageRecords){
        const timestamp=new Date(record.date);
        if(!Number.isNaN(timestamp.getTime())&&timestamp>=cutoff)items.push(historyItem(record,'tv'));
      }
      const oldest=pageRecords.at(-1)?.date,total=Number(value?.totalRecords);
      if(!pageRecords.length||pageRecords.length<pageSize||(Number.isFinite(total)&&page*pageSize>=total)||(oldest&&!Number.isNaN(new Date(oldest).getTime())&&new Date(oldest)<cutoff))break;
    }
    return items;
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
