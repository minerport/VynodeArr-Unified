import { createHash, randomUUID } from "node:crypto";

export const posterVariables = [
  "custom_text",
  "icon",
  "collection_name",
  "collection_title_count",
  "collection_media_type",
  "collection_last_sync",
  "title",
  "year",
  "rating",
  "quality",
  "resolution",
  "quality_profile",
  "video_codec",
  "audio_codec",
  "audio_channels",
  "dynamic_range",
  "source",
  "languages",
  "subtitle_languages",
  "bitrate",
  "edition",
  "release_group",
  "custom_formats",
  "custom_format_score",
  "runtime",
  "certification",
  "studio",
  "network",
  "genres",
  "original_language",
  "monitored",
  "availability",
  "library_status",
  "completion_percent",
  "file_size",
  "tags",
  "date_added",
  "added_ago",
  "plex_days_since_added",
  "release_date",
  "release_age",
  "download_status",
  "download_progress",
  "download_eta",
  "missing_count",
  "cutoff_status",
  "cutoff_unmet_count",
  "season_progress",
  "episode_progress",
  "episodes_available",
  "episodes_total",
  "season_count",
  "current_season",
  "current_season_progress",
  "current_season_missing",
  "series_type",
  "first_aired",
  "next_episode",
  "next_episode_title",
  "next_episode_date",
  "next_episode_countdown",
  "next_episode_season",
  "next_episode_number",
  "next_episode_code",
  "latest_episode_title",
  "latest_episode_date",
  "latest_episode_season",
  "latest_episode_number",
  "latest_episode_code",
  "series_status",
  "next_episode_or_status",
  "requested_by",
  "request_count",
  "requested_date",
  "requested_ago",
  "collection",
  "tmdb_id",
  "tvdb_id",
  "imdb_id",
];
const positions = new Set([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "custom",
]);
const variables = new Set(posterVariables);
const positionDefaults = {
  "top-left": [5, 5],
  "top-center": [30, 5],
  "top-right": [55, 5],
  "bottom-left": [5, 88],
  "bottom-center": [30, 88],
  "bottom-right": [55, 88],
  custom: [5, 5],
};
const cleanText = (value, max = 120) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
const cleanAffix = (value, max = 30) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, max);
const cleanColor = (value, fallback) =>
  /^#[0-9a-f]{6}$/i.test(String(value || ""))
    ? String(value).toLowerCase()
    : fallback;
const cleanDomain = (value) =>
  value === "movie" || value === "tv" ? value : "all";
const conditionOperators = new Set([
  "truthy",
  "falsy",
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
]);
const sanitizeCondition = (input = {}, fallbackVariable = "title") => ({
  variable: variables.has(String(input.variable || ""))
    ? String(input.variable)
    : fallbackVariable,
  operator: conditionOperators.has(input.operator) ? input.operator : "truthy",
  value: cleanText(input.value, 80),
});
const sanitizeConditionGroup = (input = {}, fallbackVariable = "title") => ({
  join: input.join === "or" ? "or" : "and",
  rules:
    Array.isArray(input.rules) && input.rules.length
      ? input.rules
          .slice(0, 8)
          .map((rule) => sanitizeCondition(rule, fallbackVariable))
      : [sanitizeCondition({}, fallbackVariable)],
});
const sanitizeStyleOverrides = (input) => {
  const value = {};
  if (input && typeof input === "object") {
    if (input.foreground)
      value.foreground = cleanColor(input.foreground, "#ffffff");
    if (input.background)
      value.background = cleanColor(input.background, "#111827");
    if (input.iconColor)
      value.iconColor = cleanColor(input.iconColor, "#ffffff");
    if (Number.isFinite(Number(input.iconSize)))
      value.iconSize = Math.max(10, Math.min(100, Number(input.iconSize)));
    if (Number.isFinite(Number(input.fontSize)))
      value.fontSize = Math.max(12, Math.min(96, Number(input.fontSize)));
    if (["sans", "serif", "condensed", "monospace"].includes(input.fontFamily))
      value.fontFamily = input.fontFamily;
    if ([400, 500, 600, 700, 800, 900].includes(Number(input.fontWeight)))
      value.fontWeight = Number(input.fontWeight);
    if (["left", "center", "right"].includes(input.textAlign))
      value.textAlign = input.textAlign;
    if (["none", "uppercase", "lowercase"].includes(input.textTransform))
      value.textTransform = input.textTransform;
    if (Number.isFinite(Number(input.textOpacity)))
      value.textOpacity = Math.max(0, Math.min(1, Number(input.textOpacity)));
    if (Number.isFinite(Number(input.backgroundOpacity)))
      value.backgroundOpacity = Math.max(
        0,
        Math.min(1, Number(input.backgroundOpacity)),
      );
    if (
      [
        "rounded",
        "square",
        "pill",
        "circle",
        "ticket",
        "ribbon",
        "tag",
        "hexagon",
        "chevron",
      ].includes(input.shape)
    )
      value.shape = input.shape;
    if (Number.isFinite(Number(input.padding)))
      value.padding = Math.max(2, Math.min(30, Number(input.padding)));
    if (Number.isFinite(Number(input.borderRadius)))
      value.borderRadius = Math.max(
        0,
        Math.min(50, Number(input.borderRadius)),
      );
    if ("prefix" in input) value.prefix = cleanAffix(input.prefix);
    if ("suffix" in input) value.suffix = cleanAffix(input.suffix);
    if (typeof input.posterAware === "boolean")
      value.posterAware = input.posterAware;
  }
  return value;
};

