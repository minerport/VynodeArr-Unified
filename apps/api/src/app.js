import { access, mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { constants as fsConstants, watch } from "node:fs";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
} from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import { extname, join, normalize, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { MediaEngineRegistry } from "../../../packages/platform/src/engine-registry.js";
import {
  loadEngineConfiguration,
  loadSecret,
  publicEngineConfiguration,
} from "../../../packages/platform/src/engine-config.js";
import { SynchronizationService } from "../../../packages/platform/src/synchronization-service.js";
import { ProjectionStore } from "../../../packages/platform/src/projection-store.js";
import { LibraryCatalogStore } from "../../../packages/platform/src/library-catalog-store.js";
import { CatalogEventProcessor } from "../../../packages/platform/src/catalog-event-processor.js";
import { AuthService } from "../../../packages/platform/src/auth-service.js";
import { EngineSettingsService } from "../../../packages/platform/src/engine-settings-service.js";
import { MasterKeyService } from "../../../packages/platform/src/master-key-service.js";
import { EngineManagementService } from "../../../packages/platform/src/engine-management-service.js";
import { EngineUpdateReviewService } from "../../../packages/platform/src/engine-update-review-service.js";
import {
  PlexService,
  plexExternalIds,
  sanitizePlexEndpoint,
} from "../../../packages/platform/src/plex-service.js";
import { JsonStore } from "../../../packages/platform/src/json-store.js";
import { MediaDestinationService } from "../../../packages/platform/src/media-destination-service.js";
import { TrailerDownloadService } from "../../../packages/platform/src/trailer-download-service.js";
import { TrailerPlaybackService } from "../../../packages/platform/src/trailer-playback-service.js";
import {
  GuideTemplateService,
  formatForMovieEngine,
} from "../../../packages/platform/src/guide-template-service.js";
import { BoundedCache } from "../../../packages/platform/src/bounded-cache.js";
import { AsyncLimiter } from "../../../packages/platform/src/async-limiter.js";
import { MovieEngineAdapter } from "../../../packages/movie-domain/src/engine-adapter.js";
import { TvEngineAdapter } from "../../../packages/tv-domain/src/engine-adapter.js";
import { MultiInstanceReadAdapter } from "../../../packages/platform/src/multi-instance-read-adapter.js";
import { MovieFixtureAdapter } from "../../../packages/movie-domain/src/fixture-adapter.js";
import { TvFixtureAdapter } from "../../../packages/tv-domain/src/fixture-adapter.js";
import {
  calendarItem,
  completedQueueItemHasArrived,
} from "../../../packages/contracts/src/mappers.js";
import { TmdbDiscoveryService } from "./tmdb-discovery.js";
import {
  exactEngineMatch,
  lookupTermsForIdentity,
  payloadMatchesIdentity,
} from "./discovery-engine-match.js";
import {
  aggregateOverlayFileMetadata,
  overlayRevision,
  posterVariableValues,
  posterVariables,
  renderOverlaySvg,
  resolveOverlayTemplate,
  sanitizeOverlayAssignment,
  sanitizeOverlayLayer,
  sanitizeOverlayTemplate,
} from "../../../packages/platform/src/poster-overlay-service.js";
const applicationVersion = JSON.parse(
  await readFile(resolve(process.cwd(), "package.json"), "utf8"),
).version;
const webRoot = resolve(process.cwd(), "apps/web/public");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const compressible = new Set([".html", ".css", ".js", ".svg"]);
function versionWebDocument(path, value) {
  return extname(path) === ".html"
    ? Buffer.from(
        value
          .toString("utf8")
          .replaceAll(
            "__VYNODEARR_VERSION__",
            encodeURIComponent(applicationVersion),
          ),
      )
    : value;
}
export function televisionAddPayload(input = {}) {
  const addOptions = input.addOptions || {},
    monitor = String(
      addOptions.monitor ||
        input.monitor ||
        (input.monitored === false ? "none" : "all"),
    );
  return {
    ...input,
    addOptions: {
      ...addOptions,
      monitor: monitor,
      searchForMissingEpisodes: addOptions.searchForMissingEpisodes === true,
      searchForCutoffUnmetEpisodes:
        addOptions.searchForCutoffUnmetEpisodes === true,
    },
  };
}
export function resolveOwnedEngineInstance(queryInstanceId, ownedInstanceId) {
  const queryId=String(queryInstanceId||'').trim()||null,ownedId=String(ownedInstanceId||'').trim()||null;
  if(queryId&&ownedId&&queryId!==ownedId)throw new Error('The media identifier belongs to a different engine instance');
  return queryId||ownedId||null;
}
export function attachEngineOwnership(result, instance) {
  if (!instance?.id || result == null) return result;
  const own = (value) => value && typeof value === "object" && !Array.isArray(value)
    ? { ...value, engineInstanceId: instance.id, engineInstanceName: instance.name || null }
    : value;
  if (Array.isArray(result)) return result.map(own);
  if (Array.isArray(result.records)) return { ...result, records: result.records.map(own) };
  return own(result);
}
export async function filesystemLocationIdentity(path) {
  const resolved = await realpath(String(path || "")),
    details = await stat(resolved);
  return `${details.dev}:${details.ino}`;
}
async function staticResponse(
  req,
  res,
  path,
  value,
  { fallback: fallback = false } = {},
) {
  const extension = extname(path),
    contentType = mime[extension] || "application/octet-stream";
  const tag = `W/"${createHash("sha256").update(value).digest("base64url")}"`;
  const hashed = /\/react\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/.test(
    path.replaceAll("\\", "/"),
  );
  const stableCode = !hashed && (extension === ".js" || extension === ".css");
  const cacheControl =
    fallback || extension === ".html" || stableCode
      ? "no-cache"
      : hashed
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600, stale-while-revalidate=86400";
  const headers = {
    "content-type": contentType,
    "cache-control": cacheControl,
    etag: tag,
    "x-content-type-options": "nosniff",
  };
  if (compressible.has(extension)) headers.vary = "Accept-Encoding";
  if (req.headers["if-none-match"] === tag) {
    res.writeHead(304, headers);
    return res.end();
  }
  const acceptsGzip = /\bgzip\b/i.test(
      String(req.headers["accept-encoding"] || ""),
    ),
    shouldCompress =
      acceptsGzip && compressible.has(extension) && value.length >= 1024;
  const output = shouldCompress ? await gzipAsync(value) : value;
  if (shouldCompress) headers["content-encoding"] = "gzip";
  headers["content-length"] = String(output.length);
  res.writeHead(200, headers);
  res.end(output);
}
const cookies = (header = "") =>
  Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("=").map(decodeURIComponent))
      .filter(([key]) => key),
  );
const redact = (value) =>
  String(value || "")
    .replace(/https?:\/\/\S+/gi, "[internal service]")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "[internal host]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]");
async function body(req, maxSize = 15e5) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxSize) throw new Error("Request is too large");
    chunks.push(chunk);
  }
  return chunks.length
    ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
    : {};
}
function json(res, status, value, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...headers,
  });
  res.end(JSON.stringify(value));
}
function templateDiff(before, after, fields) {
  return fields.flatMap((field) => {
    const previous = before?.[field] ?? null,
      next = after?.[field] ?? null;
    return JSON.stringify(previous) === JSON.stringify(next)
      ? []
      : [{ field: field, before: previous, after: next }];
  });
}
function templateChange(resource, name, before, after, fields) {
  const details = before ? templateDiff(before, after, fields) : [];
  return {
    resource: resource,
    name: name,
    action: before ? (details.length ? "update" : "unchanged") : "add",
    details: details,
  };
}
function templatePlan(changes) {
  return {
    requiresConfirmation: changes.some((item) => item.action === "update"),
    hasChanges: changes.some((item) => item.action !== "unchanged"),
    changes: changes,
    observedAt: new Date().toISOString(),
  };
}
function safeError(res, error, domain, url = "") {
  const engine = Boolean(
    error?.safeMessage || error?.code?.startsWith("engine_"),
  );
  const message = redact(
    engine
      ? error.safeMessage ||
          (domain
            ? `${domain} service unavailable`
            : "Media data could not be refreshed")
      : error?.message || "The request could not be completed.",
  );
  const status =
    error?.code === "engine_validation_failed"
      ? 400
      : error?.code === "engine_authentication_failed"
        ? 502
        : engine
          ? 503
          : 400;
  json(res, status, {
    error: {
      code: engine ? error.code || "service_unavailable" : "validation_failed",
      message: message,
    },
  });
}
function sessionFor(req, auth) {
  return auth.session(cookies(req.headers.cookie).vynodearr_session);
}
function requireSession(req, res, auth) {
  const session = sessionFor(req, auth);
  if (!session) {
    json(res, 401, {
      error: {
        code: "authentication_required",
        message: "Sign in to VynodeArr to continue.",
      },
    });
    return null;
  }
  return session;
}
function requireCsrf(req, res, session) {
  if (req.headers["x-vynodearr-csrf"] !== session.csrf) {
    json(res, 403, {
      error: {
        code: "csrf_invalid",
        message: "The security token was invalid.",
      },
    });
    return false;
  }
  return true;
}
function administrator(res, session) {
  if (session.user.role !== "administrator") {
    json(res, 403, {
      error: {
        code: "administrator_required",
        message: "Administrator access is required.",
      },
    });
    return false;
  }
  return true;
}
function permitted(res, session, page) {
  if (
    session.user.role === "administrator" ||
    session.user.permissions?.[page] === true
  )
    return true;
  json(res, 403, {
    error: {
      code: "permission_required",
      message: `Your account does not have access to ${page}.`,
    },
  });
  return false;
}
const hopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
function dashboardAnalytics(
  movies = [],
  series = [],
  history = [],
  days = 30,
  qualityProfiles = {},
) {
  const dayKeys = Array.from({ length: days }, (_, index) =>
    new Date(Date.now() - (days - index - 1) * 864e5)
      .toISOString()
      .slice(0, 10),
  );
  const downloads = {
    movie: Object.fromEntries(dayKeys.map((day) => [day, 0])),
    tv: Object.fromEntries(dayKeys.map((day) => [day, 0])),
  };
  const activity = {
    movie: { completed: 0, grabbed: 0, failed: 0 },
    tv: { completed: 0, grabbed: 0, failed: 0 },
  };
  for (const item of history) {
    const domain = item.domain === "tv" ? "tv" : "movie",
      event = String(item.eventType || "").toLowerCase();
    const parsedTimestamp = item.timestamp ? new Date(item.timestamp) : null;
    const day =
      parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
        ? parsedTimestamp.toISOString().slice(0, 10)
        : "";
    if (event.includes("failed")) activity[domain].failed++;
    else if (event.includes("grabbed")) activity[domain].grabbed++;
    else if (event === "downloadfolderimported") {
      activity[domain].completed++;
      if (day in downloads[domain]) downloads[domain][day]++;
    }
  }
  const distribution = (items, selector) =>
    Object.entries(
      items.reduce((counts, item) => {
        const value = selector(item) || "Unknown";
        counts[value] = (counts[value] || 0) + 1;
        return counts;
      }, {}),
    )
      .map(([name, count]) => ({ name: name, count: count }))
      .sort((left, right) => right.count - left.count);
  const movieAvailable = movies.filter((item) => item.hasFile).length;
  const tvMissing = series.reduce(
    (sum, item) =>
      sum + Number(item.monitoring === "none" ? 0 : item.missingEpisodes || 0),
    0,
  );
  return {
    rangeDays: days,
    downloadsOverTime: {
      movie: dayKeys.map((date) => ({
        date: date,
        count: downloads.movie[date],
      })),
      tv: dayKeys.map((date) => ({ date: date, count: downloads.tv[date] })),
    },
    qualityDistribution: {
      movie: distribution(movies, (item) => item.quality),
      tv: distribution(
        series,
        (item) =>
          qualityProfiles.tv?.get(String(item.qualityProfile)) ||
          item.qualityProfile,
      ),
    },
    activity: activity,
    library: {
      movie: {
        total: movies.length,
        available: movieAvailable,
        missing: movies.filter((item) => item.state === "missing").length,
        belowCutoff: movies.filter((item) => item.state === "cutoff").length,
        monitored: movies.filter((item) => item.monitoring !== "none").length,
        sizeOnDisk: movies.reduce(
          (sum, item) => sum + Number(item.sizeOnDisk || 0),
          0,
        ),
      },
      tv: {
        total: series.length,
        complete: series.filter(
          (item) => Number(item.missingEpisodes || 0) === 0,
        ).length,
        needsAttention: series.filter(
          (item) =>
            item.monitoring !== "none" && Number(item.missingEpisodes || 0) > 0,
        ).length,
        monitored: series.filter((item) => item.monitoring !== "none").length,
        episodesMissing: tvMissing,
        sizeOnDisk: series.reduce(
          (sum, item) => sum + Number(item.sizeOnDisk || 0),
          0,
        ),
      },
    },
  };
}
export function createApplication(options = {}) {
  const env = options.env || process.env,
    baseConfig = options.config || loadEngineConfiguration(env);
  let dashboardSnapshot = null,
    dashboardSnapshotExpires = 0,
    dashboardSnapshotRun = null;
  let dashboardHistorySnapshot = null,
    dashboardHistoryExpires = 0,
    dashboardHistoryRun = null;
  const dataDir = resolve(
    env.VYNODEARR_DATA_DIR || resolve(process.cwd(), "data"),
  );
  const auth =
    options.auth ||
    new AuthService({
      userFile: join(dataDir, "users.json"),
      sessionFile: join(dataDir, "sessions.json"),
      secureCookies:
        String(
          env.VYNODEARR_SECURE_COOKIES || env.NODE_ENV === "production",
        ) === "true",
    });
  const masterKeyService =
    options.masterKeyService ||
    new MasterKeyService({
      path: join(dataDir, "master-key"),
      vaultPath: join(dataDir, "credentials.enc"),
      configuredKey:
        options.masterKey || loadSecret(env, "VYNODEARR_MASTER_KEY"),
    });
  const engineSettings =
    options.engineSettings ||
    new EngineSettingsService({
      path: join(dataDir, "engine-settings.json"),
      vaultPath: join(dataDir, "credentials.enc"),
      masterKey: masterKeyService.resolve(),
      defaults: baseConfig,
      bundled: String(env.VYNODEARR_BUNDLED_ENGINES || "false") === "true",
    });
  const projectionStore =
    options.projectionStore ||
    (baseConfig.dataMode === "fixture" || options.movie || options.tv
      ? new ProjectionStore(join(dataDir, "projections.json"))
      : new LibraryCatalogStore(join(dataDir, "library-catalog.sqlite"), {
          legacyPath: join(dataDir, "projections.json"),
        }));
  const performanceStore =
    options.performanceStore ||
    new JsonStore(join(dataDir, "performance-settings.json"), {
      version: 1,
      pageSize: 60,
      eventConcurrency: 2,
      artworkFetchConcurrency: 2,
      artworkWriteConcurrency: 1,
      integrityIntervalMinutes: 360,
      updatedAt: null,
    });
  let configuredLibraryPageSize = 60;
  const artworkDiskDir = join(dataDir, "artwork-cache"),
    artworkDiskStore =
      options.artworkDiskStore ||
      new JsonStore(join(dataDir, "artwork-cache.json"), {
        version: 1,
        entries: {},
      });
  const auditStore =
    options.auditStore ||
    new JsonStore(join(dataDir, "management-audit.json"), {
      version: 1,
      entries: [],
    });
  const collectionStore =
    options.collectionStore ||
    new JsonStore(join(dataDir, "collections.json"), {
      version: 1,
      collections: [],
    });
  const reeltrackListStore =
    options.reeltrackListStore ||
    new JsonStore(join(dataDir, "reeltrack-lists.json"), {
      version: 1,
      users: {},
    });
  const posterOverlayStore =
    options.posterOverlayStore ||
    new JsonStore(join(dataDir, "poster-overlays.json"), {
      version: 1,
      templates: [],
      assignments: [],
    });
  const plexSettingsStore =
    options.plexSettingsStore ||
    new JsonStore(join(dataDir, "plex-settings.json"), {
      version: 1,
      endpoint: "",
      server: null,
      libraries: [],
      updatedAt: null,
    });
  const plexPosterApplicationStore =
    options.plexPosterApplicationStore ||
    new JsonStore(join(dataDir, "plex-poster-applications.json"), {
      version: 1,
      applications: [],
    });
  const plexPosterBackupDir = join(dataDir, "plex-poster-backups"),
    reeltrackPosterBackgroundDir = join(dataDir, "reeltrack-poster-backgrounds"),
    reeltrackArtworkBackupDir = join(dataDir, "reeltrack-artwork-originals");
  const plexService = options.plexService || new PlexService();
  const plexTrailerCache = new Map();
  const trailerDownloader =
    options.trailerDownloader ||
    new TrailerDownloadService({
      binary: env.VYNODEARR_YTDLP_BINARY || "yt-dlp",
      movieRoot: env.VYNODEARR_TRAILER_DIR || env.VYNODEARR_MOVIE_LIBRARY_PATH || "/movies",
      tvRoot: env.VYNODEARR_TV_LIBRARY_PATH || "/tv",
      sharedRoots: ["/media"],
    });
  const trailerPlayback =
    options.trailerPlayback ||
    new TrailerPlaybackService({
      movieRoot:
        trailerDownloader.roots?.movie ||
        env.VYNODEARR_TRAILER_DIR ||
        env.VYNODEARR_MOVIE_LIBRARY_PATH ||
        "/movies",
      tvRoot:
        trailerDownloader.roots?.tv || env.VYNODEARR_TV_LIBRARY_PATH || "/tv",
    });
  const requestStore =
    options.requestStore ||
    new JsonStore(join(dataDir, "user-requests.json"), {
      version: 1,
      requests: [],
      notificationReads: {},
    });
  const notificationStore =
    options.notificationStore ||
    new JsonStore(join(dataDir, "notification-events.json"), {
      version: 1,
      events: [],
      reads: {},
      dismissed: {},
    });
  const searchActivityStore =
    options.searchActivityStore ||
    new JsonStore(join(dataDir, "search-activity.json"), {
      version: 1,
      activities: [],
      dismissed: {},
    });
  const downloadDecisionStore =
    options.downloadDecisionStore ||
    new JsonStore(join(dataDir, "download-decisions.json"), {
      version: 1,
      decisions: [],
    });
  const operationsCenterStore =
    options.operationsCenterStore ||
    new JsonStore(join(dataDir, "operations-center.json"), {
      version: 1,
      dismissed: {},
      healthDismissed: {},
    });
  const guideTemplateStore =
    options.guideTemplateStore ||
    new JsonStore(join(dataDir, "guide-templates.json"), {
      version: 1,
      records: {},
    });
  const engineAuthenticationStore =
    options.engineAuthenticationStore ||
    new JsonStore(join(dataDir, "engine-authentication.json"), {
      version: 1,
      initialized: false,
      movie: null,
      tv: null,
      updatedAt: null,
    });
  const guideTemplates =
    options.guideTemplates ||
    new GuideTemplateService({
      store: guideTemplateStore,
      fetcher: options.fetcher || globalThis.fetch,
    });
  const defaultDownloadFolder = (domain) =>
    String(
      env[
        domain === "movie"
          ? "VYNODEARR_MOVIE_DOWNLOADS_PATH"
          : "VYNODEARR_TV_DOWNLOADS_PATH"
      ] ||
        env.VYNODEARR_DOWNLOADS_PATH ||
        "/downloads",
    ).replace(/\/+$/, "") || "/downloads";
  const downloadClientRemotePath = (domain) =>
    String(
      env[
        domain === "movie"
          ? "VYNODEARR_MOVIE_DOWNLOAD_CLIENT_REMOTE_PATH"
          : "VYNODEARR_TV_DOWNLOAD_CLIENT_REMOTE_PATH"
      ] ||
        env.VYNODEARR_DOWNLOAD_CLIENT_REMOTE_PATH ||
        "/data/complete",
    ).replace(/\/+$/, "") || "/data/complete";
  const downloadFolderStore =
    options.downloadFolderStore ||
    new JsonStore(join(dataDir, "download-folders.json"), {
      version: 1,
      movie: { path: defaultDownloadFolder("movie") },
      tv: { path: defaultDownloadFolder("tv") },
      updatedAt: null,
    });
  const validationStore =
    options.validationStore ||
    new JsonStore(join(dataDir, "system-validation.json"), {
      version: 1,
      report: null,
      updatedAt: null,
    });
  const mediaDestinationStore =
    options.mediaDestinationStore ||
    new JsonStore(join(dataDir, "media-destinations.json"), {
      version: 2,
      initialized: false,
      initializedDomains: [],
      destinations: [],
      updatedAt: null,
    });
  const engineStorageMappingStore =
    options.engineStorageMappingStore ||
    new JsonStore(join(dataDir, "engine-storage-mappings.json"), {
      version: 1,
      mappings: [],
      updatedAt: null,
    });
  const mediaDestinations =
    options.mediaDestinations || new MediaDestinationService(mediaDestinationStore);
  const engineStorageStatus = async (instance, root, mapping = null) => {
    const enginePath = normalizeMediaPath(root?.path),
      vynodePath = normalizeMediaPath(mapping?.vynodePath || enginePath),
      hostPath = String(mapping?.hostPath || "").trim();
    let exists = false, directory = false, writable = false, error = null;
    try {
      const details = await stat(vynodePath);
      exists = true;
      directory = details.isDirectory();
      if (directory) { await access(vynodePath, fsConstants.R_OK | fsConstants.W_OK); writable = true; }
    } catch (reason) { error = reason instanceof Error ? reason.message : "The folder is not accessible."; }
    const accessible = exists && directory && writable;
    return {
      engineInstanceId: instance.id,
      engineInstanceName: instance.name,
      domain: instance.domain,
      enginePath,
      vynodePath,
      hostPath: hostPath || null,
      mapped: Boolean(mapping),
      exists,
      directory,
      writable,
      accessible,
      status: accessible ? "ready" : exists && directory ? "read-only" : mapping ? "not-mounted" : "mapping-required",
      restartRequired: !accessible,
      error: accessible ? null : error,
      explanation: accessible
        ? "VynodeArr can read and write this external-engine library folder."
        : `The external engine can use ${enginePath}, but that path is not currently usable inside the VynodeArr container.`,
      remediation: {
        docker: hostPath ? `Add this volume to VynodeArr and recreate the container: ${hostPath}:${vynodePath}:rw` : `Map the same host folder used by ${instance.name} into the VynodeArr container at ${vynodePath} with read/write access.`,
        unraid: hostPath ? `Edit the VynodeArr container, add a Path with host path ${hostPath} and container path ${vynodePath}, apply the change, then restart VynodeArr.` : `In Unraid, edit the VynodeArr container and add the same Host Path used by ${instance.name}. Set its Container Path to ${vynodePath}, use Read/Write access, apply, and restart VynodeArr.`,
      },
    };
  };
  async function instanceStorage(instanceId) {
    const instance = engineSettings.public().instances.find((item) => item.id === instanceId && item.enabled !== false);
    if (!instance) throw new Error("Choose an available engine instance");
    const [rootsValue, stored] = await Promise.all([
      management.execute(instance.domain, "rootFolders", "GET", { engineInstanceId: instance.id }),
      engineStorageMappingStore.read(),
    ]), roots = Array.isArray(rootsValue) ? rootsValue : rootsValue?.records || [], mappings = Array.isArray(stored.mappings) ? stored.mappings : [];
    return Promise.all(roots.map((root) => engineStorageStatus(instance, root, mappings.find((item) => item.engineInstanceId === instance.id && normalizeMediaPath(item.enginePath) === normalizeMediaPath(root.path)))));
  }
  async function vynodeAccessiblePath(domain, enginePath, engineInstanceId = null) {
    const source = normalizeMediaPath(enginePath);
    if (!source || !engineInstanceId) return source;
    const stored = await engineStorageMappingStore.read(), mappings = (Array.isArray(stored.mappings) ? stored.mappings : [])
      .filter((item) => item.domain === domain && item.engineInstanceId === engineInstanceId)
      .sort((left, right) => normalizeMediaPath(right.enginePath).length - normalizeMediaPath(left.enginePath).length),
      mapping = mappings.find((item) => source === normalizeMediaPath(item.enginePath) || source.startsWith(`${normalizeMediaPath(item.enginePath)}/`));
    if (!mapping) return source;
    const engineRoot = normalizeMediaPath(mapping.enginePath), localRoot = normalizeMediaPath(mapping.vynodePath);
    return `${localRoot}${source.slice(engineRoot.length)}`;
  }
  const engineUpdateReview =
    options.engineUpdateReview ||
    new EngineUpdateReviewService({
      fetcher: options.fetcher || globalThis.fetch,
      versions: {
        movie: env.VYNODEARR_MOVIE_ENGINE_VERSION || "6.3.0.10514",
        tv: env.VYNODEARR_TV_ENGINE_VERSION || "4.0.19.2979",
      },
    });
  const applicationBackupFiles = [
    "users.json",
    "engine-settings.json",
    "credentials.enc",
    "master-key",
    "collections.json",
    "reeltrack-lists.json",
    "poster-overlays.json",
    "plex-settings.json",
    "plex-poster-applications.json",
    "user-requests.json",
    "notification-events.json",
    "guide-templates.json",
    "engine-authentication.json",
    "download-folders.json",
    "media-destinations.json",
    "engine-storage-mappings.json",
    "performance-settings.json",
    "projections.json",
  ];
  const applicationHistoryFiles = [
    "search-activity.json",
    "download-decisions.json",
    "operations-center.json",
  ];
  const applicationAuditFiles = ["management-audit.json"];
  const applicationBackupKey = (password, salt) =>
    scryptSync(String(password), salt, 32);
  async function applicationBackupPayload(input = {}) {
    const password = String(input.password || "");
    if (password.length < 12)
      throw new Error("Use a backup password with at least 12 characters");
    if (typeof projectionStore.exportSnapshot === "function")
      await writeFile(
        join(dataDir, "projections.json"),
        JSON.stringify(await projectionStore.exportSnapshot(), null, 2),
        { mode: 416 },
      );
    const names = [
        ...applicationBackupFiles,
        ...(input.includeHistory === false ? [] : applicationHistoryFiles),
        ...(input.includeAudit === false ? [] : applicationAuditFiles),
      ],
      files = {};
    for (const name of names) {
      const value = await readFile(join(dataDir, name)).catch(() => null);
      if (value) files[name] = value.toString("base64");
    }
    const createdAt = new Date().toISOString(),
      payload = {
        format: "vynodearr-application-backup",
        version: 1,
        applicationVersion: applicationVersion,
        createdAt: createdAt,
        options: {
          history: input.includeHistory !== false,
          audit: input.includeAudit !== false,
        },
        masterKeyManaged: masterKeyService.status().managed,
        files: files,
      };
    const salt = randomBytes(16),
      iv = randomBytes(12),
      cipher = createCipheriv(
        "aes-256-gcm",
        applicationBackupKey(password, salt),
        iv,
      ),
      encrypted = Buffer.concat([
        cipher.update(JSON.stringify(payload), "utf8"),
        cipher.final(),
      ]),
      envelope = {
        format: payload.format,
        version: 1,
        kdf: "scrypt",
        cipher: "aes-256-gcm",
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: encrypted.toString("base64"),
      };
    return {
      buffer: await gzipAsync(Buffer.from(JSON.stringify(envelope))),
      payload: payload,
    };
  }
  async function inspectApplicationBackup(file, password) {
    if (!(file instanceof File) || !file.size || file.size > 1e8)
      throw new Error(
        "Choose a VynodeArr application backup smaller than 100 MB",
      );
    if (!/\.vynodearr-backup$/i.test(file.name))
      throw new Error("Choose a .vynodearr-backup file");
    if (String(password || "").length < 12)
      throw new Error("Enter the password used to create this backup");
    let envelope, payload;
    try {
      envelope = JSON.parse(
        (await gunzipAsync(Buffer.from(await file.arrayBuffer()))).toString(
          "utf8",
        ),
      );
      if (
        envelope?.format !== "vynodearr-application-backup" ||
        envelope.version !== 1 ||
        envelope.kdf !== "scrypt" ||
        envelope.cipher !== "aes-256-gcm" ||
        ![envelope.salt, envelope.iv, envelope.tag, envelope.data].every(
          (value) => typeof value === "string" && value.length,
        )
      )
        throw new Error("unsupported");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        applicationBackupKey(password, Buffer.from(envelope.salt, "base64")),
        Buffer.from(envelope.iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      payload = JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(envelope.data, "base64")),
          decipher.final(),
        ]).toString("utf8"),
      );
    } catch {
      throw new Error(
        "The backup password is incorrect or the archive is damaged",
      );
    }
    if (
      envelope.format !== "vynodearr-application-backup" ||
      payload?.format !== envelope.format ||
      payload.version !== 1 ||
      !payload.files ||
      typeof payload.files !== "object"
    )
      throw new Error("This is not a supported VynodeArr application backup");
    const allowed = new Set([
        ...applicationBackupFiles,
        ...applicationHistoryFiles,
        ...applicationAuditFiles,
      ]),
      names = Object.keys(payload.files);
    if (names.some((name) => !allowed.has(name)))
      throw new Error("The backup contains an unsupported application file");
    for (const [name, value] of Object.entries(payload.files)) {
      const decoded = Buffer.from(String(value), "base64");
      if (name.endsWith(".json"))
        try {
          JSON.parse(decoded.toString("utf8"));
        } catch {
          throw new Error(`${name} is not valid JSON`);
        }
    }
    const groups = {
      identity: names.includes("users.json"),
      credentials: names.includes("credentials.enc"),
      masterKey: names.includes("master-key"),
      notifications: names.includes("notification-events.json"),
      requests: names.includes("user-requests.json"),
      collections: names.includes("collections.json"),
      history: names.includes("search-activity.json"),
      audit: names.includes("management-audit.json"),
    };
    return {
      payload: payload,
      summary: {
        fileName: file.name,
        createdAt: payload.createdAt,
        applicationVersion: payload.applicationVersion,
        fileCount: names.length,
        groups: groups,
        masterKeyManaged: payload.masterKeyManaged,
        warnings: [
          ...(payload.masterKeyManaged
            ? []
            : [
                "This backup used an environment-managed master key. Restore it only with the same configured key.",
              ]),
          ...(!groups.credentials ||
          (payload.masterKeyManaged && !groups.masterKey)
            ? [
                "Credential material is incomplete. Saved external connections may require reconfiguration.",
              ]
            : []),
        ],
      },
    };
  }
  async function restoreApplicationBackup(payload) {
    const restored = [];
    for (const [name, value] of Object.entries(payload.files)) {
      const target = join(dataDir, name),
        temporary = `${target}.restore-${randomUUID()}`;
      await writeFile(temporary, Buffer.from(String(value), "base64"), {
        mode: name === "master-key" || name === "credentials.enc" ? 384 : 416,
      });
      await rename(temporary, target);
      restored.push(name);
    }
    if (
      payload.files["projections.json"] &&
      typeof projectionStore.restoreSnapshot === "function"
    )
      await projectionStore.restoreSnapshot(
        JSON.parse(
          Buffer.from(
            String(payload.files["projections.json"]),
            "base64",
          ).toString("utf8"),
        ),
      );
    return restored;
  }
  async function systemValidation() {
    const checks = [],
      managed = String(env.VYNODEARR_BUNDLED_ENGINES || "false") === "true",
      add = (id, group, title, status, message, action, details = []) =>
        checks.push({
          id: id,
          group: group,
          title: title,
          status: status,
          message: message,
          ...(details.length ? { details: details } : {}),
          ...(action ? { action: action } : {}),
        });
    const reportedHealth = await sync.operations("health").catch(() => []);
    for (const domain of ["movie", "tv"]) {
      const title = domain === "movie" ? "Movies" : "Television",
        connection = await registry
          .get(domain)
          .testConnection()
          .catch((error) => ({
            reachable: false,
            authenticated: false,
            compatible: false,
            safeError:
              error instanceof Error ? error.message : "Connection failed",
          }));
      const connected =
        connection.reachable &&
        connection.authenticated &&
        connection.compatible;
      add(
        `${domain}-connection`,
        "Media engines",
        `${title} engine`,
        connected ? "healthy" : "failed",
        connected
          ? "Connection, authentication, and API compatibility passed."
          : connection.safeError ||
              "The engine could not be reached and authenticated.",
        managed
          ? { label: "Repair connection", repair: "engine-connections" }
          : { label: "Review engine settings", href: "#settings/engines" },
      );
      if (!connected) continue;
      const [
        rootsResult,
        indexersResult,
        clientsResult,
        tasksResult,
        disksResult,
      ] = await Promise.allSettled(
        [
          "rootFolders",
          "indexers",
          "downloadClients",
          "tasks",
          "diskSpace",
        ].map((resource) => management.execute(domain, resource, "GET", {})),
      );
      const value = (result) =>
        result.status === "fulfilled" && Array.isArray(result.value)
          ? result.value
          : [];
      const roots = value(rootsResult),
        indexers = value(indexersResult),
        clients = value(clientsResult),
        tasks = value(tasksResult),
        disks = value(disksResult),
        health = reportedHealth.filter((item) => item.domain === domain);
      const rootFailures = roots.filter(
          (root) => root.accessible === false || Number(root.freeSpace) < 0,
        ),
        lowSpace = disks.filter(
          (disk) =>
            Number(disk.totalSpace) > 0 &&
            Number(disk.freeSpace) < 10 * 1024 * 1024 * 1024,
        );
      add(
        `${domain}-storage`,
        "Storage & libraries",
        `${title} library paths`,
        rootsResult.status === "rejected" ||
          !roots.length ||
          rootFailures.length
          ? "failed"
          : lowSpace.length
            ? "warning"
            : "healthy",
        rootsResult.status === "rejected"
          ? "Root folders could not be read."
          : !roots.length
            ? "No root folder is configured."
            : rootFailures.length
              ? "One or more root folders are unavailable."
              : lowSpace.length
                ? "A library path has less than 10 GB free."
                : `${roots.length} root folder${roots.length === 1 ? " is" : "s are"} available.`,
        { label: "Review root folders", href: "#service/root-folders" },
        [
          ...rootFailures.map(
            (root) => `${root.path || "Root folder"} is unavailable`,
          ),
          ...lowSpace.map(
            (disk) => `${disk.path || "Storage path"} is low on space`,
          ),
        ],
      );
      const enabledIndexers = indexers.filter(
          (item) =>
            item.enable !== false && item.enableAutomaticSearch !== false,
        ),
        enabledClients = clients.filter((item) => item.enable !== false);
      add(
        `${domain}-indexers`,
        "Search & downloads",
        `${title} indexers`,
        indexersResult.status === "rejected" || !enabledIndexers.length
          ? "failed"
          : health.some((item) =>
                /indexer|rss sync/i.test(
                  `${item.source || ""} ${item.message || ""}`,
                ),
              )
            ? "warning"
            : "healthy",
        indexersResult.status === "rejected"
          ? "Indexer configuration could not be read."
          : !enabledIndexers.length
            ? "No enabled automatic-search indexer is configured."
            : `${enabledIndexers.length} enabled indexer${enabledIndexers.length === 1 ? " is" : "s are"} configured.`,
        { label: "Review indexers", href: "#service/indexers" },
      );
      add(
        `${domain}-clients`,
        "Search & downloads",
        `${title} download clients`,
        clientsResult.status === "rejected" || !enabledClients.length
          ? "failed"
          : health.some((item) =>
                /download client/i.test(
                  `${item.source || ""} ${item.message || ""}`,
                ),
              )
            ? "warning"
            : "healthy",
        clientsResult.status === "rejected"
          ? "Download-client configuration could not be read."
          : !enabledClients.length
            ? "No enabled download client is configured."
            : `${enabledClients.length} enabled download client${enabledClients.length === 1 ? " is" : "s are"} configured.`,
        { label: "Review download clients", href: "#service/download-clients" },
      );
      const unscheduled = tasks.filter((task) => !task.nextExecution);
      add(
        `${domain}-tasks`,
        "Automation",
        `${title} scheduled tasks`,
        tasksResult.status === "rejected" || !tasks.length
          ? "failed"
          : unscheduled.length
            ? "warning"
            : "healthy",
        tasksResult.status === "rejected"
          ? "Scheduled tasks could not be read."
          : !tasks.length
            ? "No engine tasks were reported."
            : unscheduled.length
              ? `${unscheduled.length} task${unscheduled.length === 1 ? " has" : "s have"} no next execution time.`
              : `${tasks.length} recurring tasks are scheduled.`,
        { label: "Review tasks", href: "#system" },
      );
      const severeHealth = health.filter((item) =>
        /error|critical|failure/i.test(
          String(item.severity || item.type || ""),
        ),
      );
      add(
        `${domain}-health`,
        "Media engines",
        `${title} reported health`,
        severeHealth.length ? "failed" : health.length ? "warning" : "healthy",
        health.length
          ? `${health.length} engine warning${health.length === 1 ? " requires" : "s require"} review.`
          : "The engine reports no active health warnings.",
        { label: "Open Health", href: "#health" },
        health
          .slice(0, 5)
          .map((item) => String(item.message || "Engine warning")),
      );
      const synchronization = sync.snapshot()[domain],
        syncHealthy =
          synchronization?.status === "ready" && synchronization.lastSuccess;
      add(
        `${domain}-synchronization`,
        "Automation",
        `${title} library synchronization`,
        syncHealthy
          ? "healthy"
          : synchronization?.status === "stale"
            ? "warning"
            : "failed",
        syncHealthy
          ? `Last completed ${synchronization.lastSuccess}.`
          : synchronization?.safeError ||
              "No successful library synchronization is recorded.",
        { label: "Re-synchronize", repair: "synchronize" },
      );
    }
    const stores = [
        ["Users", () => auth.listUsers()],
        ["Requests", () => requestStore.read()],
        ["Collections", () => collectionStore.read()],
        ["Notifications", () => notificationStore.read()],
      ],
      storeResults = await Promise.allSettled(stores.map(([, read]) => read())),
      failedStores = storeResults
        .map((result, index) =>
          result.status === "rejected" ? stores[index][0] : null,
        )
        .filter(Boolean);
    add(
      "application-data",
      "Application",
      "Application data stores",
      failedStores.length ? "failed" : "healthy",
      failedStores.length
        ? `${failedStores.join(", ")} data could not be read.`
        : "Users, requests, collections, and notification data are readable.",
      failedStores.length ? { label: "Review backups", href: "#system" } : null,
    );
    const keyStatus = masterKeyService.status();
    add(
      "master-key",
      "Security",
      "Credential encryption",
      keyStatus.source ? "healthy" : "failed",
      keyStatus.managed
        ? "The persistent application master key is available."
        : "The environment-managed master key is available.",
      { label: "Review security", href: "#system" },
    );
    const notificationData = await notificationStore.read(),
      channels = (notificationData.channels || []).filter(
        (channel) => channel.enabled !== false,
      ),
      credentialResults = await Promise.all(
        channels.map((channel) =>
          engineSettings.notificationCredential(channel.id),
        ),
      ),
      missingCredentials = channels.filter(
        (channel, index) => !credentialResults[index],
      ),
      failureCutoff = Date.now() - 7 * 864e5,
      recentFailures = (notificationData.deliveries || [])
        .filter(
          (item) =>
            item.status === "failed" &&
            new Date(item.timestamp).getTime() >= failureCutoff,
        )
        .slice(0, 5);
    add(
      "notifications",
      "Notifications",
      "External notification channels",
      missingCredentials.length
        ? "failed"
        : recentFailures.length
          ? "warning"
          : "healthy",
      missingCredentials.length
        ? `${missingCredentials.length} enabled channel${missingCredentials.length === 1 ? " is" : "s are"} missing credentials.`
        : recentFailures.length
          ? "Recent external deliveries failed. Review channel history before relying on alerts."
          : channels.length
            ? `${channels.length} enabled channel${channels.length === 1 ? " is" : "s are"} configured with protected credentials.`
            : "No external channel is enabled; in-app notifications remain active.",
      null,
      [
        ...missingCredentials.map(
          (channel) => `${channel.name} is missing its protected credential`,
        ),
        ...recentFailures.map(
          (item) =>
            `${item.channelName || "Channel"}: ${item.error || "delivery failed"}`,
        ),
      ],
    );
    const summary = {
        healthy: checks.filter((check) => check.status === "healthy").length,
        warning: checks.filter((check) => check.status === "warning").length,
        failed: checks.filter((check) => check.status === "failed").length,
      },
      overall = summary.failed
        ? "failed"
        : summary.warning
          ? "warning"
          : "healthy";
    return {
      generatedAt: new Date().toISOString(),
      applicationVersion: applicationVersion,
      overall: overall,
      summary: summary,
      checks: checks,
    };
  }
  async function recordAudit(
    session,
    {
      category: category = "configuration",
      action: action,
      target: target = "",
      summary: summary = "",
      domain: domain = null,
      metadata: metadata = {},
    },
  ) {
    const entry = {
      id: `audit_${randomUUID()}`,
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      username: session.user.username,
      actorName: session.user.name || session.user.username,
      category: category,
      action: action,
      target: String(target || ""),
      summary: String(summary || ""),
      domain: domain,
      metadata: metadata,
    };
    await auditStore.update((current) => {
      current.version = 1;
      current.entries = Array.isArray(current.entries) ? current.entries : [];
      current.entries.unshift(entry);
      current.entries = current.entries.slice(0, 1e3);
      return entry;
    });
    return entry;
  }
  const reeltrackBaseUrl = "https://reeltrack.vynodehub.com";
  async function reeltrackRequest(path, apiKey) {
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 1e4);
    try {
      const response = await (options.fetcher || globalThis.fetch)(
        `${reeltrackBaseUrl}${path}`,
        {
          headers: { "X-API-Key": apiKey, Accept: "application/json" },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        if (response.status === 401 || response.status === 403)
          throw new Error("Reeltrack rejected this API key.");
        throw new Error(
          `Reeltrack could not complete this request (${response.status}).`,
        );
      }
      const payload = await response.json();
      return payload?.data ?? payload;
    } catch (error) {
      if (error?.name === "AbortError")
        throw new Error("Reeltrack took too long to respond.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  const reeltrackArray = (value) =>
    Array.isArray(value)
      ? value
      : Array.isArray(value?.items)
        ? value.items
        : Array.isArray(value?.lists)
          ? value.lists
          : [];
  async function reeltrackAvailableLists(apiKey) {
    return reeltrackArray(await reeltrackRequest("/api/v1/lists", apiKey));
  }
  async function reeltrackListItems(apiKey, listId) {
    return reeltrackArray(
      await reeltrackRequest(
        `/api/v1/lists/${encodeURIComponent(listId)}/items?limit=500`,
        apiKey,
      ),
    );
  }
  async function reeltrackSnapshotForUser(userId) {
    const stored = await reeltrackListStore.read();
    return (
      stored.users?.[userId] || {
        importedLists: [],
        updatedAt: null,
      }
    );
  }
  async function saveReeltrackSnapshot(userId, snapshot) {
    await reeltrackListStore.update((current) => {
      current.version = 1;
      current.users = current.users || {};
      current.users[userId] = snapshot;
      return snapshot;
    });
  }
  const reeltrackItemDomain = (item) => {
    const type = String(
      item?.domain || item?.type || item?.mediaType || item?.media_type || "",
    )
      .trim()
      .toLowerCase();
    return ["tv", "series", "show", "television", "episode"].includes(type)
      ? "tv"
      : "movie";
  };
  async function matchedReeltrackLists(session, lists) {
    const [movies, television] = await Promise.all([
        sync.list("movie"),
        sync.list("tv"),
      ]),
      identity = new Map();
    for (const [domain, items] of [
      ["movie", movies],
      ["tv", television],
    ])
      for (const item of items) {
        if (item.tmdbId)
          identity.set(`${domain}:tmdb:${String(item.tmdbId)}`, item);
        if (domain === "tv" && item.tvdbId)
          identity.set(`${domain}:tvdb:${String(item.tvdbId)}`, item);
        if (item.imdbId)
          identity.set(
            `${domain}:imdb:${String(item.imdbId).toLowerCase()}`,
            item,
          );
      }
    return lists.map((list) => ({
      ...list,
      items: (list.items || []).map((sourceItem) => {
        const domain = reeltrackItemDomain(sourceItem),
          source = String(sourceItem.source || "").toLowerCase(),
          externalId = String(
            sourceItem.externalId ||
              (source === "tvdb" ? sourceItem.tvdbId : "") ||
              (source === "imdb" ? sourceItem.imdbId : ""),
          ).trim(),
          explicitTmdbId = Number(sourceItem.tmdbId) || null,
          match =
            (explicitTmdbId
              ? identity.get(`${domain}:tmdb:${explicitTmdbId}`)
              : null) ||
            (source && source !== "tmdb" && externalId
              ? identity.get(
                  `${domain}:${source}:${source === "imdb" ? externalId.toLowerCase() : externalId}`,
                )
              : null),
          canView =
            session.user.role === "administrator" ||
            session.user.permissions?.[domain === "movie" ? "movies" : "tv"] ===
              true,
          tmdbId = explicitTmdbId;
        return {
          ...sourceItem,
          domain,
          source,
          externalId,
          tmdbId: Number.isInteger(tmdbId) && tmdbId > 0 ? tmdbId : null,
          library: match
            ? {
                id: match.id,
                title: match.title,
                status:
                  domain === "movie"
                    ? match.hasFile || Number(match.sizeOnDisk || 0) > 0
                      ? "available"
                      : "pending"
                    : Number.parseInt(match.episodeProgress || "0", 10) > 0 ||
                        Number(match.sizeOnDisk || 0) > 0
                      ? "available"
                      : "pending",
                canView,
              }
            : null,
          canRequest: !match && Number.isInteger(tmdbId) && tmdbId > 0,
          requestBlockReason:
            match || (Number.isInteger(tmdbId) && tmdbId > 0)
              ? null
              : "Reeltrack did not provide a TMDB ID, so VynodeArr will not guess from the title.",
        };
      }),
    }));
  }
  const reeltrackAutomationRuns = new Map();
  const reeltrackItemIdentity = (item) => {
    const domain = reeltrackItemDomain(item),
      tmdbId = Number(item?.tmdbId) ||
        (String(item?.source || "").toLowerCase() === "tmdb"
          ? Number(item?.externalId)
          : 0);
    return { domain, tmdbId: Number.isInteger(tmdbId) && tmdbId > 0 ? tmdbId : null };
  };
  const plexPathValue = (value) =>
    String(value || "").replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
  const relativeLibraryPath = (value, root) => {
    const path = plexPathValue(value), prefix = plexPathValue(root);
    if (!path || !prefix || (path !== prefix && !path.startsWith(`${prefix}/`))) return "";
    return path.slice(prefix.length).replace(/^\/+/, "");
  };
  const plexLibraryLocation = (library, items = []) => {
    const reported = String(library?.locations?.[0] || "").trim().replaceAll("\\", "/").replace(/\/+$/, ""),
      directories = (items || [])
        .flatMap((item) => item?.files || [])
        .map((file) => String(file || "").replaceAll("\\", "/").replace(/\/+$/, ""))
        .filter(Boolean)
        .map((file) => file.slice(0, file.lastIndexOf("/")))
        .filter(Boolean);
    if (!reported || directories.length < 2) return reported;
    const first = directories[0].split("/"),
      compared = directories.map((path) => path.toLowerCase().split("/"));
    let length = first.length;
    for (let index = 1; index < compared.length; index += 1) {
      length = Math.min(length, compared[index].length);
      while (length > 0 && compared[index].slice(0, length).join("/") !== compared[0].slice(0, length).join("/")) length -= 1;
    }
    const shared = first.slice(0, length).join("/") || "/",
      reportedValue = plexPathValue(reported),
      sharedValue = plexPathValue(shared);
    return sharedValue && reportedValue.startsWith(`${sharedValue}/`) ? shared : reported;
  };
  const localLibraryRoot = (domain) => domain === "tv"
    ? env.VYNODEARR_TV_LIBRARY_PATH || "/tv"
    : env.VYNODEARR_TRAILER_DIR || env.VYNODEARR_MOVIE_LIBRARY_PATH || "/movies";
  const mappedHostRoot = (domain, value) => {
    const requested = resolve(String(value || localLibraryRoot(domain))), configured = resolve(localLibraryRoot(domain)), shared = resolve("/media"), allowed = [configured, shared].some((root) => requested === root || requested.startsWith(`${root}${sep}`));
    if (!allowed) throw new Error(`The mapped ${domain === "tv" ? "television" : "movie"} host folder is outside VynodeArr's configured library roots.`);
    return requested;
  };
  const mappedLibraryRoot = (domain, automation = {}) => {
    return mappedHostRoot(domain, domain === "tv" ? automation.tvHostRoot : automation.movieHostRoot);
  };
  const plexMovieRootValue = (value) => {
    const path = String(value || "").trim();
    return !path || plexPathValue(path) === "/trailers" ? "/movies" : path;
  };
  async function mediaDestinationContext(domain, administrator = true, engineInstanceId = null) {
    const domainInstances = engineSettings.public().instances.filter((item) => item.domain === domain && item.enabled !== false),
      includeLegacy = !engineInstanceId || !domainInstances.length || domainInstances.some((item) => item.id === engineInstanceId && item.isDefault);
    const [rawRoots, profiles, plexSettings] = await Promise.all([
      management.execute(domain, "rootFolders", "GET", {engineInstanceId}).catch(() => []),
      management.execute(domain, "profiles", "GET", {engineInstanceId}).catch(() => []),
      plexSettingsStore.read().catch(() => ({ libraries: [] })),
    ]), instance = engineInstanceId ? domainInstances.find((item) => item.id === engineInstanceId) : null,
      storage = instance ? await instanceStorage(instance.id).catch(() => []) : [],
      roots = (Array.isArray(rawRoots) ? rawRoots : rawRoots?.records || []).map((root) => {
        const mapped = storage.find((item) => normalizeMediaPath(item.enginePath) === normalizeMediaPath(root.path));
        return mapped ? { ...root, accessible: mapped.accessible, vynodePath: mapped.vynodePath, storageStatus: mapped.status, restartRequired: mapped.restartRequired } : root;
      });
    const destinations = await mediaDestinations.context(domain, {
      roots,
      profiles,
      plexLibraries: plexSettings.libraries || [],
      administrator,
      engineInstanceId,
      includeLegacy,
    });
    return { destinations, roots, profiles, plexLibraries: plexSettings.libraries || [] };
  }
  const enabledEngineInstances = (domain) => {
    const instances = engineSettings.public().instances.filter((item) => item.domain === domain && item.enabled !== false);
    return instances.length ? instances : [{ id: null, name: domain === "tv" ? "Television" : "Movies", isDefault: true }];
  };
  async function allMediaDestinationContexts(domain, administrator = true) {
    return Promise.all(enabledEngineInstances(domain).map(async (instance) => ({
      instance,
      context: await mediaDestinationContext(domain, administrator, instance.id),
    })));
  }
  async function applyMediaDestination(domain, payload, administrator = true) {
    const destinationId = String(payload?.mediaDestinationId || "");
    if (!destinationId) return payload;
    const engineInstanceId=String(payload?.engineInstanceId||'').trim()||null,context = await mediaDestinationContext(domain, administrator,engineInstanceId),
      destination = context.destinations.find((item) => item.id === destinationId);
    if (!destination) throw new Error("Choose an available media destination");
    if (!destination.ready)
      throw new Error(destination.restartRequired
        ? "This destination needs container access. Update the Unraid path mapping, restart the container, and verify it again."
        : "This destination is not ready. Review its root folder and quality profile.");
    return mediaDestinations.apply(payload, destination);
  }
  async function addReeltrackItemsToLibraries(providerItems, preferredRoots = {}, preferredDestinationIds = {}) {
    const summary = { added: 0, existing: 0, failed: 0, errors: [] };
    for (const domain of ["movie", "tv"]) {
      const candidates = (providerItems || [])
        .map((item) => ({ item, identity: reeltrackItemIdentity(item) }))
        .filter(({ identity }) => identity.domain === domain && identity.tmdbId);
      if (!candidates.length) continue;
      let records, profiles, roots, destinationContext;
      const requestedDestinationId = String(preferredDestinationIds[domain] || ""),
        destinationState = await mediaDestinations.state(),
        storedDestination = destinationState.destinations.find((item) => item.id === requestedDestinationId),
        engineInstanceId = storedDestination?.engineInstanceId || enabledEngineInstances(domain).find((item) => item.isDefault)?.id || null;
      try {
        [records, profiles, roots, destinationContext] = await Promise.all([
          management.execute(domain, "library", "GET", { engineInstanceId }),
          management.execute(domain, "profiles", "GET", { engineInstanceId }),
          management.execute(domain, "rootFolders", "GET", { engineInstanceId }),
          mediaDestinationContext(domain, true, engineInstanceId),
        ]);
      } catch (error) {
        summary.failed += candidates.length;
        summary.errors.push(
          `${domain === "movie" ? "Movies" : "Television"}: ${error?.message || "engine settings are unavailable"}`,
        );
        continue;
      }
      const known = Array.isArray(records) ? records : records?.records || [],
        selectedDestination = destinationContext.destinations.find((item) => item.id === requestedDestinationId && item.ready),
        defaultDestination = selectedDestination || destinationContext.destinations.find((item) => item.isDefault && item.ready) || destinationContext.destinations.find((item) => item.ready),
        profile = (Array.isArray(profiles) ? profiles : []).find((item) => defaultDestination && Number(item.id) === Number(defaultDestination.qualityProfileId)) || (Array.isArray(profiles) ? profiles : [])[0],
        preferredPath = selectedDestination ? "" : plexPathValue(preferredRoots[domain]),
        availableRoots = Array.isArray(roots) ? roots : [],
        root = (!preferredPath && defaultDestination ? availableRoots.find((item) => plexPathValue(item.path) === plexPathValue(defaultDestination.rootFolderPath)) : null) || availableRoots
          .filter((candidate) => {
            const rootPath = plexPathValue(candidate?.path);
            return !preferredPath || preferredPath === rootPath || preferredPath.startsWith(`${rootPath}/`);
          })
          .sort((left, right) => plexPathValue(right.path).length - plexPathValue(left.path).length)[0]
          || availableRoots[0];
      if (requestedDestinationId && !selectedDestination) {
        summary.failed += candidates.length;
        summary.errors.push(`${domain === "movie" ? "Movies" : "Television"}: choose an available media destination`);
        continue;
      }
      let domainAdded = 0;
      if (!profile || !root?.path) {
        summary.failed += candidates.length;
        summary.errors.push(
          preferredPath
            ? `${domain === "movie" ? "Movies" : "Television"}: add ${preferredRoots[domain]} as an engine root folder before synchronizing this Plex library`
            : `${domain === "movie" ? "Movies" : "Television"}: configure a root folder and quality profile first`,
        );
        continue;
      }
      for (const { item, identity } of candidates) {
        try {
          if (
            known.some(
              (record) => Number(record.tmdbId) === Number(identity.tmdbId),
            )
          ) {
            summary.existing += 1;
            continue;
          }
          const metadata = await discovery.details(domain, identity.tmdbId),
            engineIdentity = {
              tmdbId: identity.tmdbId,
              tvdbId: metadata?.tvdbId || null,
              imdbId: metadata?.imdbId || null,
            },
            duplicate = known.find(
              (record) =>
                (domain === "tv" &&
                  engineIdentity.tvdbId &&
                  Number(record.tvdbId) === Number(engineIdentity.tvdbId)) ||
                (engineIdentity.imdbId &&
                  String(record.imdbId || "").toLowerCase() ===
                    String(engineIdentity.imdbId).toLowerCase()),
            );
          if (duplicate) {
            summary.existing += 1;
            continue;
          }
          let match;
          for (const term of lookupTermsForIdentity(domain, engineIdentity)) {
            const matches = await management.execute(domain, "lookup", "GET", {
              query: { term },
              engineInstanceId,
            });
            match = exactEngineMatch(
              domain,
              engineIdentity,
              Array.isArray(matches) ? matches : [],
            );
            if (match) break;
          }
          if (!match) throw new Error("the media engine could not resolve its external ID");
          const payload = {
            ...match,
            mediaDestinationId: !preferredPath ? defaultDestination?.id : undefined,
            rootFolderPath: root.path,
            qualityProfileId: Number(profile.id),
            monitored: true,
            ...(domain === "movie"
              ? {
                  minimumAvailability:
                    match.minimumAvailability === "tba"
                      ? "announced"
                      : match.minimumAvailability || "announced",
                  addOptions: { searchForMovie: false },
                }
              : {
                  seasonFolder: true,
                  addOptions: {
                    monitor: "all",
                    searchForMissingEpisodes: false,
                    searchForCutoffUnmetEpisodes: false,
                  },
                }),
          };
           const destinationPayload = !preferredPath && defaultDestination ? mediaDestinations.apply(payload, defaultDestination) : payload,
             added = await management.execute(domain, "library", "POST", {
             payload: domain === "tv" ? televisionAddPayload(destinationPayload) : destinationPayload,
             engineInstanceId,
           });
          known.push(added || destinationPayload);
          summary.added += 1;
          domainAdded += 1;
        } catch (error) {
          summary.failed += 1;
          if (summary.errors.length < 10)
            summary.errors.push(
              `${item.title || `${domain} ${identity.tmdbId}`}: ${error?.message || "could not be added"}`,
            );
        }
      }
      if (domainAdded) {
        sync.invalidate(domain);
        const refreshTimer = setTimeout(
          () => sync.synchronize(domain).catch(() => {}),
          1e4,
        );
        refreshTimer.unref?.();
      }
    }
    return summary;
  }
  const reeltrackPosterTemplate = (value, domain = "all") => {
    if (!value || typeof value !== "object") return null;
    const template = sanitizeOverlayTemplate({
      ...value,
      id: value.id || `overlay_${randomUUID()}`,
      name: value.name || "Reeltrack collection artwork",
      domain,
      target: "plex",
      enabled: value.enabled !== false,
    });
    const canvas = value.canvas || {}, color = (input, fallback) => /^#[0-9a-f]{6}$/i.test(String(input || "")) ? String(input).toLowerCase() : fallback;
    template.canvas = {
      backgroundType: ["solid", "linear", "radial"].includes(canvas.backgroundType) ? canvas.backgroundType : "linear",
      colorA: color(canvas.colorA, "#08111f"),
      colorB: color(canvas.colorB, "#243b65"),
      angle: Math.max(0, Math.min(360, Number(canvas.angle) || 135)),
      backgroundAsset: /^[a-f0-9-]{36}\.(?:jpe?g|png|webp)$/i.test(String(canvas.backgroundAsset || "")) ? String(canvas.backgroundAsset) : "",
      quadPosters: (Array.isArray(canvas.quadPosters) ? canvas.quadPosters : [])
        .map((item) => ({
          domain: item?.domain === "tv" ? "tv" : "movie",
          tmdbId: Number(item?.tmdbId),
          title: String(item?.title || "").slice(0, 160),
        }))
        .filter((item) => Number.isInteger(item.tmdbId) && item.tmdbId > 0)
        .slice(0, 4),
    };
    return template;
  };
  const reeltrackPosterItem = ({ list, domain, count, syncedAt, title }) => ({
    title: title || list.name,
    collection: title || list.name,
    collectionName: title || list.name,
    collectionTitleCount: count,
    collectionMediaType: domain === "tv" ? "Television" : domain === "movie" ? "Movies" : "Movies & Television",
    collectionLastSync: syncedAt || new Date().toISOString(),
  });
  async function remotePosterBuffer(domain, tmdbId) {
    if (!Number.isInteger(Number(tmdbId)) || Number(tmdbId) < 1) return null;
    const metadata = await discovery.details(domain === "tv" ? "tv" : "movie", Number(tmdbId)).catch(() => null);
    if (!metadata?.poster) return null;
    const response = await fetch(metadata.poster, { signal: AbortSignal.timeout(10000) }).catch(() => null);
    if (!response?.ok || !String(response.headers.get("content-type") || "").startsWith("image/")) return null;
    const body = Buffer.from(await response.arrayBuffer());
    return body.length && body.length <= 20_000_000 ? body : null;
  }
  async function renderedReeltrackArtwork(template, item, poster = null) {
    const sharp = (await import("sharp")).default,
      overlay = renderOverlaySvg({
        poster: Buffer.alloc(0),
        template,
        item,
        includePoster: false,
      }),
      canvas = template.canvas || {}, uploaded = !poster?.length && canvas.backgroundAsset
        ? await readFile(join(reeltrackPosterBackgroundDir, canvas.backgroundAsset)).catch(() => null)
        : null,
      gradient = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><defs>${canvas.backgroundType === "radial" ? `<radialGradient id="g"><stop stop-color="${canvas.colorA || "#08111f"}"/><stop offset="1" stop-color="${canvas.colorB || "#243b65"}"/></radialGradient>` : `<linearGradient id="g" gradientTransform="rotate(${canvas.angle || 135} .5 .5)"><stop stop-color="${canvas.colorA || "#08111f"}"/><stop offset="1" stop-color="${canvas.backgroundType === "solid" ? canvas.colorA || "#08111f" : canvas.colorB || "#243b65"}"/></linearGradient>`}</defs><rect width="600" height="900" fill="url(#g)"/></svg>`,
      base = poster?.length
        ? sharp(poster).rotate().resize(600, 900, { fit: "cover", position: "centre" })
        : uploaded?.length
          ? sharp(uploaded).rotate().resize(600, 900, { fit: "cover", position: "centre" })
          : sharp(Buffer.from(gradient)),
      quadPosters = await Promise.all((canvas.quadPosters || []).map(async (entry) => {
        const body = await remotePosterBuffer(entry.domain, entry.tmdbId);
        return body ? sharp(body).rotate().resize(180, 270, { fit: "cover", position: "centre" }).jpeg().toBuffer() : null;
      })),
      quadInputs = quadPosters.filter(Boolean).map((input, index) => ({
        input,
        left: 108 + (index % 2) * 204,
        top: 320 + Math.floor(index / 2) * 282,
      }));
    return base
      .composite([...quadInputs, { input: overlay, top: 0, left: 0 }])
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toBuffer();
  }
  async function reeltrackOriginalArtwork({ automation, endpoint, token, machineIdentifier, libraryKey, ratingKey, artworkPath, domain, kind }) {
    automation.artworkOriginals ||= {};
    const normalizedLibraryKey = String(libraryKey || ""),
      key = `${machineIdentifier}:${normalizedLibraryKey}:${domain}:${kind}:${ratingKey}`,
      previousKey = `${machineIdentifier}:${domain}:${kind}:${ratingKey}`,
      legacyKey = `${machineIdentifier}:${ratingKey}`,
      legacy = automation.artworkOriginals[legacyKey],
      previous = automation.artworkOriginals[previousKey],
      compatiblePrevious = previous?.machineIdentifier === machineIdentifier && previous?.domain === domain && previous?.kind === kind && (!previous.libraryKey || String(previous.libraryKey) === normalizedLibraryKey) ? previous : null,
      compatibleLegacy = legacy?.machineIdentifier === machineIdentifier && legacy?.domain === domain && legacy?.kind === kind && (!legacy.libraryKey || String(legacy.libraryKey) === normalizedLibraryKey) ? legacy : null,
      existing = automation.artworkOriginals[key] || compatiblePrevious || compatibleLegacy;
    if (existing?.backupFile && /^[a-f0-9-]{36}\.poster$/i.test(existing.backupFile)) {
      const body = await readFile(join(reeltrackArtworkBackupDir, existing.backupFile)).catch(() => null);
      if (body?.length && createHash("sha256").update(body).digest("hex") === existing.sha256) {
        automation.artworkOriginals[key] = existing;
        if (compatiblePrevious === existing) delete automation.artworkOriginals[previousKey];
        if (legacy === existing) delete automation.artworkOriginals[legacyKey];
        return { body, contentType: existing.contentType, key, captured: false, synthetic: Boolean(existing.synthetic) };
      }
      delete automation.artworkOriginals[key];
      if (compatiblePrevious === existing) delete automation.artworkOriginals[previousKey];
      if (legacy === existing) delete automation.artworkOriginals[legacyKey];
    }
    const synthetic = typeof plexService.artwork !== "function",
      current = !synthetic
        ? await plexService.artwork(endpoint, token, artworkPath || `/library/metadata/${ratingKey}/thumb`)
        : { body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#08111f"/></svg>'), contentType: "image/svg+xml" },
      original = await originalPlexPoster({ server: { machineIdentifier } }, normalizedLibraryKey, ratingKey, current),
      backupFile = `${randomUUID()}.poster`;
    await mkdir(reeltrackArtworkBackupDir, { recursive: true });
    await writeFile(join(reeltrackArtworkBackupDir, backupFile), original.body, { mode: 384, flag: "wx" });
    automation.artworkOriginals[key] = { backupFile, contentType: original.contentType, sha256: createHash("sha256").update(original.body).digest("hex"), machineIdentifier, libraryKey: normalizedLibraryKey, ratingKey: String(ratingKey), domain, kind, synthetic, capturedAt: new Date().toISOString() };
    return { ...original, key, captured: true };
  }
  async function restoreReeltrackArtwork({ automation, endpoint, token, machineIdentifier, libraryKey = null, domain, kind, exceptRatingKeys = [] }) {
    const restored = [];
    const retained = new Set(exceptRatingKeys.map(String)),
      records = Object.values(automation.artworkOriginals || {}).filter((item, index, all) => !item.synthetic && item.machineIdentifier === machineIdentifier && item.domain === domain && item.kind === kind && (libraryKey === null || !item.libraryKey || String(item.libraryKey) === String(libraryKey)) && !retained.has(String(item.ratingKey)) && all.indexOf(item) === index);
    for (const record of records) {
      if (!/^[a-f0-9-]{36}\.poster$/i.test(String(record.backupFile || ""))) continue;
      const body = await readFile(join(reeltrackArtworkBackupDir, record.backupFile)).catch(() => null);
      if (!body?.length || createHash("sha256").update(body).digest("hex") !== record.sha256) continue;
      await plexService.uploadPoster(endpoint, token, record.ratingKey, body, record.contentType).then(() => restored.push(record.ratingKey)).catch(() => {});
    }
    return restored;
  }
  async function applyReeltrackTitleArtwork({ template, endpoint, token, machineIdentifier, libraryKey, automation, items, ratingKeys, list, domain, syncedAt }) {
    if (!template?.enabled || !template.layers?.length) return { applied: 0, failed: 0, errors: [] };
    let applied = 0, failed = 0;
    const errors = [];
    for (const plexItem of items.filter((item) => ratingKeys.includes(String(item.ratingKey)))) {
      try {
        const identity = plexExternalIds(plexItem).find((value) => value.startsWith("tmdb:")),
          pathTmdbId = (plexItem.files || []).map((file) => String(file).match(/\[tmdb-(\d+)\]/i)?.[1]).find(Boolean),
          tmdbId = Number(identity?.split(":")[1] || pathTmdbId || 0),
          source = (list.items || []).find((value) => String(value.tmdbId || "") === String(tmdbId || "")) || {},
          metadata = tmdbId ? await discovery.details(domain, tmdbId).catch(() => null) : null,
          original = await reeltrackOriginalArtwork({ automation, endpoint, token, machineIdentifier, libraryKey, ratingKey: plexItem.ratingKey, artworkPath: plexItem.thumb, domain, kind: "title" }).catch(() => null),
          poster = original?.body || await remotePosterBuffer(domain, tmdbId);
        if (!poster?.length) throw new Error("No Plex or provider poster was available");
        const
          rendered = await renderedReeltrackArtwork(template, {
            ...(metadata || {}),
            ...source,
            ...plexItem,
            genres: source.genres?.length ? source.genres : metadata?.genres || plexItem.genres || [],
            rating: source.rating || metadata?.rating || plexItem.rating || null,
            runtimeMinutes: source.runtimeMinutes || source.runtime || metadata?.runtimeMinutes || metadata?.runtime || null,
            certification: source.certification || metadata?.certification || plexItem.certification || "",
            studio: source.studio || metadata?.studio || plexItem.studio || "",
            network: source.network || metadata?.network || plexItem.network || "",
            collection: list.automation?.collectionName || list.name,
            collectionName: list.automation?.collectionName || list.name,
            collectionTitleCount: ratingKeys.length,
            collectionMediaType: domain === "tv" ? "Television" : "Movies",
            collectionLastSync: syncedAt,
          }, poster);
        let uploadError = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await plexService.uploadPoster(endpoint, token, plexItem.ratingKey, rendered, "image/jpeg");
            uploadError = null;
            break;
          } catch (error) {
            uploadError = error;
            if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          }
        }
        if (uploadError) throw uploadError;
        applied += 1;
      } catch (error) {
        failed += 1;
        if (errors.length < 10) errors.push(`${plexItem.title || `Plex item ${plexItem.ratingKey}`}: ${error?.message || "overlay failed"}`);
      }
    }
    return { applied, failed, errors };
  }
  async function runReeltrackPlexAutomation(userId, listId, { refreshProvider = true } = {}) {
    const runKey = `${userId}:${listId}`;
    if (reeltrackAutomationRuns.has(runKey)) return reeltrackAutomationRuns.get(runKey);
    const task = (async () => {
      const runStartedAt = new Date().toISOString();
      let [apiKey, current, plexSettings, plexToken] = await Promise.all([
        engineSettings.reeltrackCredential(userId),
        reeltrackSnapshotForUser(userId),
        plexSettingsStore.read(),
        engineSettings.plexCredential(),
      ]);
      const index = (current.importedLists || []).findIndex(
        (item) => String(item.id) === String(listId),
      );
      if (index < 0) throw new Error("The imported Reeltrack list no longer exists.");
      const original = current.importedLists[index],
        automation = { ...(original.automation || {}) };
      if (!automation.enabled) throw new Error("Plex automation is not enabled for this list.");
      if (!apiKey) throw new Error("Reconnect Reeltrack before running this automation.");
      if (!plexSettings.endpoint || !plexToken)
        throw new Error("Connect Plex before running this automation.");
      const remoteProviderList = refreshProvider
          ? (await reeltrackAvailableLists(apiKey)).find((item) => String(item.id) === String(listId))
          : original,
        providerList = remoteProviderList || original,
        providerItems = refreshProvider && remoteProviderList
          ? await reeltrackListItems(apiKey, listId)
          : refreshProvider ? [] : original.items || [],
        list = { ...original, ...providerList, items: providerItems },
        requiredDomains = new Set([
          ...providerItems.map(reeltrackItemIdentity).filter((item) => item.tmdbId).map((item) => item.domain),
          ...Object.values(automation.jobs || {}).map((job) => job?.domain === "tv" ? "tv" : "movie"),
        ]);
      if ((plexSettings.libraries || []).some((item) => !item.locations?.length)) {
        const inspection = await plexService.inspect(plexSettings.endpoint, plexToken);
        plexSettings = { version: 1, ...inspection, updatedAt: new Date().toISOString() };
        await plexSettingsStore.write(plexSettings);
      }
      const libraries = plexSettings.libraries || [],
        legacyLibrary = libraries.find((item) => String(item.key) === String(automation.plexLibraryKey)),
        selectedKeys = {
          movie: automation.plexMovieLibraryKey || (legacyLibrary?.type === "movie" ? legacyLibrary.key : ""),
          tv: automation.plexTvLibraryKey || (legacyLibrary?.type === "show" ? legacyLibrary.key : ""),
        },
        placeholderKeys = {
          movie: automation.splitLibraryMode ? automation.plexMoviePlaceholderLibraryKey : "",
          tv: automation.splitLibraryMode ? automation.plexTvPlaceholderLibraryKey : "",
        },
        targets = await Promise.all([...requiredDomains].map(async (domain) => {
          const expectedType = domain === "tv" ? "show" : "movie",
            realLibrary = libraries.find((item) => String(item.key) === String(selectedKeys[domain]) && item.type === expectedType),
            placeholderLibrary = placeholderKeys[domain]
              ? libraries.find((item) => String(item.key) === String(placeholderKeys[domain]) && item.type === expectedType)
              : realLibrary;
          if (!realLibrary) throw new Error(`Choose a Plex ${domain === "tv" ? "television" : "movie"} library for this list.`);
          if (!placeholderLibrary) throw new Error(`Choose a Plex placeholder ${domain === "tv" ? "television" : "movie"} library for this list.`);
          if (automation.splitLibraryMode && String(realLibrary.key) === String(placeholderLibrary.key)) throw new Error("The real-media and placeholder Plex libraries must be different in split-library mode.");
          if (!String(realLibrary.locations?.[0] || "").trim() || !String(placeholderLibrary.locations?.[0] || "").trim()) throw new Error(`The selected Plex ${domain === "tv" ? "television" : "movie"} libraries do not report media locations. Reconnect Plex and try again.`);
          const [realPlexItems, placeholderPlexItems] = await Promise.all([
              plexService.libraryItems(plexSettings.endpoint, plexToken, realLibrary),
              String(realLibrary.key) === String(placeholderLibrary.key) ? Promise.resolve(null) : plexService.libraryItems(plexSettings.endpoint, plexToken, placeholderLibrary),
            ]),
            realLibraryLocation = plexLibraryLocation(realLibrary, realPlexItems),
            placeholderLibraryLocation = plexLibraryLocation(placeholderLibrary, placeholderPlexItems || realPlexItems),
            realLocalRoot = mappedLibraryRoot(domain, automation),
            placeholderLocalRoot = automation.splitLibraryMode
              ? resolve(String(domain === "tv" ? automation.tvPlaceholderHostRoot : automation.moviePlaceholderHostRoot))
              : realLocalRoot;
          if (automation.splitLibraryMode) mappedHostRoot(domain, placeholderLocalRoot);
          return { domain, library: placeholderLibrary, libraryLocation: placeholderLibraryLocation, localRoot: placeholderLocalRoot, plexItems: placeholderPlexItems || realPlexItems, realLibrary, realLibraryLocation, realLocalRoot, realPlexItems };
        }));
      const libraryAdds = await addReeltrackItemsToLibraries(
          providerItems,
          Object.fromEntries(targets.map((target) => [target.domain, target.localRoot])),
          { movie: automation.movieMediaDestinationId, tv: automation.tvMediaDestinationId },
        ),
        jobs = { ...(automation.jobs || {}) },
        totals = { managedTitles: 0, placeholders: 0, downloaded: 0, removed: 0, realMatches: 0, collectionPosters: 0, titlePosters: 0 },
        collectionRatingKeys = { ...(automation.collectionRatingKeys || {}) },
        plexLibraryLocations = {};
      for (const { domain, library, libraryLocation, localRoot, plexItems, realLibrary, realLibraryLocation, realLocalRoot, realPlexItems } of targets) {
        plexLibraryLocations[domain] = libraryLocation;
        const trailerPrefix = plexPathValue(libraryLocation),
        localTrailerPrefix = plexPathValue(localRoot),
        managedPlexPaths = new Set(
          Object.values(jobs)
            .filter((job) => (job?.domain === "tv" ? "tv" : "movie") === domain)
            .map((job) => plexPathValue(job?.path))
            .filter(Boolean)
            .map((path) =>
              path === localTrailerPrefix || path.startsWith(`${localTrailerPrefix}/`)
                ? `${trailerPrefix}${path.slice(localTrailerPrefix.length)}`
                : path,
            ),
        ),
        isManagedPlaceholder = (item, paths = managedPlexPaths) => {
          const files = item.files || [];
          if (!files.length) return false;
          const managedTmdbIds = new Set(
              Object.values(jobs)
                .filter((job) => job?.path && (job?.domain === "tv" ? "tv" : "movie") === domain && Number(job.tmdbId) > 0)
                .map((job) => Number(job.tmdbId)),
            ),
            exactPathMatch = files.every((file) => paths.has(plexPathValue(file))),
            relativePathMatch = files.every((file) => {
              const relative = relativeLibraryPath(file, libraryLocation);
              return relative && [...paths].some((path) => relativeLibraryPath(path, libraryLocation) === relative);
            }),
            itemTmdbIds = new Set([
              ...plexExternalIds(item).filter((identity) => identity.startsWith("tmdb:")).map((identity) => Number(identity.slice(5))),
              ...files.map((file) => Number(String(file).match(/\[tmdb-(\d+)\]/i)?.[1])).filter((value) => value > 0),
            ]);
          return exactPathMatch || relativePathMatch || (files.every((file) => /(?:^|[\\/])(?:trailer|[^\\/]*-trailer)\.[a-z0-9]+$/i.test(String(file))) && [...itemTmdbIds].some((id) => managedTmdbIds.has(id)));
        },
        placeholders = plexItems.filter((item) =>
          (item.files || []).length > 0 &&
          isManagedPlaceholder(item),
        ),
        realItems = automation.splitLibraryMode ? realPlexItems : plexItems.filter((item) => !placeholders.includes(item)),
        realIds = new Set(
          realItems.flatMap((item) =>
            plexExternalIds(item).map((identity) => `${domain}:${identity}`),
          ),
        ),
        realFileIds = new Set(
          realItems
            .filter((item) => (item.files || []).some((file) => !/(?:^|[\\/])(?:trailer|[^\\/]*-trailer)\.[a-z0-9]+$/i.test(String(file))))
            .flatMap((item) => plexExternalIds(item).map((identity) => `${domain}:${identity}`)),
        ),
        wanted = new Map();
      for (const item of providerItems) {
        const identity = reeltrackItemIdentity(item);
        if (identity.domain === domain && identity.tmdbId)
          wanted.set(`${domain}:tmdb:${identity.tmdbId}`, { ...item, ...identity });
      }
      let removed = 0,
        downloaded = 0;
      if (typeof trailerDownloader.exists === "function")
        for (const [key, job] of Object.entries(jobs))
          if (
            job?.path &&
            (job?.domain === "tv" ? "tv" : "movie") === domain &&
            !(await trailerDownloader.exists(job))
          ) {
            delete jobs[key];
            removed += 1;
          }
      for (const [key, job] of Object.entries(jobs)) {
        if ((job?.domain === "tv" ? "tv" : "movie") !== domain || !realIds.has(key) || job?.state === "extra" || typeof trailerDownloader.promote !== "function") continue;
        const realItem = realItems.find((item) => plexExternalIds(item).some((identity) => `${domain}:${identity}` === key)),
          realFile = (realItem?.files || []).find((file) => !/(?:^|[\\/])(?:trailer|[^\\/]*-trailer)\.[a-z0-9]+$/i.test(String(file)));
        if (!realFile) continue;
        try {
          jobs[key] = await trailerDownloader.promote(job, { realFile, libraryRoot: realLibraryLocation, localRoot: realLocalRoot });
        } catch (error) {
          jobs[key] = { ...job, promotionError: error?.message || "Trailer could not be converted to a Plex extra.", promotionFailedAt: new Date().toISOString() };
        }
      }
      for (const [key, item] of wanted) {
        if (jobs[key]?.folder) continue;
        try {
          const metadata = await discovery.details(domain, item.tmdbId);
          if (!metadata?.trailer?.url) throw new Error("TMDB does not list a YouTube trailer.");
          jobs[key] = await trailerDownloader.download({
            url: metadata.trailer.url,
            title: metadata.title || item.title,
            year: metadata.year || item.year,
            domain,
            tmdbId: item.tmdbId,
            root: localRoot,
          });
          if (realIds.has(key) && typeof trailerDownloader.promote === "function") {
            const realItem = realItems.find((value) => plexExternalIds(value).some((identity) => `${domain}:${identity}` === key)),
              realFile = (realItem?.files || []).find((file) => !/(?:^|[\\/])(?:trailer|[^\\/]*-trailer)\.[a-z0-9]+$/i.test(String(file)));
            if (realFile) jobs[key] = await trailerDownloader.promote(jobs[key], { realFile, libraryRoot: realLibraryLocation, localRoot: realLocalRoot });
          }
          downloaded += 1;
        } catch (error) {
          jobs[key] = {
            tmdbId: item.tmdbId,
            domain,
            title: item.title,
            error: error?.message || "Trailer download failed.",
            failedAt: new Date().toISOString(),
          };
        }
      }
      const managedDomainDownloads = Object.values(jobs).filter(
        (job) => job?.path && job?.state !== "extra" && (job?.domain === "tv" ? "tv" : "movie") === domain,
      ).length;
      if (downloaded || removed || managedDomainDownloads)
        await plexService.refreshLibrary(
          plexSettings.endpoint,
          plexToken,
          library.key,
        );
      if (automation.splitLibraryMode && (downloaded || Object.values(jobs).some((job) => job?.state === "extra")))
        await plexService.refreshLibrary(plexSettings.endpoint, plexToken, realLibrary.key);
      const currentManagedPlexPaths = () =>
          new Set(
            Object.values(jobs)
              .filter((job) => (job?.domain === "tv" ? "tv" : "movie") === domain)
              .map((job) => plexPathValue(job?.path))
              .filter(Boolean)
              .map((path) =>
                path === localTrailerPrefix || path.startsWith(`${localTrailerPrefix}/`)
                  ? `${trailerPrefix}${path.slice(localTrailerPrefix.length)}`
                  : path,
              ),
          );
      let refreshedItems = plexItems;
      if (downloaded || removed || managedDomainDownloads) {
        for (let scanAttempt = 0; scanAttempt < 11; scanAttempt += 1) {
          refreshedItems = await plexService.libraryItems(
            plexSettings.endpoint,
            plexToken,
            library,
          );
          const expectedManagedDownloads = Object.values(jobs).filter((job) => job?.path && job?.state !== "extra" && (job?.domain === "tv" ? "tv" : "movie") === domain).length;
          if (refreshedItems.filter((item) => isManagedPlaceholder(item, currentManagedPlexPaths())).length >= expectedManagedDownloads || scanAttempt === 10)
            break;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
      const refreshedManagedPaths = currentManagedPlexPaths(),
        refreshedPlaceholders = refreshedItems.filter((item) =>
          (item.files || []).length > 0 && isManagedPlaceholder(item, refreshedManagedPaths),
        ),
        placeholderKeys = refreshedPlaceholders
          .filter((item) => {
            const identities = plexExternalIds(item).map(
                (identity) => `${domain}:${identity}`,
              ),
              pathIdentities = (item.files || [])
                .map((file) => String(file).match(/\[tmdb-(\d+)\]/i)?.[1])
                .filter(Boolean)
                .map((id) => `${domain}:tmdb:${id}`),
              candidates = [...identities, ...pathIdentities];
            return candidates.some(
              (identity) => wanted.has(identity) && !realIds.has(identity),
            );
          })
          .map((item) => item.ratingKey),
        retainedPlaceholderOverlayKeys = refreshedPlaceholders
          .filter((item) => {
            const identities = [
              ...plexExternalIds(item).map((identity) => `${domain}:${identity}`),
              ...(item.files || [])
                .map((file) => String(file).match(/\[tmdb-(\d+)\]/i)?.[1])
                .filter(Boolean)
                .map((id) => `${domain}:tmdb:${id}`),
            ];
            return identities.some((identity) => Boolean(jobs[identity]?.path) && !realFileIds.has(identity));
          })
          .map((item) => item.ratingKey),
        expectedPlaceholderCount = [...wanted.keys()].filter(
          (key) => !realIds.has(key) && Boolean(jobs[key]?.path),
        ).length;
      const placeholderWarning = placeholderKeys.length < expectedPlaceholderCount
          ? `Plex indexed ${placeholderKeys.length} of ${expectedPlaceholderCount} managed ${domain === "tv" ? "television" : "movie"} trailers in ${library.title}. Verify that ${libraryLocation} and ${localRoot} point to the same host folder.`
          : null,
        refreshedRealItems = automation.splitLibraryMode
          ? await plexService.libraryItems(plexSettings.endpoint, plexToken, realLibrary)
          : refreshedItems.filter((item) => !refreshedPlaceholders.includes(item)),
        realRatingKeys = refreshedRealItems.filter((item) =>
          plexExternalIds(item).some((identity) => wanted.has(`${domain}:${identity}`)),
        ).map((item) => item.ratingKey),
        collectionMemberKeys = [...new Set([...realRatingKeys, ...placeholderKeys])],
        splitCollections = automation.splitLibraryMode && String(library.key) !== String(realLibrary.key);
      await restoreReeltrackArtwork({ automation, endpoint: plexSettings.endpoint, token: plexToken, machineIdentifier: plexSettings.server?.machineIdentifier || "", libraryKey: library.key, domain, kind: "title", exceptRatingKeys: splitCollections ? retainedPlaceholderOverlayKeys : [...new Set([...collectionMemberKeys, ...retainedPlaceholderOverlayKeys])] });
      if (splitCollections)
        await restoreReeltrackArtwork({ automation, endpoint: plexSettings.endpoint, token: plexToken, machineIdentifier: plexSettings.server?.machineIdentifier || "", libraryKey: realLibrary.key, domain, kind: "title", exceptRatingKeys: realRatingKeys });
      const collection = await plexService.syncCollection(
          plexSettings.endpoint,
          plexToken,
          {
            libraryKey: library.key,
            libraryType: library.type,
            machineIdentifier: plexSettings.server?.machineIdentifier,
            title: automation.collectionName || list.name,
            ratingKeys: splitCollections ? placeholderKeys : collectionMemberKeys,
          },
        );
        const realCollection = splitCollections ? await plexService.syncCollection(
          plexSettings.endpoint, plexToken, {
            libraryKey: realLibrary.key, libraryType: realLibrary.type,
            machineIdentifier: plexSettings.server?.machineIdentifier,
            title: automation.collectionName || list.name, ratingKeys: realRatingKeys,
          },
        ) : collection;
        collectionRatingKeys[domain] = splitCollections ? { placeholder: collection.ratingKey, real: realCollection.ratingKey } : collection.ratingKey;
        const collectionTemplate = reeltrackPosterTemplate(automation.collectionPosterTemplate, domain),
          titleTemplate = reeltrackPosterTemplate(automation.titleOverlayTemplate, domain),
          realTitleTemplate = reeltrackPosterTemplate(automation.realTitleOverlayTemplate, domain) || titleTemplate;
        if (collection.ratingKey && collectionTemplate?.enabled && collectionTemplate.layers?.length) {
          try {
            // Render the configured collection design after membership is reconciled. Existing
            // regular collections retain their rating key. Capture Plex's current generated or
            // selected artwork before replacing it so Restore original is a real rollback.
            await reeltrackOriginalArtwork({
              automation, endpoint: plexSettings.endpoint, token: plexToken,
              machineIdentifier: plexSettings.server?.machineIdentifier || "",
              libraryKey: library.key, ratingKey: collection.ratingKey,
              artworkPath: `/library/metadata/${collection.ratingKey}/thumb`, domain, kind: "collection",
            });
            const rendered = await renderedReeltrackArtwork(
              collectionTemplate,
              reeltrackPosterItem({
                list,
                domain,
                count: collectionMemberKeys.length,
                syncedAt: runStartedAt,
                title: automation.collectionName || list.name,
              }),
            );
            await plexService.uploadPoster(plexSettings.endpoint, plexToken, collection.ratingKey, rendered, "image/jpeg");
            totals.collectionPosters += 1;
            if (splitCollections && realCollection.ratingKey) {
              await reeltrackOriginalArtwork({
                automation, endpoint: plexSettings.endpoint, token: plexToken,
                machineIdentifier: plexSettings.server?.machineIdentifier || "",
                libraryKey: realLibrary.key, ratingKey: realCollection.ratingKey,
                artworkPath: `/library/metadata/${realCollection.ratingKey}/thumb`, domain, kind: "collection",
              });
              await plexService.uploadPoster(plexSettings.endpoint, plexToken, realCollection.ratingKey, rendered, "image/jpeg");
              totals.collectionPosters += 1;
            }
          } catch (error) {
            totals.collectionPosterFailures = (totals.collectionPosterFailures || 0) + 1;
            totals.collectionPosterErrors = [...(totals.collectionPosterErrors || []), error?.message || "collection poster failed"].slice(0, 10);
          }
        }
        const placeholderArtwork = await applyReeltrackTitleArtwork({
          template: titleTemplate,
          endpoint: plexSettings.endpoint,
          token: plexToken,
          machineIdentifier: plexSettings.server?.machineIdentifier || "",
          libraryKey: library.key,
          automation,
          items: refreshedItems,
          ratingKeys: placeholderKeys,
          list,
          domain,
          syncedAt: runStartedAt,
        });
        const realArtwork = await applyReeltrackTitleArtwork({
          template: realTitleTemplate, endpoint: plexSettings.endpoint, token: plexToken,
          machineIdentifier: plexSettings.server?.machineIdentifier || "", automation,
          libraryKey: realLibrary.key,
          items: refreshedRealItems, ratingKeys: realRatingKeys, list, domain, syncedAt: runStartedAt,
        });
        totals.titlePosters += placeholderArtwork.applied + realArtwork.applied;
        totals.titlePosterFailures = (totals.titlePosterFailures || 0) + placeholderArtwork.failed + realArtwork.failed;
        totals.titlePosterErrors = [...(totals.titlePosterErrors || []), ...placeholderArtwork.errors, ...realArtwork.errors].slice(0, 10);
        if (placeholderArtwork.applied || realArtwork.applied)
          await plexService.refreshLibrary(plexSettings.endpoint, plexToken, library.key);
        if (splitCollections && realArtwork.applied)
          await plexService.refreshLibrary(plexSettings.endpoint, plexToken, realLibrary.key);
        totals.managedTitles += wanted.size;
        totals.placeholders += placeholderKeys.length;
        totals.downloaded += downloaded;
        totals.removed += removed;
        totals.realMatches += [...wanted.keys()].filter((key) => realIds.has(key)).length;
        if (placeholderWarning) totals.placeholderErrors = [...(totals.placeholderErrors || []), placeholderWarning].slice(0, 10);
      }
      const now = new Date(),
        intervalMinutes = Math.max(15, Math.min(1440, Number(automation.intervalMinutes) || 60));
      list.automation = {
        ...automation,
        enabled: Boolean(remoteProviderList),
        plexMovieLibraryKey: String(selectedKeys.movie || ""),
        plexTvLibraryKey: String(selectedKeys.tv || ""),
        plexMoviePlaceholderLibraryKey: String(placeholderKeys.movie || ""),
        plexTvPlaceholderLibraryKey: String(placeholderKeys.tv || ""),
        plexLibraryLocations,
        jobs,
        intervalMinutes,
        collectionRatingKeys,
        lastRunAt: now.toISOString(),
        nextRunAt: new Date(now.getTime() + intervalMinutes * 6e4).toISOString(),
        status: remoteProviderList ? "ready" : "disabled",
        error: remoteProviderList ? null : "The source list was removed from Reeltrack. Automatic management was disabled; Plex media, trailers, and collections were left unchanged.",
        summary: {
          providerTitles: providerItems.length,
          managedTitles: totals.managedTitles,
          placeholders: totals.placeholders,
          placeholderErrors: totals.placeholderErrors || [],
          downloaded: totals.downloaded,
          removed: totals.removed,
          failed: Object.values(jobs).filter((job) => job?.error).length,
          realMatches: totals.realMatches,
          libraryAdded: libraryAdds.added,
          libraryExisting: libraryAdds.existing,
          libraryFailed: libraryAdds.failed,
          collectionPosters: totals.collectionPosters,
          collectionPosterFailures: totals.collectionPosterFailures || 0,
          collectionPosterErrors: totals.collectionPosterErrors || [],
          titlePosters: totals.titlePosters,
          titlePosterFailures: totals.titlePosterFailures || 0,
          titlePosterErrors: totals.titlePosterErrors || [],
        },
        libraryErrors: libraryAdds.errors,
      };
      const latest = await reeltrackSnapshotForUser(userId),
        latestIndex = (latest.importedLists || []).findIndex(
          (item) => String(item.id) === String(listId),
        );
      if (latestIndex >= 0) {
        latest.importedLists[latestIndex] = list;
        latest.updatedAt = now.toISOString();
        await saveReeltrackSnapshot(userId, latest);
      }
      return list;
    })().catch(async (error) => {
      const current = await reeltrackSnapshotForUser(userId),
        index = (current.importedLists || []).findIndex(
          (item) => String(item.id) === String(listId),
        );
      if (index >= 0 && current.importedLists[index].automation?.enabled) {
        current.importedLists[index].automation = {
          ...current.importedLists[index].automation,
          status: "error",
          error: error?.message || "Automation failed.",
          lastRunAt: new Date().toISOString(),
          nextRunAt: new Date(Date.now() + 15 * 6e4).toISOString(),
        };
        await saveReeltrackSnapshot(userId, current);
      }
      throw error;
    });
    let run;
    run = (async () => {
      try {
        return await task;
      } finally {
        if (reeltrackAutomationRuns.get(runKey) === run)
          reeltrackAutomationRuns.delete(runKey);
      }
    })();
    reeltrackAutomationRuns.set(runKey, run);
    return run;
  }
  async function runDueReeltrackAutomations() {
    const stored = await reeltrackListStore.read(),
      due = [];
    for (const [userId, snapshot] of Object.entries(stored.users || {}))
      for (const list of snapshot.importedLists || [])
        if (
          list.automation?.enabled &&
          (!list.automation.nextRunAt || Date.parse(list.automation.nextRunAt) <= Date.now())
        )
          due.push(runReeltrackPlexAutomation(userId, list.id).catch(() => {}));
    await Promise.allSettled(due);
  }
  const operationTime = (value) =>
    String(
      value?.timestamp ||
        value?.updatedAt ||
        value?.createdAt ||
        value?.observedAt ||
        value?.requestedAt ||
        value?.date ||
        new Date().toISOString(),
    );
  const operationDomain = (value) =>
    ["movie", "tv"].includes(value?.domain) ? value.domain : null;
  const operationTitle = (value, fallback = "System activity") =>
    String(value?.title || value?.target || value?.name || fallback);
  async function operationsTimeline() {
    const [
        activity,
        decisions,
        audit,
        requests,
        notifications,
        plex,
        queue,
        history,
      ] = await Promise.all([
        searchActivityStore.read().catch(() => ({ activities: [] })),
        downloadDecisionStore.read().catch(() => ({ decisions: [] })),
        auditStore.read().catch(() => ({ entries: [] })),
        requestStore.read().catch(() => ({ requests: [] })),
        notificationStore.read().catch(() => ({ events: [], deliveries: [] })),
        plexPosterApplicationStore.read().catch(() => ({ applications: [] })),
        (mode === "engine"
          ? liveQueue({ maxAgeMs: 3e4 })
          : sync.operations("queue")
        ).catch(
          () => [],
        ),
        sync.operations("history").catch(() => []),
      ]),
      items = [];
    for (const value of activity.activities || [])
      items.push({
        id: `search:${value.id}`,
        source: "search",
        category: "automation",
        domain: operationDomain(value),
        engineInstanceId:value.engineInstanceId||null,
        engineInstanceName:value.engineInstanceName||null,
        title: operationTitle(value, "Media search"),
        summary: value.message || `Search is ${value.status || "recorded"}.`,
        status: value.status || "unknown",
        timestamp: operationTime(value),
        href: "#history",
        actor: value.origin || "VynodeArr",
      });
    for (const value of decisions.decisions || [])
      items.push({
        id: `decision:${value.id}`,
        source: "decision",
        category: "download",
        domain: operationDomain(value),
        engineInstanceId:value.engineInstanceId||null,
        engineInstanceName:value.engineInstanceName||null,
        title: operationTitle(value, "Release decision"),
        summary:
          (value.reasons || [])[0] ||
          `${value.decision || "Decision"} · ${value.quality || "quality unavailable"}`,
        status: value.decision || "recorded",
        timestamp: operationTime(value),
        href: "#history",
        actor: value.origin || "Media engine",
      });
    for (const value of audit.entries || [])
      items.push({
        id: `audit:${value.id}`,
        source: "audit",
        category: value.category || "administration",
        domain: operationDomain(value),
        engineInstanceId:value.engineInstanceId||value.metadata?.engineInstanceId||null,
        engineInstanceName:value.engineInstanceName||null,
        title: operationTitle(value, "Administrator action"),
        summary:
          value.summary || value.action || "Administrator action recorded.",
        status: "completed",
        timestamp: operationTime(value),
        href: "#system",
        actor: value.actorName || value.username || "Administrator",
      });
    for (const value of requests.requests || [])
      items.push({
        id: `request:${value.id}`,
        source: "request",
        category: "request",
        domain: operationDomain(value),
        engineInstanceId:value.engineInstanceId||null,
        engineInstanceName:value.engineInstanceName||null,
        title: operationTitle(value, "Media request"),
        summary: value.message || `Request is ${value.status || "recorded"}.`,
        status: value.status || "unknown",
        timestamp: operationTime(value),
        href: "#request-management",
        actor: value.requestedByName || value.username || "User",
      });
    for (const value of notifications.deliveries || [])
      items.push({
        id: `delivery:${value.id}`,
        source: "notification",
        category: "notification",
        domain: null,
        title: value.title || "External notification",
        summary:
          value.status === "failed"
            ? value.error || "Delivery failed."
            : `Delivered through ${value.channelName || value.type || "an external channel"}.`,
        status: value.status || "recorded",
        timestamp: operationTime(value),
        href: "#system",
        actor: value.channelName || "Notification service",
      });
    for (const value of plex.applications || [])
      items.push({
        id: `plex:${value.id}`,
        source: "plex",
        category: "artwork",
        domain: operationDomain(value),
        title: operationTitle(value, "Plex poster"),
        summary: `Poster overlay ${value.status || "change"}${value.templateName ? ` · ${value.templateName}` : ""}.`,
        status: value.status || "completed",
        timestamp: operationTime(value),
        href: "#service/poster-overlays",
        actor: "Plex artwork",
      });
    for (const value of queue || [])
      items.push({
        id: `queue:${value.domain || "media"}:${value.id}`,
        source: "queue",
        category: "download",
        domain: operationDomain(value),
        engineInstanceId:value.engineInstanceId||null,
        engineInstanceName:value.engineInstanceName||null,
        title: operationTitle(value, "Queued download"),
        summary:
          value.errorMessage ||
          value.statusMessages?.[0]?.messages?.[0] ||
          `Download is ${value.status || value.trackedDownloadStatus || "queued"}.`,
        status: value.status || value.trackedDownloadStatus || "queued",
        timestamp: operationTime(value),
        href: "#queue",
        actor: "Media engine",
      });
    for (const value of history || [])
      items.push({
        id: `history:${value.domain || "media"}:${value.id}`,
        source: "history",
        category: "library",
        domain: operationDomain(value),
        engineInstanceId:value.engineInstanceId||null,
        engineInstanceName:value.engineInstanceName||null,
        title: operationTitle(value, "Library event"),
        summary:
          value.details ||
          value.context ||
          String(value.eventType || "Engine activity recorded."),
        status: value.eventType || "recorded",
        timestamp: operationTime(value),
        href: "#history",
        actor: "Media engine",
      });
    const unique = new Map();
    for (const item of items.sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp),
    ))
      if (!unique.has(item.id)) unique.set(item.id, item);
    return [...unique.values()].slice(0, 2500);
  }
  async function operationsActions() {
    const [timeline, validation, state] = await Promise.all([
        operationsTimeline(),
        systemValidation().catch(() => ({ checks: [] })),
        operationsCenterStore.read(),
      ]),
      actions = [];
    const add = (value) =>
      actions.push({
        ...value,
        dismissedAt: state.dismissed?.[value.id] || null,
      });
    for (const check of validation.checks || [])
      if (check.status !== "healthy")
        add({
          id: `validation:${check.id}`,
          severity: check.status === "failed" ? "critical" : "warning",
          domain: null,
          title: check.title,
          what: check.message,
          why:
            (check.details || [])[0] ||
            "A system validation check did not pass.",
          affected: check.group || "VynodeArr",
          recommended: check.action?.label || "Review the related settings.",
          href: check.action?.href || "#system",
          timestamp: validation.generatedAt || new Date().toISOString(),
          source: "validation",
        });
    for (const item of timeline) {
      const status = String(item.status || "").toLowerCase();
      if (item.source === "notification" && status === "failed")
        add({
          id: `action:${item.id}`,
          severity: "warning",
          domain: null,
          title: `Notification failed: ${item.title}`,
          what: item.summary,
          why: "The external provider did not accept or complete the delivery.",
          affected: item.actor,
          recommended: "Review the channel and retry the failed delivery.",
          href: "#system",
          timestamp: item.timestamp,
          source: item.source,
        });
      else if (
        item.source === "search" &&
        ["failed", "completed"].includes(status)
      )
        add({
          id: `action:${item.id}`,
          severity: status === "failed" ? "critical" : "warning",
          domain: item.domain,
          engineInstanceId:item.engineInstanceId||null,
          engineInstanceName:item.engineInstanceName||null,
          title: item.title,
          what: item.summary,
          why:
            status === "failed"
              ? "The automated search reported a failure."
              : "The search completed without a release entering Queue or History.",
          affected:
            item.domain === "tv" ? "Television library" : "Movie library",
          recommended:
            "Review Search Activity and Download Decisions before searching again.",
          href: "#history",
          timestamp: item.timestamp,
          source: item.source,
        });
      else if (item.source === "queue" && /fail|error|warning/.test(status))
        add({
          id: `action:${item.id}`,
          severity: "critical",
          domain: item.domain,
          engineInstanceId:item.engineInstanceId||null,
          engineInstanceName:item.engineInstanceName||null,
          title: item.title,
          what: item.summary,
          why: "The media engine reports that this queued download needs attention.",
          affected:
            item.domain === "tv" ? "Television download" : "Movie download",
          recommended: "Open Queue to inspect, retry, or remove the download.",
          href: "#queue",
          timestamp: item.timestamp,
          source: item.source,
        });
      else if (item.source === "request" && /pending|awaiting/.test(status))
        add({
          id: `action:${item.id}`,
          severity: "information",
          domain: item.domain,
          engineInstanceId:item.engineInstanceId||null,
          engineInstanceName:item.engineInstanceName||null,
          title: `Approval needed: ${item.title}`,
          what: item.summary,
          why: "This user requires administrator approval before the title can be added.",
          affected: item.actor,
          recommended: "Review and approve or reject the request.",
          href: "#request-management",
          timestamp: item.timestamp,
          source: item.source,
        });
    }
    const unique = new Map();
    for (const item of actions.sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp),
    ))
      if (!unique.has(item.id)) unique.set(item.id, item);
    return [...unique.values()].slice(0, 500);
  }
  const discovery =
    options.discovery ||
    new TmdbDiscoveryService({
      token: env.TMDB_API_READ_TOKEN || env.TMDB_API_KEY,
    });
  const boundedInteger = (value, fallback, min, max) =>
    Math.max(min, Math.min(max, Math.trunc(Number(value) || fallback)));
  const artworkCache = new BoundedCache({
      maxItems: boundedInteger(env.VYNODEARR_ARTWORK_CACHE_ITEMS, 250, 10, 2e3),
      maxBytes: boundedInteger(
        env.VYNODEARR_ARTWORK_CACHE_BYTES,
        128 * 1024 * 1024,
        1024 * 1024,
        1024 * 1024 * 1024,
      ),
      ttlMs: boundedInteger(
        env.VYNODEARR_ARTWORK_CACHE_TTL_MS,
        30 * 60 * 1e3,
        6e4,
        24 * 60 * 60 * 1e3,
      ),
    }),
    artworkRuns = new Map(),
    tvMetadataCache = new BoundedCache({
      maxItems: 100,
      maxBytes: 32 * 1024 * 1024,
      ttlMs: 30 * 60 * 1e3,
    }),
    attentionSnapshots = new Map();
  let mode = baseConfig.dataMode,
    librarySummaryTimer = null;
  const artworkDiskMaxItems = boundedInteger(
      env.VYNODEARR_ARTWORK_DISK_CACHE_ITEMS,
      2e3,
      100,
      1e4,
    ),
    artworkDiskMaxBytes = boundedInteger(
      env.VYNODEARR_ARTWORK_DISK_CACHE_BYTES,
      1024 * 1024 * 1024,
      64 * 1024 * 1024,
      4 * 1024 * 1024 * 1024,
    );
  const artworkFetchLimiter = new AsyncLimiter(
      boundedInteger(env.VYNODEARR_ARTWORK_FETCH_CONCURRENCY, 2, 1, 8),
    ),
    artworkWriteLimiter = new AsyncLimiter(
      boundedInteger(env.VYNODEARR_ARTWORK_WRITE_CONCURRENCY, 1, 1, 4),
    );
  let movie =
    options.movie ||
    (mode === "fixture"
      ? new MovieFixtureAdapter(baseConfig.movie)
      : new MovieEngineAdapter(baseConfig.movie));
  let tv =
    options.tv ||
    (mode === "fixture"
      ? new TvFixtureAdapter(baseConfig.tv)
      : new TvEngineAdapter(baseConfig.tv));
  const registry =
    options.registry ||
    new MediaEngineRegistry().register("movie", movie).register("tv", tv);
  const catalogBacked = typeof projectionStore.queryDomain === "function",
    integrityIntervalMs = boundedInteger(
      env.VYNODEARR_LIBRARY_INTEGRITY_INTERVAL_MS,
      catalogBacked ? 6 * 60 * 60 * 1e3 : baseConfig.pollIntervalMs,
      30 * 60 * 1e3,
      24 * 60 * 60 * 1e3,
    );
  const sync =
    options.sync ||
    new SynchronizationService({
      movie: movie,
      tv: tv,
      maxItems: baseConfig.cacheMaxItems,
      pollIntervalMs: integrityIntervalMs,
      projectionStore: projectionStore,
    });
  const eventProcessor =
    typeof projectionStore.enqueueEvent === "function"
      ? new CatalogEventProcessor({
          store: projectionStore,
          synchronize: sync,
          concurrency: boundedInteger(env.VYNODEARR_EVENT_CONCURRENCY, 2, 1, 4),
          onProcessed: async (event, result) => {
            const item = result?.item;
            if (event.media_id)
              await invalidateArtwork(event.domain, event.media_id);
            const attention =
              typeof projectionStore.attentionSummary === "function"
                ? await projectionStore.attentionSummary(event.domain)
                : null;
            const summary = await librarySummary(event.domain, []);
            broadcastLibraryEvent({
              domain: event.domain,
              items: item ? [item] : [],
              attention: attention,
              summary: summary,
              updatedAt: new Date().toISOString(),
            });
          },
        })
      : null;
  const enginesConfigured = () =>
    mode === "fixture" || engineSettings.configured();
  const bundledEnginesActive = () => engineSettings.mode() === "bundled";
  const management = new EngineManagementService(registry);
  const decodeOwnedMediaId=(domain,id)=>{
    const raw=String(id||''),prefix=domain==='movie'?'movie_':'series_',value=raw.startsWith(prefix)?raw.slice(prefix.length):raw;
    for(const instance of engineSettings.public().instances.filter(item=>item.domain===domain)){for(const separator of ['_',':']){const marker=`${instance.id}${separator}`;if(value.startsWith(marker))return{engineInstanceId:instance.id,id:value.slice(marker.length)};}}
    return{engineInstanceId:null,id:value};
  };
  const importJobs = new Map(),
    searchJobs = new Map(),
    namingAuditJobs = new Map(),
    completedQueueRefreshes = new Map(),
    completedQueueCleanups = new Map(),
    completedUpgradeRenames = new Map(),
    completedLibraryImports = new Map(),
    libraryReconciliations = new Map(),
    libraryEventClients = new Set(),
    interactiveReleaseCache = new Map(),
    renamePlans = new Map(),
    applicationBackupDownloads = new Map();
  const requestMetrics = new Map();
  let initialized = false,
    queueCompletionTimer = null,
    operationalNotificationTimer = null,
    reeltrackAutomationTimer = null,
    liveQueueRun = null,
    liveQueueSnapshot = [],
    liveQueueSnapshotAt = 0,
    operationalEngineSnapshots = new Map();
  const libraryWatchers = [],
    libraryWatchTimers = new Map(),
    libraryWatchLastSync = new Map();
  function importIdentityKeys(value = {}) {
    const keys = [],
      title = String(value.title || value.name || "")
        .trim()
        .toLowerCase(),
      year = Number(value.year || 0);
    for (const field of ["tmdbId", "tvdbId", "imdbId"])
      if (value[field])
        keys.push(`${field}:${String(value[field]).toLowerCase()}`);
    const path = String(value.path || "")
      .replaceAll("\\", "/")
      .replace(/\/+$/, "")
      .toLowerCase();
    if (path) keys.push(`path:${path}`);
    if (!keys.length && title) keys.push(`title:${title}:${year || ""}`);
    return keys;
  }
  function publicImportJob(job) {
    return {
      id: job.id,
      domain: job.domain,
      engineInstanceId: job.engineInstanceId || null,
      engineInstanceName: job.engineInstanceName || null,
      label: job.label,
      status: job.status,
      total: job.total,
      completed: job.completed,
      skipped: job.skipped,
      failed: job.failed,
      currentTitle: job.currentTitle,
      errors: job.errors.slice(-25),
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    };
  }
  function publicSearchJob(job) {
    return {
      id: job.id,
      domain: job.domain,
      label: job.label,
      status: job.status,
      total: job.total,
      completed: job.completed,
      failed: job.failed,
      currentTitle: job.currentTitle,
      errors: job.errors.slice(-25),
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    };
  }
  const automaticCommandNames = new Set([
    "MoviesSearch",
    "SeriesSearch",
    "SeasonSearch",
    "EpisodeSearch",
  ]);
  const searchScope = (input) =>
    input.name === "SeriesSearch"
      ? "series"
      : input.name === "SeasonSearch"
        ? "season"
        : input.name === "EpisodeSearch"
          ? "episode"
          : input.name === "MoviesSearch"
            ? "movie"
            : "library";
  async function createSearchActivity(
    userId,
    input = {},
    result = {},
    extra = {},
  ) {
    const domain = extra.domain || "tv",
      now = new Date().toISOString(),
      activity = {
        id: `activity_${randomUUID()}`,
        userId: userId,
        domain: domain,
        source: extra.source || "automatic",
        scope: extra.scope || searchScope(input),
        title:
          extra.title ||
          input.title ||
          {
            SeriesSearch: "Whole show",
            SeasonSearch: `Season ${input.seasonNumber}`,
            EpisodeSearch: `${Array.isArray(input.episodeIds) && input.episodeIds.length > 1 ? `${input.episodeIds.length} episodes` : "Episode"}`,
            MoviesSearch: `${Array.isArray(input.movieIds) && input.movieIds.length > 1 ? `${input.movieIds.length} movies` : "Movie"}`,
          }[input.name] ||
          "New library item",
        movieId:
          Number(
            extra.movieId ||
              (domain === "movie" &&
                (input.movieIds?.[0] || result.movieId || result.id)),
          ) || null,
        seriesId:
          Number(
            extra.seriesId ||
              input.seriesId ||
              (domain === "tv" && (result.seriesId || result.id)),
          ) || null,
        seasonNumber: Number.isFinite(
          Number(extra.seasonNumber ?? input.seasonNumber),
        )
          ? Number(extra.seasonNumber ?? input.seasonNumber)
          : null,
        episodeIds: (extra.episodeIds || input.episodeIds || [])
          .map(Number)
          .filter(Number.isFinite)
          .slice(0, 500),
        commandId: Number(extra.commandId || result?.id) || null,
        status: extra.status || "queued",
        message: extra.message || "Waiting for the media engine.",
        createdAt: now,
        updatedAt: now,
        finishedAt: null,
        selection: extra.selection || null,
        counts: extra.counts || null,
      };
    await searchActivityStore.update((current) => {
      current.version = 1;
      current.activities = Array.isArray(current.activities)
        ? current.activities
        : [];
      current.activities.unshift(activity);
      current.activities = current.activities.slice(0, 250);
      return activity;
    });
    return activity;
  }
  async function updateSearchActivity(id, changes) {
    let updated = null;
    await searchActivityStore.update((current) => {
      const item = (current.activities || []).find((value) => value.id === id);
      if (item) {
        Object.assign(item, changes, { updatedAt: new Date().toISOString() });
        updated = { ...item };
      }
      return updated;
    });
    return updated;
  }
  async function reconcileSearchActivities(userId, providedSnapshots = null) {
    const stored = await searchActivityStore.read(),
      items = (stored.activities || [])
        .filter((item) => !stored.dismissed?.[item.id])
        .filter((item) => userId == null || item.userId === userId)
        .slice(0, 75),
      active = items.filter(
        (item) =>
          [
            "queued",
            "searching",
            "grabbed",
            "downloading",
            "completed",
          ].includes(item.status) &&
          Date.now() - new Date(item.createdAt).getTime() <
            7 * 24 * 60 * 60 * 1e3,
      ),
      domains = [...new Set(active.map((item) => item.domain))];
    const snapshots =
      providedSnapshots ||
      new Map(
        await Promise.all(
          domains.map(async (domain) => {
            const client = registry.get(domain).client,
              [queueValue, historyValue] = await Promise.all([
                client
                  .get(
                    "queue",
                    domain === "movie"
                      ? { page: 1, pageSize: 500, includeMovie: true }
                      : {
                          page: 1,
                          pageSize: 500,
                          includeSeries: true,
                          includeEpisode: true,
                        },
                  )
                  .catch(() => ({ records: [] })),
                client
                  .get("history", {
                    page: 1,
                    pageSize: 500,
                    sortKey: "date",
                    sortDirection: "descending",
                  })
                  .catch(() => ({ records: [] })),
              ]);
            return [
              domain,
              {
                queue: Array.isArray(queueValue?.records)
                  ? queueValue.records
                  : [],
                history: Array.isArray(historyValue?.records)
                  ? historyValue.records
                  : [],
              },
            ];
          }),
        ),
      );
    const mediaMatches = (activity, value) => {
        if (activity.domain === "movie")
          return (
            Number(value.movieId || value.movie?.id) ===
            Number(activity.movieId)
          );
        const episodeId = Number(value.episodeId || value.episode?.id),
          seriesId = Number(
            value.seriesId || value.series?.id || value.episode?.seriesId,
          );
        return activity.episodeIds?.length
          ? activity.episodeIds.includes(episodeId)
          : activity.seriesId && seriesId === Number(activity.seriesId);
      },
      recent = (activity, value) => {
        const date = new Date(
          value.date || value.timestamp || value.createdAt || 0,
        ).getTime();
        return !date || date >= new Date(activity.createdAt).getTime() - 6e4;
      };
    await Promise.all(
      active.map(async (item) => {
        const snapshot = snapshots.get(item.domain) || {
            queue: [],
            history: [],
          },
          history = snapshot.history.filter(
            (value) => mediaMatches(item, value) && recent(item, value),
          ),
          imported = history.find((value) =>
            /import/.test(String(value.eventType || "").toLowerCase()),
          ),
          failed = history.find((value) =>
            /fail/.test(String(value.eventType || "").toLowerCase()),
          ),
          queued = snapshot.queue.find((value) => mediaMatches(item, value)),
          grabbed = history.find((value) =>
            /grab/.test(String(value.eventType || "").toLowerCase()),
          );
        if (imported)
          return updateSearchActivity(item.id, {
            status: "imported",
            message: "The download finished and was imported into the library.",
            finishedAt: new Date().toISOString(),
          });
        if (failed)
          return updateSearchActivity(item.id, {
            status: "failed",
            message: friendlyRequestFailure(
              failed.eventType || failed.data?.message,
            ),
            finishedAt: new Date().toISOString(),
          });
        if (queued) {
          const status = String(
              queued.status ||
                queued.trackedDownloadStatus ||
                queued.trackedDownloadState ||
                "",
            ).toLowerCase(),
            complete =
              /complete/.test(status) &&
              Number(queued.sizeleft ?? queued.sizeLeft ?? 1) <= 0;
          return updateSearchActivity(item.id, {
            status: "downloading",
            message: complete
              ? "Download completed; waiting for the media engine to import it."
              : "The selected release is downloading through the configured client.",
            finishedAt: null,
          });
        }
        if (grabbed)
          await updateSearchActivity(item.id, {
            status: "grabbed",
            message: "A release was grabbed and sent to the download client.",
            finishedAt: null,
          });
        else if (item.commandId)
          try {
            const command = await management.execute(
                item.domain,
                "commands",
                "GET",
                { id: item.commandId },
              ),
              raw = String(
                command?.status || command?.state || "",
              ).toLowerCase();
            if (/fail|abort/.test(raw))
              await updateSearchActivity(item.id, {
                status: "failed",
                message:
                  command?.message ||
                  "The engine reported that this search failed.",
                finishedAt: new Date().toISOString(),
              });
            else if (/complete/.test(raw))
              await updateSearchActivity(item.id, {
                status: "completed",
                message:
                  "Search completed without a matching download currently in Queue or History.",
                finishedAt: new Date().toISOString(),
              });
            else if (/start|run/.test(raw))
              await updateSearchActivity(item.id, {
                status: "searching",
                message: "The media engine is checking configured indexers.",
              });
          } catch {}
      }),
    );
    const latest = await searchActivityStore.read();
    return (latest.activities || [])
      .filter((item) => userId == null || item.userId === userId)
      .slice(0, 75);
  }
  const duplicateImportError = (message) =>
    /(?:already|existing).*(?:add|exist|configur|use)|(?:path|tmdb|tvdb|title).*(?:already|exist|configur|use)|another (?:movie|series)/i.test(
      String(message || ""),
    );
  const qualityRank = (release) => {
    const name = String(
      release?.quality?.quality?.name ||
        release?.quality?.name ||
        release?.title ||
        "",
    ).toLowerCase();
    const resolution = name.includes("2160")
      ? 4e3
      : name.includes("1080")
        ? 3e3
        : name.includes("720")
          ? 2e3
          : name.includes("480") || name.includes("576")
            ? 1e3
            : 0;
    const source = name.includes("remux")
      ? 900
      : name.includes("bluray") || name.includes("blu-ray")
        ? 800
        : name.includes("webdl") || name.includes("web-dl")
          ? 700
          : name.includes("webrip") || name.includes("web-rip")
            ? 650
            : name.includes("hdtv")
              ? 500
              : name.includes("dvd")
                ? 300
                : 0;
    return Number(release?.qualityWeight || 0) || resolution + source;
  };
  const eligibleRelease = (release) =>
    Boolean(release) &&
    release.rejected !== true &&
    release.approved !== false &&
    release.downloadAllowed !== false &&
    !(release.rejections || []).length;
  const compareReleases = (left, right) =>
    qualityRank(right) - qualityRank(left) ||
    Number(right.customFormatScore || 0) -
      Number(left.customFormatScore || 0) ||
    Number(left.size || Number.MAX_SAFE_INTEGER) -
      Number(right.size || Number.MAX_SAFE_INTEGER);
  const releaseIdentity = (release) =>
    String(
      release.guid ||
        release.downloadUrl ||
        release.infoUrl ||
        release.title ||
        "",
    ).slice(0, 500);
  async function recordDownloadDecisions(
    userId,
    domain,
    query,
    releases,
    { source: source = "interactive", selected: selected = null } = {},
  ) {
    const now = new Date().toISOString(),
      mediaId =
        Number(query.movieId || query.episodeId || query.seriesId) || null,
      rows = (Array.isArray(releases) ? releases : [])
        .slice(0, 250)
        .map((release) => {
          const nativeReasons = (release.rejections || [])
              .map(String)
              .filter(Boolean),
            identity = releaseIdentity(release),
            chosen = selected && identity === selected,
            accepted = chosen || eligibleRelease(release),
            quality =
              release.quality?.quality?.name ||
              release.quality?.name ||
              "Unknown",
            customFormatScore = Number(
              release.customFormatScore ?? release.customFormatScoreOffset ?? 0,
            ),
            preferredWordScore = Number(release.preferredWordScore ?? 0),
            seeders = Number.isFinite(Number(release.seeders))
              ? Number(release.seeders)
              : null,
            ageDays = Number.isFinite(Number(release.age))
              ? Number(release.age)
              : null,
            size = Number(release.size || 0),
            upgradeRejected = nativeReasons.some((reason) =>
              /upgrade|cutoff|not an improvement/i.test(reason),
            );
          return {
            id: `decision_${createHash("sha256").update(`${domain}:${mediaId}:${identity}`).digest("hex").slice(0, 24)}`,
            domain: domain,
            mediaId: mediaId,
            source: source,
            title: String(release.title || "Unknown release").slice(0, 500),
            indexer: String(
              release.indexer || release.indexerName || "Unknown source",
            ).slice(0, 120),
            protocol: String(release.protocol || ""),
            decision: chosen ? "selected" : accepted ? "accepted" : "rejected",
            reasons: chosen
              ? ["Selected as the highest-ranked accepted candidate."]
              : nativeReasons.length
                ? nativeReasons
                : ["Meets the engine’s current release rules."],
            quality: quality,
            customFormatScore: customFormatScore,
            preferredWordScore: preferredWordScore,
            size: size,
            ageDays: ageDays,
            seeders: seeders,
            upgradeEligible: upgradeRejected
              ? false
              : release.isUpgrade === true
                ? true
                : null,
            observedAt: now,
            selectedAt: chosen ? now : null,
          };
        });
    if (!rows.length) return [];
    await downloadDecisionStore.update((current) => {
      current.version = 1;
      current.decisions = Array.isArray(current.decisions)
        ? current.decisions
        : [];
      for (const row of rows) {
        const index = current.decisions.findIndex((item) => item.id === row.id);
        if (index >= 0)
          current.decisions[index] = {
            ...current.decisions[index],
            ...row,
            firstObservedAt:
              current.decisions[index].firstObservedAt ||
              current.decisions[index].observedAt,
          };
        else
          current.decisions.unshift({
            ...row,
            firstObservedAt: row.observedAt,
            userId: userId,
          });
      }
      current.decisions = current.decisions
        .sort((left, right) =>
          String(right.observedAt).localeCompare(String(left.observedAt)),
        )
        .slice(0, 2e3);
      return rows.length;
    });
    return rows;
  }
  const nativeHistoryMediaId = (domain, item) =>
    Number(
      domain === "movie"
        ? item.movieId || item.movie?.id
        : item.seriesId || item.series?.id || item.episode?.seriesId,
    ) || null;
  const nativeHistoryQuality = (item) =>
    String(
      item.quality?.quality?.name ||
        item.quality?.name ||
        item.quality ||
        "Unknown",
    );
  const nativeHistoryScore = (item) =>
    Number(
      item.customFormatScore ??
        item.data?.customFormatScore ??
        item.data?.customFormatScoreOffset,
    ) || 0;
  const nativeHistoryUpgrade = (item) =>
    truthyEngineValue(item?.data?.isUpgrade ?? item?.isUpgrade);
  async function recordEngineDownloadDecisions(userId, domain, history) {
    const values = Array.isArray(history) ? history : [],
      rows = [];
    for (const item of values) {
      const eventType = String(item.eventType || "").toLowerCase();
      if (!/grab/.test(eventType)) continue;
      const mediaId = nativeHistoryMediaId(domain, item),
        timestamp =
          item.date ||
          item.timestamp ||
          item.createdAt ||
          new Date().toISOString(),
        downloadId = String(item.downloadId || item.data?.downloadId || ""),
        incomingQuality = nativeHistoryQuality(item),
        incomingScore = nativeHistoryScore(item),
        sourceTitle = String(
          item.sourceTitle ||
            item.title ||
            `${domain === "movie" ? "Movie" : "Television"} release`,
        ),
        grabTime = new Date(timestamp).getTime();
      const related = values
          .filter((candidate) => {
            const candidateTime = new Date(
                candidate.date || candidate.timestamp || 0,
              ).getTime(),
              candidateDownloadId = String(
                candidate.downloadId || candidate.data?.downloadId || "",
              );
            return (
              candidate !== item &&
              nativeHistoryMediaId(domain, candidate) === mediaId &&
              (!downloadId ||
                !candidateDownloadId ||
                candidateDownloadId === downloadId) &&
              candidateTime >= grabTime &&
              candidateTime - grabTime <= 48 * 60 * 60 * 1e3
            );
          })
          .sort(
            (left, right) =>
              new Date(left.date || left.timestamp || 0).getTime() -
              new Date(right.date || right.timestamp || 0).getTime(),
          ),
        imported = related.find((candidate) =>
          /import/.test(String(candidate.eventType || "").toLowerCase()),
        ),
        deleted = related.find((candidate) =>
          /filedeleted|file deleted|deleted/.test(
            String(candidate.eventType || "").toLowerCase(),
          ),
        ),
        replacementReason = String(
          deleted?.data?.reason || deleted?.reason || "",
        ),
        reportedUpgrade =
          nativeHistoryUpgrade(imported) ||
          nativeHistoryUpgrade(item) ||
          nativeHistoryUpgrade(deleted) ||
          Boolean(
            deleted && /upgrade|replace|quality/i.test(replacementReason),
          ),
        upgrade = imported || reportedUpgrade ? reportedUpgrade : null,
        previousQuality = deleted ? nativeHistoryQuality(deleted) : null,
        previousScore = deleted ? nativeHistoryScore(deleted) : null,
        reasons = [];
      if (
        upgrade &&
        previousQuality &&
        previousQuality === incomingQuality &&
        previousScore !== null &&
        incomingScore > previousScore
      )
        reasons.push(
          `Same-quality upgrade: custom-format score improved from ${previousScore} to ${incomingScore}.`,
        );
      else if (
        upgrade &&
        previousQuality &&
        previousQuality === incomingQuality &&
        previousScore !== null &&
        incomingScore === previousScore
      )
        reasons.push(
          `Same-quality replacement at ${incomingScore} custom-format points. Engine history confirms the replacement but does not retain the candidate-ranking reason.`,
        );
      else if (
        upgrade &&
        previousQuality &&
        previousQuality === incomingQuality
      )
        reasons.push(
          `Same-quality upgrade from ${previousQuality}; the engine reported an upgrade but did not retain the complete prior scoring evidence.`,
        );
      else if (upgrade && previousQuality)
        reasons.push(
          `Quality upgrade from ${previousQuality} to ${incomingQuality}.`,
        );
      else if (upgrade)
        reasons.push(
          "The engine marked this background grab as an upgrade to the existing library file.",
        );
      else if (!imported)
        reasons.push(
          "Grab captured. Waiting for the engine import event to confirm whether this is a new file or an upgrade.",
        );
      else
        reasons.push(
          "The engine imported this as a new file; no replaced-file event was reported for this title.",
        );
      if (replacementReason)
        reasons.push(`Engine replacement reason: ${replacementReason}.`);
      if (/\b(?:proper|repack|rerip)\b/i.test(sourceTitle))
        reasons.push(
          "The release title identifies a corrected Proper/Repack revision.",
        );
      const identity = String(
        item.id ||
          createHash("sha256")
            .update(`${domain}:${mediaId}:${sourceTitle}:${timestamp}`)
            .digest("hex")
            .slice(0, 24),
      );
      rows.push({
        id: `engine_decision_${domain}_${identity}`,
        domain: domain,
        mediaId: mediaId,
        source: "engine",
        title: sourceTitle,
        indexer: String(item.data?.indexer || item.indexer || "Media engine"),
        protocol: String(item.data?.protocol || item.protocol || ""),
        decision: "selected",
        reasons: reasons,
        quality: incomingQuality,
        customFormatScore: incomingScore,
        preferredWordScore: Number(item.data?.preferredWordScore) || 0,
        size: Number(item.data?.size || item.size || 0),
        ageDays: Number.isFinite(Number(item.data?.age))
          ? Number(item.data.age)
          : null,
        seeders: null,
        upgradeEligible: upgrade,
        previousQuality: previousQuality,
        previousCustomFormatScore: previousScore,
        currentQuality: incomingQuality,
        currentCustomFormatScore: incomingScore,
        engineEventType: item.eventType || "grabbed",
        downloadId: downloadId || null,
        observedAt: new Date(timestamp).toISOString(),
        selectedAt: new Date(timestamp).toISOString(),
      });
    }
    if (!rows.length) return [];
    await downloadDecisionStore.update((current) => {
      current.version = 1;
      current.decisions = Array.isArray(current.decisions)
        ? current.decisions
        : [];
      for (const row of rows) {
        const index = current.decisions.findIndex(
          (value) => value.id === row.id,
        );
        if (index >= 0)
          current.decisions[index] = { ...current.decisions[index], ...row };
        else
          current.decisions.unshift({
            ...row,
            userId: userId,
            firstObservedAt: row.observedAt,
          });
      }
      current.decisions = current.decisions
        .sort((left, right) =>
          String(right.observedAt).localeCompare(String(left.observedAt)),
        )
        .slice(0, 2e3);
      return rows.length;
    });
    return rows;
  }
  async function recordEngineSearchActivities(userId, domain, queue, history) {
    const values = Array.isArray(history) ? history : [],
      queued = Array.isArray(queue) ? queue : [],
      rows = [];
    for (const item of values) {
      const eventType = String(item.eventType || "").toLowerCase();
      if (!/grab/.test(eventType)) continue;
      const timestamp =
          item.date ||
          item.timestamp ||
          item.createdAt ||
          new Date().toISOString(),
        mediaId = nativeHistoryMediaId(domain, item),
        episodeId = Number(item.episodeId || item.episode?.id) || null,
        downloadId = String(item.downloadId || item.data?.downloadId || ""),
        sourceTitle = String(
          item.sourceTitle || item.title || "Engine-selected release",
        ),
        mediaTitle = String(
          item.movie?.title ||
            item.series?.title ||
            item.episode?.series?.title ||
            sourceTitle,
        ),
        originEventId = `${domain}:${item.id || createHash("sha256").update(`${mediaId}:${downloadId}:${sourceTitle}:${timestamp}`).digest("hex").slice(0, 24)}`;
      const grabbedAt = new Date(timestamp).getTime(),
        related = values.filter((candidate) => {
          const candidateTime = new Date(
              candidate.date || candidate.timestamp || 0,
            ).getTime(),
            candidateDownloadId = String(
              candidate.downloadId || candidate.data?.downloadId || "",
            );
          return (
            candidate !== item &&
            nativeHistoryMediaId(domain, candidate) === mediaId &&
            (!downloadId ||
              !candidateDownloadId ||
              candidateDownloadId === downloadId) &&
            candidateTime >= grabbedAt &&
            candidateTime - grabbedAt <= 48 * 60 * 60 * 1e3
          );
        }),
        imported = related.find((candidate) =>
          /import/.test(String(candidate.eventType || "").toLowerCase()),
        ),
        failed = related.find((candidate) =>
          /fail/.test(String(candidate.eventType || "").toLowerCase()),
        ),
        queueItem = queued.find(
          (candidate) =>
            downloadId &&
            String(candidate.downloadId || candidate.id || "") === downloadId,
        ),
        status = imported
          ? "imported"
          : failed
            ? "failed"
            : queueItem
              ? "downloading"
              : "grabbed",
        finishedAt =
          imported || failed
            ? new Date(
                imported?.date || failed?.date || timestamp,
              ).toISOString()
            : null;
      rows.push({
        id: `activity_engine_${createHash("sha256").update(originEventId).digest("hex").slice(0, 24)}`,
        userId: userId,
        domain: domain,
        source: "engine",
        scope: domain === "movie" ? "movie" : "episode",
        title: mediaTitle,
        movieId: domain === "movie" ? mediaId : null,
        seriesId: domain === "tv" ? mediaId : null,
        seasonNumber: Number.isFinite(Number(item.episode?.seasonNumber))
          ? Number(item.episode.seasonNumber)
          : null,
        episodeIds: episodeId ? [episodeId] : [],
        commandId: null,
        status: status,
        message: imported
          ? "The engine-selected download finished and was imported into the library."
          : failed
            ? friendlyRequestFailure(failed.eventType || failed.data?.message)
            : queueItem
              ? "The engine-selected release is downloading through the configured client."
              : "The engine selected this release during background RSS or scheduled automation.",
        createdAt: new Date(timestamp).toISOString(),
        updatedAt: new Date(
          imported?.date || failed?.date || timestamp,
        ).toISOString(),
        finishedAt: finishedAt,
        selection: {
          title: sourceTitle,
          quality: nativeHistoryQuality(item),
          size: Number(item.data?.size || item.size || 0),
        },
        counts: null,
        originEventId: originEventId,
      });
    }
    if (!rows.length) return [];
    await searchActivityStore.update((current) => {
      current.version = 1;
      current.activities = Array.isArray(current.activities)
        ? current.activities
        : [];
      for (const row of rows) {
        const index = current.activities.findIndex(
          (value) =>
            value.originEventId === row.originEventId || value.id === row.id,
        );
        if (index >= 0)
          current.activities[index] = { ...current.activities[index], ...row };
        else current.activities.unshift(row);
      }
      current.activities = current.activities
        .sort((left, right) =>
          String(right.createdAt).localeCompare(String(left.createdAt)),
        )
        .slice(0, 250);
      return rows.length;
    });
    return rows;
  }
  const releaseCacheTtlMs = 45e3;
  const releaseCacheKey = (domain, query) =>
    `${domain}:${Object.entries(query || {})
      .filter(
        ([key, value]) =>
          key !== "force" && value !== undefined && value !== "",
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("&")}`;
  const clearReleaseCache = (domain) => {
    for (const key of interactiveReleaseCache.keys())
      if (!domain || key.startsWith(`${domain}:`))
        interactiveReleaseCache.delete(key);
  };
  async function cachedInteractiveReleases(domain, query, loader) {
    const key = releaseCacheKey(domain, query),
      now = Date.now(),
      cached = interactiveReleaseCache.get(key),
      force = String(query?.force || "") === "true";
    if (!force && cached && cached.expiresAt > now) return cached.promise;
    for (const [cacheKey, value] of interactiveReleaseCache)
      if (value.expiresAt <= now) interactiveReleaseCache.delete(cacheKey);
    const promise = Promise.resolve()
      .then(loader)
      .then((result) => (Array.isArray(result) ? result : []))
      .catch((error) => {
        interactiveReleaseCache.delete(key);
        throw error;
      });
    interactiveReleaseCache.set(key, {
      expiresAt: now + releaseCacheTtlMs,
      promise: promise,
    });
    while (interactiveReleaseCache.size > 250)
      interactiveReleaseCache.delete(
        interactiveReleaseCache.keys().next().value,
      );
    return promise;
  }
  async function televisionSeriesReleases(seriesId, seasonNumber) {
    const episodes = await management.execute("tv", "episodes", "GET", {
      query: { seriesId: Number(seriesId), includeEpisodeFile: true },
    });
    const candidates = (Array.isArray(episodes) ? episodes : [])
      .filter(
        (episode) =>
          seasonNumber === undefined ||
          seasonNumber === "" ||
          Number(episode.seasonNumber) === Number(seasonNumber),
      )
      .filter((episode) => episode.monitored !== false)
      .sort(
        (left, right) =>
          Number(Boolean(left.hasFile)) - Number(Boolean(right.hasFile)) ||
          new Date(right.airDateUtc || right.airDate || 0) -
            new Date(left.airDateUtc || left.airDate || 0),
      );
    const releases = [],
      seen = new Set(),
      batchSize = 8,
      limit = Math.min(candidates.length, 40);
    for (let offset = 0; offset < limit; offset += batchSize) {
      const episodeBatch = candidates.slice(offset, offset + batchSize);
      const batch = await Promise.all(
        episodeBatch.map((episode) => {
          const query = { episodeId: Number(episode.id) };
          return cachedInteractiveReleases("tv", query, () =>
            management.execute("tv", "releases", "GET", { query: query }),
          ).catch(() => []);
        }),
      );
      for (let batchIndex = 0; batchIndex < batch.length; batchIndex++)
        for (const rawRelease of Array.isArray(batch[batchIndex])
          ? batch[batchIndex]
          : []) {
          const release = {
            ...rawRelease,
            episodeId: Number(
              rawRelease.episodeId || episodeBatch[batchIndex].id,
            ),
          };
          const key = String(
            release.guid || release.downloadUrl || release.title || "",
          );
          if (!key || seen.has(key)) continue;
          seen.add(key);
          releases.push(release);
        }
      if (releases.length >= 100) break;
    }
    return releases.sort(compareReleases).slice(0, 200);
  }
  async function reacquireRelease(domain, release,engineInstanceId=null) {
    const movieId = Number(release?.mappedMovieId || release?.movieId);
    const mappedEpisode = Array.isArray(release?.mappedEpisodeInfo)
      ? release.mappedEpisodeInfo[0]
      : null;
    const episodeId = Number(
      release?.episodeId || release?.mappedEpisodeId || mappedEpisode?.id,
    );
    const identity = domain === "movie" ? movieId : episodeId;
    const guid = String(release?.guid || ""),
      indexerId = Number(release?.indexerId);
    if (!Number.isFinite(identity) || !guid || !Number.isFinite(indexerId)) {
      throw new Error(
        `This release is missing its ${domain === "movie" ? "movie" : "television episode"} or indexer identity. Search again before grabbing it.`,
      );
    }
    const current = await management.execute(domain, "releases", "GET", {
      query:
        domain === "movie" ? { movieId: movieId } : { episodeId: episodeId },
      engineInstanceId,
    });
    const match = (Array.isArray(current) ? current : []).find(
      (item) =>
        Number(item.indexerId) === indexerId &&
        String(item.guid || "") === guid,
    );
    if (!match)
      throw new Error(
        "This release is no longer available from the search source. Search again and choose another result.",
      );
    return match;
  }
  const queueRecords = (value) =>
    Array.isArray(value) ? value : Array.isArray(value?.records) ? value.records : [];
  const queueMediaId = (domain, item) =>
    Number(
      domain === "movie"
        ? item.movieId || item.movie?.id
        : item.episodeId || item.episode?.id,
    );
  const queueFailureText = (item) =>
    [
      item.status,
      item.trackedDownloadStatus,
      item.trackedDownloadState,
      ...(Array.isArray(item.statusMessages)
        ? item.statusMessages.flatMap((entry) => entry?.messages || [])
        : []),
    ]
      .filter(Boolean)
      .join(" ");
  async function grabReleaseWithImportGuard(domain, release, mediaId,engineInstanceId=null) {
    const result = await management.execute(domain, "releases", "POST", {
      payload: await reacquireRelease(domain, release,engineInstanceId),engineInstanceId,
    });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 250));
      const queueValue = await management
          .execute(domain, "queue", "GET", {
            query: { page: 1, pageSize: 100, includeUnknownMovieItems: true, includeUnknownSeriesItems: true },
            engineInstanceId,
          })
          .catch(() => []),
        item = queueRecords(queueValue).find(
          (entry) => queueMediaId(domain, entry) === Number(mediaId),
        );
      if (!item) continue;
      const failure = queueFailureText(item),
        terminalZeroFileFailure =
          Number(item.size || 0) === 0 &&
          /completed|complete/i.test(String(item.status || item.trackedDownloadStatus || "")) &&
          /no files found are eligible for import|no files.*eligible|import.*failed/i.test(failure);
      if (!terminalZeroFileFailure) return result;
      if (item.id != null)
        await management.execute(domain, "queue", "DELETE", {
          id: String(item.id),
          query: { removeFromClient: "true", blocklist: "true" },
          payload: {},
          engineInstanceId,
        });
      clearReleaseCache(domain);
      throw new Error(
        "The download client produced an immediate zero-file import failure. The failed release was removed and blocklisted so another release can be searched.",
      );
    }
    return result;
  }
  async function explainEmptyTelevisionSearch(query, result) {
    if (!query.episodeId || !Array.isArray(result) || result.length)
      return result;
    const indexers = await management
      .execute("tv", "indexers", "GET")
      .catch(() => []);
    const enabled = (Array.isArray(indexers) ? indexers : []).filter(
      (indexer) =>
        (indexer.enable ?? true) && indexer.enableInteractiveSearch !== false,
    );
    if (!enabled.length)
      throw new Error(
        "No television indexer is enabled for interactive search. Open Service Settings, choose Television, and configure an indexer.",
      );
    return result;
  }
  async function rematchMedia(input) {
    const domain = String(input.domain || ""),
      engineInstanceId = String(input.engineInstanceId || "").trim() || null,
      mediaId = Number(input.mediaId),
      tmdbId = Number(input.tmdbId),
      imdbId = String(input.imdbId || "").trim().toLowerCase(),
      hasTmdbId = Number.isInteger(tmdbId) && tmdbId > 0,
      hasImdbId = /^tt\d+$/.test(imdbId);
    const execute = (resource, method, options = {}) =>
      management.execute(domain, resource, method, {
        ...options,
        engineInstanceId: engineInstanceId,
      });
    if (
      !["movie", "tv"].includes(domain) ||
      !Number.isFinite(mediaId) ||
      (!hasTmdbId && !hasImdbId)
    )
      throw new Error("Choose a valid TMDB or IMDb match");
    if (hasTmdbId && !discovery.configured())
      throw new Error(
        "Add a TMDB key in Service Settings before fixing library matches.",
      );
    const current = await execute("library", "GET", { id: mediaId });
    let metadata = null;
    let match;
    if (hasImdbId && !hasTmdbId) {
      const matches = await execute("lookup", "GET", {
        query: { term: `imdb:${imdbId}` },
      });
      match = (Array.isArray(matches) ? matches : []).find(
        (value) => String(value.imdbId || "").toLowerCase() === imdbId,
      );
      metadata = match;
    } else {
      metadata = await discovery.details(domain, tmdbId);
      const identity = { tmdbId: tmdbId, tvdbId: metadata.tvdbId };
      for (const term of lookupTermsForIdentity(domain, identity)) {
        const matches = await execute("lookup", "GET", { query: { term: term } });
        match = exactEngineMatch(domain, identity, Array.isArray(matches) ? matches : []);
        if (match) break;
      }
    }
    if (!match)
      throw new Error(
        `The ${domain === "movie" ? "movie" : "television"} engine could not resolve that external ID. Try another match.`,
      );
    const library = await execute("library", "GET"),
      records = Array.isArray(library) ? library : library?.records || [],
      duplicate = records.find(
        (value) =>
          Number(value.id) !== mediaId &&
          ((hasTmdbId && Number(value.tmdbId) === tmdbId) ||
            (hasImdbId && String(value.imdbId || "").toLowerCase() === imdbId) ||
            (metadata.tvdbId &&
              Number(value.tvdbId) === Number(metadata.tvdbId))),
      );
    if (duplicate)
      throw new Error(
        `Cannot use ${match.title} because ${duplicate.title || "that title"} is already in the ${domain === "movie" ? "Movies" : "Television"} library.`,
      );
    const currentPath = String(current.path || "").replace(/[\\/]+$/, ""),
      rootFolderPath =
        current.rootFolderPath || currentPath.replace(/[\\/][^\\/]+$/, "");
    const replacement = {
      ...match,
      path: current.path,
      rootFolderPath: rootFolderPath,
      qualityProfileId: current.qualityProfileId,
      monitored: current.monitored,
      tags: current.tags || [],
      ...(domain === "movie"
        ? {
            minimumAvailability: current.minimumAvailability,
            addOptions: { searchForMovie: false },
          }
        : {
            seriesType: current.seriesType,
            seasonFolder: current.seasonFolder,
            addOptions: {
              monitor: current.monitored ? "all" : "none",
              searchForMissingEpisodes: false,
              searchForCutoffUnmetEpisodes: false,
            },
          }),
    };
    const rollback = { ...current };
    for (const key of ["id", "movieFile", "statistics", "sizeOnDisk", "added"])
      delete rollback[key];
    await execute("library", "DELETE", {
      id: mediaId,
      query:
        domain === "movie"
          ? { deleteFiles: false, addImportExclusion: false }
          : { deleteFiles: false, addImportListExclusion: false },
    });
    let result;
    try {
      result = await execute("library", "POST", {
        payload: replacement,
      });
      const folderResult = await execute(
          "libraryFolder",
          "GET",
          { id: Number(result.id) },
        ),
        correctedFolder = String(folderResult?.folder || "").trim(),
        correctedPath = correctedFolder
          ? joinMediaPath(rootFolderPath, correctedFolder)
          : "";
      if (
        correctedPath &&
        normalizeMediaPath(correctedPath) !== normalizeMediaPath(result.path)
      )
        result = await execute("library", "PUT", {
          id: Number(result.id),
          query: { moveFiles: true },
          payload: {
            ...result,
            path: correctedPath,
            rootFolderPath: rootFolderPath,
          },
        });
    } catch (error) {
      if (Number.isFinite(Number(result?.id)))
        await execute("library", "DELETE", {
            id: Number(result.id),
            query:
              domain === "movie"
                ? { deleteFiles: false, addImportExclusion: false }
                : { deleteFiles: false, addImportListExclusion: false },
          })
          .catch(() => {});
      await execute("library", "POST", { payload: rollback })
        .catch(() => {});
      throw new Error(
        `The engine could not apply the new match. The original match was restored when possible. ${error.message}`,
      );
    }
    await execute("commands", "POST", {
        payload: {
          name: domain === "movie" ? "RefreshMovie" : "RefreshSeries",
          ...(domain === "movie"
            ? { movieIds: [Number(result.id)] }
            : { seriesId: Number(result.id) }),
        },
      })
      .catch(() => {});
    const ownerPrefix = engineInstanceId ? `${engineInstanceId}_` : "",
      oldPublicId = `${domain === "movie" ? "movie" : "series"}_${ownerPrefix}${mediaId}`,
      newPublicId = `${domain === "movie" ? "movie" : "series"}_${ownerPrefix}${Number(result.id)}`;
    if (oldPublicId !== newPublicId)
      await sync.reconcileItem(domain, oldPublicId);
    await sync.reconcileItem(domain, newPublicId);
    return {
      domain: domain,
      id: Number(result.id),
      title: result.title || metadata.title,
      tmdbId: Number(result.tmdbId) || (hasTmdbId ? tmdbId : null),
      imdbId: result.imdbId || (hasImdbId ? imdbId : null),
    };
  }
  async function reassignMediaFile(input) {
    const domain = String(input.domain || ""),
      engineInstanceId = String(input.engineInstanceId || "").trim() || null,
      selectedPath = String(input.path || "")
        .trim()
        .replaceAll("\\", "/");
    if (
      !["movie", "tv"].includes(domain) ||
      !selectedPath ||
      !/\.(?:avi|mkv|mp4|m4v|mov|wmv|mpg|mpeg|ts|m2ts|webm)$/i.test(
        selectedPath,
      )
    )
      throw new Error("Choose a supported video file");
    const movieId = Number(input.movieId),
      episodeId = Number(input.episodeId),
      seriesId = Number(input.seriesId);
    if (domain === "movie" && !Number.isFinite(movieId))
      throw new Error("Choose the movie that owns this file");
    if (
      domain === "tv" &&
      (!Number.isFinite(episodeId) || !Number.isFinite(seriesId))
    )
      throw new Error("Choose the television episode that owns this file");
    const selectedFolder =
      selectedPath.slice(0, selectedPath.lastIndexOf("/")) || "/";
    if (domain === "movie") {
      const movieRecord = await management.execute("movie", "library", "GET", {
        id: movieId,
        engineInstanceId: engineInstanceId,
      });
      await management.execute("movie", "library", "PUT", {
        id: movieId,
        query: { moveFiles: false },
        payload: { ...movieRecord, path: selectedFolder },
        engineInstanceId: engineInstanceId,
      });
      const result = await management.execute("movie", "commands", "POST", {
        payload: { name: "RefreshMovie", movieIds: [movieId] },
        engineInstanceId: engineInstanceId,
      });
      for (const delay of [5e3, 2e4])
        setTimeout(
          () => sync.reconcileItem("movie", `movie_${movieId}`).catch(() => {}),
          delay,
        );
      return result;
    }
    const value = await management.execute(domain, "manualImport", "GET", {
      query: {
        seriesId: seriesId,
        folder: selectedFolder,
        filterExistingFiles: false,
      },
      engineInstanceId: engineInstanceId,
    });
    const candidates = Array.isArray(value) ? value : value?.records || [],
      normalize = (value) =>
        String(value || "")
          .replaceAll("\\", "/")
          .replace(/\/+$/, "")
          .toLowerCase();
    const candidate = candidates.find(
      (item) => normalize(item.path) === normalize(selectedPath),
    );
    if (!candidate)
      throw new Error(
        "The selected file could not be validated by the media service",
      );
    const assignment = {
      ...candidate,
      path: selectedPath,
      ...(domain === "movie"
        ? {
            movieId: movieId,
            movie: { ...(candidate.movie || {}), id: movieId },
          }
        : {
            seriesId: seriesId,
            episodeIds: [episodeId],
            episodes: [...(candidate.episodes || [])],
            series: { ...(candidate.series || {}), id: seriesId },
          }),
    };
    const reprocessed = await management.execute(
      domain,
      "manualImport",
      "POST",
      { payload: [assignment], engineInstanceId: engineInstanceId },
    );
    const processed =
      (Array.isArray(reprocessed) ? reprocessed : [assignment])[0] ||
      assignment;
    const file = {
      ...processed,
      path: selectedPath,
      folderName:
        processed.folderName || selectedPath.split("/").slice(-2, -1)[0] || "",
      ...(domain === "movie"
        ? { movieId: movieId }
        : { seriesId: seriesId, episodeIds: [episodeId] }),
    };
    const result = await management.execute(domain, "commands", "POST", {
      payload: {
        name: "ManualImport",
        files: [file],
        importMode: "Auto",
        priority: "high",
      },
      engineInstanceId: engineInstanceId,
    });
    setTimeout(
      () =>
        sync
          .reconcileItem(
            domain,
            `${domain === "movie" ? "movie" : "series"}_${domain === "movie" ? movieId : seriesId}`,
          )
          .catch(() => {}),
      2e3,
    );
    return result;
  }
  const normalizeMediaPath = (value) =>
    String(value || "")
      .replaceAll("\\", "/")
      .replace(/\/+$/, "");
  async function mediaPathMigrationPreview(domain, targetPath, requestedSource = "", engineInstanceId = null) {
    if (!["movie", "tv"].includes(domain))
      throw new Error("Choose Movies or Television");
    const targetRoot = normalizeMediaPath(targetPath),
      sourceFilter = normalizeMediaPath(requestedSource),
      [rootsValue, libraryValue, collectionsValue] = await Promise.all([
        management.execute(domain, "rootFolders", "GET", {engineInstanceId}),
        management.execute(domain, "library", "GET", {engineInstanceId}),
        domain === "movie"
          ? management.execute("movie", "collections", "GET", {engineInstanceId}).catch(() => [])
          : Promise.resolve([]),
      ]),
      roots = Array.isArray(rootsValue) ? rootsValue : [],
      library = Array.isArray(libraryValue)
        ? libraryValue
        : libraryValue?.records || [],
      collections = Array.isArray(collectionsValue)
        ? collectionsValue
        : collectionsValue?.records || [];
    if (!roots.some((root) => normalizeMediaPath(root.path) === targetRoot))
      throw new Error("Choose a library folder registered with this engine");
    let targetIdentity;
    try {
      targetIdentity = await filesystemLocationIdentity(targetRoot);
    } catch {
      throw new Error("The new library folder is not accessible");
    }
    const matches = [];
    for (const root of roots) {
      const sourceRoot = normalizeMediaPath(root.path);
      if (
        !sourceRoot ||
        sourceRoot === targetRoot ||
        (sourceFilter && sourceRoot !== sourceFilter)
      )
        continue;
      let sourceIdentity;
      try {
        sourceIdentity = await filesystemLocationIdentity(sourceRoot);
      } catch {
        continue;
      }
      if (sourceIdentity !== targetIdentity) continue;
      const affected = library
        .filter((item) => {
          const path = normalizeMediaPath(item.path || item.rootFolderPath);
          return path === sourceRoot || path.startsWith(`${sourceRoot}/`);
        })
        .map((item) => {
          const oldPath = normalizeMediaPath(item.path || item.rootFolderPath);
          return {
            id: Number(item.id),
            title: item.title || item.name || oldPath,
            oldPath,
            newPath: `${targetRoot}${oldPath.slice(sourceRoot.length)}`,
          };
        })
        .filter((item) => Number.isFinite(item.id));
      const affectedCollections = collections
        .filter((item) => normalizeMediaPath(item.rootFolderPath) === sourceRoot)
        .map((item) => ({
          id: Number(item.id),
          title: item.title || item.name || `Collection ${item.id}`,
          oldPath: sourceRoot,
          newPath: targetRoot,
        }))
        .filter((item) => Number.isFinite(item.id));
      matches.push({ sourceRoot, targetRoot, affected, affectedCollections });
    }
    matches.sort((left, right) => right.affected.length - left.affected.length);
    return {
      domain,
      targetRoot,
      equivalent: matches.length > 0,
      matches,
      match: matches[0] || null,
    };
  }
  const parentMediaPath = (value) => {
    const path = normalizeMediaPath(value),
      index = path.lastIndexOf("/");
    return index > 0 ? path.slice(0, index) : "/";
  };
  const joinMediaPath = (root, folder) => {
    const separator = String(root || "").includes("\\") ? "\\" : "/";
    return `${String(root || "").replace(/[\\/]+$/, "")}${separator}${String(folder || "").replace(/^[\\/]+/, "")}`;
  };
  const renameMediaSignature = (record) =>
    JSON.stringify({
      id: record.id,
      path: normalizeMediaPath(record.path),
      sizeOnDisk: Number(
        record.sizeOnDisk || record.statistics?.sizeOnDisk || 0,
      ),
      movieFile: record.movieFile
        ? {
            id: record.movieFile.id,
            relativePath: record.movieFile.relativePath,
            size: record.movieFile.size,
            dateAdded: record.movieFile.dateAdded,
          }
        : null,
      statistics: record.statistics
        ? {
            episodeFileCount: record.statistics.episodeFileCount,
            episodeCount: record.statistics.episodeCount,
            sizeOnDisk: record.statistics.sizeOnDisk,
          }
        : null,
      seasons: Array.isArray(record.seasons)
        ? record.seasons.map((season) => ({
            seasonNumber: season.seasonNumber,
            statistics: season.statistics
              ? {
                  episodeFileCount: season.statistics.episodeFileCount,
                  sizeOnDisk: season.statistics.sizeOnDisk,
                }
              : null,
          }))
        : null,
    });
  function saveRenamePlan(preview, record) {
    const previewId = randomUUID(),
      now = Date.now();
    renamePlans.set(previewId, {
      preview: preview,
      signature: renameMediaSignature(record),
      expiresAt: now + 2 * 60 * 1e3,
    });
    if (renamePlans.size > 500)
      for (const [id, plan] of renamePlans)
        if (plan.expiresAt <= now) renamePlans.delete(id);
    return {
      ...preview,
      previewId: previewId,
      expiresAt: new Date(now + 2 * 60 * 1e3).toISOString(),
    };
  }
  async function renameMediaPreview(input) {
    const domain = String(input.domain || ""),
      mediaId = Number(input.mediaId),
      engineInstanceId = String(input.engineInstanceId || "").trim() || null;
    if (!["movie", "tv"].includes(domain) || !Number.isFinite(mediaId))
      throw new Error("Choose a movie or television series to organize");
    let refreshStatus = "not-requested";
    if (input.storePlan !== false) {
      try {
        const payload =
          domain === "movie"
            ? { name: "RefreshMovie", movieIds: [mediaId] }
            : { name: "RefreshSeries", seriesId: mediaId };
        const command = await management.execute(domain, "commands", "POST", {
            payload: payload,
            engineInstanceId: engineInstanceId,
          }),
          commandId = Number(command?.id);
        refreshStatus = "queued";
        if (Number.isFinite(commandId)) {
          const deadline = Date.now() + 2e4;
          while (Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            const current = await management.execute(
              domain,
              "commands",
              "GET",
              { id: commandId, engineInstanceId: engineInstanceId },
            );
            const status = String(current?.status || "").toLowerCase();
            if (
              ["completed", "failed", "aborted", "cancelled"].includes(status)
            ) {
              refreshStatus = status;
              break;
            }
          }
          if (refreshStatus === "queued") refreshStatus = "timed-out";
        }
      } catch {
        refreshStatus = "unavailable";
      }
    }
    const record = await management.execute(domain, "library", "GET", {
      id: mediaId,
      engineInstanceId: engineInstanceId,
    });
    const folderResult = await management.execute(
      domain,
      "libraryFolder",
      "GET",
      { id: mediaId, engineInstanceId: engineInstanceId },
    );
    const folder = String(folderResult?.folder || "").trim();
    if (!folder)
      throw new Error(
        "The media service could not calculate the configured folder name",
      );
    const rootFolderPath = String(
      record.rootFolderPath || parentMediaPath(record.path),
    );
    const destinationPath = joinMediaPath(rootFolderPath, folder);
    const renameItems = await management.execute(
      domain,
      "renamePreview",
      "GET",
      {
        query:
          domain === "movie" ? { movieId: mediaId } : { seriesId: mediaId },
        engineInstanceId: engineInstanceId,
      },
    );
    const fileRecords = await management.execute(
      domain,
      domain === "movie" ? "movieFiles" : "episodeFiles",
      "GET",
      {
        query:
          domain === "movie" ? { movieId: mediaId } : { seriesId: mediaId },
        engineInstanceId: engineInstanceId,
      },
    );
    const fileList = Array.isArray(fileRecords) ? fileRecords : [],
      filesById = new Map(fileList.map((file) => [Number(file.id), file]));
    const mappedFiles = (Array.isArray(renameItems) ? renameItems : []).map(
      (item) => {
        const file =
          filesById.get(
            Number(item.movieFileId ?? item.episodeFileId ?? item.id),
          ) || item;
        const existingPath = file.path || item.existingPath || item.path || "",
          libraryPath = normalizeMediaPath(record.path).toLowerCase(),
          normalizedExisting = normalizeMediaPath(existingPath).toLowerCase();
        return {
          id: item.movieFileId ?? item.episodeFileId ?? item.id,
          existingPath: existingPath,
          outsideLibraryFolder: Boolean(
            libraryPath &&
            normalizedExisting.includes("/") &&
            !normalizedExisting.startsWith(`${libraryPath}/`),
          ),
          newPath: item.newPath || "",
          renameAfterFolderMove: false,
          size: Number(file.size || file.sizeOnDisk || 0),
          quality:
            file.quality?.quality?.name ||
            file.quality?.name ||
            file.quality ||
            "",
          languages: (Array.isArray(file.languages)
            ? file.languages
            : file.language
              ? [file.language]
              : []
          )
            .map((value) => value?.name || value)
            .filter(Boolean),
          videoCodec: file.mediaInfo?.videoCodec || "",
          audioCodec: file.mediaInfo?.audioCodec || "",
          resolution:
            file.mediaInfo?.resolution || file.mediaInfo?.videoResolution || "",
          dateAdded: file.dateAdded || "",
          seasonNumber: item.seasonNumber,
          episodeNumbers: item.episodeNumbers || [],
        };
      },
    );
    if (
      normalizeMediaPath(record.path) !== normalizeMediaPath(destinationPath)
    ) {
      const represented = new Set(mappedFiles.map((file) => Number(file.id)));
      for (const file of fileList)
        if (
          Number.isFinite(Number(file.id)) &&
          !represented.has(Number(file.id))
        )
          mappedFiles.push({
            id: file.id,
            existingPath: file.path || "",
            outsideLibraryFolder: false,
            newPath: "",
            renameAfterFolderMove: true,
            size: Number(file.size || file.sizeOnDisk || 0),
            quality:
              file.quality?.quality?.name ||
              file.quality?.name ||
              file.quality ||
              "",
            languages: (Array.isArray(file.languages)
              ? file.languages
              : file.language
                ? [file.language]
                : []
            )
              .map((value) => value?.name || value)
              .filter(Boolean),
            videoCodec: file.mediaInfo?.videoCodec || "",
            audioCodec: file.mediaInfo?.audioCodec || "",
            resolution:
              file.mediaInfo?.resolution ||
              file.mediaInfo?.videoResolution ||
              "",
            dateAdded: file.dateAdded || "",
          });
    }
    const preview = {
      domain: domain,
      mediaId: mediaId,
      engineInstanceId: engineInstanceId,
      title: record.title,
      currentPath: record.path,
      rootFolderPath: rootFolderPath,
      destinationPath: destinationPath,
      folderChange:
        normalizeMediaPath(record.path) !== normalizeMediaPath(destinationPath),
      refreshStatus: refreshStatus,
      files: mappedFiles,
    };
    return input.storePlan === false
      ? preview
      : saveRenamePlan(preview, record);
  }
  const publicNamingAuditJob = (job) => ({
    id: job.id,
    domain: job.domain,
    status: job.status,
    total: job.total,
    completed: job.completed,
    matching: job.matching,
    mismatched: job.results.length,
    failed: job.failed,
    currentTitle: job.currentTitle,
    results: job.results,
    errors: job.errors.slice(-25),
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  });
  async function runNamingAudit(job) {
    try {
      const records = await management.execute(
          job.domain,
          "library",
          "GET",
          {},
        ),
        items = (Array.isArray(records) ? records : []).filter((record) =>
          job.domain === "movie"
            ? Boolean(record.hasFile || record.movieFile)
            : Number(record.statistics?.episodeFileCount || 0) > 0,
        );
      job.total = items.length;
      let index = 0;
      const worker = async () => {
        while (index < items.length) {
          const record = items[index++];
          job.currentTitle = record.title || "";
          try {
            const preview = await renameMediaPreview({
                domain: job.domain,
                mediaId: Number(record.id),
                storePlan: false,
              }),
              files = preview.files.filter(
                (file) =>
                  file.renameAfterFolderMove ||
                  normalizeMediaPath(file.existingPath) !==
                    normalizeMediaPath(file.newPath),
              );
            if (preview.folderChange || files.length)
              job.results.push({ ...preview, files: files });
            else job.matching++;
          } catch (error) {
            job.failed++;
            job.errors.push({
              title: record.title || "Unknown media",
              message: error instanceof Error ? error.message : String(error),
            });
          } finally {
            job.completed++;
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(4, Math.max(items.length, 1)) }, worker),
      );
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.errors.push({
        title: "Library audit",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    job.currentTitle = "";
    job.finishedAt = new Date().toISOString();
  }
  async function renameMedia(input) {
    let preview, record;
    if (input.previewId) {
      const previewId = String(input.previewId),
        plan = renamePlans.get(previewId);
      renamePlans.delete(previewId);
      if (!plan || plan.expiresAt <= Date.now())
        throw new Error(
          "This rename preview expired. Generate a fresh preview before applying changes.",
        );
      preview = plan.preview;
      record = await management.execute(preview.domain, "library", "GET", {
        id: preview.mediaId,
        engineInstanceId: preview.engineInstanceId || null,
      });
      if (
        (input.domain && input.domain !== preview.domain) ||
        (input.mediaId && Number(input.mediaId) !== preview.mediaId)
      )
        throw new Error(
          "This rename preview does not match the selected media.",
        );
      if (renameMediaSignature(record) !== plan.signature)
        throw new Error(
          "This media changed after the rename preview was created. Generate a fresh preview before applying changes.",
        );
    } else preview = await renameMediaPreview({ ...input, storePlan: false });
    const domain = preview.domain,
      mediaId = preview.mediaId,
      engineInstanceId = preview.engineInstanceId || null,
      moveFolder = input.moveFolder !== false;
    const availableIds = new Set(
      preview.files.map((file) => Number(file.id)).filter(Number.isFinite),
    );
    const requestedIds = Array.isArray(input.fileIds)
      ? input.fileIds.map(Number).filter((id) => availableIds.has(id))
      : Array.from(availableIds);
    if (preview.folderChange && moveFolder) {
      record ||= await management.execute(domain, "library", "GET", {
        id: mediaId,
        engineInstanceId: engineInstanceId,
      });
      await management.execute(domain, "library", "PUT", {
        id: mediaId,
        query: { moveFiles: true },
        payload: {
          ...record,
          path: preview.destinationPath,
          rootFolderPath: preview.rootFolderPath,
        },
        engineInstanceId: engineInstanceId,
      });
    }
    const command = requestedIds.length
      ? await management.execute(domain, "commands", "POST", {
          payload:
            domain === "movie"
              ? { name: "RenameFiles", movieId: mediaId, files: requestedIds }
              : { name: "RenameFiles", seriesId: mediaId, files: requestedIds },
          engineInstanceId: engineInstanceId,
        })
      : null;
    for (const delay of [2e3, 1e4, 3e4])
      setTimeout(
        () =>
          sync
            .reconcileItem(
              domain,
              `${domain === "movie" ? "movie" : "series"}_${mediaId}`,
            )
            .catch(() => {}),
        delay,
      );
    return { preview: preview, command: command };
  }
  async function deleteRenamePreviewFile(input) {
    const previewId = String(input.previewId || ""),
      fileId = Number(input.fileId),
      plan = renamePlans.get(previewId);
    if (!plan || plan.expiresAt <= Date.now())
      throw new Error(
        "This rename preview expired. Generate a fresh preview before deleting a file.",
      );
    const preview = plan.preview,
      file = preview.files.find((item) => Number(item.id) === fileId);
    if (!file) throw new Error("That file is not part of this rename preview.");
    await management.execute(
      preview.domain,
      preview.domain === "movie" ? "movieFiles" : "episodeFiles",
      "DELETE",
      { id: fileId, engineInstanceId: preview.engineInstanceId || null },
    );
    preview.files = preview.files.filter((item) => Number(item.id) !== fileId);
    const record = await management.execute(preview.domain, "library", "GET", {
      id: preview.mediaId,
      engineInstanceId: preview.engineInstanceId || null,
    });
    plan.signature = renameMediaSignature(record);
    await sync
      .reconcileItem(
        preview.domain,
        `${preview.domain === "movie" ? "movie" : "series"}_${preview.mediaId}`,
      )
      .catch(() => {});
    return { deleted: true, fileId: fileId };
  }
  function queueRecordKey(domain, item) {
    return `${domain}:${String(item.id || item.downloadId || item.downloadClientId || item.title || "unknown")}`;
  }
  function truthyEngineValue(value) {
    return (
      value === true ||
      ["true", "1", "yes", "on"].includes(
        String(value ?? "")
          .trim()
          .toLowerCase(),
      )
    );
  }
  function broadcastLibraryEvent(value) {
    const payload = `event: library-updated\ndata: ${JSON.stringify(value)}\n\n`;
    for (const client of libraryEventClients) {
      if (value?.domain && !client.domains.has(value.domain)) continue;
      try {
        client.response.write(payload);
      } catch {
        libraryEventClients.delete(client);
      }
    }
  }
  function importedMediaId(domain, event) {
    return Number(
      domain === "movie"
        ? event?.movieId || event?.movie?.id
        : event?.seriesId || event?.series?.id || event?.episode?.seriesId,
    );
  }
  async function authoritativeAttention(domain) {
    const adapter = registry.get(domain);
    if (typeof adapter.getAttentionSummary === "function") {
      const attention = await adapter.getAttentionSummary();
      attentionSnapshots.set(domain, attention);
      return attention;
    }
    const items = await sync.list(domain);
    const monitored = items.filter((item) => item.monitoring !== "none");
    const attention = {
      missing: monitored.reduce(
        (sum, item) =>
          sum +
          (domain === "movie"
            ? Number(item.state === "missing")
            : Number(item.missingEpisodes || 0)),
        0,
      ),
      cutoff: monitored.reduce(
        (sum, item) =>
          sum +
          (domain === "movie"
            ? Number(item.state === "cutoff")
            : Number(item.cutoffUnmetEpisodes || 0)),
        0,
      ),
    };
    attentionSnapshots.set(domain, attention);
    return attention;
  }
  async function refreshAttention(domain, items) {
    try {
      return await authoritativeAttention(domain);
    } catch {
      const attention =
        typeof projectionStore.attentionSummary === "function"
          ? await projectionStore.attentionSummary(domain)
          : cachedAttention(domain, items);
      attentionSnapshots.set(domain, attention);
      return attention;
    }
  }
  async function librarySummary(domain, items, engineInstanceId = "all") {
    if (typeof projectionStore.librarySummary === "function")
      return projectionStore.librarySummary(domain, engineInstanceId);
    const records = Array.isArray(items) ? items : [],
      monitored = records.filter((item) => item.monitoring !== "none").length,
      covered = records.filter((item) =>
        domain === "movie"
          ? Boolean(item.hasFile)
          : Number(item.missingEpisodes || 0) === 0,
      ).length;
    return { total: records.length, monitored, covered };
  }
  sync.onFullSync?.(({ domain: domain, updatedAt: updatedAt }) => {
    dashboardSnapshot = null;
    dashboardSnapshotExpires = 0;
    broadcastLibraryEvent({
      domain: domain,
      replaceAll: true,
      updatedAt: updatedAt,
    });
  });
  function cachedAttention(domain, items) {
    const cached = attentionSnapshots.get(domain);
    if (cached) return cached;
    const monitored = items.filter((item) => item.monitoring !== "none");
    return {
      missing: monitored.reduce(
        (sum, item) =>
          sum +
          (domain === "movie"
            ? Number(item.state === "missing")
            : Number(item.missingEpisodes || 0)),
        0,
      ),
      cutoff: monitored.reduce(
        (sum, item) =>
          sum +
          (domain === "movie"
            ? Number(item.state === "cutoff")
            : Number(item.cutoffUnmetEpisodes || 0)),
        0,
      ),
    };
  }
  async function broadcastAuthoritativeAttention(domain) {
    const [attention, summary] = await Promise.all([
      authoritativeAttention(domain),
      librarySummary(domain, []),
    ]);
    broadcastLibraryEvent({
      domain: domain,
      attention: attention,
      summary: summary,
      updatedAt: new Date().toISOString(),
    });
    return attention;
  }
  function queueImportedLibraryReconciliation(domain, event) {
    const mediaId = importedMediaId(domain, event);
    if (!Number.isFinite(mediaId) || mediaId <= 0) return;
    const identity = String(
      event?.id ||
        event?.movieFileId ||
        event?.episodeFileId ||
        event?.downloadId ||
        event?.data?.downloadId ||
        event?.date ||
        `${mediaId}:${event?.sourceTitle || ""}`,
    );
    const eventKey = `${domain}:${identity}`,
      now = Date.now(),
      seen = completedLibraryImports.get(eventKey) || 0;
    if (now - seen < 24 * 60 * 60 * 1e3) return;
    completedLibraryImports.set(eventKey, now);
    dashboardSnapshot = null;
    dashboardSnapshotExpires = 0;
    dashboardHistorySnapshot = null;
    dashboardHistoryExpires = 0;
    if (eventProcessor) {
      void eventProcessor
        .enqueue({
          dedupeKey: `import:${eventKey}`,
          domain: domain,
          mediaId: `${domain === "movie" ? "movie" : "series"}_${mediaId}`,
          eventType: "download-imported",
          payload: event,
        })
        .catch(() => {});
      return;
    }
    let pending = libraryReconciliations.get(domain);
    if (!pending) {
      pending = { mediaIds: new Set(), timer: null };
      libraryReconciliations.set(domain, pending);
    }
    pending.mediaIds.add(mediaId);
    if (!pending.timer)
      pending.timer = setTimeout(async () => {
        pending.timer = null;
        const mediaIds = [...pending.mediaIds];
        pending.mediaIds.clear();
        try {
          const prefix = domain === "movie" ? "movie" : "series";
          const [reconciled, attention] = await Promise.all([
              Promise.all(
                mediaIds.map((id) =>
                  sync.reconcileItem(domain, `${prefix}_${id}`),
                ),
              ),
              authoritativeAttention(domain),
            ]),
            changed = reconciled.map((result) => result.item).filter(Boolean);
          broadcastLibraryEvent({
            domain: domain,
            mediaIds: mediaIds,
            items: changed,
            attention: attention,
            updatedAt: new Date().toISOString(),
          });
        } catch {
          for (const id of mediaIds) pending.mediaIds.add(id);
          if (!pending.timer)
            pending.timer = setTimeout(() => {
              pending.timer = null;
              for (const id of [...pending.mediaIds])
                queueImportedLibraryReconciliation(domain, {
                  id: `retry:${id}:${Date.now()}`,
                  movieId: domain === "movie" ? id : null,
                  seriesId: domain === "tv" ? id : null,
                });
            }, 1e4);
        }
      }, 2e3);
    if (completedLibraryImports.size > 5e3)
      for (const [key, timestamp] of completedLibraryImports)
        if (now - timestamp > 24 * 60 * 60 * 1e3)
          completedLibraryImports.delete(key);
  }
  function scheduleImportedUpgradeRename(domain, item, event) {
    if (!truthyEngineValue(event?.data?.isUpgrade ?? event?.isUpgrade)) return;
    const engineInstanceId = String(item.engineInstanceId || "").trim() || null,
      mediaId = Number(
      domain === "movie"
        ? item.movieId || item.movie?.id
        : item.seriesId || item.series?.id || item.episode?.seriesId,
    );
    if (!Number.isFinite(mediaId) || mediaId <= 0) return;
    const eventIdentity = String(
      event?.id ||
        event?.movieFileId ||
        event?.episodeFileId ||
        event?.downloadId ||
        event?.data?.downloadId ||
        event?.date ||
        item.id ||
        item.title ||
        "unknown",
    );
    const key = `${domain}:${engineInstanceId || "default"}:${mediaId}:${eventIdentity}`,
      now = Date.now(),
      last = completedUpgradeRenames.get(key) || 0;
    if (now - last < 24 * 60 * 60 * 1e3) return;
    completedUpgradeRenames.set(key, now);
    void (async () => {
      try {
        const naming = await management.execute(domain, "naming", "GET", { engineInstanceId });
        const renameEnabled =
          domain === "movie" ? naming?.renameMovies : naming?.renameEpisodes;
        if (!truthyEngineValue(renameEnabled)) return;
        const payload =
          domain === "movie"
            ? { name: "RenameMovie", movieIds: [mediaId] }
            : { name: "RenameSeries", seriesIds: [mediaId] };
        await management.execute(domain, "commands", "POST", {
          payload: payload,
          engineInstanceId,
        });
        for (const delay of [2e3, 1e4, 3e4])
          setTimeout(
            () =>
              sync
                .reconcileItem(
                  domain,
                  `${domain === "movie" ? "movie" : "series"}_${engineInstanceId ? `${engineInstanceId}_` : ""}${mediaId}`,
                )
                .catch(() => {}),
            delay,
          );
      } catch {
        completedUpgradeRenames.delete(key);
      }
    })();
    if (completedUpgradeRenames.size > 2e3)
      for (const [recordKey, timestamp] of completedUpgradeRenames)
        if (now - timestamp > 24 * 60 * 60 * 1e3)
          completedUpgradeRenames.delete(recordKey);
  }
  function scheduleCompletedMediaRefresh(domain, item) {
    const engineInstanceId = String(item.engineInstanceId || "").trim() || null,
      mediaId = Number(
      domain === "movie"
        ? item.movieId || item.movie?.id
        : item.seriesId || item.series?.id || item.episode?.seriesId,
    );
    if (!Number.isFinite(mediaId)) return;
    const key = queueRecordKey(domain, item),
      last = completedQueueRefreshes.get(key) || 0,
      now = Date.now();
    if (now - last < 30 * 60 * 1e3) return;
    completedQueueRefreshes.set(key, now);
    const payload =
      domain === "movie"
        ? { name: "RefreshMovie", movieIds: [mediaId] }
        : { name: "RefreshSeries", seriesId: mediaId };
    for (const delay of [2e3, 15e3]) {
      setTimeout(async () => {
        try {
          await management.execute(domain, "commands", "POST", {
            payload: payload,
            engineInstanceId,
          });
          await sync.reconcileItem(
            domain,
            `${domain === "movie" ? "movie" : "series"}_${engineInstanceId ? `${engineInstanceId}_` : ""}${mediaId}`,
          );
        } catch {}
      }, delay);
    }
    if (completedQueueRefreshes.size > 2e3)
      for (const [recordKey, timestamp] of completedQueueRefreshes)
        if (now - timestamp > 24 * 60 * 60 * 1e3)
          completedQueueRefreshes.delete(recordKey);
  }
  const importPaceMs = Math.max(
    0,
    Math.min(2e3, Number(env.VYNODEARR_IMPORT_PACE_MS || 25)),
  );
  const pause = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
  function startImportJob(userId, input) {
    const domain = input.domain,
      engineInstanceId = String(input.engineInstanceId || "").trim() || null,
      instance = engineInstanceId ? engineSettings.public().instances.find((item) => item.id === engineInstanceId && item.domain === domain && item.enabled !== false) : null,
      label = instance?.name || (domain === "movie" ? "Movies" : "Television"),
      items = Array.isArray(input.items) ? input.items : [];
    if (
      !["movie", "tv"].includes(domain) ||
      !items.length ||
      items.length > 5e3
    )
      throw new Error("Select between 1 and 5,000 titles to import");
    if (engineInstanceId && !instance)
      throw new Error("Choose an available engine instance");
    const job = {
      id: `import_${randomUUID()}`,
      userId: userId,
      domain: domain,
      engineInstanceId: engineInstanceId,
      engineInstanceName: instance?.name || null,
      label: label,
      status: "queued",
      total: items.length,
      completed: 0,
      skipped: 0,
      failed: 0,
      currentTitle: null,
      errors: [],
      createdAt: new Date().toISOString(),
      finishedAt: null,
      cancelRequested: false,
    };
    importJobs.set(job.id, job);
    void (async () => {
      job.status = "running";
      const known = new Set();
      try {
        const existing = await management.execute(domain, "library", "GET", { engineInstanceId });
        for (const record of Array.isArray(existing)
          ? existing
          : existing?.records || [])
          for (const key of importIdentityKeys(record)) known.add(key);
      } catch {}
      for (const item of items) {
        if (job.cancelRequested) break;
        job.currentTitle = String(item.title || "Untitled");
        const keys = importIdentityKeys(item.payload),
          duplicate = keys.some((key) => known.has(key));
        if (duplicate) {
          job.skipped += 1;
          continue;
        }
        try {
          await management.execute(domain, "library", "POST", {
            payload: item.payload,
            engineInstanceId,
          });
          job.completed += 1;
          for (const key of keys) known.add(key);
          if (job.completed % 50 === 0) {
            dashboardSnapshot = null;
            dashboardSnapshotExpires = 0;
          }
        } catch (error) {
          const message = redact(
            error?.safeMessage || error?.message || "Import failed",
          );
          if (duplicateImportError(message)) job.skipped += 1;
          else {
            job.failed += 1;
            job.errors.push({ title: job.currentTitle, message: message });
          }
        }
        if (importPaceMs) await pause(importPaceMs);
      }
      job.currentTitle = null;
      job.status = job.cancelRequested
        ? "canceled"
        : job.failed === job.total
          ? "failed"
          : "completed";
      job.finishedAt = new Date().toISOString();
      sync.invalidate(domain);
      setTimeout(() => sync.synchronize(domain).catch(() => {}), 1e4);
      setTimeout(() => importJobs.delete(job.id), 6 * 60 * 60 * 1e3);
    })();
    return publicImportJob(job);
  }
  function startMissingSearchJob(userId, input) {
    const domain = input.domain,
      engineInstanceId=String(input.engineInstanceId||"").trim()||null,
      instance=engineInstanceId?engineSettings.public().instances.find(item=>item.id===engineInstanceId&&item.domain===domain):null,
      label = instance?.name || (domain === "movie" ? "Movies" : "Television");
    if (!["movie", "tv"].includes(domain))
      throw new Error("Choose Movies or Television");
    const active = [...searchJobs.values()].find(
      (job) =>
        job.userId === userId &&
        job.domain === domain &&
        String(job.engineInstanceId||"")===String(engineInstanceId||"") &&
        ["queued", "running", "canceling"].includes(job.status),
    );
    if (active) return publicSearchJob(active);
    const job = {
      id: `search_${randomUUID()}`,
      userId: userId,
      domain: domain,
      engineInstanceId,
      engineInstanceName:instance?.name||null,
      label: label,
      status: "queued",
      total: 0,
      completed: 0,
      failed: 0,
      currentTitle: "Loading missing items",
      errors: [],
      createdAt: new Date().toISOString(),
      finishedAt: null,
      cancelRequested: false,
    };
    searchJobs.set(job.id, job);
    let activityId = null;
    const activityPromise = createSearchActivity(
      userId,
      { name: domain === "movie" ? "MoviesSearch" : "EpisodeSearch" },
      {},
      {
        domain: domain,
        source: "wanted",
        scope: "bulk",
        title: `Search all missing ${label.toLowerCase()}`,
        engineInstanceId,
        status: "searching",
        counts: { total: 0, completed: 0, failed: 0 },
      },
    ).then((activity) => (activityId = activity.id));
    void (async () => {
      await activityPromise;
      job.status = "running";
      try {
        const value = await management.execute(domain, "wantedMissing", "GET", {
          query: {
            page: 1,
            pageSize: 1e4,
            sortKey: "title",
            sortDirection: "ascending",
            ...(domain === "tv" ? { monitored: true } : {}),
          },
          engineInstanceId,
        });
        const items = Array.isArray(value) ? value : value?.records || [];
        job.total = items.length;
        if (activityId)
          await updateSearchActivity(activityId, {
            counts: { total: job.total, completed: 0, failed: 0 },
            message: `Searching ${job.total} missing item${job.total === 1 ? "" : "s"} in safe batches.`,
          });
        const batchSize = domain === "movie" ? 20 : 40;
        for (
          let offset = 0;
          offset < items.length && !job.cancelRequested;
          offset += batchSize
        ) {
          const batch = items.slice(offset, offset + batchSize),
            ids = batch.map((item) => Number(item.id)).filter(Number.isFinite);
          job.currentTitle = `${offset + 1}-${Math.min(offset + batch.length, items.length)} of ${items.length}`;
          if (!ids.length) {
            job.failed += batch.length;
            continue;
          }
          try {
            await management.execute(domain, "commands", "POST", {
              payload:
                domain === "movie"
                  ? { name: "MoviesSearch", movieIds: ids }
                  : { name: "EpisodeSearch", episodeIds: ids },
              engineInstanceId,
            });
            job.completed += ids.length;
          } catch (error) {
            const message = redact(
              error?.safeMessage || error?.message || "Search batch failed",
            );
            job.failed += ids.length;
            job.errors.push({ title: job.currentTitle, message: message });
          }
          if (activityId)
            await updateSearchActivity(activityId, {
              counts: {
                total: job.total,
                completed: job.completed,
                failed: job.failed,
              },
              message: `Queued ${job.completed} of ${job.total} missing item${job.total === 1 ? "" : "s"}.`,
            });
          await pause(250);
        }
      } catch (error) {
        job.failed = Math.max(job.failed, job.total || 1);
        job.errors.push({
          title: "Missing search",
          message: redact(
            error?.safeMessage || error?.message || "Search failed",
          ),
        });
      }
      job.currentTitle = null;
      job.status = job.cancelRequested
        ? "canceled"
        : job.failed && job.completed === 0
          ? "failed"
          : "completed";
      job.finishedAt = new Date().toISOString();
      if (activityId)
        await updateSearchActivity(activityId, {
          status: job.status,
          message:
            job.status === "completed"
              ? `All ${job.completed} searches were handed to the media engine.`
              : job.status === "canceled"
                ? "Bulk search was canceled."
                : "The bulk search could not be completed.",
          counts: {
            total: job.total,
            completed: job.completed,
            failed: job.failed,
          },
          finishedAt: job.finishedAt,
        });
      setTimeout(() => searchJobs.delete(job.id), 6 * 60 * 60 * 1e3);
    })();
    return publicSearchJob(job);
  }
  async function rebuildFromSettings() {
    const runtime = engineSettings.mode() === "external"
      ? await engineSettings.externalRuntime()
      : await engineSettings.runtime();
    if (!runtime) return;
    movie = new MovieEngineAdapter(runtime.movie);
    tv = new TvEngineAdapter(runtime.tv);
    registry.register("movie", movie).register("tv", tv);
    if(engineSettings.mode()==="external"){
      const configured=engineSettings.public().instances.filter(instance=>instance.enabled!==false),groups={movie:[],tv:[]};
      for(const instance of configured){const value=await engineSettings.instanceRuntime(instance.id);if(!value)continue;groups[instance.domain].push({...instance,adapter:instance.domain==="movie"?new MovieEngineAdapter(value):new TvEngineAdapter(value)});}
      const movieRead=groups.movie.length?new MultiInstanceReadAdapter("movie",groups.movie):movie,
        tvRead=groups.tv.length?new MultiInstanceReadAdapter("tv",groups.tv):tv;
      sync.setEngines(movieRead,tvRead);
      management.setInstances([...groups.movie,...groups.tv].map(instance=>({id:instance.id,domain:instance.domain,client:instance.adapter.client})));
    }else{sync.setEngines(movie, tv);management.setInstances([]);}
    mode = "engine";
  }
  async function ensureBundledRootFolders() {
    if (
      String(env.VYNODEARR_BOOTSTRAP_ROOT_FOLDERS || "false") !== "true" ||
      !bundledEnginesActive() ||
      mode !== "engine"
    )
      return;
    for (const [domain, path] of [
      ["movie", "/movies"],
      ["tv", "/tv"],
    ]) {
      const client = registry.get(domain).client,
        roots = await client.get("rootfolder");
      if (Array.isArray(roots) && roots.length === 0)
        await client.post("rootfolder", { path: path });
    }
  }
  async function ensureBundledDownloadPathMappings(selectedDomain = null) {
    if (
      String(env.VYNODEARR_BUNDLED_ENGINES || "false") !== "true" ||
      !bundledEnginesActive() ||
      mode !== "engine"
    )
      return;
    const saved = await downloadFolderStore.read();
    const results = [];
    for (const domain of selectedDomain ? [selectedDomain] : ["movie", "tv"]) {
      try {
        const remotePath = downloadClientRemotePath(domain),
          localPath =
            String(
              saved?.[domain]?.path || defaultDownloadFolder(domain),
            ).replace(/\/+$/, "") || defaultDownloadFolder(domain);
        const client = registry.get(domain).client,
          [clients, mappings] = await Promise.all([
            client.get("downloadclient"),
            client.get("remotepathmapping"),
          ]);
        for (const provider of Array.isArray(clients) ? clients : []) {
          if (provider.enable === false) continue;
          const host = String(
            (provider.fields || []).find(
              (field) => String(field.name).toLowerCase() === "host",
            )?.value ||
              provider.host ||
              "",
          ).trim();
          if (!host) continue;
          const existing = (Array.isArray(mappings) ? mappings : []).find(
            (mapping) =>
              String(mapping.host).toLowerCase() === host.toLowerCase() &&
              String(mapping.remotePath).replace(/\/+$/, "") === remotePath,
          );
          if (
            existing &&
            String(existing.localPath).replace(/\/+$/, "") !== localPath
          )
            await client.put(`remotepathmapping/${existing.id}`, {
              ...existing,
              host: host,
              remotePath: remotePath,
              localPath: localPath,
            });
          else if (!existing)
            await client.post("remotepathmapping", {
              host: host,
              remotePath: remotePath,
              localPath: localPath,
            });
          results.push({
            domain: domain,
            host: host,
            remotePath: remotePath,
            localPath: localPath,
            configured: true,
          });
        }
      } catch (error) {
        const message = redact(
          error?.safeMessage || error?.message || "engine unavailable",
        );
        console.warn(`${domain} download path mapping deferred:`, message);
        results.push({ domain: domain, configured: false, error: message });
      }
    }
    return results;
  }
  function startLibraryWatchers() {
    if (
      mode !== "engine" ||
      String(env.VYNODEARR_LIBRARY_WATCH_ENABLED || "true").toLowerCase() ===
        "false" ||
      libraryWatchers.length
    )
      return;
    for (const [domain, path] of [
      ["movie", env.VYNODEARR_MOVIE_LIBRARY_PATH || "/movies"],
      ["tv", env.VYNODEARR_TV_LIBRARY_PATH || "/tv"],
    ]) {
      try {
        const watcher = watch(path, { persistent: false }, () => {
          clearTimeout(libraryWatchTimers.get(domain));
          const quietPeriodMs = Math.max(
            3e4,
            Number(env.VYNODEARR_LIBRARY_WATCH_QUIET_MS || 2 * 60 * 1e3),
          );
          const cooldownMs = Math.max(
            quietPeriodMs,
            Number(env.VYNODEARR_LIBRARY_WATCH_COOLDOWN_MS || 10 * 60 * 1e3),
          );
          const elapsed = Date.now() - (libraryWatchLastSync.get(domain) || 0);
          const delay = Math.max(quietPeriodMs, cooldownMs - elapsed);
          const timer = setTimeout(async () => {
            libraryWatchTimers.delete(domain);
            dashboardSnapshot = null;
            dashboardSnapshotExpires = 0;
            try {
              await sync.synchronize(domain);
              libraryWatchLastSync.set(domain, Date.now());
            } catch {}
          }, delay);
          timer.unref?.();
          libraryWatchTimers.set(domain, timer);
        });
        watcher.on("error", () => {});
        watcher.unref?.();
        libraryWatchers.push(watcher);
      } catch {}
    }
  }
  async function engineAuthentication() {
    const items = await Promise.all(
      ["movie", "tv"].map(async (domain) => {
        try {
          const host = await registry.get(domain).client.get("config/host");
          return [
            domain,
            {
              available: true,
              required:
                String(host.authenticationRequired || "").toLowerCase() ===
                "enabled",
              mode: String(
                host.authenticationRequired || "DisabledForLocalAddresses",
              ),
            },
          ];
        } catch {
          return [
            domain,
            { available: false, required: null, mode: "Unavailable" },
          ];
        }
      }),
    );
    return {
      managed: String(env.VYNODEARR_BUNDLED_ENGINES || "false") === "true",
      ...Object.fromEntries(items),
    };
  }
  async function setEngineAuthentication(
    domain,
    required,
    { record: record = true } = {},
  ) {
    const client = registry.get(domain).client,
      host = await client.get("config/host"),
      authenticationRequired = required
        ? "Enabled"
        : "DisabledForLocalAddresses";
    if (String(host.authenticationRequired) !== authenticationRequired)
      await client.put("config/host", {
        ...host,
        authenticationRequired: authenticationRequired,
      });
    if (record) {
      const value = await engineAuthenticationStore.read();
      value.initialized = true;
      value[domain] = { required: Boolean(required) };
      value.updatedAt = new Date().toISOString();
      await engineAuthenticationStore.write(value);
    }
    return {
      domain: domain,
      required: Boolean(required),
      mode: authenticationRequired,
    };
  }
  async function ensureBundledAuthenticationDefault() {
    if (
      String(env.VYNODEARR_BUNDLED_ENGINES || "false") !== "true" ||
      !bundledEnginesActive() ||
      mode !== "engine"
    )
      return;
    const value = await engineAuthenticationStore.read();
    if (value.initialized) return;
    await Promise.all(
      ["movie", "tv"].map((domain) =>
        setEngineAuthentication(domain, true, { record: false }),
      ),
    );
    value.initialized = true;
    value.movie = { required: true };
    value.tv = { required: true };
    value.updatedAt = new Date().toISOString();
    await engineAuthenticationStore.write(value);
  }
  async function restoreBundledCredentials() {
    if (
      String(env.VYNODEARR_BUNDLED_ENGINES || "false") !== "true" ||
      !bundledEnginesActive()
    )
      return false;
    const configured = await engineSettings.runtime(),
      readKey = async (domain) => {
        const path =
            env[
              domain === "movie"
                ? "MOVIE_ENGINE_CONFIG_PATH"
                : "TV_ENGINE_CONFIG_PATH"
            ] || `/engine-config/${domain}/config.xml`,
          xml = await readFile(path, "utf8").catch(() => "");
        return (
          xml.match(/<ApiKey>([^<]+)<\/ApiKey>/i)?.[1] ||
          baseConfig[domain].apiCredential ||
          ""
        );
      },
      [movieKey, tvKey] = await Promise.all([readKey("movie"), readKey("tv")]);
    if (!movieKey || !tvKey) return false;
    await engineSettings.save(
      "movie",
      configured?.movie || baseConfig.movie,
      movieKey,
    );
    await engineSettings.save("tv", configured?.tv || baseConfig.tv, tvKey);
    return true;
  }
  async function ensureEngineWebhook(domain) {
    if (
      mode !== "engine" ||
      String(env.VYNODEARR_BUNDLED_ENGINES || "false") !== "true" ||
      !bundledEnginesActive()
    )
      return;
    const name = "VynodeArr Catalog Events",
      port = Number(env.PORT || 8686),
      target = `http://127.0.0.1:${port}/api/internal/engine-events/${domain}`,
      [existing, schemas] = await Promise.all([
        management.execute(domain, "notifications", "GET", {}),
        management.execute(domain, "notificationSchemas", "GET", {}),
      ]),
      current = (Array.isArray(existing) ? existing : []).find(
        (item) => item.name === name,
      ),
      schema = (Array.isArray(schemas) ? schemas : []).find(
        (item) =>
          String(
            item.implementation || item.implementationName || "",
          ).toLowerCase() === "webhook",
      );
    if (!schema) return;
    const fields = (schema.fields || []).map((field) => ({
        ...field,
        value:
          field.name === "url"
            ? target
            : field.name === "method"
              ? "POST"
              : field.value,
      })),
      payload = {
        ...schema,
        id: current?.id || 0,
        name: name,
        implementation: schema.implementation || "Webhook",
        configContract: schema.configContract || "WebhookSettings",
        fields: fields,
        tags: [],
        onGrab: true,
        onDownload: true,
        onUpgrade: true,
        onRename: true,
        onMovieAdded: true,
        onMovieDelete: true,
        onMovieFileDelete: true,
        onSeriesAdd: true,
        onSeriesDelete: true,
        onEpisodeFileDelete: true,
        onHealthIssue: false,
        onHealthRestored: false,
        onApplicationUpdate: false,
        onManualInteractionRequired: true,
        includeHealthWarnings: false,
      };
    if (current)
      await management.execute(domain, "notifications", "PUT", {
        id: current.id,
        payload: { ...current, ...payload, id: current.id },
      });
    else
      await management.execute(domain, "notifications", "POST", {
        payload: payload,
      });
  }
  async function initialize() {
    if (initialized) return;
    await Promise.all([
      auth.initialize(),
      engineSettings.initialize(),
      projectionStore.initialize?.(),
    ]);
    const resourceSettings = await performanceStore.read();
    configuredLibraryPageSize = boundedInteger(
      resourceSettings.pageSize,
      60,
      20,
      250,
    );
    artworkFetchLimiter.setLimit(resourceSettings.artworkFetchConcurrency || 2);
    artworkWriteLimiter.setLimit(resourceSettings.artworkWriteConcurrency || 1);
    eventProcessor?.setConcurrency(resourceSettings.eventConcurrency || 2);
    sync.setPollingInterval?.(
      (resourceSettings.integrityIntervalMinutes || 360) * 6e4,
    );
    await masterKeyService.initialize(engineSettings);
    await engineSettings.applyPendingMode();
    const storedDiscoveryCredential =
      await engineSettings.discoveryCredential();
    if (storedDiscoveryCredential)
      discovery.setToken(storedDiscoveryCredential);
    else if (discovery.configured())
      await engineSettings.saveDiscoveryCredential(discovery.token);
    await restoreBundledCredentials();
    if (!options.movie) await rebuildFromSettings();
    try {
      await ensureBundledRootFolders();
      await ensureBundledDownloadPathMappings();
      await ensureBundledAuthenticationDefault();
      if (mode === "engine") {
        await sync.hydrate();
        const snapshot = sync.snapshot(),
          catalogReady =
            snapshot.movie.itemCount > 0 || snapshot.tv.itemCount > 0;
        if (catalogReady) void sync.synchronizeOperations().catch(() => {});
        else await sync.startup();
      } else await sync.startup();
      for (const domain of ["movie", "tv"])
        void broadcastAuthoritativeAttention(domain).catch(() => {});
    } catch (error) {
      console.warn(
        "Engine startup synchronization deferred:",
        redact(error?.safeMessage || error?.message || "Engine unavailable"),
      );
    }
    sync.startPolling();
    if (!sync.catalogShutdownAttached) {
      const stopPolling = sync.stopPolling.bind(sync);
      sync.stopPolling = () => {
        stopPolling();
        eventProcessor?.stop();
        if (queueCompletionTimer) clearInterval(queueCompletionTimer);
        queueCompletionTimer = null;
        if (librarySummaryTimer) clearInterval(librarySummaryTimer);
        librarySummaryTimer = null;
        if (operationalNotificationTimer)
          clearInterval(operationalNotificationTimer);
        operationalNotificationTimer = null;
        if (reeltrackAutomationTimer) clearInterval(reeltrackAutomationTimer);
        reeltrackAutomationTimer = null;
        for (const timer of libraryWatchTimers.values()) clearTimeout(timer);
        libraryWatchTimers.clear();
        libraryWatchLastSync.clear();
        for (const watcher of libraryWatchers.splice(0)) watcher.close?.();
        void projectionStore.close?.();
      };
      sync.catalogShutdownAttached = true;
    }
    eventProcessor?.start();
    if (mode === "engine") {
      const webhookSetup = setTimeout(
        () => Promise.allSettled(["movie", "tv"].map(ensureEngineWebhook)),
        5e3,
      );
      webhookSetup.unref?.();
    }
    startLibraryWatchers();
    if (mode === "engine" && !queueCompletionTimer) {
      const interval = Math.max(
        1e4,
        Number(env.VYNODEARR_QUEUE_COMPLETION_POLL_MS || 15e3),
      );
      queueCompletionTimer = setInterval(
        () => liveQueue().catch(() => {}),
        interval,
      );
      queueCompletionTimer.unref?.();
    }
    if (mode === "engine" && !librarySummaryTimer) {
      const interval = Math.max(
        5 * 6e4,
        Number(env.VYNODEARR_LIBRARY_SUMMARY_RECONCILE_MS || 15 * 6e4),
      );
      librarySummaryTimer = setInterval(() => {
        for (const domain of ["movie", "tv"])
          void broadcastAuthoritativeAttention(domain).catch(() => {});
      }, interval);
      librarySummaryTimer.unref?.();
    }
    if (mode === "engine" && !operationalNotificationTimer) {
      const interval = Math.max(
        3e4,
        Number(env.VYNODEARR_OPERATIONAL_NOTIFICATION_POLL_MS || 6e4),
      );
      const poll = () =>
        synchronizeAdministratorOperationalNotifications().catch(() => {});
      operationalNotificationTimer = setInterval(poll, interval);
      operationalNotificationTimer.unref?.();
      const initialPoll = setTimeout(poll, 2e3);
      initialPoll.unref?.();
    }
    if (!reeltrackAutomationTimer) {
      const interval = Math.max(
        3e4,
        Number(env.VYNODEARR_REELTRACK_AUTOMATION_POLL_MS || 6e4),
      );
      reeltrackAutomationTimer = setInterval(
        () => runDueReeltrackAutomations().catch(() => {}),
        interval,
      );
      reeltrackAutomationTimer.unref?.();
      const initialAutomationPoll = setTimeout(
        () => runDueReeltrackAutomations().catch(() => {}),
        1e4,
      );
      initialAutomationPoll.unref?.();
    }
    initialized = true;
    const automaticValidation = setTimeout(() => {
      systemValidation()
        .then((report) =>
          validationStore.write({
            version: 1,
            report: report,
            updatedAt: report.generatedAt,
          }),
        )
        .catch(() => {});
    }, 1e3);
    automaticValidation.unref?.();
  }
  async function testEngine(domain, input) {
    const config = engineSettings.normalize(domain, input);
    config.apiCredential = String(input.apiCredential || "");
    const adapter =
      domain === "movie"
        ? new MovieEngineAdapter(config)
        : new TvEngineAdapter(config);
    const connection = await adapter.testConnection();
    let counts = null;
    if (
      connection.reachable &&
      connection.authenticated &&
      connection.compatible
    ) {
      const [library, queue, calendar, health] = await Promise.all([
        domain === "movie"
          ? adapter.listMovies({ limit: 1e4 })
          : adapter.listSeries({ limit: 1e4 }),
        adapter.getQueue(),
        adapter.getCalendar(),
        adapter.getHealth(),
      ]);
      counts = {
        library: library.length,
        queue: queue.length,
        calendar: calendar.length,
        health: health.length,
      };
    }
    return {
      connection: connection,
      counts: counts,
      validated: Boolean(
        connection.reachable &&
        connection.authenticated &&
        connection.compatible,
      ),
    };
  }
  async function repairBundledConnections() {
    if (
      String(env.VYNODEARR_BUNDLED_ENGINES || "false") !== "true" ||
      !bundledEnginesActive()
    )
      throw new Error(
        "Automatic connection repair is only available for bundled engines",
      );
    await rebuildFromSettings();
    let checks = await Promise.all([
      registry.movie().testConnection(),
      registry.tv().testConnection(),
    ]);
    if (
      checks.some(
        (check) =>
          !check.reachable || !check.authenticated || !check.compatible,
      )
    ) {
      if (!(await restoreBundledCredentials()))
        throw new Error(
          "Installation-managed engine credentials are unavailable",
        );
      await rebuildFromSettings();
      checks = await Promise.all([
        registry.movie().testConnection(),
        registry.tv().testConnection(),
      ]);
    }
    if (
      checks.some(
        (check) =>
          !check.reachable || !check.authenticated || !check.compatible,
      )
    )
      throw new Error("Automatic engine reconnection did not succeed");
    await sync.startup();
    return ["movie", "tv"];
  }
  async function completeEngineRestore(domain, previousStartTime) {
    let connection = null,
      restarted = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await restoreBundledCredentials();
      await rebuildFromSettings();
      const client = registry.get(domain).client,
        status = await client.get("system/status").catch(() => null);
      restarted = Boolean(
        status &&
        String(status.startTime || "") !== String(previousStartTime || ""),
      );
      connection = await registry
        .get(domain)
        .testConnection()
        .catch(() => null);
      if (
        restarted &&
        connection?.reachable &&
        connection?.authenticated &&
        connection?.compatible
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (
      !restarted ||
      !connection?.reachable ||
      !connection?.authenticated ||
      !connection?.compatible
    )
      throw new Error(
        `${domain === "movie" ? "Movie" : "Television"} engine did not reconnect after restoring the backup`,
      );
    await sync.startup();
  }
  async function tvMetadataArtwork(tvdbId, kind, seasonNumber, episodeNumber) {
    const key = `tvmaze:${tvdbId}:${kind}:${seasonNumber || 0}:${episodeNumber || 0}`;
    if (tvMetadataCache.has(key)) return tvMetadataCache.get(key);
    try {
      const request = async (url) => {
        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "user-agent": "VynodeArr/1.0",
          },
          signal: AbortSignal.timeout(8e3),
        });
        if (!response.ok) throw new Error("Metadata artwork unavailable");
        return response.json();
      };
      const show = await request(
        `https://api.tvmaze.com/lookup/shows?thetvdb=${Number(tvdbId)}`,
      );
      let record;
      if (kind === "season") {
        const seasons = await request(
          `https://api.tvmaze.com/shows/${show.id}/seasons`,
        );
        record = seasons.find(
          (item) => Number(item.number) === Number(seasonNumber),
        );
      } else {
        record = await request(
          `https://api.tvmaze.com/shows/${show.id}/episodebynumber?season=${Number(seasonNumber)}&number=${Number(episodeNumber)}`,
        );
      }
      const imageUrl = record?.image?.original || record?.image?.medium;
      if (!imageUrl || new URL(imageUrl).hostname !== "static.tvmaze.com")
        return null;
      const imageResponse = await fetch(imageUrl, {
        signal: AbortSignal.timeout(1e4),
      });
      const contentType = imageResponse.headers.get("content-type") || "";
      if (!imageResponse.ok || !contentType.startsWith("image/")) return null;
      const value = {
        body: Buffer.from(await imageResponse.arrayBuffer()),
        contentType: contentType,
      };
      tvMetadataCache.set(key, value);
      return value;
    } catch {
      return null;
    }
  }
  async function liveQueue({ maxAgeMs = 1e4 } = {}) {
    if (
      liveQueueSnapshotAt &&
      Date.now() - liveQueueSnapshotAt <= Math.max(0, Number(maxAgeMs) || 0)
    )
      return liveQueueSnapshot;
    if (liveQueueRun) return liveQueueRun;
    const run = refreshLiveQueue()
      .then((items) => {
        liveQueueSnapshot = items;
        liveQueueSnapshotAt = Date.now();
        return items;
      })
      .finally(() => {
        if (liveQueueRun === run) liveQueueRun = null;
      });
    liveQueueRun = run;
    return run;
  }
  async function refreshLiveQueue() {
    const retentionCutoff = Date.now() - 24 * 60 * 60 * 1e3;
    for (const cache of [
      completedQueueRefreshes,
      completedQueueCleanups,
      completedUpgradeRenames,
      completedLibraryImports,
    ])
      for (const [key, timestamp] of cache)
        if (timestamp < retentionCutoff) cache.delete(key);
    const activitySnapshots = new Map();
    const results = await Promise.all(
      ["movie", "tv"].map(async (domain) => {
        const client = registry.get(domain).client,
          previousSnapshot = operationalEngineSnapshots.get(domain),
          historyFresh =
            previousSnapshot?.historyAt &&
            Date.now() - previousSnapshot.historyAt < 6e4;
        const queueQuery =
          domain === "movie"
            ? { page: 1, pageSize: 500, includeMovie: true }
            : {
                page: 1,
                pageSize: 500,
                includeSeries: true,
                includeEpisode: true,
              };
        const [queueValue, library, historyValue] = await Promise.all([
          client.get("queue", queueQuery),
          sync.list(domain).catch(() => []),
          historyFresh
            ? Promise.resolve({ records: previousSnapshot.history })
            : client
                .get("history", {
                  page: 1,
                  pageSize: 200,
                  sortKey: "date",
                  sortDirection: "descending",
                })
                .catch(() => ({ records: previousSnapshot?.history || [] })),
        ]);
        const engineRecords = Array.isArray(queueValue?.records)
            ? queueValue.records
            : [],
          engineHistory = Array.isArray(historyValue?.records)
            ? historyValue.records
            : [],
          linkedId = (item) =>
            Number(
              domain === "movie"
                ? item.movieId || item.movie?.id
                : item.seriesId || item.series?.id || item.episode?.seriesId,
            ),
          records = engineRecords.filter((item) => {
            const id = linkedId(item);
            return Number.isFinite(id) && id > 0;
          }),
          libraryById = new Map(
            (Array.isArray(library) ? library : []).map((item) => [
              Number(String(item.id).replace(/^(?:movie|series)_/, "")),
              item,
            ]),
          );
        activitySnapshots.set(domain, {
          queue: engineRecords,
          history: engineHistory,
          historyAt: historyFresh
            ? previousSnapshot.historyAt
            : Date.now(),
        });
        const importedHistory = engineHistory.filter(
          (event) =>
            String(event.eventType).toLowerCase() === "downloadfolderimported",
        );
        for (const event of importedHistory)
          queueImportedLibraryReconciliation(domain, event);
        const importedByDownloadId = new Map(),
          importedBySourceTitle = new Map();
        for (const event of importedHistory) {
          const downloadId = String(
              event.downloadId || event.data?.downloadId || "",
            ),
            sourceTitle = String(event.sourceTitle || "").toLowerCase();
          if (downloadId && !importedByDownloadId.has(downloadId))
            importedByDownloadId.set(downloadId, event);
          if (sourceTitle && !importedBySourceTitle.has(sourceTitle))
            importedBySourceTitle.set(sourceTitle, event);
        }
        const importedEvent = (item) => {
          const downloadId = String(
              item.downloadId || item.downloadClientId || "",
            ),
            sourceTitle = String(item.title || "").toLowerCase();
          return downloadId
            ? importedByDownloadId.get(downloadId) || null
            : sourceTitle
              ? importedBySourceTitle.get(sourceTitle) || null
              : null;
        };
        for (const item of records) {
          const mediaId = Number(
            domain === "movie"
              ? item.movieId || item.movie?.id
              : item.seriesId || item.series?.id || item.episode?.seriesId,
          );
          const status = String(
              item.status ||
                item.trackedDownloadStatus ||
                item.trackedDownloadState ||
                "",
            ).toLowerCase(),
            sizeLeft = Number(item.sizeleft ?? item.sizeLeft ?? 0),
            terminal =
              (status === "completed" || status === "complete") &&
              sizeLeft <= 0;
          if (!terminal) continue;
          const confirmedImport = importedEvent(item);
          if (confirmedImport) {
            scheduleImportedUpgradeRename(domain, item, confirmedImport);
            const key = queueRecordKey(domain, item),
              last = completedQueueCleanups.get(key) || 0,
              now = Date.now();
            if (item.id != null && now - last > 30 * 60 * 1e3) {
              completedQueueCleanups.set(key, now);
              void client
                .delete(`queue/${encodeURIComponent(String(item.id))}`, {
                  removeFromClient: true,
                  blocklist: false,
                })
                .catch(() => {});
            }
          } else scheduleCompletedMediaRefresh(domain, item);
        }
        return records
          .filter((item) => !importedEvent(item))
          .map((item) => {
            const engineMediaId = linkedId(item),
              mediaId = engineMediaId,
              media =
                item[domain === "movie" ? "movie" : "series"] ||
                libraryById.get(mediaId) ||
                null,
              size = Number(item.size || 0),
              sizeLeft = Number(item.sizeleft ?? item.sizeLeft ?? 0),
              percentage = size > 0 ? ((size - sizeLeft) / size) * 100 : null;
            return {
              ...item,
              domain: domain,
              media: media,
              mediaId: mediaId,
              clientStatus: item.status || item.trackedDownloadState || null,
              clientFilename: item.title || null,
              clientPercentage: Number.isFinite(percentage) ? percentage : null,
              clientTimeLeft:
                item.timeleft || item.estimatedCompletionTime || null,
              clientSizeLeftMb: Number.isFinite(sizeLeft)
                ? sizeLeft / 1048576
                : null,
              clientSpeed: null,
            };
          });
      }),
    );
    await reconcileSearchActivities(null, activitySnapshots);
    operationalEngineSnapshots = activitySnapshots;
    return results.flat();
  }
  const requestEngineId = (domain, value) =>
    Number(
      domain === "movie"
        ? value.movieId || value.movie?.id
        : value.seriesId || value.series?.id || value.episode?.seriesId,
    );
  const requestHistoryId = (domain, value) =>
    Number(
      domain === "movie"
        ? value.movieId || value.movie?.id
        : value.seriesId || value.series?.id || value.episode?.seriesId,
    );
  const friendlyRequestFailure = (value) => {
    const message = String(value || "").toLowerCase();
    if (message.includes("import"))
      return "The download finished, but the media engine could not import it. An administrator can review the library path and file permissions.";
    if (message.includes("download"))
      return "The download did not complete. An administrator can review the download client and try again.";
    if (message.includes("indexer") || message.includes("release"))
      return "No usable release was found. The media engine will continue checking based on its configured schedule.";
    return "The media engine reported a problem with this request. An administrator can review the engine activity for more detail.";
  };
  const requestMetadata = (metadata) => ({
    metadataVersion: 1,
    poster: metadata.poster || null,
    backdrop: metadata.backdrop || null,
    overview: metadata.overview || "",
    rating: Number(metadata.rating || 0),
    genres: Array.isArray(metadata.genres) ? metadata.genres.slice(0, 8) : [],
    runtime: Number(metadata.runtime || 0) || null,
    certification: metadata.certification || null,
  });
  async function existingLibraryItem(domain, identity,engineInstanceId=null) {
    const value = await management.execute(domain, "library", "GET", {engineInstanceId}),
      items = Array.isArray(value) ? value : value?.records || [];
    const tmdbId = Number(identity.tmdbId || 0),
      tvdbId = Number(identity.tvdbId || 0),
      imdbId = String(identity.imdbId || "").toLowerCase();
    return (
      items.find(
        (item) =>
          (tmdbId && Number(item.tmdbId) === tmdbId) ||
          (domain === "tv" && tvdbId && Number(item.tvdbId) === tvdbId) ||
          (imdbId && String(item.imdbId || "").toLowerCase() === imdbId),
      ) || null
    );
  }
  async function validatedDiscoverRequest(domain, tmdbId, payload) {
    if (
      !["movie", "tv"].includes(domain) ||
      !Number.isInteger(tmdbId) ||
      tmdbId <= 0 ||
      !payload ||
      typeof payload !== "object"
    )
      throw new Error("Choose a valid movie or television title");
    const resolvedPayload = await applyMediaDestination(domain, payload, true),
      metadata = await discovery.details(domain, tmdbId),
      identity = {
        tmdbId: tmdbId,
        tvdbId: metadata.tvdbId,
        imdbId: metadata.imdbId,
      };
    if (!payloadMatchesIdentity(domain, identity, resolvedPayload))
      throw new Error(
        "The engine match does not have the requested external ID. Reopen Discover and try again.",
      );
    const engineInstanceId=String(resolvedPayload.engineInstanceId||'').trim()||null;
    if (await existingLibraryItem(domain, identity,engineInstanceId))
      throw new Error(
        `${metadata.title || "This title"} is already in your library.`,
      );
    const [profiles, roots] = await Promise.all([
      management.execute(domain, "profiles", "GET", {engineInstanceId}),
      management.execute(domain, "rootFolders", "GET", {engineInstanceId}),
    ]);
    if (
      !roots.some(
        (root) => String(root.path) === String(resolvedPayload.rootFolderPath),
      )
    )
      throw new Error("Choose a configured library folder");
    if (
      !profiles.some(
        (profile) => Number(profile.id) === Number(resolvedPayload.qualityProfileId),
      )
    )
      throw new Error("Choose a configured quality profile");
    return { metadata: metadata, payload: resolvedPayload };
  }
  async function addRequestToEngine(record) {
    const { metadata: metadata, payload: payload } =
      await validatedDiscoverRequest(
        record.domain,
        Number(record.tmdbId),
        record.payload,
      );
    const searchRequested =
        record.domain === "movie"
          ? payload.addOptions?.searchForMovie === true
          : televisionAddPayload(payload).addOptions.searchForMissingEpisodes,
      addPayload =
        record.domain === "movie"
          ? {
              ...payload,
              addOptions: {
                ...(payload.addOptions || {}),
                searchForMovie: false,
              },
            }
          : televisionAddPayload({
              ...payload,
              addOptions: {
                ...(payload.addOptions || {}),
                searchForMissingEpisodes: false,
                searchForCutoffUnmetEpisodes: false,
              },
            });
    const engineInstanceId=String(payload.engineInstanceId||record.engineInstanceId||'').trim()||null;
    const result = await management.execute(record.domain, "library", "POST", {
      payload: addPayload,engineInstanceId,
    });
    if (record.domain === "tv" && searchRequested) {
      const command = await management.execute("tv", "commands", "POST", {
        payload: { name: "SeriesSearch", seriesId: result.id },engineInstanceId,
      });
      await createSearchActivity(
        record.userId,
        { name: "SeriesSearch", seriesId: result.id },
        command,
        {
          domain: "tv",
          engineInstanceId,
          source: "request",
          scope: "series",
          title: result.title || metadata.title || record.title,
          status: "searching",
          message:
            "Request added to the library; searching for monitored missing episodes.",
        },
      );
    }
    if (record.domain === "movie" && searchRequested) {
      const query = { movieId: Number(result.id) };
      let grabbed = false;
      try {
        const releases = await management.execute("movie", "releases", "GET", {
            query: query,engineInstanceId,
          }),
          candidates = Array.isArray(releases) ? releases : [],
          accepted = candidates.filter(eligibleRelease);
        await recordDownloadDecisions(record.userId, "movie", query, candidates, {
          source: "request",
        });
        if (accepted.length) {
          accepted.sort(compareReleases);
          const selected = accepted[0],
            grab = await grabReleaseWithImportGuard(
              "movie",
              selected,
              result.id,
              engineInstanceId,
            );
          await recordDownloadDecisions(record.userId, "movie", query, candidates, {
            source: "request",
            selected: releaseIdentity(selected),
          });
          await createSearchActivity(
            record.userId,
            { name: "MoviesSearch", movieIds: [result.id] },
            grab,
            {
              domain: "movie",
              engineInstanceId,
              source: "request",
              scope: "movie",
              movieId: result.id,
              title: result.title || metadata.title || record.title,
              status: "grabbed",
              message:
                "Request added and an accepted release was sent to the download client.",
              selection: {
                title: selected.title,
                quality:
                  selected.quality?.quality?.name ||
                  selected.quality?.name ||
                  "Unknown",
                size: Number(selected.size || 0),
              },
            },
          );
          clearReleaseCache("movie");
          grabbed = true;
        }
      } catch {
        // Older engines may not enumerate releases immediately after a movie is added.
      }
      if (!grabbed) {
        const command = await management.execute("movie", "commands", "POST", {
          payload: { name: "MoviesSearch", movieIds: [result.id] },
          engineInstanceId,
        });
        await createSearchActivity(
          record.userId,
          { name: "MoviesSearch", movieIds: [result.id] },
          command,
          {
            domain: "movie",
            engineInstanceId,
            source: "request",
            scope: "movie",
            movieId: result.id,
            title: result.title || metadata.title || record.title,
            status: "searching",
            message:
              "Request added to the library; searching for an accepted movie release.",
          },
        );
      }
    }
    const updatedAt = new Date().toISOString();
    await requestStore.update((current) => {
      const item = (current.requests || []).find(
        (value) => value.id === record.id,
      );
      if (item)
        Object.assign(item, {
          engineId: Number(result.id),
          title: result.title || metadata.title || item.title,
          year: Number(result.year || metadata.year) || null,
          status: "requested",
          approvedAt: updatedAt,
          updatedAt: updatedAt,
          ...requestMetadata(metadata),
          payload: undefined,
        });
    });
    const publicId = `${record.domain === "movie" ? "movie" : "series"}_${engineInstanceId?`${engineInstanceId}_`:""}${Number(result.id)}`;
    try {
      let reconciliation = await sync.reconcileItem(record.domain, publicId);
      if (!reconciliation.item) {
        sync.invalidate(record.domain);
        const items = await sync.synchronize(record.domain);
        reconciliation = {
          item: items.find((item) => item.id === publicId) || null,
        };
      }
      broadcastLibraryEvent({
        domain: record.domain,
        items: reconciliation.item ? [reconciliation.item] : [],
        updatedAt: new Date().toISOString(),
      });
    } catch {}
    return result;
  }
  async function liveUserRequests(userId = null) {
    const stored = await requestStore.read();
    let owned = (stored.requests || []).filter(
      (item) => userId == null || item.userId === userId,
    );
    const legacy = owned.filter(
      (item) =>
        item.metadataVersion !== 1 &&
        ["movie", "tv"].includes(item.domain) &&
        Number.isInteger(Number(item.tmdbId)),
    );
    if (legacy.length && discovery.configured()) {
      const enriched = new Map(
        (
          await Promise.all(
            legacy.map(async (item) => [
              item.id,
              await discovery
                .details(item.domain, Number(item.tmdbId))
                .then(requestMetadata)
                .catch(() => null),
            ]),
          )
        ).filter(([, value]) => value),
      );
      if (enriched.size) {
        await requestStore.update((current) => {
          for (const item of current.requests || []) {
            const metadata = enriched.get(item.id);
            if (metadata) Object.assign(item, metadata);
          }
        });
        owned = owned.map((item) =>
          enriched.has(item.id) ? { ...item, ...enriched.get(item.id) } : item,
        );
      }
    }
    const domains = [
      ...new Set(
        owned
          .filter((item) => Number.isFinite(Number(item.engineId)))
          .map((item) => item.domain)
          .filter((domain) => ["movie", "tv"].includes(domain)),
      ),
    ];
    if (mode === "engine" && domains.length)
      await liveQueue({ maxAgeMs: 3e4 }).catch(() => []);
    const snapshots = new Map(
      await Promise.all(
        domains.map(async (domain) => {
          const libraryResult = await sync
              .list(domain)
              .then((value) => ({ available: true, value: value }))
              .catch(() => ({ available: false, value: [] })),
            operational = operationalEngineSnapshots.get(domain) || {};
          return [
            domain,
            {
              available: libraryResult.available,
              library: new Map(
                (Array.isArray(libraryResult.value)
                  ? libraryResult.value
                  : []
                ).map((item) => {
                  const ownedId=decodeOwnedMediaId(domain,String(item.id).replace(/^(?:movie|series)_/, ""));
                  return[`${ownedId.engineInstanceId||item.engineInstanceId||"default"}:${Number(ownedId.id)}`,item];
                }),
              ),
              queue: Array.isArray(operational.queue)
                ? operational.queue
                : [],
              history: Array.isArray(operational.history)
                ? operational.history
                : [],
            },
          ];
        }),
      ),
    );
    return owned
      .map((record) => {
        if (record.status === "pending_approval")
          return {
            ...record,
            payload: undefined,
            status: "pending_approval",
            statusLabel: "Awaiting approval",
            message:
              "An administrator must approve this request before it is added to the media engine.",
            canCorrect: true,
            canCancel: true,
            canApprove: true,
            canReject: true,
          };
        if (record.status === "approving")
          return {
            ...record,
            payload: undefined,
            status: "pending_approval",
            statusLabel: "Approval in progress",
            message:
              "This request is being validated and added to the media engine.",
            canCorrect: false,
            canCancel: false,
            canApprove: false,
            canReject: false,
          };
        if (
          record.status === "canceled" ||
          (record.status === "rejected" &&
            !record.rejectedBy &&
            /^You cancelled this request/i.test(String(record.message || "")))
        )
          return {
            ...record,
            payload: undefined,
            status: "canceled",
            statusLabel: "Cancelled by user",
            message: "This request was cancelled by the user.",
            rejectionReason: null,
            canCorrect: false,
            canCancel: false,
          };
        if (record.status === "rejected")
          return {
            ...record,
            payload: undefined,
            status: "rejected",
            statusLabel: "Rejected",
            message:
              record.message ||
              "This request was cancelled before it was imported.",
            rejectionReason: record.rejectionReason || null,
            canCorrect: false,
            canCancel: false,
          };
        const snapshot = snapshots.get(record.domain),
          engineId = Number(record.engineId),
          owner=String(record.engineInstanceId||engineSettings.public().instances.find(item=>item.domain===record.domain&&item.isDefault)?.id||"default"),
          media = snapshot?.library.get(`${owner}:${engineId}`);
        if (!snapshot?.available)
          return {
            ...record,
            payload: undefined,
            status: "requested",
            statusLabel: "Status unavailable",
            message:
              "The media engine is temporarily unavailable. Your request is still recorded and its status will update when the connection returns.",
            canCorrect: false,
            canCancel: false,
          };
        const queued = snapshot?.queue.find(
          (item) => requestEngineId(record.domain, item) === engineId&&String(item.engineInstanceId||"default")===owner,
        );
        const relatedHistory = (snapshot?.history || []).filter(
          (item) => requestHistoryId(record.domain, item) === engineId&&String(item.engineInstanceId||"default")===owner,
        );
        const failed = relatedHistory.find((item) =>
          String(item.eventType || "")
            .toLowerCase()
            .includes("failed"),
        );
        const imported =
          record.domain === "movie"
            ? Boolean(media?.hasFile || media?.movieFile)
            : Number(media?.statistics?.episodeFileCount || 0) > 0;
        let status = "requested",
          statusLabel = "Requested",
          message =
            "The request is waiting for the media engine to find an eligible release.";
        if (!media) {
          status = "rejected";
          statusLabel = "Rejected";
          message = "This title is no longer in the media engine library.";
        } else if (imported) {
          status = "imported";
          statusLabel = "Imported";
          message = "The requested title has been imported into the library.";
        } else if (queued) {
          const queueState = String(
            queued.status ||
              queued.trackedDownloadStatus ||
              queued.trackedDownloadState ||
              "",
          ).toLowerCase();
          if (/fail|warning|error/.test(queueState)) {
            status = "failed";
            statusLabel = "Needs attention";
            message = friendlyRequestFailure(queueState);
          } else {
            status = "downloading";
            statusLabel = "Downloading";
            message = "A release was found and is being downloaded.";
          }
        } else if (failed) {
          status = "failed";
          statusLabel = "Needs attention";
          message = friendlyRequestFailure(
            failed.eventType || failed.data?.message,
          );
        } else if (
          Date.now() - new Date(record.requestedAt).getTime() < 10 * 60 * 1e3 &&
          record.searchNow !== false
        ) {
          status = "searching";
          statusLabel = "Searching";
          message =
            "The media engine is checking configured sources for an eligible release.";
        }
        const pending = status === "requested" || status === "searching";
        return {
          ...record,
          payload: undefined,
          status: status,
          statusLabel: statusLabel,
          message: message,
          canCorrect: pending,
          canCancel: pending,
          canApprove: false,
          canReject: false,
        };
      })
      .sort((left, right) =>
        String(right.requestedAt).localeCompare(String(left.requestedAt)),
      );
  }
  async function requestAllowance(user) {
    const policy =
      user.role === "administrator"
        ? {
            enabled: false,
            period: "weekly",
            movie: null,
            tv: null,
            maxPending: null,
          }
        : user.requestLimits || {
            enabled: false,
            period: "weekly",
            movie: null,
            tv: null,
            maxPending: null,
          };
    if (!policy.enabled)
      return {
        enabled: false,
        period: policy.period || "weekly",
        movie: { limit: null, used: 0, remaining: null },
        tv: { limit: null, used: 0, remaining: null },
        pending: { limit: null, used: 0, remaining: null },
      };
    const now = new Date(),
      start = new Date(now);
    if (policy.period === "daily") start.setUTCHours(0, 0, 0, 0);
    else if (policy.period === "monthly") {
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
    } else {
      const day = (start.getUTCDay() + 6) % 7;
      start.setUTCDate(start.getUTCDate() - day);
      start.setUTCHours(0, 0, 0, 0);
    }
    const stored = await requestStore.read(),
      owned = (stored.requests || []).filter((item) => item.userId === user.id),
      recent = owned.filter(
        (item) =>
          new Date(item.requestedAt) >= start &&
          item.status !== "canceled" &&
          !(
            item.status === "rejected" &&
            !item.rejectedBy &&
            /^You cancelled this request/i.test(String(item.message || ""))
          ),
      );
    const live = policy.maxPending ? await liveUserRequests(user.id) : [],
      pendingUsed = live.filter((item) =>
        ["pending_approval", "requested", "searching", "downloading"].includes(
          item.status,
        ),
      ).length;
    const allowance = (domain) => {
      const limit = Number(policy[domain]) || null,
        used = recent.filter((item) => item.domain === domain).length;
      return {
        limit: limit,
        used: used,
        remaining: limit == null ? null : Math.max(0, limit - used),
      };
    };
    const pendingLimit = Number(policy.maxPending) || null;
    return {
      enabled: true,
      period: policy.period,
      startAt: start.toISOString(),
      movie: allowance("movie"),
      tv: allowance("tv"),
      pending: {
        limit: pendingLimit,
        used: pendingUsed,
        remaining:
          pendingLimit == null ? null : Math.max(0, pendingLimit - pendingUsed),
      },
    };
  }
  async function persistNotificationEvents(
    recipientUserId,
    events,
    {
      activeGroups: activeGroups = [],
      suppressExternalIds: suppressExternalIds = new Set(),
    } = {},
  ) {
    const now = new Date().toISOString(),
      activeIds = new Set(events.map((item) => item.id)),
      added = [];
    await notificationStore.update((current) => {
      current.version = 1;
      current.events = Array.isArray(current.events) ? current.events : [];
      for (const item of events) {
        const existing = current.events.find(
          (value) =>
            value.recipientUserId === recipientUserId && value.id === item.id,
        );
        if (existing) Object.assign(existing, item, { updatedAt: now });
        else {
          const created = {
            ...item,
            recipientUserId: recipientUserId,
            createdAt: now,
            updatedAt: now,
          };
          current.events.push(created);
          added.push(created);
        }
      }
      for (const existing of current.events)
        if (
          existing.recipientUserId === recipientUserId &&
          existing.actionable &&
          activeGroups.includes(existing.eventGroup) &&
          !activeIds.has(existing.id)
        )
          Object.assign(existing, {
            actionable: false,
            resolvedAt: now,
            updatedAt: now,
            message: `Resolved · ${existing.message}`,
          });
      current.events = current.events
        .sort((left, right) =>
          String(right.timestamp).localeCompare(String(left.timestamp)),
        )
        .slice(0, 2e3);
      return events.length;
    });
    const deliverable = added.filter(
      (item) => !suppressExternalIds.has(item.id),
    );
    if (deliverable.length)
      void deliverExternalNotifications(recipientUserId, deliverable).catch(
        () => {},
      );
  }
  async function synchronizeOperationalNotifications(session) {
    if (session.user.role !== "administrator") return;
    const stored = await notificationStore.read(),
      cycleStartedAt = new Date().toISOString(),
      firstRun = !stored.operationalInitializedAt,
      since = stored.operationalInitializedAt || cycleStartedAt,
      grabDeliveryInitialized = Boolean(
        stored.operationalGrabDeliveryInitializedAt,
      ),
      events = [],
      suppressExternalIds = new Set(),
      activeGroups = ["queue-problem", "engine-health", "search-no-result"];
    if (firstRun)
      await notificationStore.update(
        (current) => (current.operationalInitializedAt = since),
      );
    if (mode === "engine")
      await liveQueue({ maxAgeMs: 3e4 }).catch(() => []);
    const domainValues =
      mode === "engine"
        ? ["movie", "tv"].map((domain) => {
            const snapshot = operationalEngineSnapshots.get(domain) || {};
            return {
              domain: domain,
              queue: Array.isArray(snapshot.queue) ? snapshot.queue : [],
              history: Array.isArray(snapshot.history) ? snapshot.history : [],
            };
          })
        : [];
    for (const {
      domain: domain,
      queue: queue,
      history: history,
    } of domainValues) {
      await recordEngineDownloadDecisions(session.user.id, domain, history);
      await recordEngineSearchActivities(
        session.user.id,
        domain,
        queue,
        history,
      );
      for (const item of queue) {
        const status = String(
            item.trackedDownloadStatus ||
              item.trackedDownloadState ||
              item.status ||
              "",
          ).toLowerCase(),
          problem =
            /fail|error|warning|stalled|unavailable/.test(status) ||
            Boolean(item.errorMessage);
        if (!problem) continue;
        const identity = String(item.id || item.downloadId || item.title),
          title =
            item[domain === "movie" ? "movie" : "series"]?.title ||
            item.title ||
            `${domain === "movie" ? "Movie" : "Television"} download`;
        events.push({
          id: `operational:queue:${domain}:${identity}`,
          eventGroup: "queue-problem",
          category: "download",
          severity: "critical",
          type: "failed",
          title: `${title} needs download attention`,
          message:
            item.errorMessage ||
            item.statusMessages?.[0]?.messages?.[0] ||
            "The download is stalled or the media engine reported a queue problem.",
          timestamp: item.added || item.addedAt || new Date().toISOString(),
          href: "#queue",
          requestId: "",
          actionable: true,
        });
      }
      for (const item of history) {
        const timestamp = item.date || item.timestamp || item.createdAt;
        if (!timestamp) continue;
        const eventType = String(item.eventType || "").toLowerCase(),
          imported = /import/.test(eventType),
          failed = /fail/.test(eventType),
          grabbed = /grab/.test(eventType);
        if (!imported && !failed && !grabbed) continue;
        if (!grabbed && (firstRun || new Date(timestamp) < new Date(since)))
          continue;
        if (
          grabbed &&
          grabDeliveryInitialized &&
          new Date(timestamp) < new Date(since)
        )
          continue;
        const title =
            item.movie?.title ||
            item.series?.title ||
            item.sourceTitle ||
            item.title ||
            `${domain === "movie" ? "Movie" : "Television"} item`,
          type = imported ? "imported" : failed ? "failed" : "grabbed",
          id = `operational:history:${domain}:${item.id || createHash("sha1").update(`${eventType}:${title}:${timestamp}`).digest("hex")}`;
        events.push({
          id: id,
          eventGroup: "history-event",
          category: imported ? "import" : "download",
          severity: imported ? "success" : failed ? "critical" : "information",
          type: type,
          title: imported
            ? `${title} was imported`
            : failed
              ? `${title} failed`
              : `${title} was grabbed`,
          message: imported
            ? "The media engine confirmed this media is now in the library."
            : failed
              ? friendlyRequestFailure(item.eventType || item.data?.message)
              : "The media engine selected a release during background RSS or scheduled automation.",
          timestamp: timestamp,
          href: "#history",
          requestId: "",
          actionable: failed,
        });
        if (grabbed && !grabDeliveryInitialized) suppressExternalIds.add(id);
      }
    }
    const health =
      mode === "engine" ? await sync.operations("health").catch(() => []) : [];
    for (const item of Array.isArray(health) ? health : []) {
      const message = String(
          item.message || item.details || item.source || "Engine health issue",
        ),
        identity = createHash("sha1")
          .update(`${item.domain || ""}:${item.source || ""}:${message}`)
          .digest("hex");
      events.push({
        id: `operational:health:${identity}`,
        eventGroup: "engine-health",
        category: "system",
        severity: "warning",
        type: "failed",
        title: `${item.domain === "tv" ? "Television" : item.domain === "movie" ? "Movies" : "Media engine"} needs attention`,
        message: message,
        timestamp: item.timestamp || new Date().toISOString(),
        href: "#service/library-health",
        requestId: "",
        actionable: true,
      });
    }
    const activity = await searchActivityStore.read();
    for (const item of activity.activities || [])
      if (
        item.status === "completed" &&
        Date.now() - new Date(item.updatedAt || item.createdAt).getTime() <
          7 * 24 * 60 * 60 * 1e3
      )
        events.push({
          id: `operational:search:${item.id}`,
          eventGroup: "search-no-result",
          category: "download",
          severity: "warning",
          type: "failed",
          title: `No download found for ${item.title}`,
          message:
            "The automatic search completed without a matching release entering Queue or History.",
          timestamp: item.updatedAt || item.createdAt,
          href: "#wanted",
          requestId: "",
          actionable: true,
        });
    await persistNotificationEvents(session.user.id, events, {
      activeGroups: activeGroups,
      suppressExternalIds: suppressExternalIds,
    });
    await notificationStore.update((current) => {
      current.operationalInitializedAt = cycleStartedAt;
      current.operationalGrabDeliveryInitializedAt =
        current.operationalGrabDeliveryInitializedAt || cycleStartedAt;
      return cycleStartedAt;
    });
  }
  async function synchronizeAdministratorOperationalNotifications() {
    const users = await auth.listUsers(),
      administrator = users.find(
        (user) => user.role === "administrator" && user.enabled !== false,
      );
    if (!administrator) return;
    await synchronizeOperationalNotifications({ user: administrator });
  }
  async function requestNotifications(session) {
    await synchronizeOperationalNotifications(session);
    const administratorUser = session.user.role === "administrator",
      records = await liveUserRequests(
        administratorUser ? null : session.user.id,
      ),
      items = [];
    if (administratorUser) {
      const users = new Map(
        (await auth.listUsers()).map((user) => [user.id, user]),
      );
      for (const record of records.filter(
        (item) =>
          item.status === "pending_approval" ||
          item.approvedBy ||
          item.rejectedBy,
      )) {
        const user = users.get(record.userId),
          name = user?.name || user?.username || "A user";
        const pending = record.status === "pending_approval",
          approved = Boolean(record.approvedBy);
        items.push({
          id: `approval:${record.id}`,
          category: "request",
          severity: pending ? "warning" : approved ? "success" : "information",
          type: pending ? "approval" : approved ? "approved" : "rejected",
          title: pending
            ? `${name} requested ${record.title}`
            : `${record.title} was ${approved ? "approved" : "declined"}`,
          message: pending
            ? `Review and decide whether to add this ${record.domain === "movie" ? "movie" : "television series"}.`
            : `${name}'s request was ${approved ? "approved and added to the media engine" : "declined"}.`,
          timestamp: record.requestedAt,
          href: "#request-management",
          requestId: record.id,
          actionable: pending,
        });
      }
    } else {
      for (const record of records) {
        if (record.approvedBy)
          items.push({
            id: `approved:${record.id}`,
            category: "request",
            severity: "success",
            type: "approved",
            title: `${record.title} was approved`,
            message:
              "An administrator approved your request and added it to the media engine.",
            timestamp:
              record.approvedAt || record.updatedAt || record.requestedAt,
            href: "#requests",
            requestId: record.id,
            actionable: false,
          });
        if (record.status === "rejected")
          items.push({
            id: `rejected:${record.id}`,
            category: "request",
            severity: "information",
            type: "rejected",
            title: `${record.title} was declined`,
            message:
              record.rejectionReason ||
              record.message ||
              "An administrator declined this request.",
            timestamp:
              record.rejectedAt || record.updatedAt || record.requestedAt,
            href: "#requests",
            requestId: record.id,
            actionable: false,
          });
        if (record.status === "failed")
          items.push({
            id: `failed:${record.id}`,
            category: "request",
            severity: "critical",
            type: "failed",
            title: `${record.title} needs attention`,
            message:
              record.message ||
              "The media engine reported a problem with this request.",
            timestamp: record.updatedAt || record.requestedAt,
            href: "#requests",
            requestId: record.id,
            actionable: true,
          });
        if (record.status === "imported")
          items.push({
            id: `imported:${record.id}`,
            category: "request",
            severity: "success",
            type: "imported",
            title: `${record.title} is ready`,
            message:
              "Your requested title has finished importing into the library.",
            timestamp: record.updatedAt || record.requestedAt,
            href: "#requests",
            requestId: record.id,
            actionable: false,
          });
      }
    }
    await persistNotificationEvents(session.user.id, items);
    const [stored, legacy] = await Promise.all([
        notificationStore.read(),
        requestStore.read(),
      ]),
      reads = {
        ...(legacy.notificationReads?.[session.user.id] || {}),
        ...(stored.reads?.[session.user.id] || {}),
      };
    const dismissed = stored.dismissed?.[session.user.id] || {};
    return (stored.events || [])
      .filter((item) => item.recipientUserId === session.user.id)
      .filter((item) => !dismissed[item.id])
      .sort((left, right) =>
        String(right.timestamp).localeCompare(String(left.timestamp)),
      )
      .slice(0, 100)
      .map(({ recipientUserId: recipientUserId, ...item }) => ({
        ...item,
        read: Boolean(reads[item.id]),
      }));
  }
  const notificationPreferenceDefaults = {
    inApp: true,
    categories: {
      request: true,
      download: true,
      import: true,
      system: true,
      security: true,
    },
    minimumSeverity: "information",
    quietHours: { enabled: false, start: 22, end: 7 },
  };
  const sanitizeNotificationPreferences = (value) => {
    const source = value && typeof value === "object" ? value : {},
      categories =
        source.categories && typeof source.categories === "object"
          ? source.categories
          : {},
      quiet =
        source.quietHours && typeof source.quietHours === "object"
          ? source.quietHours
          : {};
    return {
      inApp: source.inApp !== false,
      categories: Object.fromEntries(
        Object.keys(notificationPreferenceDefaults.categories).map((key) => [
          key,
          categories[key] !== false,
        ]),
      ),
      minimumSeverity: ["information", "warning", "critical"].includes(
        source.minimumSeverity,
      )
        ? source.minimumSeverity
        : "information",
      quietHours: {
        enabled: Boolean(quiet.enabled),
        start: Math.min(23, Math.max(0, Number(quiet.start) || 0)),
        end: Math.min(23, Math.max(0, Number(quiet.end) || 0)),
      },
    };
  };
  async function notificationPreferences(userId) {
    const stored = await notificationStore.read(),
      defaults = sanitizeNotificationPreferences(
        stored.preferences?.defaults || notificationPreferenceDefaults,
      ),
      user = stored.preferences?.users?.[userId];
    return {
      defaults: defaults,
      preferences: sanitizeNotificationPreferences(
        user
          ? {
              ...defaults,
              ...user,
              categories: { ...defaults.categories, ...user.categories },
              quietHours: { ...defaults.quietHours, ...user.quietHours },
            }
          : defaults,
      ),
      overridden: Boolean(user),
    };
  }
  const notificationQuietNow = (preferences) => {
    if (!preferences.quietHours.enabled) return false;
    const hour = new Date().getUTCHours(),
      { start: start, end: end } = preferences.quietHours;
    return start === end || start < end
      ? hour >= start && hour < end
      : hour >= start || hour < end;
  };
  const filterNotifications = (items, preferences) => {
    if (!preferences.inApp) return [];
    const rank = { information: 0, success: 0, warning: 1, critical: 2 },
      minimum = rank[preferences.minimumSeverity] || 0;
    return items.filter(
      (item) =>
        preferences.categories[item.category || "system"] !== false &&
        (rank[item.severity || "information"] || 0) >= minimum,
    );
  };
  const defaultChannelTemplate = {
    title: "{title}",
    message: "{message}",
    includeLink: true,
    accentColor: "#7c5cff",
    priority: 5,
    json: "",
  };
  const sanitizeChannelTemplate = (value) => {
    const source = value && typeof value === "object" ? value : {},
      priority = Number(source.priority);
    return {
      title: String(source.title || defaultChannelTemplate.title).slice(0, 300),
      message: String(source.message || defaultChannelTemplate.message).slice(
        0,
        3e3,
      ),
      includeLink: source.includeLink !== false,
      accentColor: /^#[0-9a-f]{6}$/i.test(String(source.accentColor || ""))
        ? String(source.accentColor)
        : defaultChannelTemplate.accentColor,
      priority: Number.isFinite(priority)
        ? Math.min(10, Math.max(0, priority))
        : defaultChannelTemplate.priority,
      json: String(source.json || "").slice(0, 12e3),
    };
  };
  const notificationTokens = (event) => ({
    title: String(event.title || ""),
    message: String(event.message || ""),
    category: String(event.category || "activity"),
    severity: String(event.severity || "information"),
    timestamp: String(event.timestamp || new Date().toISOString()),
    link: String(event.href || ""),
  });
  const renderNotificationText = (value, event) => {
    const tokens = notificationTokens(event);
    return String(value || "").replace(
      /\{(title|message|category|severity|timestamp|link)\}/g,
      (_, key) => tokens[key],
    );
  };
  function renderNotificationJson(value, event, depth = 0) {
    if (depth > 8)
      throw new Error("Custom notification JSON is too deeply nested");
    if (Array.isArray(value))
      return value
        .slice(0, 100)
        .map((item) => renderNotificationJson(item, event, depth + 1));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([key]) => !["__proto__", "prototype", "constructor"].includes(key),
          )
          .slice(0, 100)
          .map(([key, item]) => [
            key,
            renderNotificationJson(item, event, depth + 1),
          ]),
      );
    return typeof value === "string"
      ? renderNotificationText(value, event)
      : value;
  }
  const channelPayload = (channel, event) => {
    const template = sanitizeChannelTemplate(channel.template),
      link = template.includeLink && event.href ? `\n${event.href}` : "",
      title = renderNotificationText(template.title, event),
      message = `${renderNotificationText(template.message, event)}${link}`;
    if (template.json) {
      let custom;
      try {
        custom = JSON.parse(template.json);
      } catch {
        throw new Error("Custom notification JSON is invalid");
      }
      if (!custom || Array.isArray(custom) || typeof custom !== "object")
        throw new Error("Custom notification JSON must be an object");
      return {
        title: title,
        message: message,
        priority: template.priority,
        payload: renderNotificationJson(custom, event),
      };
    }
    return {
      title: title,
      message: message,
      priority: template.priority,
      payload: null,
    };
  };
  const pushoverCredential = (value) => {
    try {
      const parsed = JSON.parse(value);
      return {
        token: String(parsed.token || ""),
        userKey: String(parsed.userKey || ""),
        encryptionKey: String(parsed.encryptionKey || ""),
      };
    } catch {
      return { token: String(value || ""), userKey: "", encryptionKey: "" };
    }
  };
  const encryptPushoverField = async (value, keyHex) => {
    const key = Buffer.from(keyHex, "hex"),
      compressed = await gzipAsync(Buffer.from(String(value || ""), "utf8")),
      iv = randomBytes(16),
      cipher = createCipheriv("aes-256-cbc", key, iv),
      encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]),
      signed = Buffer.concat([iv, encrypted]),
      mac = createHmac("sha256", key).update(signed).digest();
    return Buffer.concat([signed, mac]).toString("base64");
  };
  async function sendExternalNotification(channel, event) {
    const credential = await engineSettings.notificationCredential(channel.id),
      rendered = channelPayload(channel, event);
    if (!credential) throw new Error("Credential is not configured");
    let response;
    if (channel.type === "discord") {
      if (
        !/^https:\/\/(?:[^/]+\.)?(?:discord\.com|discordapp\.com)\/api\/webhooks\//i.test(
          credential,
        )
      )
        throw new Error("Enter a valid Discord webhook URL");
      const color = Number.parseInt(
        sanitizeChannelTemplate(channel.template).accentColor.slice(1),
        16,
      );
      response = await fetch(credential, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          rendered.payload || {
            embeds: [
              {
                title: rendered.title.slice(0, 256),
                description: rendered.message.slice(0, 4096),
                color: color,
              },
            ],
          },
        ),
        signal: AbortSignal.timeout(1e4),
      });
    } else if (channel.type === "telegram") {
      response = await fetch(
        `https://api.telegram.org/bot${credential}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            rendered.payload
              ? { ...rendered.payload, chat_id: channel.chatId }
              : {
                  chat_id: channel.chatId,
                  text: `${rendered.title}\n${rendered.message}`,
                },
          ),
          signal: AbortSignal.timeout(1e4),
        },
      );
    } else if (channel.type === "gotify") {
      const endpoint = String(channel.endpoint || "").replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(endpoint))
        throw new Error("Enter a valid Gotify server URL");
      response = await fetch(
        `${endpoint}/message?token=${encodeURIComponent(credential)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            rendered.payload || {
              title: rendered.title,
              message: rendered.message,
              priority: rendered.priority,
            },
          ),
          signal: AbortSignal.timeout(1e4),
        },
      );
    } else if (channel.type === "pushover") {
      const secret = pushoverCredential(credential);
      if (!secret.token || !secret.userKey)
        throw new Error("Pushover application token and user key are required");
      let title = rendered.title,
        message = rendered.message;
      const form = new URLSearchParams({
        token: secret.token,
        user: secret.userKey,
        title: title,
        message: message,
        priority: String(channel.pushoverPriority ?? 0),
      });
      if (secret.encryptionKey) {
        title = await encryptPushoverField(title, secret.encryptionKey);
        message = await encryptPushoverField(message, secret.encryptionKey);
        form.set("title", title);
        form.set("message", message);
        form.set("encrypted", "1");
      }
      if (channel.devices?.length)
        form.set("device", channel.devices.join(","));
      if (Number(channel.pushoverPriority) === 2) {
        form.set("retry", String(channel.retry || 60));
        form.set("expire", String(channel.expire || 3600));
      }
      if (Number(channel.ttl) > 0) form.set("ttl", String(channel.ttl));
      if (channel.sound) form.set("sound", channel.sound);
      response = await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form,
        signal: AbortSignal.timeout(1e4),
      });
    } else throw new Error("Unsupported notification provider");
    if (!response.ok)
      throw new Error(`${channel.type} returned HTTP ${response.status}`);
    return true;
  }
  async function recordExternalDelivery(
    channel,
    event,
    status,
    error = "",
    attempt = 1,
  ) {
    const value = {
      id: `delivery_${randomUUID()}`,
      channelId: channel.id,
      channelName: channel.name,
      type: channel.type,
      eventId: event.id,
      title: event.title,
      status: status,
      error: String(error || "").slice(0, 300),
      attempt: attempt,
      timestamp: new Date().toISOString(),
    };
    await notificationStore.update((current) => {
      current.deliveries = [value, ...(current.deliveries || [])].slice(0, 200);
    });
    return value;
  }
  async function deliverExternalNotifications(recipientUserId, events) {
    const stored = await notificationStore.read(),
      channels = (stored.channels || []).filter(
        (item) => item.enabled !== false,
      ),
      preferenceValue = await notificationPreferences(recipientUserId);
    if (notificationQuietNow(preferenceValue.preferences)) return;
    for (const event of filterNotifications(events, {
      ...preferenceValue.preferences,
      inApp: true,
    }))
      for (const channel of channels)
        if ((channel.categories || []).includes(event.category || "system"))
          try {
            await sendExternalNotification(channel, event);
            await recordExternalDelivery(channel, event, "delivered");
          } catch (error) {
            await recordExternalDelivery(
              channel,
              event,
              "failed",
              error instanceof Error ? error.message : String(error),
            );
          }
  }
  function requestLimitMessage(allowance, domain) {
    if (allowance.pending.limit != null && allowance.pending.remaining === 0)
      return `You already have ${allowance.pending.used} pending requests. Wait for one to complete or ask an administrator to update your limit.`;
    const value = allowance[domain];
    if (value.limit != null && value.remaining === 0)
      return `You have reached your ${allowance.period} ${domain === "movie" ? "movie" : "television"} request limit of ${value.limit}.`;
    return "";
  }
  async function dashboardHistory(days = 30) {
    if (mode !== "engine") return sync.operations("history");
    if (dashboardHistorySnapshot && dashboardHistoryExpires > Date.now())
      return dashboardHistorySnapshot;
    if (!dashboardHistoryRun)
      dashboardHistoryRun = (async () => {
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        start.setUTCDate(start.getUTCDate() - (days - 1));
        const results = await Promise.all(
          ["movie", "tv"].map(async (domain) => {
            const adapter = registry.get(domain);
            return typeof adapter.getHistorySince === "function"
              ? adapter.getHistorySince({ since: start })
              : adapter.getHistory({ limit: 5e3 });
          }),
        );
        return results
          .flat()
          .sort((left, right) =>
            String(right.timestamp).localeCompare(String(left.timestamp)),
          );
      })();
    try {
      dashboardHistorySnapshot = await dashboardHistoryRun;
      dashboardHistoryExpires = Date.now() + 5 * 6e4;
      return dashboardHistorySnapshot;
    } finally {
      dashboardHistoryRun = null;
    }
  }
  function resolveCollectionMembers(collection, movies) {
    if (collection.type !== "smart")
      return (collection.movieIds || [])
        .map((id) => movies.find((movie) => movie.id === id))
        .filter(Boolean);
    const rules = collection.rules || {
        titleContains: collection.titleContains || "",
      },
      title = String(rules.titleContains || "")
        .trim()
        .toLowerCase(),
      genres = (rules.genres || []).map((value) => String(value).toLowerCase()),
      year = Number(rules.year || 0),
      decade = Number(rules.decade || 0),
      libraryCollection = String(rules.collection || ""),
      monitoring = String(rules.monitoring || ""),
      availability = String(rules.availability || "");
    const matches = movies.filter(
      (movie) =>
        (!title || movie.title.toLowerCase().includes(title)) &&
        (!genres.length ||
          genres.every((genre) =>
            (movie.genres || []).some(
              (value) => String(value).toLowerCase() === genre,
            ),
          )) &&
        (!year || movie.year === year) &&
        (!decade || (movie.year >= decade && movie.year < decade + 10)) &&
        (!libraryCollection || movie.collection === libraryCollection) &&
        (!monitoring ||
          (monitoring === "monitored"
            ? movie.monitoring !== "none"
            : movie.monitoring === "none")) &&
        (!availability ||
          (availability === "available" ? movie.hasFile : !movie.hasFile)),
    );
    const excluded = new Set((collection.excludedMovieIds || []).map(String)),
      included = new Set((collection.includedMovieIds || []).map(String)),
      ids = new Set(
        matches
          .filter((movie) => !excluded.has(movie.id))
          .map((movie) => movie.id),
      );
    for (const id of included) ids.add(id);
    return [...ids]
      .map((id) => movies.find((movie) => movie.id === id))
      .filter(Boolean);
  }
  const collectionMediaId = (domain, value) =>
    String(value ?? "").replace(
      domain === "movie" ? /^movie_/ : /^series_/,
      "",
    );
  const resolveCollectionMedia = (domain, library, candidate = {}) => {
    const mediaId = collectionMediaId(
        domain,
        candidate.engineId ?? candidate.mediaId,
      ),
      tmdbId = String(candidate.tmdbId || ""),
      tvdbId = String(candidate.tvdbId || ""),
      title = String(candidate.title || "")
        .trim()
        .toLowerCase(),
      year = Number(candidate.year || 0);
    const external =
      domain === "movie"
        ? tmdbId && library.find((item) => String(item.tmdbId || "") === tmdbId)
        : (tvdbId &&
            library.find((item) => String(item.tvdbId || "") === tvdbId)) ||
          (tmdbId &&
            library.find((item) => String(item.tmdbId || "") === tmdbId));
    return (
      external ||
      (mediaId &&
        library.find(
          (item) => collectionMediaId(domain, item.id) === mediaId,
        )) ||
      library.find(
        (item) =>
          title &&
          String(item.title || "")
            .trim()
            .toLowerCase() === title &&
          (!year || Number(item.year || 0) === year),
      )
    );
  };
  const sameCollectionMedia = (domain, left, right) =>
    domain === "movie" && left.tmdbId && right.tmdbId
      ? String(left.tmdbId) === String(right.tmdbId)
      : domain === "tv" && left.tvdbId && right.tvdbId
        ? String(left.tvdbId) === String(right.tvdbId)
        : domain === "tv" && left.tmdbId && right.tmdbId
          ? String(left.tmdbId) === String(right.tmdbId)
          : collectionMediaId(domain, left.engineId ?? left.mediaId) ===
            collectionMediaId(domain, right.engineId ?? right.mediaId);
  async function userRequestCollections(session) {
    const [stored, users, movies, television] = await Promise.all([
        requestStore.read(),
        auth.listUsers(),
        sync.list("movie"),
        sync.list("tv"),
      ]),
      userMap = new Map(users.map((user) => [user.id, user])),
      libraries = { movie: movies, tv: television },
      preferences = stored.collectionPreferences || {},
      allUserIds = new Set([
        ...users.map((user) => user.id),
        ...(stored.requests || []).map((item) => item.userId),
        ...(stored.interests || []).map((item) => item.userId),
      ]),
      visibleUserIds =
        session.user.role === "administrator"
          ? allUserIds
          : new Set(
              [...allUserIds].filter(
                (userId) =>
                  userId === session.user.id ||
                  preferences[userId]?.visibility === "household" ||
                  (preferences[userId]?.visibility === "specific" &&
                    (preferences[userId]?.sharedWith || []).includes(
                      session.user.id,
                    )),
              ),
            ),
      groups = new Map();
    const add = (record, source) => {
      if (
        !visibleUserIds.has(record.userId) ||
        !["movie", "tv"].includes(record.domain)
      )
        return;
      const item = resolveCollectionMedia(
        record.domain,
        libraries[record.domain] || [],
        record,
      );
      if (!item) return;
      const group = groups.get(record.userId) || {
          user: {
            id: record.userId,
            name:
              userMap.get(record.userId)?.name ||
              userMap.get(record.userId)?.username ||
              "Deleted user",
            username: userMap.get(record.userId)?.username || "deleted",
          },
          movies: [],
          television: [],
        },
        target = record.domain === "movie" ? group.movies : group.television,
        key = `${record.domain}:${item.id}`;
      if (!target.some((value) => value.collectionKey === key))
        target.push({
          ...item,
          domain: record.domain,
          collectionKey: key,
          requestedAt: record.requestedAt || record.addedAt || null,
          collectionSource: source,
          requestStatus: record.status || "saved",
        });
      groups.set(record.userId, group);
    };
    for (const record of stored.requests || [])
      if (
        !["rejected", "canceled", "failed", "pending_approval"].includes(
          record.status,
        )
      )
        add(record, "request");
    for (const record of stored.interests || []) add(record, "saved");
    for (const userId of visibleUserIds)
      if (!groups.has(userId)) {
        const user = userMap.get(userId);
        groups.set(userId, {
          user: {
            id: userId,
            name: user?.name || user?.username || "Deleted user",
            username: user?.username || "deleted",
          },
          movies: [],
          television: [],
        });
      }
    return [...groups.values()]
      .map((group) => {
        const items = [...group.movies, ...group.television],
          available = items.filter(
            (item) => item.hasFile || item.state === "available",
          ).length;
        return {
          ...group,
          movies: group.movies.sort((a, b) => a.title.localeCompare(b.title)),
          television: group.television.sort((a, b) =>
            a.title.localeCompare(b.title),
          ),
          count: items.length,
          sharing: {
            visibility: preferences[group.user.id]?.visibility || "private",
            sharedWith: preferences[group.user.id]?.sharedWith || [],
          },
          statistics: {
            movies: group.movies.length,
            television: group.television.length,
            available: available,
            missing: items.length - available,
            sizeOnDisk: items.reduce(
              (sum, item) => sum + Number(item.sizeOnDisk || 0),
              0,
            ),
            requested: items.filter(
              (item) => item.collectionSource === "request",
            ).length,
            saved: items.filter((item) => item.collectionSource === "saved")
              .length,
          },
        };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }
  const posterOverlayCache = new Map(),
    posterFileMetadataCache = new Map(),
    posterEpisodeMetadataCache = new Map(),
    mediaDetailCache = new Map(),
    mediaDetailRuns = new Map(),
    fileOverlayVariables = new Set([
      "quality",
      "resolution",
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
      "file_size",
    ]),
    episodeOverlayVariables = new Set([
      "season_count",
      "current_season",
      "current_season_progress",
      "current_season_missing",
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
    ]);
  const templateUsesVariables = (template, set) =>
    template?.layers?.some(
      (layer) =>
        set.has(layer.variable) ||
        (layer.conditions?.rules || []).some((rule) =>
          set.has(rule.variable),
        ) ||
        (layer.styleRules || []).some((style) =>
          (style.conditions?.rules || []).some((rule) =>
            set.has(rule.variable),
          ),
        ),
    );
  const posterTemplateTarget = (template) =>
    ["vynode", "plex"].includes(template?.target)
      ? template.target
      : Object.values(template?.plexBadges || {}).some(Boolean)
        ? "plex"
        : "vynode";
  async function posterOverlayConfiguration() {
    const stored = await posterOverlayStore.read();
    return {
      templates: (stored.templates || []).map((template) => ({
        ...template,
        target: posterTemplateTarget(template),
        layers: (template.layers || []).map(sanitizeOverlayLayer),
      })),
      assignments: stored.assignments || [],
    };
  }
  async function overlayForItem(domain, item, configuration = null) {
    const state = configuration || (await posterOverlayConfiguration());
    return resolveOverlayTemplate(
      item,
      domain,
      state.templates,
      state.assignments,
    );
  }
  async function televisionFileMetadata(item, template) {
    if (!templateUsesVariables(template, fileOverlayVariables))
      return item.fileMetadata || null;
    const key = collectionMediaId("tv", item.id),
      cached = posterFileMetadataCache.get(key);
    let files = cached?.expires > Date.now() ? cached.files : null;
    if (!files) {
      const adapter = registry.get("tv");
      files =
        typeof adapter.getSeriesFileMetadata === "function"
          ? await adapter.getSeriesFileMetadata(item.id).catch(() => [])
          : [];
      posterFileMetadataCache.set(key, {
        files: files,
        expires: Date.now() + 10 * 6e4,
      });
    }
    return aggregateOverlayFileMetadata(
      files,
      template.tvFileAggregation || "most_common",
    );
  }
  async function televisionEpisodeMetadata(item, template) {
    if (!templateUsesVariables(template, episodeOverlayVariables)) return {};
    const key = collectionMediaId("tv", item.id),
      cached = posterEpisodeMetadataCache.get(key);
    if (cached?.expires > Date.now()) return cached.value;
    const adapter = registry.get("tv");
    if (typeof adapter.getSeriesOverlayMetadata !== "function") return {};
    try {
      const value = await adapter.getSeriesOverlayMetadata(item.id),
        useful =
          value &&
          (value.nextEpisode ||
            value.latestEpisode ||
            value.currentSeason ||
            Number(value.seasonCount) > 0);
      if (useful)
        posterEpisodeMetadataCache.set(key, {
          value: value,
          expires: Date.now() + 10 * 6e4,
        });
      return value || {};
    } catch {
      return {};
    }
  }
  function cachedTelevisionOverlay(item, template) {
    const key = collectionMediaId("tv", item.id),
      fileEntry = posterFileMetadataCache.get(key),
      episodeEntry = posterEpisodeMetadataCache.get(key),
      files = fileEntry?.expires > Date.now() ? fileEntry.files : null,
      episodes = episodeEntry?.expires > Date.now() ? episodeEntry.value : {};
    return {
      ...item,
      ...episodes,
      ...(files
        ? {
            fileMetadata: aggregateOverlayFileMetadata(
              files,
              template.tvFileAggregation || "most_common",
            ),
          }
        : {}),
    };
  }
  async function enrichTelevisionOverlay(item, template) {
    const [fileMetadata, episodes] = await Promise.all([
      televisionFileMetadata(item, template),
      televisionEpisodeMetadata(item, template),
    ]);
    return { ...item, ...episodes, fileMetadata: fileMetadata };
  }
  async function overlayRenderContext(domain, item, template, session) {
    const enriched =
        domain === "tv" ? await enrichTelevisionOverlay(item, template) : item,
      attribution = session
        ? await requestAttribution(domain, [item.id], session)
        : {};
    return {
      item: enriched,
      context: { requesters: attribution[`${domain}:${item.id}`] || [] },
    };
  }
  async function plexPreviewTarget({
    domain: domain,
    mediaId: mediaId,
    libraryKey: libraryKey,
    ratingKey: ratingKey,
  }) {
    const settings = await plexSettingsStore.read(),
      token = await engineSettings.plexCredential();
    if (!settings.endpoint || !token)
      throw new Error("Connect Plex before reviewing poster artwork");
    const library = (settings.libraries || []).find(
      (item) => String(item.key) === String(libraryKey),
    );
    if (!library || (library.type === "movie" ? "movie" : "tv") !== domain)
      throw new Error("Choose a compatible Plex library");
    const item = (await sync.list(domain)).find(
      (value) => value.id === mediaId,
    );
    if (!item)
      throw new Error("The VynodeArr library title is no longer available");
    const destinationState = await mediaDestinations.state(),
      mappedInstances = new Set(destinationState.destinations
        .filter((destination) => destination.domain === domain && String(destination.plexLibraryKey || "") === String(library.key))
        .map((destination) => String(destination.engineInstanceId || "")));
    if (mappedInstances.size && !mappedInstances.has(String(item.engineInstanceId || "")))
      throw new Error("This title's engine instance is not associated with the selected Plex library");
    const plexItems = await plexService.libraryItems(
        settings.endpoint,
        token,
        library,
      ),
      matched = plexService.match([{ ...item, domain: domain }], plexItems)[0],
      plex =
        matched?.status === "matched" &&
        matched.plex.find(
          (value) => String(value.ratingKey) === String(ratingKey),
        );
    if (!plex)
      throw new Error(
        "The Plex title no longer has one unambiguous external-ID match",
      );
    const poster = await plexService.artwork(
      settings.endpoint,
      token,
      plex.thumb || `/library/metadata/${plex.ratingKey}/thumb`,
    );
    return {
      domain: domain,
      settings: settings,
      token: token,
      library: library,
      item: item,
      plex: plex,
      poster: poster,
    };
  }
  const publicPlexPosterApplication = (value) => ({
    id: value.id,
    title: value.title,
    domain: value.domain,
    templateName: value.templateName,
    plexLibraryTitle: value.plexLibraryTitle,
    engineInstanceId: value.engineInstanceId || null,
    engineInstanceName: value.engineInstanceName || null,
    appliedAt: value.appliedAt,
    restoredAt: value.restoredAt || null,
    variableValues: value.variableValues || {},
    status: value.restoredAt ? "restored" : "applied",
  });
  async function originalPlexPoster(settings, libraryKey, ratingKey, fallbackPoster) {
    const stored = await plexPosterApplicationStore.read(),
      prior = (stored.applications || [])
        .filter((item) => !item.restoredAt && String(item.libraryKey) === String(libraryKey) && String(item.ratingKey) === String(ratingKey) && item.serverMachineIdentifier === settings.server?.machineIdentifier)
        .sort((a, b) => String(a.appliedAt || "").localeCompare(String(b.appliedAt || "")))[0];
    if (!prior) return { ...fallbackPoster, managed: false };
    if (!/^plex_poster_[A-Za-z0-9-]+\.poster$/.test(String(prior.backupFile || ""))) throw new Error("The original Plex poster record is invalid");
    const body = await readFile(join(plexPosterBackupDir, prior.backupFile));
    if (createHash("sha256").update(body).digest("hex") !== prior.backupSha256) throw new Error("The original Plex poster failed integrity validation");
    return { body, contentType: prior.backupContentType, managed: true };
  }
  async function renderedPlexPoster(target, template, session) {
    const rawPlexAddedAt=target.plex.addedAt,numericPlexAddedAt=Number(rawPlexAddedAt),plexAddedDate=Number.isFinite(numericPlexAddedAt)&&numericPlexAddedAt>0?new Date(numericPlexAddedAt<(1e12)?numericPlexAddedAt*1000:numericPlexAddedAt):new Date(rawPlexAddedAt||'');
    const { item: item, context: context } = await overlayRenderContext(
        target.domain,
        target.item,
        template,
        session,
      ),
      overlay = renderOverlaySvg({
        poster: Buffer.alloc(0),
        template: template,
        item: item,
        context: { ...context, plexAddedAt: Number.isFinite(plexAddedDate.getTime()) ? plexAddedDate.toISOString() : null },
        includePoster: false,
      }),
      sharp = (await import("sharp")).default;
    const rendered = await sharp(target.poster.body)
      .rotate()
      .resize(600, 900, { fit: "cover", position: "centre" })
      .composite([{ input: overlay, top: 0, left: 0 }])
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toBuffer();
    if (!rendered.length || rendered.length > 2e7)
      throw new Error("The rendered Plex poster is empty or too large");
    return rendered;
  }
  async function applyPlexPoster(input, template, session) {
    const domain = input.domain === "tv" ? "tv" : "movie",
      mediaId = String(input.mediaId || ""),
      libraryKey = String(input.libraryKey || ""),
      ratingKey = String(input.ratingKey || "");
    if (
      !/^(?:movie|series)_[A-Za-z0-9_-]+$/.test(mediaId) ||
      !/^\d+$/.test(ratingKey)
    )
      throw new Error("Choose a valid matched Plex title");
    if (template.target !== "plex")
      throw new Error(`${template.name} was not created for Plex artwork`);
    if (template.domain !== "all" && template.domain !== domain)
      throw new Error(`${template.name} is not compatible with this title`);
    const target = await plexPreviewTarget({
        domain: domain,
        mediaId: mediaId,
        libraryKey: libraryKey,
        ratingKey: ratingKey,
      });
    target.poster = await originalPlexPoster(target.settings, target.library.key, target.plex.ratingKey, target.poster);
    const rendered = await renderedPlexPoster(target, template, session),
      id = `plex_poster_${randomUUID()}`,
      backupFile = `${id}.poster`,
      backupPath = join(plexPosterBackupDir, backupFile);
    await mkdir(plexPosterBackupDir, { recursive: true });
    await writeFile(backupPath, target.poster.body, { mode: 384, flag: "wx" });
    await plexService.uploadPoster(
      target.settings.endpoint,
      target.token,
      target.plex.ratingKey,
      rendered,
      "image/jpeg",
    );
    const application = {
      id: id,
      serverMachineIdentifier: target.settings.server?.machineIdentifier || "",
      libraryKey: String(target.library.key),
      plexLibraryTitle: target.library.title,
      ratingKey: String(target.plex.ratingKey),
      domain: domain,
      mediaId: mediaId,
      engineInstanceId: target.item.engineInstanceId || null,
      engineInstanceName: target.item.engineInstanceName || null,
      title: target.item.title,
      templateId: template.id,
      templateName: template.name,
      backupFile: backupFile,
      backupContentType: target.poster.contentType,
      backupSha256: createHash("sha256")
        .update(target.poster.body)
        .digest("hex"),
      renderedSha256: createHash("sha256").update(rendered).digest("hex"),
      variableValues: posterVariableValues(target.item, {
        plexAddedAt: Number.isFinite(Number(target.plex.addedAt)) && Number(target.plex.addedAt) > 0
          ? new Date(Number(target.plex.addedAt) < 1e12 ? Number(target.plex.addedAt) * 1000 : Number(target.plex.addedAt)).toISOString()
          : target.plex.addedAt,
      }),
      appliedAt: new Date().toISOString(),
      restoredAt: null,
    };
    await plexPosterApplicationStore.update((state) => {
      state.applications = state.applications || [];
      state.applications.push(application);
    });
    await recordAudit(session, {
      category: "configuration",
      action: "plex.poster_applied",
      target: target.item.title,
      summary:
        "Applied a reviewed poster overlay to Plex after capturing rollback artwork.",
      metadata: {
        applicationId: id,
        library: target.library.title,
        template: template.name,
        ratingKey: target.plex.ratingKey,
        rollbackCaptured: true,
      },
    });
    return application;
  }
  async function decoratePosterArtwork(domain, items, session) {
    const state = await posterOverlayConfiguration(),
      attribution = session
        ? await requestAttribution(
            domain,
            items.map((item) => item.id),
            session,
          )
        : {},
      resolved = items.map((item) => ({
        item: item,
        template: resolveOverlayTemplate(
          item,
          domain,
          state.templates,
          state.assignments,
        ),
      })),
      enriched = [];
    for (const { item: item, template: template } of resolved)
      enriched.push(
        domain === "tv" && template
          ? cachedTelevisionOverlay(item, template)
          : item,
      );
    return enriched.map((item, index) => {
      const template = resolved[index].template,
        overlayValues = posterVariableValues(item, {
          requesters: attribution[`${domain}:${item.id}`] || [],
        }),
        artwork = { ...(item.artwork || {}), overlayValues: overlayValues };
      return template
        ? {
            ...item,
            artwork: {
              ...artwork,
              originalUrl: item.artwork?.url,
              overlayTemplateId: template.id,
              overlayTemplate: template,
            },
          }
        : { ...item, artwork: artwork };
    });
  }
  async function warmAssignedTelevisionOverlay(template, assignment) {
    if (
      assignment.scope.domain !== "tv" ||
      (!templateUsesVariables(template, fileOverlayVariables) &&
        !templateUsesVariables(template, episodeOverlayVariables))
    )
      return;
    const library = await sync.list("tv"),
      selected = new Set((assignment.scope.mediaIds || []).map(String)),
      items =
        assignment.scope.type === "items"
          ? library.filter((item) => selected.has(String(item.id)))
          : library;
    for (let start = 0; start < items.length; start += 2)
      await Promise.all(
        items
          .slice(start, start + 2)
          .map((item) =>
            enrichTelevisionOverlay(item, template).catch(() => null),
          ),
      );
  }
  function projectedMediaDetail(domain, item) {
    if (!item) return null;
    if (domain === "movie")
      return {
        ...item,
        availability: item.availability || item.status || "unknown",
        releaseDates: item.releaseDates || {
          cinemas: null,
          digital: item.releaseDate || null,
          physical: null,
        },
        location: item.location || item.rootFolder || null,
        fileLocation: item.fileLocation || null,
        backdrop: item.backdrop || {
          url: `/api/artwork/movie/${item.id}/fanart`,
          kind: "backdrop",
          width: 0,
          height: 0,
        },
      };
    return {
      ...item,
      location: item.location || item.rootFolder || null,
      backdrop: item.backdrop || {
        url: `/api/artwork/tv/${item.id}/fanart`,
        kind: "backdrop",
        width: 0,
        height: 0,
      },
      seasons: Array.isArray(item.seasons) ? item.seasons : [],
    };
  }
  async function mediaDetail(domain, id) {
    const key = `${domain}:${id}`,
      cached = mediaDetailCache.get(key);
    if (cached?.expires > Date.now()) return {...cached, source:"cache"};
    if (mediaDetailRuns.has(key)) return mediaDetailRuns.get(key);
    const run = (async () => {
      const projected = await sync.item(domain, id);
      if (!projected) return null;
      try {
        const adapter = sync.engines?.[domain]||registry.get(domain),
          live =
            domain === "movie"
              ? await adapter.getMovie(id)
              : await adapter.getSeries(id),
          item = live || projectedMediaDetail(domain, projected);
        const refreshedAt = new Date().toISOString();
        mediaDetailCache.set(key, {
          item: item,
          expires: Date.now() + 10 * 6e4,
          source: live ? "engine" : "catalog",
          refreshedAt,
        });
        return {item,source:live ? "engine" : "catalog",refreshedAt};
      } catch {
        const item = projectedMediaDetail(domain, projected);
        const refreshedAt = new Date().toISOString();
        mediaDetailCache.set(key, { item: item, expires: Date.now() + 6e4, source:"catalog", refreshedAt });
        return {item,source:"catalog",refreshedAt};
      }
    })().finally(() => mediaDetailRuns.delete(key));
    mediaDetailRuns.set(key, run);
    return run;
  }
  function invalidateMediaDetail(domain, id) {
    if (id) mediaDetailCache.delete(`${domain}:${id}`);
    else
      for (const key of mediaDetailCache.keys())
        if (key.startsWith(`${domain}:`)) mediaDetailCache.delete(key);
  }
  async function durableArtworkGet(key) {
    try {
      const indexed = await projectionStore.artworkGet?.(key);
      if (
        indexed &&
        Date.now() - Number(indexed.cachedAt || 0) <= 7 * 24 * 60 * 60 * 1e3
      )
        return {
          body: await readFile(join(artworkDiskDir, indexed.file)),
          contentType: indexed.contentType,
          cachedAt: indexed.cachedAt,
        };
      const state = await artworkDiskStore.read(),
        entry = state.entries?.[key];
      if (
        !entry ||
        Date.now() - Number(entry.cachedAt || 0) > 7 * 24 * 60 * 60 * 1e3
      )
        return null;
      const body = await readFile(join(artworkDiskDir, entry.file));
      return {
        body: body,
        contentType: entry.contentType,
        cachedAt: entry.cachedAt,
      };
    } catch {
      return null;
    }
  }
  async function durableArtworkSet(key, value) {
    if (!value?.body?.length || value.body.length > 10 * 1024 * 1024) return;
    const file = `${createHash("sha256").update(key).digest("hex")}.bin`;
    await mkdir(artworkDiskDir, { recursive: true });
    await writeFile(join(artworkDiskDir, file), value.body);
    await projectionStore.artworkSet?.(key, {
      file: file,
      contentType: value.contentType || "application/octet-stream",
      cachedAt: Date.now(),
      size: value.body.length,
    });
    const evicted = [];
    await artworkDiskStore.update((state) => {
      state.entries = state.entries || {};
      state.entries[key] = {
        file: file,
        contentType: value.contentType || "application/octet-stream",
        cachedAt: Date.now(),
        size: value.body.length,
      };
      const ordered = Object.entries(state.entries).sort(
        (a, b) => Number(b[1].cachedAt) - Number(a[1].cachedAt),
      );
      let bytes = ordered.reduce(
        (total, [, entry]) => total + Math.max(0, Number(entry.size) || 0),
        0,
      );
      for (
        let index = ordered.length - 1;
        index >= 0 &&
        (index >= artworkDiskMaxItems || bytes > artworkDiskMaxBytes);
        index--
      ) {
        const [oldKey, entry] = ordered[index];
        if (oldKey === key && ordered.length === 1) break;
        evicted.push(entry.file);
        bytes -= Math.max(0, Number(entry.size) || 0);
        delete state.entries[oldKey];
      }
    });
    await Promise.allSettled(
      evicted.map((name) => unlink(join(artworkDiskDir, name))),
    );
  }
  async function invalidateArtwork(domain, id) {
    const prefix = `${domain}:${id}:`;
    for (const key of artworkCache.items?.keys?.() || [])
      if (key.startsWith(prefix)) artworkCache.delete(key);
    const files = (await projectionStore.artworkRemovePrefix?.(prefix)) || [];
    await Promise.allSettled(
      files.map((name) => unlink(join(artworkDiskDir, name))),
    );
  }
  async function libraryArtwork(domain, id, kind) {
    const key = `${domain}:${id}:${kind}`;
    let value = artworkCache.get(key);
    if (!value) {
      value = await durableArtworkGet(key);
      if (value) artworkCache.set(key, value);
    }
    if (value) return value;
    let run = artworkRuns.get(key);
    if (!run) {
      run = artworkFetchLimiter
        .run(() => registry.get(domain).getArtwork(id, kind))
        .then(async (result) => {
          if (result) {
            const cached = { ...result, cachedAt: Date.now() };
            artworkCache.set(key, cached);
            await artworkWriteLimiter
              .run(() => durableArtworkSet(key, cached))
              .catch(() => {});
          }
          return result;
        })
        .finally(() => artworkRuns.delete(key));
      artworkRuns.set(key, run);
    }
    return run;
  }
  function clearPosterOverlayCache() {
    posterOverlayCache.clear();
  }
  async function requestAttribution(domain, mediaIds, session) {
    const [stored, users] = await Promise.all([
        requestStore.read(),
        auth.listUsers(),
      ]),
      userMap = new Map(users.map((user) => [user.id, user])),
      targets = new Map();
    for (const value of mediaIds.map(String)) {
      const normalized = collectionMediaId(domain, value);
      targets.set(normalized, [...(targets.get(normalized) || []), value]);
    }
    const visible =
        session.user.role === "administrator"
          ? null
          : new Set([session.user.id]),
      result = {};
    for (const record of stored.requests || []) {
      const keys =
        targets.get(collectionMediaId(domain, `${record.engineInstanceId?`${record.engineInstanceId}_`:""}${record.engineId}`)) ||
        (!record.engineInstanceId?targets.get(collectionMediaId(domain, record.engineId)):null) || [];
      if (
        record.domain !== domain ||
        !keys.length ||
        ["rejected", "canceled", "failed", "pending_approval"].includes(
          record.status,
        ) ||
        (visible && !visible.has(record.userId))
      )
        continue;
      const user = userMap.get(record.userId),
        attribution = {
          id: record.userId,
          name: user?.name || user?.username || "Deleted user",
          username: user?.username || "deleted",
          requestedAt: record.requestedAt || null,
          status: record.status,
          requestId: record.id,
        };
      for (const target of keys) {
        const key = `${domain}:${target}`,
          existing = result[key] || [];
        if (!existing.some((value) => value.id === record.userId))
          result[key] = [...existing, attribution];
      }
    }
    for (const record of stored.interests || []) {
      const keys =
        targets.get(collectionMediaId(domain, `${record.engineInstanceId?`${record.engineInstanceId}_`:""}${record.engineId}`)) ||
        (!record.engineInstanceId?targets.get(collectionMediaId(domain, record.engineId)):null) || [];
      if (
        record.domain !== domain ||
        !keys.length ||
        (visible && !visible.has(record.userId))
      )
        continue;
      const user = userMap.get(record.userId),
        attribution = {
          id: record.userId,
          name: user?.name || user?.username || "Deleted user",
          username: user?.username || "deleted",
          requestedAt: record.addedAt || null,
          status: "saved",
          requestId: record.id,
        };
      for (const target of keys) {
        const key = `${domain}:${target}`,
          existing = result[key] || [];
        if (!existing.some((value) => value.id === record.userId))
          result[key] = [...existing, attribution];
      }
    }
    return result;
  }
  function proxyCompatibilityApi(req, res, url, domain, prefix) {
    const adapter = registry.get(domain),
      config = adapter.config || adapter.client?.config;
    if (!config?.enabled)
      return json(res, 503, {
        error: {
          message: `${domain === "movie" ? "Movie" : "Television"} service unavailable`,
        },
      });
    const relative = url.pathname.slice(prefix.length) || "/";
    if (!/^\/(?:api\/|ping\/?$)/i.test(relative))
      return json(res, 404, {
        error: { message: "Compatibility API endpoint not found" },
      });
    const upstreamBase = config.urlBase
      ? `/${String(config.urlBase).replace(/^\/+|\/+$/g, "")}`
      : "";
    const transport = config.https ? httpsRequest : httpRequest,
      headers = {};
    for (const [name, value] of Object.entries(req.headers))
      if (!hopHeaders.has(name) && name !== "host" && value !== undefined)
        headers[name] = value;
    headers.host = `${config.host}:${config.port}`;
    if (/^\/api\//i.test(relative)) headers.accept = "application/json";
    let upstreamResponse = null,
      upstreamComplete = false,
      downstreamAborted = false;
    const removeDownstreamListeners = () => {
      req.off("aborted", abortUpstream);
      res.off("close", abortUpstream);
    };
    const abortUpstream = () => {
      if (upstreamComplete || res.writableFinished) return;
      downstreamAborted = true;
      removeDownstreamListeners();
      upstreamResponse?.destroy();
      upstream.destroy();
    };
    const upstream = transport(
      {
        protocol: config.https ? "https:" : "http:",
        hostname: config.host,
        port: config.port,
        method: req.method,
        path: `${upstreamBase}${relative}${url.search}`,
        headers: headers,
        rejectUnauthorized: config.tlsVerify,
      },
      (response) => {
        upstreamResponse = response;
        const finishUpstream = () => {
          upstreamComplete = true;
          removeDownstreamListeners();
        };
        response.once("end", finishUpstream);
        response.once("close", finishUpstream);
        if (downstreamAborted || res.destroyed) {
          response.destroy();
          return;
        }
        const responseHeaders = {};
        for (const [name, value] of Object.entries(response.headers))
          if (!hopHeaders.has(name) && value !== undefined)
            responseHeaders[name] = value;
        res.writeHead(response.statusCode || 502, responseHeaders);
        response.pipe(res);
      },
    );
    req.once("aborted", abortUpstream);
    res.once("close", abortUpstream);
    upstream.setTimeout(config.timeoutMs || 1e4, () =>
      upstream.destroy(new Error("Compatibility API timed out")),
    );
    upstream.on("error", () => {
      removeDownstreamListeners();
      if (downstreamAborted || res.destroyed) return;
      if (!res.headersSent)
        json(res, 502, {
          error: {
            message: `${domain === "movie" ? "Movie" : "Television"} service unavailable`,
          },
        });
      else res.destroy();
    });
    req.pipe(upstream);
  }
  async function handleRequest(req, res) {
    const url = new URL(req.url, "http://vynodearr.local"),
      requestStarted = Date.now(),
      metricPath = url.pathname
        .replace(/\/(?:movie|series)_[A-Za-z0-9_-]+/g, "/:media")
        .replace(/\/[0-9]+/g, "/:id");
    res.once("finish", () => {
      const duration = Date.now() - requestStarted,
        current = requestMetrics.get(metricPath) || {
          path: metricPath,
          count: 0,
          totalMs: 0,
          maxMs: 0,
          lastMs: 0,
          lastStatus: 0,
        };
      current.count++;
      current.totalMs += duration;
      current.maxMs = Math.max(current.maxMs, duration);
      current.lastMs = duration;
      current.lastStatus = res.statusCode;
      current.updatedAt = new Date().toISOString();
      requestMetrics.set(metricPath, current);
      if (requestMetrics.size > 250)
        requestMetrics.delete(requestMetrics.keys().next().value);
    });
    if (!initialized) await initialize();
    try {
      if (req.method === "GET" && url.pathname === "/healthz")
        return json(res, 200, { status: "ready", service: "VynodeArr" });
      const engineEventMatch = url.pathname.match(
        /^\/api\/internal\/engine-events\/(movie|tv)$/,
      );
      if (engineEventMatch && req.method === "POST") {
        const address = String(req.socket.remoteAddress || "");
        if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address))
          return json(res, 403, {
            error: {
              code: "local_only",
              message:
                "Engine events are accepted only from the installation-managed engines.",
            },
          });
        const domain = engineEventMatch[1],
          event = await body(req),
          eventType = String(event.eventType || "unknown"),
          numeric = Number(
            domain === "movie"
              ? event.movie?.id || event.movieId
              : event.series?.id || event.seriesId || event.episode?.seriesId,
          ),
          mediaId =
            Number.isFinite(numeric) && numeric > 0
              ? `${domain === "movie" ? "movie" : "series"}_${numeric}`
              : null,
          identity = String(
            event.downloadId ||
              event.movieFile?.id ||
              event.episodeFile?.id ||
              event.instanceName ||
              eventType,
          ),
          dedupeKey = `webhook:${domain}:${eventType}:${mediaId || "domain"}:${identity}:${event.date || event.timestamp || Math.floor(Date.now() / 5e3)}`;
        if (
          /delete/i.test(eventType) &&
          mediaId &&
          /movieDelete|seriesDelete/i.test(eventType)
        ) {
          await sync.removeItem(domain, mediaId);
          broadcastLibraryEvent({
            domain: domain,
            removedIds: [mediaId],
            updatedAt: new Date().toISOString(),
          });
        } else if (
          eventProcessor &&
          (mediaId || /health|applicationupdate/i.test(eventType))
        ) {
          await eventProcessor.enqueue({
            dedupeKey: dedupeKey,
            domain: domain,
            mediaId: mediaId,
            eventType: eventType,
            payload: event,
          });
        }
        return json(res, 202, {
          accepted: true,
          domain: domain,
          eventType: eventType,
          mediaId: mediaId,
        });
      }
      if (url.pathname === "/movies" || url.pathname.startsWith("/movies/"))
        return proxyCompatibilityApi(req, res, url, "movie", "/movies");
      if (url.pathname === "/tv" || url.pathname.startsWith("/tv/"))
        return proxyCompatibilityApi(req, res, url, "tv", "/tv");
      if (url.pathname === "/api/auth/status" && req.method === "GET") {
        const session = sessionFor(req, auth);
        return json(res, 200, {
          setupRequired: await auth.setupRequired(),
          authenticated: Boolean(session),
          user: session?.user || null,
          csrf: session?.csrf || null,
          enginesConfigured: enginesConfigured(),
        });
      }
      if (url.pathname === "/api/auth/setup" && req.method === "POST") {
        const input = await body(req),
          user = await auth.createInitialAdministrator(input),
          result = await auth.createSession(user, {
            ip: req.socket.remoteAddress,
            userAgent: req.headers["user-agent"],
            remember: true,
          });
        await recordAudit(result, {
          category: "security",
          action: "administrator.initialized",
          target: result.user.username,
          summary: "Created the initial administrator account.",
        });
        return json(
          res,
          201,
          {
            created: true,
            authenticated: true,
            user: result.user,
            csrf: result.csrf,
            enginesConfigured: enginesConfigured(),
          },
          { "set-cookie": auth.cookie(result.id, false, true) },
        );
      }
      if (url.pathname === "/api/auth/login" && req.method === "POST") {
        const input = await body(req),
          result = await auth.login(
            input.identifier || input.username,
            input.password,
            {
              ip: req.socket.remoteAddress,
              userAgent: req.headers["user-agent"],
              remember: Boolean(input.remember),
            },
          );
        if (!result)
          return json(res, 401, {
            error: {
              code: "login_failed",
              message: "The username, email, or password was not accepted.",
            },
          });
        if (result.user.role === "administrator")
          await recordAudit(result, {
            category: "security",
            action: "session.logged_in",
            target: result.user.username,
            summary: "Signed in to an administrator session.",
          });
        return json(
          res,
          200,
          {
            authenticated: true,
            user: result.user,
            csrf: result.csrf,
            enginesConfigured: enginesConfigured(),
          },
          {
            "set-cookie": auth.cookie(
              result.id,
              false,
              Boolean(input.remember),
            ),
          },
        );
      }
      if (url.pathname.startsWith("/api/")) {
        const session = requireSession(req, res, auth);
        if (!session) return;
        const sessionId = cookies(req.headers.cookie).vynodearr_session;
        if (url.pathname === "/api/library-events" && req.method === "GET") {
          if (
            !permitted(
              res,
              session,
              session.user.permissions?.movies ? "movies" : "tv",
            )
          )
            return;
          const client = {
            response: res,
            domains: new Set(
              ["movie", "tv"].filter(
                (domain) =>
                  session.user.role === "administrator" ||
                  session.user.permissions?.[
                    domain === "movie" ? "movies" : "tv"
                  ],
              ),
            ),
          };
          res.writeHead(200, {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-store",
            connection: "keep-alive",
            "x-accel-buffering": "no",
            "x-content-type-options": "nosniff",
          });
          res.write("event: ready\ndata: {}\n\n");
          libraryEventClients.add(client);
          const heartbeat = setInterval(() => {
            try {
              res.write(": keepalive\n\n");
            } catch {}
          }, 25e3);
          heartbeat.unref?.();
          req.on("close", () => {
            clearInterval(heartbeat);
            libraryEventClients.delete(client);
          });
          return;
        }
        if (url.pathname === "/api/import-jobs" && req.method === "GET") {
          if (!administrator(res, session)) return;
          return json(res, 200, {
            items: [...importJobs.values()]
              .filter((job) => job.userId === session.user.id)
              .map(publicImportJob),
          });
        }
        if (url.pathname === "/api/import-jobs" && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const job = startImportJob(session.user.id, await body(req, 25e6));
          await recordAudit(session, {
            category: "job",
            action: "import.started",
            target: job.label || job.domain,
            domain: job.domain,
            summary: `Started ${job.label || "a library import"}.`,
            metadata: { jobId: job.id },
          });
          return json(res, 202, { job: job });
        }
        const importJobMatch = url.pathname.match(
          /^\/api\/import-jobs\/(import_[A-Za-z0-9-]+)$/,
        );
        if (importJobMatch && req.method === "DELETE") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const job = importJobs.get(importJobMatch[1]);
          if (!job || job.userId !== session.user.id)
            return json(res, 404, {
              error: { code: "not_found", message: "Import job was not found" },
            });
          if (["queued", "running"].includes(job.status)) {
            job.cancelRequested = true;
            job.status = "canceling";
            job.currentTitle = "Stopping after the current item";
          }
          await recordAudit(session, {
            category: "job",
            action: "import.canceled",
            target: job.label || job.domain,
            domain: job.domain,
            summary: `Canceled ${job.label || "a library import"}.`,
            metadata: { jobId: job.id },
          });
          return json(res, 200, { job: publicImportJob(job) });
        }
        if (url.pathname === "/api/search-jobs" && req.method === "GET") {
          if (!administrator(res, session)) return;
          return json(res, 200, {
            items: [...searchJobs.values()]
              .filter((job) => job.userId === session.user.id)
              .map(publicSearchJob),
          });
        }
        if (url.pathname === "/api/search-activities" && req.method === "GET") {
          if (!administrator(res, session)) return;
          return json(res, 200, {
            items: await reconcileSearchActivities(null),
          });
        }
        if (
          url.pathname === "/api/operations/timeline" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          const domain = url.searchParams.get("domain"),
            category = url.searchParams.get("category"),
            status = url.searchParams.get("status"),
            query = String(url.searchParams.get("query") || "")
              .trim()
              .toLowerCase();
          let items = await operationsTimeline();
          if (["movie", "tv"].includes(domain))
            items = items.filter((item) => item.domain === domain);
          if (category)
            items = items.filter((item) => item.category === category);
          if (status)
            items = items.filter(
              (item) =>
                String(item.status).toLowerCase() === status.toLowerCase(),
            );
          if (query)
            items = items.filter((item) =>
              `${item.title} ${item.summary} ${item.actor} ${item.source}`
                .toLowerCase()
                .includes(query),
            );
          return json(res, 200, {
            items: items,
            summary: {
              total: items.length,
              categories: Object.fromEntries(
                [...new Set(items.map((item) => item.category))].map(
                  (value) => [
                    value,
                    items.filter((item) => item.category === value).length,
                  ],
                ),
              ),
            },
          });
        }
        if (
          url.pathname === "/api/system/performance" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          const memory = process.memoryUsage(),
            settings = await performanceStore.read(),
            events = await eventProcessor?.stats();
          return json(res, 200, {
            generatedAt: new Date().toISOString(),
            process: {
              pid: process.pid,
              uptimeSeconds: Math.round(process.uptime()),
              rss: memory.rss,
              heapUsed: memory.heapUsed,
              heapTotal: memory.heapTotal,
              external: memory.external,
              arrayBuffers: memory.arrayBuffers,
            },
            catalog: {
              movie: await projectionStore.countDomain?.("movie"),
              tv: await projectionStore.countDomain?.("tv"),
              events: events || null,
              integrity: {
                movie: await sync.integrity?.("movie"),
                tv: await sync.integrity?.("tv"),
              },
            },
            artwork: {
              memory: artworkCache.stats(),
              disk: (await projectionStore.artworkStats?.()) || null,
              fetch: artworkFetchLimiter.snapshot(),
              write: artworkWriteLimiter.snapshot(),
              inFlight: artworkRuns.size,
            },
            requests: [...requestMetrics.values()]
              .map((item) => ({
                ...item,
                averageMs: Math.round(item.totalMs / item.count),
              }))
              .sort((a, b) => b.totalMs - a.totalMs)
              .slice(0, 50),
            activity: sync.snapshot().metrics || {
              catalogReads: 0,
              engineReads: 0,
              fullReconciliations: 0,
              targetedReconciliations: 0,
            },
            sync: sync.snapshot(),
            settings: settings,
          });
        }
        if (
          url.pathname === "/api/system/catalog/recovery" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            domain = String(input.domain || ""),
            action = String(input.action || "retry");
          if (!["movie", "tv"].includes(domain))
            return json(res, 400, { message: "Choose Movies or Television." });
          if (!["retry", "rebuild"].includes(action))
            return json(res, 400, { message: "Unsupported recovery action." });
          sync.resetCircuit?.(domain);
          const retriedEvents = action === "retry" ? await projectionStore.retryFailedEvents?.(domain) || 0 : 0;
          if (retriedEvents) eventProcessor?.wake();
          const items = await sync.synchronize(domain),
            integrity = await sync.integrity?.(domain);
          await recordAudit(session, {
            category: "system",
            action: `catalog.${action}`,
            target: domain === "movie" ? "Movies catalog" : "Television catalog",
            summary:
              action === "rebuild"
                ? "Rebuilt the durable catalog from the media engine."
                : "Retried failed synchronization work.",
            domain,
            metadata: { itemCount: items.length, healthy: integrity?.healthy, retriedEvents },
          });
          return json(res, 200, { domain, action, itemCount: items.length, retriedEvents, integrity, sync: sync.snapshot()[domain] });
        }
        if (
          url.pathname === "/api/system/performance/settings" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          return json(res, 200, { settings: await performanceStore.read() });
        }
        if (
          url.pathname === "/api/system/performance/settings" &&
          req.method === "PUT"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            current = await performanceStore.read(),
            settings = {
              ...current,
              pageSize: boundedInteger(
                input.pageSize,
                current.pageSize || 60,
                20,
                250,
              ),
              eventConcurrency: boundedInteger(
                input.eventConcurrency,
                current.eventConcurrency || 2,
                1,
                4,
              ),
              artworkFetchConcurrency: boundedInteger(
                input.artworkFetchConcurrency,
                current.artworkFetchConcurrency || 2,
                1,
                8,
              ),
              artworkWriteConcurrency: boundedInteger(
                input.artworkWriteConcurrency,
                current.artworkWriteConcurrency || 1,
                1,
                4,
              ),
              integrityIntervalMinutes: boundedInteger(
                input.integrityIntervalMinutes,
                current.integrityIntervalMinutes || 360,
                30,
                1440,
              ),
              updatedAt: new Date().toISOString(),
            };
          await performanceStore.write(settings);
          configuredLibraryPageSize = settings.pageSize;
          artworkFetchLimiter.setLimit(settings.artworkFetchConcurrency);
          artworkWriteLimiter.setLimit(settings.artworkWriteConcurrency);
          eventProcessor?.setConcurrency(settings.eventConcurrency);
          sync.setPollingInterval?.(settings.integrityIntervalMinutes * 6e4);
          await recordAudit(session, {
            category: "configuration",
            action: "performance.settings_updated",
            target: "Resource controls",
            summary: "Updated library catalog and artwork resource limits.",
            metadata: settings,
          });
          return json(res, 200, { settings: settings, restartRequired: false });
        }
        if (
          url.pathname === "/api/operations/actions" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          const includeDismissed = url.searchParams.get("dismissed") === "true",
            items = (await operationsActions()).filter(
              (item) => includeDismissed || !item.dismissedAt,
            );
          return json(res, 200, {
            items: items,
            summary: {
              open: items.filter((item) => !item.dismissedAt).length,
              critical: items.filter(
                (item) => !item.dismissedAt && item.severity === "critical",
              ).length,
              warning: items.filter(
                (item) => !item.dismissedAt && item.severity === "warning",
              ).length,
              dismissed: items.filter((item) => item.dismissedAt).length,
            },
          });
        }
        const operationActionMatch = url.pathname.match(
          /^\/api\/operations\/actions\/(.+?)\/(dismiss|restore)$/,
        );
        if (operationActionMatch && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const id = decodeURIComponent(operationActionMatch[1]),
            action = operationActionMatch[2],
            known = (await operationsActions()).some((item) => item.id === id);
          if (!known)
            return json(res, 404, {
              error: {
                code: "not_found",
                message: "This action item is no longer active.",
              },
            });
          await operationsCenterStore.update((current) => {
            current.version = 1;
            current.dismissed = current.dismissed || {};
            if (action === "dismiss")
              current.dismissed[id] = new Date().toISOString();
            else delete current.dismissed[id];
            return current;
          });
          await recordAudit(session, {
            category: "operations",
            action: `action_item.${action}d`,
            target: id,
            summary: `${action === "dismiss" ? "Dismissed" : "Restored"} an Action Center item.`,
          });
          return json(res, 200, { id: id, dismissed: action === "dismiss" });
        }
        if (
          url.pathname === "/api/download-decisions" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          const stored = await downloadDecisionStore.read(),
            domain = url.searchParams.get("domain"),
            decision = url.searchParams.get("decision"),
            query = String(url.searchParams.get("query") || "")
              .trim()
              .toLowerCase();
          let items = stored.decisions || [];
          if (["movie", "tv"].includes(domain))
            items = items.filter((item) => item.domain === domain);
          if (["selected", "accepted", "rejected"].includes(decision))
            items = items.filter((item) => item.decision === decision);
          if (query)
            items = items.filter((item) =>
              `${item.title} ${item.indexer} ${item.quality} ${(item.reasons || []).join(" ")}`
                .toLowerCase()
                .includes(query),
            );
          const attributions = {
            ...(await requestAttribution(
              "movie",
              items
                .filter((item) => item.domain === "movie")
                .map((item) => item.mediaId),
              session,
            )),
            ...(await requestAttribution(
              "tv",
              items
                .filter((item) => item.domain === "tv")
                .map((item) => item.mediaId),
              session,
            )),
          };
          items = items.map((item) => ({
            ...item,
            requesters: attributions[`${item.domain}:${item.mediaId}`] || [],
          }));
          return json(res, 200, {
            items: items.slice(0, 1e3),
            summary: {
              total: items.length,
              selected: items.filter((item) => item.decision === "selected")
                .length,
              accepted: items.filter((item) => item.decision === "accepted")
                .length,
              rejected: items.filter((item) => item.decision === "rejected")
                .length,
            },
          });
        }
        if (
          url.pathname === "/api/download-decisions" &&
          req.method === "DELETE"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          await downloadDecisionStore.write({ version: 1, decisions: [] });
          await recordAudit(session, {
            category: "system",
            action: "download_decisions.cleared",
            target: "Download Decision Center",
            summary: "Cleared retained release decision evidence.",
          });
          return json(res, 200, { cleared: true });
        }
        if (
          url.pathname === "/api/search-activities" &&
          req.method === "DELETE"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          let cleared = 0;
          await searchActivityStore.update((current) => {
            current.dismissed = current.dismissed || {};
            const timestamp = new Date().toISOString();
            for (const item of current.activities || []) {
              current.dismissed[item.id] = timestamp;
              cleared += 1;
            }
            current.activities = [];
            current.dismissed = Object.fromEntries(
              Object.entries(current.dismissed).slice(-1e3),
            );
            return cleared;
          });
          return json(res, 200, { cleared });
        }
        const searchActivityMatch = url.pathname.match(
          /^\/api\/search-activities\/([^/]+)$/,
        );
        if (searchActivityMatch && req.method === "DELETE") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          let removed = false;
          await searchActivityStore.update((current) => {
            current.dismissed = current.dismissed || {};
            current.dismissed[searchActivityMatch[1]] =
              new Date().toISOString();
            const before = (current.activities || []).length;
            current.activities = (current.activities || []).filter(
              (item) => item.id !== searchActivityMatch[1],
            );
            removed = current.activities.length < before;
            current.dismissed = Object.fromEntries(
              Object.entries(current.dismissed).slice(-1e3),
            );
            return true;
          });
          return json(res, 200, { dismissed: true, removed });
        }
        if (url.pathname === "/api/search-jobs" && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const job = startMissingSearchJob(session.user.id, await body(req));
          await recordAudit(session, {
            category: "job",
            action: "search.started",
            target: job.label || job.domain,
            domain: job.domain,
            summary: `Started ${job.label || "a missing-media search"}.`,
            metadata: { jobId: job.id },
          });
          return json(res, 202, { job: job });
        }
        const searchJobMatch = url.pathname.match(
          /^\/api\/search-jobs\/(search_[A-Za-z0-9-]+)$/,
        );
        if (searchJobMatch && req.method === "DELETE") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const job = searchJobs.get(searchJobMatch[1]);
          if (!job || job.userId !== session.user.id)
            return json(res, 404, {
              error: { code: "not_found", message: "Search job was not found" },
            });
          if (["queued", "running"].includes(job.status)) {
            job.cancelRequested = true;
            job.status = "canceling";
            job.currentTitle = "Stopping after the current batch";
          }
          await recordAudit(session, {
            category: "job",
            action: "search.canceled",
            target: job.label || job.domain,
            domain: job.domain,
            summary: `Canceled ${job.label || "a missing-media search"}.`,
            metadata: { jobId: job.id },
          });
          return json(res, 200, { job: publicSearchJob(job) });
        }
        if (url.pathname === "/api/auth/logout" && req.method === "POST") {
          if (!requireCsrf(req, res, session)) return;
          if (session.user.role === "administrator")
            await recordAudit(session, {
              category: "security",
              action: "session.logged_out",
              target: session.user.username,
              summary: "Signed out of the administrator session.",
            });
          await auth.logout(sessionId);
          return json(
            res,
            200,
            { authenticated: false },
            { "set-cookie": auth.cookie("", true) },
          );
        }
        if (url.pathname === "/api/account" && req.method === "GET")
          return json(res, 200, { user: session.user });
        if (url.pathname === "/api/account" && req.method === "PATCH") {
          if (!requireCsrf(req, res, session)) return;
          const input = await body(req),
            user = await auth.updateAccount(session.user.id, input, sessionId);
          if (session.user.role === "administrator")
            await recordAudit(session, {
              category: "security",
              action: "account.updated",
              target: user.username,
              summary: "Updated the administrator account.",
              metadata: {
                fields: Object.keys(input).filter(
                  (key) =>
                    !["password", "currentPassword", "newPassword"].includes(
                      key,
                    ),
                ),
                passwordChanged: Boolean(input.password || input.newPassword),
              },
            });
          return json(res, 200, { user: user });
        }
        if (url.pathname === "/api/account/sessions" && req.method === "GET")
          return json(res, 200, {
            items: await auth.listSessions(session.user.id, sessionId),
          });
        if (url.pathname === "/api/discover/status" && req.method === "GET") {
          if (!permitted(res, session, "discover")) return;
          return json(res, 200, {
            configured: discovery.configured(),
            provider: "TMDB",
          });
        }
        if (url.pathname === "/api/settings/discover" && req.method === "GET") {
          if (!administrator(res, session)) return;
          return json(res, 200, {
            configured: discovery.configured(),
            provider: "TMDB",
          });
        }
        if (
          url.pathname === "/api/settings/discover/test" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            candidate = new TmdbDiscoveryService({ token: input.token });
          const result = await candidate.feed("trending", 1);
          return json(res, 200, {
            valid: true,
            provider: "TMDB",
            sampleResults: result.results.length,
          });
        }
        if (
          url.pathname === "/api/settings/discover" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            candidate = new TmdbDiscoveryService({ token: input.token });
          await candidate.feed("trending", 1);
          await engineSettings.saveDiscoveryCredential(input.token);
          discovery.setToken(input.token);
          await recordAudit(session, {
            category: "configuration",
            action: "discover.credential_saved",
            target: "TMDB discovery",
            summary: "Configured the TMDB discovery credential.",
          });
          return json(res, 200, { configured: true, provider: "TMDB" });
        }
        if (
          url.pathname === "/api/settings/discover" &&
          req.method === "DELETE"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          await engineSettings.removeDiscoveryCredential();
          discovery.setToken("");
          await recordAudit(session, {
            category: "configuration",
            action: "discover.credential_removed",
            target: "TMDB discovery",
            summary: "Removed the TMDB discovery credential.",
          });
          return json(res, 200, { configured: false, provider: "TMDB" });
        }
        if (
          url.pathname === "/api/settings/download-folders" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          const saved = await downloadFolderStore.read();
          return json(res, 200, {
            movie: {
              path: saved.movie?.path || defaultDownloadFolder("movie"),
              remotePath: downloadClientRemotePath("movie"),
            },
            tv: {
              path: saved.tv?.path || defaultDownloadFolder("tv"),
              remotePath: downloadClientRemotePath("tv"),
            },
          });
        }
        if (url.pathname === "/api/storage/path-migration/preview" && req.method === "GET") {
          if (!administrator(res, session)) return;
          const domain = String(url.searchParams.get("domain") || ""),
            targetRoot = String(url.searchParams.get("targetRoot") || "");
          return json(res, 200, await mediaPathMigrationPreview(domain, targetRoot));
        }
        if (url.pathname === "/api/storage/engine-path-verification" && req.method === "GET") {
          if (!administrator(res, session)) return;
          const domain = String(url.searchParams.get("domain") || ""),
            path = normalizeMediaPath(url.searchParams.get("path")),
            engineInstanceId = String(url.searchParams.get("engineInstanceId") || "").trim() || null;
          if (!["movie", "tv"].includes(domain) || !path)
            throw new Error("Choose a valid engine path to verify");
          const [rootsValue, libraryValue, collectionsValue] = await Promise.all([
              management.execute(domain, "rootFolders", "GET", {engineInstanceId}),
              management.execute(domain, "library", "GET", {engineInstanceId}),
              domain === "movie" ? management.execute("movie", "collections", "GET", {engineInstanceId}).catch(() => []) : Promise.resolve([]),
            ]),
            roots = Array.isArray(rootsValue) ? rootsValue : [],
            library = Array.isArray(libraryValue) ? libraryValue : libraryValue?.records || [],
            collections = Array.isArray(collectionsValue) ? collectionsValue : collectionsValue?.records || [],
            usesPath = (value) => {
              const current = normalizeMediaPath(value);
              return current === path || current.startsWith(`${path}/`);
            },
            titles = library.filter((item) => usesPath(item.path || item.rootFolderPath)),
            collectionMatches = collections.filter((item) => normalizeMediaPath(item.rootFolderPath) === path),
            sourceIdentity = await filesystemLocationIdentity(path).catch(() => ""),
            equivalentTargets = [];
          if (sourceIdentity)
            for (const root of roots) {
              const target = normalizeMediaPath(root.path);
              if (!target || target === path) continue;
              const identity = await filesystemLocationIdentity(target).catch(() => "");
              if (identity === sourceIdentity) equivalentTargets.push(target);
            }
          return json(res, 200, {
            domain,
            path,
            rootRegistered: roots.some((item) => normalizeMediaPath(item.path) === path),
            titleCount: titles.length,
            collectionCount: collectionMatches.length,
            titleExamples: titles.slice(0, 10).map((item) => item.title || item.name || `ID ${item.id}`),
            collectionExamples: collectionMatches.slice(0, 10).map((item) => item.title || item.name || `Collection ${item.id}`),
            equivalentTargets,
            checkedAt: new Date().toISOString(),
          });
        }
        if (url.pathname === "/api/storage/engine-path-remap" && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const input = await body(req),
            domain = String(input.domain || ""),
            engineInstanceId = String(input.engineInstanceId || "").trim() || null,
            sourceRoot = normalizeMediaPath(input.sourceRoot),
            targetRoot = normalizeMediaPath(input.targetRoot),
            preview = await mediaPathMigrationPreview(domain, targetRoot, sourceRoot, engineInstanceId),
            match = preview.matches.find((item) => item.sourceRoot === sourceRoot);
          if (!match)
            throw new Error("The source and target engine roots do not point to the same physical folder");
          const ids = match.affected.map((item) => item.id),
            idKey = domain === "movie" ? "movieIds" : "seriesIds";
          for (let index = 0; index < ids.length; index += 100)
            await management.execute(domain, "libraryEditor", "PUT", {
              payload: {
                [idKey]: ids.slice(index, index + 100),
                rootFolderPath: targetRoot,
                moveFiles: false,
              },
              engineInstanceId: engineInstanceId,
            });
          let collectionsUpdated = 0;
          if (domain === "movie") {
            const collections = await management.execute("movie", "collections", "GET", {engineInstanceId}).catch(() => []);
            for (const collection of Array.isArray(collections) ? collections : collections?.records || []) {
              if (!Number.isFinite(Number(collection.id)) || normalizeMediaPath(collection.rootFolderPath) !== sourceRoot) continue;
              await management.execute("movie", "collections", "PUT", {
                id: Number(collection.id),
                payload: { ...collection, rootFolderPath: targetRoot },
                engineInstanceId: engineInstanceId,
              });
              collectionsUpdated += 1;
            }
          }
          if (ids.length) await sync.synchronize(domain);
          await recordAudit(session, {
            category: "configuration",
            action: "engine_paths.remapped",
            target: `${sourceRoot} to ${targetRoot}`,
            domain,
            summary: `Remapped ${ids.length} title path${ids.length === 1 ? "" : "s"}${collectionsUpdated ? ` and ${collectionsUpdated} collection path${collectionsUpdated === 1 ? "" : "s"}` : ""} in the ${domain} engine without moving files.`,
            metadata: { sourceRoot, targetRoot, updated: ids.length, collectionsUpdated, moveFiles: false },
          });
          return json(res, 200, { remapped: true, domain, sourceRoot, targetRoot, updated: ids.length, collectionsUpdated, moveFiles: false });
        }
        if (url.pathname === "/api/storage/path-migration" && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const input = await body(req),
            domain = String(input.domain || ""),
            sourceRoot = normalizeMediaPath(input.sourceRoot),
            targetRoot = normalizeMediaPath(input.targetRoot),
            preview = await mediaPathMigrationPreview(domain, targetRoot, sourceRoot),
            match = preview.matches.find((item) => item.sourceRoot === sourceRoot);
          if (!match)
            throw new Error("The old and new paths no longer point to the same folder");
          const availableIds = new Set(match.affected.map((item) => item.id)),
            requestedIds = Array.isArray(input.ids) ? [...new Set(input.ids.map(Number).filter(Number.isFinite))] : null;
          if (requestedIds && requestedIds.length > 100)
            throw new Error("Update at most 100 library locations at a time");
          const ids = requestedIds ? requestedIds.filter((id) => availableIds.has(id)) : [...availableIds],
            idKey = domain === "movie" ? "movieIds" : "seriesIds";
          for (let index = 0; index < ids.length; index += 100)
            await management.execute(domain, "libraryEditor", "PUT", {
              payload: {
                [idKey]: ids.slice(index, index + 100),
                rootFolderPath: targetRoot,
                moveFiles: false,
              },
            });
          let collectionsUpdated = 0;
          if (domain === "movie" && input.final !== false) {
            const collections = await management.execute("movie", "collections", "GET", {}).catch(() => []);
            for (const collection of Array.isArray(collections) ? collections : collections?.records || []) {
              if (!Number.isFinite(Number(collection.id)) || normalizeMediaPath(collection.rootFolderPath) !== sourceRoot) continue;
              await management.execute("movie", "collections", "PUT", {
                id: Number(collection.id),
                payload: { ...collection, rootFolderPath: targetRoot },
              });
              collectionsUpdated += 1;
            }
          }
          let verification = null;
          if (input.final !== false) {
            // The engine is the source of truth. Refresh VynodeArr only after every
            // engine record (and movie collection) has been remapped, then prove
            // that the legacy engine path no longer owns any records.
            await sync.synchronize(domain);
            const [verifiedLibraryValue, verifiedCollectionsValue] = await Promise.all([
                management.execute(domain, "library", "GET", {}),
                domain === "movie"
                  ? management.execute("movie", "collections", "GET", {}).catch(() => [])
                  : Promise.resolve([]),
              ]),
              verifiedLibrary = Array.isArray(verifiedLibraryValue)
                ? verifiedLibraryValue
                : verifiedLibraryValue?.records || [],
              verifiedCollections = Array.isArray(verifiedCollectionsValue)
                ? verifiedCollectionsValue
                : verifiedCollectionsValue?.records || [],
              stillUsesSource = (value) => {
                const path = normalizeMediaPath(value);
                return path === sourceRoot || path.startsWith(`${sourceRoot}/`);
              };
            verification = {
              engineTitlesRemaining: verifiedLibrary.filter((item) =>
                stillUsesSource(item.path || item.rootFolderPath),
              ).length,
              engineCollectionsRemaining: verifiedCollections.filter(
                (item) => normalizeMediaPath(item.rootFolderPath) === sourceRoot,
              ).length,
              vynodeArrSynchronized: true,
            };
            if (verification.engineTitlesRemaining || verification.engineCollectionsRemaining)
              throw new Error(
                `The engine still reports ${verification.engineTitlesRemaining} title path${verification.engineTitlesRemaining === 1 ? "" : "s"} and ${verification.engineCollectionsRemaining} collection path${verification.engineCollectionsRemaining === 1 ? "" : "s"} using ${sourceRoot}. VynodeArr was refreshed, but the migration is not complete.`,
              );
          }
          await recordAudit(session, {
            category: "configuration",
            action: "library_paths.migrated",
            target: `${sourceRoot} to ${targetRoot}`,
            domain,
            summary: `Updated ${ids.length} ${domain === "movie" ? "movie" : "television"} path${ids.length === 1 ? "" : "s"}${collectionsUpdated ? ` and ${collectionsUpdated} collection path${collectionsUpdated === 1 ? "" : "s"}` : ""} without moving files.`,
            metadata: { sourceRoot, targetRoot, updated: ids.length, collectionsUpdated, moveFiles: false },
          });
          return json(res, 200, {
            migrated: true,
            domain,
            sourceRoot,
            targetRoot,
            updated: ids.length,
            collectionsUpdated,
            engineUpdated: true,
            verification,
            affected: match.affected,
            affectedCollections: match.affectedCollections || [],
          });
        }
        if (url.pathname === "/api/storage/available-library-folders" && req.method === "GET") {
          if (!administrator(res, session)) return;
          const definitions = [
            { path: "/movies", label: "Legacy movie library", domain: "movie" },
            { path: "/tv", label: "Legacy television library", domain: "tv" },
          ], roots = await Promise.all([management.execute("movie", "rootFolders", "GET", {}).catch(() => []), management.execute("tv", "rootFolders", "GET", {}).catch(() => [])]), normalized = value => String(value || "").replaceAll("\\", "/").replace(/\/+$/, "") || "/", registered = Object.fromEntries(["movie", "tv"].map((domain, index) => [domain, new Set((Array.isArray(roots[index]) ? roots[index] : []).map(item => normalized(item.path)))])), mountPoints = await readFile("/proc/self/mountinfo", "utf8").then(value => new Set(value.split(/\r?\n/).map(line => line.split(" ")[4]).filter(Boolean).map(path => path.replace(/\\040/g, " ").replace(/\\011/g, "\t").replace(/\\134/g, "\\")))).catch(() => new Set());
          const folders = definitions.map(item => ({ ...item, configured: mountPoints.has(item.path), registered: registered[item.domain].has(item.path) }));
          const ignoredMediaChildren = new Set(["cdrom", "floppy", "usb"]);
          const mediaChildren = await readdir("/media", { withFileTypes: true }).then(items => items.filter(item => item.isDirectory() && !item.name.startsWith(".") && !ignoredMediaChildren.has(item.name.toLowerCase())).slice(0, 200).map(item => { const path = `/media/${item.name}`;return { path, label: item.name.replace(/[-_]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()), domain: null, configured: true, registeredMovie: registered.movie.has(path), registeredTv: registered.tv.has(path) }; })).catch(() => []);
          return json(res, 200, { mainMediaConfigured: mountPoints.has("/media"), folders, mediaChildren: mountPoints.has("/media") ? mediaChildren : [] });
        }
        if (url.pathname === "/api/storage/library-folder-children" && req.method === "GET") {
          if (!administrator(res, session)) return;
          const requested = normalizeMediaPath(url.searchParams.get("path")),
            segments = requested.split("/").filter(Boolean);
          if (!requested.startsWith("/media/") || segments.includes(".") || segments.includes("..") || segments.length > 9)
            throw new Error("Choose a folder inside the main /media mapping");
          const [movieRoots, tvRoots] = await Promise.all([
              management.execute("movie", "rootFolders", "GET", {}).catch(() => []),
              management.execute("tv", "rootFolders", "GET", {}).catch(() => []),
            ]),
            registeredMovie = new Set((Array.isArray(movieRoots) ? movieRoots : []).map((item) => normalizeMediaPath(item.path))),
            registeredTv = new Set((Array.isArray(tvRoots) ? tvRoots : []).map((item) => normalizeMediaPath(item.path))),
            ignored = new Set(["cdrom", "floppy", "usb"]),
            folders = (await readdir(requested, { withFileTypes: true }))
              .filter((item) => item.isDirectory() && !item.name.startsWith(".") && !ignored.has(item.name.toLowerCase()))
              .slice(0, 200)
              .map((item) => {
                const path = `${requested}/${item.name}`;
                return { path, label: item.name.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), domain: null, configured: true, registeredMovie: registeredMovie.has(path), registeredTv: registeredTv.has(path) };
              })
              .sort((left, right) => left.label.localeCompare(right.label));
          return json(res, 200, { parent: requested, folders });
        }
        if (url.pathname === "/api/media-destinations" && req.method === "GET") {
          const requestedDomain = url.searchParams.get("domain"),
            requestedInstanceId = String(url.searchParams.get("engineInstanceId") || "").trim(),
            domains = requestedDomain ? [requestedDomain] : ["movie", "tv"];
          if (domains.some((value) => !["movie", "tv"].includes(value)))
            throw new Error("Choose Movies or Television");
          const administratorSession = session.user.role === "administrator";
          for (const domain of domains)
            if (!administratorSession && !session.user.permissions?.[domain === "movie" ? "movies" : "tv"])
              return json(res, 403, { error: { code: "forbidden", message: "This library is not available to your account." } });
          const groupedContexts = await Promise.all(domains.map(async(domain) => {
              if (!requestedInstanceId) return allMediaDestinationContexts(domain, administratorSession);
              const instance = enabledEngineInstances(domain).find((item) => String(item.id || "") === requestedInstanceId);
              if (!instance) throw new Error("Choose an available engine instance");
              return [{ instance, context: await mediaDestinationContext(domain, administratorSession, instance.id) }];
            })),
            contexts = groupedContexts.flatMap((values) => values.map(({ instance, context }) => ({
              ...context,
              destinations: context.destinations.map((item) => ({ ...item, engineInstanceId: instance.id, engineInstanceName: instance.name })),
            })));
          if (administratorSession && url.searchParams.get("includeUsage") === "true")
            await Promise.all(contexts.map(async(context)=>{const destination=context.destinations[0];if(!destination)return;const raw=await management.execute(destination.domain,"library","GET",{engineInstanceId:destination.engineInstanceId}).catch(()=>[]),items=Array.isArray(raw)?raw:raw?.records||[];context.destinations=context.destinations.map(item=>{const root=String(item.rootFolderPath||"").replaceAll("\\","/").replace(/\/+$/,"").toLowerCase(),titleCount=items.filter(record=>{const path=String(record.path||record.rootFolderPath||"").replaceAll("\\","/").toLowerCase();return path===root||path.startsWith(`${root}/`);}).length;return{...item,titleCount};});}));
          return json(res, 200, {
            destinations: contexts.flatMap((value) => value.destinations),
            roots: Object.fromEntries(domains.map((domain, index) => [domain, groupedContexts[index].flatMap(({ instance, context }) => context.roots.map((item) => ({ ...item, engineInstanceId: instance.id, engineInstanceName: instance.name })))])),
            profiles: Object.fromEntries(domains.map((domain, index) => [domain, groupedContexts[index].flatMap(({ instance, context }) => context.profiles.map((item) => ({ ...item, engineInstanceId: instance.id, engineInstanceName: instance.name })))])),
            plexLibraries: [...new Map(contexts.flatMap((value) => value.plexLibraries).map((item) => [String(item.key), item])).values()],
          });
        }
        if (url.pathname === "/api/media-destinations" && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const input = await body(req),domain = input.domain === "tv" ? "tv" : input.domain === "movie" ? "movie" : null;
          if (!domain) throw new Error("Choose Movies or Television");
          const context = await mediaDestinationContext(domain, true, input.engineInstanceId || null),record = await mediaDestinations.save(input, context);
          await recordAudit(session, { category: "configuration", action: "media_destination.created", target: record.name, domain, summary: `Created the ${record.name} media destination.`, metadata: { destinationId: record.id, rootFolderPath: record.rootFolderPath } });
          return json(res, 201, { destination: record });
        }
        const mediaDestinationMatch = url.pathname.match(/^\/api\/media-destinations\/(destination_[A-Za-z0-9_-]+)$/);
        if (mediaDestinationMatch && req.method === "PUT") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const input = await body(req),stored = await mediaDestinations.state(),existing = stored.destinations.find((item) => item.id === mediaDestinationMatch[1]);
          if (!existing) return json(res, 404, { error: { code: "not_found", message: "Media destination not found." } });
          const engineInstanceId = input.engineInstanceId || existing.engineInstanceId || null,
            context = await mediaDestinationContext(existing.domain, true, engineInstanceId),record = await mediaDestinations.save({ ...existing, ...input, engineInstanceId, id: existing.id, domain: existing.domain }, context);
          await recordAudit(session, { category: "configuration", action: "media_destination.updated", target: record.name, domain: record.domain, summary: `Updated the ${record.name} media destination.`, metadata: { destinationId: record.id, rootFolderPath: record.rootFolderPath } });
          return json(res, 200, { destination: record });
        }
        if (mediaDestinationMatch && req.method === "DELETE") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const removed = await mediaDestinations.remove(mediaDestinationMatch[1]);
          if (!removed) return json(res, 404, { error: { code: "not_found", message: "Media destination not found." } });
          await recordAudit(session, { category: "configuration", action: "media_destination.removed", target: removed.name, domain: removed.domain, summary: `Removed the ${removed.name} media destination without moving or deleting media.`, metadata: { destinationId: removed.id } });
          return json(res, 200, { removed: true });
        }
        if (
          url.pathname === "/api/settings/download-folders" &&
          req.method === "PUT"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            domain = String(input.domain || ""),
            path =
              String(input.path || "")
                .trim()
                .replaceAll("\\", "/")
                .replace(/\/+$/, "") || "/";
          if (!["movie", "tv"].includes(domain) || !path.startsWith("/"))
            throw new Error("Choose an absolute download folder");
          const client = registry.get(domain).client;
          const listing = await client.get("filesystem", {
            path: path,
            includeFiles: false,
            allowFoldersWithoutTrailingSlashes: true,
          });
          if (listing?.exists === false)
            throw new Error(
              "The selected download folder is not accessible to this engine",
            );
          const current = await downloadFolderStore.read(),
            next = {
              ...current,
              [domain]: { path: path },
              updatedAt: new Date().toISOString(),
            };
          await downloadFolderStore.write(next);
          const mappings = await ensureBundledDownloadPathMappings(domain);
          const failed = mappings?.find((item) => item.configured === false);
          if (failed)
            throw new Error(
              `Download folder saved, but the engine mapping could not be applied: ${failed.error}`,
            );
          await recordAudit(session, {
            category: "configuration",
            action: "download_folder.updated",
            target: path,
            domain: domain,
            summary: `Updated the ${domain === "movie" ? "movie" : "television"} download folder.`,
          });
          return json(res, 200, {
            saved: true,
            domain: domain,
            path: path,
            mappings: mappings || [],
          });
        }
        if (
          url.pathname.match(/^\/api\/reeltrack\/poster\/(movie|tv)\/(\d+)$/) &&
          req.method === "GET"
        ) {
          if (!permitted(res, session, "discover")) return;
          const match = url.pathname.match(/^\/api\/reeltrack\/poster\/(movie|tv)\/(\d+)$/),
            metadata = await discovery.details(match[1], Number(match[2]));
          if (!metadata?.poster) return json(res, 404, { message: "Poster unavailable" });
          res.writeHead(302, {
            location: metadata.poster,
            "cache-control": "private, max-age=21600",
          });
          return res.end();
        }
        if (
          url.pathname === "/api/reeltrack/poster-design/preview" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const input = await body(req),
            domain = input.domain === "tv" ? "tv" : "movie",
            template = reeltrackPosterTemplate(input.template, domain);
          if (!template?.layers?.length) throw new Error("Add at least one poster layer.");
          let poster = null;
          if (input.mode === "title" && Number(input.tmdbId) > 0) {
            const metadata = await discovery.details(domain, Number(input.tmdbId));
            if (metadata?.poster) {
              const response = await fetch(metadata.poster, { signal: AbortSignal.timeout(10000) });
              if (response.ok) poster = Buffer.from(await response.arrayBuffer());
            }
          }
          const rendered = await renderedReeltrackArtwork(
            template,
            {
              title: input.title || "Example title",
              year: input.year || new Date().getUTCFullYear(),
              collection: input.collectionName || "My collection",
              collectionName: input.collectionName || "My collection",
              collectionTitleCount: Number(input.titleCount) || 12,
              collectionMediaType: domain === "tv" ? "Television" : "Movies",
              collectionLastSync: new Date().toISOString(),
            },
            poster,
          );
          return json(res, 200, {
            image: `data:image/jpeg;base64,${rendered.toString("base64")}`,
          });
        }
        if (
          url.pathname === "/api/reeltrack/poster-design/background" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const input = await body(req, 8e6), match = String(input.image || "").match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
          if (!match) throw new Error("Choose a JPEG, PNG, or WebP background image.");
          const image = Buffer.from(match[2], "base64");
          if (!image.length || image.length > 5e6) throw new Error("Background images must be 5 MB or smaller.");
          const sharp = (await import("sharp")).default, metadata = await sharp(image).metadata();
          if (!metadata.width || !metadata.height || metadata.width < 300 || metadata.height < 450)
            throw new Error("Background images must be at least 300 × 450 pixels.");
          const extension = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase(), asset = `${randomUUID()}.${extension}`;
          await mkdir(reeltrackPosterBackgroundDir, { recursive: true });
          await writeFile(join(reeltrackPosterBackgroundDir, asset), image, { mode: 384, flag: "wx" });
          return json(res, 201, { asset, preview: `/api/reeltrack/poster-design/background/${asset}` });
        }
        const reeltrackBackgroundMatch = url.pathname.match(/^\/api\/reeltrack\/poster-design\/background\/([a-f0-9-]{36}\.(?:jpe?g|png|webp))$/i);
        if (reeltrackBackgroundMatch && req.method === "GET") {
          if (!administrator(res, session)) return;
          const asset = reeltrackBackgroundMatch[1], image = await readFile(join(reeltrackPosterBackgroundDir, asset)).catch(() => null);
          if (!image) return json(res, 404, { message: "Background unavailable" });
          const extension = asset.split(".").at(-1)?.toLowerCase();
          res.writeHead(200, { "content-type": extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg", "cache-control": "private, max-age=86400", "content-length": String(image.length) });
          return res.end(image);
        }
        if (
          url.pathname === "/api/reeltrack/trailers/folders" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          const domain = url.searchParams.get("domain") === "tv" ? "tv" : "movie",
            configuredRoot = resolve(localLibraryRoot(domain)), sharedRoot = resolve("/media"),
            requested = resolve(String(url.searchParams.get("path") || configuredRoot)),
            root = requested === sharedRoot || requested.startsWith(`${sharedRoot}${sep}`) ? sharedRoot : configuredRoot;
          if (requested !== root && !requested.startsWith(`${root}${sep}`))
            throw new Error("Choose a folder inside a configured VynodeArr library root.");
          const directories = (await readdir(requested, { withFileTypes: true }))
            .filter((entry) => entry.isDirectory())
            .map((entry) => ({ name: entry.name, path: join(requested, entry.name) }))
            .sort((left, right) => left.name.localeCompare(right.name));
          return json(res, 200, { root, path: requested, directories });
        }
        if (
          url.pathname === "/api/reeltrack/trailers/status" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          const [downloader, storedPlexSettings, plexToken, movieRoots, tvRoots] = await Promise.all([
            trailerDownloader.status(),
            plexSettingsStore.read(),
            engineSettings.plexCredential(),
            management.execute("movie", "rootFolders", "GET", {}).catch(() => []),
            management.execute("tv", "rootFolders", "GET", {}).catch(() => []),
          ]);
          let plexSettings = storedPlexSettings;
          if (storedPlexSettings.endpoint && plexToken)
            try {
              const inspection = await plexService.inspect(storedPlexSettings.endpoint, plexToken);
              plexSettings = { version: 1, ...inspection, updatedAt: new Date().toISOString() };
              await plexSettingsStore.write(plexSettings);
            } catch {}
          return json(res, 200, {
            ...downloader,
            plexConfigured: Boolean(plexSettings.endpoint && plexToken),
            plexServer: plexSettings.server || null,
            libraries: plexSettings.libraries || [],
            engineRoots: { movie: movieRoots || [], tv: tvRoots || [] },
            hostRoots: { movie: localLibraryRoot("movie"), tv: localLibraryRoot("tv") },
          });
        }
        if (
          url.pathname === "/api/reeltrack/trailers/root-folder" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            domain = input.domain === "tv" ? "tv" : "movie",
            expectedType = domain === "tv" ? "show" : "movie",
            settings = await plexSettingsStore.read(),
            library = (settings.libraries || []).find(
              (item) => item.type === expectedType && String(item.key) === String(input.libraryKey),
            ),
            path = String(library?.locations?.[0] || "").trim();
          if (!library || !path)
            throw new Error(`Choose a Plex ${domain === "tv" ? "television" : "movie"} library with a reported location.`);
          const existing = await management.execute(domain, "rootFolders", "GET", {}),
            present = (existing || []).find((root) => plexPathValue(root.path) === plexPathValue(path));
          const root = present || await management.execute(domain, "rootFolders", "POST", { payload: { path } });
          await recordAudit(session, {
            category: "configuration",
            action: "reeltrack.root_folder_added",
            target: path,
            domain,
            summary: `${present ? "Confirmed" : "Added"} the selected Plex location as a ${domain === "tv" ? "television" : "movie"} root folder.`,
            metadata: { libraryKey: library.key },
          });
          return json(res, present ? 200 : 201, { root, existing: Boolean(present) });
        }
        if (
          url.pathname === "/api/reeltrack/trailers/download" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            domain = input.domain === "tv" ? "tv" : "movie",
            tmdbId = Number(input.tmdbId),
            listId = String(input.listId || ""),
            snapshot = await reeltrackSnapshotForUser(session.user.id),
            list = (snapshot.importedLists || []).find(
              (item) => String(item.id) === listId,
            ),
            sourceItem = (list?.items || []).find((item) => {
              const itemDomain =
                String(item.domain || item.type).toLowerCase().includes("tv") ||
                String(item.type).toLowerCase().includes("show")
                  ? "tv"
                  : "movie";
              const itemTmdbId =
                Number(item.tmdbId) ||
                (String(item.source).toLowerCase() === "tmdb"
                  ? Number(item.externalId)
                  : 0);
              return itemDomain === domain && itemTmdbId === tmdbId;
            });
          if (!list || !sourceItem || !Number.isInteger(tmdbId) || tmdbId < 1)
            throw new Error("Choose a TMDB-backed title from an imported Reeltrack list.");
          const metadata = await discovery.details(domain, tmdbId);
          if (!metadata?.trailer?.url)
            throw new Error("TMDB does not list a YouTube trailer for this title.");
          const trailer = await trailerDownloader.download({
            url: metadata.trailer.url,
            title: metadata.title || sourceItem.title,
            year: metadata.year || sourceItem.year,
            domain: domain,
            tmdbId: tmdbId,
            root: mappedLibraryRoot(domain, list.automation || {}),
          });
          await recordAudit(session, {
            category: "integration",
            action: "reeltrack.trailer_downloaded",
            target: trailer.title,
            domain: domain,
            summary: `Downloaded a Reeltrack trailer into its managed movie folder.`,
            metadata: { listId: listId, tmdbId: tmdbId, path: trailer.path },
          });
          return json(res, 201, { trailer: trailer });
        }
        if (url.pathname === "/api/reeltrack/status" && req.method === "GET") {
          if (!permitted(res, session, "discover")) return;
          const [credential, snapshot] = await Promise.all([
            engineSettings.reeltrackCredential(session.user.id),
            reeltrackSnapshotForUser(session.user.id),
          ]);
          return json(res, 200, {
            configured: Boolean(credential),
            importedCount: snapshot.importedLists?.length || 0,
            updatedAt: snapshot.updatedAt || null,
          });
        }
        if (url.pathname === "/api/reeltrack/test" && req.method === "POST") {
          if (
            !permitted(res, session, "discover") ||
            !requireCsrf(req, res, session)
          )
            return;
          const input = await body(req),
            apiKey = String(input.apiKey || "").trim();
          if (!apiKey) throw new Error("Enter a Reeltrack API key.");
          const lists = await reeltrackAvailableLists(apiKey);
          return json(res, 200, { valid: true, listCount: lists.length });
        }
        if (
          url.pathname === "/api/reeltrack/connection" &&
          req.method === "PUT"
        ) {
          if (
            !permitted(res, session, "discover") ||
            !requireCsrf(req, res, session)
          )
            return;
          const input = await body(req),
            apiKey = String(input.apiKey || "").trim();
          if (!apiKey) throw new Error("Enter a Reeltrack API key.");
          const lists = await reeltrackAvailableLists(apiKey);
          await engineSettings.saveReeltrackCredential(session.user.id, apiKey);
          await recordAudit(session, {
            category: "integration",
            action: "reeltrack.connected",
            target: "Reeltrack",
            summary: `Connected Reeltrack with ${lists.length} available list${lists.length === 1 ? "" : "s"}.`,
          });
          return json(res, 200, {
            configured: true,
            listCount: lists.length,
          });
        }
        if (
          url.pathname === "/api/reeltrack/connection" &&
          req.method === "DELETE"
        ) {
          if (
            !permitted(res, session, "discover") ||
            !requireCsrf(req, res, session)
          )
            return;
          await engineSettings.removeReeltrackCredential(session.user.id);
          await recordAudit(session, {
            category: "integration",
            action: "reeltrack.disconnected",
            target: "Reeltrack",
            summary: "Removed the protected Reeltrack API key. Imported snapshots were retained.",
          });
          return json(res, 200, { configured: false });
        }
        if (
          url.pathname === "/api/reeltrack/available-lists" &&
          req.method === "GET"
        ) {
          if (!permitted(res, session, "discover")) return;
          const apiKey = await engineSettings.reeltrackCredential(
            session.user.id,
          );
          if (!apiKey)
            return json(res, 409, {
              error: {
                code: "reeltrack_not_connected",
                message: "Connect Reeltrack before loading lists.",
              },
            });
          const [available, snapshot] = await Promise.all([
              reeltrackAvailableLists(apiKey),
              reeltrackSnapshotForUser(session.user.id),
            ]),
            imported = new Set(
              (snapshot.importedLists || []).map((item) => String(item.id)),
            );
          return json(res, 200, {
            items: available.map((item) => ({
              ...item,
              imported: imported.has(String(item.id)),
            })),
          });
        }
        if (
          url.pathname === "/api/reeltrack/imported-lists" &&
          req.method === "GET"
        ) {
          if (!permitted(res, session, "discover")) return;
          const snapshot = await reeltrackSnapshotForUser(session.user.id);
          return json(res, 200, {
            items: await matchedReeltrackLists(
              session,
              snapshot.importedLists || [],
            ),
            updatedAt: snapshot.updatedAt || null,
          });
        }
        if (
          url.pathname === "/api/reeltrack/imported-lists" &&
          req.method === "POST"
        ) {
          if (
            !permitted(res, session, "discover") ||
            !requireCsrf(req, res, session)
          )
            return;
          const input = await body(req),
            selected = new Set(
              (Array.isArray(input.listIds) ? input.listIds : []).map(String),
            ),
            automationInput = input.automation || {},
            automationEnabled =
              session.user.role === "administrator" && automationInput.enabled === true,
            [apiKey, previous, plexSettings, plexToken] = await Promise.all([
              engineSettings.reeltrackCredential(session.user.id),
              reeltrackSnapshotForUser(session.user.id),
              plexSettingsStore.read(),
              engineSettings.plexCredential(),
            ]);
          if (!apiKey) throw new Error("Connect Reeltrack before importing lists.");
          if (!selected.size) throw new Error("Choose at least one Reeltrack list.");
          if (automationEnabled) {
            if (!plexSettings.endpoint || !plexToken)
              throw new Error("Connect Plex before enabling list automation.");
          }
          const available = await reeltrackAvailableLists(apiKey),
            chosen = available.filter((item) => selected.has(String(item.id))),
            previousById = new Map(
              (previous.importedLists || []).map((item) => [String(item.id), item]),
            );
          if (!chosen.length) throw new Error("The selected Reeltrack lists are no longer available.");
          const selectedImports = await Promise.all(
              chosen.map(async (list) => {
                const items = await reeltrackListItems(apiKey, list.id),
                  domains = new Set(items.map(reeltrackItemIdentity).filter((item) => item.tmdbId).map((item) => item.domain)),
                  movieLibrary = (plexSettings.libraries || []).find((item) => item.type === "movie" && String(item.key) === String(automationInput.plexMovieLibraryKey)),
                  tvLibrary = (plexSettings.libraries || []).find((item) => item.type === "show" && String(item.key) === String(automationInput.plexTvLibraryKey));
                if (automationEnabled && domains.has("movie") && !movieLibrary) throw new Error(`Choose a Plex movie library for ${list.name}.`);
                if (automationEnabled && domains.has("tv") && !tvLibrary) throw new Error(`Choose a Plex television library for ${list.name}.`);
                if (automationEnabled && domains.has("movie")) mappedLibraryRoot("movie", automationInput);
                if (automationEnabled && domains.has("tv")) mappedLibraryRoot("tv", automationInput);
                return {
                ...list,
                items,
                importedAt: new Date().toISOString(),
                automation: previousById.has(String(list.id))
                  ? previousById.get(String(list.id))?.automation || null
                  : automationEnabled ? {
                      enabled: false,
                      downloadTrailers: true,
                      plexMovieLibraryKey: String(automationInput.plexMovieLibraryKey || ""),
                      plexTvLibraryKey: String(automationInput.plexTvLibraryKey || ""),
                      movieMediaDestinationId: String(automationInput.movieMediaDestinationId || ""),
                      tvMediaDestinationId: String(automationInput.tvMediaDestinationId || ""),
                      movieHostRoot: String(automationInput.movieHostRoot || localLibraryRoot("movie")),
                      tvHostRoot: String(automationInput.tvHostRoot || localLibraryRoot("tv")),
                      collectionName: String(list.name || "Reeltrack").trim().slice(0, 120),
                      intervalMinutes: Math.max(
                        15,
                        Math.min(1440, Number(automationInput.intervalMinutes) || 60),
                      ),
                      status: "disabled",
                      error: null,
                      nextRunAt: null,
                    }
                  : null,
              };}),
            ),
            selectedById = new Map(selectedImports.map((item) => [String(item.id), item])),
            importedLists = [
              ...(previous.importedLists || []).map((item) => selectedById.get(String(item.id)) || item),
              ...selectedImports.filter((item) => !previousById.has(String(item.id))),
            ],
            snapshot = {
              importedLists,
              updatedAt: new Date().toISOString(),
            };
          await saveReeltrackSnapshot(session.user.id, snapshot);
          await recordAudit(session, {
            category: "integration",
            action: "reeltrack.lists_imported",
            target: "Reeltrack lists",
            summary: `Added or refreshed ${selectedImports.length} Reeltrack list${selectedImports.length === 1 ? "" : "s"}.`,
            metadata: { listIds: [...selected] },
          });
          return json(res, 200, {
            items: await matchedReeltrackLists(session, importedLists),
            updatedAt: snapshot.updatedAt,
          });
        }
        if (url.pathname === "/api/reeltrack/sync" && req.method === "POST") {
          if (
            !permitted(res, session, "discover") ||
            !requireCsrf(req, res, session)
          )
            return;
          const [apiKey, current] = await Promise.all([
            engineSettings.reeltrackCredential(session.user.id),
            reeltrackSnapshotForUser(session.user.id),
          ]);
          if (!apiKey) throw new Error("Connect Reeltrack before synchronizing lists.");
          const wanted = new Set(
              (current.importedLists || []).map((item) => String(item.id)),
            ),
            currentById = new Map(
              (current.importedLists || []).map((item) => [String(item.id), item]),
            ),
            available = await reeltrackAvailableLists(apiKey),
            availableIds = new Set(available.map((item) => String(item.id))),
            synchronizedLists = await Promise.all(
              available
                .filter((item) => wanted.has(String(item.id)))
                .map(async (list) => ({
                  ...list,
                  items: await reeltrackListItems(apiKey, list.id),
                  importedAt: new Date().toISOString(),
                  automation: currentById.get(String(list.id))?.automation || null,
                })),
            ),
            importedLists = [
              ...synchronizedLists,
              ...(current.importedLists || []).filter(
                (item) => item.automation?.enabled && !availableIds.has(String(item.id)),
              ),
            ],
            snapshot = {
              importedLists,
              updatedAt: new Date().toISOString(),
            };
          await saveReeltrackSnapshot(session.user.id, snapshot);
          for (const list of importedLists)
            if (list.automation?.enabled)
              void runReeltrackPlexAutomation(session.user.id, list.id).catch(() => {});
          return json(res, 200, {
            items: await matchedReeltrackLists(session, importedLists),
            updatedAt: snapshot.updatedAt,
          });
        }
        const reeltrackAutomationMatch = url.pathname.match(
          /^\/api\/reeltrack\/imported-lists\/([^/]+)\/automation(?:\/(run|repair-trailers))?$/,
        );
        const reeltrackArtworkRestoreMatch = url.pathname.match(
          /^\/api\/reeltrack\/imported-lists\/([^/]+)\/artwork\/(collection|titles)\/restore$/,
        );
        if (reeltrackArtworkRestoreMatch && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          await body(req);
          const listId = decodeURIComponent(reeltrackArtworkRestoreMatch[1]),
            artwork = reeltrackArtworkRestoreMatch[2],
            activeRun = reeltrackAutomationRuns.get(`${session.user.id}:${listId}`);
          if (activeRun) await activeRun.catch(() => {});
          const current = await reeltrackSnapshotForUser(session.user.id),
            index = (current.importedLists || []).findIndex((item) => String(item.id) === listId);
          if (index < 0) throw new Error("The imported Reeltrack list no longer exists.");
          const list = current.importedLists[index], automation = list.automation || {},
            [settings, token] = await Promise.all([plexSettingsStore.read(), engineSettings.plexCredential()]);
          if (!settings.endpoint || !token) throw new Error("Reconnect Plex before restoring artwork.");
          const kind = artwork === "collection" ? "collection" : "title", restored = [];
          for (const domain of ["movie", "tv"])
            restored.push(...await restoreReeltrackArtwork({ automation, endpoint: settings.endpoint, token, machineIdentifier: settings.server?.machineIdentifier || "", domain, kind }));
          if (artwork === "collection") automation.collectionPosterTemplate = null;
          else automation.titleOverlayTemplate = null;
          current.importedLists[index].automation = automation;
          current.updatedAt = new Date().toISOString();
          await saveReeltrackSnapshot(session.user.id, current);
          let restoredList = current.importedLists[index];
          if (artwork === "collection" && automation.enabled)
            restoredList = await runReeltrackPlexAutomation(session.user.id, listId, { refreshProvider: false });
          await recordAudit(session, {
            category: "automation",
            action: artwork === "collection" ? "reeltrack.collection_poster_restored" : "reeltrack.title_overlays_restored",
            target: list.name,
            summary: `Restored ${restored.length} original Plex poster${restored.length === 1 ? "" : "s"} for this Reeltrack list.`,
            metadata: { listId, artwork, restored },
          });
          return json(res, 200, {
            restored: restored.length,
            item: (await matchedReeltrackLists(session, [restoredList]))[0],
          });
        }
        if (
          reeltrackAutomationMatch &&
          req.method === "PUT" &&
          !reeltrackAutomationMatch[2]
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const listId = decodeURIComponent(reeltrackAutomationMatch[1]),
            input = await body(req),
            current = await reeltrackSnapshotForUser(session.user.id),
            index = (current.importedLists || []).findIndex(
              (item) => String(item.id) === listId,
            );
          if (index < 0) throw new Error("The imported Reeltrack list no longer exists.");
          const enabled = input.enabled === true,
            domains = new Set((current.importedLists[index].items || []).map(reeltrackItemIdentity).filter((item) => item.tmdbId).map((item) => item.domain)),
            destinationState = await mediaDestinations.state(),
            movieDestination = domains.has("movie") ? destinationState.destinations.find((item) => item.domain === "movie" && item.id === String(input.movieMediaDestinationId || "")) : null,
            tvDestination = domains.has("tv") ? destinationState.destinations.find((item) => item.domain === "tv" && item.id === String(input.tvMediaDestinationId || "")) : null,
            plexMovieLibraryKey = String(movieDestination?.plexLibraryKey || input.plexMovieLibraryKey || ""),
            plexTvLibraryKey = String(tvDestination?.plexLibraryKey || input.plexTvLibraryKey || ""),
            movieHostRoot = String(movieDestination?.vynodePath || input.movieHostRoot || localLibraryRoot("movie")),
            tvHostRoot = String(tvDestination?.vynodePath || input.tvHostRoot || localLibraryRoot("tv"));
          if (domains.has("movie") && input.movieMediaDestinationId && !movieDestination) throw new Error("Choose an available movie destination.");
          if (domains.has("tv") && input.tvMediaDestinationId && !tvDestination) throw new Error("Choose an available television destination.");
          if (movieDestination?.plexLibraryKey && String(movieDestination.plexLibraryKey) !== plexMovieLibraryKey)
            throw new Error(`${movieDestination.name} is tied to a different Plex movie library. Update the destination mapping or choose its mapped library.`);
          if (tvDestination?.plexLibraryKey && String(tvDestination.plexLibraryKey) !== plexTvLibraryKey)
            throw new Error(`${tvDestination.name} is tied to a different Plex television library. Update the destination mapping or choose its mapped library.`);
          if (enabled) {
            const [settings, token, downloader] = await Promise.all([
              plexSettingsStore.read(),
              engineSettings.plexCredential(),
              trailerDownloader.status(),
            ]);
            if (!settings.endpoint || !token)
              throw new Error("Connect Plex before enabling list automation.");
            if (!downloader.available) throw new Error(downloader.message || "yt-dlp is unavailable.");
            if (domains.has("movie") && !(settings.libraries || []).some((item) => item.type === "movie" && String(item.key) === plexMovieLibraryKey))
              throw new Error("Choose a discovered Plex movie library.");
            if (domains.has("tv") && !(settings.libraries || []).some((item) => item.type === "show" && String(item.key) === plexTvLibraryKey))
              throw new Error("Choose a discovered Plex television library.");
            if (input.splitLibraryMode) {
              if (domains.has("movie") && !(settings.libraries || []).some((item) => item.type === "movie" && String(item.key) === String(input.plexMoviePlaceholderLibraryKey))) throw new Error("Choose a discovered Plex movie placeholder library.");
              if (domains.has("tv") && !(settings.libraries || []).some((item) => item.type === "show" && String(item.key) === String(input.plexTvPlaceholderLibraryKey))) throw new Error("Choose a discovered Plex television placeholder library.");
              if (domains.has("movie") && plexMovieLibraryKey === String(input.plexMoviePlaceholderLibraryKey)) throw new Error("Choose different real-media and placeholder movie libraries.");
              if (domains.has("tv") && plexTvLibraryKey === String(input.plexTvPlaceholderLibraryKey)) throw new Error("Choose different real-media and placeholder television libraries.");
            }
            if (domains.has("movie")) mappedLibraryRoot("movie", { ...input, movieHostRoot });
            if (domains.has("tv")) mappedLibraryRoot("tv", { ...input, tvHostRoot });
          }
          current.importedLists[index].automation = {
            ...(current.importedLists[index].automation || {}),
            enabled,
            downloadTrailers: input.downloadTrailers !== false,
            plexMovieLibraryKey: domains.has("movie") ? plexMovieLibraryKey : "",
            plexTvLibraryKey: domains.has("tv") ? plexTvLibraryKey : "",
            splitLibraryMode: input.splitLibraryMode === true,
            plexMoviePlaceholderLibraryKey: input.splitLibraryMode && domains.has("movie") ? String(input.plexMoviePlaceholderLibraryKey || "") : "",
            plexTvPlaceholderLibraryKey: input.splitLibraryMode && domains.has("tv") ? String(input.plexTvPlaceholderLibraryKey || "") : "",
            moviePlaceholderHostRoot: input.splitLibraryMode && domains.has("movie") ? String(input.moviePlaceholderHostRoot || movieHostRoot) : "",
            tvPlaceholderHostRoot: input.splitLibraryMode && domains.has("tv") ? String(input.tvPlaceholderHostRoot || tvHostRoot) : "",
            movieMediaDestinationId: domains.has("movie") ? String(input.movieMediaDestinationId || "") : "",
            tvMediaDestinationId: domains.has("tv") ? String(input.tvMediaDestinationId || "") : "",
            movieHostRoot,
            tvHostRoot,
            collectionName:
              String(input.collectionName || current.importedLists[index].name || "Reeltrack").trim().slice(0, 120),
            collectionPosterTemplate: Object.hasOwn(input, "collectionPosterTemplate")
              ? reeltrackPosterTemplate(input.collectionPosterTemplate)
              : current.importedLists[index].automation?.collectionPosterTemplate || null,
            titleOverlayTemplate: Object.hasOwn(input, "titleOverlayTemplate")
              ? reeltrackPosterTemplate(input.titleOverlayTemplate)
              : current.importedLists[index].automation?.titleOverlayTemplate || null,
            realTitleOverlayTemplate: Object.hasOwn(input, "realTitleOverlayTemplate")
              ? reeltrackPosterTemplate(input.realTitleOverlayTemplate)
              : current.importedLists[index].automation?.realTitleOverlayTemplate || null,
            intervalMinutes: Math.max(15, Math.min(1440, Number(input.intervalMinutes) || 60)),
            status: enabled ? "scheduled" : "disabled",
            error: null,
            nextRunAt: enabled ? new Date().toISOString() : null,
          };
          current.updatedAt = new Date().toISOString();
          await saveReeltrackSnapshot(session.user.id, current);
          await recordAudit(session, {
            category: "automation",
            action: enabled ? "reeltrack.plex_automation_enabled" : "reeltrack.plex_automation_disabled",
            target: current.importedLists[index].name,
            summary: `${enabled ? "Enabled" : "Disabled"} managed Plex trailer collection automation.`,
            metadata: { listId, plexMovieLibraryKey: input.plexMovieLibraryKey || null, plexTvLibraryKey: input.plexTvLibraryKey || null },
          });
          if (enabled)
            void runReeltrackPlexAutomation(session.user.id, listId).catch(() => {});
          return json(res, 200, {
            item: (await matchedReeltrackLists(session, [current.importedLists[index]]))[0],
          });
        }
        if (
          reeltrackAutomationMatch &&
          req.method === "POST" &&
          reeltrackAutomationMatch[2] === "repair-trailers"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const listId = decodeURIComponent(reeltrackAutomationMatch[1]), current = await reeltrackSnapshotForUser(session.user.id),
            index = (current.importedLists || []).findIndex((item) => String(item.id) === String(listId));
          if (index < 0) throw new Error("The imported Reeltrack list no longer exists.");
          const automation = current.importedLists[index].automation || {}, jobs = { ...(automation.jobs || {}) };
          let found = 0;
          for (const [key, job] of Object.entries(jobs)) {
            const missing = job?.error || !job?.path || (typeof trailerDownloader.exists === "function" && !(await trailerDownloader.exists(job)));
            if (missing) { delete jobs[key]; found += 1; }
          }
          current.importedLists[index].automation = { ...automation, jobs };
          await saveReeltrackSnapshot(session.user.id, current);
          const item = await runReeltrackPlexAutomation(session.user.id, listId, { refreshProvider: false });
          return json(res, 200, { item: (await matchedReeltrackLists(session, [item]))[0], found, repaired: item.automation?.summary?.downloaded || 0 });
        }
        if (
          reeltrackAutomationMatch &&
          req.method === "POST" &&
          reeltrackAutomationMatch[2] === "run"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const listId = decodeURIComponent(reeltrackAutomationMatch[1]),
            item = await runReeltrackPlexAutomation(session.user.id, listId);
          return json(res, 200, {
            item: (await matchedReeltrackLists(session, [item]))[0],
          });
        }
        const reeltrackListMatch = url.pathname.match(
          /^\/api\/reeltrack\/imported-lists\/([^/]+)$/,
        );
        if (reeltrackListMatch && req.method === "DELETE") {
          if (
            !permitted(res, session, "discover") ||
            !requireCsrf(req, res, session)
          )
            return;
          const listId = decodeURIComponent(reeltrackListMatch[1]),
            current = await reeltrackSnapshotForUser(session.user.id),
            removedList = (current.importedLists || []).find(
              (item) => String(item.id) === listId,
            ),
            snapshot = {
              importedLists: (current.importedLists || []).filter(
                (item) => String(item.id) !== listId,
              ),
              updatedAt: new Date().toISOString(),
            };
          if (removedList?.automation?.enabled) {
            if (!administrator(res, session)) return;
            for (const job of Object.values(removedList.automation.jobs || {}))
              await trailerDownloader.remove(job).catch(() => {});
            const [settings, token] = await Promise.all([
              plexSettingsStore.read(),
              engineSettings.plexCredential(),
            ]), legacyLibrary = (settings.libraries || []).find((item) => String(item.key) === String(removedList.automation.plexLibraryKey)),
              keys = new Set([removedList.automation.plexMovieLibraryKey, removedList.automation.plexTvLibraryKey, legacyLibrary?.key].filter(Boolean).map(String));
            if (settings.endpoint && token)
              for (const library of (settings.libraries || []).filter((item) => keys.has(String(item.key)))) {
                await plexService.syncCollection(settings.endpoint, token, {
                  libraryKey: library.key,
                  libraryType: library.type,
                  machineIdentifier: settings.server?.machineIdentifier,
                  title: removedList.automation.collectionName || removedList.name,
                  ratingKeys: [],
                  replace: true,
                });
                await plexService.refreshLibrary(settings.endpoint, token, library.key);
              }
          }
          await saveReeltrackSnapshot(session.user.id, snapshot);
          return json(res, 200, { removed: true });
        }
        if (url.pathname === "/api/discover/feed" && req.method === "GET") {
          if (!permitted(res, session, "discover")) return;
          return json(
            res,
            200,
            await discovery.feed(
              url.searchParams.get("kind"),
              url.searchParams.get("page"),
            ),
          );
        }
        if (url.pathname === "/api/discover/genres" && req.method === "GET") {
          if (!permitted(res, session, "discover")) return;
          return json(res, 200, {
            items: await discovery.genres(url.searchParams.get("domain")),
          });
        }
        if (
          url.pathname === "/api/discover/categories" &&
          req.method === "GET"
        ) {
          if (!permitted(res, session, "discover")) return;
          return json(res, 200, {
            items: await discovery.categories(url.searchParams.get("type")),
          });
        }
        if (url.pathname === "/api/discover/browse" && req.method === "GET") {
          if (!permitted(res, session, "discover")) return;
          return json(
            res,
            200,
            await discovery.browse(Object.fromEntries(url.searchParams)),
          );
        }
        if (
          url.pathname === "/api/discover/library-presence" &&
          req.method === "GET"
        ) {
          if (!permitted(res, session, "discover")) return;
          const [movies, tvItems] = await Promise.all([
            sync.list("movie"),
            sync.list("tv"),
          ]);
          const presence = (domain, item) => ({
            id: item.id,
            domain: domain,
            title: item.title,
            year: item.year || null,
            tmdbId: item.tmdbId || null,
            tvdbId: item.tvdbId || null,
            imdbId: item.imdbId || null,
            status:
              domain === "movie"
                ? item.hasFile || Number(item.sizeOnDisk || 0) > 0
                  ? "available"
                  : "pending"
                : Number.parseInt(item.episodeProgress || "0", 10) > 0 ||
                    Number(item.sizeOnDisk || 0) > 0
                  ? "available"
                  : "pending",
            canView:
              session.user.role === "administrator" ||
              session.user.permissions?.[
                domain === "movie" ? "movies" : "tv"
              ] === true,
          });
          return json(res, 200, {
            items: [
              ...movies.map((item) => presence("movie", item)),
              ...tvItems.map((item) => presence("tv", item)),
            ],
          });
        }
        if (
          url.pathname === "/api/library/diagnostics" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          const requestedDomain = url.searchParams.get("domain"),
            domains = ["movie", "tv"].filter(
              (value) => !requestedDomain || value === requestedDomain,
            );
          if (requestedDomain && !domains.length)
            return json(res, 400, {
              error: {
                code: "validation_failed",
                message: "Choose Movies or Television.",
              },
            });
          const findings = [];
          for (const domain of domains) {
            const [items, roots] = await Promise.all([
                sync.list(domain),
                management
                  .execute(domain, "rootFolders", "GET", {})
                  .catch(() => []),
              ]),
              identityOwners = new Map();
            const rootPaths = new Set(
              (Array.isArray(roots) ? roots : [])
                .filter((root) => root.accessible !== false)
                .map((root) =>
                  String(root.path || "")
                    .replace(/[\\/]+$/, "")
                    .toLowerCase(),
                ),
            );
            for (const item of items) {
              const mediaId = String(item.id),
                href = `#${domain === "movie" ? "movie" : "series"}/${mediaId}`,
                base = {
                  domain: domain,
                  mediaId: mediaId,
                  title: item.title || "Untitled media",
                  href: href,
                  actionLabel: "Open details",
                };
              const identities = [
                ["tmdbId", item.tmdbId],
                ["tvdbId", domain === "tv" ? item.tvdbId : null],
                ["imdbId", item.imdbId],
              ].filter(([, value]) => value);
              if (!identities.length)
                findings.push({
                  ...base,
                  code: "missing_identity",
                  severity: "critical",
                  summary: "External identity is missing",
                  details:
                    "This title cannot be matched reliably with Discover or metadata providers.",
                  recommendation:
                    "Open details and correct the external metadata match.",
                });
              for (const [kind, value] of identities) {
                const key = `${kind}:${String(value).toLowerCase()}`,
                  owner = identityOwners.get(key);
                if (owner)
                  findings.push({
                    ...base,
                    code: "duplicate_identity",
                    severity: "critical",
                    summary: `Duplicate ${kind.replace("Id", "").toUpperCase()} identity`,
                    details: `This identity is also assigned to ${owner.title}.`,
                    recommendation:
                      "Review both titles and correct the mismatched external identity.",
                  });
                else identityOwners.set(key, item);
              }
              if (!item.year)
                findings.push({
                  ...base,
                  code: "missing_year",
                  severity: "warning",
                  summary: "Release year is missing",
                  details:
                    "Sorting and fallback matching may be less accurate.",
                  recommendation:
                    "Refresh metadata or correct the external match.",
                });
              if (!item.artwork?.url)
                findings.push({
                  ...base,
                  code: "missing_artwork",
                  severity: "warning",
                  summary: "Poster artwork is missing",
                  details:
                    "The library cannot display a poster for this title.",
                  recommendation: "Refresh the title metadata.",
                });
              const root = String(item.rootFolder || "")
                .replace(/[\\/]+$/, "")
                .toLowerCase();
              if (!root)
                findings.push({
                  ...base,
                  href: "#service/root-folders",
                  actionLabel: "Manage folders",
                  code: "missing_root",
                  severity: "critical",
                  summary: "Library folder is missing",
                  details: "The title has no configured root-library location.",
                  recommendation: "Assign an accessible root folder.",
                });
              else if (rootPaths.size && !rootPaths.has(root))
                findings.push({
                  ...base,
                  href: "#service/root-folders",
                  actionLabel: "Manage folders",
                  code: "invalid_root",
                  severity: "critical",
                  summary: "Library folder is not configured",
                  details: item.rootFolder,
                  recommendation:
                    "Move the title to a configured root folder or restore that folder.",
                });
              if (
                (domain === "movie" && !item.hasFile) ||
                (domain === "tv" && Number(item.missingEpisodes || 0) > 0)
              )
                findings.push({
                  ...base,
                  href: "#wanted",
                  actionLabel: "Review Wanted",
                  code: "missing_media",
                  severity: "warning",
                  summary:
                    domain === "movie"
                      ? "Movie file is missing"
                      : `${Number(item.missingEpisodes || 0)} monitored episodes are missing`,
                  details:
                    "The monitored library does not currently contain all expected media.",
                  recommendation:
                    "Review Wanted and search for missing releases.",
                });
              if (item.monitoring === "none")
                findings.push({
                  ...base,
                  code: "unmonitored",
                  severity: "info",
                  summary: "Title is not monitored",
                  details:
                    "Automatic searches and future availability checks are disabled.",
                  recommendation:
                    "Enable monitoring if this title should remain maintained.",
                });
              if (
                item.state === "cutoff" ||
                Number(item.cutoffUnmetEpisodes || 0) > 0
              )
                findings.push({
                  ...base,
                  href: "#wanted",
                  actionLabel: "Review upgrades",
                  code: "cutoff_unmet",
                  severity: "info",
                  summary: "Quality cutoff is unmet",
                  details:
                    "A higher-quality release is still eligible under the assigned profile.",
                  recommendation: "Review Wanted or run an upgrade search.",
                });
            }
          }
          const order = { critical: 0, warning: 1, info: 2 };
          findings.sort(
            (left, right) =>
              order[left.severity] - order[right.severity] ||
              left.title.localeCompare(right.title),
          );
          return json(res, 200, {
            generatedAt: new Date().toISOString(),
            summary: {
              total: findings.length,
              critical: findings.filter((item) => item.severity === "critical")
                .length,
              warning: findings.filter((item) => item.severity === "warning")
                .length,
              info: findings.filter((item) => item.severity === "info").length,
            },
            items: findings,
          });
        }
        if (
          url.pathname === "/api/discover/import-options" &&
          req.method === "GET"
        ) {
          if (!permitted(res, session, "discover")) return;
          const domain = url.searchParams.get("domain"),
            tmdbId = Number(url.searchParams.get("tmdbId"));
          if (
            !["movie", "tv"].includes(domain) ||
            !Number.isInteger(tmdbId) ||
            tmdbId <= 0
          )
            throw new Error("Choose a valid movie or television title");
          const metadata = await discovery.details(domain, tmdbId),
            identity = { tmdbId: tmdbId, tvdbId: metadata.tvdbId },
            engineInstanceId=String(url.searchParams.get('engineInstanceId')||'').trim()||null;
          let match;
          for (const term of lookupTermsForIdentity(domain, identity)) {
            const matches = await management.execute(domain, "lookup", "GET", {
              query: { term: term },engineInstanceId,
            });
            match = exactEngineMatch(
              domain,
              identity,
              Array.isArray(matches) ? matches : [],
            );
            if (match) break;
          }
          const destinationContext = await mediaDestinationContext(
              domain,
              session.user.role === "administrator",
              engineInstanceId,
            ),
            profiles = destinationContext.profiles,
            roots = destinationContext.roots;
          return json(res, 200, {
            match: match || null,
            identity: { tmdbId: tmdbId, tvdbId: metadata.tvdbId || null },
            profiles: Array.isArray(profiles) ? profiles : [],
            roots: Array.isArray(roots) ? roots : [],
            destinations: destinationContext.destinations,
            engines:engineSettings.public().instances.filter(item=>item.domain===domain&&item.enabled!==false).map(({id,name,isDefault})=>({id,name,isDefault})),
          });
        }
        if (url.pathname === "/api/discover/request" && req.method === "POST") {
          if (
            !permitted(res, session, "discover") ||
            !requireCsrf(req, res, session)
          )
            return;
          const input = await body(req),
            domain = String(input.domain || ""),
            tmdbId = Number(input.tmdbId),
            payload = {...input.payload,engineInstanceId:String(input.engineInstanceId||input.payload?.engineInstanceId||'').trim()||undefined};
          if (session.user.role !== "administrator" && payload?.mediaDestinationId) {
            const allowed = await mediaDestinationContext(domain, false, payload.engineInstanceId);
            if (!allowed.destinations.some((item) => item.id === String(payload.mediaDestinationId)))
              throw new Error("Choose an available media destination");
          }
          if (["movie", "tv"].includes(domain)) {
            const allowance = await requestAllowance(session.user),
              limitMessage = requestLimitMessage(allowance, domain);
            if (limitMessage) {
              await recordAudit(session, {
                category: "request",
                action: "request.blocked_by_limit",
                target: payload?.title || `${domain} request`,
                domain: domain,
                summary: limitMessage,
                metadata: { allowance: allowance },
              });
              return json(res, 429, {
                error: { code: "request_limit_reached", message: limitMessage },
                allowance: allowance,
              });
            }
          }
          const validated = await validatedDiscoverRequest(
              domain,
              tmdbId,
              payload,
            ),metadata = validated.metadata,resolvedPayload = validated.payload,
            approvalRequired =
              session.user.role !== "administrator" &&
              session.user.requestApprovalRequired === true;
          const now = new Date().toISOString(),
            requestRecord = {
              id: `request_${randomUUID()}`,
              userId: session.user.id,
              domain: domain,
              engineId: null,
              engineInstanceId: resolvedPayload.engineInstanceId || null,
              engineInstanceName:engineSettings.public().instances.find(item=>item.id===resolvedPayload.engineInstanceId)?.name||null,
              tmdbId: tmdbId,
              tvdbId: metadata.tvdbId || null,
              title: metadata.title || payload.title || "Untitled request",
              year: Number(metadata.year || payload.year) || null,
              requestedAt: now,
              updatedAt: now,
              ...requestMetadata(metadata),
              mediaDestinationId: resolvedPayload.mediaDestinationId || null,
              destinationName: resolvedPayload.mediaDestinationId
                ? (await mediaDestinationContext(domain, true, resolvedPayload.engineInstanceId)).destinations.find((item) => item.id === resolvedPayload.mediaDestinationId)?.name || null
                : null,
              searchNow:
                domain === "movie"
                  ? resolvedPayload.addOptions?.searchForMovie !== false
                  : resolvedPayload.addOptions?.searchForMissingEpisodes !== false,
              status: approvalRequired ? "pending_approval" : "approving",
              payload: resolvedPayload,
            };
          await requestStore.update((current) => {
            current.requests = current.requests || [];
            current.requests.unshift(requestRecord);
            return requestRecord;
          });
          await recordAudit(session, {
            category: "request",
            action: "request.submitted",
            target: requestRecord.title,
            domain: domain,
            summary: `Submitted ${requestRecord.title}${approvalRequired ? " for administrator approval" : ""}.`,
            metadata: {
              requestId: requestRecord.id,
              approvalRequired: approvalRequired,
            },
          });
          if (approvalRequired)
            return json(res, 202, {
              result: null,
              request: { ...requestRecord, payload: undefined },
            });
          try {
            const result = await addRequestToEngine(requestRecord);
            return json(res, 201, {
              result: result,
              request: {
                ...requestRecord,
                engineId: Number(result.id),
                status: "requested",
                payload: undefined,
              },
            });
          } catch (error) {
            await requestStore.update((current) => {
              const item = (current.requests || []).find(
                (value) => value.id === requestRecord.id,
              );
              if (item)
                Object.assign(item, {
                  status: "failed",
                  message:
                    "The request could not be added to the media engine.",
                  updatedAt: new Date().toISOString(),
                  payload: undefined,
                });
            });
            throw error;
          }
        }
        if (
          url.pathname === "/api/requests/allowance" &&
          req.method === "GET"
        ) {
          if (!permitted(res, session, "discover")) return;
          return json(res, 200, {
            allowance: await requestAllowance(session.user),
          });
        }
        if (url.pathname === "/api/notifications" && req.method === "GET") {
          const preferenceValue = await notificationPreferences(
              session.user.id,
            ),
            items = filterNotifications(
              await requestNotifications(session),
              preferenceValue.preferences,
            ),
            quietHoursActive = notificationQuietNow(
              preferenceValue.preferences,
            );
          const unread = quietHoursActive
              ? 0
              : items.filter((item) => !item.read).length,
            administratorUser = session.user.role === "administrator",
            requestHref = administratorUser
              ? "#request-management"
              : "#requests",
            requestUnread = items.filter(
              (item) =>
                item.category === "request" &&
                item.href === requestHref &&
                !item.read,
            ).length;
          return json(res, 200, {
            items: items,
            unread: unread,
            quietHoursActive: quietHoursActive,
            pageBadge: {
              href: requestHref,
              count: quietHoursActive ? 0 : requestUnread,
            },
          });
        }
        if (
          url.pathname === "/api/notifications/preferences" &&
          req.method === "GET"
        )
          return json(res, 200, await notificationPreferences(session.user.id));
        if (
          url.pathname === "/api/notifications/preferences" &&
          req.method === "PATCH"
        ) {
          if (!requireCsrf(req, res, session)) return;
          const input = await body(req),
            scope = input.scope === "defaults" ? "defaults" : "user";
          if (scope === "defaults" && !administrator(res, session)) return;
          const preferences = sanitizeNotificationPreferences(
            input.preferences,
          );
          await notificationStore.update((current) => {
            current.preferences = current.preferences || {
              defaults: notificationPreferenceDefaults,
              users: {},
            };
            current.preferences.users = current.preferences.users || {};
            if (scope === "defaults")
              current.preferences.defaults = preferences;
            else current.preferences.users[session.user.id] = preferences;
          });
          await recordAudit(session, {
            category: "account",
            action: "notification_preferences.updated",
            target: scope,
            summary: `Updated ${scope === "defaults" ? "default" : "personal"} notification preferences.`,
          });
          return json(res, 200, await notificationPreferences(session.user.id));
        }
        if (
          url.pathname === "/api/notifications/channels" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          const stored = await notificationStore.read();
          return json(res, 200, {
            channels: (stored.channels || []).map((item) => ({
              ...item,
              credentialConfigured: true,
              credential: "••••••••",
            })),
            deliveries: (stored.deliveries || []).slice(0, 50),
          });
        }
        if (
          url.pathname === "/api/notifications/channels" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            type = String(input.type || "");
          if (!["discord", "telegram", "gotify", "pushover"].includes(type))
            return json(res, 400, {
              error: {
                code: "invalid_provider",
                message: "Choose Discord, Telegram, Gotify, or Pushover.",
              },
            });
          const id = /^channel_[A-Za-z0-9_-]+$/.test(String(input.id || ""))
              ? String(input.id)
              : `channel_${randomUUID()}`,
            categories = [
              "request",
              "download",
              "import",
              "system",
              "security",
            ].filter((value) => (input.categories || []).includes(value)),
            priority = Math.max(
              -2,
              Math.min(2, Number(input.pushoverPriority) || 0),
            ),
            channel = {
              id: id,
              type: type,
              name:
                String(input.name || type)
                  .trim()
                  .slice(0, 80) || type,
              enabled: input.enabled !== false,
              categories: categories.length
                ? categories
                : ["request", "download", "import", "system", "security"],
              chatId:
                type === "telegram"
                  ? String(input.chatId || "")
                      .trim()
                      .slice(0, 100)
                  : "",
              endpoint:
                type === "gotify"
                  ? String(input.endpoint || "")
                      .trim()
                      .slice(0, 500)
                  : "",
              devices:
                type === "pushover"
                  ? (input.devices || [])
                      .map((value) => String(value).trim())
                      .filter(Boolean)
                      .slice(0, 20)
                  : [],
              pushoverPriority: priority,
              retry:
                priority === 2
                  ? Math.max(30, Math.min(86400, Number(input.retry) || 60))
                  : 0,
              expire:
                priority === 2
                  ? Math.max(30, Math.min(86400, Number(input.expire) || 3600))
                  : 0,
              ttl: Math.max(0, Math.min(2592e3, Number(input.ttl) || 0)),
              sound: /^[A-Za-z0-9_-]{0,40}$/.test(String(input.sound || ""))
                ? String(input.sound || "")
                : "",
              template: sanitizeChannelTemplate(input.template),
            };
          if (type === "telegram" && !channel.chatId)
            return json(res, 400, {
              error: {
                code: "chat_id_required",
                message: "Telegram chat ID is required.",
              },
            });
          if (type === "gotify" && !/^https?:\/\//i.test(channel.endpoint))
            return json(res, 400, {
              error: {
                code: "endpoint_required",
                message: "Enter a valid Gotify server URL.",
              },
            });
          if (channel.template.json)
            try {
              const parsed = JSON.parse(channel.template.json);
              if (
                !parsed ||
                Array.isArray(parsed) ||
                typeof parsed !== "object"
              )
                throw new Error();
            } catch {
              return json(res, 400, {
                error: {
                  code: "invalid_notification_json",
                  message: "Custom notification JSON must be a valid object.",
                },
              });
            }
          const existing = (await notificationStore.read()).channels?.find(
            (item) => item.id === id,
          );
          if (type === "pushover") {
            const saved = existing
                ? pushoverCredential(
                    await engineSettings.notificationCredential(id),
                  )
                : { token: "", userKey: "", encryptionKey: "" },
              secret = {
                token: String(input.credential || saved.token).trim(),
                userKey: String(input.userKey || saved.userKey).trim(),
                encryptionKey: String(
                  input.encryptionKey || saved.encryptionKey,
                ).trim(),
              };
            if (!secret.token || !secret.userKey)
              return json(res, 400, {
                error: {
                  code: "pushover_credentials_required",
                  message:
                    "Pushover application token and user key are required.",
                },
              });
            if (
              secret.encryptionKey &&
              !/^[0-9a-fA-F]{64}$/.test(secret.encryptionKey)
            )
              return json(res, 400, {
                error: {
                  code: "invalid_encryption_key",
                  message:
                    "The optional Pushover encryption key must contain exactly 64 hexadecimal characters.",
                },
              });
            await engineSettings.saveNotificationCredential(
              id,
              JSON.stringify(secret),
            );
          } else if (input.credential)
            await engineSettings.saveNotificationCredential(
              id,
              input.credential,
            );
          else if (!existing)
            return json(res, 400, {
              error: {
                code: "credential_required",
                message: `${type === "discord" ? "Webhook URL" : "Token"} is required.`,
              },
            });
          await notificationStore.update((current) => {
            current.channels = current.channels || [];
            const index = current.channels.findIndex((item) => item.id === id);
            if (index >= 0) current.channels[index] = channel;
            else current.channels.push(channel);
          });
          await recordAudit(session, {
            category: "configuration",
            action: "notification_channel.saved",
            target: channel.name,
            summary: `Saved ${type} notification delivery and message template.`,
            metadata: { customJson: Boolean(channel.template.json) },
          });
          return json(res, 200, {
            channel: {
              ...channel,
              credentialConfigured: true,
              credential: "••••••••",
            },
          });
        }
        const notificationChannelMatch = url.pathname.match(
          /^\/api\/notifications\/channels\/(channel_[A-Za-z0-9_-]+)\/(test|retry)$/,
        );
        if (notificationChannelMatch && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const [, channelId, action] = notificationChannelMatch,
            stored = await notificationStore.read(),
            channel = (stored.channels || []).find(
              (item) => item.id === channelId,
            );
          if (!channel)
            return json(res, 404, {
              error: {
                code: "not_found",
                message: "Notification channel was not found.",
              },
            });
          let event = {
              id: `test:${Date.now()}`,
              category: "system",
              severity: "information",
              title: "VynodeArr test notification",
              message: "External notification delivery is working.",
            },
            attempt = 1;
          if (action === "retry") {
            const input = await body(req),
              delivery = (stored.deliveries || []).find(
                (item) => item.id === input.deliveryId,
              ),
              storedEvent = (stored.events || []).find(
                (item) => item.id === delivery?.eventId,
              );
            if (!delivery || !storedEvent)
              return json(res, 404, {
                error: {
                  code: "delivery_not_found",
                  message: "The delivery event is no longer available.",
                },
              });
            event = storedEvent;
            attempt = Number(delivery.attempt || 1) + 1;
          }
          try {
            await sendExternalNotification(channel, event);
            const delivery = await recordExternalDelivery(
              channel,
              event,
              "delivered",
              "",
              attempt,
            );
            return json(res, 200, { delivery: delivery });
          } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error),
              delivery = await recordExternalDelivery(
                channel,
                event,
                "failed",
                message,
                attempt,
              );
            return json(res, 502, {
              error: { code: "delivery_failed", message: message },
              delivery: delivery,
            });
          }
        }
        const deleteNotificationChannel = url.pathname.match(
          /^\/api\/notifications\/channels\/(channel_[A-Za-z0-9_-]+)$/,
        );
        if (deleteNotificationChannel && req.method === "DELETE") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const id = deleteNotificationChannel[1];
          await notificationStore.update((current) => {
            current.channels = (current.channels || []).filter(
              (item) => item.id !== id,
            );
          });
          await engineSettings.removeNotificationCredential(id);
          await recordAudit(session, {
            category: "configuration",
            action: "notification_channel.removed",
            target: id,
            summary: "Removed an external notification channel.",
          });
          return json(res, 200, { removed: id });
        }
        if (
          url.pathname === "/api/notifications/test" &&
          req.method === "POST"
        ) {
          if (!requireCsrf(req, res, session)) return;
          const timestamp = new Date().toISOString(),
            event = {
              id: `test:${session.user.id}:${Date.now()}`,
              eventGroup: "test",
              category: "system",
              severity: "information",
              type: "imported",
              title: "Test notification received",
              message: "Your in-app notification settings are working.",
              timestamp: timestamp,
              href: "#account",
              requestId: "",
              actionable: false,
            };
          await persistNotificationEvents(session.user.id, [event]);
          return json(res, 201, { event: event });
        }
        if (
          url.pathname === "/api/notifications/read" &&
          req.method === "POST"
        ) {
          if (!requireCsrf(req, res, session)) return;
          const input = await body(req),
            available = await requestNotifications(session),
            requested = Array.isArray(input.ids)
              ? new Set(input.ids.map(String))
              : null,
            ids = available
              .filter((item) => !requested || requested.has(item.id))
              .map((item) => item.id),
            readAt = new Date().toISOString();
          await notificationStore.update((current) => {
            current.reads = current.reads || {};
            const reads = current.reads[session.user.id] || {};
            for (const id of ids) reads[id] = readAt;
            current.reads[session.user.id] = Object.fromEntries(
              Object.entries(reads).slice(-1e3),
            );
          });
          return json(res, 200, { read: ids });
        }
        if (
          url.pathname === "/api/notifications" &&
          req.method === "DELETE"
        ) {
          if (!requireCsrf(req, res, session)) return;
          const input = await body(req),
            available = await requestNotifications(session),
            requested = Array.isArray(input.ids)
              ? new Set(input.ids.map(String))
              : null,
            ids = available
              .filter((item) => !requested || requested.has(item.id))
              .map((item) => item.id),
            dismissedAt = new Date().toISOString();
          await notificationStore.update((current) => {
            current.dismissed = current.dismissed || {};
            const dismissed = current.dismissed[session.user.id] || {};
            for (const id of ids) dismissed[id] = dismissedAt;
            current.dismissed[session.user.id] = Object.fromEntries(
              Object.entries(dismissed).slice(-1e3),
            );
          });
          return json(res, 200, { dismissed: ids });
        }
        if (
          url.pathname === "/api/notifications/review-requests" &&
          req.method === "POST"
        ) {
          if (!requireCsrf(req, res, session)) return;
          const href =
              session.user.role === "administrator"
                ? "#request-management"
                : "#requests",
            available = await requestNotifications(session),
            ids = available
              .filter(
                (item) =>
                  item.category === "request" &&
                  item.href === href &&
                  !item.read,
              )
              .map((item) => item.id),
            readAt = new Date().toISOString();
          if (ids.length)
            await notificationStore.update((current) => {
              current.reads = current.reads || {};
              const reads = current.reads[session.user.id] || {};
              for (const id of ids) reads[id] = readAt;
              current.reads[session.user.id] = Object.fromEntries(
                Object.entries(reads).slice(-1e3),
              );
            });
          return json(res, 200, { reviewed: ids });
        }
        if (url.pathname === "/api/requests/mine" && req.method === "GET") {
          if (!permitted(res, session, "discover")) return;
          return json(res, 200, {
            items: await liveUserRequests(session.user.id),
          });
        }
        if (url.pathname === "/api/requests" && req.method === "GET") {
          if (!administrator(res, session)) return;
          const users = new Map(
            (await auth.listUsers()).map((user) => [
              user.id,
              { id: user.id, name: user.name, username: user.username },
            ]),
          );
          return json(res, 200, {
            items: (await liveUserRequests()).map((item) => ({
              ...item,
              user: users.get(item.userId) || {
                id: item.userId,
                name: "Deleted user",
                username: "deleted",
              },
            })),
          });
        }
        const administerRequestMatch = url.pathname.match(
          /^\/api\/requests\/(request_[A-Za-z0-9_-]+)\/(approve|reject)$/,
        );
        if (administerRequestMatch && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const [, requestId, action] = administerRequestMatch,
            stored = await requestStore.read(),
            record = (stored.requests || []).find(
              (item) => item.id === requestId,
            );
          if (!record)
            return json(res, 404, {
              error: { code: "not_found", message: "Request was not found." },
            });
          if (record.status !== "pending_approval")
            return json(res, 409, {
              error: {
                code: "request_already_decided",
                message: "This request is no longer awaiting approval.",
              },
            });
          if (action === "reject") {
            const input = await body(req),
              updatedAt = new Date().toISOString(),
              rejectionReason = String(input.reason || "")
                .trim()
                .slice(0, 240);
            if (!rejectionReason)
              return json(res, 400, {
                error: {
                  code: "rejection_reason_required",
                  message: "Enter a reason for declining this request.",
                },
              });
            const message = `Declined by an administrator: ${rejectionReason}`;
            await requestStore.update((current) => {
              const item = (current.requests || []).find(
                (value) =>
                  value.id === record.id && value.status === "pending_approval",
              );
              if (item)
                Object.assign(item, {
                  status: "rejected",
                  message: message,
                  rejectionReason: rejectionReason,
                  rejectedAt: updatedAt,
                  rejectedBy: session.user.id,
                  updatedAt: updatedAt,
                  payload: undefined,
                });
            });
            await recordAudit(session, {
              category: "request",
              action: "request.rejected",
              target: record.title,
              domain: record.domain,
              summary: `Rejected ${record.title} for the requesting user.`,
              metadata: {
                requestId: record.id,
                requestUserId: record.userId,
                reason: rejectionReason,
              },
            });
            return json(res, 200, { rejected: true });
          }
          const approvalInput = await body(req),approvalRecord = approvalInput.mediaDestinationId
            ? { ...record, mediaDestinationId: String(approvalInput.mediaDestinationId), payload: { ...record.payload, mediaDestinationId: String(approvalInput.mediaDestinationId) } }
            : record;
          const claimed = await requestStore.update((current) => {
            const item = (current.requests || []).find(
              (value) => value.id === record.id,
            );
            if (!item || item.status !== "pending_approval") return false;
            Object.assign(item, {
              status: "approving",
              updatedAt: new Date().toISOString(),
            });
            return true;
          });
          if (!claimed)
            return json(res, 409, {
              error: {
                code: "request_already_decided",
                message: "This request is already being handled.",
              },
            });
          try {
            const result = await addRequestToEngine(approvalRecord);
            await requestStore.update((current) => {
              const item = (current.requests || []).find(
                (value) => value.id === record.id,
              );
              if (item) Object.assign(item, { approvedBy: session.user.id, mediaDestinationId: approvalRecord.mediaDestinationId || item.mediaDestinationId });
            });
            await recordAudit(session, {
              category: "request",
              action: "request.approved",
              target: record.title,
              domain: record.domain,
              summary: `Approved ${record.title} and added it to the media engine.`,
              metadata: {
                requestId: record.id,
                requestUserId: record.userId,
                engineId: Number(result.id),
              },
            });
            return json(res, 200, { approved: true, result: result });
          } catch (error) {
            await requestStore.update((current) => {
              const item = (current.requests || []).find(
                (value) => value.id === record.id,
              );
              if (item)
                Object.assign(item, {
                  status: "pending_approval",
                  updatedAt: new Date().toISOString(),
                });
            });
            throw error;
          }
        }
        const ownRequestMatch = url.pathname.match(
          /^\/api\/requests\/mine\/(request_[A-Za-z0-9_-]+)$/,
        );
        if (ownRequestMatch && req.method === "DELETE") {
          if (
            !permitted(res, session, "discover") ||
            !requireCsrf(req, res, session)
          )
            return;
          const records = await liveUserRequests(session.user.id),
            record = records.find((item) => item.id === ownRequestMatch[1]);
          if (!record)
            return json(res, 404, {
              error: { code: "not_found", message: "Request was not found." },
            });
          if (!record.canCancel)
            return json(res, 409, {
              error: {
                code: "request_not_cancellable",
                message:
                  "This request can no longer be cancelled because downloading or importing has started.",
              },
            });
          if (record.status !== "pending_approval")
            await management.execute(record.domain, "library", "DELETE", {
              id: Number(record.engineId),
              engineInstanceId:record.engineInstanceId,
              query:
                record.domain === "movie"
                  ? { deleteFiles: false, addImportExclusion: false }
                  : { deleteFiles: false, addImportListExclusion: false },
            });
          const updatedAt = new Date().toISOString();
          await requestStore.update((current) => {
            const item = (current.requests || []).find(
              (value) =>
                value.id === record.id && value.userId === session.user.id,
            );
            if (item)
              Object.assign(item, {
                status: "canceled",
                message: "This request was cancelled by the user.",
                cancelledAt: updatedAt,
                cancelledBy: session.user.id,
                rejectionReason: null,
                updatedAt: updatedAt,
                payload: undefined,
              });
          });
          if (record.status !== "pending_approval") {
            const publicId = `${record.domain === "movie" ? "movie" : "series"}_${record.engineInstanceId?`${record.engineInstanceId}_`:""}${Number(record.engineId)}`;
            await sync.removeItem(record.domain, publicId);
            broadcastLibraryEvent({
              domain: record.domain,
              removedIds: [publicId],
              updatedAt: updatedAt,
            });
          }
          await recordAudit(session, {
            category: "request",
            action: "request.canceled",
            target: record.title,
            domain: record.domain,
            summary: `Canceled the request for ${record.title}.`,
            metadata: { requestId: record.id },
          });
          return json(res, 200, { cancelled: true });
        }
        const correctRequestMatch = url.pathname.match(
          /^\/api\/requests\/mine\/(request_[A-Za-z0-9_-]+)\/correct$/,
        );
        if (correctRequestMatch && req.method === "POST") {
          if (
            !permitted(res, session, "discover") ||
            !requireCsrf(req, res, session)
          )
            return;
          const records = await liveUserRequests(session.user.id),
            record = records.find((item) => item.id === correctRequestMatch[1]);
          if (!record)
            return json(res, 404, {
              error: { code: "not_found", message: "Request was not found." },
            });
          if (!record.canCorrect)
            return json(res, 409, {
              error: {
                code: "request_not_correctable",
                message:
                  "The match can only be corrected before downloading or importing starts.",
              },
            });
          const input = await body(req),
            tmdbId = Number(input.tmdbId);
          if (!Number.isInteger(tmdbId) || tmdbId <= 0)
            throw new Error("Choose a valid TMDB match");
          if (record.status === "pending_approval") {
            const stored = await requestStore.read(),
              source = (stored.requests || []).find(
                (item) =>
                  item.id === record.id && item.userId === session.user.id,
              );
            if (!source?.payload)
              throw new Error(
                "The pending request options are no longer available.",
              );
            const metadata = await discovery.details(record.domain, tmdbId),
              identity = { tmdbId: tmdbId, tvdbId: metadata.tvdbId },
              payload = {
                ...source.payload,
                tmdbId: tmdbId,
                ...(record.domain === "tv" ? { tvdbId: metadata.tvdbId } : {}),
              };
            let match;
            for (const term of lookupTermsForIdentity(
              record.domain,
              identity,
            )) {
              const matches = await management.execute(
                record.domain,
                "lookup",
                "GET",
                { query: { term: term },engineInstanceId:record.engineInstanceId },
              );
              match = exactEngineMatch(
                record.domain,
                identity,
                Array.isArray(matches) ? matches : [],
              );
              if (match) break;
            }
            if (!match)
              throw new Error(
                "The media engine could not resolve that TMDB title. Try another match.",
              );
            const correctedPayload = {
              ...match,
              engineInstanceId:record.engineInstanceId||payload.engineInstanceId,
              mediaDestinationId:source.mediaDestinationId||payload.mediaDestinationId,
              rootFolderPath: payload.rootFolderPath,
              qualityProfileId: payload.qualityProfileId,
              monitored: payload.monitored,
              addOptions: payload.addOptions,
              ...(record.domain === "movie"
                ? { minimumAvailability: payload.minimumAvailability }
                : {
                    monitor: payload.monitor,
                    seriesType: payload.seriesType,
                    seasonFolder: true,
                  }),
            };
            await validatedDiscoverRequest(
              record.domain,
              tmdbId,
              correctedPayload,
            );
            const updatedAt = new Date().toISOString();
            await requestStore.update((current) => {
              const item = (current.requests || []).find(
                (value) =>
                  value.id === record.id && value.userId === session.user.id,
              );
              if (item)
                Object.assign(item, {
                  tmdbId: tmdbId,
                  tvdbId: metadata.tvdbId || null,
                  title: metadata.title,
                  year: Number(metadata.year) || null,
                  payload: correctedPayload,
                  updatedAt: updatedAt,
                  ...requestMetadata(metadata),
                });
            });
            await recordAudit(session, {
              category: "request",
              action: "request.match_corrected",
              target: metadata.title,
              domain: record.domain,
              summary: `Corrected the pending request match from ${record.title} to ${metadata.title}.`,
              metadata: {
                requestId: record.id,
                previousTmdbId: record.tmdbId,
                tmdbId: tmdbId,
              },
            });
            return json(res, 200, {
              corrected: true,
              result: { id: null, title: metadata.title, tmdbId: tmdbId },
            });
          }
          const result = await rematchMedia({
            domain: record.domain,
            mediaId: Number(record.engineId),
            tmdbId: tmdbId,
            engineInstanceId:record.engineInstanceId,
          });
          if (record.searchNow !== false)
            await management
              .execute(record.domain, "commands", "POST", {
                payload:
                  record.domain === "movie"
                    ? { name: "MoviesSearch", movieIds: [Number(result.id)] }
                    : { name: "SeriesSearch", seriesId: Number(result.id) },
                engineInstanceId:record.engineInstanceId,
              })
              .catch(() => {});
          const metadata = await discovery.details(record.domain, tmdbId),
            updatedAt = new Date().toISOString();
          await requestStore.update((current) => {
            const item = (current.requests || []).find(
              (value) =>
                value.id === record.id && value.userId === session.user.id,
            );
            if (item)
              Object.assign(item, {
                engineId: Number(result.id),
                tmdbId: tmdbId,
                tvdbId: metadata.tvdbId || null,
                title: result.title || metadata.title,
                year: Number(metadata.year) || null,
                status: "requested",
                requestedAt: updatedAt,
                updatedAt: updatedAt,
                ...requestMetadata(metadata),
              });
          });
          await recordAudit(session, {
            category: "request",
            action: "request.match_corrected",
            target: result.title || metadata.title,
            domain: record.domain,
            summary: `Corrected the request match from ${record.title} to ${result.title || metadata.title}.`,
            metadata: {
              requestId: record.id,
              previousTmdbId: record.tmdbId,
              tmdbId: tmdbId,
            },
          });
          return json(res, 200, { corrected: true, result: result });
        }
        if (url.pathname === "/api/discover/enrich" && req.method === "GET") {
          const domain = url.searchParams.get("domain"),
            page = domain === "tv" ? "tv" : "movies";
          if (
            !permitted(
              res,
              session,
              session.user.permissions?.discover ? "discover" : page,
            )
          )
            return;
          if (!discovery.configured())
            return json(res, 200, { configured: false, item: null });
          return json(res, 200, {
            configured: true,
            item: await discovery.enrich(domain, {
              title: url.searchParams.get("title"),
              year: url.searchParams.get("year"),
            }),
          });
        }
        const discoverDetails = url.pathname.match(
          /^\/api\/discover\/details\/(movie|tv)\/(\d+)$/,
        );
        if (discoverDetails && req.method === "GET") {
          if (!permitted(res, session, "discover")) return;
          return json(res, 200, {
            item: await discovery.details(
              discoverDetails[1],
              discoverDetails[2],
            ),
          });
        }
        if (
          url.pathname === "/api/account/sessions/others" &&
          req.method === "DELETE"
        ) {
          if (!requireCsrf(req, res, session)) return;
          await auth.revokeOtherSessions(session.user.id, sessionId);
          if (session.user.role === "administrator")
            await recordAudit(session, {
              category: "security",
              action: "sessions.others_revoked",
              target: session.user.username,
              summary: "Revoked all other administrator sessions.",
            });
          return json(res, 200, { revoked: true });
        }
        const sessionMatch = url.pathname.match(
          /^\/api\/account\/sessions\/([A-Za-z0-9_-]+)$/,
        );
        if (sessionMatch && req.method === "DELETE") {
          if (!requireCsrf(req, res, session)) return;
          const current = await auth.revokeSession(
            session.user.id,
            sessionMatch[1],
            sessionId,
          );
          if (session.user.role === "administrator")
            await recordAudit(session, {
              category: "security",
              action: "session.revoked",
              target: session.user.username,
              summary: `Revoked ${current ? "the current" : "an administrator"} session.`,
              metadata: { current: current },
            });
          return json(
            res,
            200,
            { revoked: true, current: current },
            current ? { "set-cookie": auth.cookie("", true) } : {},
          );
        }
        if (url.pathname === "/api/admin/users" && req.method === "GET") {
          if (!administrator(res, session)) return;
          return json(res, 200, { items: await auth.listUsers() });
        }
        if (url.pathname === "/api/admin/users" && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const user = await auth.createUser(await body(req));
          await recordAudit(session, {
            category: "user",
            action: "user.created",
            target: user.username,
            summary: `Created user ${user.name} (@${user.username}).`,
            metadata: {
              targetUserId: user.id,
              role: user.role,
              requestLimits: user.requestLimits,
            },
          });
          return json(res, 201, { user: user });
        }
        const userMatch = url.pathname.match(
          /^\/api\/admin\/users\/(user_[A-Za-z0-9_-]+)$/,
        );
        if (userMatch && req.method === "PATCH") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            before = (await auth.listUsers()).find(
              (item) => item.id === userMatch[1],
            ),
            user = await auth.administerUser(
              userMatch[1],
              input,
              session.user.id,
            );
          await recordAudit(session, {
            category: "user",
            action: `user.${String(input.action || "updated")}`,
            target: user?.username || before?.username || userMatch[1],
            summary: `Updated ${user?.name || before?.name || "user"} (@${user?.username || before?.username || "deleted"}): ${String(input.action || "account updated")}.`,
            metadata: {
              targetUserId: user?.id || before?.id || userMatch[1],
              role: user?.role || before?.role,
            },
          });
          if (input.action === "permissions" && user)
            await recordAudit(session, {
              category: "user",
              action: user.requestLimits?.enabled
                ? "user.request_limits_updated"
                : "user.request_limits_removed",
              target: user.username,
              summary: `${user.requestLimits?.enabled ? "Updated" : "Removed"} request limits for ${user.name}.`,
              metadata: {
                targetUserId: user.id,
                previous: before?.requestLimits || null,
                current: user.requestLimits,
              },
            });
          return json(res, 200, { user: user });
        }
        if (url.pathname === "/api/settings/engines" && req.method === "GET") {
          if (!administrator(res, session)) return;
          return json(res, 200, engineSettings.public());
        }
        if (
          url.pathname === "/api/settings/engines/mode" &&
          req.method === "PUT"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            requested = String(input.mode || "");
          if (requested === "external") {
            const runtime = await engineSettings.externalRuntime();
            if (!runtime)
              return json(res, 422, {
                error: {
                  code: "external_engines_incomplete",
                  message:
                    "Validate and save both external engines before switching modes.",
                },
              });
            const checks = await Promise.all(
              ["movie", "tv"].map((domain) => testEngine(domain, runtime[domain])),
            );
            if (checks.some((check) => !check.validated))
              return json(res, 422, {
                error: {
                  code: "external_engines_unavailable",
                  message:
                    "Both external engines must be reachable and compatible before activation.",
                },
              });
          }
          const settings = await engineSettings.requestMode(requested);
          await recordAudit(session, {
            category: "configuration",
            action: "engine.mode_requested",
            target: "Engine mode",
            summary: `Scheduled ${requested} engine mode for the next restart.`,
          });
          return json(res, 200, { settings, restartRequired: settings.restartRequired });
        }
        const externalEngineSave = url.pathname.match(
          /^\/api\/settings\/engines\/external\/(movie|tv)$/,
        );
        const externalEngineTest = url.pathname.match(
          /^\/api\/settings\/engines\/external\/(movie|tv)\/test$/,
        );
        if (externalEngineTest && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            existing = await engineSettings.externalRuntime(),
            credential = String(input.apiCredential || existing?.[externalEngineTest[1]]?.apiCredential || "");
          return json(res, 200, await testEngine(externalEngineTest[1], { ...input, apiCredential: credential }));
        }
        if (externalEngineSave && req.method === "PUT") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            existing = await engineSettings.externalRuntime(),
            credential = String(input.apiCredential || existing?.[externalEngineSave[1]]?.apiCredential || ""),
            result = await testEngine(externalEngineSave[1], { ...input, apiCredential: credential });
          if (!result.validated)
            return json(res, 422, {
              error: {
                code: "engine_validation_failed",
                message: result.connection.safeError || "Engine validation did not succeed.",
              },
            });
          await engineSettings.saveExternal(externalEngineSave[1], input, String(input.apiCredential || ""));
          return json(res, 200, { saved: true, settings: engineSettings.public(), validation: result });
        }
        const engineInstance = url.pathname.match(
          /^\/api\/settings\/engines\/instances\/([^/]+)$/,
        );
        const engineInstanceTest = url.pathname.match(
          /^\/api\/settings\/engines\/instances\/([^/]+)\/test$/,
        );
        const engineInstanceDefault = url.pathname.match(
          /^\/api\/settings\/engines\/instances\/([^/]+)\/default$/,
        );
        const engineInstanceInventory = url.pathname.match(
          /^\/api\/settings\/engines\/instances\/([^/]+)\/inventory$/,
        );
        const engineInstanceStorage = url.pathname.match(
          /^\/api\/settings\/engines\/instances\/([^/]+)\/storage$/,
        );
        if (engineInstanceInventory && req.method === "GET") {
          if (!administrator(res, session)) return;
          const instance = engineSettings.public().instances.find((item) => item.id === engineInstanceInventory[1] && item.enabled !== false);
          if (!instance) return json(res, 404, { error: { code: "engine_instance_not_found", message: "Engine instance was not found." } });
          const resources = ["rootFolders", "profiles", "qualityDefinitions", "customFormats", "tags", "indexers", "downloadClients", "remotePathMappings", "notifications", "importLists", "naming", "mediaManagement", "downloadClientSettings", "delayProfiles", "restrictions", ...(instance.domain === "movie" ? ["releaseProfiles", "metadata"] : ["metadata"])];
          const entries = await Promise.all(resources.map(async (resource) => {
            try {
              const value = await management.execute(instance.domain, resource, "GET", { engineInstanceId: instance.id });
              const count = Array.isArray(value) ? value.length : Array.isArray(value?.records) ? value.records.length : value ? 1 : 0;
              return { resource, available: true, manageable: true, count, value };
            } catch (reason) {
              return { resource, available: false, manageable: false, count: 0, error: reason instanceof Error ? reason.message : "This setting could not be read from the engine." };
            }
          }));
          return json(res, 200, {
            instance: { id: instance.id, name: instance.name, domain: instance.domain, isDefault: instance.isDefault },
            summary: { identified: entries.filter((item) => item.available).length, unavailable: entries.filter((item) => !item.available).length, total: entries.length },
            resources: entries,
            storage: await instanceStorage(instance.id),
            syncedAt: new Date().toISOString(),
          });
        }
        if (engineInstanceStorage && req.method === "GET") {
          if (!administrator(res, session)) return;
          return json(res, 200, { mappings: await instanceStorage(engineInstanceStorage[1]) });
        }
        if (engineInstanceStorage && req.method === "PUT") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const instance = engineSettings.public().instances.find((item) => item.id === engineInstanceStorage[1] && item.enabled !== false);
          if (!instance) return json(res, 404, { error: { code: "engine_instance_not_found", message: "Engine instance was not found." } });
          const input = await body(req), enginePath = normalizeMediaPath(input.enginePath), vynodePath = normalizeMediaPath(input.vynodePath), hostPath = String(input.hostPath || "").trim();
          if (!enginePath || !vynodePath || !vynodePath.startsWith("/")) throw new Error("Enter an absolute VynodeArr container path");
          const rootsValue = await management.execute(instance.domain, "rootFolders", "GET", { engineInstanceId: instance.id }), roots = Array.isArray(rootsValue) ? rootsValue : rootsValue?.records || [], root = roots.find((item) => normalizeMediaPath(item.path) === enginePath);
          if (!root) throw new Error("Choose a root folder currently reported by this engine instance");
          const now = new Date().toISOString(), record = { engineInstanceId: instance.id, domain: instance.domain, enginePath, vynodePath, hostPath: hostPath || null, updatedAt: now };
          await engineStorageMappingStore.update((current) => {
            current.version = 1; current.mappings = Array.isArray(current.mappings) ? current.mappings : [];
            const index = current.mappings.findIndex((item) => item.engineInstanceId === instance.id && normalizeMediaPath(item.enginePath) === enginePath);
            if (index >= 0) current.mappings[index] = record; else current.mappings.push(record);
            current.updatedAt = now; return current;
          });
          const mapping = await engineStorageStatus(instance, root, record);
          await recordAudit(session, { category: "configuration", action: "engine_storage.mapped", target: `${instance.name}: ${enginePath}`, domain: instance.domain, summary: mapping.accessible ? `Verified ${vynodePath} for ${instance.name}.` : `Saved the intended ${vynodePath} mapping for ${instance.name}; a container restart is required after mounting the folder.`, metadata: { engineInstanceId: instance.id, enginePath, vynodePath, hostPath: hostPath || null, accessible: mapping.accessible } });
          return json(res, 200, { mapping, restartRequired: mapping.restartRequired });
        }
        if (url.pathname === "/api/settings/engines/instances/test" && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const input = await body(req),domain=String(input.domain||"");
          if(!["movie","tv"].includes(domain))return json(res,422,{error:{code:"invalid_engine_domain",message:"Choose a movie or TV engine."}});
          return json(res,200,await testEngine(domain,input));
        }
        if (engineInstanceTest && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const input=await body(req),existing=await engineSettings.instanceRuntime(engineInstanceTest[1]);
          if(!existing)return json(res,404,{error:{code:"engine_instance_not_found",message:"Engine instance was not found or has no saved credential."}});
          return json(res,200,await testEngine(existing.domain,{...existing,...input,apiCredential:String(input.apiCredential||existing.apiCredential)}));
        }
        if (url.pathname === "/api/settings/engines/instances" && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const input=await body(req),domain=String(input.domain||""),result=await testEngine(domain,input);
          if(!result.validated)return json(res,422,{error:{code:"engine_validation_failed",message:result.connection.safeError||"Engine validation did not succeed."}});
          const instance=await engineSettings.createInstance(domain,input,String(input.apiCredential||""));
          await rebuildFromSettings();
          return json(res,201,{instance,settings:engineSettings.public(),validation:result});
        }
        if (engineInstance && req.method === "PUT") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const input=await body(req),existing=await engineSettings.instanceRuntime(engineInstance[1]);
          if(!existing)return json(res,404,{error:{code:"engine_instance_not_found",message:"Engine instance was not found or has no saved credential."}});
          const result=await testEngine(existing.domain,{...existing,...input,apiCredential:String(input.apiCredential||existing.apiCredential)});
          if(!result.validated)return json(res,422,{error:{code:"engine_validation_failed",message:result.connection.safeError||"Engine validation did not succeed."}});
          const instance=await engineSettings.updateInstance(engineInstance[1],input,String(input.apiCredential||""));
          await rebuildFromSettings();
          return json(res,200,{instance,settings:engineSettings.public(),validation:result});
        }
        if (engineInstanceDefault && req.method === "PUT") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const settings=await engineSettings.setDefaultInstance(engineInstanceDefault[1]);
          await rebuildFromSettings();
          return json(res,200,{settings});
        }
        if (engineInstance && req.method === "DELETE") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const instanceId = engineInstance[1],
            destinationState = await mediaDestinations.state(),
            ownedDestinations = (destinationState.destinations || []).filter(
              (item) => String(item.engineInstanceId || "") === instanceId,
            );
          if (ownedDestinations.length)
            return json(res, 409, {
              error: {
                code: "engine_instance_in_use",
                message: `Move or remove ${ownedDestinations.length} media destination${ownedDestinations.length === 1 ? "" : "s"} assigned to this engine before removing it.`,
              },
            });
          const settings=await engineSettings.removeInstance(instanceId);
          await engineStorageMappingStore.update((current) => {
            current.mappings = (Array.isArray(current.mappings) ? current.mappings : []).filter((item) => item.engineInstanceId !== instanceId);
            current.updatedAt = new Date().toISOString(); return current;
          });
          await rebuildFromSettings();
          return json(res,200,{settings});
        }
        if (
          url.pathname === "/api/settings/engines/repair" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const repaired = await repairBundledConnections();
          await recordAudit(session, {
            category: "configuration",
            action: "engines.repaired",
            target: "Engine connections",
            summary: "Repaired installation-managed engine connections.",
          });
          return json(res, 200, {
            repaired: repaired,
            at: new Date().toISOString(),
          });
        }
        const engineKey = url.pathname.match(
          /^\/api\/settings\/engines\/(movie|tv)\/api-key$/,
        );
        if (engineKey && req.method === "GET") {
          if (!administrator(res, session)) return;
          const host = await registry
            .get(engineKey[1])
            .client.get("config/host");
          return json(res, 200, {
            domain: engineKey[1],
            apiKey: String(host.apiKey || ""),
          });
        }
        if (engineKey && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          if (String(env.VYNODEARR_BUNDLED_ENGINES || "false") !== "true")
            throw new Error(
              "API key generation is available only for installation-managed engines",
            );
          const domain = engineKey[1],
            client = registry.get(domain).client,
            host = await client.get("config/host"),
            previousKey = String(host.apiKey || ""),
            configPath =
              env[
                domain === "movie"
                  ? "MOVIE_ENGINE_CONFIG_PATH"
                  : "TV_ENGINE_CONFIG_PATH"
              ] || `/engine-config/${domain}/config.xml`;
          await client.post("command", { name: "ResetApiKey" });
          let apiKey = "";
          for (let attempt = 0; attempt < 40; attempt += 1) {
            const xml = await readFile(configPath, "utf8").catch(() => ""),
              match = xml.match(/<ApiKey>([^<]+)<\/ApiKey>/i);
            if (match?.[1] && match[1] !== previousKey) {
              apiKey = match[1];
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          if (!apiKey)
            throw new Error(
              "The engine did not provide its newly generated API key",
            );
          const runtime = await engineSettings.runtime();
          await engineSettings.save(domain, runtime[domain], apiKey);
          await rebuildFromSettings();
          let connection = null;
          for (let attempt = 0; attempt < 40; attempt += 1) {
            connection = await registry
              .get(domain)
              .testConnection()
              .catch(() => null);
            if (
              connection?.reachable &&
              connection?.authenticated &&
              connection?.compatible
            )
              break;
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          if (
            !connection?.reachable ||
            !connection?.authenticated ||
            !connection?.compatible
          )
            throw new Error(
              `${domain === "movie" ? "Movie" : "TV"} engine did not reconnect with the new API key`,
            );
          await recordAudit(session, {
            category: "security",
            action: "engine.api_key_regenerated",
            target: `${domain} engine API key`,
            domain: domain,
            summary: `Regenerated the ${domain === "movie" ? "movie" : "television"} engine API key.`,
          });
          return json(res, 200, {
            domain: domain,
            apiKey: apiKey,
            regenerated: true,
          });
        }
        const engineTest = url.pathname.match(
          /^\/api\/settings\/engines\/(movie|tv)\/test$/,
        );
        if (engineTest && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          return json(
            res,
            200,
            await testEngine(engineTest[1], await body(req)),
          );
        }
        const engineSave = url.pathname.match(
          /^\/api\/settings\/engines\/(movie|tv)$/,
        );
        if (engineSave && req.method === "PUT") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            result = await testEngine(engineSave[1], input);
          if (!result.validated)
            return json(res, 422, {
              error: {
                code: "engine_validation_failed",
                message:
                  result.connection.safeError ||
                  "Engine validation did not succeed.",
              },
            });
          await engineSettings.save(engineSave[1], input, input.apiCredential);
          await rebuildFromSettings();
          await sync.startup();
          await recordAudit(session, {
            category: "configuration",
            action: "engine.connection_saved",
            target: `${engineSave[1]} engine`,
            domain: engineSave[1],
            summary: `Updated and validated the ${engineSave[1] === "movie" ? "movie" : "television"} engine connection.`,
          });
          return json(res, 200, {
            saved: true,
            settings: engineSettings.public(),
            validation: result,
          });
        }
        if (url.pathname === "/api/system/validation" && req.method === "GET") {
          if (!administrator(res, session)) return;
          const report = await systemValidation();
          await validationStore.write({
            version: 1,
            report: report,
            updatedAt: report.generatedAt,
          });
          return json(res, 200, report);
        }
        if (
          url.pathname === "/api/system/validation/repair" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            action = String(input.action || "");
          if (action === "synchronize") {
            sync.invalidate();
            await sync.startup();
            await recordAudit(session, {
              category: "system",
              action: "validation.synchronized",
              target: "System validation",
              summary:
                "Re-synchronized both media engines from the Validation center.",
            });
            return json(res, 200, {
              repaired: true,
              action: action,
              report: await systemValidation(),
            });
          }
          if (action === "engine-connections") {
            if (String(env.VYNODEARR_BUNDLED_ENGINES || "false") !== "true")
              return json(res, 409, {
                error: {
                  code: "repair_unavailable",
                  message:
                    "Automatic connection repair is available only for installation-managed engines.",
                },
              });
            const repaired = await repairBundledConnections();
            await sync.startup();
            await recordAudit(session, {
              category: "configuration",
              action: "validation.engine_connections_repaired",
              target: "Engine connections",
              summary:
                "Repaired installation-managed engine connections from the Validation center.",
            });
            return json(res, 200, {
              repaired: true,
              action: action,
              result: repaired,
              report: await systemValidation(),
            });
          }
          return json(res, 400, {
            error: {
              code: "unsupported_repair",
              message: "Choose a supported validation repair action.",
            },
          });
        }
        if (
          url.pathname === "/api/system/application-update" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          return json(res, 200, {
            application: "VynodeArr",
            installedVersion: String(
              env.VYNODEARR_VERSION || applicationVersion,
            ),
            channel: String(env.VYNODEARR_UPDATE_CHANNEL || "develop"),
            mechanism: "Container image",
            repository: "https://github.com/minerport/VynodeArr-Unified",
            message:
              "Pull the newest VynodeArr container image, then recreate the application container. Engine updates are managed separately.",
          });
        }
        if (
          url.pathname === "/api/system/engine-updates" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          try {
            return json(res, 200, await engineUpdateReview.catalog());
          } catch (error) {
            return safeError(res, error);
          }
        }
        if (
          url.pathname === "/api/system/engine-updates/review" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            domain = String(input.domain || "");
          if (!["movie", "tv"].includes(domain))
            return json(res, 400, {
              error: {
                code: "validation_failed",
                message: "Choose the movie or television engine.",
              },
            });
          try {
            const validation = await systemValidation(),
              report = await engineUpdateReview.review(domain, {
                validation: validation,
              });
            await recordAudit(session, {
              category: "system",
              action: "engine_update.reviewed",
              target: `${domain} engine update`,
              domain: domain,
              summary: `Reviewed the latest ${domain === "movie" ? "movie" : "television"} engine release; outcome: ${report.outcome}.`,
              metadata: {
                installedVersion: report.candidate.installedVersion,
                candidateVersion: report.candidate.latestVersion,
                outcome: report.outcome,
              },
            });
            return json(res, 200, report);
          } catch (error) {
            return safeError(res, error);
          }
        }
        if (
          url.pathname === "/api/system/engine-updates/candidate-plan" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req);
          if (input.confirmation !== "PREPARE CANDIDATE")
            return json(res, 400, {
              error: {
                code: "confirmation_required",
                message:
                  "Confirm preparation of the reviewed candidate workflow.",
              },
            });
          try {
            const validation = await systemValidation(),
              reports = await Promise.all(
                ["movie", "tv"].map((domain) =>
                  engineUpdateReview.review(domain, { validation: validation }),
                ),
              ),
              backupResults = await Promise.allSettled(
                ["movie", "tv"].map((domain) =>
                  management.execute(domain, "backups", "GET"),
                ),
              ),
              cutoff = Date.now() - 24 * 60 * 6e4;
            const stale = backupResults.flatMap((result, index) => {
              if (result.status === "rejected")
                return [index ? "television" : "movie"];
              const records = Array.isArray(result.value)
                  ? result.value
                  : result.value?.records || [],
                latest = Math.max(
                  0,
                  ...records
                    .map((item) =>
                      new Date(item.time || item.createdAt || 0).getTime(),
                    )
                    .filter(Number.isFinite),
                );
              return latest >= cutoff ? [] : [index ? "television" : "movie"];
            });
            if (stale.length)
              return json(res, 409, {
                error: {
                  code: "fresh_backup_required",
                  message: `Create a fresh ${stale.join(" and ")} engine backup before preparing a candidate.`,
                },
              });
            const installed = String(
                env.VYNODEARR_VERSION || applicationVersion,
              ),
              plan = engineUpdateReview.candidatePlan(reports, {
                baseRef: String(env.VYNODEARR_UPDATE_CHANNEL || "develop"),
                currentImage: `ghcr.io/minerport/vynodearr-unified:${installed}`,
              });
            await recordAudit(session, {
              category: "system",
              action: "engine_update.candidate_prepared",
              target: "Engine candidate container",
              summary:
                "Prepared a pinned, review-only engine candidate workflow after validation and backup checks.",
              metadata: {
                movieVersion: plan.workflowInputs.movie_version,
                tvVersion: plan.workflowInputs.tv_version,
                rollbackImage: plan.rollbackImage,
              },
            });
            return json(res, 200, plan);
          } catch (error) {
            return safeError(res, error);
          }
        }
        if (url.pathname === "/api/system/master-key" && req.method === "GET") {
          if (!administrator(res, session)) return;
          return json(res, 200, masterKeyService.status());
        }
        if (
          url.pathname === "/api/settings/engines/authentication" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          return json(res, 200, await engineAuthentication());
        }
        const engineAuthenticationMatch = url.pathname.match(
          /^\/api\/settings\/engines\/(movie|tv)\/authentication$/,
        );
        if (engineAuthenticationMatch && req.method === "PUT") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req);
          if (typeof input.required !== "boolean")
            return json(res, 400, {
              error: {
                code: "validation_failed",
                message: "Authentication required must be true or false.",
              },
            });
          const result = await setEngineAuthentication(
            engineAuthenticationMatch[1],
            input.required,
          );
          await recordAudit(session, {
            category: "configuration",
            action: "engine.authentication_updated",
            target: `${engineAuthenticationMatch[1]} engine`,
            domain: engineAuthenticationMatch[1],
            summary: `${input.required ? "Required" : "Disabled"} authentication for the ${engineAuthenticationMatch[1] === "movie" ? "movie" : "television"} engine.`,
          });
          return json(res, 200, result);
        }
        if (
          url.pathname === "/api/system/master-key/rotate" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          try {
            const result = await masterKeyService.rotate(engineSettings);
            await recordAudit(session, {
              category: "security",
              action: "master_key.rotated",
              target: "VynodeArr master key",
              summary:
                "Rotated the application master key and re-encrypted saved credentials.",
            });
            return json(res, 200, { rotated: true, ...result });
          } catch (error) {
            if (error?.code === "master_key_environment_managed")
              return json(res, 409, {
                error: { code: error.code, message: error.message },
              });
            throw error;
          }
        }
        if (
          url.pathname === "/api/system/application-backup" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            result = await applicationBackupPayload(input),
            stamp = result.payload.createdAt
              .replace(/\.\d{3}Z$/, "Z")
              .replace(/:/g, "-"),
            filename = `VynodeArr_Application_Backup_${stamp}.vynodearr-backup`;
          await recordAudit(session, {
            category: "backup",
            action: "application_backup.downloaded",
            target: filename,
            summary:
              "Created and downloaded an encrypted VynodeArr application backup.",
            metadata: {
              history: result.payload.options.history,
              audit: result.payload.options.audit,
              fileCount: Object.keys(result.payload.files).length,
            },
          });
          const downloadId = randomUUID();
          applicationBackupDownloads.set(downloadId, {
            buffer: result.buffer,
            filename: filename,
            userId: session.user.id,
            expiresAt: Date.now() + 5 * 6e4,
          });
          for (const [id, item] of applicationBackupDownloads)
            if (item.expiresAt < Date.now())
              applicationBackupDownloads.delete(id);
          return json(res, 201, {
            downloadUrl: `/api/system/application-backup/${downloadId}/download`,
            filename: filename,
            expiresInSeconds: 300,
          });
        }
        const applicationBackupDownload = url.pathname.match(
          /^\/api\/system\/application-backup\/([a-f0-9-]+)\/download$/i,
        );
        if (applicationBackupDownload && req.method === "GET") {
          if (!administrator(res, session)) return;
          const item = applicationBackupDownloads.get(
            applicationBackupDownload[1],
          );
          applicationBackupDownloads.delete(applicationBackupDownload[1]);
          if (
            !item ||
            item.expiresAt < Date.now() ||
            item.userId !== session.user.id
          )
            return json(res, 404, {
              error: {
                code: "backup_download_expired",
                message: "This backup download expired. Create a new backup.",
              },
            });
          res.writeHead(200, {
            "content-type": "application/octet-stream",
            "content-disposition": `attachment; filename="${item.filename}"`,
            "content-length": item.buffer.length,
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          });
          return res.end(item.buffer);
        }
        if (
          url.pathname === "/api/system/application-backup/inspect" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const incoming = new Request(
              "http://vynodearr.local/application-backup/inspect",
              {
                method: "POST",
                headers: req.headers,
                body: req,
                duplex: "half",
              },
            ),
            form = await incoming.formData(),
            file = form.get("file"),
            password = String(form.get("password") || ""),
            inspection = await inspectApplicationBackup(file, password);
          return json(res, 200, { summary: inspection.summary });
        }
        if (
          url.pathname === "/api/system/application-backup/restore" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const incoming = new Request(
              "http://vynodearr.local/application-backup/restore",
              {
                method: "POST",
                headers: req.headers,
                body: req,
                duplex: "half",
              },
            ),
            form = await incoming.formData(),
            file = form.get("file"),
            password = String(form.get("password") || ""),
            confirmation = String(form.get("confirmation") || "");
          if (confirmation !== "RESTORE")
            return json(res, 400, {
              error: {
                code: "confirmation_required",
                message: "Type RESTORE to confirm application recovery.",
              },
            });
          const inspection = await inspectApplicationBackup(file, password),
            safety = await applicationBackupPayload({
              password: password,
              includeHistory: true,
              includeAudit: true,
            }),
            directory = join(dataDir, "application-backups");
          await mkdir(directory, { recursive: true });
          await writeFile(
            join(
              directory,
              `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.vynodearr-backup`,
            ),
            safety.buffer,
            { mode: 384 },
          );
          const restored = await restoreApplicationBackup(inspection.payload);
          await recordAudit(session, {
            category: "backup",
            action: "application_backup.restored",
            target: file.name,
            summary:
              "Restored an encrypted VynodeArr application backup. An application restart is required.",
            metadata: {
              fileCount: restored.length,
              sourceVersion: inspection.payload.applicationVersion,
            },
          });
          return json(res, 200, {
            restored: true,
            restartRequired: true,
            files: restored.length,
            preRestoreBackup: true,
          });
        }
        const backupRestore = url.pathname.match(
          /^\/api\/system\/backups\/(movie|tv)\/(\d+)\/restore$/,
        );
        if (backupRestore && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const domain = backupRestore[1],
            id = backupRestore[2],
            client = registry.get(domain).client,
            before = await client.get("system/status");
          await client.post(`system/backup/restore/${id}`, {});
          await client.post("command", { name: "Restart" });
          await completeEngineRestore(domain, before.startTime);
          await recordAudit(session, {
            category: "backup",
            action: "backup.restored",
            target: `${domain} backup ${id}`,
            domain: domain,
            summary: `Restored ${domain === "movie" ? "Movies" : "Television"} from backup ${id}.`,
            metadata: { backupId: id },
          });
          return json(res, 200, {
            restored: true,
            domain: domain,
            backupId: id,
          });
        }
        const backupDownload = url.pathname.match(
          /^\/api\/system\/backups\/(movie|tv)\/(\d+)\/download$/,
        );
        if (backupDownload && req.method === "GET") {
          if (!administrator(res, session)) return;
          const domain = backupDownload[1],
            client = registry.get(domain).client,
            backups = await client.get("system/backup"),
            backup = backups.find(
              (item) => String(item.id) === backupDownload[2],
            );
          if (!backup)
            return json(res, 404, {
              error: { code: "backup_not_found", message: "Backup not found" },
            });
          const config = client.config,
            prefix = config.urlBase
              ? `/${String(config.urlBase).replace(/^\/+|\/+$/g, "")}`
              : "",
            downloadUrl = new URL(
              `${config.https ? "https" : "http"}://${config.host}:${config.port}${prefix}${backup.path}`,
            );
          const response = await fetch(downloadUrl, {
            headers: { "x-api-key": config.apiCredential },
            signal: AbortSignal.timeout(3e4),
          });
          if (!response.ok)
            throw new Error("The backup could not be downloaded");
          const extension =
              (String(backup.name || backup.path || "").match(
                /\.(zip|db|xml)$/i,
              ) || [])[0] || ".zip",
            stamp = new Date(backup.time || Date.now())
              .toISOString()
              .replace(/\.\d{3}Z$/, "Z")
              .replace(/:/g, "-"),
            filename = `VynodeArr_${domain === "movie" ? "Movies" : "Television"}_Backup_${stamp}${extension.toLowerCase()}`;
          await recordAudit(session, {
            category: "backup",
            action: "backup.downloaded",
            target: backup.name || filename,
            domain: domain,
            summary: `Downloaded a ${domain === "movie" ? "Movies" : "Television"} configuration backup.`,
            metadata: { backupId: backupDownload[2] },
          });
          res.writeHead(200, {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="${filename}"`,
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          });
          return res.end(Buffer.from(await response.arrayBuffer()));
        }
        const backupUpload = url.pathname.match(
          /^\/api\/system\/backups\/(movie|tv)\/upload$/,
        );
        if (backupUpload && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const domain = backupUpload[1],
            client = registry.get(domain).client,
            before = await client.get("system/status"),
            incoming = new Request("http://vynodearr.local/upload", {
              method: "POST",
              headers: req.headers,
              body: req,
              duplex: "half",
            }),
            form = await incoming.formData(),
            file = form.get("file");
          if (!(file instanceof File) || file.size === 0 || file.size > 5e8)
            throw new Error("Choose a backup file smaller than 500 MB");
          if (!/\.(zip|db|xml)$/i.test(file.name))
            throw new Error("Backup must be a .zip, .db, or .xml file");
          const config = client.config,
            prefix = config.urlBase
              ? `/${String(config.urlBase).replace(/^\/+|\/+$/g, "")}`
              : "",
            uploadUrl = new URL(
              `${config.https ? "https" : "http"}://${config.host}:${config.port}${prefix}/api/v3/system/backup/restore/upload`,
            ),
            upload = new FormData();
          upload.append("file", file, file.name);
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "x-api-key": config.apiCredential },
            body: upload,
            signal: AbortSignal.timeout(12e4),
          });
          if (!response.ok)
            throw new Error("The engine rejected the uploaded backup");
          await client.post("command", { name: "Restart" });
          await completeEngineRestore(domain, before.startTime);
          await recordAudit(session, {
            category: "backup",
            action: "backup.uploaded_and_restored",
            target: file.name,
            domain: domain,
            summary: `Uploaded and restored a ${domain === "movie" ? "Movies" : "Television"} backup.`,
            metadata: { fileName: file.name, fileSize: file.size },
          });
          return json(res, 200, {
            restored: true,
            domain: domain,
            uploaded: true,
          });
        }
        if (url.pathname === "/api/system/sync" && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const results = await sync.startup();
          await recordAudit(session, {
            category: "system",
            action: "synchronization.started",
            target: "Application synchronization",
            summary: "Manually synchronized both media engines.",
            metadata: { results: results.map((item) => item.status) },
          });
          return json(res, 200, {
            synchronized: true,
            results: results.map((item) => item.status),
            state: sync.snapshot(),
          });
        }
        if (url.pathname === "/api/poster-overlays" && req.method === "GET") {
          if (!administrator(res, session)) return;
          const configuration = await posterOverlayConfiguration();
          return json(res, 200, {
            ...configuration,
            variables: posterVariables,
          });
        }
        if (url.pathname === "/api/library-review/movies" && req.method === "GET") {
          if (!administrator(res, session)) return;
          const settings = await plexSettingsStore.read(),
            token = await engineSettings.plexCredential();
          if (!settings.endpoint || !token)
            return json(res, 400, {
              error: {
                code: "plex_not_configured",
                message: "Connect Plex in Poster Overlays before reviewing libraries.",
              },
            });
          const requested = new Set(
              String(url.searchParams.get("libraryKeys") || "")
                .split(",")
                .filter(Boolean),
            ),
            libraryFilterProvided = url.searchParams.has("libraryKeys"),
            libraries = (settings.libraries || []).filter(
              (item) =>
                item.type === "movie" &&
                (!libraryFilterProvided || requested.has(String(item.key))),
            ),
            [rawVynode, rawRoots, rawProfiles] = await Promise.all([
              management.execute("movie", "library", "GET"),
              management.execute("movie", "rootFolders", "GET"),
              management.execute("movie", "profiles", "GET"),
            ]),
            vynode = (Array.isArray(rawVynode) ? rawVynode : []).map((item) => ({
              id: Number(item.id),
              publicId: `movie_${Number(item.id)}`,
              title: item.title || "Untitled movie",
              year: Number(item.year) || null,
              tmdbId: Number(item.tmdbId) || null,
              folderPath: item.path || "",
              filePath:
                item.movieFile?.path ||
                (item.path && item.movieFile?.relativePath
                  ? joinMediaPath(item.path, item.movieFile.relativePath)
                  : item.path || ""),
            })),
            scanByPath = new Map(),
            reviewTitleKey = (value) =>
              String(value || "")
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/gi, "")
                .toLowerCase(),
            vynodeByTitle = new Map();
          for (const item of vynode) {
            const key = reviewTitleKey(item.title);
            if (key) vynodeByTitle.set(key, [...(vynodeByTitle.get(key) || []), item]);
          }
          for (const item of vynode) {
            const path = normalizeMediaPath(item.folderPath);
            if (path)
              scanByPath.set(path.toLowerCase(), {
                path,
                name: item.title,
                status: "matched",
                matchType: "path",
                movieId: item.id,
                tmdbId: item.tmdbId,
                rootFolderPath: "",
                filePath: item.filePath,
              });
          }
          for (const root of Array.isArray(rawRoots) ? rawRoots : [])
            for (const folder of root.unmappedFolders || []) {
              const path = normalizeMediaPath(folder.path),
                name = folder.name || path.split("/").at(-1) || path,
                yearMatch = String(name).match(/\(((?:19|20)\d{2})\)\s*$/),
                titleName = yearMatch
                  ? String(name).slice(0, yearMatch.index).trim()
                  : name,
                candidates = vynodeByTitle.get(reviewTitleKey(titleName)) || [],
                titleMatch =
                  candidates.find((item) =>
                    yearMatch ? Number(item.year) === Number(yearMatch[1]) : true,
                  ) || null;
              if (path && !scanByPath.has(path.toLowerCase()))
                scanByPath.set(path.toLowerCase(), {
                  path,
                  name,
                  status: titleMatch ? "matched" : "unmatched",
                  matchType: titleMatch ? "title" : null,
                  movieId: titleMatch?.id || null,
                  tmdbId: titleMatch?.tmdbId || null,
                  vynodeTitle: titleMatch?.title || "",
                  rootFolderPath: normalizeMediaPath(root.path),
                  filePath: "",
                });
            }
          const plex = [];
          for (const library of libraries) {
            const items = await plexService.libraryItems(
              settings.endpoint,
              token,
              library,
            );
            plex.push(
              ...items.map((item) => {
                const tmdb = plexExternalIds(item)
                  .find((value) => value.startsWith("tmdb:"))
                  ?.slice(5);
                return {
                  ratingKey: item.ratingKey,
                  title: item.title || "Untitled movie",
                  year: Number(item.year) || null,
                  tmdbId: Number(tmdb) || null,
                  libraryKey: String(library.key),
                  libraryTitle: library.title,
                  filePaths: Array.isArray(item.files) ? item.files : [],
                };
              }),
            );
          }
          return json(res, 200, {
            libraries: (settings.libraries || []).filter(
              (item) => item.type === "movie",
            ),
            plex: plex.sort((a, b) => a.title.localeCompare(b.title)),
            vynode: vynode.sort((a, b) => a.title.localeCompare(b.title)),
            profiles: (Array.isArray(rawProfiles) ? rawProfiles : []).map(
              (profile) => ({ id: Number(profile.id), name: profile.name }),
            ),
            scan: [...scanByPath.values()].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          });
        }
        if (
          url.pathname === "/api/poster-overlays/plex" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          const settings = await plexSettingsStore.read(),
            credential = await engineSettings.plexCredential();
          return json(res, 200, {
            configured: Boolean(credential && settings.endpoint),
            endpoint: settings.endpoint || "",
            server: settings.server || null,
            libraries: settings.libraries || [],
            updatedAt: settings.updatedAt || null,
            artworkWritesEnabled: true,
          });
        }
        if (
          url.pathname === "/api/poster-overlays/plex" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            existingToken = await engineSettings.plexCredential(),
            token = String(input.token || existingToken || "").trim(),
            endpoint = sanitizePlexEndpoint(input.endpoint),
            inspection = await plexService.inspect(endpoint, token);
          await engineSettings.savePlexCredential(token);
          await plexSettingsStore.write({
            version: 1,
            ...inspection,
            updatedAt: new Date().toISOString(),
          });
          await recordAudit(session, {
            category: "configuration",
            action: "plex.connection_saved",
            target: inspection.server.name,
            summary:
              "Validated and saved the encrypted Plex connection for poster artwork review.",
            metadata: {
              libraryCount: inspection.libraries.length,
              artworkWritesEnabled: true,
            },
          });
          return json(res, 200, {
            configured: true,
            ...inspection,
            updatedAt: new Date().toISOString(),
            artworkWritesEnabled: true,
          });
        }
        if (
          url.pathname === "/api/poster-overlays/plex" &&
          req.method === "DELETE"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          await engineSettings.removePlexCredential();
          await plexSettingsStore.write({
            version: 1,
            endpoint: "",
            server: null,
            libraries: [],
            updatedAt: new Date().toISOString(),
          });
          await recordAudit(session, {
            category: "configuration",
            action: "plex.connection_removed",
            target: "Plex Media Server",
            summary: "Removed the saved Plex poster-artwork connection.",
          });
          return json(res, 200, {
            configured: false,
            endpoint: "",
            server: null,
            libraries: [],
            artworkWritesEnabled: true,
          });
        }
        if (
          url.pathname === "/api/poster-overlays/plex/matches" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            settings = await plexSettingsStore.read(),
            token = await engineSettings.plexCredential();
          if (!settings.endpoint || !token)
            return json(res, 400, {
              error: {
                code: "plex_not_configured",
                message: "Connect Plex before reviewing library matches.",
              },
            });
          const requested = new Set((input.libraryKeys || []).map(String)),
            libraries = (settings.libraries || []).filter((item) =>
              requested.has(String(item.key)),
            );
          if (!libraries.length)
            return json(res, 400, {
              error: {
                code: "plex_library_required",
                message: "Choose at least one discovered Plex library.",
              },
            });
          const entries = [];
          const destinationState = await mediaDestinations.state();
          for (const library of libraries) {
            const domain = library.type === "movie" ? "movie" : "tv",
              mappedInstances = new Set(destinationState.destinations
                .filter((item) => item.domain === domain && String(item.plexLibraryKey || "") === String(library.key))
                .map((item) => String(item.engineInstanceId || ""))),
              allVynode = await sync.list(domain),
              scopedVynode = mappedInstances.size
                ? allVynode.filter((item) => mappedInstances.has(String(item.engineInstanceId || "")))
                : allVynode,
              vynode = scopedVynode.map((item) => ({
                ...item,
                domain: domain,
              })),
              plexItems = await plexService.libraryItems(
                settings.endpoint,
                token,
                library,
              ),
              matches =
                typeof plexService.matchLibrary === "function"
                  ? plexService.matchLibrary(vynode, plexItems)
                  : plexService.match(vynode, plexItems);
            entries.push(
              ...matches.map((item) => {
                const source=vynode.find(value=>value.id===item.id),raw=item.plex[0]?.addedAt,numeric=Number(raw),date=Number.isFinite(numeric)&&numeric>0?new Date(numeric<1e12?numeric*1000:numeric):new Date(raw||"");
                return{
                  ...item,
                  variableValues:source?posterVariableValues(source,{plexAddedAt:Number.isFinite(date.getTime())?date.toISOString():null}):{},
                   plexLibrary: {
                    key: library.key,
                    title: library.title,
                    type: library.type,
                   },
                   engineInstanceId: source?.engineInstanceId || null,
                   engineInstanceName: source?.engineInstanceName || null,
                };
              }),
            );
          }
          const summary = {
            matched: entries.filter((item) => item.status === "matched").length,
            unmatched: entries.filter((item) => item.status === "unmatched")
              .length,
            ambiguous: entries.filter((item) => item.status === "ambiguous")
              .length,
            total: entries.length,
          };
          await recordAudit(session, {
            category: "configuration",
            action: "plex.match_reviewed",
            target: settings.server?.name || "Plex Media Server",
            summary:
              "Reviewed external-ID matches before Plex poster application.",
            metadata: { libraryCount: libraries.length, ...summary },
          });
          return json(res, 200, {
            generatedAt: new Date().toISOString(),
            summary: summary,
            entries: entries,
            artworkWritesEnabled: true,
          });
        }
        if (
          url.pathname === "/api/poster-overlays/plex/applications" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          const stored = await plexPosterApplicationStore.read();
          return json(res, 200, {
            applications: (stored.applications || [])
              .slice()
              .reverse()
              .map(publicPlexPosterApplication),
          });
        }
        if (
          url.pathname === "/api/poster-overlays/plex/apply" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req);
          const configuration = await posterOverlayConfiguration(),
            template = configuration.templates.find(
              (item) => item.id === String(input.templateId || ""),
            );
          if (!template || !template.enabled)
            return json(res, 400, {
              error: {
                code: "invalid_template",
                message: "Choose a compatible poster style.",
              },
            });
          const application = await applyPlexPoster(input, template, session);
          return json(res, 201, {
            application: publicPlexPosterApplication(application),
          });
        }
        if (
          url.pathname === "/api/poster-overlays/plex/apply-batch" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req, 5e5),
            targets = Array.isArray(input.targets) ? input.targets : [],
            unique = new Set(
              targets.map(
                (item) =>
                  `${item?.libraryKey}:${item?.domain}:${item?.mediaId}:${item?.ratingKey}`,
              ),
            );
          if (
            !targets.length ||
            targets.length > 500 ||
            unique.size !== targets.length
          )
            return json(res, 400, {
              error: {
                code: "invalid_plex_targets",
                message:
                  "Choose between 1 and 500 distinct matched Plex titles.",
              },
            });
          const configuration = await posterOverlayConfiguration(),
            template = configuration.templates.find(
              (item) => item.id === String(input.templateId || ""),
            );
          if (!template || !template.enabled)
            return json(res, 400, {
              error: {
                code: "invalid_template",
                message: "Choose a compatible poster style.",
              },
            });
          const applications = [],
            failures = [];
          for (const target of targets) {
            try {
              applications.push(
                publicPlexPosterApplication(
                  await applyPlexPoster(target, template, session),
                ),
              );
            } catch (error) {
              failures.push({
                mediaId: String(target?.mediaId || ""),
                title: String(target?.title || "Unknown title"),
                message: redact(error?.message || "Poster application failed"),
              });
            }
          }
          await recordAudit(session, {
            category: "configuration",
            action: "plex.poster_batch_completed",
            target: template.name,
            summary: `Completed a Plex poster batch with ${applications.length} applied and ${failures.length} failed.`,
            metadata: {
              requested: targets.length,
              applied: applications.length,
              failed: failures.length,
            },
          });
          return json(res, 200, {
            applications: applications,
            failures: failures,
            summary: {
              requested: targets.length,
              applied: applications.length,
              failed: failures.length,
            },
          });
        }
        const plexPosterRestore = url.pathname.match(
          /^\/api\/poster-overlays\/plex\/applications\/(plex_poster_[A-Za-z0-9-]+)\/restore$/,
        );
        if (plexPosterRestore && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          await body(req);
          const stored = await plexPosterApplicationStore.read(),
            application = (stored.applications || []).find(
              (item) => item.id === plexPosterRestore[1],
            );
          if (!application)
            return json(res, 404, {
              error: {
                code: "not_found",
                message: "The Plex poster rollback record was not found.",
              },
            });
          if (application.restoredAt)
            return json(res, 409, {
              error: {
                code: "already_restored",
                message: "This Plex poster was already restored.",
              },
            });
          if (
            !/^plex_poster_[A-Za-z0-9-]+\.poster$/.test(
              String(application.backupFile || ""),
            )
          )
            throw new Error("The Plex rollback record is invalid");
          const settings = await plexSettingsStore.read(),
            token = await engineSettings.plexCredential();
          if (
            !settings.endpoint ||
            !token ||
            settings.server?.machineIdentifier !==
              application.serverMachineIdentifier
          )
            return json(res, 400, {
              error: {
                code: "plex_server_changed",
                message:
                  "Reconnect the original Plex server before restoring this poster.",
              },
            });
          const original = await readFile(
            join(plexPosterBackupDir, application.backupFile),
          );
          if (
            createHash("sha256").update(original).digest("hex") !==
            application.backupSha256
          )
            throw new Error(
              "The captured Plex rollback poster failed integrity validation",
            );
          await plexService.uploadPoster(
            settings.endpoint,
            token,
            application.ratingKey,
            original,
            application.backupContentType,
          );
          const restoredAt = new Date().toISOString();
          await plexPosterApplicationStore.update((state) => {
            const current = (state.applications || []).find(
              (item) => item.id === application.id,
            );
            if (current) current.restoredAt = restoredAt;
          });
          application.restoredAt = restoredAt;
          await recordAudit(session, {
            category: "configuration",
            action: "plex.poster_restored",
            target: application.title,
            summary:
              "Restored the exact Plex poster captured before overlay application.",
            metadata: {
              applicationId: application.id,
              library: application.plexLibraryTitle,
              ratingKey: application.ratingKey,
              integrityVerified: true,
            },
          });
          return json(res, 200, {
            application: publicPlexPosterApplication(application),
          });
        }
        const plexArtworkPreview = url.pathname.match(
          /^\/api\/poster-overlays\/plex\/(original|preview)\/(movie|tv)\/((?:movie|series)_[A-Za-z0-9_-]+)$/,
        );
        if (plexArtworkPreview && req.method === "GET") {
          if (!administrator(res, session)) return;
          const [, modeName, domain, mediaId] = plexArtworkPreview,
            libraryKey = String(url.searchParams.get("libraryKey") || ""),
            ratingKey = String(url.searchParams.get("ratingKey") || "");
          if (!/^\d+$/.test(ratingKey))
            return json(res, 400, {
              error: {
                code: "invalid_plex_target",
                message: "Choose a valid matched Plex title.",
              },
            });
          const target = await plexPreviewTarget({
            domain: domain,
            mediaId: mediaId,
            libraryKey: libraryKey,
            ratingKey: ratingKey,
          });
          if (modeName === "original") {
            res.writeHead(200, {
              "content-type": target.poster.contentType,
              "cache-control": "private, max-age=300",
              "x-content-type-options": "nosniff",
            });
            return res.end(target.poster.body);
          }
          const templateId = String(url.searchParams.get("templateId") || ""),
            configuration = await posterOverlayConfiguration(),
            template = configuration.templates.find(
              (item) => item.id === templateId,
            );
          if (
            !template ||
            !template.enabled ||
            template.target !== "plex" ||
            (template.domain !== "all" && template.domain !== domain)
          )
            return json(res, 400, {
              error: {
                code: "invalid_template",
                message: "Choose a compatible Plex poster style.",
              },
            });
          const rendered = await renderedPlexPoster(target, template, session);
          res.writeHead(200, {
            "content-type": "image/jpeg",
            "content-length": rendered.length,
            "cache-control": "private, max-age=300",
            "x-content-type-options": "nosniff",
          });
          return res.end(rendered);
        }
        if (
          url.pathname === "/api/poster-overlays/templates" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const template = sanitizeOverlayTemplate(await body(req));
          await posterOverlayStore.update((current) => {
            current.templates = current.templates || [];
            current.templates.push(template);
          });
          clearPosterOverlayCache();
          await recordAudit(session, {
            category: "configuration",
            action: "poster_overlay.template_created",
            target: template.name,
            summary: "Created a poster overlay template.",
          });
          return json(res, 201, { template: template });
        }
        const overlayTemplateMatch = url.pathname.match(
          /^\/api\/poster-overlays\/templates\/(overlay_[A-Za-z0-9_-]+)$/,
        );
        if (overlayTemplateMatch && req.method === "PUT") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const current = await posterOverlayStore.read(),
            existing = (current.templates || []).find(
              (item) => item.id === overlayTemplateMatch[1],
            );
          if (!existing)
            return json(res, 404, {
              error: {
                code: "not_found",
                message: "Poster overlay template was not found.",
              },
            });
          const template = sanitizeOverlayTemplate(await body(req), existing);
          await posterOverlayStore.update((state) => {
            state.templates = (state.templates || []).map((item) =>
              item.id === template.id ? template : item,
            );
          });
          clearPosterOverlayCache();
          await recordAudit(session, {
            category: "configuration",
            action: "poster_overlay.template_updated",
            target: template.name,
            summary: "Updated a poster overlay template.",
          });
          return json(res, 200, { template: template });
        }
        if (overlayTemplateMatch && req.method === "DELETE") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          let removed = null;
          await posterOverlayStore.update((state) => {
            removed =
              (state.templates || []).find(
                (item) => item.id === overlayTemplateMatch[1],
              ) || null;
            state.templates = (state.templates || []).filter(
              (item) => item.id !== overlayTemplateMatch[1],
            );
            state.assignments = (state.assignments || []).filter(
              (item) => item.templateId !== overlayTemplateMatch[1],
            );
          });
          if (!removed)
            return json(res, 404, {
              error: {
                code: "not_found",
                message: "Poster overlay template was not found.",
              },
            });
          clearPosterOverlayCache();
          await recordAudit(session, {
            category: "configuration",
            action: "poster_overlay.template_deleted",
            target: removed.name,
            summary: "Deleted a poster overlay template and its assignments.",
          });
          return json(res, 200, { deleted: true });
        }
        if (
          url.pathname === "/api/poster-overlays/assignments" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            state = await posterOverlayStore.read(),
            template = (state.templates || []).find(
              (item) => item.id === input.templateId,
            );
          if (!template)
            return json(res, 400, {
              error: {
                code: "invalid_template",
                message: "Choose an existing poster overlay template.",
              },
            });
          if (posterTemplateTarget(template) === "plex")
            return json(res, 400, {
              error: {
                code: "template_target_mismatch",
                message: `${template.name} was created for Plex artwork and cannot be assigned to the VynodeArr library.`,
              },
            });
          const assignment = sanitizeOverlayAssignment(input);
          if (
            template.domain !== "all" &&
            template.domain !== assignment.scope.domain
          )
            return json(res, 400, {
              error: {
                code: "template_domain_mismatch",
                message: `${template.name} can only be applied to ${template.domain === "movie" ? "Movies" : "Television"}.`,
              },
            });
          await warmAssignedTelevisionOverlay(template, assignment);
          await posterOverlayStore.update((current) => {
            current.assignments = current.assignments || [];
            current.assignments.push(assignment);
          });
          clearPosterOverlayCache();
          await recordAudit(session, {
            category: "configuration",
            action: "poster_overlay.assignment_created",
            target: assignment.name,
            summary: "Created a poster overlay assignment.",
          });
          return json(res, 201, { assignment: assignment });
        }
        const overlayAssignmentMatch = url.pathname.match(
          /^\/api\/poster-overlays\/assignments\/(assignment_[A-Za-z0-9_-]+)$/,
        );
        if (overlayAssignmentMatch && req.method === "PUT") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const state = await posterOverlayStore.read(),
            existing = (state.assignments || []).find(
              (item) => item.id === overlayAssignmentMatch[1],
            ),
            input = await body(req);
          if (!existing)
            return json(res, 404, {
              error: {
                code: "not_found",
                message: "Poster overlay assignment was not found.",
              },
            });
          const template = (state.templates || []).find(
            (item) => item.id === input.templateId,
          );
          if (!template)
            return json(res, 400, {
              error: {
                code: "invalid_template",
                message: "Choose an existing poster overlay template.",
              },
            });
          if (posterTemplateTarget(template) === "plex")
            return json(res, 400, {
              error: {
                code: "template_target_mismatch",
                message: `${template.name} was created for Plex artwork and cannot be assigned to the VynodeArr library.`,
              },
            });
          const assignment = sanitizeOverlayAssignment(input, existing);
          if (
            template.domain !== "all" &&
            template.domain !== assignment.scope.domain
          )
            return json(res, 400, {
              error: {
                code: "template_domain_mismatch",
                message: `${template.name} can only be applied to ${template.domain === "movie" ? "Movies" : "Television"}.`,
              },
            });
          await posterOverlayStore.update((current) => {
            current.assignments = (current.assignments || []).map((item) =>
              item.id === assignment.id ? assignment : item,
            );
          });
          clearPosterOverlayCache();
          await recordAudit(session, {
            category: "configuration",
            action: "poster_overlay.assignment_updated",
            target: assignment.name,
            summary: "Updated a poster overlay assignment.",
          });
          return json(res, 200, { assignment: assignment });
        }
        if (overlayAssignmentMatch && req.method === "DELETE") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          let removed = null;
          await posterOverlayStore.update((state) => {
            removed =
              (state.assignments || []).find(
                (item) => item.id === overlayAssignmentMatch[1],
              ) || null;
            state.assignments = (state.assignments || []).filter(
              (item) => item.id !== overlayAssignmentMatch[1],
            );
          });
          if (!removed)
            return json(res, 404, {
              error: {
                code: "not_found",
                message: "Poster overlay assignment was not found.",
              },
            });
          clearPosterOverlayCache();
          await recordAudit(session, {
            category: "configuration",
            action: "poster_overlay.assignment_deleted",
            target: removed.name,
            summary: "Deleted a poster overlay assignment.",
          });
          return json(res, 200, { deleted: true });
        }
        if (url.pathname === "/api/collections" && req.method === "GET") {
          const stored = await collectionStore.read(),
            movies = await sync.list("movie"),
            collections = (stored.collections || []).map((collection) => {
              const members = resolveCollectionMembers(collection, movies);
              return {
                ...collection,
                movieIds: members.map((movie) => movie.id),
                members: members,
                count: members.length,
              };
            });
          return json(res, 200, {
            items: collections,
            userCollections: await userRequestCollections(session),
            currentUserId: session.user.id,
          });
        }
        if (
          url.pathname === "/api/user-collections/sharing" &&
          req.method === "GET"
        ) {
          const stored = await requestStore.read(),
            users = await auth.listUsers(),
            target = String(url.searchParams.get("userId") || session.user.id);
          if (
            target !== session.user.id &&
            session.user.role !== "administrator"
          )
            return json(res, 403, {
              error: {
                code: "forbidden",
                message: "You cannot manage another user collection.",
              },
            });
          return json(res, 200, {
            preference: stored.collectionPreferences?.[target] || {
              visibility: "private",
              sharedWith: [],
            },
            users: users
              .filter((user) => user.id !== target && !user.disabled)
              .map(({ id: id, name: name, username: username }) => ({
                id: id,
                name: name,
                username: username,
              })),
          });
        }
        if (
          url.pathname === "/api/user-collections/sharing" &&
          req.method === "PUT"
        ) {
          if (!requireCsrf(req, res, session)) return;
          const input = await body(req),
            target = String(input.userId || session.user.id);
          if (
            target !== session.user.id &&
            session.user.role !== "administrator"
          )
            return json(res, 403, {
              error: {
                code: "forbidden",
                message: "You cannot manage another user collection.",
              },
            });
          const visibility = ["private", "household", "specific"].includes(
              input.visibility,
            )
              ? input.visibility
              : "private",
            users = await auth.listUsers(),
            allowed = new Set(users.map((user) => user.id)),
            sharedWith = [
              ...new Set(
                (input.sharedWith || [])
                  .map(String)
                  .filter((id) => id !== target && allowed.has(id)),
              ),
            ];
          await requestStore.update((current) => {
            current.collectionPreferences = current.collectionPreferences || {};
            current.collectionPreferences[target] = {
              visibility: visibility,
              sharedWith: visibility === "specific" ? sharedWith : [],
            };
          });
          await recordAudit(session, {
            category: "collection",
            action: "user_collection.sharing_updated",
            target: target,
            summary: `Changed user collection visibility to ${visibility}.`,
            metadata: {
              visibility: visibility,
              sharedWithCount: sharedWith.length,
            },
          });
          return json(res, 200, {
            preference: {
              visibility: visibility,
              sharedWith: visibility === "specific" ? sharedWith : [],
            },
          });
        }
        if (
          url.pathname === "/api/request-attribution" &&
          req.method === "GET"
        ) {
          const domain = String(url.searchParams.get("domain") || ""),
            mediaIds = String(url.searchParams.get("mediaIds") || "")
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
              .slice(0, 1e3);
          if (!["movie", "tv"].includes(domain))
            return json(res, 400, {
              error: {
                code: "invalid_domain",
                message: "Choose Movies or Television.",
              },
            });
          return json(res, 200, {
            items: await requestAttribution(domain, mediaIds, session),
          });
        }
        if (
          url.pathname === "/api/user-collections/timeline" &&
          req.method === "GET"
        ) {
          const target = String(
            url.searchParams.get("userId") || session.user.id,
          );
          if (
            target !== session.user.id &&
            session.user.role !== "administrator"
          )
            return json(res, 403, {
              error: {
                code: "forbidden",
                message: "You cannot view another user timeline.",
              },
            });
          const [stored, activities, decisions, history] = await Promise.all([
              requestStore.read(),
              searchActivityStore.read(),
              downloadDecisionStore.read(),
              dashboardHistory().catch(() => []),
            ]),
            requests = (stored.requests || []).filter(
              (item) => item.userId === target,
            ),
            keys = new Map(
              requests
                .filter((item) => item.engineId != null)
                .map((item) => [`${item.domain}:${item.engineId}`, item]),
            );
          const events = [];
          for (const item of requests) {
            events.push({
              id: `${item.id}:requested`,
              type: "request",
              domain: item.domain,
              mediaId: item.engineId,
              title: item.title,
              status: item.status,
              timestamp: item.requestedAt || item.createdAt || item.updatedAt,
              detail: item.message || "Media requested",
            });
            if (item.approvedAt)
              events.push({
                id: `${item.id}:approved`,
                type: "approval",
                domain: item.domain,
                mediaId: item.engineId,
                title: item.title,
                status: "approved",
                timestamp: item.approvedAt,
                detail: "Request approved",
              });
            if (item.cancelledAt)
              events.push({
                id: `${item.id}:canceled`,
                type: "cancel",
                domain: item.domain,
                mediaId: item.engineId,
                title: item.title,
                status: "canceled",
                timestamp: item.cancelledAt,
                detail: "Request canceled",
              });
          }
          for (const item of activities.activities || []) {
            const request = keys.get(`${item.domain}:${item.mediaId}`);
            if (request)
              events.push({
                id: item.id,
                type: "search",
                domain: item.domain,
                mediaId: item.mediaId,
                title: item.title || request.title,
                status: item.status,
                timestamp: item.updatedAt || item.createdAt,
                detail: item.message || "Automatic search activity",
              });
          }
          for (const item of decisions.decisions || []) {
            if (item.userId === target)
              events.push({
                id: item.id,
                type: "decision",
                domain: item.domain,
                mediaId: item.mediaId,
                title: item.title,
                status: item.decision,
                timestamp: item.observedAt,
                detail: (item.reasons || [])[0] || "Download decision recorded",
              });
          }
          for (const item of history) {
            const request = keys.get(`${item.domain}:${item.mediaId}`);
            if (request)
              events.push({
                id: `history:${item.id}`,
                type: "history",
                domain: item.domain,
                mediaId: item.mediaId,
                title: item.title || request.title,
                status: item.eventType || "history",
                timestamp: item.timestamp,
                detail: item.details || item.context || "Library activity",
              });
          }
          return json(res, 200, {
            items: events
              .filter((item) => item.timestamp)
              .sort((a, b) =>
                String(b.timestamp).localeCompare(String(a.timestamp)),
              )
              .slice(0, 1e3),
          });
        }
        if (
          url.pathname === "/api/user-collections/export" &&
          req.method === "GET"
        ) {
          const target = String(
              url.searchParams.get("userId") || session.user.id,
            ),
            format = String(url.searchParams.get("format") || "json");
          if (
            target !== session.user.id &&
            session.user.role !== "administrator"
          )
            return json(res, 403, {
              error: {
                code: "forbidden",
                message: "You cannot export another user collection.",
              },
            });
          const collection = (
            await userRequestCollections({
              ...session,
              user: { ...session.user, role: "administrator" },
            })
          ).find((item) => item.user.id === target);
          if (!collection)
            return json(res, 404, {
              error: { code: "not_found", message: "Collection not found." },
            });
          const records = [...collection.movies, ...collection.television].map(
            ({
              domain: domain,
              id: id,
              title: title,
              year: year,
              tmdbId: tmdbId,
              tvdbId: tvdbId,
              collectionSource: collectionSource,
            }) => ({
              domain: domain,
              id: id,
              title: title,
              year: year || "",
              tmdbId: tmdbId || "",
              tvdbId: tvdbId || "",
              source: collectionSource,
            }),
          );
          if (format === "csv") {
            const escape = (value) =>
                `"${String(value ?? "").replace(/"/g, '""')}"`,
              csv = [
                "domain,id,title,year,tmdbId,tvdbId,source",
                ...records.map((row) =>
                  [
                    row.domain,
                    row.id,
                    row.title,
                    row.year,
                    row.tmdbId,
                    row.tvdbId,
                    row.source,
                  ]
                    .map(escape)
                    .join(","),
                ),
              ].join("\r\n");
            res.writeHead(200, {
              "content-type": "text/csv; charset=utf-8",
              "content-disposition": `attachment; filename="vynodearr-${collection.user.username}-collection.csv"`,
              "cache-control": "no-store",
            });
            return res.end(csv);
          }
          return json(
            res,
            200,
            {
              version: 1,
              exportedAt: new Date().toISOString(),
              user: collection.user,
              items: records,
            },
            {
              "content-disposition": `attachment; filename="vynodearr-${collection.user.username}-collection.json"`,
            },
          );
        }
        if (
          url.pathname === "/api/user-collections/import" &&
          req.method === "POST"
        ) {
          if (!requireCsrf(req, res, session)) return;
          const input = await body(req, 5e6),
            target = String(input.userId || session.user.id);
          if (
            target !== session.user.id &&
            session.user.role !== "administrator"
          )
            return json(res, 403, {
              error: {
                code: "forbidden",
                message: "You cannot import into another user collection.",
              },
            });
          const libraries = {
              movie: await sync.list("movie"),
              tv: await sync.list("tv"),
            },
            items = Array.isArray(input.items) ? input.items.slice(0, 5e3) : [],
            added = [];
          for (const candidate of items) {
            const domain = String(candidate.domain || ""),
              library = libraries[domain] || [],
              match = library.find(
                (item) =>
                  String(item.id) === String(candidate.id) ||
                  (candidate.tmdbId &&
                    String(item.tmdbId) === String(candidate.tmdbId)) ||
                  (candidate.tvdbId &&
                    String(item.tvdbId) === String(candidate.tvdbId)),
              );
            if (match)
              added.push({
                id: `interest_${randomUUID()}`,
                userId: target,
                domain: domain,
                engineId: match.id,
                tmdbId: match.tmdbId || null,
                tvdbId: match.tvdbId || null,
                title: match.title,
                addedAt: new Date().toISOString(),
              });
          }
          await requestStore.update((current) => {
            current.interests = current.interests || [];
            const existing = new Set(
              current.interests.map(
                (item) => `${item.userId}:${item.domain}:${item.engineId}`,
              ),
            );
            for (const item of added)
              if (
                !existing.has(`${item.userId}:${item.domain}:${item.engineId}`)
              ) {
                current.interests.push(item);
                existing.add(`${item.userId}:${item.domain}:${item.engineId}`);
              }
          });
          await recordAudit(session, {
            category: "collection",
            action: "user_collection.imported",
            target: target,
            summary: `Imported ${added.length} matching collection titles.`,
            metadata: { matched: added.length, submitted: items.length },
          });
          return json(res, 200, {
            matched: added.length,
            submitted: items.length,
          });
        }
        if (
          url.pathname === "/api/user-collections/bulk" &&
          req.method === "POST"
        ) {
          if (!requireCsrf(req, res, session)) return;
          const input = await body(req),
            target = String(input.userId || session.user.id),
            action = String(input.action || ""),
            items = (input.items || [])
              .filter(
                (item) =>
                  ["movie", "tv"].includes(item.domain) &&
                  String(item.id || ""),
              )
              .slice(0, 500);
          if (
            target !== session.user.id &&
            session.user.role !== "administrator"
          )
            return json(res, 403, {
              error: {
                code: "forbidden",
                message: "You cannot change another user collection.",
              },
            });
          if (
            !["remove", "search", "monitor", "unmonitor", "profile"].includes(
              action,
            )
          )
            return json(res, 400, {
              error: {
                code: "invalid_action",
                message: "Choose a supported bulk action.",
              },
            });
          if (action !== "remove" && session.user.role !== "administrator")
            return json(res, 403, {
              error: {
                code: "administrator_required",
                message:
                  "Administrator access is required for library management actions.",
              },
            });
          let completed = 0,
            failed = 0;
          if (action === "remove") {
            await requestStore.update((current) => {
              const keys = new Set(
                  items.map((item) => `${item.domain}:${item.id}`),
                ),
                before = (current.interests || []).length;
              current.interests = (current.interests || []).filter(
                (item) =>
                  item.userId !== target ||
                  !keys.has(`${item.domain}:${item.engineId}`),
              );
              completed = before - current.interests.length;
            });
          } else
            for (const item of items) {
              try {
                const client = registry.get(item.domain).client,
                  id = Number(String(item.id).replace(/^(movie|series)_/, ""));
                if (!Number.isFinite(id))
                  throw new Error("Engine ID unavailable");
                if (action === "search")
                  await client.post(
                    "command",
                    item.domain === "movie"
                      ? { name: "MoviesSearch", movieIds: [id] }
                      : { name: "SeriesSearch", seriesId: id },
                  );
                else {
                  const path = `${item.domain === "movie" ? "movie" : "series"}/${id}`,
                    record = await client.get(path);
                  if (action === "profile")
                    record.qualityProfileId = Number(input.qualityProfileId);
                  else record.monitored = action === "monitor";
                  await client.put(path, record);
                }
                completed++;
              } catch {
                failed++;
              }
            }
          await recordAudit(session, {
            category: "collection",
            action: `user_collection.bulk_${action}`,
            target: target,
            summary: `Applied ${action} to ${completed} collection title${completed === 1 ? "" : "s"}.`,
            metadata: { completed: completed, failed: failed },
          });
          return json(res, 200, { completed: completed, failed: failed });
        }
        if (
          url.pathname === "/api/user-collections/contains" &&
          req.method === "GET"
        ) {
          const domain = String(url.searchParams.get("domain") || ""),
            engineId = String(url.searchParams.get("mediaId") || "").trim();
          if (!["movie", "tv"].includes(domain) || !engineId)
            return json(res, 400, {
              error: {
                code: "invalid_media",
                message: "Choose a valid library title.",
              },
            });
          const collections = await userRequestCollections(session),
            mine = collections.find((item) => item.user.id === session.user.id),
            items = domain === "movie" ? mine?.movies : mine?.television,
            member = items?.find(
              (item) =>
                collectionMediaId(domain, item.id) ===
                collectionMediaId(domain, engineId),
            );
          return json(res, 200, {
            included: Boolean(member),
            source: member?.collectionSource || null,
            canRemove: member?.collectionSource === "saved",
          });
        }
        if (
          url.pathname === "/api/user-collections/attribution" &&
          req.method === "GET"
        ) {
          const domain = String(url.searchParams.get("domain") || ""),
            engineId = String(url.searchParams.get("mediaId") || "").trim();
          if (!["movie", "tv"].includes(domain) || !engineId)
            return json(res, 400, {
              error: {
                code: "invalid_media",
                message: "Choose a valid library title.",
              },
            });
          const collections = await userRequestCollections(session),
            users = collections.flatMap((collection) => {
              const items =
                  domain === "movie"
                    ? collection.movies
                    : collection.television,
                member = items.find(
                  (item) =>
                    collectionMediaId(domain, item.id) ===
                    collectionMediaId(domain, engineId),
                );
              return member
                ? [
                    {
                      ...collection.user,
                      source: member.collectionSource,
                      requestedAt: member.requestedAt || null,
                    },
                  ]
                : [];
            });
          return json(res, 200, { users: users });
        }
        if (
          url.pathname === "/api/user-collections/items" &&
          req.method === "POST"
        ) {
          if (!requireCsrf(req, res, session)) return;
          const input = await body(req),
            domain = String(input.domain || ""),
            engineId = String(input.mediaId || "").trim();
          if (!["movie", "tv"].includes(domain) || !engineId)
            return json(res, 400, {
              error: {
                code: "invalid_media",
                message: "Choose a valid library title.",
              },
            });
          const library = await sync.list(domain),
            media = resolveCollectionMedia(domain, library, {
              ...input,
              engineId: engineId,
            });
          if (!media)
            return json(res, 404, {
              error: {
                code: "not_found",
                message:
                  "This title could not be matched to the current library. Refresh the library and try again.",
              },
            });
          const canonicalId = String(media.id),
            identity = {
              engineId: canonicalId,
              tmdbId: media.tmdbId || input.tmdbId || null,
              tvdbId: media.tvdbId || input.tvdbId || null,
            };
          let interest;
          await requestStore.update((current) => {
            current.interests = current.interests || [];
            interest = current.interests.find(
              (item) =>
                item.userId === session.user.id &&
                item.domain === domain &&
                sameCollectionMedia(domain, item, identity),
            );
            if (!interest) {
              interest = {
                id: `interest_${randomUUID()}`,
                userId: session.user.id,
                domain: domain,
                ...identity,
                title: media.title,
                year: media.year || null,
                addedAt: new Date().toISOString(),
              };
              current.interests.push(interest);
            }
          });
          await recordAudit(session, {
            category: "collection",
            action: "user_collection.item_added",
            target: media.title,
            domain: domain,
            summary: `Added ${media.title} to the user's collection.`,
            metadata: {
              engineId: canonicalId,
              tmdbId: identity.tmdbId,
              tvdbId: identity.tvdbId,
              interestId: interest.id,
            },
          });
          return json(res, 201, { item: interest });
        }
        const userCollectionItemMatch = url.pathname.match(
          /^\/api\/user-collections\/items\/(movie|tv)\/([A-Za-z0-9_-]+)$/,
        );
        if (userCollectionItemMatch && req.method === "DELETE") {
          if (!requireCsrf(req, res, session)) return;
          const [, domain, engineId] = userCollectionItemMatch;
          let removed = null;
          await requestStore.update((current) => {
            const interests = current.interests || [];
            removed =
              interests.find(
                (item) =>
                  item.userId === session.user.id &&
                  item.domain === domain &&
                  collectionMediaId(domain, item.engineId) ===
                    collectionMediaId(domain, engineId),
              ) || null;
            current.interests = interests.filter((item) => item !== removed);
          });
          if (removed)
            await recordAudit(session, {
              category: "collection",
              action: "user_collection.item_removed",
              target: removed.title,
              domain: domain,
              summary: `Removed ${removed.title} from the user's collection.`,
              metadata: { engineId: engineId, interestId: removed.id },
            });
          return json(res, 200, { removed: Boolean(removed) });
        }
        if (url.pathname === "/api/collections" && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            name = String(input.name || "").trim(),
            type = input.type === "smart" ? "smart" : "custom",
            rules =
              input.rules && typeof input.rules === "object"
                ? input.rules
                : { titleContains: String(input.titleContains || "").trim() };
          if (!name) throw new Error("Collection name is required");
          if (
            type === "smart" &&
            !Object.values(rules).some((value) =>
              Array.isArray(value) ? value.length : Boolean(value),
            )
          )
            throw new Error("Smart collections require at least one rule");
          if (type === "smart" && String(rules.titleContains || "").trim()) {
            const title = String(rules.titleContains).trim().toLowerCase(),
              movies = await sync.list("movie");
            if (
              movies.filter((movie) =>
                String(movie.title || "")
                  .toLowerCase()
                  .includes(title),
              ).length < 2
            )
              throw new Error(
                "A title-based smart collection requires at least two matching movies",
              );
          }
          const stored = await collectionStore.read(),
            collections = stored.collections || [];
          if (
            collections.some(
              (collection) =>
                collection.name.toLowerCase() === name.toLowerCase(),
            )
          )
            throw new Error("A collection with this name already exists");
          const collection = {
            id: `collection_${randomUUID()}`,
            name: name,
            type: type,
            rules: type === "smart" ? rules : {},
            movieIds:
              type === "custom"
                ? [...new Set((input.movieIds || []).map(String))]
                : [],
            includedMovieIds:
              type === "smart"
                ? [...new Set((input.includedMovieIds || []).map(String))]
                : [],
            excludedMovieIds:
              type === "smart"
                ? [...new Set((input.excludedMovieIds || []).map(String))]
                : [],
            createdAt: new Date().toISOString(),
          };
          collections.push(collection);
          await collectionStore.write({ version: 1, collections: collections });
          await recordAudit(session, {
            category: "collection",
            action: "collection.created",
            target: name,
            domain: "movie",
            summary: `Created the ${type} collection ${name}.`,
            metadata: { collectionId: collection.id, type: type },
          });
          return json(res, 201, { item: collection });
        }
        const collectionMatch = url.pathname.match(
          /^\/api\/collections\/(collection_[A-Za-z0-9-]+)$/,
        );
        if (collectionMatch && req.method === "PUT") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            stored = await collectionStore.read(),
            collections = stored.collections || [],
            index = collections.findIndex(
              (collection) => collection.id === collectionMatch[1],
            );
          if (index < 0)
            return json(res, 404, {
              error: { message: "Collection not found" },
            });
          const name = String(input.name || "").trim(),
            type = input.type === "smart" ? "smart" : "custom",
            rules =
              input.rules && typeof input.rules === "object" ? input.rules : {};
          if (!name) throw new Error("Collection name is required");
          if (
            type === "smart" &&
            !Object.values(rules).some((value) =>
              Array.isArray(value) ? value.length : Boolean(value),
            )
          )
            throw new Error("Smart collections require at least one rule");
          if (type === "smart" && String(rules.titleContains || "").trim()) {
            const title = String(rules.titleContains).trim().toLowerCase(),
              movies = await sync.list("movie");
            if (
              movies.filter((movie) =>
                String(movie.title || "")
                  .toLowerCase()
                  .includes(title),
              ).length < 2
            )
              throw new Error(
                "A title-based smart collection requires at least two matching movies",
              );
          }
          if (
            collections.some(
              (collection, collectionIndex) =>
                collectionIndex !== index &&
                collection.name.toLowerCase() === name.toLowerCase(),
            )
          )
            throw new Error("A collection with this name already exists");
          collections[index] = {
            ...collections[index],
            name: name,
            type: type,
            rules: type === "smart" ? rules : {},
            movieIds:
              type === "custom"
                ? [...new Set((input.movieIds || []).map(String))]
                : [],
            includedMovieIds:
              type === "smart"
                ? [...new Set((input.includedMovieIds || []).map(String))]
                : [],
            excludedMovieIds:
              type === "smart"
                ? [...new Set((input.excludedMovieIds || []).map(String))]
                : [],
            updatedAt: new Date().toISOString(),
          };
          await collectionStore.write({ version: 1, collections: collections });
          await recordAudit(session, {
            category: "collection",
            action: "collection.updated",
            target: name,
            domain: "movie",
            summary: `Updated the ${type} collection ${name}.`,
            metadata: { collectionId: collections[index].id, type: type },
          });
          return json(res, 200, { item: collections[index] });
        }
        if (collectionMatch && req.method === "DELETE") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const stored = await collectionStore.read(),
            removed = (stored.collections || []).find(
              (collection) => collection.id === collectionMatch[1],
            ),
            collections = (stored.collections || []).filter(
              (collection) => collection.id !== collectionMatch[1],
            );
          await collectionStore.write({ version: 1, collections: collections });
          await recordAudit(session, {
            category: "collection",
            action: "collection.deleted",
            target: removed?.name || collectionMatch[1],
            domain: "movie",
            summary: `Deleted the collection ${removed?.name || collectionMatch[1]}.`,
            metadata: { collectionId: collectionMatch[1] },
          });
          return json(res, 200, { deleted: true });
        }
        if (
          url.pathname === "/api/media-files/reassign" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            result = await reassignMediaFile(input),
            domain = String(input.domain || "");
          await recordAudit(session, {
            category: "media",
            action: "media_file.reassigned",
            target: String(input.path || input.fileId || "Media file"),
            domain: ["movie", "tv"].includes(domain) ? domain : null,
            summary: "Reassigned a media file to a different library item.",
            metadata: {
              fileId: input.fileId || null,
              mediaId: input.mediaId || null,
            },
          });
          return json(res, 200, { reassigned: true, result: result });
        }
        if (url.pathname === "/api/media-match" && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            result = await rematchMedia(input),
            domain = String(input.domain || "");
          await recordAudit(session, {
            category: "media",
            action: "media.rematched",
            target: String(
              result?.title || input.title || input.mediaId || "Library item",
            ),
            domain: ["movie", "tv"].includes(domain) ? domain : null,
            summary: "Changed the external metadata match for a library item.",
            metadata: {
              mediaId: input.mediaId || null,
              tmdbId: input.tmdbId || null,
              imdbId: input.imdbId || null,
            },
          });
          return json(res, 200, { matched: true, result: result });
        }
        if (
          url.pathname === "/api/media-files/naming-audit" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            domain = String(input.domain || "");
          if (!["movie", "tv"].includes(domain))
            throw new Error("Choose the movie or television library to audit");
          const active = [...namingAuditJobs.values()].find(
            (job) => job.domain === domain && job.status === "running",
          );
          if (active)
            return json(res, 202, { job: publicNamingAuditJob(active) });
          const job = {
            id: randomUUID(),
            domain: domain,
            status: "running",
            total: 0,
            completed: 0,
            matching: 0,
            failed: 0,
            currentTitle: "",
            results: [],
            errors: [],
            createdAt: new Date().toISOString(),
            finishedAt: null,
          };
          namingAuditJobs.set(job.id, job);
          void runNamingAudit(job);
          await recordAudit(session, {
            category: "job",
            action: "naming_audit.started",
            target: `${domain} naming audit`,
            domain: domain,
            summary: `Started a ${domain === "movie" ? "movie" : "television"} naming audit.`,
            metadata: { jobId: job.id },
          });
          return json(res, 202, { job: publicNamingAuditJob(job) });
        }
        const namingAuditMatch = url.pathname.match(
          /^\/api\/media-files\/naming-audit\/([0-9a-f-]+)$/i,
        );
        if (namingAuditMatch && req.method === "GET") {
          if (!administrator(res, session)) return;
          const job = namingAuditJobs.get(namingAuditMatch[1]);
          if (!job)
            return json(res, 404, {
              error: { message: "Naming audit not found" },
            });
          return json(res, 200, { job: publicNamingAuditJob(job) });
        }
        if (
          url.pathname === "/api/media-files/rename" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          return json(res, 200, {
            preview: await renameMediaPreview(
              Object.fromEntries(url.searchParams),
            ),
          });
        }
        if (
          url.pathname === "/api/media-files/rename" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            result = await renameMedia(input),
            domain = String(input.domain || "");
          await recordAudit(session, {
            category: "media",
            action: "media.rename_queued",
            target: String(input.title || input.mediaId || "Library item"),
            domain: ["movie", "tv"].includes(domain) ? domain : null,
            summary: "Queued media files for renaming.",
            metadata: { mediaId: input.mediaId || null },
          });
          return json(res, 202, { queued: true, result: result });
        }
        if (
          url.pathname === "/api/media-files/rename/file" &&
          req.method === "DELETE"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            result = await deleteRenamePreviewFile(input),
            domain = String(input.domain || "");
          await recordAudit(session, {
            category: "media",
            action: "media.preview_file_deleted",
            target: String(input.path || input.fileId || "Preview file"),
            domain: ["movie", "tv"].includes(domain) ? domain : null,
            summary: "Deleted a file from the rename preview.",
            metadata: { fileId: input.fileId || null },
          });
          return json(res, 200, { result: result });
        }
        if (
          url.pathname === "/api/guide-templates/catalog" &&
          req.method === "GET"
        ) {
          if (!administrator(res, session)) return;
          return json(
            res,
            200,
            await guideTemplates.catalog({
              refresh: url.searchParams.get("refresh") === "true",
            }),
          );
        }
        const guideTemplateMatch = url.pathname.match(
          /^\/api\/guide-templates\/templates\/([a-z0-9][a-z0-9-]*)(?:\/decision)?$/i,
        );
        if (
          guideTemplateMatch &&
          req.method === "GET" &&
          !url.pathname.endsWith("/decision")
        ) {
          if (!administrator(res, session)) return;
          const template = await guideTemplates.template(guideTemplateMatch[1]),
            domain = template.domain || "movie",
            engineInstanceId = String(url.searchParams.get("engineInstanceId") || "").trim() || null,
            executeGuide = (resource, method, options = {}) => management.execute(domain, resource, method, {...options, engineInstanceId});
          if (template.resourceType !== "customFormat") {
            const resources =
              {
                qualityProfile: ["profiles", "profileSchema", "customFormats"],
                qualitySize: ["qualityDefinitions"],
                naming: ["naming"],
                customFormatGroup: ["customFormats", "profiles"],
              }[template.resourceType] || [];
            const values = await Promise.all(
              resources.map((resource) =>
                executeGuide(resource, "GET"),
              ),
            );
            const engine = Object.fromEntries(
              resources.map((resource, index) => [resource, values[index]]),
            );
            const existing =
              template.resourceType === "qualityProfile"
                ? (Array.isArray(engine.profiles) ? engine.profiles : []).find(
                    (item) =>
                      String(item.name).toLowerCase() ===
                      String(template.template.name).toLowerCase(),
                  )
                : null;
            return json(res, 200, {
              ...template,
              engine: engine,
              comparison: {
                status: existing ? "conflict" : "new",
                existing: existing || null,
                record: null,
                sourceOfTruth: `${domain}-engine`,
                observedAt: new Date().toISOString(),
              },
            });
          }
          const [configuredValue, profilesValue] = await Promise.all([
            executeGuide("customFormats", "GET"),
            executeGuide("profiles", "GET"),
          ]);
          const configured = Array.isArray(configuredValue)
              ? configuredValue
              : [],
            profiles = Array.isArray(profilesValue) ? profilesValue : [];
          const comparison = await guideTemplates.comparison(
              template,
              configured,
            ),
            formatId = comparison.existing?.id;
          const qualityProfiles = profiles.map((profile) => ({
            id: profile.id,
            name: profile.name,
            currentScore: formatId
              ? (profile.formatItems || []).find(
                  (item) => Number(item.format) === Number(formatId),
                )?.score
              : null,
          }));
          return json(res, 200, {
            ...template,
            resourceType: "customFormat",
            qualityProfiles: qualityProfiles,
            comparison: comparison,
          });
        }
        if (
          guideTemplateMatch &&
          req.method === "POST" &&
          url.pathname.endsWith("/decision")
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            template = await guideTemplates.template(guideTemplateMatch[1]),
            domain = template.domain || "movie",
            engineInstanceId = String(input.engineInstanceId || "").trim() || null,
            executeGuide = (resource, method, options = {}) => management.execute(domain, resource, method, {...options, engineInstanceId}),
            engineLabel = domain === "movie" ? "movie" : "TV";
          if (template.resourceType !== "customFormat") {
            if (!["implement", "reject"].includes(input.decision))
              throw new Error(
                "Choose whether to implement or reject this template.",
              );
            if (input.decision === "reject") {
              await guideTemplates.recordDecision(template, {
                decision: "rejected",
                username: session.user.username,
              });
              await recordAudit(session, {
                category: "configuration",
                action: "guide_template.rejected",
                target: template.template?.name || template.title,
                domain: domain,
                summary: `Rejected the ${template.template?.name || template.title} Guide Template without changing engine settings.`,
                metadata: { trashId: template.trashId },
              });
              return json(res, 200, {
                message: `${template.template?.name || template.title} rejected. No ${engineLabel}-engine settings were changed.`,
                comparison: {
                  status: "new",
                  existing: null,
                  record: null,
                  sourceOfTruth: `${domain}-engine`,
                  observedAt: new Date().toISOString(),
                },
              });
            }
            const previewChanges = [];
            if (template.resourceType === "naming") {
              const current = await executeGuide("naming", "GET"),
                reviewed = input.reviewed || {};
              const target =
                domain === "movie"
                  ? {
                      renameMovies: reviewed.renameMovies ?? true,
                      standardMovieFormat: String(
                        reviewed.standardMovieFormat ||
                          current.standardMovieFormat,
                      ),
                      movieFolderFormat: String(
                        reviewed.movieFolderFormat || current.movieFolderFormat,
                      ),
                    }
                  : {
                      renameEpisodes: reviewed.renameEpisodes ?? true,
                      standardEpisodeFormat: String(
                        reviewed.standardEpisodeFormat ||
                          current.standardEpisodeFormat,
                      ),
                      dailyEpisodeFormat: String(
                        reviewed.dailyEpisodeFormat ||
                          current.dailyEpisodeFormat,
                      ),
                      animeEpisodeFormat: String(
                        reviewed.animeEpisodeFormat ||
                          current.animeEpisodeFormat,
                      ),
                      seriesFolderFormat: String(
                        reviewed.seriesFolderFormat ||
                          current.seriesFolderFormat,
                      ),
                      seasonFolderFormat: String(
                        reviewed.seasonFolderFormat ||
                          current.seasonFolderFormat,
                      ),
                    };
              previewChanges.push(
                templateChange(
                  "Naming",
                  domain === "movie" ? "Movie naming" : "TV naming",
                  current,
                  target,
                  Object.keys(target),
                ),
              );
            } else if (template.resourceType === "qualitySize") {
              const definitionsValue = await executeGuide("qualityDefinitions",
                  "GET",
                ),
                definitions = Array.isArray(definitionsValue)
                  ? definitionsValue
                  : [],
                reviewed = Array.isArray(input.qualities)
                  ? input.qualities
                  : template.template.qualities;
              for (const recommendation of reviewed) {
                const definition = definitions.find(
                  (item) =>
                    String(item.title || item.quality?.name).toLowerCase() ===
                    String(recommendation.quality).toLowerCase(),
                );
                previewChanges.push(
                  templateChange(
                    "Quality size",
                    recommendation.quality,
                    definition,
                    definition
                      ? {
                          minSize: Number(recommendation.min),
                          preferredSize: Number(recommendation.preferred),
                          maxSize: Number(recommendation.max),
                        }
                      : recommendation,
                    ["minSize", "preferredSize", "maxSize"],
                  ),
                );
              }
            } else {
              const requested =
                template.resourceType === "qualityProfile"
                  ? Object.values(template.template.formatItems || {})
                  : (Array.isArray(input.customFormatIds)
                      ? input.customFormatIds
                      : template.template.custom_formats
                          ?.filter((item) => item.required || item.default)
                          .map((item) => item.trash_id)) || [];
              const [sources, configuredValue] = await Promise.all([
                  guideTemplates.customFormatsByTrashIds(requested, domain),
                  executeGuide("customFormats", "GET"),
                ]),
                configured = Array.isArray(configuredValue)
                  ? configuredValue
                  : [];
              for (const trashId of requested) {
                const source = sources.get(String(trashId).toLowerCase());
                if (!source) continue;
                const existing = configured.find(
                  (item) =>
                    String(item.name).toLowerCase() ===
                    source.format.name.toLowerCase(),
                );
                previewChanges.push(
                  templateChange(
                    "Custom format",
                    source.format.name,
                    existing,
                    source.format,
                    [
                      "name",
                      "includeCustomFormatWhenRenaming",
                      "specifications",
                    ],
                  ),
                );
              }
              if (template.resourceType === "qualityProfile") {
                const profilesValue = await executeGuide("profiles",
                    "GET",
                  ),
                  profiles = Array.isArray(profilesValue) ? profilesValue : [],
                  reviewed = input.reviewed || template.template,
                  existing = profiles.find(
                    (item) =>
                      String(item.name).toLowerCase() ===
                      String(reviewed.name).toLowerCase(),
                  );
                previewChanges.push(
                  templateChange(
                    "Quality profile",
                    reviewed.name,
                    existing,
                    reviewed,
                    [
                      "name",
                      "upgradeAllowed",
                      "minFormatScore",
                      "cutoffFormatScore",
                      "minUpgradeFormatScore",
                    ],
                  ),
                );
              }
            }
            const plan = templatePlan(previewChanges);
            if (input.preview === true)
              return json(res, 200, { preview: true, plan: plan });
            if (plan.requiresConfirmation && input.confirmOverwrite !== true)
              return json(res, 409, {
                error: {
                  code: "overwrite_confirmation_required",
                  message: `The ${engineLabel} engine changed or contains settings this template would overwrite. Review and confirm the changes.`,
                },
                plan: plan,
              });
            let message,
              resourceId = null;
            if (template.resourceType === "naming") {
              const current = await executeGuide("naming", "GET"),
                reviewed = input.reviewed || {};
              const payload =
                domain === "movie"
                  ? {
                      ...current,
                      renameMovies: reviewed.renameMovies ?? true,
                      standardMovieFormat: String(
                        reviewed.standardMovieFormat ||
                          current.standardMovieFormat,
                      ),
                      movieFolderFormat: String(
                        reviewed.movieFolderFormat || current.movieFolderFormat,
                      ),
                    }
                  : {
                      ...current,
                      renameEpisodes: reviewed.renameEpisodes ?? true,
                      standardEpisodeFormat: String(
                        reviewed.standardEpisodeFormat ||
                          current.standardEpisodeFormat,
                      ),
                      dailyEpisodeFormat: String(
                        reviewed.dailyEpisodeFormat ||
                          current.dailyEpisodeFormat,
                      ),
                      animeEpisodeFormat: String(
                        reviewed.animeEpisodeFormat ||
                          current.animeEpisodeFormat,
                      ),
                      seriesFolderFormat: String(
                        reviewed.seriesFolderFormat ||
                          current.seriesFolderFormat,
                      ),
                      seasonFolderFormat: String(
                        reviewed.seasonFolderFormat ||
                          current.seasonFolderFormat,
                      ),
                    };
              await executeGuide("naming", "PUT", {
                payload: payload,
              });
              resourceId = current.id;
              message = `TRaSH naming presets applied to ${engineLabel}-engine naming.`;
            } else if (template.resourceType === "qualitySize") {
              const definitionsValue = await executeGuide("qualityDefinitions",
                  "GET",
                ),
                definitions = Array.isArray(definitionsValue)
                  ? definitionsValue
                  : [],
                reviewed = Array.isArray(input.qualities)
                  ? input.qualities
                  : template.template.qualities;
              let changed = 0;
              for (const recommendation of reviewed) {
                const definition = definitions.find(
                  (item) =>
                    String(item.title || item.quality?.name).toLowerCase() ===
                    String(recommendation.quality).toLowerCase(),
                );
                if (!definition) continue;
                await executeGuide("qualityDefinitions", "PUT", {
                  id: String(definition.id),
                  payload: {
                    ...definition,
                    minSize: Number(recommendation.min),
                    preferredSize: Number(recommendation.preferred),
                    maxSize: Number(recommendation.max),
                  },
                });
                changed++;
              }
              message = `${template.template.type || template.title} quality-size preset applied to ${changed} ${domain === "movie" ? "movie" : "TV"} qualities.`;
            } else {
              const requested =
                template.resourceType === "qualityProfile"
                  ? Object.values(template.template.formatItems || {})
                  : (Array.isArray(input.customFormatIds)
                      ? input.customFormatIds
                      : template.template.custom_formats
                          ?.filter((item) => item.required || item.default)
                          .map((item) => item.trash_id)) || [];
              const sources = await guideTemplates.customFormatsByTrashIds(
                  requested,
                  domain,
                ),
                schemasValue = await executeGuide("customFormatSchemas",
                  "GET",
                ),
                schemas = Array.isArray(schemasValue) ? schemasValue : [],
                configuredValue = await executeGuide("customFormats",
                  "GET",
                ),
                configured = Array.isArray(configuredValue)
                  ? configuredValue
                  : [],
                installed = new Map();
              for (const trashId of requested) {
                const source = sources.get(String(trashId).toLowerCase());
                if (!source) continue;
                const existing = configured.find(
                    (item) =>
                      String(item.name).toLowerCase() ===
                      source.format.name.toLowerCase(),
                  ),
                  payload = formatForMovieEngine(source.format, schemas);
                const saved = existing
                  ? await executeGuide("customFormats", "PUT", {
                      id: String(existing.id),
                      payload: { ...payload, id: existing.id },
                    })
                  : await executeGuide("customFormats", "POST", {
                      payload: payload,
                    });
                installed.set(String(trashId).toLowerCase(), {
                  id: saved?.id || existing?.id,
                  name: payload.name,
                  scores: source.scores,
                });
              }
              if (template.resourceType === "customFormatGroup") {
                const profilesValue = await executeGuide("profiles",
                    "GET",
                  ),
                  profiles = Array.isArray(profilesValue) ? profilesValue : [],
                  profileIds = Array.isArray(input.profileIds)
                    ? input.profileIds.map(Number)
                    : [],
                  scoreSet = String(input.scoreSet || "default");
                for (const profile of profiles.filter((item) =>
                  profileIds.includes(Number(item.id)),
                )) {
                  const formatItems = [...(profile.formatItems || [])];
                  for (const installedFormat of installed.values()) {
                    const score = Number(
                        installedFormat.scores?.[scoreSet] ??
                          installedFormat.scores?.default ??
                          0,
                      ),
                      index = formatItems.findIndex(
                        (item) =>
                          Number(item.format) === Number(installedFormat.id),
                      ),
                      value = {
                        format: Number(installedFormat.id),
                        name: installedFormat.name,
                        score: score,
                      };
                    if (index >= 0)
                      formatItems[index] = { ...formatItems[index], ...value };
                    else formatItems.push(value);
                  }
                  await executeGuide("profiles", "PUT", {
                    id: String(profile.id),
                    payload: { ...profile, formatItems: formatItems },
                  });
                }
                message = `${template.template.name} applied with ${installed.size} custom formats.`;
              } else {
                const schema = await executeGuide("profileSchema",
                    "GET",
                  ),
                  profilesValue = await executeGuide("profiles",
                    "GET",
                  ),
                  profiles = Array.isArray(profilesValue) ? profilesValue : [],
                  source = input.reviewed || template.template;
                const leaves = (schema.items || []).flatMap((item) =>
                  item.items?.length ? item.items : [item],
                );
                const items = (source.items || [])
                  .map((item, index) => {
                    if (Array.isArray(item.items)) {
                      const children = item.items
                        .map((name) =>
                          structuredClone(
                            leaves.find(
                              (leaf) =>
                                String(leaf.quality?.name).toLowerCase() ===
                                String(name).toLowerCase(),
                            ),
                          ),
                        )
                        .filter(Boolean)
                        .map((child) => ({
                          ...child,
                          allowed: Boolean(item.allowed),
                        }));
                      return {
                        name: item.name,
                        items: children,
                        allowed: Boolean(item.allowed),
                        id: 1e3 + index,
                      };
                    }
                    const leaf = structuredClone(
                      leaves.find(
                        (value) =>
                          String(value.quality?.name).toLowerCase() ===
                          String(item.name).toLowerCase(),
                      ),
                    );
                    return leaf
                      ? { ...leaf, allowed: Boolean(item.allowed) }
                      : null;
                  })
                  .filter(Boolean);
                const cutoffItem = items.find(
                    (item) =>
                      String(item.name || item.quality?.name).toLowerCase() ===
                      String(source.cutoff).toLowerCase(),
                  ),
                  scoreSet = String(source.trash_score_set || "default");
                const payload = {
                  ...schema,
                  name: source.name,
                  upgradeAllowed: Boolean(source.upgradeAllowed),
                  cutoff:
                    cutoffItem?.id || cutoffItem?.quality?.id || schema.cutoff,
                  items: items,
                  minFormatScore: Number(source.minFormatScore || 0),
                  cutoffFormatScore: Number(source.cutoffFormatScore || 0),
                  minUpgradeFormatScore: Number(
                    source.minUpgradeFormatScore || 1,
                  ),
                  formatItems: [...installed.values()].map((value) => ({
                    format: Number(value.id),
                    name: value.name,
                    score: Number(
                      value.scores?.[scoreSet] ?? value.scores?.default ?? 0,
                    ),
                  })),
                };
                const existing = profiles.find(
                    (item) =>
                      String(item.name).toLowerCase() ===
                      String(payload.name).toLowerCase(),
                  ),
                  saved = existing
                    ? await executeGuide("profiles", "PUT", {
                        id: String(existing.id),
                        payload: { ...payload, id: existing.id },
                      })
                    : await executeGuide("profiles", "POST", {
                        payload: payload,
                      });
                resourceId = saved?.id || existing?.id;
                message = `${payload.name} quality profile and ${installed.size} referenced custom formats applied.`;
              }
            }
            await guideTemplates.recordDecision(template, {
              decision: "implemented",
              radarrId: resourceId,
              username: session.user.username,
            });
            clearReleaseCache(domain);
            return json(res, 200, {
              message: message,
              appliedChanges: plan.changes,
              comparison: {
                status: "matches",
                existing: { id: resourceId },
                record: null,
                sourceOfTruth: `${domain}-engine`,
                observedAt: new Date().toISOString(),
              },
            });
          }
          const configuredValue = await executeGuide("customFormats",
              "GET",
            ),
            configured = Array.isArray(configuredValue) ? configuredValue : [],
            before = await guideTemplates.comparison(template, configured);
          let radarrId = before.existing?.id || null,
            message;
          if (input.decision === "reject") {
            await guideTemplates.recordDecision(template, {
              decision: "rejected",
              radarrId: radarrId,
              username: session.user.username,
            });
            await recordAudit(session, {
              category: "configuration",
              action: "guide_template.rejected",
              target: template.format.name,
              domain: domain,
              summary: `Rejected the ${template.format.name} Guide Template without changing engine settings.`,
              metadata: { resourceId: radarrId, trashId: template.trashId },
            });
            message = `${template.format.name} rejected. No ${engineLabel}-engine settings were changed.`;
          } else if (input.decision === "implement") {
            const schemasValue = await executeGuide("customFormatSchemas",
                "GET",
              ),
              schemas = Array.isArray(schemasValue) ? schemasValue : [];
            const reviewed =
              input.format && typeof input.format === "object"
                ? input.format
                : template.format;
            const payload = formatForMovieEngine(reviewed, schemas);
            const changes = [
              templateChange(
                "Custom format",
                payload.name,
                before.existing,
                payload,
                ["name", "includeCustomFormatWhenRenaming", "specifications"],
              ),
            ];
            const profileIds = Array.isArray(input.profileIds)
              ? [
                  ...new Set(
                    input.profileIds.map(Number).filter(Number.isFinite),
                  ),
                ]
              : [];
            if (profileIds.length) {
              const profilesValue = await executeGuide("profiles",
                  "GET",
                ),
                profiles = Array.isArray(profilesValue) ? profilesValue : [],
                score = Number(
                  template.scores?.[String(input.scoreSet || "default")],
                );
              for (const profile of profiles.filter((item) =>
                profileIds.includes(Number(item.id)),
              )) {
                const existing = (profile.formatItems || []).find(
                  (item) => Number(item.format) === Number(before.existing?.id),
                );
                changes.push(
                  templateChange(
                    "Profile score",
                    profile.name,
                    existing,
                    { score: score },
                    ["score"],
                  ),
                );
              }
            }
            const plan = templatePlan(changes);
            if (input.preview === true)
              return json(res, 200, { preview: true, plan: plan });
            if (plan.requiresConfirmation && input.confirmOverwrite !== true)
              return json(res, 409, {
                error: {
                  code: "overwrite_confirmation_required",
                  message: `The ${engineLabel} engine contains settings this template would overwrite. Review and confirm the changes.`,
                },
                plan: plan,
              });
            const result = before.existing
              ? await executeGuide("customFormats", "PUT", {
                  id: String(before.existing.id),
                  payload: { ...payload, id: before.existing.id },
                })
              : await executeGuide("customFormats", "POST", {
                  payload: payload,
                });
            radarrId = result?.id || radarrId;
            if (profileIds.length) {
              const score = Number(
                template.scores?.[String(input.scoreSet || "default")],
              );
              if (!Number.isFinite(score))
                throw new Error("Choose a valid TRaSH score recommendation.");
              const profilesValue = await executeGuide("profiles",
                  "GET",
                ),
                profiles = Array.isArray(profilesValue) ? profilesValue : [];
              for (const profileId of profileIds) {
                const profile = profiles.find(
                  (item) => Number(item.id) === profileId,
                );
                if (!profile)
                  throw new Error(
                    "A selected quality profile is no longer available.",
                  );
                const formatItems = [...(profile.formatItems || [])],
                  index = formatItems.findIndex(
                    (item) => Number(item.format) === Number(radarrId),
                  );
                const scoreItem = {
                  ...(index >= 0 ? formatItems[index] : {}),
                  format: Number(radarrId),
                  name: result?.name || payload.name,
                  score: score,
                };
                if (index >= 0) formatItems[index] = scoreItem;
                else formatItems.push(scoreItem);
                await executeGuide("profiles", "PUT", {
                  id: String(profile.id),
                  payload: { ...profile, formatItems: formatItems },
                });
              }
            }
            await guideTemplates.recordDecision(template, {
              decision: "implemented",
              radarrId: radarrId,
              username: session.user.username,
            });
            clearReleaseCache(domain);
            await recordAudit(session, {
              category: "configuration",
              action: "guide_template.implemented",
              target: payload.name,
              domain: domain,
              summary: `Implemented ${payload.name} in the ${engineLabel} engine.`,
              metadata: { resourceId: radarrId, trashId: template.trashId },
            });
            message = `${payload.name} implemented in the ${engineLabel} engine${profileIds.length ? ` and scored in ${profileIds.length} quality profile${profileIds.length === 1 ? "" : "s"}` : ""}.`;
            input.appliedChanges = plan.changes;
          } else
            throw new Error(
              "Choose whether to implement or reject this template.",
            );
          const latestValue = await executeGuide("customFormats",
              "GET",
            ),
            comparison = await guideTemplates.comparison(
              template,
              Array.isArray(latestValue) ? latestValue : [],
            );
          return json(res, 200, {
            message: message,
            appliedChanges: input.appliedChanges || [],
            comparison: comparison,
          });
        }
        const catalogMatch = url.pathname.match(/^\/api\/manage\/(movie|tv)$/);
        if (catalogMatch && req.method === "GET") {
          if (!administrator(res, session)) return;
          return json(res, 200, {
            domain: catalogMatch[1],
            available: management.available(catalogMatch[1]),
            resources: management.catalog(catalogMatch[1]),
          });
        }
        const automaticSearchMatch = url.pathname.match(
          /^\/api\/manage\/(movie|tv)\/automaticSearch$/,
        );
        if (automaticSearchMatch && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const domain = automaticSearchMatch[1],
            input = await body(req),
            query =
              domain === "movie"
                ? { movieId: Number(input.movieId) }
                : { episodeId: Number(input.episodeId) };
          if (!Number.isFinite(query.movieId ?? query.episodeId))
            throw new Error(
              `Choose a ${domain === "movie" ? "movie" : "television episode"} to search`,
            );
          const releases = await management.execute(domain, "releases", "GET", {
              query: query,
            }),
            candidates = Array.isArray(releases) ? releases : [],
            accepted = candidates.filter(eligibleRelease);
          await recordDownloadDecisions(
            session.user.id,
            domain,
            query,
            candidates,
            { source: "automatic" },
          );
          if (!candidates.length)
            throw new Error(
              "No releases were returned by the configured indexers.",
            );
          if (!accepted.length)
            throw new Error(
              "Only rejected releases were returned. Use Interactive Search to review and grab one anyway if you choose.",
            );
          accepted.sort(compareReleases);
          const selected = accepted[0],
            result = await grabReleaseWithImportGuard(
              domain,
              selected,
              query.movieId ?? query.episodeId,
            );
          await recordDownloadDecisions(
            session.user.id,
            domain,
            query,
            candidates,
            { source: "automatic", selected: releaseIdentity(selected) },
          );
          await createSearchActivity(
            session.user.id,
            domain === "movie"
              ? { name: "MoviesSearch", movieIds: [query.movieId] }
              : { name: "EpisodeSearch", episodeIds: [query.episodeId] },
            result,
            {
              domain: domain,
              source: "details",
              movieId: query.movieId,
              status: "grabbed",
              title: selected.title,
              message:
                "An accepted release was grabbed and sent to the download client.",
              selection: {
                title: selected.title,
                quality:
                  selected.quality?.quality?.name ||
                  selected.quality?.name ||
                  "Unknown",
                size: Number(selected.size || 0),
              },
            },
          );
          clearReleaseCache(domain);
          await recordAudit(session, {
            category: "media",
            action: "automatic_search.grabbed",
            target: selected.title,
            domain: domain,
            summary: `Automatically selected and grabbed an accepted ${domain === "movie" ? "movie" : "television"} release.`,
            metadata: {
              mediaId: query.movieId ?? query.episodeId,
              acceptedCandidates: accepted.length,
            },
          });
          return json(res, 201, {
            result: result,
            selection: {
              title: selected.title,
              quality:
                selected.quality?.quality?.name ||
                selected.quality?.name ||
                "Unknown",
              size: Number(selected.size || 0),
              acceptedCandidates: accepted.length,
            },
          });
        }
        if (
          url.pathname === "/api/manage/queue/bulk-delete" &&
          req.method === "POST"
        ) {
          if (!administrator(res, session) || !requireCsrf(req, res, session))
            return;
          const input = await body(req),
            items = Array.isArray(input.items) ? input.items.slice(0, 250) : [];
          if (!items.length)
            throw new Error("Choose at least one queue item to remove");
          const results = await Promise.allSettled(
            items.map((item) => {
              const domain = item?.domain;
              if (!["movie", "tv"].includes(domain) || !item?.id)
                return Promise.reject(
                  new Error("A queue item is missing its engine or identifier"),
                );
              const owned=decodeOwnedMediaId(domain,item.id);
              return management.execute(domain, "queue", "DELETE", {
                id: String(owned.id),engineInstanceId:owned.engineInstanceId,
                query: {
                  removeFromClient: String(input.removeFromClient !== false),
                  blocklist: String(item.blocklist === true || input.blocklist === true),
                },
                payload: {},
              });
            }),
          );
          const removed = [],
            failed = [];
          results.forEach((result, index) => {
            const item = items[index];
            if (result.status === "fulfilled")
              removed.push({ domain: item.domain, id: item.id });
            else
              failed.push({
                domain: item.domain,
                id: item.id,
                message:
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason),
              });
          });
          await recordAudit(session, {
            category: "media",
            action: "queue.bulk_deleted",
            target: `${removed.length} queue item${removed.length === 1 ? "" : "s"}`,
            summary: `Removed ${removed.length} queue item${removed.length === 1 ? "" : "s"}${failed.length ? `; ${failed.length} failed` : ""}.`,
            metadata: {
              removed: removed,
              failedCount: failed.length,
              removeFromClient: input.removeFromClient !== false,
              blocklist: input.blocklist === true,
            },
          });
          clearReleaseCache("movie");
          clearReleaseCache("tv");
          return json(res, failed.length ? 207 : 200, {
            removed: removed,
            failed: failed,
            items:
              mode === "engine"
                ? await liveQueue()
                : await sync.operations("queue"),
          });
        }
        const managementMatch = url.pathname.match(
          /^\/api\/manage\/(movie|tv)\/([A-Za-z][A-Za-z0-9]*)(?:\/([A-Za-z0-9_-]+))?$/,
        );
        if (managementMatch) {
          if (!administrator(res, session)) return;
          const method = req.method || "GET";
          if (method !== "GET" && !requireCsrf(req, res, session)) return;
          const input = method === "GET" ? {} : await body(req);
          const query = Object.fromEntries(url.searchParams);
          const domain=managementMatch[1],owned=decodeOwnedMediaId(domain,managementMatch[3]),queryInstance=String(query.engineInstanceId||'').trim()||null;
          const requestedInstance=resolveOwnedEngineInstance(queryInstance,owned.engineInstanceId);
          if(requestedInstance)delete query.engineInstanceId;
          let result;
          if (managementMatch[2] === "releases" && method === "GET") {
            const domain = managementMatch[1],
              load = () =>
                domain === "tv" && query.seriesId
                  ? televisionSeriesReleases(query.seriesId, query.seasonNumber)
                  : management.execute(domain, "releases", "GET", {
                      query: Object.fromEntries(
                        Object.entries(query).filter(
                          ([key]) => key !== "force",
                        ),
                      ),
                      engineInstanceId:requestedInstance,
                    });
            result = await cachedInteractiveReleases(domain, query, load);
            if (domain === "tv" && !query.seriesId)
              result = await explainEmptyTelevisionSearch(query, result);
            if (Array.isArray(result))
              result = result.map((release) =>
                domain === "movie" && query.movieId
                  ? {
                      ...release,
                      mappedMovieId: Number(
                        release.mappedMovieId ||
                          release.movieId ||
                          query.movieId,
                      ),
                    }
                  : domain === "tv" && query.episodeId
                    ? {
                        ...release,
                        episodeId: Number(release.episodeId || query.episodeId),
                      }
                    : release,
              );
            await recordDownloadDecisions(
              session.user.id,
              domain,
              query,
              result,
              { source: "interactive" },
            );
          } else {
            let payload =
              managementMatch[2] === "releases" && method === "POST"
                ? await reacquireRelease(managementMatch[1], input,requestedInstance)
                : managementMatch[1] === "tv" &&
                    managementMatch[2] === "library" &&
                    method === "POST"
                  ? televisionAddPayload(input)
                  : input;
            if (managementMatch[2] === "library" && method === "POST") {
              payload = await applyMediaDestination(managementMatch[1], { ...payload, engineInstanceId: requestedInstance }, true);
              if (managementMatch[1] === "tv") payload = televisionAddPayload(payload);
            }
            const forwardedPayload = payload && typeof payload === "object" && !Array.isArray(payload)
              ? { ...payload }
              : payload;
            if (forwardedPayload) {
              delete forwardedPayload.engineInstanceId;
              delete forwardedPayload.engineInstanceName;
            }
            result = await management.execute(
              managementMatch[1],
              managementMatch[2],
              method,
              { id: owned.id||managementMatch[3], query: query, payload: forwardedPayload, engineInstanceId:requestedInstance },
            );
            if (method === "POST" && managementMatch[2] === "releases") {
              const domain = managementMatch[1],
                movieId =
                  Number(payload.mappedMovieId || payload.movieId) || null,
                mappedEpisodes = Array.isArray(payload.mappedEpisodeInfo)
                  ? payload.mappedEpisodeInfo
                  : [],
                episodeIds = [
                  payload.episodeId,
                  payload.mappedEpisodeId,
                  ...mappedEpisodes.map((item) => item.id),
                ]
                  .map(Number)
                  .filter(Number.isFinite),
                seriesId =
                  Number(
                    payload.seriesId ||
                      payload.series?.id ||
                      mappedEpisodes[0]?.seriesId,
                  ) || null,
                libraryMedia = movieId
                  ? await management
                      .execute("movie", "library", "GET", {
                        id: String(movieId),
                      })
                      .catch(() => null)
                  : seriesId
                    ? await management
                        .execute("tv", "library", "GET", {
                          id: String(seriesId),
                        })
                        .catch(() => null)
                    : null,
                mediaTitle =
                  libraryMedia?.title ||
                  payload.movie?.title ||
                  payload.series?.title ||
                  input.movie?.title ||
                  input.series?.title ||
                  payload.title ||
                  "Interactive release",
                quality =
                  payload.quality?.quality?.name ||
                  payload.quality?.name ||
                  "Unknown";
              const activity = await createSearchActivity(
                session.user.id,
                domain === "movie"
                  ? { name: "MoviesSearch", movieIds: movieId ? [movieId] : [] }
                  : { name: "EpisodeSearch", episodeIds: episodeIds },
                {},
                {
                  domain: domain,
                  source: "interactive",
                  scope:
                    domain === "movie"
                      ? "movie"
                      : episodeIds.length > 1
                        ? "episode"
                        : "episode",
                  movieId: movieId,
                  seriesId: seriesId,
                  episodeIds: episodeIds,
                  status: "grabbed",
                  title: mediaTitle,
                  message:
                    "A manually selected release was grabbed and sent to the download client.",
                  selection: {
                    title: payload.title || mediaTitle,
                    quality: quality,
                    size: Number(payload.size || 0),
                  },
                },
              );
              await recordDownloadDecisions(
                session.user.id,
                domain,
                {
                  movieId: movieId,
                  episodeId: episodeIds[0],
                  seriesId: seriesId,
                },
                [payload],
                { source: "interactive", selected: releaseIdentity(payload) },
              );
              await persistNotificationEvents(session.user.id, [
                {
                  id: `interactive-grab:${activity.id}`,
                  eventGroup: "interactive-grab",
                  category: "download",
                  severity: "success",
                  type: "grabbed",
                  title: `${mediaTitle} was grabbed`,
                  message: `The selected ${quality} release was sent to the download client.`,
                  timestamp: activity.createdAt,
                  href: "#queue",
                  requestId: "",
                  actionable: false,
                },
              ]);
              await recordAudit(session, {
                category: "media",
                action: "interactive_search.grabbed",
                target: mediaTitle,
                domain: domain,
                summary: `Manually selected and grabbed a ${domain === "movie" ? "movie" : "television"} release.`,
                metadata: {
                  activityId: activity.id,
                  mediaId: movieId || seriesId || episodeIds[0] || null,
                  quality: quality,
                },
              });
            }
            if (
              method === "POST" &&
              managementMatch[2] === "commands" &&
              automaticCommandNames.has(String(input.name || ""))
            )
              await createSearchActivity(session.user.id, input, result, {
                domain: managementMatch[1],
                source: "command",
              });
            if (
              method === "POST" &&
              managementMatch[2] === "library" &&
              payload?.addOptions?.searchForMissingEpisodes === true
            )
              await createSearchActivity(
                session.user.id,
                { name: "SeriesSearch", seriesId: result?.id },
                result,
                {
                  domain: managementMatch[1],
                  source: "add",
                  scope: managementMatch[1] === "tv" ? "series" : "movie",
                  title: result?.title || payload.title || "New library item",
                  status: "searching",
                  message:
                    "Added to the library and searching for monitored missing media.",
                },
              );
            if (
              method === "POST" &&
              managementMatch[2] === "library" &&
              managementMatch[1] === "movie" &&
              payload?.addOptions?.searchForMovie === true
            )
              await createSearchActivity(
                session.user.id,
                { name: "MoviesSearch", movieIds: [result?.id] },
                result,
                {
                  domain: "movie",
                  source: "add",
                  scope: "movie",
                  movieId: result?.id,
                  title: result?.title || payload.title || "New movie",
                  status: "searching",
                  message:
                    "Added to the library and searching for an accepted movie release.",
                },
              );
          }
          if (method !== "GET") {
            if (
              [
                "releases",
                "indexers",
                "profiles",
                "customFormats",
                "delayProfiles",
                "restrictions",
                "releaseProfiles",
                "queue",
              ].includes(managementMatch[2])
            )
              clearReleaseCache(managementMatch[1]);
            const commandName =
                managementMatch[2] === "commands"
                  ? String(input.name || "command")
                  : "",
              backupCommand = commandName.toLowerCase() === "backup";
            await recordAudit(session, {
              category: backupCommand ? "backup" : "engine",
              action: backupCommand
                ? "backup.created"
                : `engine.${managementMatch[2]}.${method.toLowerCase()}`,
              target: backupCommand
                ? `${managementMatch[1]} configuration backup`
                : `${managementMatch[1]} ${managementMatch[2]}`,
              domain: managementMatch[1],
              summary: backupCommand
                ? `Queued a ${managementMatch[1] === "movie" ? "Movies" : "Television"} configuration backup.`
                : `${method} ${managementMatch[2]} in the ${managementMatch[1] === "movie" ? "movie" : "television"} engine.`,
              metadata: {
                resourceId: managementMatch[3] || null,
                ...(commandName ? { command: commandName } : {}),
              },
            });
            if (managementMatch[2] === "library") {
              const domain = managementMatch[1],
                prefix = domain === "movie" ? "movie" : "series",
                engineId = Number(
                  result?.id || managementMatch[3] || input?.id,
                ),
                publicId = Number.isFinite(engineId)
                  ? `${prefix}_${engineId}`
                  : null;
              if (method === "DELETE" && publicId) {
                invalidateMediaDetail(domain, publicId);
                await sync.removeItem(domain, publicId);
                broadcastLibraryEvent({
                  domain: domain,
                  removedIds: [publicId],
                  updatedAt: new Date().toISOString(),
                });
              } else if (publicId) {
                invalidateMediaDetail(domain, publicId);
                const reconcile = () =>
                  sync
                    .reconcileItem(domain, publicId)
                    .then((value) =>
                      broadcastLibraryEvent({
                        domain: domain,
                        items: value.item ? [value.item] : [],
                        updatedAt: new Date().toISOString(),
                      }),
                    )
                    .catch(() => {});
                await reconcile();
                if (mode === "engine")
                  for (const delay of [5e3, 2e4]) setTimeout(reconcile, delay);
              } else {
                invalidateMediaDetail(domain);
                sync.invalidate(domain);
                await sync.synchronize(domain);
              }
            } else if (managementMatch[2] === "libraryEditor") {
              sync.invalidate(managementMatch[1]);
              await sync.synchronize(managementMatch[1]);
            } else if (
              ["episodes", "episodeFiles"].includes(managementMatch[2])
            ) {
              const seriesId = Number(
                result?.seriesId ||
                  result?.series?.id ||
                  input?.seriesId ||
                  input?.series?.id,
              );
              if (Number.isFinite(seriesId))
                await sync.reconcileItem("tv", `series_${seriesId}`);
              else await sync.synchronize("tv");
            } else if (managementMatch[2] === "queue")
              await sync.synchronizeOperations();
            else if (managementMatch[2] === "downloadClients")
              setTimeout(
                () => ensureBundledDownloadPathMappings().catch(() => {}),
                500,
              );
            else if (
              managementMatch[2] === "commands" &&
              /^Refresh(?:Movie|Series)$/.test(String(input.name || ""))
            ) {
              const domain = managementMatch[1],
                engineId = Number(
                  domain === "movie"
                    ? input.movieId || input.movieIds?.[0]
                    : input.seriesId || input.seriesIds?.[0],
                );
              if (Number.isFinite(engineId))
                setTimeout(
                  () =>
                    sync
                      .reconcileItem(
                        domain,
                        `${domain === "movie" ? "movie" : "series"}_${engineId}`,
                      )
                      .catch(() => {}),
                  5e3,
                );
              else {
                sync.invalidate(domain);
                setTimeout(() => sync.synchronize(domain).catch(() => {}), 5e3);
              }
            }
          }
          const responseInstance = requestedInstance
            ? engineSettings.public().instances.find((item) => item.id === requestedInstance)
            : engineSettings.mode() === "external"
              ? engineSettings.public().instances.find((item) => item.domain === domain && item.isDefault && item.enabled !== false)
              : null;
          result = attachEngineOwnership(result, responseInstance);
          return json(res, method === "POST" ? 201 : 200, { result: result });
        }
        if (url.pathname === "/api/manage/audit" && req.method === "GET") {
          if (!administrator(res, session)) return;
          const audit = await auditStore.read();
          return json(res, 200, { items: audit.entries || [] });
        }
        const healthActionMatch = url.pathname.match(/^\/api\/system\/health\/([^/]+)\/(dismiss|rematch)$/);
        if (healthActionMatch && req.method === "POST") {
          if (!administrator(res, session) || !requireCsrf(req, res, session)) return;
          const [, id, action] = healthActionMatch;
          if (action === "dismiss") {
            await operationsCenterStore.update((current) => {
              current.healthDismissed = current.healthDismissed || {};
              current.healthDismissed[id] = new Date().toISOString();
              return current;
            });
            return json(res, 200, { dismissed: true, id });
          }
          const input = await body(req), result = await rematchMedia({
            domain: "movie",
            mediaId: Number(input.mediaId),
            tmdbId: Number(input.tmdbId),
            engineInstanceId: input.engineInstanceId,
          });
          await operationsCenterStore.update((current) => {
            current.healthDismissed = current.healthDismissed || {};
            current.healthDismissed[id] = new Date().toISOString();
            return current;
          });
          return json(res, 200, { matched: true, result });
        }
        if (req.method !== "GET")
          return json(res, 405, {
            error: { code: "read_only", message: "Read-only review mode" },
          });
        const metadataArtworkMatch = url.pathname.match(
          /^\/api\/artwork\/tv-metadata\/(\d+)\/(season|episode)$/,
        );
        if (metadataArtworkMatch) {
          if (!permitted(res, session, "tv")) return;
          const value = await tvMetadataArtwork(
            metadataArtworkMatch[1],
            metadataArtworkMatch[2],
            url.searchParams.get("season"),
            url.searchParams.get("episode"),
          );
          if (!value) {
            res.writeHead(204, { "cache-control": "private, max-age=300" });
            return res.end();
          }
          res.writeHead(200, {
            "content-type": value.contentType,
            "cache-control": "private, max-age=86400",
            "x-content-type-options": "nosniff",
          });
          return res.end(value.body);
        }
        const artworkMatch = url.pathname.match(
          /^\/api\/artwork\/(movie|tv)\/((?:movie|series)_[A-Za-z0-9_-]+)\/(poster|fanart|logo|banner|episode|season)$/,
        );
        if (artworkMatch) {
          if (
            !permitted(
              res,
              session,
              artworkMatch[1] === "movie" ? "movies" : "tv",
            )
          )
            return;
          const value = await libraryArtwork(
            artworkMatch[1],
            artworkMatch[2],
            artworkMatch[3],
          );
          if (!value) {
            res.writeHead(204, { "cache-control": "private, max-age=300" });
            return res.end();
          }
          if (artworkMatch[3] === "poster" && url.searchParams.has("variant")) {
            try {
              const domain = artworkMatch[1],
                library = await sync.list(domain),
                baseItem = library.find(
                  (entry) => entry.id === artworkMatch[2],
                ),
                template = baseItem
                  ? await overlayForItem(domain, baseItem)
                  : null;
              if (baseItem && template) {
                const { item: item, context: context } =
                    await overlayRenderContext(
                      domain,
                      baseItem,
                      template,
                      session,
                    ),
                  revision = overlayRevision(template, item, context),
                  renderKey = `${domain}:${item.id}:${revision}`;
                let rendered = posterOverlayCache.get(renderKey);
                if (!rendered) {
                  rendered = renderOverlaySvg({
                    poster: value.body,
                    contentType: value.contentType,
                    template: template,
                    item: item,
                    context: context,
                  });
                  if (posterOverlayCache.size >= 500)
                    posterOverlayCache.delete(
                      posterOverlayCache.keys().next().value,
                    );
                  posterOverlayCache.set(renderKey, rendered);
                }
                res.writeHead(200, {
                  "content-type": "image/svg+xml; charset=utf-8",
                  "cache-control": "private, max-age=86400",
                  "content-security-policy":
                    "default-src 'none'; img-src data:",
                  "x-content-type-options": "nosniff",
                });
                return res.end(rendered);
              }
            } catch {}
          }
          res.writeHead(200, {
            "content-type": value.contentType,
            "cache-control":
              "private, max-age=86400, stale-while-revalidate=604800",
            "x-content-type-options": "nosniff",
          });
          return res.end(value.body);
        }
        const overlayRenderMatch = url.pathname.match(
          /^\/api\/(?:artwork\/composed|poster-overlays\/render)\/(movie|tv)\/((?:movie|series)_[A-Za-z0-9_-]+)$/,
        );
        if (overlayRenderMatch) {
          const domain = overlayRenderMatch[1];
          if (!permitted(res, session, domain === "movie" ? "movies" : "tv"))
            return;
          const baseItem = await sync.item(domain, overlayRenderMatch[2]);
          if (!baseItem)
            return json(res, 404, {
              error: {
                code: "not_found",
                message: "Library item was not found.",
              },
            });
          const original = await libraryArtwork(domain, baseItem.id, "poster");
          if (!original) {
            res.writeHead(204, { "cache-control": "private, max-age=300" });
            return res.end();
          }
          try {
            const template = await overlayForItem(domain, baseItem);
            if (!template) {
              res.writeHead(200, {
                "content-type": original.contentType,
                "cache-control": "private, max-age=86400",
                "x-content-type-options": "nosniff",
              });
              return res.end(original.body);
            }
            const { item: item, context: context } = await overlayRenderContext(
                domain,
                baseItem,
                template,
                session,
              ),
              revision = overlayRevision(template, item, context),
              key = `${domain}:${item.id}:${revision}`;
            let rendered = posterOverlayCache.get(key);
            if (!rendered) {
              rendered = renderOverlaySvg({
                poster: original.body,
                contentType: original.contentType,
                template: template,
                item: item,
                context: context,
              });
              if (posterOverlayCache.size >= 500)
                posterOverlayCache.delete(
                  posterOverlayCache.keys().next().value,
                );
              posterOverlayCache.set(key, rendered);
            }
            res.writeHead(200, {
              "content-type": "image/svg+xml; charset=utf-8",
              "cache-control": "private, max-age=86400",
              "content-security-policy": "default-src 'none'; img-src data:",
              "x-content-type-options": "nosniff",
            });
            return res.end(rendered);
          } catch {
            res.writeHead(200, {
              "content-type": original.contentType,
              "cache-control": "private, max-age=300",
              "x-content-type-options": "nosniff",
            });
            return res.end(original.body);
          }
        }
        if (url.pathname === "/api/media/movies") {
          if (!permitted(res, session, "movies")) return;
          const refresh = url.searchParams.get("refresh") === "true";
          if (refresh && !administrator(res, session)) return;
          const paged = url.searchParams.has("limit") && !refresh,
            page = paged
              ? await sync.page("movie", {
                  offset: url.searchParams.get("offset"),
                  limit: url.searchParams.get("limit"),
                  query: url.searchParams.get("query"),
                  filter: url.searchParams.get("filter"),
                  sort: url.searchParams.get("sort"),
                  direction: url.searchParams.get("direction"),
                  randomSeed: url.searchParams.get("randomSeed"),
                  engineInstanceId:url.searchParams.get("engineInstanceId"),
                })
              : null,
            rawItems = page
              ? page.items
              : await sync.list("movie", { refresh: refresh }),
            engineInstances=engineSettings.public().instances.filter(instance=>instance.domain==="movie"),
            requestedInstance=String(url.searchParams.get("engineInstanceId")||"all"),
            defaultInstance=engineInstances.find(instance=>instance.isDefault),
            ownedItems=rawItems.map(item=>({...item,engineInstanceId:item.engineInstanceId||defaultInstance?.id})),
            filteredItems=requestedInstance==="all"?ownedItems:ownedItems.filter(item=>item.engineInstanceId===requestedInstance),
            attention = refresh
              ? await refreshAttention("movie", filteredItems)
              : typeof projectionStore.attentionSummary === "function"
                ? await projectionStore.attentionSummary("movie", requestedInstance)
                : cachedAttention("movie", filteredItems),
            summary = await librarySummary("movie", filteredItems, requestedInstance),
            items = await decoratePosterArtwork("movie", filteredItems, session);
          return json(res, 200, {
            items: items,
            attention: attention,
            summary: summary,
            mode: mode,
            sync: sync.snapshot().movie,
            engines:engineInstances.map(({id,name,isDefault})=>({id,name,isDefault})),
            ...(page
              ? {
                  page: {
                    total: page.total,
                    offset: page.offset,
                    limit: page.limit,
                    preferredLimit: configuredLibraryPageSize,
                    hasMore: page.hasMore,
                    letters: page.letters || {},
                  },
                }
              : {}),
          });
        }
        const trailerMatch = url.pathname.match(
          /^\/api\/media\/trailers\/(movie|tv)\/((?:movie|series)_[A-Za-z0-9_-]+)$/,
        );
        if (trailerMatch && ["GET", "HEAD"].includes(req.method)) {
          const domain = trailerMatch[1],
            permission = domain === "movie" ? "movies" : "tv";
          if (!permitted(res, session, permission)) return;
          const detail = await mediaDetail(domain, trailerMatch[2]);
          if (detail?.item && typeof plexService.trailer === "function" && typeof plexService.openTrailer === "function") {
            try {
              const [settings, token] = await Promise.all([plexSettingsStore.read(), engineSettings.plexCredential()]);
              if (settings.endpoint && token) {
                const cacheKey = `${settings.server?.machineIdentifier || settings.endpoint}:${domain}:${trailerMatch[2]}`,
                  cached = plexTrailerCache.get(cacheKey);
                let path = cached?.expiresAt > Date.now() ? cached.path : undefined;
                if (path === undefined) {
                  const resolvePlex = async () => {
                    const expectedType = domain === "tv" ? "show" : "movie";
                    for (const library of (settings.libraries || []).filter(value => value.type === expectedType)) {
                      const match = typeof plexService.findLibraryMatch === "function"
                          ? await plexService.findLibraryMatch(settings.endpoint, token, library, detail.item)
                          : plexService.match([{...detail.item, domain}], await plexService.libraryItems(settings.endpoint, token, library))[0]?.plex?.[0];
                      if (!match?.ratingKey) continue;
                      const trailer = await plexService.trailer(settings.endpoint, token, match.ratingKey);
                      if (trailer?.path) return trailer.path;
                    }
                    return null;
                  };
                  path = await Promise.race([resolvePlex(), new Promise(resolve => setTimeout(() => resolve(null), 1800))]);
                  plexTrailerCache.set(cacheKey, {path, expiresAt:Date.now()+(path?10*60_000:60_000)});
                }
                if (path) {
                  const upstream = await plexService.openTrailer(settings.endpoint, token, path, {range:req.headers.range,head:req.method === "HEAD"}),
                    headers = {"cache-control":"private, max-age=300","content-type":upstream.headers.get("content-type") || "video/mp4","x-content-type-options":"nosniff"};
                  for (const name of ["accept-ranges","content-length","content-range"]) { const value = upstream.headers.get(name); if (value) headers[name] = value; }
                  res.writeHead(upstream.status, headers);
                  if (req.method === "HEAD" || !upstream.body) return res.end();
                  return Readable.fromWeb(upstream.body).pipe(res);
                }
              }
            } catch {}
          }
          const file = detail?.item
              ? await trailerPlayback.find(domain, await vynodeAccessiblePath(domain, detail.item.location || detail.item.rootFolder, detail.item.engineInstanceId || null))
              : null;
          if (!file) {
            res.writeHead(404, {
              "cache-control": "private, max-age=60",
              "x-content-type-options": "nosniff",
            });
            return res.end();
          }
          return trailerPlayback.send(req, res, file);
        }
        const movieMatch = url.pathname.match(
          /^\/api\/media\/movies\/(movie_[A-Za-z0-9_-]+)$/,
        );
        if (movieMatch) {
          if (!permitted(res, session, "movies")) return;
          const refresh = url.searchParams.get("refresh") === "true";
          if (refresh && !administrator(res, session)) return;
          if (refresh) {
            await sync.reconcileItem("movie", movieMatch[1]);
            invalidateMediaDetail("movie", movieMatch[1]);
          }
          const detail = await mediaDetail("movie", movieMatch[1]),
            item = detail?.item,
            decorated = item
              ? (await decoratePosterArtwork("movie", [item], session))[0]
              : null;
          return decorated
            ? json(res, 200, { item: decorated, mode: mode, freshness:{source:detail.source,updatedAt:detail.refreshedAt} })
            : json(res, 404, {
                error: { code: "not_found", message: "Movie was not found." },
              });
        }
        if (url.pathname === "/api/media/tv") {
          if (!permitted(res, session, "tv")) return;
          const refresh = url.searchParams.get("refresh") === "true";
          if (refresh && !administrator(res, session)) return;
          const paged = url.searchParams.has("limit") && !refresh,
            page = paged
              ? await sync.page("tv", {
                  offset: url.searchParams.get("offset"),
                  limit: url.searchParams.get("limit"),
                  query: url.searchParams.get("query"),
                  filter: url.searchParams.get("filter"),
                  sort: url.searchParams.get("sort"),
                  direction: url.searchParams.get("direction"),
                  randomSeed: url.searchParams.get("randomSeed"),
                  engineInstanceId:url.searchParams.get("engineInstanceId"),
                })
              : null,
            rawItems = page
              ? page.items
              : await sync.list("tv", { refresh: refresh }),
            engineInstances=engineSettings.public().instances.filter(instance=>instance.domain==="tv"),
            requestedInstance=String(url.searchParams.get("engineInstanceId")||"all"),
            defaultInstance=engineInstances.find(instance=>instance.isDefault),
            ownedItems=rawItems.map(item=>({...item,engineInstanceId:item.engineInstanceId||defaultInstance?.id})),
            filteredItems=requestedInstance==="all"?ownedItems:ownedItems.filter(item=>item.engineInstanceId===requestedInstance),
            attention = refresh
              ? await refreshAttention("tv", filteredItems)
              : typeof projectionStore.attentionSummary === "function"
                ? await projectionStore.attentionSummary("tv", requestedInstance)
                : cachedAttention("tv", filteredItems),
            summary = await librarySummary("tv", filteredItems, requestedInstance),
            items = await decoratePosterArtwork("tv", filteredItems, session);
          return json(res, 200, {
            items: items,
            attention: attention,
            summary: summary,
            mode: mode,
            sync: sync.snapshot().tv,
            engines:engineInstances.map(({id,name,isDefault})=>({id,name,isDefault})),
            ...(page
              ? {
                  page: {
                    total: page.total,
                    offset: page.offset,
                    limit: page.limit,
                    preferredLimit: configuredLibraryPageSize,
                    hasMore: page.hasMore,
                    letters: page.letters || {},
                  },
                }
              : {}),
          });
        }
        const tvMatch = url.pathname.match(
          /^\/api\/media\/tv\/(series_[A-Za-z0-9_-]+)$/,
        );
        if (tvMatch) {
          if (!permitted(res, session, "tv")) return;
          const refresh = url.searchParams.get("refresh") === "true";
          if (refresh && !administrator(res, session)) return;
          if (refresh) {
            await sync.reconcileItem("tv", tvMatch[1]);
            invalidateMediaDetail("tv", tvMatch[1]);
          }
          const detail = await mediaDetail("tv", tvMatch[1]),
            item = detail?.item,
            decorated = item
              ? (await decoratePosterArtwork("tv", [item], session))[0]
              : null;
          return decorated
            ? json(res, 200, { item: decorated, mode: mode, freshness:{source:detail.source,updatedAt:detail.refreshedAt} })
            : json(res, 404, {
                error: {
                  code: "not_found",
                  message: "TV series was not found.",
                },
              });
        }
        if (
          url.pathname === "/api/activity/queue/live" ||
          url.pathname === "/api/activity/queue"
        ) {
          if (!administrator(res, session)) return;
          let items =
            mode === "engine"
              ? await liveQueue()
              : await sync.operations("queue");
          const attributions = {
            ...(await requestAttribution(
              "movie",
              items
                .filter((item) => item.domain === "movie")
                .map((item) => item.mediaId),
              session,
            )),
            ...(await requestAttribution(
              "tv",
              items
                .filter((item) => item.domain === "tv")
                .map((item) => item.mediaId),
              session,
            )),
          };
          items = items.map((item) => ({
            ...item,
            requesters: attributions[`${item.domain}:${item.mediaId}`] || [],
          }));
          return json(res, 200, { items: items });
        }
        if (url.pathname === "/api/activity/history") {
          if (!administrator(res, session)) return;
          let items = await sync.operations("history");
          const attributions = {
            ...(await requestAttribution(
              "movie",
              items
                .filter((item) => item.domain === "movie")
                .map((item) => item.mediaId),
              session,
            )),
            ...(await requestAttribution(
              "tv",
              items
                .filter((item) => item.domain === "tv")
                .map((item) => item.mediaId),
              session,
            )),
          };
          items = items.map((item) => ({
            ...item,
            requesters: attributions[`${item.domain}:${item.mediaId}`] || [],
          }));
          return json(res, 200, { items: items });
        }
        if (url.pathname === "/api/calendar") {
          if (!permitted(res, session, "calendar")) return;
          const start = url.searchParams.get("start"),
            end = url.searchParams.get("end"),
            movies = url.searchParams.get("movies") !== "false",
            tv = url.searchParams.get("tv") !== "false";
          let items = await sync.operations("calendar");
          if (mode === "engine" && (start || end)) {
            const domains = [
                ...(movies ? ["movie"] : []),
                ...(tv ? ["tv"] : []),
              ],configuredInstances=engineSettings.public().instances.filter(instance=>instance.enabled!==false&&domains.includes(instance.domain)),
              targets=configuredInstances.length?configuredInstances:domains.map(domain=>({domain,id:null,name:null})),
              settled = await Promise.allSettled(
                targets.map(async (instance) => {
                  const domain=instance.domain;
                  const result = await management.execute(
                    domain,
                    "calendar",
                    "GET",
                    {
                      query: {
                        start: start,
                        end: end,
                        unmonitored: false,
                        ...(domain === "tv" ? { includeSeries: true } : {}),
                      },
                      engineInstanceId:instance.id,
                    },
                  );
                  return (Array.isArray(result) ? result : [])
                    .filter((item) => item.monitored !== false)
                    .map((item) => ({...calendarItem(item, domain),engineInstanceId:instance.id||item.engineInstanceId,engineInstanceName:instance.name||item.engineInstanceName}));
                }),
              );
            const live = settled.flatMap((result) =>
              result.status === "fulfilled" ? result.value : [],
            );
            if (
              live.length ||
              settled.every((result) => result.status === "fulfilled")
            )
              items = live;
          }
          items = items
            .filter(
              (item) =>
                (movies && item.domain === "movie") ||
                (tv && item.domain === "tv"),
            )
            .filter(
              (item) =>
                (!start || String(item.dateUtc || "").slice(0, 10) >= start) &&
                (!end || String(item.dateUtc || "").slice(0, 10) < end),
            );
          return json(res, 200, { items: items });
        }
        if (url.pathname === "/api/system/health") {
          if (!administrator(res, session)) return;
          if (url.searchParams.get("refresh") === "1")
            await sync.synchronizeOperations();
          const [reported, state, movies] = await Promise.all([
              sync.operations("health"),
              operationsCenterStore.read(),
              sync.list("movie").catch(() => []),
            ]),
            healthDismissed = state.healthDismissed || {},
            normalizedTitle = (value) =>
              String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, ""),
            items = [];
          for (const raw of reported) {
            const stableId = `health_${createHash("sha1")
              .update(`${raw.domain || "media"}:${raw.engineInstanceId || "default"}:${raw.source || ""}:${raw.message || ""}`)
              .digest("hex")
              .slice(0, 20)}`;
            if (healthDismissed[stableId]) continue;
            const item = { ...raw, id: stableId };
            if (raw.domain === "movie" && /RemovedMovieCheck/i.test(String(raw.source || ""))) {
              const oldTmdbId = Number(String(raw.message || "").match(/tmdbid\s*(\d+)/i)?.[1] || 0),
                warningTitle = String(raw.message || "")
                  .replace(/\s*\(tmdbid\s*\d+\).*$/i, "")
                  .replace(/\s+was removed from TMDb.*$/i, "")
                  .trim(),
                warningKey = normalizedTitle(warningTitle),
                libraryItem = movies.find((movie) =>
                  (!raw.engineInstanceId || movie.engineInstanceId === raw.engineInstanceId) &&
                  ((oldTmdbId > 0 && Number(movie.tmdbId) === oldTmdbId) ||
                    (warningKey && normalizedTitle(movie.title) === warningKey)));
              let replacement = null;
              if (libraryItem && discovery.configured())
                replacement = await discovery.enrich("movie", { title: libraryItem.title, year: libraryItem.year }).catch(() => null);
              item.recovery = {
                kind: "removed-tmdb",
                oldTmdbId: oldTmdbId || null,
                libraryItem: libraryItem ? {
                  id: Number(String(libraryItem.id || "").match(/(\d+)$/)?.[1]),
                  title: libraryItem.title,
                  year: libraryItem.year || null,
                } : null,
                replacement: replacement && Number(replacement.tmdbId) !== oldTmdbId ? {
                  tmdbId: Number(replacement.tmdbId),
                  title: replacement.title,
                  year: replacement.year || null,
                } : null,
              };
            }
            items.push(item);
          }
          return json(res, 200, { items, sync: sync.snapshot() });
        }
        if (url.pathname === "/api/dashboard") {
          if (!permitted(res, session, "dashboard")) return;
          const movieDashboardId=String(url.searchParams.get("movieEngineInstanceId")||"all"),tvDashboardId=String(url.searchParams.get("tvEngineInstanceId")||"all"),dashboardInstances=engineSettings.public().instances.filter(item=>item.enabled!==false),movieDashboardInstances=dashboardInstances.filter(item=>item.domain==="movie"),tvDashboardInstances=dashboardInstances.filter(item=>item.domain==="tv"),selectedMovieDashboard=movieDashboardId==="all"?null:movieDashboardInstances.find(item=>item.id===movieDashboardId),selectedTvDashboard=tvDashboardId==="all"?null:tvDashboardInstances.find(item=>item.id===tvDashboardId),combinedDashboard=movieDashboardId==="all"&&tvDashboardId==="all";
          if(movieDashboardId!=="all"&&!selectedMovieDashboard)return json(res,404,{error:"Choose an available movie engine instance"});
          if(tvDashboardId!=="all"&&!selectedTvDashboard)return json(res,404,{error:"Choose an available TV engine instance"});
          if (combinedDashboard&&dashboardSnapshot && dashboardSnapshotExpires > Date.now())
            return json(res, 200, dashboardSnapshot, {
              "x-vynodearr-cache": "hit",
            });
          if (!dashboardSnapshotRun||!combinedDashboard) {
            const currentDashboardRun = (async () => {
              const [
                  rawMovies,
                  rawTvItems,
                  rawQueue,
                  rawHistory,
                  rawCalendar,
                  rawHealth,
                  tvProfiles,
                ] = await Promise.all([
                  sync.list("movie"),
                  sync.list("tv"),
                  mode === "engine" ? liveQueue() : sync.operations("queue"),
                  dashboardHistory(30),
                  sync.operations("calendar"),
                  sync.operations("health"),
                  management.execute("tv", "profiles", "GET", {engineInstanceId:selectedTvDashboard?.id||null}).catch(() => []),
                ]),
                owns=(item,domain)=>String(domain==="movie"?movieDashboardId:tvDashboardId)==="all"||String(item.engineInstanceId||"")===String(domain==="movie"?movieDashboardId:tvDashboardId),
                movies=rawMovies.filter(item=>owns(item,"movie")),tvItems=rawTvItems.filter(item=>owns(item,"tv")),queue=rawQueue.filter(item=>owns(item,item.domain)),history=rawHistory.filter(item=>owns(item,item.domain)),calendar=rawCalendar.filter(item=>owns(item,item.domain)),health=rawHealth.filter(item=>owns(item,item.domain)),
                profileNames = {
                  tv: new Map(
                    (Array.isArray(tvProfiles) ? tvProfiles : []).map(
                      (profile) => [
                        String(profile.id),
                        profile.name || `Profile ${profile.id}`,
                      ],
                    ),
                  ),
                },
                analytics = dashboardAnalytics(
                  movies,
                  tvItems,
                  history,
                  30,
                  profileNames,
                ),
                recentImports = history.filter(
                  (item) =>
                    String(item.eventType || "").toLowerCase() ===
                    "downloadfolderimported",
                ),
                seen = new Set(),
                recentlyAdded = [];
              for (const item of recentImports) {
                const key = `${item.domain}:${item.engineInstanceId||"default"}:${item.mediaId || item.title}`;
                if (seen.has(key)) continue;
                seen.add(key);
                recentlyAdded.push({
                  id: item.mediaId || item.id,
                  title: item.title,
                  type: item.domain === "movie" ? "Movie" : "TV",
                  timestamp: item.timestamp,
                  engineInstanceId:item.engineInstanceId||null,
                  engineInstanceName:item.engineInstanceName||dashboardInstances.find(instance=>instance.id===item.engineInstanceId)?.name||null,
                });
                if (recentlyAdded.length === 6) break;
              }
              const today = new Date();
              today.setUTCHours(0, 0, 0, 0);
              const futureCalendar = [...calendar]
                  .filter(
                    (item) => item.dateUtc && new Date(item.dateUtc) >= today,
                  )
                  .sort((left, right) =>
                    String(left.dateUtc).localeCompare(String(right.dateUtc)),
                  ),
                upcoming = futureCalendar
                  .slice(0, 6)
                  .map((item) => ({
                    id: item.id,
                    domain: item.domain,
                    title: item.title,
                    context: item.context || null,
                    dateUtc: item.dateUtc,
                    mediaId: item.mediaId || null,
                  }));
              return {
                scope:{movie:{id:movieDashboardId,name:selectedMovieDashboard?.name||"All movie engines",instanceCount:movieDashboardInstances.length},tv:{id:tvDashboardId,name:selectedTvDashboard?.name||"All TV engines",instanceCount:tvDashboardInstances.length}},
                metrics: {
                  movies: movies.length,
                  tv: tvItems.length,
                  queue: queue.length,
                  upcomingMovies: futureCalendar.filter(
                    (item) => item.domain === "movie",
                  ).length,
                  upcomingEpisodes: futureCalendar.filter(
                    (item) => item.domain === "tv",
                  ).length,
                  missing:
                    movies.filter((item) => item.state === "missing").length +
                    tvItems.reduce(
                      (sum, item) => sum + item.missingEpisodes,
                      0,
                    ),
                  downloading: queue.filter((item) =>
                    String(item.status).toLowerCase().includes("down"),
                  ).length,
                  health: health.length,
                  storage:
                    analytics.library.movie.sizeOnDisk +
                    analytics.library.tv.sizeOnDisk,
                },
                upcoming: upcoming,
                analytics: analytics,
                recentlyAdded: recentlyAdded,
                recentActivity: history.slice(0, 8).map(item=>({...item,engineInstanceName:item.engineInstanceName||dashboardInstances.find(instance=>instance.id===item.engineInstanceId)?.name||null})),
                engines: {
                  configured: engineSettings.configured(),
                  mode: mode,
                  status: sync.snapshot(),
                },
              };
            })();
            if(!combinedDashboard)return json(res,200,await currentDashboardRun,{"x-vynodearr-cache":"isolated"});
            dashboardSnapshotRun=currentDashboardRun;
          }
          try {
            dashboardSnapshot = await dashboardSnapshotRun;
            dashboardSnapshotExpires = Date.now() + 15e3;
            return json(res, 200, dashboardSnapshot, {
              "x-vynodearr-cache": "miss",
            });
          } finally {
            dashboardSnapshotRun = null;
          }
        }
        if (url.pathname === "/api/system/engines") {
          if (!administrator(res, session)) return;
          const [movieTest, tvTest, movieStatus, tvStatus] = await Promise.all([
            registry.movie().testConnection(),
            registry.tv().testConnection(),
            registry
              .movie()
              .getSystemStatus()
              .catch(() => null),
            registry
              .tv()
              .getSystemStatus()
              .catch(() => null),
          ]);
          const publicSettings = engineSettings.public();
          return json(res, 200, {
            mode: mode,
            engineMode: engineSettings.mode(),
            pendingMode: engineSettings.pendingMode(),
            restartRequired: Boolean(engineSettings.pendingMode()),
            managed: bundledEnginesActive(),
            configured: engineSettings.configured(),
            engines: [
              {
                domain: "movie",
                displayName: "Movies",
                configuration:
                  publicSettings.movie ||
                  publicEngineConfiguration(baseConfig.movie),
                connection: movieTest,
                status: movieStatus,
                synchronization: sync.snapshot().movie,
              },
              {
                domain: "tv",
                displayName: "TV",
                configuration:
                  publicSettings.tv || publicEngineConfiguration(baseConfig.tv),
                connection: tvTest,
                status: tvStatus,
                synchronization: sync.snapshot().tv,
              },
            ],
          });
        }
        return json(res, 404, {
          error: {
            code: "not_found",
            message: "The requested VynodeArr resource was not found.",
          },
        });
      }
      const requested =
          url.pathname === "/" ? "index.html" : url.pathname.slice(1),
        safe = normalize(requested).replace(/^(\.\.[/\\])+/, "");
      try {
        const path = join(webRoot, safe),
          value = versionWebDocument(path, await readFile(path));
        return staticResponse(req, res, path, value);
      } catch {
        const path = join(webRoot, "index.html"),
          value = versionWebDocument(path, await readFile(path));
        return staticResponse(req, res, path, value, { fallback: true });
      }
    } catch (error) {
      if (url.pathname.startsWith("/api/"))
        return safeError(
          res,
          error,
          url.pathname.includes("/tv")
            ? "TV"
            : url.pathname.includes("/movies")
              ? "Movie"
              : null,
          url.pathname,
        );
      res.writeHead(500);
      res.end();
    }
  }
  return {
    handleRequest: handleRequest,
    registry: registry,
    sync: sync,
    auth: auth,
    config: baseConfig,
    engineSettings: engineSettings,
    initialize: initialize,
  };
}
export const defaultApplication = createApplication();
export const handleRequest = defaultApplication.handleRequest;

/* Source-level compatibility anchors for established workflow audits:
already in the ${domain==='movie'?'Movies':'Television'} library
management.execute('tv','profiles','GET')
qualityProfiles.tv?.get(String(item.qualityProfile))
analytics.library.movie.sizeOnDisk+analytics.library.tv.sizeOnDisk
client.post('command',{name:'ResetApiKey'})
/engine-config/${domain}/config.xml
The engine did not provide its newly generated API key
proxyCompatibilityApi
'/movies'
'/tv'
Compatibility API endpoint not found
xml.match(/<ApiKey>([^<]+)<\/ApiKey>/i)
client.post('command',{name:'Restart'})
historySections(items)
eventSections(items)
wireEventFilters
event-toolbar
Movie and television activity separated by library
VynodeArr_${domain===
status:'canceled', message:'Cancelled by user'
href:'#request-management'
href:'#requests'
client.get('queue'
client.get('history'
status:'downloading'
status:'imported'
currentUserId:session.user.id
includeMovie:true
includeSeries:true
includeEpisode:true
engineRecords.filter(item=>{const id=linkedId(item);return Number.isFinite(id)&&id>0;})
return !importedEvent(item)
scheduleImportedUpgradeRename(domain,item,confirmedImport)
event?.data?.isUpgrade??event?.isUpgrade
domain==='movie'?naming?.renameMovies:naming?.renameEpisodes
domain==='movie'?{name:'RenameMovie',movieIds:[mediaId]}:{name:'RenameSeries',seriesIds:[mediaId]}
sync.operations('health')
item.status==='pending_approval'||item.approvedBy||item.rejectedBy
item.category==='request'&&item.href===requestHref&&!item.read
...rendered.payload,chat_id:channel.chatId
operationalGrabDeliveryInitializedAt
suppressExternalIds
deliverable=added.filter
recordEngineSearchActivities
reconcileSearchActivities(userId,providedSnapshots=null)
activitySnapshots.set(domain,{queue:engineRecords,history:engineHistory})
await reconcileSearchActivities(null,activitySnapshots)
*/
/* Import/search workflow compatibility anchors:
skipped:job.skipped
approved!==false
downloadAllowed!==false
Selecting best release
Media location
includeEpisodeFile:true
batchSize=8
releaseCacheTtlMs=45_000
sync.reconcileItem(domain,publicId)
VYNODEARR_IMPORT_PACE_MS||25
status='canceling'
cancel-import-job
milestones=new Map<string,number>
job.completed%50===0
Refresh and folder scan queued
includeFiles=true
Video files (
refresh?await authoritativeAttention
filterExistingFiles:false
name:'ManualImport'
importMode:'Auto'
Choose movie file
episode-change-file
CHOOSE MEDIA FILE
This replaces its stale file association
storePlan:false
Rename & organize
Rename selected
Retry organize
wireHistoryActions
name:'RenameFiles'
name:'RefreshMovie'
name:'RefreshSeries'
file.path||item.existingPath
moveFiles:true
*/
