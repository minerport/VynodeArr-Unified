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
const names = value => (Array.isArray(value) ? value : value ? [value] : []).map(item => item?.name || item).filter(Boolean).map(String);
export const fileMetadata = file => {
  if (!file) return null;
  const media = file.mediaInfo || {},quality = qualityName(file) || null,customFormats = names(file.customFormats || file.customFormatNames);
  return {
    quality, resolution: media.resolution || media.videoResolution || (String(quality || '').match(/\b(?:2160|1080|720|480)p?\b/i) || [])[0] || null,
    videoCodec: media.videoCodec || null, audioCodec: media.audioCodec || null,
    audioChannels: media.audioChannels || media.audioChannelPositionsText || null,
    dynamicRange: media.videoDynamicRangeType || media.videoDynamicRange || media.dynamicRange || null,
    source: file.quality?.quality?.source || file.source || null,
    languages: names(file.languages || file.language), subtitleLanguages: names(file.subtitleLanguages || file.subtitles),
    bitrate: Number(media.videoBitrate || media.overallBitrate || media.bitrate || 0) || null,
    edition: file.edition || file.editionTitle || null, releaseGroup: file.releaseGroup || null,
    customFormats, customFormatScore: Number(file.customFormatScore ?? file.customFormatScoreOffset) || null,
    size: Number(file.size || file.sizeOnDisk || 0) || null, dateAdded: safeDate(file.dateAdded)
  };
};
export const completedQueueItemIsTerminal = (record) => {
  const status = String(record?.status || record?.trackedDownloadStatus || record?.trackedDownloadState || '').toLowerCase();
  return (status === 'completed' || status === 'complete') && Number(record?.sizeleft ?? record?.sizeLeft ?? 0) <= 0;
};
export const completedQueueItemHasArrived = (record, domain, libraryRecord = null) => {
  if (!completedQueueItemIsTerminal(record)) return false;
  if (domain === 'movie') {
    const movie = libraryRecord || record?.movie;
    return Boolean(movie?.hasFile || record?.movieFileId || movie?.movieFile?.id || Number(movie?.sizeOnDisk || 0) > 0);
  }
  return Boolean(record?.episode?.hasFile || record?.episodeFileId || record?.episode?.episodeFile?.id);
};

export function movieSummary(record, context: any = {}) {
  if (!record || record.id == null || !record.title) throw new TypeError('Invalid movie record');
  const hasFile = Boolean(record.hasFile || record.movieFile || Number(record.sizeOnDisk || 0) > 0);
  return assertModel('MovieSummary', {
    id: `movie_${record.id}`, title: record.title, sortTitle: record.sortTitle || record.title, year: Number(record.year || 0), genres: record.genres || [],
    tmdbId: Number(record.tmdbId || 0) || null, imdbId: record.imdbId || null,
    artwork: { url:`/api/artwork/movie/movie_${record.id}/poster`,kind:'poster',width:0,height:0 }, status: record.status || 'announced',
    monitoring: monitoring(record.monitored), hasFile,
    quality: qualityName(record.movieFile) || (hasFile ? 'Detected media' : 'Not available'),
    qualityProfile: profile(record), rootFolder: record.rootFolderPath || record.path || null,
    collection: record.collection?.title || record.collectionTitle || null,
    overview: record.overview || '', runtimeMinutes: Number(record.runtime || record.runtimeMinutes || 0),
    rating: Number(record.ratings?.value || record.ratings?.imdb?.value || record.ratings?.tmdb?.value || record.rating || 0) || null,
    certification: record.certification || null, studio: record.studio || null,
    originalLanguage: record.originalLanguage?.name || record.originalLanguage || null,
    releaseDate: safeDate(record.releaseDate || record.digitalRelease || record.physicalRelease || record.inCinemas),
    addedAt: safeDate(record.added),
    completionPercent: hasFile ? 100 : 0,
    sizeOnDisk: Number(record.sizeOnDisk || record.movieFile?.size || 0), fileMetadata: fileMetadata(record.movieFile),
    tags: tags(record), state: !hasFile ? 'missing' : context.cutoffIds?.has(record.id) ? 'cutoff' : 'available',
    queue: context.queueById?.get(record.id) || null
  });
}