export function sanitizeOverlayLayer(input = {}, index = 0) {
  const rawVariable = variables.has(String(input.variable || ""))
      ? String(input.variable)
      : "title",
    legacyIcon = rawVariable === "icon",
    kind = ["text", "icon", "shape"].includes(input.kind)
      ? input.kind
      : legacyIcon
        ? "icon"
        : "text",
    variable = legacyIcon ? "custom_text" : rawVariable;
  const position = positions.has(String(input.position || ""))
      ? String(input.position)
      : "bottom-left",
    defaults = positionDefaults[position];
  const width = Math.max(15, Math.min(100, Number(input.width) || 40)),
    height = Math.max(0, Math.min(100, Number(input.height) || 0)),
    requestedX = Number.isFinite(Number(input.x))
      ? Number(input.x)
      : defaults[0];
  const shape = [
    "rounded",
    "square",
    "pill",
    "circle",
    "ticket",
    "ribbon",
    "tag",
    "hexagon",
    "chevron",
  ].includes(input.shape)
    ? input.shape
    : "rounded";
  const textFit = ["fixed", "shrink", "wrap"].includes(input.textFit)
      ? input.textFit
      : "fixed",
    maxLines = Math.max(1, Math.min(6, Number(input.maxLines) || 2));
  const iconName =
      cleanText(input.iconName || (legacyIcon ? input.label : "movie"), 30) ||
      "movie",
    iconColor = cleanColor(
      input.iconColor,
      cleanColor(input.foreground, "#ffffff"),
    ),
    iconSize = Math.max(10, Math.min(100, Number(input.iconSize) || 70)),
    contentGap = Math.max(
      0,
      Math.min(
        120,
        Number.isFinite(Number(input.contentGap))
          ? Number(input.contentGap)
          : 12,
      ),
    ),
    contentPosition = [
      "none",
      "inside",
      "above",
      "below",
      "left",
      "right",
    ].includes(input.contentPosition)
      ? input.contentPosition
      : "none",
    label = legacyIcon ? "" : cleanText(input.label || `{${variable}}`, 80);
  const legacy = sanitizeCondition({ ...input.condition, variable }, variable),
    conditions =
      Array.isArray(input.conditions?.rules) && input.conditions.rules.length
        ? sanitizeConditionGroup(input.conditions, variable)
        : { join: "and", rules: [legacy] },
    styleRules = Array.isArray(input.styleRules)
      ? input.styleRules
          .slice(0, 8)
          .map((rule, ruleIndex) => ({
            id: /^style_[A-Za-z0-9_-]+$/.test(String(rule.id || ""))
              ? String(rule.id)
              : `style_${index}_${ruleIndex}_${randomUUID()}`,
            name: cleanText(rule.name || `Sub-condition ${ruleIndex + 1}`, 50),
            rank: Math.max(1, Math.min(8, Number(rule.rank) || ruleIndex + 1)),
            conditions: sanitizeConditionGroup(rule.conditions, variable),
            overrides: sanitizeStyleOverrides(rule.overrides),
          }))
          .sort((a, b) => a.rank - b.rank)
          .map((rule, ruleIndex) => ({ ...rule, rank: ruleIndex + 1 }))
      : [];
  return {
    id: /^layer_[A-Za-z0-9_-]+$/.test(String(input.id || ""))
      ? String(input.id)
      : `layer_${index}_${randomUUID()}`,
    label,
    variable,
    kind,
    iconName,
    iconColor,
    iconSize,
    contentGap,
    contentPosition,
    textFit,
    maxLines,
    position,
    x: width === 100 ? 0 : Math.max(0, Math.min(100 - width, requestedX)),
    y: Math.max(
      0,
      Math.min(
        100 - (height || 4),
        Number.isFinite(Number(input.y)) ? Number(input.y) : defaults[1],
      ),
    ),
    width,
    height,
    prefix: cleanAffix(input.prefix),
    suffix: cleanAffix(input.suffix),
    foreground: cleanColor(input.foreground, "#ffffff"),
    background: cleanColor(input.background, "#111827"),
    fontSize: Math.max(12, Math.min(96, Number(input.fontSize) || 32)),
    fontFamily: ["sans", "serif", "condensed", "monospace"].includes(
      input.fontFamily,
    )
      ? input.fontFamily
      : "sans",
    fontWeight: [400, 500, 600, 700, 800, 900].includes(
      Number(input.fontWeight),
    )
      ? Number(input.fontWeight)
      : 700,
    textAlign: ["left", "center", "right"].includes(input.textAlign)
      ? input.textAlign
      : "left",
    textTransform: ["none", "uppercase", "lowercase"].includes(
      input.textTransform,
    )
      ? input.textTransform
      : "none",
    textOpacity: Math.max(
      0,
      Math.min(
        1,
        Number.isFinite(Number(input.textOpacity))
          ? Number(input.textOpacity)
          : 1,
      ),
    ),
    backgroundOpacity: Math.max(
      0,
      Math.min(
        1,
        Number.isFinite(Number(input.backgroundOpacity))
          ? Number(input.backgroundOpacity)
          : 0.92,
      ),
    ),
    posterAware: input.posterAware === true,
    shape,
    padding: Math.max(2, Math.min(30, Number(input.padding) || 12)),
    borderRadius: Math.max(
      0,
      Math.min(
        50,
        Number.isFinite(Number(input.borderRadius))
          ? Number(input.borderRadius)
          : 18,
      ),
    ),
    enabled: input.enabled !== false,
    condition: { operator: legacy.operator, value: legacy.value },
    conditions,
    styleMode: input.styleMode === "merge" ? "merge" : "first",
    styleRules,
  };
}

