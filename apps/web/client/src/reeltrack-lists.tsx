import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { DiscoverRequest } from "./discover-request";
import type { DiscoverItem } from "./discover-types";
import type {
  ReeltrackList,
  ReeltrackListItem,
  ReeltrackListsMountOptions,
} from "./reeltrack-lists-types";
import "./react-reeltrack-lists.css";
import { ModalPortal } from "./modal-portal";
import type { OverlayTemplate } from "./poster-overlays-types";
import { errorMessage } from "./shell-utils";

const ReeltrackPosterDesigner = lazy(() => import("./reeltrack-poster-designer").then((module) => ({ default: module.ReeltrackPosterDesigner })));

const message = errorMessage;
const cleanFolder = (value: string) => value === "/" ? "/" : value.replaceAll("\\", "/").replace(/\/+$/, "") || "/";
const parentFolder = (value: string) => cleanFolder(value).split("/").slice(0, -1).join("/") || "/";
type MediaDestination = { id: string; domain: "movie" | "tv"; engineInstanceId?:string|null; engineInstanceName?:string|null; name: string; rootFolderPath: string; vynodePath?:string|null; isDefault?: boolean; ready?: boolean; plexLibraryKey?:string|null; plexLibrary?:{key:string;title:string}|null };
const reeltrackPosterUrl = (item: ReeltrackListItem) => item.tmdbId
  ? `/api/reeltrack/poster/${item.domain}/${item.tmdbId}`
  : item.posterUrl || "";
function ReeltrackPoster({ item }: { item: ReeltrackListItem }) {
  const [failed, setFailed] = useState(false), url = reeltrackPosterUrl(item);
  return !url || failed ? <span>{item.domain === "movie" ? "MOVIE" : "TV"}</span> : <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />;
}
const discoverItem = (item: ReeltrackListItem): DiscoverItem => ({
  id: `reeltrack_${item.domain}_${item.tmdbId}`,
  tmdbId: Number(item.tmdbId),
  domain: item.domain,
  title: item.title,
  year: item.year || null,
  overview: item.overview || "",
  rating: 0,
  poster: item.posterUrl || null,
  backdrop: null,
  genreIds: [],
});

