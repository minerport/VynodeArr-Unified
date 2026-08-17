import { lazy, useCallback, useEffect, useState, type FormEvent } from "react";
import type {
  MediaExpansionOptions,
  ProviderSummary,
} from "./media-expansion-types";
import { ServiceTabs, type ServiceSection } from "./service-tabs";

type MusicSnapshot = {
  artists: Array<{
    id: string;
    name: string;
    monitored: boolean;
    monitorMode: string;
    genres: string[];
  }>;
  albums: Array<{
    id: string;
    artistId: string;
    title: string;
    trackCount: number;
    availableTrackCount: number;
    releaseDate?: string | null;
    releaseType?: string;
    selectedEditionId?: string | null;
  }>;
  editions: Array<{
    id: string;
    albumId: string;
    title: string;
    country: string | null;
    format: string | null;
    trackCount: number;
    selected: boolean;
  }>;
  tracks: Array<{
    id: string;
    albumId: string;
    title: string;
    mediumNumber: number;
    trackNumber: number;
    hasFile: boolean;
  }>;
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    kind?: string;
    createdAt?: string;
    error?: string;
  }>;
  indexers: ProviderSummary[];
  downloadClients: ProviderSummary[];
  metadataProviders: ProviderSummary[];
  qualityProfiles: Array<{
    id: string;
    name: string;
    allowLossy: boolean;
    allowLossless: boolean;
    minBitrateKbps: number;
    minSampleRate: number;
    minBitDepth: number;
    preferredCodecs: string[];
  }>;
  automation: {
    enabled: boolean;
    musicBatch: number;
    musicMinScore: number;
    musicCooldownHours: number;
    subtitleBatch: number;
  };
};
type SubtitleSnapshot = {
  providers: ProviderSummary[];
  profiles: Array<{
    id: string;
    name: string;
    languages: string[];
    forced: string[];
  }>;
  assignments: Array<{
    id: string;
    domain: string;
    mediaId: string;
    profileId: string;
  }>;
  items: Array<{
    id: string;
    title: string;
    domain: string;
    seasonNumber: number | null;
    episodeNumber: number | null;
    missingLanguages: string[];
    presentLanguages: string[];
    complete: boolean;
  }>;
  jobs: Array<{ id: string; itemId: string; language: string; status: string }>;
  history: Array<{
    id: string;
    itemId: string;
    language: string;
    provider: string;
    score?: number;
    createdAt: string;
  }>;
  lastLibrarySync: { completedAt: string; movies: number; episodes: number; removed: number } | null;
};
const SubtitleProviderForm = lazy(() => import("./subtitle-provider-form"));
const SubtitleLibrarySync = lazy(() => import("./subtitle-library-sync"));
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The request could not be completed.";
const values = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form).entries());

