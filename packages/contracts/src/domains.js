export const movieOperations = Object.freeze([
  'listMovies', 'getMovie', 'getQueue', 'getHistory', 'getCalendar',
  'getHealth', 'getSystemStatus', 'testConnection', 'getArtwork'
]);

export const tvOperations = Object.freeze([
  'listSeries', 'getSeries', 'getQueue', 'getHistory', 'getCalendar',
  'getHealth', 'getSystemStatus', 'testConnection', 'getArtwork'
]);

export const platformContracts = Object.freeze([
  'MediaEngineRegistry', 'ProviderAdapter', 'IndexerAdapter',
  'DownloadClientAdapter', 'MetadataAdapter', 'QueueService',
  'SchedulerService', 'HealthService', 'HistoryService', 'CalendarService'
]);

export function assertContract(contract, operations) {
  const missing = operations.filter((operation) => typeof contract?.[operation] !== 'function');
  if (missing.length) throw new TypeError(`Contract missing operations: ${missing.join(', ')}`);
  return contract;
}