export function movieDetails(record, context: any = {}) {
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

export function seriesSummary(record, context: any = {}) {
  if (!record || record.id == null || !record.title) throw new TypeError('Invalid series record');
  const statistics = record.statistics || {};
  const episodeCount = Number(statistics.episodeCount || 0);
  const fileCount = Number(statistics.episodeFileCount || 0);
  const completionTotal = Number(statistics.episodeCount || statistics.totalEpisodeCount || 0);
  const monitoredMissing = record.monitored === false ? 0 : context.monitoredMissingBySeriesId?.get(Number(record.id));
  return assertModel('SeriesSummary', {
    id: `series_${record.id}`, title: record.title, sortTitle: record.sortTitle || record.title, year: Number(record.year || 0),
    tmdbId: Number(record.tmdbId || 0) || null, tvdbId: Number(record.tvdbId || 0) || null, imdbId: record.imdbId || null,
    network: record.network || 'Unknown network', seriesType: record.seriesType || 'standard', artwork: { url:`/api/artwork/tv/series_${record.id}/poster`,kind:'poster',width:0,height:0 },
    originalLanguage: record.originalLanguage?.name || record.originalLanguage || null,
    status: record.status || 'unknown', monitoring: monitoring(record.monitored),
    seasonProgress: `${(record.seasons || []).filter((season) => season.monitored).length} / ${(record.seasons || []).length}`,
    episodeProgress: `${fileCount} / ${episodeCount}`, missingEpisodes: monitoredMissing ?? Math.max(0, episodeCount - fileCount),
    cutoffUnmetEpisodes: Number(statistics.cutoffNotMetCount || 0),
    nextEpisode: record.nextAiring ? { title: 'Next episode', airDateUtc: record.nextAiring } : null,
    qualityProfile: profile(record), rootFolder: record.rootFolderPath || record.path || null,
    overview: record.overview || '', genres: record.genres || [],
    runtimeMinutes: Array.isArray(record.runtime) ? Number(record.runtime[0] || 0) : Number(record.runtime || record.runtimeMinutes || 0),
    rating: Number(record.ratings?.value || record.ratings?.imdb?.value || record.ratings?.tvdb?.value || record.rating || 0) || null,
    certification: record.certification || null,
    firstAired: safeDate(record.firstAired),
    addedAt: safeDate(record.added),
    completionPercent: completionTotal ? Math.round(fileCount / completionTotal * 10000) / 100 : 0,
    sizeOnDisk: Number(statistics.sizeOnDisk || record.sizeOnDisk || 0),
    tags: tags(record), queue: context.queueById?.get(record.id) || null
  });
}

export function seriesDetails(record, episodes = [], context: any = {}) {
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
  const episode=record.episode,context=domain==='tv'&&episode?`S${String(episode.seasonNumber??0).padStart(2,'0')}E${String(episode.episodeNumber??0).padStart(2,'0')}${episode.title?` · ${episode.title}`:''}`:null;
  return {
    id: `${domain}_history_${record.id}`, domain, mediaId: publicMediaId,
    title: media?.title || record.sourceTitle || 'Media event', context, artwork: publicMediaId?{url:`/api/artwork/${domain}/${publicMediaId}/poster`,kind:'poster',width:0,height:0}:artwork([]),
    eventType: record.eventType || 'unknown', quality: record.quality?.quality?.name || null,
    timestamp: safeDate(record.date), details: record.data?.message || null,
    sourceTitle: record.sourceTitle || null, downloadId: record.downloadId || record.data?.downloadId || null,
    indexer: record.data?.indexer || record.indexer || null, protocol: record.data?.protocol || record.protocol || null,
    customFormatScore: Number(record.customFormatScore ?? record.data?.customFormatScore ?? record.data?.customFormatScoreOffset) || 0,
    isUpgrade: record.data?.isUpgrade === true || String(record.data?.isUpgrade || record.isUpgrade || '').toLowerCase() === 'true',
    data: record.data && typeof record.data === 'object' ? { ...record.data } : {}
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
