import { useCallback, useEffect, useState, type FormEvent } from "react";
import type {
  MediaExpansionOptions,
  ProviderSummary,
} from "./media-expansion-types";

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
  jobs: Array<{ id: string; title: string; status: string }>;
  indexers: ProviderSummary[];
  downloadClients: ProviderSummary[];
  metadataProviders: ProviderSummary[];
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
};
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
}: {
  title: string;
  items: ProviderSummary[];
}) {
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

function Music({ options }: { options: MediaExpansionOptions }) {
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
  if (error) return <div className="panel error-state">{error}</div>;
  if (!data)
    return <div className="panel skeleton">Loading music workspace…</div>;
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
          <ProviderList title="Music metadata" items={data.metadataProviders} />
          {options.administrator && (
            <ProviderForm
              kind="music-metadata"
              options={options}
              onSave={() => void load()}
            />
          )}
          <ProviderList title="Music indexers" items={data.indexers} />
          {options.administrator && (
            <ProviderForm
              kind="music-indexer"
              options={options}
              onSave={() => void load()}
            />
          )}
          <ProviderList
            title="Music download clients"
            items={data.downloadClients}
          />
          {options.administrator && (
            <ProviderForm
              kind="music-client"
              options={options}
              onSave={() => void load()}
            />
          )}
        </div>
      </section>
    </>
  );
}

function Subtitles({ options }: { options: MediaExpansionOptions }) {
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
  return (
    <>
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
            {options.administrator &&
              data.jobs.some((job) => job.status === "awaiting-search") && (
                <button type="button" onClick={() => void retryPending()}>
                  Retry pending
                </button>
              )}
          </div>
          <p className="muted">
            Policies inherit from series to season to episode, with episode
            overrides taking priority.
          </p>
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
          <ProviderList title="Subtitle providers" items={data.providers} />
          {options.administrator && (
            <ProviderForm
              kind="subtitle"
              options={options}
              onSave={() => void load()}
            />
          )}
          <section className="panel">
            <div className="panel-heading">
              <h3>Language profiles</h3>
              <span className="badge">{data.profiles.length}</span>
            </div>
            {data.profiles.map((profile) => (
              <div className="data-row" key={profile.id}>
                <span>
                  <strong>{profile.name}</strong>
                  <small>
                    {profile.languages.join(", ")}
                    {profile.forced.length
                      ? ` · forced ${profile.forced.join(", ")}`
                      : ""}
                  </small>
                </span>
              </div>
            ))}
            {!data.profiles.length && (
              <p className="muted">No language profiles configured.</p>
            )}
          </section>
          {options.administrator && (
            <SubtitleProfileForm options={options} onSave={() => void load()} />
          )}
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
  const [section, setSection] = useState(options.initialSection);
  useEffect(() => setSection(options.initialSection), [options.initialSection]);
  return (
    <div className="media-expansion">
      <div className="hero">
        <div>
          <span className="eyebrow">VYNODE MORE</span>
          <h1>{section === "music" ? "Music" : "Subtitles"}</h1>
          <p className="lede">
            {section === "music"
              ? "A native music library built around artist intent, album completeness, and explainable grabs."
              : "Subtitle coverage that follows every movie and individual television episode."}
          </p>
        </div>
      </div>
      <nav className="expansion-tabs">
        <a
          className={section === "music" ? "selected" : ""}
          href="#music"
          onClick={() => setSection("music")}
        >
          Music
        </a>
        <a
          className={section === "subtitles" ? "selected" : ""}
          href="#subtitles"
          onClick={() => setSection("subtitles")}
        >
          Subtitles
        </a>
      </nav>
      {section === "music" ? (
        <Music options={options} />
      ) : (
        <Subtitles options={options} />
      )}
    </div>
  );
}