function ProviderForm({
  kind,
  options,
  onSave,
}: {
  kind: "music-indexer" | "music-client" | "music-metadata" | "subtitle";
  options: MediaExpansionOptions;
  onSave: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const endpoint =
    kind === "subtitle"
      ? "/api/subtitles/providers"
      : kind === "music-indexer"
        ? "/api/music/indexers"
        : kind === "music-client"
          ? "/api/music/download-clients"
          : "/api/music/metadata-providers";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget,
      input = values(form);
    try {
      await options.request(endpoint, {
        method: "POST",
        body: JSON.stringify({
          ...input,
          categories: input.category ? [String(input.category)] : [],
          priority: Number(input.priority) || 25,
          enabled: true,
        }),
      });
      form.reset();
      options.notify("Provider configuration saved.");
      onSave();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel expansion-provider-form" onSubmit={submit}>
      <h3>
        {kind === "subtitle"
          ? "Add subtitle provider"
          : kind === "music-indexer"
            ? "Add music indexer"
            : kind === "music-client"
              ? "Add music download client"
              : "Add metadata provider"}
      </h3>
      <div className="form-grid">
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Implementation
          <select name="implementation">
            {kind === "subtitle" ? (
              <>
                <option value="opensubtitles">OpenSubtitles.com</option>
                <option value="whisper">Whisper ASR</option>
              </>
            ) : kind === "music-indexer" ? (
              <>
                <option value="torznab">Torznab / Prowlarr</option>
                <option value="newznab">Newznab</option>
              </>
            ) : kind === "music-client" ? (
              <>
                <option value="qbittorrent">qBittorrent</option>
                <option value="sabnzbd">SABnzbd</option>
                <option value="nzbget">NZBGet</option>
              </>
            ) : (
              <>
                <option value="musicbrainz">
                  MusicBrainz (no key required)
                </option>
                <option value="lastfm">Last.fm enrichment (API key)</option>
                <option value="acoustid">AcoustID fingerprinting (API key)</option>
              </>
            )}
          </select>
        </label>
        <label>
          Endpoint
          <input
            name="endpoint"
            type="url"
            required
            placeholder={
              kind === "subtitle"
                ? "https://api.opensubtitles.com"
                : kind === "music-metadata"
                  ? "https://musicbrainz.org/ws/2"
                  : "http://service:port"
            }
          />
        </label>
        <label>
          API key
          <input name="apiKey" type="password" autoComplete="new-password" />
        </label>
        <label>
          Username
          <input name="username" autoComplete="username" />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="new-password" />
        </label>
        {(kind === "music-indexer" || kind === "music-client") && (
          <label>
            {kind === "music-indexer" ? "Category IDs" : "Download category"}
            <input
              name="category"
              placeholder={kind === "music-indexer" ? "3000" : "music"}
            />
          </label>
        )}
        <label>
          Priority
          <input
            name="priority"
            type="number"
            min="1"
            max="100"
            defaultValue="25"
          />
        </label>
      </div>
      <button className="primary" disabled={busy}>
        {busy ? "Saving…" : "Save configuration"}
      </button>
    </form>
  );
}
function ProviderList({
  title,
  items,
  options,
  endpoint,
  onChange,
}: {
  title: string;
  items: ProviderSummary[];
  options?: MediaExpansionOptions;
  endpoint?: string;
  onChange?: () => void;
}) {
  const [busy, setBusy] = useState("");
  async function test(item: ProviderSummary) {
    if (!options || !endpoint) return;
    setBusy(item.id);
    try {
      const value = await options.request<{
        message?: string;
        latencyMs?: number;
      }>(`${endpoint}/${encodeURIComponent(item.id)}/test`, {
        method: "POST",
        body: "{}",
      });
      options.notify(
        `${item.name}: ${value.message || "Connection successful"}${value.latencyMs != null ? ` (${value.latencyMs} ms)` : ""}`,
      );
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy("");
    }
  }
  async function remove(item: ProviderSummary) {
    if (!options || !endpoint || !confirm(`Remove ${item.name}?`)) return;
    setBusy(item.id);
    try {
      await options.request(`${endpoint}/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      options.notify(`${item.name} removed.`);
      onChange?.();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>{title}</h3>
        <span className="badge">{items.length}</span>
      </div>
      {items.length ? (
        items.map((item) => (
          <div className="data-row" key={item.id}>
            <span>
              <strong>{item.name}</strong>
              <small>
                {item.implementation} · priority {item.priority}
              </small>
            </span>
            <span className={`badge ${item.enabled ? "green" : ""}`}>
              {item.enabled ? "Enabled" : "Disabled"}
            </span>
            {options?.administrator && endpoint && (
              <span className="provider-actions">
                <button
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => void test(item)}
                >
                  Test
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={busy === item.id}
                  onClick={() => void remove(item)}
                >
                  Remove
                </button>
              </span>
            )}
          </div>
        ))
      ) : (
        <p className="muted">Nothing configured yet.</p>
      )}
    </section>
  );
}

function SubtitleProfileForm({
  options,
  onSave,
}: {
  options: MediaExpansionOptions;
  onSave: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget,
      input = values(form);
    try {
      await options.request("/api/subtitles/profiles", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          languages: String(input.languages || "")
            .split(",")
            .map((value) => value.trim()),
          forced: String(input.forced || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          hearingImpaired: input.hearingImpaired,
        }),
      });
      form.reset();
      options.notify("Subtitle language profile saved.");
      onSave();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel expansion-provider-form" onSubmit={submit}>
      <h3>Create language profile</h3>
      <label>
        Name
        <input name="name" required placeholder="Family English + Spanish" />
      </label>
      <div className="form-grid">
        <label>
          Languages
          <input name="languages" required placeholder="en, es" />
          <small>Comma-separated language codes.</small>
        </label>
        <label>
          Forced languages
          <input name="forced" placeholder="en" />
        </label>
        <label>
          Hearing impaired
          <select name="hearingImpaired" defaultValue="include">
            <option value="include">Include</option>
            <option value="prefer">Prefer</option>
            <option value="exclude">Exclude</option>
          </select>
        </label>
      </div>
      <button className="primary" disabled={busy}>
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

function ArtistDiscovery({
  options,
  onSave,
}: {
  options: MediaExpansionOptions;
  onSave: () => void;
}) {
  type Result = {
    id: string;
    name: string;
    sortName: string;
    disambiguation: string;
    country: string | null;
    type: string | null;
    score: number;
    genres: string[];
  };
  const [results, setResults] = useState<Result[]>([]),
    [busy, setBusy] = useState(false);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = values(event.currentTarget);
    setBusy(true);
    try {
      const response = await options.request<{
        items: Result[];
        warnings: string[];
      }>("/api/music/artists/search", {
        method: "POST",
        body: JSON.stringify({ query: input.query }),
      });
      setResults(response.items);
      if (response.warnings[0]) options.notify(response.warnings[0], "error");
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function add(result: Result) {
    setBusy(true);
    try {
      const response = await options.request<{ albumCount: number }>(
        "/api/music/artists/import",
        {
          method: "POST",
          body: JSON.stringify({ artistId: result.id, monitorMode: "all" }),
        },
      );
      options.notify(
        `${result.name} added with ${response.albumCount} releases.`,
      );
      setResults([]);
      onSave();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel expansion-provider-form" onSubmit={search}>
      <h3>Discover artists</h3>
      <p className="muted">
        Search MusicBrainz, select the exact identity, then import its release
        groups.
      </p>
      <div className="form-grid">
        <label>
          Artist name
          <input name="query" required />
        </label>
      </div>
      <button className="primary" disabled={busy}>
        {busy ? "Loading metadata…" : "Search metadata"}
      </button>
      {results.map((result) => (
        <div className="data-row" key={result.id}>
          <span>
            <strong>{result.name}</strong>
            <small>
              {[
                result.disambiguation,
                result.country,
                result.type,
                `match ${result.score}%`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </span>
          <button type="button" onClick={() => void add(result)}>
            Add
          </button>
        </div>
      ))}
    </form>
  );
}

function MusicImport({
  data,
  options,
  onSave,
}: {
  data: MusicSnapshot;
  options: MediaExpansionOptions;
  onSave: () => void;
}) {
  type Review = {
    album: { title: string; artist: string };
    qualityProfile: { id: string; name: string } | null;
    sourcePath: string;
    ready: boolean;
    matches: Array<{
      trackId: string;
      title: string;
      trackNumber: number;
      sourcePath: string | null;
      confidence: number;
      reason: string;
      quality: { label: string } | null;
      qualityAccepted: boolean;
      qualityReasons: string[];
    }>;
    unmatchedFiles: string[];
  };
  const [settings, setSettings] = useState<{
      downloadPath: string;
      libraryRoot: string;
      naming: string;
    } | null>(null),
    [review, setReview] = useState<Review | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void options
      .request<{ downloadPath: string; libraryRoot: string; naming: string }>(
        "/api/music/import/settings",
      )
      .then(setSettings)
      .catch(() =>
        setSettings({
          downloadPath: "",
          libraryRoot: "",
          naming: "{track:02} - {title}",
        }),
      );
  }, [options]);
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const input = values(event.currentTarget),
        value = await options.request<{
          downloadPath: string;
          libraryRoot: string;
          naming: string;
        }>("/api/music/import/settings", {
          method: "PUT",
          body: JSON.stringify(input),
        });
      setSettings(value);
      options.notify("Music import folders saved.");
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const input = values(event.currentTarget),
        value = await options.request<Review>("/api/music/import/analyze", {
          method: "POST",
          body: JSON.stringify(input),
        });
      setReview(value);
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function execute() {
    if (!review) return;
    setBusy(true);
    try {
      const artist = data.artists.find(
          (value) => value.name === review.album.artist,
        ),
        album = data.albums.find(
          (value) =>
            value.artistId === artist?.id && value.title === review.album.title,
        );
      await options.request("/api/music/import/execute", {
        method: "POST",
        body: JSON.stringify({
          albumId: album?.id,
          sourcePath: review.sourcePath,
        }),
      });
      options.notify(`${review.matches.length} music files imported.`);
      setReview(null);
      onSave();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  if (!settings)
    return <div className="panel skeleton">Loading import settings…</div>;
  return (
    <div className="music-storage-settings">
      <section className="storage-engine-bar"><div><span className="eyebrow">CONFIGURING</span><strong>Music storage</strong></div><label>Media library<select value="music" onChange={event=>{if(event.target.value!=="music")window.location.hash=`service/root-folders/${event.target.value}`;}}><option value="movie">Movies</option><option value="tv">Television</option><option value="music">Music</option></select></label></section>
      {settings.downloadPath&&settings.libraryRoot&&settings.downloadPath===settings.libraryRoot?<div className="notice storage-warning"><strong>Download and library paths match</strong><p>Use separate folders so completed downloads remain isolated until VynodeArr validates, renames, and imports them.</p></div>:null}
      <form className="storage-config-grid" onSubmit={saveSettings}>
        <section className="panel storage-folder-card"><div className="storage-card-heading"><span className="storage-card-icon">↓</span><div><span className="eyebrow">INCOMING MEDIA</span><h2>Download folder</h2><p>The completed-download staging folder used before music is imported.</p></div><span className={`badge ${settings.downloadPath?"green":"warm"}`}>{settings.downloadPath?"Configured":"Required"}</span></div><div className="storage-path-control"><label>Current folder<input name="downloadPath" required defaultValue={settings.downloadPath} placeholder="/downloads/music"/></label></div></section>
        <section className="panel storage-folder-card"><div className="storage-card-heading"><span className="storage-card-icon">▰</span><div><span className="eyebrow">ORGANIZED MEDIA</span><h2>Root folder</h2><p>The permanent destination for organized artists, albums, and tracks.</p></div><span className={`badge ${settings.libraryRoot?"green":"warm"}`}>{settings.libraryRoot?"1 configured":"Required"}</span></div><div className="storage-path-control"><label>Music library root<input name="libraryRoot" required defaultValue={settings.libraryRoot} placeholder="/music"/></label></div></section>
        <input name="naming" type="hidden" value={settings.naming}/>
        <div className="storage-save-row"><p className="muted">Paths must be visible inside the VynodeArr container and must not overlap.</p><button className="primary" disabled={busy}>{busy?"Saving…":"Save music folders"}</button></div>
      </form>
      <section className="panel expansion-provider-form music-import-review-card">
      <div className="panel-heading"><div><span className="eyebrow">MANUAL IMPORT</span><h2>Completed music import</h2><p className="muted">Review a completed release against its album and quality profile before copying files into the library.</p></div></div>
      <form onSubmit={analyze}>
        <div className="form-grid">
          <label>
            Album
            <select name="albumId" required defaultValue="">
              <option value="" disabled>
                Select loaded album…
              </option>
              {data.albums
                .filter((album) => album.trackCount > 0)
                .map((album) => (
                  <option value={album.id} key={album.id}>
                    {album.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Completed release folder
            <input
              name="sourcePath"
              required
              placeholder={`${settings.downloadPath || "/downloads/music"}/Artist - Album`}
            />
          </label>
        </div>
        <button className="primary" disabled={busy}>
          Analyze import
        </button>
      </form>
      {review && (
        <div className="import-review">
          <h4>
            {review.album.artist} · {review.album.title}
          </h4>
          {review.qualityProfile && (
            <p className="muted">
              Quality profile: {review.qualityProfile.name}
            </p>
          )}
          {review.matches.map((match) => (
            <div className="data-row" key={match.trackId}>
              <span>
                <strong>
                  {String(match.trackNumber).padStart(2, "0")} · {match.title}
                </strong>
                <small>
                  {match.reason}
                  {match.quality?.label ? ` · ${match.quality.label}` : ""}
                  {match.qualityReasons.length
                    ? ` · ${match.qualityReasons.join("; ")}`
                    : ""}
                  {match.sourcePath ? ` · ${match.sourcePath}` : ""}
                </small>
              </span>
              <span
                className={`badge ${match.confidence >= 70 && match.qualityAccepted ? "green" : "warm"}`}
              >
                {match.confidence}%
              </span>
            </div>
          ))}
          {review.unmatchedFiles.length > 0 && (
            <p className="muted">
              {review.unmatchedFiles.length} unmatched files remain.
            </p>
          )}
          <button
            className="primary"
            disabled={busy || !review.ready}
            onClick={() => void execute()}
          >
            Import matched files
          </button>
        </div>
      )}
      </section>
    </div>
  );
}

function MusicQualityProfiles({
  data,
  options,
  onSave,
}: {
  data: MusicSnapshot;
  options: MediaExpansionOptions;
  onSave: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      input = values(form);
    setBusy(true);
    try {
      await options.request("/api/music/quality-profiles", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          allowLossy: Boolean(input.allowLossy),
          allowLossless: Boolean(input.allowLossless),
          minBitrateKbps: Number(input.minBitrateKbps) || 0,
          minSampleRate: Number(input.minSampleRate) || 0,
          minBitDepth: Number(input.minBitDepth) || 0,
          preferredCodecs: String(input.preferredCodecs || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      form.reset();
      options.notify("Music quality profile saved.");
      onSave();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Music quality profiles</h3>
        <span className="badge">{data.qualityProfiles.length}</span>
      </div>
      {data.qualityProfiles.map((profile) => (
        <div className="data-row" key={profile.id}>
          <span>
            <strong>{profile.name}</strong>
            <small>
              {[
                profile.allowLossless && "Lossless",
                profile.allowLossy && "Lossy",
                profile.minBitrateKbps && `${profile.minBitrateKbps}+ kbps`,
                profile.minSampleRate && `${profile.minSampleRate} Hz+`,
                profile.minBitDepth && `${profile.minBitDepth}-bit+`,
                profile.preferredCodecs.join(", "),
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </span>
        </div>
      ))}
      <form className="expansion-provider-form" onSubmit={submit}>
        <label>
          Name
          <input name="name" required placeholder="Lossless preferred" />
        </label>
        <div className="form-grid">
          <label className="check">
            <input type="checkbox" name="allowLossless" defaultChecked />
            Allow lossless
          </label>
          <label className="check">
            <input type="checkbox" name="allowLossy" defaultChecked />
            Allow lossy
          </label>
          <label>
            Minimum lossy bitrate
            <input
              name="minBitrateKbps"
              type="number"
              min="0"
              placeholder="256"
            />
          </label>
          <label>
            Minimum sample rate
            <input
              name="minSampleRate"
              type="number"
              min="0"
              placeholder="44100"
            />
          </label>
          <label>
            Minimum bit depth
            <input name="minBitDepth" type="number" min="0" placeholder="16" />
          </label>
          <label>
            Preferred codecs
            <input name="preferredCodecs" placeholder="flac, alac, opus" />
          </label>
        </div>
        <button className="primary" disabled={busy}>
          Save quality profile
        </button>
      </form>
    </section>
  );
}

function MusicActions({
  options,
  onSave,
}: {
  options: MediaExpansionOptions;
  onSave: () => void;
}) {
  const [results, setResults] = useState<
    Array<{
      id: string;
      title: string;
      score: number;
      reasons: string[];
      downloadUrl?: string;
    }>
  >([]);
  const [busy, setBusy] = useState(false);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = values(event.currentTarget);
    setBusy(true);
    try {
      const response = await options.request<{
        items: typeof results;
        warnings: string[];
      }>("/api/music/search", {
        method: "POST",
        body: JSON.stringify({ artist: input.artist, album: input.album }),
      });
      setResults(response.items);
      if (response.warnings[0]) options.notify(response.warnings[0], "error");
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function grab(release: (typeof results)[number]) {
    setBusy(true);
    try {
      await options.request("/api/music/grab", {
        method: "POST",
        body: JSON.stringify(release),
      });
      options.notify(`Sent ${release.title} to the download client.`);
      onSave();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel expansion-provider-form" onSubmit={search}>
      <h3>Interactive release search</h3>
      <div className="form-grid">
        <label>
          Artist
          <input name="artist" required />
        </label>
        <label>
          Album
          <input name="album" />
        </label>
      </div>
      <button className="primary" disabled={busy}>
        {busy ? "Working…" : "Search indexers"}
      </button>
      {results.map((result) => (
        <div className="data-row" key={result.id}>
          <span>
            <strong>{result.title}</strong>
            <small>
              Score {result.score} · {result.reasons.join(" · ")}
            </small>
          </span>
          <button type="button" onClick={() => void grab(result)}>
            Grab
          </button>
        </div>
      ))}
    </form>
  );
}

function SubtitleActions({
  item,
  data,
  options,
  onSave,
}: {
  item: SubtitleSnapshot["items"][number];
  data: SubtitleSnapshot;
  options: MediaExpansionOptions;
  onSave: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<
    Array<{
      id: string;
      providerId: string;
      language: string;
      score: number;
      release?: string;
      fileId?: number;
    }>
  >([]);
  async function assign(profileId: string) {
    if (!profileId) return;
    setBusy(true);
    try {
      await options.request("/api/subtitles/assignments", {
        method: "POST",
        body: JSON.stringify({
          domain: item.domain,
          mediaId: item.id.replace(`${item.domain}_`, ""),
          profileId,
        }),
      });
      options.notify("Subtitle policy assigned.");
      onSave();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function search() {
    setBusy(true);
    try {
      const response = await options.request<{
        items: typeof results;
        warnings: string[];
      }>("/api/subtitles/search", {
        method: "POST",
        body: JSON.stringify({ itemId: item.id }),
      });
      setResults(response.items);
      if (response.warnings[0]) options.notify(response.warnings[0], "error");
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function download(result: (typeof results)[number]) {
    setBusy(true);
    try {
      await options.request("/api/subtitles/download", {
        method: "POST",
        body: JSON.stringify({ ...result, itemId: item.id }),
      });
      options.notify(`${result.language} subtitle downloaded.`);
      setResults([]);
      onSave();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="subtitle-actions">
      <select
        aria-label="Subtitle profile"
        disabled={busy}
        defaultValue=""
        onChange={(event) => void assign(event.target.value)}
      >
        <option value="">Assign profile…</option>
        {data.profiles.map((profile) => (
          <option value={profile.id} key={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
      <button disabled={busy} onClick={() => void search()}>
        Search missing
      </button>
      {results.map((result) => (
        <button
          className="result-button"
          key={`${result.providerId}:${result.id}`}
          onClick={() => void download(result)}
        >
          {result.language} · score {result.score} ·{" "}
          {result.release || result.id}
        </button>
      ))}
    </div>
  );
}

function ServiceLibraryScope({ section }: { section: "root-folders" | "profiles" | "indexers" | "download-clients" }) {
  return <div className="management-toolbar expansion-library-scope"><label>Library<select value="music" onChange={event=>{if(event.target.value==="music")return;window.location.hash=`service/${section}/${event.target.value}`;}}><option value="movie">Movies</option><option value="tv">Television</option><option value="music">Music</option></select></label><span className="muted">Music uses VynodeArr-native storage, providers, and profiles.</span></div>;
}

function MusicSettingsChrome({ options }: { options: MediaExpansionOptions }) {
  const section=(options.serviceSection||"music") as ServiceSection;
  return <><ServiceTabs active={section}/>{["profiles","indexers","download-clients"].includes(section)?<ServiceLibraryScope section={section as "profiles" | "indexers" | "download-clients"}/>:null}</>;
}

function Music({ options, view = "library" }: { options: MediaExpansionOptions; view?: string }) {
  const [data, setData] = useState<MusicSnapshot | null>(null),
    [error, setError] = useState("");
  const load = useCallback(
    () =>
      options
        .request<MusicSnapshot>("/api/music")
        .then(setData)
        .catch((reason) => setError(errorMessage(reason))),
    [options],
  );
  useEffect(() => {
    void load();
  }, [load, options]);
  async function refreshAlbum(id: string) {
    try {
      const value = await options.request<{
        editionCount: number;
        trackCount: number;
      }>(`/api/music/albums/${encodeURIComponent(id)}/refresh`, {
        method: "POST",
      });
      options.notify(
        `Loaded ${value.editionCount} editions and ${value.trackCount} tracks.`,
      );
      await load();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    }
  }
  async function pollDownloads() {
    try {
      const value = await options.request<{
        updates: unknown[];
        imports: unknown[];
      }>("/api/music/downloads/poll", { method: "POST" });
      options.notify(
        `Checked music downloads: ${value.updates.length} updated, ${value.imports.length} imported.`,
      );
      await load();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    }
  }
  async function searchMissing() {
    try {
      const value = await options.request<{
        candidates: number;
        grabbed: unknown[];
        skipped: unknown[];
      }>("/api/music/missing/search", {
        method: "POST",
        body: JSON.stringify({ limit: 5 }),
      });
      options.notify(
        `Checked ${value.candidates} missing albums; ${value.grabbed.length} releases grabbed${value.skipped.length ? `, ${value.skipped.length} skipped` : ""}.`,
      );
      await load();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    }
  }
  async function scanLibrary() {
    try {
      const value = await options.request<{ scanned: number; matched: number; unmatched: unknown[] }>(
        "/api/music/library/scan",
        { method: "POST" },
      );
      options.notify(
        `Scanned ${value.scanned} music files; ${value.matched} matched, ${value.unmatched.length} unmatched.`,
      );
      await load();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    }
  }
  async function saveAutomation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      input = values(form);
    try {
      await options.request("/api/media-expansion/automation", {
        method: "PUT",
        body: JSON.stringify({
          ...input,
          enabled: new FormData(form).has("enabled"),
        }),
      });
      options.notify("Media automation settings saved.");
      await load();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    }
  }
  if (error) return <div className="panel error-state">{error}</div>;
  if (!data)
    return <div className="panel skeleton">Loading music workspace…</div>;
  if (view !== "library") {
    const content =
      view === "settings/folders" ? (
        <MusicImport data={data} options={options} onSave={() => void load()} />
      ) : view === "settings/profiles" ? (
        <MusicQualityProfiles data={data} options={options} onSave={() => void load()} />
      ) : view === "settings/indexers" ? (
        <MusicProviderSettings kind="music-indexer" title="Indexers" items={data.indexers} endpoint="/api/music/indexers" options={options} onSave={() => void load()}/>
      ) : view === "settings/download-clients" ? (
        <MusicProviderSettings kind="music-client" title="Download Clients" items={data.downloadClients} endpoint="/api/music/download-clients" options={options} onSave={() => void load()}/>
      ) : view === "settings/metadata" ? (
        <><ProviderList title="Music metadata" items={data.metadataProviders} options={options} endpoint="/api/music/metadata-providers" onChange={() => void load()} />{options.administrator && <ProviderForm kind="music-metadata" options={options} onSave={() => void load()} />}</>
      ) : view === "settings/automation" ? (
        <form className="panel expansion-provider-form focused-settings" onSubmit={saveAutomation}>
          <div className="panel-heading"><div><span className="eyebrow">MUSIC & SUBTITLES</span><h2>Background automation</h2><p className="muted">Control bounded searches, retry volume, and duplicate protection.</p></div><span className={`badge ${data.automation.enabled ? "green" : "warm"}`}>{data.automation.enabled ? "Active" : "Paused"}</span></div>
          <div className="form-grid">
            <label className="check"><input name="enabled" type="checkbox" defaultChecked={data.automation.enabled} /> Enable background automation</label>
            <label>Albums per pass<input name="musicBatch" type="number" min="1" max="25" defaultValue={data.automation.musicBatch} /></label>
            <label>Minimum release score<input name="musicMinScore" type="number" min="0" defaultValue={data.automation.musicMinScore} /></label>
            <label>Duplicate cooldown hours<input name="musicCooldownHours" type="number" min="1" max="720" defaultValue={data.automation.musicCooldownHours} /></label>
            <label>Subtitle retries per pass<input name="subtitleBatch" type="number" min="1" max="200" defaultValue={data.automation.subtitleBatch} /></label>
          </div>
          <div className="form-actions"><button className="primary">Save automation</button></div>
        </form>
      ) : view === "settings/specific" ? (
        <><section className="music-settings-launcher"><a className="panel route-card" href="#service/root-folders/music"><span className="eyebrow">STORAGE</span><h2>Root Folders</h2><p>Set the permanent music library and completed-download staging folders.</p><strong>Configure folders →</strong></a><a className="panel route-card" href="#service/indexers/music"><span className="eyebrow">SEARCH</span><h2>Indexers</h2><p>Connect Torznab, Prowlarr, or Newznab sources used for music releases.</p><strong>Configure indexers →</strong></a><a className="panel route-card" href="#service/download-clients/music"><span className="eyebrow">DOWNLOADS</span><h2>Download Clients</h2><p>Connect qBittorrent, SABnzbd, or NZBGet and assign the music category.</p><strong>Configure clients →</strong></a><a className="panel route-card" href="#service/profiles/music"><span className="eyebrow">QUALITY</span><h2>Quality Profiles</h2><p>Control codecs, bitrate, sample rate, and lossless preferences.</p><strong>Configure profiles →</strong></a></section><div className="music-specific-settings"><section><ProviderList title="Music metadata" items={data.metadataProviders} options={options} endpoint="/api/music/metadata-providers" onChange={() => void load()} />{options.administrator && <ProviderForm kind="music-metadata" options={options} onSave={() => void load()} />}</section><form className="panel expansion-provider-form" onSubmit={saveAutomation}><div className="panel-heading"><div><h2>Music automation</h2><p className="muted">Bound background searches and avoid duplicate grabs.</p></div><span className={`badge ${data.automation.enabled ? "green" : "warm"}`}>{data.automation.enabled ? "Active" : "Paused"}</span></div><div className="form-grid"><label className="check"><input name="enabled" type="checkbox" defaultChecked={data.automation.enabled} /> Enable music automation</label><label>Albums per pass<input name="musicBatch" type="number" min="1" max="25" defaultValue={data.automation.musicBatch} /></label><label>Minimum release score<input name="musicMinScore" type="number" min="0" defaultValue={data.automation.musicMinScore} /></label><label>Duplicate cooldown hours<input name="musicCooldownHours" type="number" min="1" max="720" defaultValue={data.automation.musicCooldownHours} /></label><input name="subtitleBatch" type="hidden" value={data.automation.subtitleBatch}/></div><div className="form-actions"><button className="primary">Save music setup</button></div></form></div></>
      ) : <div className="panel empty"><h2>Music settings page not found</h2><a href="#service/music">Return to Music Setup</a></div>;
    return <><MusicSettingsChrome options={options} /><section className="focused-settings-layout">{content}</section></>;
  }
  return (
    <>
      <div className="expansion-summary">
        <div>
          <strong>{data.artists.length}</strong>
          <span>Artists</span>
        </div>
        <div>
          <strong>{data.albums.length}</strong>
          <span>Albums</span>
        </div>
        <div>
          <strong>{data.indexers.length}</strong>
          <span>Indexers</span>
        </div>
        <div>
          <strong>{data.downloadClients.length}</strong>
          <span>Download clients</span>
        </div>
      </div>
      {options.administrator && (
        <div className="expansion-toolbar">
          <button type="button" onClick={() => void pollDownloads()}>
            Check download clients
          </button>
          <button type="button" onClick={() => void searchMissing()}>
            Search monitored missing
          </button>
          <button type="button" onClick={() => void scanLibrary()}>
            Scan music library
          </button>
        </div>
      )}
      <section className="expansion-columns">
        <div>
          <h2>Music library</h2>
          <p className="muted">
            Artist → album → track monitoring, with transparent release scoring
            and independent quality policies.
          </p>
          {data.artists.length ? (
            data.artists.map((artist) => (
              <article className="panel" key={artist.id}>
                <h3>{artist.name}</h3>
                <p>
                  {artist.monitorMode} monitoring ·{" "}
                  {artist.genres.join(", ") || "No genres"}
                </p>
                <div className="music-album-list">
                  {data.albums
                    .filter((album) => album.artistId === artist.id)
                    .map((album) => (
                      <div className="data-row" key={album.id}>
                        <span>
                          <strong>{album.title}</strong>
                          <small>
                            {[
                              album.releaseDate,
                              album.releaseType,
                              album.trackCount
                                ? `${album.trackCount} tracks`
                                : "edition not loaded",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        {options.administrator && (
                          <button
                            type="button"
                            onClick={() => void refreshAlbum(album.id)}
                          >
                            {album.selectedEditionId
                              ? "Refresh"
                              : "Load editions"}
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </article>
            ))
          ) : (
            <div className="panel empty compact">
              <h3>No artists yet</h3>
              <p>
                Add artists after configuring search and download providers.
              </p>
            </div>
          )}
          {options.administrator && (
            <>
              <ArtistDiscovery options={options} onSave={() => void load()} />
              <MusicActions options={options} onSave={() => void load()} />
            </>
          )}
        </div>
        <div>
          <section className="panel">
            <h3>Music operations</h3>
            {data.jobs.slice(0, 12).map((job) => (
              <div className="data-row" key={job.id}>
                <span>
                  <strong>{job.title}</strong>
                  <small>{[job.kind, job.createdAt, job.error].filter(Boolean).join(" · ")}</small>
                </span>
                <span className={`badge ${job.status === "completed" || job.status === "imported" ? "green" : "warm"}`}>
                  {job.status}
                </span>
              </div>
            ))}
          </section>
        </div>
      </section>
    </>
  );
}

function SubtitleNavigation({ view }: { view: string }) {
  const current = view || "overview",
    links = [
      ["overview", "Overview", "#subtitles"],
      ["coverage", "Coverage", "#subtitles/coverage"],
      ["profiles", "Language profiles", "#subtitles/profiles"],
      ["providers", "Providers", "#subtitles/providers"],
      ["activity", "Activity", "#subtitles/activity"],
    ];
  return (
    <nav className="expansion-section-nav" aria-label="Subtitle pages">
      {links.map(([key, label, href]) => (
        <a className={current === key ? "selected" : ""} href={href} key={key}>{label}</a>
      ))}
    </nav>
  );
}

function MusicProviderSettings({kind,title,items,endpoint,options,onSave}:{kind:"music-indexer"|"music-client";title:string;items:ProviderSummary[];endpoint:string;options:MediaExpansionOptions;onSave:()=>void}) {
  return <div className="music-provider-settings provider-settings-layout">
    <ProviderList title={`Configured ${title.toLowerCase()}`} items={items} options={options} endpoint={endpoint} onChange={onSave}/>
    {options.administrator?<ProviderForm kind={kind} options={options} onSave={onSave}/>:<section className="panel provider-editor empty"><h2>Administrator access required</h2><p>Only administrators can add or change music connections.</p></section>}
  </div>;
}

function Subtitles({ options, view = "overview" }: { options: MediaExpansionOptions; view?: string }) {
  const [data, setData] = useState<SubtitleSnapshot | null>(null),
    [error, setError] = useState("");
  const load = useCallback(
    () =>
      options
        .request<SubtitleSnapshot>("/api/subtitles")
        .then(setData)
        .catch((reason) => setError(errorMessage(reason))),
    [options],
  );
  useEffect(() => {
    void load();
  }, [load, options]);
  async function retryPending() {
    try {
      const value = await options.request<{
        attempted: number;
        completed: number;
      }>("/api/subtitles/retry-pending", { method: "POST" });
      options.notify(
        `Retried ${value.attempted} subtitle jobs; ${value.completed} completed.`,
      );
      await load();
    } catch (error) {
      options.notify(errorMessage(error), "error");
    }
  }
  if (error) return <div className="panel error-state">{error}</div>;
  if (!data)
    return <div className="panel skeleton">Loading subtitle workspace…</div>;
  const missing = data.items.filter((item) => !item.complete);
  if(view === "settings")return <><ServiceTabs active="subtitles"/><div className="expansion-summary"><div><strong>{data.items.length}</strong><span>Tracked files</span></div><div><strong>{missing.length}</strong><span>Need subtitles</span></div><div><strong>{data.profiles.length}</strong><span>Profiles</span></div><div><strong>{data.providers.length}</strong><span>Providers</span></div></div><section className="subtitle-settings-layout"><div><section className="panel"><div className="panel-heading"><div><h2>Language profiles</h2><p className="muted">Reusable requirements inherited by movies, series, seasons, and episodes.</p></div><span className="badge">{data.profiles.length}</span></div>{data.profiles.map(profile=><div className="data-row" key={profile.id}><span><strong>{profile.name}</strong><small>{profile.languages.join(", ")}{profile.forced.length?` · forced ${profile.forced.join(", ")}`:""}</small></span></div>)}{!data.profiles.length?<p className="muted">No language profiles configured.</p>:null}</section>{options.administrator?<SubtitleProfileForm options={options} onSave={()=>void load()}/>:null}</div><div><ProviderList title="Subtitle providers" items={data.providers} options={options} endpoint="/api/subtitles/providers" onChange={()=>void load()}/>{options.administrator?<SubtitleProviderForm options={options} onSave={()=>void load()}/>:null}</div></section><details className="panel subtitle-settings-status"><summary><strong>Coverage and recent activity</strong><span className="muted">{missing.length} missing · {data.jobs.length} jobs</span></summary><div className="subtitle-status-grid"><div><h3>Titles needing attention</h3>{missing.slice(0,8).map(item=><div className="data-row" key={item.id}><span><strong>{item.title||item.id}</strong><small>{item.missingLanguages.join(", ")}</small></span></div>)}{!missing.length?<p className="muted">All tracked titles meet their assigned profiles.</p>:null}</div><div><div className="panel-heading"><h3>Recent jobs</h3>{options.administrator&&data.jobs.some(job=>job.status==='awaiting-search')?<button className="secondary" onClick={()=>void retryPending()}>Retry due</button>:null}</div>{data.jobs.slice(0,8).map(job=><div className="data-row" key={job.id}><span><strong>{job.language.toUpperCase()} · {job.itemId}</strong></span><span className={`badge ${job.status==='completed'?'green':'warm'}`}>{job.status}</span></div>)}{!data.jobs.length?<p className="muted">No subtitle jobs yet.</p>:null}</div></div></details></>;
  if (view === "overview")
    return (
      <><SubtitleNavigation view={view} />
        <div className="expansion-summary">
          <div><strong>{data.items.length}</strong><span>Tracked files</span></div>
          <div><strong>{data.items.length - missing.length}</strong><span>Complete</span></div>
          <div><strong>{missing.length}</strong><span>Need subtitles</span></div>
          <div><strong>{data.jobs.filter((job) => job.status === "awaiting-search").length}</strong><span>Waiting to retry</span></div>
        </div>
        <section className="subtitle-overview-grid">
          <a className="panel route-card" href="#subtitles/coverage"><span className="eyebrow">LIBRARY</span><h2>Coverage</h2><p>Review every movie and episode, see missing languages, and run targeted searches.</p><strong>Open coverage →</strong></a>
          <a className="panel route-card" href="#subtitles/profiles"><span className="eyebrow">POLICY</span><h2>Language profiles</h2><p>Define required, forced, and hearing-impaired preferences with upgrade targets.</p><strong>{data.profiles.length} configured →</strong></a>
          <a className="panel route-card" href="#subtitles/providers"><span className="eyebrow">SOURCES</span><h2>Providers</h2><p>Connect OpenSubtitles.com, SubDL, or local Whisper with source-specific setup.</p><strong>{data.providers.length} connected →</strong></a>
          <a className="panel route-card" href="#subtitles/activity"><span className="eyebrow">OPERATIONS</span><h2>Activity</h2><p>See downloads, retries, upgrades, and recent provider history.</p><strong>Review activity →</strong></a>
        </section>
      </>
    );
  if (view === "providers")
    return <><SubtitleNavigation view={view} /><section className="focused-settings-layout"><ProviderList title="Subtitle providers" items={data.providers} options={options} endpoint="/api/subtitles/providers" onChange={() => void load()} />{options.administrator && <SubtitleProviderForm options={options} onSave={() => void load()} />}</section></>;
  if (view === "profiles")
    return <><SubtitleNavigation view={view} /><section className="focused-settings-layout"><section className="panel"><div className="panel-heading"><div><h2>Language profiles</h2><p className="muted">Reusable language requirements applied to movies, series, seasons, or episodes.</p></div><span className="badge">{data.profiles.length}</span></div>{data.profiles.map((profile) => <div className="data-row" key={profile.id}><span><strong>{profile.name}</strong><small>{profile.languages.join(", ")}{profile.forced.length ? ` · forced ${profile.forced.join(", ")}` : ""}</small></span></div>)}{!data.profiles.length && <p className="muted">No language profiles configured.</p>}</section>{options.administrator && <SubtitleProfileForm options={options} onSave={() => void load()} />}</section></>;
  if (view === "activity")
    return <><SubtitleNavigation view={view} /><section className="focused-settings-layout"><section className="panel"><div className="panel-heading"><div><h2>Pending work</h2><p className="muted">Retries use persisted backoff and do not repeatedly contact failing providers.</p></div>{options.administrator && <button className="secondary" onClick={() => void retryPending()}>Retry due jobs</button>}</div>{data.jobs.slice(0, 50).map((job) => <div className="data-row" key={job.id}><span><strong>{job.language.toUpperCase()} · {job.itemId}</strong></span><span className={`badge ${job.status === "completed" ? "green" : "warm"}`}>{job.status}</span></div>)}{!data.jobs.length && <p className="muted">No subtitle jobs yet.</p>}</section><section className="panel"><div className="panel-heading"><h2>Download history</h2><span className="badge">{data.history.length}</span></div>{data.history.slice(0, 50).map((item) => <div className="data-row" key={item.id}><span><strong>{item.language.toUpperCase()} · {item.provider}</strong><small>{item.createdAt}{item.score != null ? ` · score ${item.score}` : ""}</small></span></div>)}{!data.history.length && <p className="muted">No downloaded subtitles yet.</p>}</section></section></>;
  return (
    <>
      <SubtitleNavigation view="coverage" />
      <div className="expansion-summary">
        <div>
          <strong>{data.items.length}</strong>
          <span>Titles & episodes</span>
        </div>
        <div>
          <strong>{missing.length}</strong>
          <span>Need subtitles</span>
        </div>
        <div>
          <strong>{data.profiles.length}</strong>
          <span>Language profiles</span>
        </div>
        <div>
          <strong>{data.providers.length}</strong>
          <span>Providers</span>
        </div>
      </div>
      <section className="expansion-columns">
        <div>
          <div className="panel-heading">
            <h2>Episode-aware subtitle coverage</h2>
            {options.administrator && <SubtitleLibrarySync options={options} onSync={load} last={data.lastLibrarySync?.completedAt || null}/>}
            {options.administrator &&
              data.jobs.some((job) => job.status === "awaiting-search") && (
                <button type="button" onClick={() => void retryPending()}>
                  Retry pending
                </button>
              )}
          </div>
          {data.items.length ? (
            data.items.map((item) => (
              <article className="panel subtitle-item" key={item.id}>
                <div>
                  <h3>{item.title || item.id}</h3>
                  <small>
                    {item.domain === "episode" && item.seasonNumber != null
                      ? `S${String(item.seasonNumber).padStart(2, "0")}E${String(item.episodeNumber || 0).padStart(2, "0")}`
                      : item.domain}
                  </small>
                  {options.administrator && (
                    <SubtitleActions
                      item={item}
                      data={data}
                      options={options}
                      onSave={() => void load()}
                    />
                  )}
                </div>
                <div>
                  <span className={`badge ${item.complete ? "green" : "warm"}`}>
                    {item.complete
                      ? "Complete"
                      : `${item.missingLanguages.length} missing`}
                  </span>
                  <small>
                    {item.missingLanguages.join(", ") ||
                      item.presentLanguages.join(", ") ||
                      "No policy assigned"}
                  </small>
                </div>
              </article>
            ))
          ) : (
            <div className="panel empty compact">
              <h3>No subtitle inventory yet</h3>
              <p>
                Episode and movie files appear here when they are imported or
                reconciled.
              </p>
            </div>
          )}
        </div>
        <div>
          <section className="panel coverage-help"><span className="eyebrow">HOW IT WORKS</span><h2>Policies follow the title</h2><p>Series rules flow to seasons and episodes. A more specific assignment overrides the inherited profile.</p><a className="secondary button-link" href="#subtitles/profiles">Manage language profiles</a><a className="secondary button-link" href="#subtitles/providers">Manage providers</a></section>
        </div>
      </section>
    </>
  );
}

export function MediaExpansionView({
  options,
}: {
  options: MediaExpansionOptions;
}) {
  const section = options.initialSection,
    view = options.initialView || (section === "music" ? "library" : "overview"),
    serviceTitles:Record<string,string>={"root-folders":"Storage Folders",profiles:"Quality Profiles",indexers:"Indexers","download-clients":"Download Clients",music:"Music Setup",subtitles:"Subtitles"},
    title = options.serviceSection?serviceTitles[options.serviceSection]||"Service Settings":section === "music"?"Music":"Subtitles";
  return (
    <div className={`media-expansion${options.serviceSection?" service-media-expansion":""}`}>
      <div className="hero">
        <div>
          <span className="eyebrow">{options.serviceSection?"SERVICE SETTINGS":section === "music" ? "MUSIC LIBRARY" : "SUBTITLE MANAGEMENT"}</span>
          <h1>{title}</h1>
          <p className="lede">
            {options.serviceSection==="music"?"Configure music-only metadata discovery and bounded background automation.":options.serviceSection==="subtitles"?"Configure language policies, providers, coverage, and retries in one focused workspace.":options.serviceSection?`Configure Music ${title.toLowerCase()} alongside the equivalent Movies and Television settings.`:section === "music"?"Browse and manage artists, albums, tracks, monitoring, and library operations.":"Subtitle coverage that follows every movie and individual television episode."}
          </p>
        </div>
      </div>
      {section === "music" ? (
        <Music options={options} view={view} />
      ) : (
        <Subtitles options={options} view={view} />
      )}
    </div>
  );
}