export function sanitizeOverlayTemplate(input = {}, existing = null) {
  const layers = Array.isArray(input.layers)
    ? input.layers.slice(0, 12).map(sanitizeOverlayLayer)
    : [];
  const badges = input.plexBadges || existing?.plexBadges || {};
  const legacyTarget = Object.values(badges).some(Boolean) ? "plex" : "vynode",
    target = ["vynode", "plex"].includes(input.target)
      ? input.target
      : ["vynode", "plex"].includes(existing?.target)
        ? existing.target
        : legacyTarget;
  const tvFileAggregation = [
    "most_common",
    "best",
    "lowest",
    "mixed",
    "latest",
  ].includes(input.tvFileAggregation)
    ? input.tvFileAggregation
    : existing?.tvFileAggregation || "most_common";
  return {
    id:
      existing?.id ||
      (/^overlay_[A-Za-z0-9_-]+$/.test(String(input.id || ""))
        ? String(input.id)
        : `overlay_${randomUUID()}`),
    name: cleanText(input.name || existing?.name || "Poster overlay", 80),
    domain: cleanDomain(input.domain || existing?.domain),
    target,
    enabled: input.enabled !== false,
    tvFileAggregation,
    layers,
    plexBadges: {
      monitored: badges.monitored === true,
      availability: badges.availability === true,
      cutoff: badges.cutoff === true,
      rating: badges.rating === true,
    },
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeOverlayAssignment(input = {}, existing = null) {
  const type = [
      "all",
      "items",
      "collection",
      "user-collection",
      "rules",
    ].includes(input.scope?.type)
      ? input.scope.type
      : "items",
    domain = cleanDomain(input.scope?.domain);
  return {
    id:
      existing?.id ||
      (/^assignment_[A-Za-z0-9_-]+$/.test(String(input.id || ""))
        ? String(input.id)
        : `assignment_${randomUUID()}`),
    templateId: cleanText(input.templateId, 100),
    name: cleanText(input.name || "Overlay assignment", 80),
    enabled: input.enabled !== false,
    scope: {
      type,
      domain,
      mediaIds: Array.isArray(input.scope?.mediaIds)
        ? [
            ...new Set(
              input.scope.mediaIds
                .map((value) => cleanText(value, 100))
                .filter(Boolean),
            ),
          ].slice(0, 5000)
        : [],
      collectionId: cleanText(input.scope?.collectionId, 100),
      userId: cleanText(input.scope?.userId, 100),
      rules: {
        genres: Array.isArray(input.scope?.rules?.genres)
          ? input.scope.rules.genres
              .map((value) => cleanText(value, 50))
              .filter(Boolean)
              .slice(0, 20)
          : [],
        years: Array.isArray(input.scope?.rules?.years)
          ? input.scope.rules.years
              .map(Number)
              .filter(Number.isFinite)
              .slice(0, 100)
          : [],
        availability: ["available", "missing", "cutoff", ""].includes(
          input.scope?.rules?.availability,
        )
          ? input.scope.rules.availability
          : "",
        monitoring: ["monitored", "unmonitored", ""].includes(
          input.scope?.rules?.monitoring,
        )
          ? input.scope.rules.monitoring
          : "",
      },
    },
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const seriesStatus = (value) =>
  ({
    continuing: "Continuing",
    ended: "Ended",
    upcoming: "Upcoming",
    hiatus: "On hiatus",
    paused: "Paused",
    cancelled: "Canceled",
    canceled: "Canceled",
  })[String(value || "").toLowerCase()] ||
  String(value || "").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
const dateValue = (value, context = {}) => {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date(context.now || Date.now());
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year:
      date.getUTCFullYear() !== now.getUTCFullYear() ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(date);
};
const relativeDateValue = (value, context = {}, futureLabel = "In") => {
  const date = new Date(value || ""),
    now = new Date(context.now || Date.now());
  if (!Number.isFinite(date.getTime())) return "";
  const today = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
    day = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
    days = Math.round((day - today) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0
    ? `${futureLabel} ${days} days`
    : `${Math.abs(days)} days ago`;
};
const daysSinceValue = (value, context = {}) => {
  const date = new Date(value || ""),
    now = new Date(context.now || Date.now());
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime()))
    return "";
  const today = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
    day = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    );
  return Math.max(1, Math.floor((today - day) / 86400000));
};
const nextEpisodeValue = (item, context = {}) => {
  const date = new Date(item.nextEpisode?.airDateUtc || ""),
    now = new Date(context.now || Date.now());
  if (!Number.isFinite(date.getTime()) || date < now) return "";
  const relative = relativeDateValue(date, context);
  if (relative === "Today") return "Next episode today";
  if (relative === "Tomorrow") return "Next episode tomorrow";
  if (
    /^In \d+ days$/.test(relative) &&
    Number(relative.match(/\d+/)?.[0]) <= 30
  )
    return `Next episode ${relative.toLowerCase()}`;
  return `Next episode ${dateValue(date, context)}`;
};
const progressParts = (value) => {
  const match = String(value || "").match(/(\d+)\s*\/\s*(\d+)/);
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
};
const bytesValue = (value) => {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"],
    unit = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024)),
    ),
    amount = bytes / 1024 ** unit;
  return `${amount.toFixed(unit < 2 || amount >= 10 ? 0 : 1)} ${units[unit]}`;
};
const metadataFields = [
  "quality",
  "resolution",
  "videoCodec",
  "audioCodec",
  "audioChannels",
  "dynamicRange",
  "source",
  "languages",
  "subtitleLanguages",
  "bitrate",
  "edition",
  "releaseGroup",
  "customFormats",
  "customFormatScore",
  "size",
  "dateAdded",
];
const useful = (value) =>
  Array.isArray(value)
    ? value.length > 0
    : value !== null && value !== undefined && String(value).trim() !== "";
