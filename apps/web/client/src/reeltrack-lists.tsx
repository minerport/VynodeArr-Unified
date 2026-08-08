import { useEffect, useMemo, useState } from "react";
import { DiscoverRequest } from "./discover-request";
import type { DiscoverItem } from "./discover-types";
import type {
  ReeltrackList,
  ReeltrackListItem,
  ReeltrackListsMountOptions,
} from "./reeltrack-lists-types";
import "./react-reeltrack-lists.css";
import { ModalPortal } from "./modal-portal";

const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "VynodeArr could not complete this request.";
const cleanFolder = (value: string) => value === "/" ? "/" : value.replaceAll("\\", "/").replace(/\/+$/, "") || "/";
const parentFolder = (value: string) => cleanFolder(value).split("/").slice(0, -1).join("/") || "/";
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
    [movieHostRoot, setMovieHostRoot] = useState("/movies"),
    [tvHostRoot, setTvHostRoot] = useState("/tv"),
    [hostBrowser, setHostBrowser] = useState<"movie" | "tv" | null>(null),
    [hostBrowserPath, setHostBrowserPath] = useState("/"),
    [hostDirectories, setHostDirectories] = useState<Array<{ name: string; path: string }>>([]),
    [hostBrowserError, setHostBrowserError] = useState(""),
    [automationInterval, setAutomationInterval] = useState(60),
    [automationCollectionName, setAutomationCollectionName] = useState("");
  const selected =
    lists.find((value) => String(value.id) === selectedId) || lists[0];
  async function load() {
    setLoading(true);
    try {
      const [status, data, trailer] = await Promise.all([
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
      ]);
      setConfigured(status.configured);
      setLists(data.items || []);
      setTrailerStatus(trailer);
      setAutomationMovieLibraryKey((current) => current || trailer?.libraries?.find((item) => item.type === "movie")?.key || "");
      setAutomationTvLibraryKey((current) => current || trailer?.libraries?.find((item) => item.type === "show")?.key || "");
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
    setMovieHostRoot(selected.automation?.movieHostRoot || trailerStatus?.hostRoots?.movie || "/movies");
    setTvHostRoot(selected.automation?.tvHostRoot || trailerStatus?.hostRoots?.tv || "/tv");
    setAutomationInterval(selected.automation?.intervalMinutes || 60);
    setAutomationCollectionName(selected.automation?.collectionName || selected.name);
  }, [selectedId]);
  useEffect(() => {
    if (!hostBrowser) return;
    setHostBrowserError("");
    setHostDirectories([]);
    void request<{ directories?: Array<{ name: string; path: string }> }>(`/api/reeltrack/trailers/folders?domain=${hostBrowser}&path=${encodeURIComponent(hostBrowserPath)}`)
      .then((value) => setHostDirectories(value.directories || []))
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
            automation: options.administrator
              ? {
                  enabled: automationEnabled,
                  plexMovieLibraryKey: automationMovieLibraryKey,
                  plexTvLibraryKey: automationTvLibraryKey,
                  movieHostRoot,
                  tvHostRoot,
                  intervalMinutes: automationInterval,
                }
              : { enabled: false },
          }),
        },
      );
      setLists(value.items || []);
      setSelectedId(String(value.items?.[0]?.id || ""));
      setShowImport(false);
      notify("Reeltrack lists imported.");
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
  async function saveAutomation() {
    if (!selected) return;
    setBusy(true);
    try {
      const value = await request<{ item: ReeltrackList }>(
        `/api/reeltrack/imported-lists/${encodeURIComponent(selected.id)}/automation`,
        {
          method: "PUT",
          body: JSON.stringify({
            enabled: automationEnabled,
            plexMovieLibraryKey: automationMovieLibraryKey,
            plexTvLibraryKey: automationTvLibraryKey,
            movieHostRoot,
            tvHostRoot,
            collectionName: automationCollectionName || selected.name,
            intervalMinutes: automationInterval,
          }),
        },
      );
      setLists((current) =>
        current.map((item) =>
          String(item.id) === String(value.item.id) ? value.item : item,
        ),
      );
      notify(automationEnabled ? "Plex list automation enabled." : "Plex list automation disabled.");
    } catch (error) {
      notify(message(error), "error");
    } finally {
      setBusy(false);
    }
  }
  const selectedPlexLibrary = (domain: "movie" | "tv") => trailerStatus?.libraries?.find(
    (library) => library.key === (domain === "movie" ? automationMovieLibraryKey : automationTvLibraryKey),
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
  const openHostBrowser = (domain: "movie" | "tv") => {
    const path = domain === "movie" ? movieHostRoot : tvHostRoot;
    setHostBrowser(domain);
    setHostBrowserPath(cleanFolder(path || trailerStatus?.hostRoots?.[domain] || (domain === "movie" ? "/movies" : "/tv")));
  };
  async function runAutomation() {
    if (!selected) return;
    setBusy(true);
    try {
      const value = await request<{ item: ReeltrackList }>(
        `/api/reeltrack/imported-lists/${encodeURIComponent(selected.id)}/automation/run`,
        { method: "POST" },
      );
      setLists((current) =>
        current.map((item) =>
          String(item.id) === String(value.item.id) ? value.item : item,
        ),
      );
      notify("Reeltrack, trailers, and the Plex collection are synchronized.");
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
                alter the source list.
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
          {options.administrator ? (
            <div className="reeltrack-automation-setup">
              <label className="reeltrack-automation-toggle">
                <input
                  type="checkbox"
                  checked={automationEnabled}
                  onChange={(event) => setAutomationEnabled(event.target.checked)}
                />
                <span>
                  <strong>Create and maintain Plex trailer collections</strong>
                  <small>
                    Periodically sync each selected list, download trailers for missing titles,
                    and remove managed placeholders when the real media appears.
                  </small>
                </span>
              </label>
              {automationEnabled ? (
                <div className="reeltrack-automation-fields">
                  {(["movie", "show"] as const).map((type) => {
                    const domain = type === "movie" ? "movie" : "tv", value = domain === "movie" ? automationMovieLibraryKey : automationTvLibraryKey, compatibility = rootCompatibility(domain);
                    return <div className="reeltrack-plex-target" key={type}><label>
                      {type === "movie" ? "Movie" : "Television"} Plex library
                      <select value={value} onChange={(event) => type === "movie" ? setAutomationMovieLibraryKey(event.target.value) : setAutomationTvLibraryKey(event.target.value)}>
                        <option value="">Choose a {type === "movie" ? "movie" : "television"} library</option>
                        {(trailerStatus?.libraries || []).filter((library) => library.type === type).map((library) => <option key={library.key} value={library.key}>{library.title}</option>)}
                      </select>
                      {value ? <small>Plex reference: {compatibility.location || "not reported"}</small> : null}
                      {value ? <div className="storage-path-control"><input aria-label={`${domain} host folder`} readOnly value={compatibility.hostRoot}/><button className="secondary" type="button" onClick={() => openHostBrowser(domain)}>Choose host folder</button></div> : null}
                    </label>{value && !compatibility.compatible ? <div className="reeltrack-root-warning"><span>This media engine has no configured root. Configure its own path under Storage Folders; it may differ from both paths shown above.</span><a className="button-link secondary" href="#service/root-folders">Review storage folders</a></div> : value ? <small className="reeltrack-root-ready">Plex, host, and engine paths are mapped independently</small> : null}</div>;
                  })}
                  <label>
                    Update every
                    <select
                      value={automationInterval}
                      onChange={(event) => setAutomationInterval(Number(event.target.value))}
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={360}>6 hours</option>
                      <option value={1440}>24 hours</option>
                    </select>
                  </label>
                </div>
              ) : null}
              {automationEnabled && (!trailerStatus?.available || !trailerStatus?.plexConfigured) ? (
                <p className="danger-text">
                  {!trailerStatus?.available
                    ? trailerStatus?.message || "yt-dlp is unavailable."
                    : "Connect Plex in Poster Overlays before enabling automation."}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="form-actions">
            <button
              className="primary"
              disabled={
                busy ||
                !selectedRemote.size ||
                (automationEnabled &&
                  (!trailerStatus?.available ||
                    !trailerStatus?.plexConfigured))
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
          <aside className="reeltrack-list-nav">
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
                <small>{list.items?.length || 0} titles</small>
              </button>
            ))}
          </aside>
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
            {options.administrator ? (
              <section className="reeltrack-list-automation">
                <div className="reeltrack-list-automation-heading">
                  <div>
                    <strong>Managed Plex collection</strong>
                    <small>
                      {selected?.automation?.enabled
                        ? `${selected.automation.status || "scheduled"}${selected.automation.lastRunAt ? ` · Last run ${new Date(selected.automation.lastRunAt).toLocaleString()}` : ""}`
                        : "Not enabled for this imported list"}
                    </small>
                  </div>
                  {selected?.automation?.enabled ? (
                    <button className="secondary" disabled={busy} onClick={() => void runAutomation()}>
                      {busy ? "Synchronizing…" : "Run now"}
                    </button>
                  ) : null}
                </div>
                <label className="reeltrack-automation-toggle">
                  <input
                    type="checkbox"
                    checked={automationEnabled}
                    onChange={(event) => setAutomationEnabled(event.target.checked)}
                  />
                  Automatically sync this list, trailers, and Plex
                </label>
                {automationEnabled ? (
                  <div className="reeltrack-automation-fields">
                    {selected?.items?.some((item) => item.domain === "movie") ? <div className="reeltrack-plex-target"><label>
                      Movie Plex library
                      <select value={automationMovieLibraryKey} onChange={(event) => setAutomationMovieLibraryKey(event.target.value)}>
                        <option value="">Choose a movie library</option>
                        {(trailerStatus?.libraries || []).filter((library) => library.type === "movie").map((library) => <option key={library.key} value={library.key}>{library.title}</option>)}
                      </select>
                      <small>Plex reference: {rootCompatibility("movie").location || "not reported"}</small>
                      <div className="storage-path-control"><input aria-label="Movie host folder" readOnly value={movieHostRoot}/><button className="secondary" type="button" onClick={() => openHostBrowser("movie")}>Choose host folder</button></div>
                    </label>{automationMovieLibraryKey && !rootCompatibility("movie").compatible ? <div className="reeltrack-root-warning"><span>The Movie engine needs its own configured root, which may use a different path.</span><a className="button-link secondary" href="#service/root-folders">Review storage folders</a></div> : <small className="reeltrack-root-ready">Plex, host, and engine paths are mapped independently</small>}</div> : null}
                    {selected?.items?.some((item) => item.domain === "tv") ? <div className="reeltrack-plex-target"><label>
                      Television Plex library
                      <select value={automationTvLibraryKey} onChange={(event) => setAutomationTvLibraryKey(event.target.value)}>
                        <option value="">Choose a television library</option>
                        {(trailerStatus?.libraries || []).filter((library) => library.type === "show").map((library) => <option key={library.key} value={library.key}>{library.title}</option>)}
                      </select>
                      <small>Plex reference: {rootCompatibility("tv").location || "not reported"}</small>
                      <div className="storage-path-control"><input aria-label="Television host folder" readOnly value={tvHostRoot}/><button className="secondary" type="button" onClick={() => openHostBrowser("tv")}>Choose host folder</button></div>
                    </label>{automationTvLibraryKey && !rootCompatibility("tv").compatible ? <div className="reeltrack-root-warning"><span>The Television engine needs its own configured root, which may use a different path.</span><a className="button-link secondary" href="#service/root-folders">Review storage folders</a></div> : <small className="reeltrack-root-ready">Plex, host, and engine paths are mapped independently</small>}</div> : null}
                    <label>
                      Collection name
                      <input value={automationCollectionName} onChange={(event) => setAutomationCollectionName(event.target.value)} />
                    </label>
                    <label>
                      Interval
                      <select value={automationInterval} onChange={(event) => setAutomationInterval(Number(event.target.value))}>
                        <option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={360}>6 hours</option><option value={1440}>24 hours</option>
                      </select>
                    </label>
                  </div>
                ) : null}
                {selected?.automation?.error ? <p className="danger-text">{selected.automation.error}</p> : null}
                {selected?.automation?.summary ? (
                  <div className="reeltrack-automation-summary">
                    <span><strong>{selected.automation.summary.providerTitles}</strong> list titles</span><span><strong>{selected.automation.summary.placeholders}</strong> Plex placeholders</span><span><strong>{selected.automation.summary.realMatches}</strong> real matches</span><span><strong>{selected.automation.summary.libraryAdded || 0}</strong> added</span><span><strong>{selected.automation.summary.libraryExisting || 0}</strong> registered</span>{selected.automation.summary.libraryFailed ? <span className="danger-text"><strong>{selected.automation.summary.libraryFailed}</strong> library failures</span> : null}{selected.automation.summary.failed ? <span className="danger-text"><strong>{selected.automation.summary.failed}</strong> trailer failures</span> : null}
                  </div>
                ) : null}
                {selected?.automation?.libraryErrors?.length ? (
                  <small className="danger-text">{selected.automation.libraryErrors.join(" · ")}</small>
                ) : null}
                <button
                  className="primary"
                  disabled={busy || (automationEnabled && Boolean(selected?.items?.some((item) => item.domain === "movie")) && !automationMovieLibraryKey) || (automationEnabled && Boolean(selected?.items?.some((item) => item.domain === "tv")) && !automationTvLibraryKey)}
                  onClick={() => void saveAutomation()}
                >
                  Save automation
                </button>
              </section>
            ) : null}
            <div className="reeltrack-filters">
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
            <div className="reeltrack-item-grid">
              {items.map((item) => (
                <article key={`${item.source}:${item.externalId}`}>
                  <div className="reeltrack-poster">
                    {item.posterUrl ? (
                      <img src={item.posterUrl} alt="" loading="lazy" />
                    ) : (
                      <span>{item.domain === "movie" ? "MOVIE" : "TV"}</span>
                    )}
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
            {!items.length ? (
              <div className="empty compact">
                <h3>No titles match this view</h3>
                <p>Try another availability filter or search.</p>
              </div>
            ) : null}
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
                <div><span className="eyebrow">MAP HOST FOLDER</span><h2>{hostBrowserPath}</h2><p className="muted">Plex reports {rootCompatibility(hostBrowser).location || "no path"}. Choose the corresponding folder visible to VynodeArr.</p></div>
                <button className="secondary" type="button" onClick={() => setHostBrowser(null)}>Cancel</button>
              </div>
              <div className="folder-browser-actions">
                <button className="secondary" type="button" disabled={cleanFolder(hostBrowserPath) === cleanFolder(trailerStatus?.hostRoots?.[hostBrowser] || (hostBrowser === "movie" ? "/movies" : "/tv"))} onClick={() => setHostBrowserPath(parentFolder(hostBrowserPath))}>← Parent</button>
                <button className="primary" type="button" onClick={() => { hostBrowser === "movie" ? setMovieHostRoot(hostBrowserPath) : setTvHostRoot(hostBrowserPath); setHostBrowser(null); }}>Use this folder</button>
              </div>
              <div className="folder-browser-list">
                {hostBrowserError ? <div className="empty error-state"><p>{hostBrowserError}</p></div> : hostDirectories.length ? hostDirectories.map((folder) => <button className="folder-row" type="button" key={folder.path} onClick={() => setHostBrowserPath(cleanFolder(folder.path))}><span className="folder-icon">▰</span><span>{folder.name}</span><small>{folder.path}</small></button>) : <div className="empty compact"><p>No subfolders here. You can still use this folder.</p></div>}
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
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