export function ReeltrackListsView({
  options,
}: {
  options: ReeltrackListsMountOptions;
}) {
  const { request, notify } = options;
  const [configured, setConfigured] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [apiKey, setApiKey] = useState(""),
    [manageConnection, setManageConnection] = useState(false);
  const [lists, setLists] = useState<ReeltrackList[]>([]),
    [available, setAvailable] = useState<ReeltrackList[]>([]),
    [selectedId, setSelectedId] = useState("");
  const [showImport, setShowImport] = useState(false),
    [listPage, setListPage] = useState<"titles" | "automation">(options.administrator&&options.initialSection==='automation'?"automation":"titles"),
    [selectedRemote, setSelectedRemote] = useState<Set<string>>(new Set()),
    [filter, setFilter] = useState<"all" | "library" | "missing">("all"),
    [query, setQuery] = useState(""),
    [requesting, setRequesting] = useState<ReeltrackListItem | null>(null);
  const [trailerStatus, setTrailerStatus] = useState<{
      available: boolean;
      version?: string | null;
      root?: string;
      message?: string;
      plexConfigured?: boolean;
      plexServer?: { name?: string } | null;
      libraries?: Array<{ key: string; title: string; type: string; locations?: string[] }>;
      engineRoots?: { movie?: Array<{ id: string | number; path: string }>; tv?: Array<{ id: string | number; path: string }> };
      hostRoots?: { movie?: string; tv?: string };
    } | null>(null),
    [trailerBusy, setTrailerBusy] = useState(""),
    [automationEnabled, setAutomationEnabled] = useState(false),
    [automationMovieLibraryKey, setAutomationMovieLibraryKey] = useState(""),
    [automationTvLibraryKey, setAutomationTvLibraryKey] = useState(""),
    [splitLibraryMode, setSplitLibraryMode] = useState(false),
    [moviePlaceholderLibraryKey, setMoviePlaceholderLibraryKey] = useState(""),
    [tvPlaceholderLibraryKey, setTvPlaceholderLibraryKey] = useState(""),
    [mediaDestinations, setMediaDestinations] = useState<MediaDestination[]>([]),
    [movieMediaDestinationId, setMovieMediaDestinationId] = useState(""),
    [tvMediaDestinationId, setTvMediaDestinationId] = useState(""),
    [movieHostRoot, setMovieHostRoot] = useState("/movies"),
    [tvHostRoot, setTvHostRoot] = useState("/tv"),
    [moviePlaceholderHostRoot, setMoviePlaceholderHostRoot] = useState("/movies"),
    [tvPlaceholderHostRoot, setTvPlaceholderHostRoot] = useState("/tv"),
    [hostBrowser, setHostBrowser] = useState<"movie" | "tv" | "moviePlaceholder" | "tvPlaceholder" | null>(null),
    [hostBrowserPath, setHostBrowserPath] = useState("/"),
    [hostBrowserRoot, setHostBrowserRoot] = useState("/"),
    [hostDirectories, setHostDirectories] = useState<Array<{ name: string; path: string }>>([]),
    [hostBrowserError, setHostBrowserError] = useState(""),
    [automationInterval, setAutomationInterval] = useState(60),
    [automationCollectionName, setAutomationCollectionName] = useState(""),
    [collectionPosterTemplate, setCollectionPosterTemplate] = useState<OverlayTemplate | null>(null),
    [titleOverlayTemplate, setTitleOverlayTemplate] = useState<OverlayTemplate | null>(null),
    [existingTitleOverlayTemplate, setExistingTitleOverlayTemplate] = useState<OverlayTemplate | null>(null),
    [realTitleOverlayTemplate, setRealTitleOverlayTemplate] = useState<OverlayTemplate | null>(null),
    [posterDesigner, setPosterDesigner] = useState<"collection" | "title" | "existingTitle" | "realTitle" | null>(null);
  const selected =
    lists.find((value) => String(value.id) === selectedId) || lists[0];
  async function load() {
    setLoading(true);
    try {
      const [status, data, trailer, destinationValue] = await Promise.all([
        request<{ configured: boolean }>("/api/reeltrack/status"),
        request<{ items: ReeltrackList[] }>("/api/reeltrack/imported-lists"),
        options.administrator
          ? request<{
              available: boolean;
              version?: string | null;
              root?: string;
              message?: string;
              plexConfigured?: boolean;
              plexServer?: { name?: string } | null;
              libraries?: Array<{ key: string; title: string; type: string; locations?: string[] }>;
              engineRoots?: { movie?: Array<{ id: string | number; path: string }>; tv?: Array<{ id: string | number; path: string }> };
              hostRoots?: { movie?: string; tv?: string };
            }>("/api/reeltrack/trailers/status").catch(() => null)
          : Promise.resolve(null),
        request<{ destinations: MediaDestination[] }>("/api/media-destinations"),
      ]);
      setConfigured(status.configured);
      setLists(data.items || []);
      setTrailerStatus(trailer);
      setMediaDestinations(destinationValue.destinations || []);
      setAutomationMovieLibraryKey((current) => current || trailer?.libraries?.find((item) => item.type === "movie")?.key || "");
      setAutomationTvLibraryKey((current) => current || trailer?.libraries?.find((item) => item.type === "show")?.key || "");
      setMovieMediaDestinationId((current) => current || destinationValue.destinations?.find((item) => item.domain === "movie" && item.isDefault && item.ready)?.id || destinationValue.destinations?.find((item) => item.domain === "movie" && item.ready)?.id || "");
      setTvMediaDestinationId((current) => current || destinationValue.destinations?.find((item) => item.domain === "tv" && item.isDefault && item.ready)?.id || destinationValue.destinations?.find((item) => item.domain === "tv" && item.ready)?.id || "");
      setSelectedId((current) => current || String(data.items?.[0]?.id || ""));
    } catch (error) {
      notify(message(error), "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!selected) return;
    setAutomationEnabled(Boolean(selected.automation?.enabled));
    const legacy = trailerStatus?.libraries?.find((item) => item.key === selected.automation?.plexLibraryKey);
    setAutomationMovieLibraryKey(selected.automation?.plexMovieLibraryKey || (legacy?.type === "movie" ? legacy.key : "") || trailerStatus?.libraries?.find((item) => item.type === "movie")?.key || "");
    setAutomationTvLibraryKey(selected.automation?.plexTvLibraryKey || (legacy?.type === "show" ? legacy.key : "") || trailerStatus?.libraries?.find((item) => item.type === "show")?.key || "");
    setSplitLibraryMode(Boolean(selected.automation?.splitLibraryMode));
    setMoviePlaceholderLibraryKey(selected.automation?.plexMoviePlaceholderLibraryKey || "");
    setTvPlaceholderLibraryKey(selected.automation?.plexTvPlaceholderLibraryKey || "");
    const movieDestinationId = selected.automation?.movieMediaDestinationId || mediaDestinations.find((item) => item.domain === "movie" && item.isDefault && item.ready)?.id || mediaDestinations.find((item) => item.domain === "movie" && item.ready)?.id || "",
      tvDestinationId = selected.automation?.tvMediaDestinationId || mediaDestinations.find((item) => item.domain === "tv" && item.isDefault && item.ready)?.id || mediaDestinations.find((item) => item.domain === "tv" && item.ready)?.id || "",
      movieDestination = mediaDestinations.find((item) => item.domain === "movie" && item.id === movieDestinationId),
      tvDestination = mediaDestinations.find((item) => item.domain === "tv" && item.id === tvDestinationId);
    setMovieMediaDestinationId(movieDestinationId);
    setTvMediaDestinationId(tvDestinationId);
    setMovieHostRoot(movieDestination?.vynodePath || selected.automation?.movieHostRoot || trailerStatus?.hostRoots?.movie || "/movies");
    setTvHostRoot(tvDestination?.vynodePath || selected.automation?.tvHostRoot || trailerStatus?.hostRoots?.tv || "/tv");
    const moviePlaceholderLocation = trailerStatus?.libraries?.find((item) => item.key === selected.automation?.plexMoviePlaceholderLibraryKey)?.locations?.[0] || "",
      tvPlaceholderLocation = trailerStatus?.libraries?.find((item) => item.key === selected.automation?.plexTvPlaceholderLibraryKey)?.locations?.[0] || "";
    setMoviePlaceholderHostRoot(selected.automation?.moviePlaceholderHostRoot || (moviePlaceholderLocation.startsWith("/media/") ? moviePlaceholderLocation : "") || selected.automation?.movieHostRoot || trailerStatus?.hostRoots?.movie || "/movies");
    setTvPlaceholderHostRoot(selected.automation?.tvPlaceholderHostRoot || (tvPlaceholderLocation.startsWith("/media/") ? tvPlaceholderLocation : "") || selected.automation?.tvHostRoot || trailerStatus?.hostRoots?.tv || "/tv");
    setAutomationInterval(selected.automation?.intervalMinutes || 60);
    setAutomationCollectionName(selected.automation?.collectionName || selected.name);
    setCollectionPosterTemplate(selected.automation?.collectionPosterTemplate || null);
    setTitleOverlayTemplate(selected.automation?.titleOverlayTemplate || null);
    setExistingTitleOverlayTemplate(selected.automation?.existingTitleOverlayTemplate || null);
    setRealTitleOverlayTemplate(selected.automation?.realTitleOverlayTemplate || null);
  }, [selectedId]);
  const chooseMediaDestination = (domain:"movie"|"tv", id:string) => {
    const destination = mediaDestinations.find((item) => item.domain === domain && item.id === id);
    (domain === "movie" ? setMovieMediaDestinationId : setTvMediaDestinationId)(id);
    if (destination?.vynodePath)
      (domain === "movie" ? setMovieHostRoot : setTvHostRoot)(destination.vynodePath);
    if (destination?.plexLibraryKey)
      (domain === "movie" ? setAutomationMovieLibraryKey : setAutomationTvLibraryKey)(destination.plexLibraryKey);
  };
  useEffect(() => {
    if (!hostBrowser) return;
    setHostBrowserError("");
    setHostDirectories([]);
    const domain = hostBrowser.startsWith("movie") ? "movie" : "tv";
    void request<{ root?: string; directories?: Array<{ name: string; path: string }> }>(`/api/reeltrack/trailers/folders?domain=${domain}&path=${encodeURIComponent(hostBrowserPath)}`)
      .then((value) => { setHostBrowserRoot(cleanFolder(value.root || hostBrowserPath)); setHostDirectories(value.directories || []); })
      .catch((reason) => setHostBrowserError(message(reason)));
  }, [hostBrowser, hostBrowserPath, request]);
  async function connect() {
    if (!apiKey.trim()) return;
    setBusy(true);
    try {
      await request("/api/reeltrack/connection", {
        method: "PUT",
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      setApiKey("");
      setConfigured(true);
      setManageConnection(false);
      notify("Reeltrack connected securely.");
      await openImport();
    } catch (error) {
      notify(message(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    if (
      !confirm(
        "Disconnect Reeltrack? Imported snapshots will remain available.",
      )
    )
      return;
    setBusy(true);
    try {
      await request("/api/reeltrack/connection", { method: "DELETE" });
      setConfigured(false);
      setShowImport(false);
      notify("Reeltrack disconnected.");
    } catch (error) {
      notify(message(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function openImport() {
    try {
      const value = await request<{ items: ReeltrackList[] }>(
        "/api/reeltrack/available-lists",
      );
      setAvailable(value.items || []);
      setSelectedRemote(
        new Set(
          (value.items || [])
            .filter((item) => item.imported)
            .map((item) => String(item.id)),
        ),
      );
      setShowImport(true);
    } catch (error) {
      notify(message(error), "error");
    }
  }
  async function importLists() {
    setBusy(true);
    try {
      const value = await request<{ items: ReeltrackList[] }>(
        "/api/reeltrack/imported-lists",
        {
          method: "POST",
          body: JSON.stringify({
            listIds: [...selectedRemote],
            automation: { enabled: false },
          }),
        },
      );
      setLists(value.items || []);
      setSelectedId(String(value.items?.[0]?.id || ""));
      setShowImport(false);
      notify("Lists imported as drafts. Configure artwork, then save and apply.");
    } catch (error) {
      notify(message(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    setBusy(true);
    try {
      const value = await request<{ items: ReeltrackList[] }>(
        "/api/reeltrack/sync",
        { method: "POST" },
      );
      setLists(value.items || []);
      notify("Reeltrack lists synchronized.");
    } catch (error) {
      notify(message(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function downloadTrailer(item: ReeltrackListItem) {
    if (!selected || !item.tmdbId) return;
    const key = `${item.domain}:${item.tmdbId}`;
    setTrailerBusy(key);
    try {
      const value = await request<{ trailer: { path: string } }>(
        "/api/reeltrack/trailers/download",
        {
          method: "POST",
          body: JSON.stringify({
            listId: selected.id,
            domain: item.domain,
            tmdbId: item.tmdbId,
          }),
        },
      );
      notify(`Trailer downloaded to ${value.trailer.path}.`);
    } catch (error) {
      notify(message(error), "error");
    } finally {
      setTrailerBusy("");
    }
  }
  async function persistAutomation() {
    if (!selected) throw new Error("No list.");
    const domains = new Set((selected.items || []).map((item) => item.domain)),
      hasMovies = domains.has("movie"),
      hasTelevision = domains.has("tv");
    return request<{ item: ReeltrackList }>(
        `/api/reeltrack/imported-lists/${encodeURIComponent(selected.id)}/automation`,
        {
          method: "PUT",
          body: JSON.stringify({
            enabled: automationEnabled,
            plexMovieLibraryKey: hasMovies ? automationMovieLibraryKey : "",
            plexTvLibraryKey: hasTelevision ? automationTvLibraryKey : "",
            splitLibraryMode,
            plexMoviePlaceholderLibraryKey: hasMovies ? moviePlaceholderLibraryKey : "",
            plexTvPlaceholderLibraryKey: hasTelevision ? tvPlaceholderLibraryKey : "",
            moviePlaceholderHostRoot: hasMovies ? moviePlaceholderHostRoot : "",
            tvPlaceholderHostRoot: hasTelevision ? tvPlaceholderHostRoot : "",
            movieMediaDestinationId: hasMovies ? movieMediaDestinationId : "",
            tvMediaDestinationId: hasTelevision ? tvMediaDestinationId : "",
            movieHostRoot: hasMovies ? movieHostRoot : "",
            tvHostRoot: hasTelevision ? tvHostRoot : "",
            collectionName: automationCollectionName || selected.name,
            collectionPosterTemplate,
            titleOverlayTemplate,
            existingTitleOverlayTemplate,
            realTitleOverlayTemplate,
            intervalMinutes: automationInterval,
          }),
        },
      );
  }
  async function saveAutomation() {
    if (!selected) return;
    setBusy(true);
    try {
      const saved = await persistAutomation();
      const value = automationEnabled ? await request<{ item: ReeltrackList }>(
        `/api/reeltrack/imported-lists/${encodeURIComponent(selected.id)}/automation/run`,
        { method: "POST" },
      ) : saved;
      setLists((current) =>
        current.map((item) =>
          String(item.id) === String(value.item.id) ? value.item : item,
        ),
      );
      notify(automationEnabled ? "Saved and synced." : "Disabled.");
    } catch (error) {
      notify(message(error), "error");
    } finally {
      setBusy(false);
    }
  }
  const selectedPlexLibrary = (domain: "movie" | "tv") => trailerStatus?.libraries?.find(
    (library) => library.key === (domain === "movie" ? automationMovieLibraryKey : automationTvLibraryKey),
  );
  const selectedMediaDestination = (domain: "movie" | "tv") => mediaDestinations.find(
    (destination) => destination.domain === domain && destination.id === (domain === "movie" ? movieMediaDestinationId : tvMediaDestinationId),
  );
  const rootCompatibility = (domain: "movie" | "tv") => {
    const library = selectedPlexLibrary(domain), location = selected?.automation?.plexLibraryLocations?.[domain] || library?.locations?.[0] || "",
      hostRoot = domain === "movie" ? movieHostRoot : tvHostRoot;
    return {
      library,
      location,
      hostRoot,
      compatible: Boolean(location && hostRoot && (trailerStatus?.engineRoots?.[domain] || []).length),
    };
  };
  const openHostBrowser = (target: "movie" | "tv" | "moviePlaceholder" | "tvPlaceholder") => {
    const domain = target.startsWith("movie") ? "movie" : "tv",
      placeholderKey = target === "moviePlaceholder" ? moviePlaceholderLibraryKey : target === "tvPlaceholder" ? tvPlaceholderLibraryKey : "",
      libraryLocation = trailerStatus?.libraries?.find((library) => library.key === placeholderKey)?.locations?.[0] || "",
      path = target === "movie" ? movieHostRoot : target === "tv" ? tvHostRoot : target === "moviePlaceholder" ? moviePlaceholderHostRoot || libraryLocation : tvPlaceholderHostRoot || libraryLocation;
    setHostBrowser(target);
    setHostBrowserPath(cleanFolder(path || trailerStatus?.hostRoots?.[domain] || (domain === "movie" ? "/movies" : "/tv")));
  };
  async function runAutomation() {
    if (!selected) return;
    setBusy(true);
    try {
      await persistAutomation();
      const value = await request<{ item: ReeltrackList }>(
        `/api/reeltrack/imported-lists/${encodeURIComponent(selected.id)}/automation/run`,
        { method: "POST" },
      );
      setLists((current) =>
        current.map((item) =>
          String(item.id) === String(value.item.id) ? value.item : item,
        ),
      );
      notify("Synchronized.");
    } catch (error) {
      notify(message(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function repairTrailers() {
    if (!selected) return;
    setBusy(true);
    try {
      await persistAutomation();
      const value = await request<{ item: ReeltrackList; found: number; repaired: number }>(`/api/reeltrack/imported-lists/${encodeURIComponent(selected.id)}/automation/repair-trailers`, { method: "POST" });
      setLists((current) => current.map((item) => String(item.id) === String(value.item.id) ? value.item : item));
      notify(value.found ? `Found ${value.found}; repaired ${value.repaired}. Plex and overlays refreshed.` : "No missing trailers found.");
    } catch (error) { notify(message(error), "error"); } finally { setBusy(false); }
  }
  async function restoreArtwork(kind: "collection" | "titles") {
    if (!selected || !confirm(`Restore the original ${kind === "collection" ? "collection poster" : "title posters"} for “${selected.name}” and disable this design?`)) return;
    setBusy(true);
    try {
      const value = await request<{ item: ReeltrackList; restored: number }>(`/api/reeltrack/imported-lists/${encodeURIComponent(selected.id)}/artwork/${kind}/restore`, { method: "POST", body: "{}" });
      setLists((current) => current.map((item) => String(item.id) === String(value.item.id) ? value.item : item));
      if (kind === "collection") setCollectionPosterTemplate(null);
      else {
        setTitleOverlayTemplate(null);
        setExistingTitleOverlayTemplate(null);
        setRealTitleOverlayTemplate(null);
      }
      notify(`${value.restored} original ${kind === "collection" ? "collection poster" : "title poster"}${value.restored === 1 ? "" : "s"} restored.`);
    } catch (error) {
      notify(message(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function remove(list: ReeltrackList) {
    if (
      !confirm(
        `Remove “${list.name}” from VynodeArr? The Reeltrack list will not be deleted.`,
      )
    )
      return;
    try {
      await request(
        `/api/reeltrack/imported-lists/${encodeURIComponent(list.id)}`,
        { method: "DELETE" },
      );
      setLists((current) =>
        current.filter((item) => String(item.id) !== String(list.id)),
      );
      setSelectedId("");
      notify("Imported list removed.");
    } catch (error) {
      notify(message(error), "error");
    }
  }
  const items = useMemo(
    () =>
      (selected?.items || []).filter(
        (item) =>
          (filter === "all" ||
            (filter === "library" ? Boolean(item.library) : !item.library)) &&
          (!query.trim() ||
            `${item.title} ${item.year || ""} ${item.overview || ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      ),
    [selected, filter, query],
  );
  const mediaSections = useMemo(
    () => [
      {domain:"movie" as const,title:"Movies",description:"Movie titles use the selected movie destination, quality profile, and engine.",items:items.filter((item)=>item.domain==="movie")},
      {domain:"tv" as const,title:"Television",description:"Series use the selected television destination, quality profile, and engine.",items:items.filter((item)=>item.domain==="tv")},
    ].filter((section)=>section.items.length),
    [items],
  );
  const listCounts=(list:ReeltrackList)=>({movie:(list.items||[]).filter((item)=>item.domain==="movie").length,tv:(list.items||[]).filter((item)=>item.domain==="tv").length});
  return (
    <div className="react-reeltrack-lists">
      <header className="hero reeltrack-hero">
        <div>
          <span className="eyebrow">REELTRACK INTEGRATION</span>
          <h1>Lists</h1>
          <p className="lede">
            Bring your Reeltrack lists into VynodeArr, see what is already in
            your library, and request missing titles without unreliable title
            matching.
          </p>
        </div>
        <div className="reeltrack-hero-actions">
          {configured ? (
            <>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void sync()}
              >
                {busy ? "Working…" : "Sync lists"}
              </button>
              <button className="primary" onClick={() => void openImport()}>
                Import lists
              </button>
            </>
          ) : null}
        </div>
      </header>
      {!configured || manageConnection ? (
        <section className="panel reeltrack-connect">
          <div>
            <span className="eyebrow">REELTRACK CONNECTION</span>
            <h2>
              {configured
                ? "Replace your Reeltrack API key"
                : "Connect your Reeltrack account"}
            </h2>
            <p>
              Create or copy a personal API key in Reeltrack, then paste it
              here. This is the only place in VynodeArr where your Reeltrack key
              is entered. It is encrypted in VynodeArr’s backend and is never
              returned to this browser.
            </p>
            <div className="reeltrack-connect-links">
              <a
                href="https://reeltrack.vynodehub.com"
                target="_blank"
                rel="noreferrer"
              >
                Open Reeltrack
              </a>
              <a
                href="https://reeltrack.vynodehub.com/api/openapi"
                target="_blank"
                rel="noreferrer"
              >
                API documentation
              </a>
            </div>
          </div>
          <div className="reeltrack-key-form">
            <label>
              {configured ? "New Reeltrack API key" : "Reeltrack API key"}
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="rt_live_…"
                autoComplete="off"
              />
            </label>
            <div className="reeltrack-key-actions">
              {configured ? (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setApiKey("");
                    setManageConnection(false);
                  }}
                >
                  Cancel
                </button>
              ) : null}
              <button
                className="primary"
                disabled={busy || !apiKey.trim()}
                onClick={() => void connect()}
              >
                {busy
                  ? "Validating…"
                  : configured
                    ? "Replace and validate"
                    : "Connect and validate"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="reeltrack-connection-bar">
          <span>
            <i /> Reeltrack connected
          </span>
          <small>Credentials are stored securely on the server.</small>
          <a className="reeltrack-api-key-link" href="https://reeltrack.vynodehub.com" target="_blank" rel="noreferrer">Get your API key at reeltrack.vynodehub.com</a>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setManageConnection(true)}
          >
            Replace API key
          </button>
          <button
            className="text-button danger"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            Disconnect
          </button>
        </section>
      )}
      {options.administrator && trailerStatus ? (
        <section
          className={`reeltrack-trailer-status ${trailerStatus.available ? "ready" : "unavailable"}`}
        >
          <strong>
            {trailerStatus.available
              ? `Trailer downloads ready · yt-dlp ${trailerStatus.version || ""}`
              : "Trailer downloads unavailable"}
          </strong>
          <small>
            {trailerStatus.available
              ? `Staging folder: ${trailerStatus.root}`
              : trailerStatus.message}
          </small>
        </section>
      ) : null}
      {showImport ? (
        <section className="panel reeltrack-import">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CHOOSE LISTS</span>
              <h2>Import from Reeltrack</h2>
              <p>
                Importing copies a view of each list into VynodeArr. It does not
                alter the source list or sync anything to Plex. Configure artwork
                after import, then choose Save and apply settings when ready.
              </p>
            </div>
            <button className="secondary" onClick={() => setShowImport(false)}>
              Close
            </button>
          </div>
          <div className="reeltrack-remote-list">
            {available.map((list) => (
              <label key={list.id}>
                <input
                  type="checkbox"
                  checked={selectedRemote.has(String(list.id))}
                  onChange={(event) =>
                    setSelectedRemote((current) => {
                      const next = new Set(current);
                      event.target.checked
                        ? next.add(String(list.id))
                        : next.delete(String(list.id));
                      return next;
                    })
                  }
                />
                <span>
                  <strong>{list.name}</strong>
                  <small>
                    {list.description ||
                      `${list.kind === "smart" ? "Smart" : "Custom"} Reeltrack list`}
                  </small>
                </span>
                {list.imported ? <em>Imported</em> : null}
              </label>
            ))}
          </div>
          {options.administrator ? <div className="reeltrack-automation-setup"><strong>Configure after import</strong><small>VynodeArr will inspect each list, then show only its Movie, Television, or mixed destinations. Importing does not change Plex.</small></div> : null}
          <div className="form-actions">
            <button
              className="primary"
              disabled={
                busy || !selectedRemote.size
              }
              onClick={() => void importLists()}
            >
              {busy
                ? "Importing…"
                : `Import ${selectedRemote.size} list${selectedRemote.size === 1 ? "" : "s"}`}
            </button>
          </div>
        </section>
      ) : null}
      {loading ? (
        <div className="panel skeleton">Loading Reeltrack lists…</div>
      ) : lists.length ? (
        <div className="reeltrack-workspace">
          <nav className="reeltrack-list-nav" aria-label="Imported lists">
            <h2>Imported lists</h2>
            {lists.map((list) => (
              <button
                className={
                  String(list.id) === String(selected?.id) ? "active" : ""
                }
                key={list.id}
                onClick={() => setSelectedId(String(list.id))}
              >
                <strong>{list.name}</strong>
                <small>{listCounts(list).movie} movies · {listCounts(list).tv} TV</small>
              </button>
            ))}
          </nav>
          <main>
            <div className="reeltrack-list-heading">
              <div>
                <span className="eyebrow">
                  {selected?.kind === "smart" ? "SMART LIST" : "REELTRACK LIST"}
                </span>
                <h2>{selected?.name}</h2>
                <p>
                  {selected?.description || "Titles imported from Reeltrack."}
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => selected && void remove(selected)}
              >
                Remove import
              </button>
            </div>
            <nav className="reeltrack-list-sections" aria-label={`${selected?.name || "List"} sections`}>
              <button type="button" className={listPage === "titles" ? "active" : ""} aria-current={listPage === "titles" ? "page" : undefined} onClick={() => setListPage("titles")}><strong>List titles</strong><small>Browse movies and television from this list.</small></button>
              {options.administrator ? <button type="button" className={listPage === "automation" ? "active" : ""} aria-current={listPage === "automation" ? "page" : undefined} onClick={() => setListPage("automation")}><strong>Plex sync & overlays</strong><small>Configure destinations, trailers, collections and artwork.</small></button> : null}
            </nav>
            {options.administrator && listPage === "automation" ? (
              <section className="reeltrack-list-automation">
                <div className="reeltrack-list-automation-heading">
                  <div>
                    <span className="eyebrow">LIST AUTOMATION</span>
                    <strong>Keep this list in sync with Plex</strong>
                    <small>
                      {selected?.automation?.enabled
                        ? `${selected.automation.status || "scheduled"}${selected.automation.lastRunAt ? ` · Last run ${new Date(selected.automation.lastRunAt).toLocaleString()}` : ""}`
                        : "Set this up once and VynodeArr can maintain the collection for you."}
                    </small>
                  </div>
                  {selected?.automation?.enabled ? (
                    <div className="form-actions"><button className="secondary" disabled={busy} onClick={() => void repairTrailers()}>Find missing trailers</button><button className="secondary" disabled={busy} onClick={() => void runAutomation()}>{busy ? "Synchronizing…" : "Run now"}</button></div>
                  ) : null}
                </div>
                <label className="reeltrack-automation-toggle">
                  <input
                    type="checkbox"
                    checked={automationEnabled}
                    onChange={(event) => setAutomationEnabled(event.target.checked)}
                  />
                  <span><strong>1. Turn on automatic management</strong><small>Periodically refresh the Reeltrack list, register missing titles, manage trailers, and update the Plex collection.</small></span>
                </label>
                {automationEnabled ? (
                  <div className="reeltrack-automation-step">
                    <div className="reeltrack-step-heading"><span>2</span><div><strong>Choose where titles belong</strong><small>Choose the VynodeArr destination. Its linked Plex library and storage path are used automatically.</small></div></div>
                    <div className="reeltrack-automation-fields reeltrack-library-fields">
                    {selected?.items?.some((item) => item.domain === "movie") ? <div className="reeltrack-plex-target"><label><span>Movie destination</span><select value={movieMediaDestinationId} onChange={(event) => chooseMediaDestination("movie",event.target.value)}><option value="">Choose a movie destination</option>{mediaDestinations.filter((item) => item.domain === "movie").map((item) => <option key={item.id} value={item.id} disabled={!item.ready}>{item.engineInstanceName ? `${item.engineInstanceName} · ` : ""}{item.name}{item.isDefault ? " — default" : ""}{item.ready ? "" : " — unavailable"}</option>)}</select></label>{selectedMediaDestination("movie")?.plexLibraryKey ? <div><strong>Plex library</strong><span>{selectedMediaDestination("movie")?.plexLibrary?.title || "Linked library"}</span><small>Linked to this destination under Storage & Destinations.</small></div> : <label><span>Plex library</span><select value={automationMovieLibraryKey} onChange={(event) => setAutomationMovieLibraryKey(event.target.value)}><option value="">Choose a movie library</option>{(trailerStatus?.libraries || []).filter((library) => library.type === "movie").map((library) => <option key={library.key} value={library.key}>{library.title}</option>)}</select></label>}<small>Plex path: {rootCompatibility("movie").location || "not reported"} · VynodeArr path: {movieHostRoot}</small>{selectedMediaDestination("movie")?.vynodePath ? null : <button className="secondary" type="button" onClick={() => openHostBrowser("movie")}>Choose VynodeArr folder</button>}{automationMovieLibraryKey && !rootCompatibility("movie").compatible ? <div className="reeltrack-root-warning"><span>Movie storage still needs a compatible engine root.</span><a className="button-link secondary" href="#service/root-folders">Review folders</a></div> : <small className="reeltrack-root-ready">Ready</small>}</div> : null}
                    {selected?.items?.some((item) => item.domain === "tv") ? <div className="reeltrack-plex-target"><label><span>TV destination</span><select value={tvMediaDestinationId} onChange={(event) => chooseMediaDestination("tv",event.target.value)}><option value="">Choose a TV destination</option>{mediaDestinations.filter((item) => item.domain === "tv").map((item) => <option key={item.id} value={item.id} disabled={!item.ready}>{item.engineInstanceName ? `${item.engineInstanceName} · ` : ""}{item.name}{item.isDefault ? " — default" : ""}{item.ready ? "" : " — unavailable"}</option>)}</select></label>{selectedMediaDestination("tv")?.plexLibraryKey ? <div><strong>Plex library</strong><span>{selectedMediaDestination("tv")?.plexLibrary?.title || "Linked library"}</span><small>Linked to this destination under Storage & Destinations.</small></div> : <label><span>Plex library</span><select value={automationTvLibraryKey} onChange={(event) => setAutomationTvLibraryKey(event.target.value)}><option value="">Choose a television library</option>{(trailerStatus?.libraries || []).filter((library) => library.type === "show").map((library) => <option key={library.key} value={library.key}>{library.title}</option>)}</select></label>}<small>Plex path: {rootCompatibility("tv").location || "not reported"} · VynodeArr path: {tvHostRoot}</small>{selectedMediaDestination("tv")?.vynodePath ? null : <button className="secondary" type="button" onClick={() => openHostBrowser("tv")}>Choose VynodeArr folder</button>}{automationTvLibraryKey && !rootCompatibility("tv").compatible ? <div className="reeltrack-root-warning"><span>Television storage still needs a compatible engine root.</span><a className="button-link secondary" href="#service/root-folders">Review folders</a></div> : <small className="reeltrack-root-ready">Ready</small>}</div> : null}
                    </div>
                    <label className="reeltrack-automation-toggle reeltrack-split-library-toggle">
                      <input type="checkbox" checked={splitLibraryMode} onChange={(event) => setSplitLibraryMode(event.target.checked)} />
                      <span><strong>Use a separate placeholder library <em>Optional</em></strong><small>Keep trailer-only titles in a separate Plex library. Real media remains in the library selected above, and VynodeArr maintains a matching collection in each library.</small></span>
                    </label>
                    {splitLibraryMode ? <div className="reeltrack-automation-fields reeltrack-library-fields reeltrack-placeholder-fields">
                      {selected?.items?.some((item) => item.domain === "movie") ? <div className="reeltrack-plex-target"><label><span>Movie placeholder library</span><select value={moviePlaceholderLibraryKey} onChange={(event) => { const key=event.target.value,location=trailerStatus?.libraries?.find((library)=>library.key===key)?.locations?.[0]||"";setMoviePlaceholderLibraryKey(key);if(location.startsWith("/media/"))setMoviePlaceholderHostRoot(location); }}><option value="">Choose a different movie library</option>{(trailerStatus?.libraries || []).filter((library) => library.type === "movie" && library.key !== automationMovieLibraryKey).map((library) => <option key={library.key} value={library.key}>{library.title}</option>)}</select><small>Only trailer placeholders that do not have real media appear here. Map its own VynodeArr-visible folder below.</small><div className="storage-path-control"><input aria-label="Movie placeholder host folder" readOnly value={moviePlaceholderHostRoot}/><button className="secondary" type="button" onClick={() => openHostBrowser("moviePlaceholder")}>Choose folder</button></div></label></div> : null}
                      {selected?.items?.some((item) => item.domain === "tv") ? <div className="reeltrack-plex-target"><label><span>Television placeholder library</span><select value={tvPlaceholderLibraryKey} onChange={(event) => { const key=event.target.value,location=trailerStatus?.libraries?.find((library)=>library.key===key)?.locations?.[0]||"";setTvPlaceholderLibraryKey(key);if(location.startsWith("/media/"))setTvPlaceholderHostRoot(location); }}><option value="">Choose a different television library</option>{(trailerStatus?.libraries || []).filter((library) => library.type === "show" && library.key !== automationTvLibraryKey).map((library) => <option key={library.key} value={library.key}>{library.title}</option>)}</select><small>Only trailer placeholders that do not have real media appear here. Map its own VynodeArr-visible folder below.</small><div className="storage-path-control"><input aria-label="Television placeholder host folder" readOnly value={tvPlaceholderHostRoot}/><button className="secondary" type="button" onClick={() => openHostBrowser("tvPlaceholder")}>Choose folder</button></div></label></div> : null}
                    </div> : null}
                  </div>
                ) : null}
                {automationEnabled ? (
                  <div className="reeltrack-automation-step">
                    <div className="reeltrack-step-heading"><span>3</span><div><strong>Name it and choose a schedule</strong><small>This is the collection name people see in Plex. The schedule controls how often changes from Reeltrack are checked.</small></div></div>
                    <div className="reeltrack-automation-fields reeltrack-schedule-fields"><label>
                      <span>Collection name in Plex</span>
                      <input value={automationCollectionName} onChange={(event) => setAutomationCollectionName(event.target.value)} />
                    </label>
                    <label>
                      <span>Check for changes</span>
                      <select value={automationInterval} onChange={(event) => setAutomationInterval(Number(event.target.value))}>
                        <option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={360}>6 hours</option><option value={1440}>24 hours</option>
                      </select>
                    </label></div>
                  </div>
                ) : null}
                {automationEnabled ? <div className="reeltrack-automation-step"><div className="reeltrack-step-heading"><span>4</span><div><strong>Customize artwork <em>Optional</em></strong><small>Design one poster for the collection, or add an overlay to each title poster. Original Plex artwork is backed up before changes are applied.</small></div></div><div className="reeltrack-artwork-options">
                  <div className="reeltrack-artwork-option"><div><strong>Collection poster</strong><small>{collectionPosterTemplate ? `${collectionPosterTemplate.layers.length} layers · used only for ${selected.name}` : "A single poster displayed for this collection in Plex."}</small></div><div><button className="secondary" type="button" onClick={() => setPosterDesigner("collection")}>{collectionPosterTemplate ? "Edit design" : "Design poster"}</button>{selected?.automation?.collectionPosterTemplate ? <button className="text-button danger" disabled={busy} type="button" onClick={() => void restoreArtwork("collection")}>Restore original</button> : collectionPosterTemplate ? <button className="text-button danger" type="button" onClick={() => setCollectionPosterTemplate(null)}>Remove design</button> : null}</div></div>
                  <div className="reeltrack-artwork-option"><div><strong>Placeholder title overlay</strong><small>{titleOverlayTemplate ? `${titleOverlayTemplate.layers.length} layers · trailer placeholders only` : "Shown on trailer-only placeholders while the real movie or show is unavailable."}</small></div><div><button className="secondary" type="button" onClick={() => setPosterDesigner("title")}>{titleOverlayTemplate ? "Edit design" : "Design placeholder overlay"}</button>{selected?.automation?.titleOverlayTemplate ? <button className="text-button danger" disabled={busy} type="button" onClick={() => void restoreArtwork("titles")}>Restore all title artwork</button> : titleOverlayTemplate ? <button className="text-button danger" type="button" onClick={() => setTitleOverlayTemplate(null)}>Remove design</button> : null}</div></div>
                  <div className="reeltrack-artwork-option"><div><strong>Existing real-title overlay</strong><small>{existingTitleOverlayTemplate ? `${existingTitleOverlayTemplate.layers.length} layers · already in the real library` : "Optional. For real movies or shows already available when this list is first managed."}</small></div><div><button className="secondary" type="button" onClick={() => setPosterDesigner("existingTitle")}>{existingTitleOverlayTemplate ? "Edit design" : "Design existing-title overlay"}</button>{selected?.automation?.existingTitleOverlayTemplate ? <button className="text-button danger" disabled={busy} type="button" onClick={() => void restoreArtwork("titles")}>Restore all title artwork</button> : existingTitleOverlayTemplate ? <button className="text-button danger" type="button" onClick={() => setExistingTitleOverlayTemplate(null)}>Use fallback overlay</button> : null}</div></div>
                  <div className="reeltrack-artwork-option"><div><strong>Newly available title overlay</strong><small>{realTitleOverlayTemplate ? `${realTitleOverlayTemplate.layers.length} layers · downloaded after being a placeholder` : "Optional. For a managed placeholder that later becomes a real movie or show."}</small></div><div><button className="secondary" type="button" onClick={() => setPosterDesigner("realTitle")}>{realTitleOverlayTemplate ? "Edit design" : "Design newly-available overlay"}</button>{selected?.automation?.realTitleOverlayTemplate ? <button className="text-button danger" disabled={busy} type="button" onClick={() => void restoreArtwork("titles")}>Restore all title artwork</button> : realTitleOverlayTemplate ? <button className="text-button danger" type="button" onClick={() => setRealTitleOverlayTemplate(null)}>Use fallback overlay</button> : null}</div></div>
                </div></div> : null}
                {selected?.automation?.error ? <p className="danger-text">{selected.automation.error}</p> : null}
                {selected?.automation?.summary ? (
                  <div className="reeltrack-automation-results"><div><strong>Last sync results</strong><small>What VynodeArr found and changed during the most recent run.</small></div><div className="reeltrack-automation-summary">
                    <span><strong>{selected.automation.summary.providerTitles}</strong> list titles</span><span><strong>{selected.automation.summary.placeholders}</strong> Plex placeholders</span><span><strong>{selected.automation.summary.realMatches}</strong> real matches</span><span><strong>{selected.automation.summary.libraryAdded || 0}</strong> added</span><span><strong>{selected.automation.summary.libraryExisting || 0}</strong> registered</span>{selected.automation.summary.collectionPosters ? <span><strong>{selected.automation.summary.collectionPosters}</strong> collection posters applied</span> : null}{selected.automation.summary.collectionPosterFailures ? <span className="danger-text" title={selected.automation.summary.collectionPosterErrors?.join("\n")}><strong>{selected.automation.summary.collectionPosterFailures}</strong> collection poster failures</span> : null}{selected.automation.summary.titlePosters ? <span><strong>{selected.automation.summary.titlePosters}</strong> overlays applied</span> : null}{selected.automation.summary.titlePosterFailures ? <span className="danger-text" title={selected.automation.summary.titlePosterErrors?.join("\n")}><strong>{selected.automation.summary.titlePosterFailures}</strong> overlay failures</span> : null}{selected.automation.summary.libraryFailed ? <span className="danger-text"><strong>{selected.automation.summary.libraryFailed}</strong> library failures</span> : null}{selected.automation.summary.failed ? <span className="danger-text"><strong>{selected.automation.summary.failed}</strong> trailer failures</span> : null}
                  </div></div>
                ) : null}
                {selected?.automation?.libraryErrors?.length ? (
                  <small className="danger-text">{selected.automation.libraryErrors.join(" · ")}</small>
                ) : null}
                <button
                  className="primary"
                  disabled={busy || (automationEnabled && Boolean(selected?.items?.some((item) => item.domain === "movie")) && (!automationMovieLibraryKey || (splitLibraryMode && !moviePlaceholderLibraryKey))) || (automationEnabled && Boolean(selected?.items?.some((item) => item.domain === "tv")) && (!automationTvLibraryKey || (splitLibraryMode && !tvPlaceholderLibraryKey)))}
                  onClick={() => void saveAutomation()}
                >
                  Save and apply settings
                </button>
              </section>
            ) : null}
            {listPage === "titles" ? <><div className="reeltrack-filters">
              <label>
                Find titles
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search this list"
                />
              </label>
              <div role="group" aria-label="Availability filter">
                <button
                  className={filter === "all" ? "active" : ""}
                  onClick={() => setFilter("all")}
                >
                  All
                </button>
                <button
                  className={filter === "library" ? "active" : ""}
                  onClick={() => setFilter("library")}
                >
                  In library
                </button>
                <button
                  className={filter === "missing" ? "active" : ""}
                  onClick={() => setFilter("missing")}
                >
                  Missing
                </button>
              </div>
            </div>
            <div className="reeltrack-media-sections">
              {mediaSections.map((section) => <section className={`reeltrack-media-section ${section.domain}`} key={section.domain}>
                <div className="reeltrack-media-section-heading"><div><span className="eyebrow">{section.domain === "movie" ? "MOVIE ENGINE" : "TELEVISION ENGINE"}</span><h3>{section.title}</h3><p>{section.description}</p></div><strong>{section.items.length}</strong></div>
                <div className="reeltrack-item-grid">
              {section.items.map((item) => (
                <article key={`${item.source}:${item.externalId}`}>
                  <div className="reeltrack-poster">
                    <ReeltrackPoster item={item} />
                    <b>
                      {item.library
                        ? "IN LIBRARY"
                        : item.canRequest
                          ? "AVAILABLE TO REQUEST"
                          : "ID NEEDED"}
                    </b>
                  </div>
                  <div className="reeltrack-item-copy">
                    <small>
                      #{item.rank || "—"} ·{" "}
                      {item.domain === "movie" ? "Movie" : "Television"} ·{" "}
                      {item.year || "Year unknown"}
                    </small>
                    <h3>{item.title}</h3>
                    <p>
                      {item.overview || "No description supplied by Reeltrack."}
                    </p>
                    <code>
                      {item.source}:{item.externalId}
                    </code>
                  </div>
                  <footer>
                    {options.administrator && !item.library && item.tmdbId ? (
                      <button
                        className="secondary"
                        disabled={
                          !trailerStatus?.available || Boolean(trailerBusy)
                        }
                        title={
                          trailerStatus?.available
                            ? "Download the official YouTube trailer into its movie folder"
                            : trailerStatus?.message ||
                              "Trailer downloads are unavailable"
                        }
                        onClick={() => void downloadTrailer(item)}
                      >
                        {trailerBusy === `${item.domain}:${item.tmdbId}`
                          ? "Downloading trailer…"
                          : "Download trailer"}
                      </button>
                    ) : null}
                    {item.library && item.library.canView ? (
                      <a
                        className="secondary button-link"
                        href={`#${item.domain === "movie" ? "movie" : "series"}/${item.library.id}`}
                      >
                        View in library
                      </a>
                    ) : item.library ? (
                      <span className="muted">Already in library</span>
                    ) : item.canRequest ? (
                      <button
                        className="primary"
                        onClick={() => setRequesting(item)}
                      >
                        Request {item.domain === "movie" ? "movie" : "series"}
                      </button>
                    ) : (
                      <span
                        className="muted"
                        title={item.requestBlockReason || ""}
                      >
                        TMDB ID required
                      </span>
                    )}
                  </footer>
                </article>
              ))}
                </div>
              </section>)}
            </div>
            {!items.length ? (
              <div className="empty compact">
                <h3>No titles match this view</h3>
                <p>Try another availability filter or search.</p>
              </div>
            ) : null}</> : null}
          </main>
        </div>
      ) : configured ? (
        <div className="empty panel">
          <h2>No Reeltrack lists imported</h2>
          <p>Choose Import lists to bring selected lists into this page.</p>
          <button className="primary" onClick={() => void openImport()}>
            Import lists
          </button>
        </div>
      ) : null}
      {hostBrowser ? (
        <ModalPortal>
          <div className="root-folder-browser-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHostBrowser(null); }}>
            <section className="panel root-folder-browser" role="dialog" aria-modal="true" aria-label="Map Plex library to a host folder">
              <div className="panel-heading">
                <div><span className="eyebrow">MAP HOST FOLDER</span><h2>{hostBrowserPath}</h2><p className="muted">Choose the folder visible to VynodeArr that maps to this Plex library.</p></div>
                <button className="secondary" type="button" onClick={() => setHostBrowser(null)}>Cancel</button>
              </div>
              <div className="folder-browser-actions">
                <button className="secondary" type="button" disabled={cleanFolder(hostBrowserPath) === cleanFolder(hostBrowserRoot)} onClick={() => setHostBrowserPath(parentFolder(hostBrowserPath))}>← Parent</button>
                <button className="primary" type="button" onClick={() => { if (hostBrowser === "movie") setMovieHostRoot(hostBrowserPath); else if (hostBrowser === "tv") setTvHostRoot(hostBrowserPath); else if (hostBrowser === "moviePlaceholder") setMoviePlaceholderHostRoot(hostBrowserPath); else setTvPlaceholderHostRoot(hostBrowserPath); setHostBrowser(null); }}>Use this folder</button>
              </div>
              <div className="folder-browser-list">
                {hostBrowserError ? <div className="empty error-state"><p>{hostBrowserError}</p></div> : hostDirectories.length ? hostDirectories.map((folder) => <button className="folder-row" type="button" key={folder.path} onClick={() => setHostBrowserPath(cleanFolder(folder.path))}><span className="folder-icon">▰</span><span>{folder.name}</span><small>{folder.path}</small></button>) : <div className="empty compact"><p>No subfolders here. You can still use this folder.</p></div>}
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
      {posterDesigner && selected ? <Suspense fallback={null}><ReeltrackPosterDesigner
        mode={posterDesigner === "collection" ? "collection" : "title"}
        template={posterDesigner === "collection" ? collectionPosterTemplate : posterDesigner === "existingTitle" ? existingTitleOverlayTemplate : posterDesigner === "realTitle" ? realTitleOverlayTemplate : titleOverlayTemplate}
        collectionName={automationCollectionName || selected.name}
        titleCount={selected.items?.length || 0}
        sample={selected.items?.find((item) => item.tmdbId) as { domain: "movie" | "tv"; tmdbId?: number | null; title: string; year?: number | null } | undefined}
        samples={(selected.items || []) as Array<{ domain: "movie" | "tv"; tmdbId?: number | null; title: string; year?: number | null }>}
        request={request}
        onClose={() => setPosterDesigner(null)}
        onSave={(template) => { posterDesigner === "collection" ? setCollectionPosterTemplate(template) : posterDesigner === "existingTitle" ? setExistingTitleOverlayTemplate(template) : posterDesigner === "realTitle" ? setRealTitleOverlayTemplate(template) : setTitleOverlayTemplate(template); setPosterDesigner(null); notify("Artwork design ready. Save automation to apply it."); }}
      /></Suspense> : null}
      {requesting ? (
        <DiscoverRequest
          item={discoverItem(requesting)}
          options={options}
          onClose={() => setRequesting(null)}
          onRequested={() => {
            setRequesting(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