const comparable = (value) =>
  Array.isArray(value) ? value.join(", ") : String(value ?? "");
const resolutionRank = (value) =>
  Number((String(value || "").match(/(2160|1080|720|480)/) || [])[1] || 0);
const mode = (files, field) => {
  const counts = new Map();
  for (const file of files) {
    const value = file[field];
    if (!useful(value)) continue;
    const key = comparable(value);
    counts.set(key, { count: (counts.get(key)?.count || 0) + 1, value });
  }
  return (
    [...counts.values()].sort(
      (a, b) =>
        b.count - a.count || String(a.value).localeCompare(String(b.value)),
    )[0]?.value || ""
  );
};
export function aggregateOverlayFileMetadata(
  files = [],
  strategy = "most_common",
) {
  const usable = files.filter((file) => file && typeof file === "object");
  if (!usable.length) return {};
  if (strategy === "mixed") {
    const result = {};
    for (const field of metadataFields) {
      const values = [
        ...new Set(
          usable.map((file) => comparable(file[field])).filter(Boolean),
        ),
      ];
      result[field] =
        values.length === 1
          ? usable.find((file) => comparable(file[field]) === values[0])?.[
              field
            ] || ""
          : values.length > 1
            ? "Mixed"
            : "";
    }
    return result;
  }
  if (strategy === "most_common") {
    const result = {};
    for (const field of metadataFields) result[field] = mode(usable, field);
    return result;
  }
  const ranked = [...usable].sort(
    (left, right) =>
      resolutionRank(right.resolution) - resolutionRank(left.resolution) ||
      Number(right.bitrate || 0) - Number(left.bitrate || 0) ||
      Number(right.size || 0) - Number(left.size || 0),
  );
  if (strategy === "lowest") return ranked.at(-1) || {};
  if (strategy === "latest")
    return (
      [...usable].sort((left, right) =>
        String(right.dateAdded || "").localeCompare(
          String(left.dateAdded || ""),
        ),
      )[0] || {}
    );
  return ranked[0] || {};
}
export function posterVariableValues(item = {}, context = {}) {
  const file = item.fileMetadata || {},
    quality = String(file.quality || item.quality || ""),
    nextEpisode = nextEpisodeValue(item, context),
    status = seriesStatus(item.status),
    [episodesAvailable, episodesTotal] = progressParts(item.episodeProgress),
    isSeries = Boolean(
      item.episodeProgress ||
      item.seasonProgress ||
      item.missingEpisodes != null,
    ),
    available = isSeries
      ? episodesAvailable > 0 ||
        Number(item.completionPercent || 0) > 0 ||
        Number(item.sizeOnDisk || 0) > 0
      : Boolean(
          item.hasFile ||
          item.state === "available" ||
          item.state === "cutoff" ||
          Number(item.completionPercent || 0) >= 100,
        ),
    complete = isSeries
      ? episodesTotal > 0 && episodesAvailable >= episodesTotal
      : available,
    cutoff = Number(item.cutoffUnmetEpisodes || 0),
    cutoffUnmet = item.state === "cutoff" || cutoff > 0,
    requesters = context.requesters || [],
    requestedAt =
      requesters
        .map((value) => value.requestedAt)
        .filter(Boolean)
        .sort()[0] || "",
    queue = item.queue || {};
  const code = (episode) =>
    episode?.seasonNumber != null && episode?.episodeNumber != null
      ? `S${String(episode.seasonNumber).padStart(2, "0")}E${String(episode.episodeNumber).padStart(2, "0")}`
      : "";
  return {
    custom_text: "",
    icon: "icon",
    collection_name: item.collectionName || item.collection || "",
    collection_title_count: item.collectionTitleCount ?? "",
    collection_media_type: item.collectionMediaType || "",
    collection_last_sync: dateValue(item.collectionLastSync, context),
    title: item.title || "",
    year: item.year || "",
    rating: item.rating ? Number(item.rating).toFixed(1) : "",
    quality,
    resolution:
      file.resolution ||
      (quality.match(/\b(?:2160|1080|720|480)p?\b/i) || [])[0] ||
      "",
    quality_profile: item.qualityProfile || "",
    video_codec: file.videoCodec || "",
    audio_codec: file.audioCodec || "",
    audio_channels: file.audioChannels || "",
    dynamic_range: file.dynamicRange || "",
    source: file.source || "",
    languages: Array.isArray(file.languages)
      ? file.languages.join(", ")
      : file.languages || "",
    subtitle_languages: Array.isArray(file.subtitleLanguages)
      ? file.subtitleLanguages.join(", ")
      : file.subtitleLanguages || "",
    bitrate:
      Number(file.bitrate) > 0
        ? `${(Number(file.bitrate) / 1000000).toFixed(1)} Mbps`
        : "",
    edition: file.edition || "",
    release_group: file.releaseGroup || "",
    custom_formats: Array.isArray(file.customFormats)
      ? file.customFormats.join(", ")
      : file.customFormats || "",
    custom_format_score: useful(file.customFormatScore)
      ? Number(file.customFormatScore)
      : "",
    runtime: item.runtimeMinutes ? `${item.runtimeMinutes} min` : "",
    certification: item.certification || "",
    studio: item.studio || "",
    network: item.network || "",
    genres: (item.genres || []).join(", "),
    original_language:
      item.originalLanguage?.name || item.originalLanguage || "",
    monitored:
      item.monitoring && item.monitoring !== "none"
        ? "Monitored"
        : "Unmonitored",
    availability: available ? "Available" : "Missing",
    library_status: cutoffUnmet
      ? "Cutoff unmet"
      : complete
        ? "Complete"
        : available
          ? "Partial"
          : "Missing",
    completion_percent: Number.isFinite(Number(item.completionPercent))
      ? `${Math.round(Number(item.completionPercent))}%`
      : "",
    file_size: bytesValue(file.size || item.sizeOnDisk),
    tags: (item.tags || []).join(", "),
    date_added: dateValue(item.addedAt, context),
    added_ago: relativeDateValue(item.addedAt, context),
    plex_days_since_added: daysSinceValue(
      context.plexAddedAt ?? item.addedAt,
      context,
    ),
    release_date: dateValue(item.releaseDate, context),
    release_age: relativeDateValue(item.releaseDate, context),
    download_status: queue.status ? seriesStatus(queue.status) : "",
    download_progress: Number.isFinite(Number(queue.progress))
      ? `${Math.round(Number(queue.progress))}%`
      : "",
    download_eta: relativeDateValue(queue.eta, context),
    missing_count: item.missingEpisodes || "",
    cutoff_status: cutoffUnmet ? "Cutoff unmet" : "",
    cutoff_unmet_count: cutoff || "",
    season_progress: item.seasonProgress || "",
    episode_progress: item.episodeProgress || "",
    episodes_available: episodesTotal ? episodesAvailable : "",
    episodes_total: episodesTotal || "",
    season_count: item.seasonCount || "",
    current_season: item.currentSeason?.seasonNumber ?? "",
    current_season_progress: item.currentSeason?.progress || "",
    current_season_missing: item.currentSeason?.missing ?? "",
    series_type: item.seriesType ? seriesStatus(item.seriesType) : "",
    first_aired: dateValue(item.firstAired, context),
    next_episode: nextEpisode,
    next_episode_title: item.nextEpisode?.title || "",
    next_episode_date: dateValue(item.nextEpisode?.airDateUtc, context),
    next_episode_countdown: relativeDateValue(
      item.nextEpisode?.airDateUtc,
      context,
    ),
    next_episode_season: item.nextEpisode?.seasonNumber ?? "",
    next_episode_number: item.nextEpisode?.episodeNumber ?? "",
    next_episode_code: code(item.nextEpisode),
    latest_episode_title: item.latestEpisode?.title || "",
    latest_episode_date: dateValue(item.latestEpisode?.airDateUtc, context),
    latest_episode_season: item.latestEpisode?.seasonNumber ?? "",
    latest_episode_number: item.latestEpisode?.episodeNumber ?? "",
    latest_episode_code: code(item.latestEpisode),
    series_status: status,
    next_episode_or_status: nextEpisode || status,
    requested_by: requesters
      .map((value) => value.name || value.username)
      .join(", "),
    request_count: requesters.length || "",
    requested_date: dateValue(requestedAt, context),
    requested_ago: relativeDateValue(requestedAt, context),
    collection: item.collection || "",
    tmdb_id: item.tmdbId || "",
    tvdb_id: item.tvdbId || "",
    imdb_id: item.imdbId || "",
  };
}

