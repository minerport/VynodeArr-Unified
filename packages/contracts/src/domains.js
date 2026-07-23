export const movieOperations = Object.freeze([
  'listMovies', 'getMovie', 'searchMovies', 'addMovie', 'updateMovie',
  'deleteMovieRecord', 'refreshMovie', 'scanMovie', 'searchMovieReleases',
  'searchMissingMovies', 'searchCutoffUnmetMovies', 'getMovieFiles',
  'getMovieHistory', 'getMovieCalendar', 'getMovieCollections'
]);

export const tvOperations = Object.freeze([
  'listSeries', 'getSeries', 'searchSeries', 'addSeries', 'updateSeries',
  'deleteSeriesRecord', 'refreshSeries', 'scanSeries', 'listSeasons',
  'listEpisodes', 'updateSeriesMonitoring', 'updateSeasonMonitoring',
  'updateEpisodeMonitoring', 'searchSeriesReleases', 'searchSeason',
  'searchEpisode', 'searchMissingEpisodes', 'searchCutoffUnmetEpisodes',
  'getEpisodeFiles', 'getSeriesHistory', 'getTvCalendar'
]);

export const platformContracts = Object.freeze([
  'ProviderAdapter', 'IndexerAdapter', 'DownloadClientAdapter', 'MetadataAdapter',
  'QueueService', 'CommandService', 'SchedulerService', 'HealthService',
  'NotificationService', 'HistoryService', 'CalendarService'
]);

export function assertContract(contract, operations) {
  const missing = operations.filter((operation) => typeof contract?.[operation] !== 'function');
  if (missing.length) throw new TypeError(`Contract missing operations: ${missing.join(', ')}`);
  return contract;
}
