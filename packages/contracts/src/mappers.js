import { assertModel } from './models.js';

export const artwork = (images = [], kind = 'poster') => {
  const image = images.find((item) => item.coverType?.toLowerCase() === kind) || images[0];
  return image ? { url: image.remoteUrl || image.url || '', kind, width: 0, height: 0 } : { url: '', kind, width: 0, height: 0 };
};
export const imageSet = (images = []) => ({
  poster: artwork(images, 'poster'),
  backdrop: artwork(images, 'fanart')
});
export const monitoring = (monitored) => monitored ? 'all' : 'none';
export const qualityName = (file) => file?.quality?.quality?.name || file?.quality?.name || null;
export const profile = (record) => record?.qualityProfile?.name || record?.qualityProfileId || null;
export const tags = (record) => Array.isArray(record?.tags) ? record.tags.map(String) : [];
export const safeDate = (value) => value || null;

export function movieSummary(record, context = {}) {
  if (!record || record.id == null || !record.title) throw new TypeError('Invalid movie record');
  const hasFile = Boolean(record.hasFile || record.movieFile || Number(record.sizeOnDisk || 0) > 0);
  return assertModel('MovieSummary', {
    id: `movie_${record.id}`, title: record.title, year: Number(record.year || 0),
    artwork: { url:`/api/artwork/movie/movie_${record.id}/poster`,kind:'poster',width:0,height:0 }, status: record.status || 'announced',
    monitoring: monitoring(record.monitored), hasFile,
    quality: qualityName(record.movieFile) || (hasFile ? 'Detected media' : 'Not available'),
    qualityProfile: profile(record), rootFolder: record.rootFolderPath || record.path || null,
    collection: record.collection?.title || record.collectionTitle || null,
    tags: tags(record), state: !hasFile ? 'missing' : context.cutoffIds?.has(record.id) ? 'cutoff' : 'available',
    queue: context.queueById?.get(record.id) || null
  });
}

export function movieDetails(record, context = {}) {
  const summary = movieSummary(record, context);
  return {
    ...summary, overview: record.overview || '', runtimeMinutes: Number(record.runtime || 0),
    genres: record.genres || [], availability: record.minimumAvailability || record.status || 'unknown',
    studio: record.studio || null, certification: record.certification || null,
    originalLanguage: record.originalLanguage?.name || record.originalLanguage || null,
    rating: Number(record.ratings?.value || record.ratings?.imdb?.value || record.ratings?.tmdb?.value || 0) || null,
    releaseDates: {
      cinemas: safeDate(record.inCinemas),
      digital: safeDate(record.digitalRelease),
      physical: safeDate(record.physicalRelease)
    }, location: record.path || record.rootFolderPath || null,
    fileLocation: record.movieFile?.path || (record.path && record.movieFile?.relativePath ? `${String(record.path).replace(/[\\/]+$/,'')}/${record.movieFile.relativePath}` : null),
    backdrop: { url:`/api/artwork/movie/movie_${record.id}/fanart`,kind:'backdrop',width:0,height:0 }
  };
}

export function seriesSummary(record, context = {}) {
  if (!record || record.id == null || !record.title) throw new TypeError('Invalid series record');
  const statistics = record.statistics || {};
  const episodeCount = Number(statistics.episodeCount || 0);
  const fileCount = Number(statistics.episodeFileCount || 0);
  return assertModel('SeriesSummary', {
    id: `series_${record.id}`, title: record.title, year: Number(record.year || 0),
    network: record.network || 'Unknown network', artwork: { url:`/api/artwork/tv/series_${record.id}/poster`,kind:'poster',width:0,height:0 },
    status: record.status || 'unknown', monitoring: monitoring(record.monitored),
    seasonProgress: `${(record.seasons || []).filter((season) => season.monitored).length} / ${(record.seasons || []).length}`,
    episodeProgress: `${fileCount} / ${episodeCount}`, missingEpisodes: Math.max(0, Number(statistics.episodeCount || 0) - Number(statistics.episodeFileCount || 0)),
    cutoffUnmetEpisodes: Number(statistics.cutoffNotMetCount || 0),
    nextEpisode: record.nextAiring ? { title: 'Next episode', airDateUtc: record.nextAiring } : null,
    qualityProfile: profile(record), rootFolder: record.rootFolderPath || record.path || null,
    tags: tags(record), queue: context.queueById?.get(record.id) || null
  });
}