const normalizedId = (value) =>
  String(value || "").replace(/^(movie|series)_/, "");
function rulesMatch(item, rules = {}) {
  return (
    (!rules.genres?.length ||
      rules.genres.some((genre) => (item.genres || []).includes(genre))) &&
    (!rules.years?.length || rules.years.includes(Number(item.year))) &&
    (!rules.availability ||
      (rules.availability === "available"
        ? Boolean(item.hasFile || item.state === "available")
        : rules.availability === "missing"
          ? !item.hasFile && item.state !== "available"
          : item.state === "cutoff")) &&
    (!rules.monitoring ||
      (rules.monitoring === "monitored"
        ? item.monitoring !== "none"
        : item.monitoring === "none"))
  );
}
export function assignmentMatches(assignment, item, context = {}) {
  if (!assignment?.enabled || !item) return false;
  const scope = assignment.scope || {};
  if (scope.domain !== "all" && scope.domain !== context.domain) return false;
  if (scope.type === "all") return true;
  if (scope.type === "items")
    return (scope.mediaIds || []).some(
      (value) => normalizedId(value) === normalizedId(item.id),
    );
  if (scope.type === "collection")
    return (
      scope.collectionId &&
      String(item.collection || "") ===
        String(context.collectionName || scope.collectionId)
    );
  if (scope.type === "user-collection")
    return scope.userId && (context.userIds || []).includes(scope.userId);
  return scope.type === "rules" && rulesMatch(item, scope.rules);
}
export function resolveOverlayTemplate(
  item,
  domain,
  templates = [],
  assignments = [],
  context = {},
) {
  const active = new Map(
      templates
        .filter(
          (value) =>
            value.enabled &&
            value.target !== "plex" &&
            (value.domain === "all" || value.domain === domain),
        )
        .map((value) => [value.id, value]),
    ),
    rank = { items: 5, "user-collection": 4, collection: 3, rules: 2, all: 1 };
  return (
    assignments
      .filter(
        (value) =>
          active.has(value.templateId) &&
          assignmentMatches(value, item, { ...context, domain }),
      )
      .sort(
        (a, b) =>
          (rank[b.scope.type] || 0) - (rank[a.scope.type] || 0) ||
          String(b.updatedAt).localeCompare(String(a.updatedAt)),
      )
      .map((value) => active.get(value.templateId))[0] || null
  );
}

