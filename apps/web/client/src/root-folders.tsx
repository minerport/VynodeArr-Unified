import { useCallback, useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { MigrationDialogProps } from "./root-folder-migration-dialog";
import type { AvailableLibraryFoldersResponse, Directory, DownloadFolders, MediaDestination, MediaDestinationResponse, PathMigrationPreview, RootFolder, RootFoldersMountOptions, StorageDomain } from "./root-folders-types";
import { ServiceTabs } from "./service-tabs";
import { LibraryImportReview } from "./library-import-review";
import { ModalPortal } from "./modal-portal";

const clean = (value: string) => (value === "/" ? "/" : value.replace(/\/+$/, "") || "/");
const parent = (value: string) => clean(value).split("/").slice(0, -1).join("/") || "/";
const size = (bytes = 0) => {
  const gb = bytes / 1073741824;
  return gb >= 1024 ? `${(gb / 1024).toFixed(gb >= 10240 ? 0 : 1)} TB` : `${Math.round(gb)} GB`;
};
const message = (reason: unknown) => (reason instanceof Error ? reason.message : "Storage settings are unavailable.");
export function RootFoldersView({ options }: { options: RootFoldersMountOptions }) {
  const [domain, setDomain] = useState<StorageDomain>("movie"),
    [roots, setRoots] = useState<RootFolder[]>([]),
    [downloads, setDownloads] = useState<DownloadFolders>({}),
    [destinations, setDestinations] = useState<MediaDestination[]>([]),
    [destinationData, setDestinationData] = useState<MediaDestinationResponse | null>(null),
    [editingDestination, setEditingDestination] = useState<MediaDestination | null>(null),
    [availableFolders, setAvailableFolders] = useState<AvailableLibraryFoldersResponse | null>(null),
    [rootPath, setRootPath] = useState("/movies"),
    [downloadPath, setDownloadPath] = useState("/downloads"),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [browser, setBrowser] = useState<null | "root" | "download" | "destination">(null),
    [scanRoot, setScanRoot] = useState<RootFolder | null>(null),
    [migration, setMigration] = useState<{ root: RootFolder; preview: PathMigrationPreview } | null>(null),
    [MigrationDialog, setMigrationDialog] = useState<ComponentType<MigrationDialogProps> | null>(null),
    [current, setCurrent] = useState("/"),
    [directories, setDirectories] = useState<Directory[]>([]),
    [browseError, setBrowseError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rootValue, downloadValue, destinationValue, availableValue] = await Promise.all([options.request<{ result: RootFolder[] }>(`/api/manage/${domain}/rootFolders`), options.request<DownloadFolders>("/api/settings/download-folders"), options.request<MediaDestinationResponse>(`/api/media-destinations?domain=${domain}&includeUsage=true`), options.request<AvailableLibraryFoldersResponse>("/api/storage/available-library-folders")]);
      setRoots(rootValue.result || []);
      setDownloads(downloadValue || {});
      setDestinationData(destinationValue);
      setDestinations(destinationValue.destinations || []);
      setAvailableFolders(availableValue);
      setDownloadPath(clean(downloadValue?.[domain]?.path || "/downloads"));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setLoading(false);
    }
  }, [domain, options]);
  useEffect(() => {
    setRootPath(domain === "movie" ? "/movies" : "/tv");
    void load();
  }, [domain, load]);
  const openBrowser = (target: "root" | "download" | "destination") => {
    const start = target === "download" ? downloadPath : target === "destination" ? editingDestination?.rootFolderPath || rootPath : rootPath;
    setBrowser(target);
    setCurrent(clean(start));
  };
  useEffect(() => {
    if (!browser) return;
    setBrowseError("");
    setDirectories([]);
    void options
      .request<{ result: { directories?: Directory[] } }>(`/api/manage/${domain}/filesystem?path=${encodeURIComponent(current)}&includeFiles=false&allowFoldersWithoutTrailingSlashes=true`)
      .then((value) => setDirectories(value.result?.directories || []))
      .catch((reason) => setBrowseError(message(reason)));
  }, [browser, current, domain, options]);
  const saveDownload = async () => {
    setBusy("download");
    try {
      await options.request("/api/settings/download-folders", {
        method: "PUT",
        body: JSON.stringify({ domain, path: downloadPath }),
      });
      setDownloads((value) => ({ ...value, [domain]: { path: downloadPath } }));
      options.notify(`${domain === "movie" ? "Movie" : "Television"} download folder saved.`);
    } catch (reason) {
      options.notify(message(reason), "error");
    } finally {
      setBusy("");
    }
  };
  const addRoot = async () => {
    setBusy("root");
    try {
      await options.request(`/api/manage/${domain}/rootFolders`, {
        method: "POST",
        body: JSON.stringify({ path: rootPath }),
      });
      options.notify("Library folder added.");
      await load();
    } catch (reason) {
      options.notify(message(reason), "error");
    } finally {
      setBusy("");
    }
  };
  const addDestinationRoot = async (path: string) => {
    setBusy("destination-root");
    try {
      await options.request(`/api/manage/${domain}/rootFolders`, {
        method: "POST",
        body: JSON.stringify({ path }),
      });
      setEditingDestination((value) => (value ? { ...value, rootFolderPath: path } : value));
      setBrowser(null);
      options.notify("Library folder added. Finish the destination settings, then save.");
      await load();
    } catch (reason) {
      options.notify(message(reason), "error");
    } finally {
      setBusy("");
    }
  };
  const registerAvailableFolder = async (path: string, targetDomain: StorageDomain = domain) => {
    setBusy(`available-${targetDomain}-${path}`);
    try {
      await options.request(`/api/manage/${targetDomain}/rootFolders`, { method: "POST", body: JSON.stringify({ path }) });
      options.notify(`${path} registered with the ${targetDomain === "movie" ? "movie" : "television"} engine. Set up its Media Destination below.`);
      await load();
    } catch (reason) {
      options.notify(message(reason), "error");
    } finally {
      setBusy("");
    }
  };
  const remove = async (root: RootFolder) => {
    if (!confirm(`Remove ${root.path} as a library folder? Media files will not be deleted.`)) return;
    setBusy(String(root.id));
    try {
      await options.request(`/api/manage/${domain}/rootFolders/${root.id}`, {
        method: "DELETE",
      });
      options.notify("Library folder removed.");
      await load();
    } catch (reason) {
      options.notify(message(reason), "error");
    } finally {
      setBusy("");
    }
  };
  const newDestination = () => {
    const used = new Set(destinations.filter((item) => !item.discovered).map((item) => clean(item.rootFolderPath))),
      root = roots.find((item) => !used.has(clean(item.path))) || roots[0];
    setEditingDestination({
      id: "",
      domain,
      name: "",
      rootFolderPath: root?.path || "",
      qualityProfileId: Number(destinationData?.profiles?.[domain]?.[0]?.id || 0),
      isDefault: !destinations.length,
      administratorOnly: false,
      minimumAvailability: "announced",
      monitor: "all",
      seriesType: "standard",
      plexLibraryKey: null,
    });
  };
  const saveDestination = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingDestination) return;
    setBusy("destination");
    try {
      const method = editingDestination.id && !editingDestination.discovered ? "PUT" : "POST",
        path = method === "PUT" ? `/api/media-destinations/${editingDestination.id}` : "/api/media-destinations",
        payload = {
          ...editingDestination,
          id: method === "POST" ? undefined : editingDestination.id,
        };
      await options.request(path, { method, body: JSON.stringify(payload) });
      options.notify(`${editingDestination.name} saved. Future additions will use its configured defaults.`);
      setEditingDestination(null);
      await load();
    } catch (reason) {
      options.notify(message(reason), "error");
    } finally {
      setBusy("");
    }
  };
  const removeDestination = async (destination: MediaDestination) => {
    if (destination.discovered) {
      setEditingDestination(destination);
      return;
    }
    if (!confirm(`Remove ${destination.name}? Existing media and engine root folders will not be changed.`)) return;
    setBusy(`destination-${destination.id}`);
    try {
      await options.request(`/api/media-destinations/${destination.id}`, {
        method: "DELETE",
      });
      options.notify("Media destination removed. Existing media was not changed.");
      await load();
    } catch (reason) {
      options.notify(message(reason), "error");
    } finally {
      setBusy("");
    }
  };
  const makeDefault = async (destination: MediaDestination) => {
    if (destination.discovered) { setEditingDestination({ ...destination, isDefault: true }); return; }
    setBusy(`default-${destination.id}`);
    try {
      await options.request(`/api/media-destinations/${destination.id}`, { method: "PUT", body: JSON.stringify({ ...destination, isDefault: true }) });
      options.notify(`${destination.name} is now the default ${domain === "movie" ? "movie" : "television"} destination.`);
      await load();
    } catch (reason) { options.notify(message(reason), "error"); }
    finally { setBusy(""); }
  };
  const reviewScan = async (root: RootFolder) => {
    setBusy(`scan-${root.id}`);
    try {
      const { reviewPathMigration } = await import("./root-folder-migration");
      const preview = await reviewPathMigration(options, domain, root);
      if (preview.equivalent && preview.match) {
        const dialog = await import("./root-folder-migration-dialog");
        setMigrationDialog(() => dialog.default);
        setMigration({ root, preview });
      }
      else setScanRoot(root);
    } catch (reason) {
      options.notify(message(reason), "error");
    } finally {
      setBusy("");
    }
  };
  const migratePaths = async () => {
    const match = migration?.preview.match;
    if (!migration || !match) return;
    setBusy("migration");
    try {
      const { applyPathMigration } = await import("./root-folder-migration");
      const result = await applyPathMigration(options, domain, match);
      options.notify(`${result.updated} existing ${domain === "movie" ? "movie" : "television"} location${result.updated === 1 ? "" : "s"} updated. No files were moved.`);
      setMigration(null);
      await load();
    } catch (reason) {
      options.notify(message(reason), "error");
    } finally {
      setBusy("");
    }
  };
  const samePath = clean(rootPath) === clean(downloadPath);
  const directMappings = (availableFolders?.folders || []).filter((item) => item.domain === domain), mediaChildren = availableFolders?.mediaChildren || [];
  return (
    <div className="root-folders-react-route">
      <div className="hero storage-hero">
        <div>
          <span className="eyebrow">SERVICE SETTINGS</span>
          <h1>Storage Folders</h1>
          <p className="lede">Separate completed downloads from the permanent, organized media library.</p>
        </div>
      </div>
      <ServiceTabs active="root-folders" />
      <section className="storage-engine-bar">
        <div>
          <span className="eyebrow">CONFIGURING</span>
          <strong>{domain === "movie" ? "Movies" : "Television"} storage</strong>
        </div>
        <label>
          Media engine
          <select value={domain} onChange={(event) => setDomain(event.target.value as StorageDomain)}>
            <option value="movie">Movies</option>
            <option value="tv">Television</option>
          </select>
        </label>
      </section>
      {samePath ? (
        <div className="notice storage-warning">
          <strong>Download and library paths match</strong>
          <p>Choose separate paths so completed downloads remain isolated until the engine imports and organizes them.</p>
        </div>
      ) : null}
      {error ? (
        <div className="panel error-state">
          <h2>Storage settings unavailable</h2>
          <p>{error}</p>
          <button className="secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : (
        <div className="storage-config-grid">
          <section className="panel storage-folder-card">
            <div className="storage-card-heading">
              <span className="storage-card-icon">↓</span>
              <div>
                <span className="eyebrow">INCOMING MEDIA</span>
                <h2>Download folder</h2>
                <p>The completed-download staging folder this engine reads before import.</p>
              </div>
              <span className="badge green">{downloads[domain]?.path ? "Configured" : "Required"}</span>
            </div>
            <div className="storage-path-control">
              <label>
                Current folder
                <input readOnly value={downloadPath} />
              </label>
              <button className="secondary" onClick={() => openBrowser("download")}>
                Choose folder
              </button>
            </div>
            <div className="storage-card-footer">
              <small>VynodeArr maintains the engine path mapping automatically.</small>
              <button className="primary" disabled={busy === "download" || samePath} onClick={() => void saveDownload()}>
                {busy === "download" ? "Saving…" : "Save download folder"}
              </button>
            </div>
          </section>
          <section className="panel storage-folder-card">
            <div className="storage-card-heading">
              <span className="storage-card-icon">▰</span>
              <div>
                <span className="eyebrow">ORGANIZED MEDIA</span>
                <h2>Library folders</h2>
                <p>Permanent destinations for renamed and organized {domain === "movie" ? "movies" : "series"}.</p>
              </div>
              <span className="badge">{roots.length}</span>
            </div>
            <div className="storage-add-form">
              <div className="storage-path-control">
                <label>
                  New library folder
                  <input readOnly value={rootPath} />
                </label>
                <button className="secondary" onClick={() => openBrowser("root")}>
                  Choose folder
                </button>
              </div>
              <button className="primary" disabled={busy === "root" || samePath} onClick={() => void addRoot()}>
                {busy === "root" ? "Adding…" : "Add library folder"}
              </button>
            </div>
            <div className="storage-root-list">
              {loading ? (
                <div className="skeleton">Loading folders…</div>
              ) : roots.length ? (
                roots.map((root) => (
                  <article className="storage-path-row" key={root.id}>
                    <span className={`storage-path-state ${root.accessible ? "available" : "unavailable"}`} />
                    <div className="storage-path-copy">
                      <strong>{root.path}</strong>
                      <small>
                        {root.accessible ? "Accessible" : "Not accessible"} · {size(root.freeSpace)} free
                      </small>
                      {root.unmappedFolders?.length ? (
                        <small>
                          {root.unmappedFolders.length} unimported folder
                          {root.unmappedFolders.length === 1 ? "" : "s"} ready to review
                        </small>
                      ) : (
                        <small>Library is fully reviewed</small>
                      )}
                    </div>
                    <div className="storage-path-actions">
                      {root.accessible ? (
                        <button className="secondary" disabled={busy === `scan-${root.id}`} onClick={() => void reviewScan(root)}>
                          {busy === `scan-${root.id}` ? "Checking…" : "Scan library"}
                        </button>
                      ) : null}
                      <button className="text-button" disabled={busy === String(root.id)} onClick={() => void remove(root)}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty compact">
                  <h3>No library folders yet</h3>
                  <p>Choose a folder above to create the first organized destination.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      <section className="panel available-library-mappings">
        <div className="panel-heading"><div><span className="eyebrow">UNRAID CONTAINER PATHS</span><h2>Configured library mappings</h2><p className="muted">Unraid controls which host folders are visible here. VynodeArr only registers visible folders with the selected engine; it never edits the container configuration.</p></div></div>
        <div className="available-mapping-list">
          {directMappings.map(item=><article className="storage-path-row" key={item.path}><span className={`storage-path-state ${item.registered?'available':item.configured?'pending':'unavailable'}`}/><div className="storage-path-copy"><strong>{item.label}</strong><small>{item.path}</small><small>{item.registered?'Ready and registered with this engine.':item.configured?'Visible to VynodeArr and ready to register.':'This backward-compatible container path is not currently mapped.'}</small></div>{item.configured&&!item.registered?<button className="primary" disabled={busy===`available-${domain}-${item.path}`} onClick={()=>void registerAvailableFolder(item.path)}>{busy===`available-${domain}-${item.path}`?'Registering…':`Use for ${domain==='movie'?'Movies':'Television'}`}</button>:null}</article>)}
        </div>
        <div className="main-media-folders"><div className="panel-heading"><div><h3>Main media folder</h3><p className="muted">{availableFolders?.mainMediaConfigured?'Each row is one direct child of /media. Assign it once to Movies or Television; VynodeArr will register that folder with the chosen engine.':'Map your shared host media folder to /media in the VynodeArr container, apply the change, and return here.'}</p></div><span className="badge">/media</span></div>{availableFolders?.mainMediaConfigured?(mediaChildren.length?<div className="available-mapping-list">{mediaChildren.map(item=>{const assigned=item.registeredMovie?'Movies':item.registeredTv?'Television':null;return <article className="storage-path-row" key={item.path}><span className={`storage-path-state ${assigned?'available':'pending'}`}/><div className="storage-path-copy"><strong>{item.label}</strong><small>{item.path}</small><small>{assigned?`Assigned to ${assigned} and registered with that engine.`:'Choose which engine should manage new media stored in this folder.'}</small></div>{!assigned?<div className="button-row"><button className="secondary" disabled={busy===`available-movie-${item.path}`||Boolean(busy)} onClick={()=>void registerAvailableFolder(item.path,'movie')}>{busy===`available-movie-${item.path}`?'Registering…':'Use for Movies'}</button><button className="secondary" disabled={busy===`available-tv-${item.path}`||Boolean(busy)} onClick={()=>void registerAvailableFolder(item.path,'tv')}>{busy===`available-tv-${item.path}`?'Registering…':'Use for Television'}</button></div>:null}</article>;})}</div>:<div className="empty compact"><p>No direct child folders were found beneath /media. Create the library folders on the host, then refresh this page.</p></div>):null}</div>
        <div className="notice"><strong>Folder outside the main media parent?</strong><p>Add a custom Docker path mapping in the Unraid container, apply the change, then use the library-folder browser above to register that container path with the selected engine.</p></div>
      </section>
      <section className="panel media-destinations-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">SIMPLE ADDING</span>
            <h2>Media destinations</h2>
            <p className="muted">Bundle a friendly name, folder, quality profile, and optional Plex library. Existing media is never moved when you edit these settings.</p>
          </div>
          <button className="primary" disabled={!roots.length || !destinationData?.profiles?.[domain]?.length} onClick={newDestination}>
            New destination
          </button>
        </div>
        {!destinations.length ? (
          <div className="empty compact">
            <h3>No destinations configured</h3>
            <p>Add an engine root folder and quality profile first.</p>
          </div>
        ) : (
          <div className="media-destination-list">
            {destinations.map((destination) => (
              <article className="media-destination-card" key={destination.id}>
                <span className={`storage-path-state ${destination.ready ? "available" : "unavailable"}`} />
                <div>
                  <div className="destination-title">
                    <strong>{destination.name}</strong>
                    {destination.isDefault ? <span className="badge green">Default</span> : null}
                    {destination.administratorOnly ? <span className="badge">Administrators</span> : null}
                  </div>
                  <small>
                    {destination.rootFolderPath} · {destination.qualityProfile?.name || "Profile unavailable"}
                  </small>
                  <small>{destination.plexLibrary ? `Plex: ${destination.plexLibrary.title}` : destination.suggestedPlexLibrary ? `Suggested Plex match: ${destination.suggestedPlexLibrary.title}` : "Plex association optional"}</small>
                  {destination.restartRequired ? (
                    <p className="destination-restart">
                      <strong>Container update required</strong> Assign this folder in the Unraid container settings, click Apply, then return here after VynodeArr starts.
                    </p>
                  ) : null}
                </div>
                <div className="storage-path-actions">
                  <button className="secondary" onClick={() => setEditingDestination(destination)}>
                    {destination.discovered ? "Set up" : "Edit"}
                  </button>
                  {!destination.isDefault ? <button className="secondary" disabled={busy === `default-${destination.id}`} onClick={() => void makeDefault(destination)}>{busy === `default-${destination.id}` ? "Saving…" : "Make default"}</button> : null}
                  {!destination.discovered ? (
                    <button className="text-button" disabled={busy === `destination-${destination.id}`} onClick={() => void removeDestination(destination)}>
                      Remove
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {editingDestination ? (
        <ModalPortal>
          <div
            className="root-folder-browser-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setEditingDestination(null);
            }}
          >
            <form className="panel media-destination-editor" role="dialog" aria-modal="true" onSubmit={(event) => void saveDestination(event)}>
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">MEDIA DESTINATION</span>
                  <h2>{editingDestination.id && !editingDestination.discovered ? "Edit destination" : "Create destination"}</h2>
                  <p className="muted">This controls future additions only. It does not move existing media.</p>
                </div>
                <button type="button" className="secondary" onClick={() => setEditingDestination(null)}>
                  Close
                </button>
              </div>
              <label>
                Friendly name
                <input
                  required
                  maxLength={80}
                  value={editingDestination.name}
                  onChange={(event) =>
                    setEditingDestination({
                      ...editingDestination,
                      name: event.target.value,
                    })
                  }
                  placeholder={domain === "movie" ? "4K Movies" : "Anime"}
                />
              </label>
              <div className="destination-folder-field">
                <label>
                  Library folder
                  <select
                    required
                    value={editingDestination.rootFolderPath}
                    onChange={(event) =>
                      setEditingDestination({
                        ...editingDestination,
                        rootFolderPath: event.target.value,
                      })
                    }
                  >
                    {roots.map((root) => (
                      <option value={root.path} key={root.id}>
                        {root.path}
                        {root.accessible === false ? " — access required" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="secondary" onClick={()=>openBrowser('destination')}>Use another visible folder</button><small>Only folders already exposed through the Unraid container configuration can be registered here.</small>
              </div>
              <label>
                Quality profile
                <select
                  required
                  value={editingDestination.qualityProfileId}
                  onChange={(event) =>
                    setEditingDestination({
                      ...editingDestination,
                      qualityProfileId: Number(event.target.value),
                    })
                  }
                >
                  {(destinationData?.profiles?.[domain] || []).map((profile) => (
                    <option value={profile.id} key={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              {domain === "movie" ? (
                <label>
                  Availability
                  <select
                    value={editingDestination.minimumAvailability || "announced"}
                    onChange={(event) =>
                      setEditingDestination({
                        ...editingDestination,
                        minimumAvailability: event.target.value,
                      })
                    }
                  >
                    <option value="announced">Announced</option>
                    <option value="inCinemas">In cinemas</option>
                    <option value="released">Released</option>
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    Monitoring
                    <select
                      value={editingDestination.monitor || "all"}
                      onChange={(event) =>
                        setEditingDestination({
                          ...editingDestination,
                          monitor: event.target.value,
                        })
                      }
                    >
                      <option value="all">All episodes</option>
                      <option value="future">Future episodes</option>
                      <option value="missing">Missing episodes</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                  <label>
                    Series type
                    <select
                      value={editingDestination.seriesType || "standard"}
                      onChange={(event) =>
                        setEditingDestination({
                          ...editingDestination,
                          seriesType: event.target.value,
                        })
                      }
                    >
                      <option value="standard">Standard</option>
                      <option value="daily">Daily</option>
                      <option value="anime">Anime</option>
                    </select>
                  </label>
                </>
              )}
              <label>
                Plex library <span className="muted">optional</span>
                <select
                  value={editingDestination.plexLibraryKey || ""}
                  onChange={(event) =>
                    setEditingDestination({
                      ...editingDestination,
                      plexLibraryKey: event.target.value || null,
                    })
                  }
                >
                  <option value="">No Plex association</option>
                  {(destinationData?.plexLibraries || [])
                    .filter((library) => library.type === (domain === "tv" ? "show" : "movie"))
                    .map((library) => (
                      <option value={library.key} key={library.key}>
                        {library.title} · {(library.locations || []).join(", ") || "location unavailable"}
                      </option>
                    ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={Boolean(editingDestination.isDefault)}
                  onChange={(event) =>
                    setEditingDestination({
                      ...editingDestination,
                      isDefault: event.target.checked,
                    })
                  }
                />{" "}
                Use as the default {domain === "movie" ? "movie" : "television"} destination
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={Boolean(editingDestination.administratorOnly)}
                  onChange={(event) =>
                    setEditingDestination({
                      ...editingDestination,
                      administratorOnly: event.target.checked,
                    })
                  }
                />{" "}
                Administrators only
              </label>
              <div className="form-actions">
                <button type="button" className="secondary" onClick={() => setEditingDestination(null)}>
                  Cancel
                </button>
                <button className="primary" disabled={busy === "destination"}>
                  {busy === "destination" ? "Saving…" : "Save destination"}
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      ) : null}
      {browser ? (
        <ModalPortal>
          <div
            className="root-folder-browser-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setBrowser(null);
            }}
          >
            <section className="panel root-folder-browser" role="dialog" aria-modal="true" aria-label="Choose a folder">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">CHOOSE A FOLDER</span>
                  <h2>{current}</h2>
                  <p className="muted">Only folders visible inside this container are shown. If one is missing, assign an optional library path in the Unraid container settings and click Apply.</p>
                </div>
                <button className="secondary" onClick={() => setBrowser(null)}>
                  Cancel
                </button>
              </div>
              <div className="folder-browser-actions">
                <button className="secondary" disabled={current === "/"} onClick={() => setCurrent(parent(current))}>
                  ← Parent
                </button>
                <button
                  className="primary"
                  disabled={busy === "destination-root"}
                  onClick={() => {
                    if (browser === "destination") {
                      void addDestinationRoot(current);
                      return;
                    }
                    browser === "root" ? setRootPath(current) : setDownloadPath(current);
                    setBrowser(null);
                  }}
                >
                  {busy === "destination-root" ? "Adding…" : browser === "destination" ? "Add and use this folder" : "Use this folder"}
                </button>
              </div>
              <div className="folder-browser-list">
                {browseError ? (
                  <div className="empty error-state">
                    <p>{browseError}</p>
                  </div>
                ) : directories.length ? (
                  directories.map((folder) => (
                    <button className="folder-row" key={folder.path} onClick={() => setCurrent(clean(folder.path))}>
                      <span className="folder-icon">▰</span>
                      <span>{folder.name}</span>
                      <small>{folder.path}</small>
                    </button>
                  ))
                ) : (
                  <div className="empty compact">
                    <p>No subfolders here. You can still use this folder.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
      {scanRoot ? <LibraryImportReview domain={domain} initialRoot={scanRoot} options={options} onClose={() => setScanRoot(null)} onImported={load} /> : null}
      {migration?.preview.match && MigrationDialog ? <MigrationDialog busy={busy === "migration"} domain={domain} migration={migration} onClose={() => setMigration(null)} onIgnore={(root) => { setMigration(null); setScanRoot(root); }} onMigrate={() => void migratePaths()} /> : null}
    </div>
  );
}