export function seriesDetails(record, episodes = [], context = {}) {
  const summary = seriesSummary(record, context);
  const seasons = (record.seasons || []).map((season) => {
    const seasonEpisodes = episodes.filter((episode) => episode.seasonNumber === season.seasonNumber);
    const files = seasonEpisodes.filter((episode) => episode.hasFile).length;
    return {
      seasonNumber: season.seasonNumber, monitored: Boolean(season.monitored),
      episodeCount: seasonEpisodes.length, episodeFileCount: files,
      percentComplete: seasonEpisodes.length ? Math.round(files / seasonEpisodes.length * 100) : 0,
      episodes: seasonEpisodes.map((episode) => ({
        id: `episode_${episode.id}`, title: episode.title || `Episode ${episode.episodeNumber}`,
        episodeNumber: episode.episodeNumber, absoluteNumber: episode.absoluteEpisodeNumber || null,
        airDateUtc: safeDate(episode.airDateUtc), monitored: Boolean(episode.monitored),
        hasFile: Boolean(episode.hasFile), quality: qualityName(episode.episodeFile)
      }))
    };
  });
  return {
    ...summary, overview: record.overview || '', genres: record.genres || [], location: record.path || record.rootFolderPath || null,
    backdrop: { url:`/api/artwork/tv/series_${record.id}/fanart`,kind:'backdrop',width:0,height:0 }, seriesType: record.seriesType || 'standard',
    seasons
  };
}

export function queueItem(record, domain) {
  const media = domain === 'movie' ? record.movie : record.series;
  const publicMediaId=media?.id ? `${domain === 'movie' ? 'movie' : 'series'}_${media.id}` : null;
  const size = Number(record.size || 0), left = Number(record.sizeleft || record.sizeLeft || 0);
  return {
    id: `${domain}_queue_${record.id}`, domain, mediaId: publicMediaId,
    title: media?.title || record.title || 'Media download', context: record.episode?.title || null,
    artwork: publicMediaId?{url:`/api/artwork/${domain}/${publicMediaId}/poster`,kind:'poster',width:0,height:0}:artwork([]), progress: size ? Math.round((size - left) / size * 100) : 0,
    eta: safeDate(record.estimatedCompletionTime), client: record.downloadClient || 'Download client',
    status: record.status || record.trackedDownloadState || 'unknown', warning: record.statusMessages?.[0]?.messages?.[0] || null
  };
}

export function historyItem(record, domain) {
  const media = domain === 'movie' ? record.movie : record.series;
  const publicMediaId=media?.id ? `${domain === 'movie' ? 'movie' : 'series'}_${media.id}` : null;
  return {
    id: `${domain}_history_${record.id}`, domain, mediaId: publicMediaId,
    title: media?.title || record.sourceTitle || 'Media event', artwork: publicMediaId?{url:`/api/artwork/${domain}/${publicMediaId}/poster`,kind:'poster',width:0,height:0}:artwork([]),
    eventType: record.eventType || 'unknown', quality: record.quality?.quality?.name || null,
    timestamp: safeDate(record.date), details: record.data?.message || null
  };
}

export function calendarItem(record, domain) {
  if (domain === 'movie') return {
    id: `movie_calendar_${record.id}`, domain, mediaId: `movie_${record.id}`, title: record.title,
    artwork: {url:`/api/artwork/movie/movie_${record.id}/poster`,kind:'poster',width:0,height:0}, dateUtc: record.digitalRelease || record.physicalRelease || record.inCinemas || null,
    eventType: 'release'
  };
  return {
    id: `tv_calendar_${record.id}`, domain, mediaId: `series_${record.seriesId}`, title: record.series?.title || record.title,
    context: record.title, artwork: {url:`/api/artwork/tv/series_${record.seriesId}/poster`,kind:'poster',width:0,height:0}, dateUtc: record.airDateUtc || null,
    eventType: 'airing'
  };
}