const xml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character],
  );
const conditionMatches = (rule, values) => {
  const actual = String(values[rule.variable] ?? "").trim(),
    expected = String(rule.value ?? "").trim(),
    left = actual.toLowerCase(),
    right = expected.toLowerCase(),
    numbers =
      actual !== "" &&
      expected !== "" &&
      Number.isFinite(Number(actual)) &&
      Number.isFinite(Number(expected));
  if (rule.operator === "falsy") return !actual;
  if (rule.operator === "equals") return left === right;
  if (rule.operator === "not_equals") return left !== right;
  if (rule.operator === "contains") return left.includes(right);
  if (rule.operator === "not_contains") return !left.includes(right);
  if (rule.operator === "greater_than")
    return numbers && Number(actual) > Number(expected);
  if (rule.operator === "less_than")
    return numbers && Number(actual) < Number(expected);
  if (rule.operator === "greater_than_or_equal")
    return numbers && Number(actual) >= Number(expected);
  if (rule.operator === "less_than_or_equal")
    return numbers && Number(actual) <= Number(expected);
  return Boolean(actual);
};
const groupMatches = (group, values) => {
  const results = (group?.rules || []).map((rule) =>
    conditionMatches(rule, values),
  );
  return group?.join === "or" ? results.some(Boolean) : results.every(Boolean);
};
export const resolveConditionalOverlayLayer = (layer, values = {}) => {
  const matches = [...(layer.styleRules || [])]
    .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    .filter((rule) => groupMatches(rule.conditions, values));
  if (!matches.length) return layer;
  const chosen = layer.styleMode === "merge" ? matches : matches.slice(0, 1);
  return chosen.reduce(
    (resolved, rule) => ({ ...resolved, ...rule.overrides }),
    layer,
  );
};
const visible = (layer, value, values) => {
  if (!layer.enabled) return false;
  const text = String(value ?? "").trim(),
    artworkOnly =
      layer.kind !== "text" && layer.variable === "custom_text" && !text;
  if (!artworkOnly && !text) return false;
  const group = layer.conditions || {
      join: "and",
      rules: [{ ...layer.condition, variable: layer.variable }],
    },
    conditionValues = {
      ...values,
      [layer.variable]: artworkOnly ? "artwork" : value,
    },
    results = (group.rules || []).map((rule) =>
      conditionMatches(rule, conditionValues),
    );
  return group.join === "or" ? results.some(Boolean) : results.every(Boolean);
};
const overlayIconPaths = {
  movie: "M4 6h16v12H4zM7 3l2 3m3-3 2 3m3-3 2 3",
  television: "M3 6h18v13H3zM8 22h8M9 2l3 4 3-4",
  play: "M8 5v14l11-7z",
  collection: "M4 5h16v14H4zM7 2h10M7 22h10",
  resolution: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  quality: "M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
  audio: "M5 9v6h4l5 4V5L9 9zM17 8a5 5 0 010 8M19 5a9 9 0 010 14",
  subtitles: "M3 5h18v14H3zM6 10h5M6 14h8M13 10h5M16 14h2",
  calendar: "M4 5h16v16H4zM8 2v6M16 2v6M4 10h16",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l4 2",
  star: "M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
  network: "M5 7h14v10H5zM2 10h3M19 10h3M9 20h6M12 17v3",
  stream: "M4 7h16v10H4zM9 4h6M8 20h8M10 10l5 2-5 2z",
  download: "M12 3v12M7 10l5 5 5-5M4 20h16",
  monitor:
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
  missing: "M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v6M12 17h.01",
};
const overlayShape = (layer, x, y, w, h) => {
  const fill = `fill="${xml(layer.background)}" fill-opacity="${layer.backgroundOpacity}"`,
    p = (px, py) => `${x + (w * px) / 100},${y + (h * py) / 100}`;
  if (layer.shape === "circle")
    return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${fill}/>`;
  const points = {
    ticket: [
      p(4, 0),
      p(96, 0),
      p(100, 22),
      p(96, 50),
      p(100, 78),
      p(96, 100),
      p(4, 100),
      p(0, 78),
      p(4, 50),
      p(0, 22),
    ],
    ribbon: [p(0, 0), p(94, 0), p(100, 50), p(94, 100), p(0, 100), p(5, 50)],
    tag: [p(0, 0), p(88, 0), p(100, 50), p(88, 100), p(0, 100)],
    hexagon: [p(8, 0), p(92, 0), p(100, 50), p(92, 100), p(8, 100), p(0, 50)],
    chevron: [p(0, 0), p(88, 0), p(100, 50), p(88, 100), p(0, 100), p(12, 50)],
  }[layer.shape];
  return points
    ? `<polygon points="${points.join(" ")}" ${fill}/>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${layer.shape === "square" ? 0 : layer.shape === "pill" ? h / 2 : layer.borderRadius}" ${fill}/>`;
};
const overlayTextLines = (text, layer, w, size) => {
  if (layer.textFit !== "wrap") return [text];
  const limit = Math.max(
      1,
      Math.floor((w - layer.padding * 2) / (size * 0.58)),
    ),
    words = String(text)
      .split(/\s+/)
      .flatMap((word) =>
        word.length > limit
          ? Array.from({ length: Math.ceil(word.length / limit) }, (_, index) =>
              word.slice(index * limit, (index + 1) * limit),
            )
          : word,
      ),
    lines = [];
  for (const word of words) {
    const last = lines.at(-1) || "";
    if (!last || `${last} ${word}`.length > limit) lines.push(word);
    else lines[lines.length - 1] = `${last} ${word}`;
  }
  return lines.slice(0, layer.maxLines);
};
const overlayText = (text, layer, x, y, w, h, fontFamilies) => {
  if (!text) return "";
  let size = layer.fontSize;
  if (layer.textFit === "shrink")
    size = Math.max(
      12,
      Math.min(size, (w - layer.padding * 2) / (text.length * 0.58)),
    );
  const lines = overlayTextLines(text, layer, w, size),
    anchor =
      layer.textAlign === "center"
        ? "middle"
        : layer.textAlign === "right"
          ? "end"
          : "start",
    tx =
      layer.textAlign === "center"
        ? x + w / 2
        : layer.textAlign === "right"
          ? x + w - layer.padding
          : x + layer.padding,
    lineHeight = size * 1.15,
    start = y + h / 2 - ((lines.length - 1) * lineHeight) / 2 + size * 0.34;
  return `<text x="${tx}" y="${start}" text-anchor="${anchor}" xml:space="preserve" style="white-space:pre" fill="${xml(layer.foreground)}" fill-opacity="${layer.textOpacity}" font-family="${xml(fontFamilies[layer.fontFamily])}" font-size="${size}" font-weight="${layer.fontWeight}">${lines.map((line, index) => `<tspan x="${tx}" dy="${index ? lineHeight : 0}">${xml(line)}</tspan>`).join("")}</text>`;
};
const plexBadgeSvg = (template, item, values) => {
  if (template.target !== "plex") return "";
  const choices = template.plexBadges || {},
    badges = [];
  if (choices.monitored) badges.push(values.monitored);
  if (choices.availability) badges.push(values.availability);
  if (choices.cutoff && values.cutoff_status) badges.push(values.cutoff_status);
  let x = 18;
  const rendered = badges.filter(Boolean).map((value) => {
    const text = String(value).toUpperCase(),
      width = Math.min(190, Math.max(76, text.length * 9 + 24)),
      markup = `<g><rect x="${x}" y="824" width="${width}" height="34" rx="17" fill="#174733" fill-opacity=".96"/><text x="${x + width / 2}" y="847" text-anchor="middle" fill="#8ef0bd" font-family="DejaVu Sans, sans-serif" font-size="14" font-weight="700">${xml(text)}</text></g>`;
    x += width + 8;
    return markup;
  });
  if (choices.rating && item.rating) {
    const rating = `★ ${Number(item.rating).toFixed(1)}`;
    rendered.push(
      `<g><rect x="488" y="824" width="94" height="34" rx="17" fill="#09101c" fill-opacity=".96" stroke="#ffd746" stroke-opacity=".45"/><text x="535" y="847" text-anchor="middle" fill="#ffd746" font-family="DejaVu Sans, sans-serif" font-size="15" font-weight="700">${xml(rating)}</text></g>`,
    );
  }
  return rendered.join("");
};
export function renderOverlaySvg({
  poster,
  contentType = "image/jpeg",
  template,
  item,
  context = {},
  includePoster = true,
}) {
  const values = posterVariableValues(item, context),
    layers = (template.layers || [])
      .map((layer) => {
        const sanitized = sanitizeOverlayLayer(layer),
          resolved = resolveConditionalOverlayLayer(sanitized, values);
        return {
          layer: resolved,
          value:
            resolved.variable === "custom_text"
              ? resolved.label
              : values[resolved.variable],
        };
      })
      .filter(({ layer, value }) => visible(layer, value, values)),
    width = 600,
    height = 900,
    fontFamilies = {
      sans: "Arial, Helvetica, sans-serif",
      serif: "Georgia, Times New Roman, serif",
      condensed: "Arial Narrow, Arial,sans-serif",
      monospace: "Courier New, monospace",
    },
    rendered = [];
  for (const { layer, value } of layers) {
    let text = `${layer.prefix || ""}${value || ""}${layer.suffix || ""}`;
    if (layer.textTransform === "uppercase") text = text.toUpperCase();
    if (layer.textTransform === "lowercase") text = text.toLowerCase();
    const boxWidth = Math.min(width, Math.max(90, (width * layer.width) / 100)),
      lineCount = overlayTextLines(
        text,
        layer,
        boxWidth,
        layer.fontSize,
      ).length,
      naturalHeight =
        layer.kind === "icon" || layer.shape === "circle"
          ? boxWidth
          : layer.fontSize * 1.15 * Math.max(1, lineCount) + layer.padding * 2,
      boxHeight =
        layer.kind === "shape" && layer.height > 0
          ? Math.max(27, (height * layer.height) / 100)
          : naturalHeight,
      x = Math.min(width - boxWidth, (width * layer.x) / 100),
      y = Math.min(height - boxHeight, (height * layer.y) / 100),
      shape = overlayShape(layer, x, y, boxWidth, boxHeight),
      textSvg = overlayText(
        text,
        layer,
        x,
        y,
        boxWidth,
        boxHeight,
        fontFamilies,
      );
    if (layer.kind === "icon") {
      const showText = layer.contentPosition !== "none" && text,
        size = Math.max(
          12,
          (boxWidth * layer.iconSize) / 100 - layer.padding * 2,
        ),
        path = overlayIconPaths[layer.iconName] || overlayIconPaths.movie,
        offset = (layer.fontSize + layer.contentGap) / 2,
        ix =
          x +
          (boxWidth - size) / 2 +
          (showText && layer.contentPosition === "left"
            ? offset
            : showText && layer.contentPosition === "right"
              ? -offset
              : 0),
        iy =
          y +
          (boxHeight - size) / 2 +
          (showText && layer.contentPosition === "above"
            ? offset
            : showText && layer.contentPosition === "below"
              ? -offset
              : 0);
      rendered.push(
        `<g>${shape}<path d="${path}" transform="translate(${ix} ${iy}) scale(${size / 24})" fill="none" stroke="${xml(layer.iconColor)}" stroke-opacity="${layer.textOpacity}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${showText ? textSvg : ""}</g>`,
      );
    } else rendered.push(`<g>${shape}${textSvg}</g>`);
  }
  const source = `data:${contentType};base64,${Buffer.from(poster).toString("base64")}`,
    posterSvg = includePoster
      ? `<image href="${source}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`
      : "";
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${posterSvg}<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".45"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#shade)"/>${plexBadgeSvg(template, item, values)}${rendered.join("")}</svg>`,
  );
}
export function overlayRevision(template, item, context = {}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        template,
        itemId: item.id,
        values: posterVariableValues(item, context),
      }),
    )
    .digest("base64url")
    .slice(0, 16);
}
