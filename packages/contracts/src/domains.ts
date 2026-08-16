export const movieOperations = Object.freeze([
  'listMovies', 'getMovie', 'getQueue', 'getHistory', 'getCalendar',
  'getHealth', 'getSystemStatus', 'testConnection', 'getArtwork'
]);

export const tvOperations = Object.freeze([
  'listSeries', 'getSeries', 'getQueue', 'getHistory', 'getCalendar',
  'getHealth', 'getSystemStatus', 'testConnection', 'getArtwork'
]);

export const musicOperations = Object.freeze([
  'listArtists', 'getArtist', 'listAlbums', 'getAlbum', 'listTracks',
  'searchReleases', 'grabRelease', 'getQueue', 'getHistory', 'testConnection'
]);

export const subtitleOperations = Object.freeze([
  'listProviders', 'listProfiles', 'getCoverage', 'searchSubtitles',
  'downloadSubtitle', 'processMediaArrival', 'getHistory', 'testConnection'
]);

export const platformContracts = Object.freeze([
  'MediaEngineRegistry', 'ProviderAdapter', 'IndexerAdapter',
  'DownloadClientAdapter', 'MetadataAdapter', 'QueueService',
  'SchedulerService', 'HealthService', 'HistoryService', 'CalendarService'
  ,'MusicService', 'SubtitleService'
]);

export function assertContract(contract, operations) {
  const missing = operations.filter((operation) => typeof contract?.[operation] !== 'function');
  if (missing.length) throw new TypeError(`Contract missing operations: ${missing.join(', ')}`);
  return contract;
}
