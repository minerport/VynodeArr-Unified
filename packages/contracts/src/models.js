const values = (name, allowed) => Object.freeze({ name, allowed: Object.freeze(allowed) });

export const MediaStatus = values('MediaStatus', ['announced', 'available', 'released', 'continuing', 'ended']);
export const MonitoringStatus = values('MonitoringStatus', ['all', 'future', 'missing', 'existing', 'none']);

export const modelSchemas = Object.freeze({
  MediaArtwork: ['url', 'kind', 'width', 'height'],
  MovieSummary: ['id', 'title', 'year', 'artwork', 'status', 'monitoring', 'hasFile', 'quality', 'qualityProfile', 'rootFolder', 'collection', 'tags', 'state', 'queue'],
  MovieDetails: ['id', 'title', 'year', 'overview', 'runtimeMinutes', 'minimumAvailability', 'artwork', 'status', 'monitoring', 'hasFile', 'quality'],
  SeriesSummary: ['id', 'title', 'year', 'network', 'artwork', 'status', 'monitoring', 'seasonProgress', 'episodeProgress', 'missingEpisodes', 'cutoffUnmetEpisodes', 'nextEpisode', 'qualityProfile', 'rootFolder', 'tags', 'queue'],
  SeriesDetails: ['id', 'title', 'year', 'overview', 'network', 'seriesType', 'artwork', 'status', 'monitoring', 'seasons'],
  SeasonSummary: ['seasonNumber', 'monitored', 'episodeCount', 'episodeFileCount', 'percentComplete'],
  EpisodeSummary: ['id', 'seriesId', 'seasonNumber', 'episodeNumber', 'absoluteNumber', 'title', 'airDateUtc', 'monitored', 'hasFile'],
  QualityProfile: ['id', 'name', 'cutoff', 'items'],
  CustomFormat: ['id', 'name', 'score'],
  RootFolder: ['id', 'path', 'freeSpaceBytes', 'accessible'],
  QueueItem: ['id', 'domain', 'mediaId', 'title', 'state', 'progress', 'trackedDownloadState'],
  HistoryItem: ['id', 'domain', 'mediaId', 'eventType', 'dateUtc', 'message'],
  CalendarItem: ['id', 'domain', 'mediaId', 'title', 'dateUtc', 'eventType'],
  HealthItem: ['id', 'severity', 'message', 'source'],
  CommandItem: ['id', 'name', 'state', 'queuedAtUtc', 'startedAtUtc', 'endedAtUtc'],
  SearchResult: ['id', 'domain', 'title', 'year', 'artwork', 'metadata'],
  DownloadClient: ['id', 'name', 'implementation', 'enabled', 'priority'],
  Indexer: ['id', 'name', 'implementation', 'enabled', 'priority']
});

export function assertModel(name, value) {
  const fields = modelSchemas[name];
  if (!fields) throw new TypeError(`Unknown VynodeArr model: ${name}`);
  if (!value || typeof value !== 'object') throw new TypeError(`${name} must be an object`);
  for (const field of fields) {
    if (!(field in value)) throw new TypeError(`${name}.${field} is required`);
  }
  return value;
}
