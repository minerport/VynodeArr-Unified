import { assertModel } from '../../contracts/src/models.js';

const series = Object.freeze([
  {
    id: 'series-afterlight', title: 'Afterlight', year: 2025, network: 'Northstar',
    artwork: { url: '/art/poster-tv-1.svg', kind: 'poster', width: 400, height: 600 },
    status: 'continuing', monitoring: 'future', seasonProgress: '2 / 3',
    episodeProgress: '18 / 24', missingEpisodes: 2,
    nextEpisode: { title: 'The Quiet Vector', airDateUtc: '2026-08-02T01:00:00Z' }
  },
  {
    id: 'series-low-country', title: 'Low Country', year: 2023, network: 'Mosaic',
    artwork: { url: '/art/poster-tv-2.svg', kind: 'poster', width: 400, height: 600 },
    status: 'ended', monitoring: 'all', seasonProgress: '4 / 4',
    episodeProgress: '40 / 40', missingEpisodes: 0, nextEpisode: null
  },
  {
    id: 'series-neon-kite', title: 'Neon Kite', year: 2026, network: 'Vector+',
    artwork: { url: '/art/poster-tv-3.svg', kind: 'poster', width: 400, height: 600 },
    status: 'continuing', monitoring: 'all', seasonProgress: '1 / 1',
    episodeProgress: '7 / 12', missingEpisodes: 1,
    nextEpisode: { title: 'Frame Eight', airDateUtc: '2026-07-29T03:00:00Z' }
  }
].map((item) => Object.freeze(assertModel('SeriesSummary', item))));

const unavailable = async () => { throw new Error('Write operations are disabled for the N1 fixture adapter'); };

export class TvFixtureAdapter {
  async listSeries({ limit = 24 } = {}) { return series.slice(0, Math.max(0, Math.min(limit, 50))); }
  async getSeries(id) { return series.find((item) => item.id === id) ?? null; }
  async searchSeries(query) { return series.filter((item) => item.title.toLowerCase().includes(String(query).toLowerCase())); }
  addSeries = unavailable; updateSeries = unavailable; deleteSeriesRecord = unavailable;
  refreshSeries = unavailable; scanSeries = unavailable;
  async listSeasons() { return []; } async listEpisodes() { return []; }
  updateSeriesMonitoring = unavailable; updateSeasonMonitoring = unavailable; updateEpisodeMonitoring = unavailable;
  async searchSeriesReleases() { return []; } async searchSeason() { return []; } async searchEpisode() { return []; }
  async searchMissingEpisodes() { return series.filter((item) => item.missingEpisodes > 0); }
  async searchCutoffUnmetEpisodes() { return []; } async getEpisodeFiles() { return []; }
  async getSeriesHistory() { return []; } async getTvCalendar() { return []; }
}
