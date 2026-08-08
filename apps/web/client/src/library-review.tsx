import { useEffect, useMemo, useState } from "react";
import { ServiceTabs } from "./service-tabs";
import { ModalPortal } from "./modal-portal";
import { RenamePreview, type RenamePreviewRecord } from "./rename-preview";
import type { MatchCandidate } from "./match-browser";
import type {
  LibraryReviewMountOptions,
  MovieLibraryReview,
  FolderScanMovie,
  PlexReviewMovie,
  VynodeReviewMovie,
} from "./library-review-types";
import "./library-review.css";
import "./library-review-mismatch.css";

const matches = (query: string, ...values: unknown[]) =>
  !query || values.join(" ").toLowerCase().includes(query.toLowerCase());

const lettersOnly = (value: string) =>
  value.normalize("NFKD").replace(/[^a-z]/gi, "").toLowerCase();

const filenameMatchesTitle = (filePath: string, title: string) => {
  const filename = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "";
  const normalizedTitle = lettersOnly(title);
  return !normalizedTitle || lettersOnly(filename).includes(normalizedTitle);
};

const hasFilenameMismatch = (filePath: string, title: string) =>
  Boolean(filePath) && !filenameMatchesTitle(filePath, title);

const comparisonTitleKey = (value: string, folder = false) =>
  (folder ? value.replace(/\s*\((?:19|20)\d{2}\)\s*$/, "") : value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

const validTmdbId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const hasLibraryIdentityMatch = (
  titleKeys: Set<string>,
  tmdbIds: Set<number>,
  title: string,
  tmdbId: unknown,
) => {
  const normalizedTmdbId = validTmdbId(tmdbId);
  return (
    titleKeys.has(comparisonTitleKey(title)) ||
    (normalizedTmdbId !== null && tmdbIds.has(normalizedTmdbId))
  );
};

function ComparisonBadge({ label, matched }: { label: string; matched: boolean }) {
  return <span className={`title-comparison ${matched ? "matched" : "missing"}`}>{label}: {matched ? "Match" : "No match"}</span>;
}

function PlexMovieRow({
  item,
  selected,
  onSelect,
  vynodeMatch,
  folderMatch,
}: {
  item: PlexReviewMovie;
  selected: boolean;
  onSelect: () => void;
  vynodeMatch: boolean;
  folderMatch: boolean;
}) {
  const filenameMismatch =
    item.filePaths.length > 0 &&
    item.filePaths.some((filePath) => !filenameMatchesTitle(filePath, item.title));
  return (
    <button
      className={`library-review-item${selected ? " selected" : ""}${filenameMismatch ? " filename-mismatch" : ""}`}
      type="button"
      onClick={onSelect}
    >
      <span>
        <strong>{item.title}</strong>
        <small>
          {item.year || "Year unavailable"} · {item.libraryTitle}
          {item.tmdbId ? ` · TMDB ${item.tmdbId}` : " · No TMDB ID"}
        </small>
      </span>
      <span className="title-comparisons"><ComparisonBadge label="VynodeArr" matched={vynodeMatch} /><ComparisonBadge label="Folder" matched={folderMatch} /></span>
      <code>{item.filePaths.join("\n") || "No Plex filename reported"}</code>
      {filenameMismatch ? <small className="filename-mismatch-note">Filename does not match library title</small> : null}
    </button>
  );
}

function VynodeMovieRow({
  item,
  selected,
  onSelect,
  plexMatch,
}: {
  item: VynodeReviewMovie;
  selected: boolean;
  onSelect: () => void;
  plexMatch: boolean;
}) {
  const filenameMismatch = hasFilenameMismatch(item.filePath, item.title);
  return (
    <button
      className={`library-review-item${selected ? " selected" : ""}${filenameMismatch ? " filename-mismatch" : ""}`}
      type="button"
      onClick={onSelect}
    >
      <span>
        <strong>{item.title}</strong>
        <small>
          {item.year || "Year unavailable"}
          {item.tmdbId ? ` · TMDB ${item.tmdbId}` : " · No TMDB ID"}
        </small>
      </span>
      <span className="title-comparisons"><ComparisonBadge label="Plex" matched={plexMatch} /></span>
      <code>{item.filePath || "No VynodeArr filename reported"}</code>
      {filenameMismatch ? <small className="filename-mismatch-note">Filename does not match library title</small> : null}
    </button>
  );
}

function FolderScanRow({ item, selected, onSelect, plexMatch }: { item: FolderScanMovie; selected: boolean; onSelect: () => void; plexMatch: boolean }) {
  const filenameMismatch =
    item.status === "matched" &&
    Boolean(item.filePath) &&
    !filenameMatchesTitle(item.filePath, item.name);
  return (
    <button type="button" onClick={onSelect} className={`library-review-item folder-scan-item ${item.status}${selected ? " selected" : ""}${filenameMismatch ? " filename-mismatch" : ""}`}>
      <span>
        <strong>{item.name}</strong>
        <small>
          <span className={`badge ${item.status === "matched" ? "green" : "warm"}`}>
            {item.matchType === "title" ? "Title match" : item.status === "matched" ? "Path match" : "Unmatched"}
          </span>
          {item.tmdbId ? ` TMDB ${item.tmdbId}` : ""}
        </small>
      </span>
      <span className="title-comparisons"><ComparisonBadge label="Plex" matched={plexMatch} /></span>
      {item.matchType === "title" ? <small>Already in VynodeArr as {item.vynodeTitle}</small> : null}
      <code>{item.path}</code>
      {item.filePath && item.filePath !== item.path ? <code>{item.filePath}</code> : null}
      {filenameMismatch ? <small className="filename-mismatch-note">Filename does not match library title</small> : null}
    </button>
  );
}

export function LibraryReviewView({
  options,
}: {
  options: LibraryReviewMountOptions;
}) {
  const [review, setReview] = useState<MovieLibraryReview | null>(null),
    [selectedLibraries, setSelectedLibraries] = useState<string[]>([]),
    [plexQuery, setPlexQuery] = useState(""),
    [vynodeQuery, setVynodeQuery] = useState(""),
    [vynodeFilter, setVynodeFilter] = useState<"all" | "plex-missing" | "filename-mismatch">("all"),
    [scanQuery, setScanQuery] = useState(""),
    [scanFilter, setScanFilter] = useState<"all" | "matched" | "unmatched">("all"),
    [selectedPlex, setSelectedPlex] = useState<PlexReviewMovie | null>(null),
    [selectedVynode, setSelectedVynode] =
      useState<VynodeReviewMovie | null>(null),
    [selectedFolder, setSelectedFolder] = useState<FolderScanMovie | null>(null),
    [folderMatchTerm, setFolderMatchTerm] = useState(""),
    [folderMatch, setFolderMatch] = useState<MatchCandidate | null>(null),
    [folderSearching, setFolderSearching] = useState(false),
    [qualityProfileId, setQualityProfileId] = useState(0),
    [renamePreview, setRenamePreview] = useState<RenamePreviewRecord | null>(null),
    [renameBusy, setRenameBusy] = useState<"" | "preview" | "apply">(""),
    [manualTmdbId, setManualTmdbId] = useState(""),
    [manualTmdbMatch, setManualTmdbMatch] = useState<MatchCandidate | null>(null),
    [tmdbSearching, setTmdbSearching] = useState(false),
    [plexLimit, setPlexLimit] = useState(100),
    [vynodeLimit, setVynodeLimit] = useState(100),
    [scanLimit, setScanLimit] = useState(100),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");

  const load = async (keys: string[] | null = selectedLibraries) => {
    setLoading(true);
    try {
      const query =
        keys === null
          ? ""
          : `?libraryKeys=${encodeURIComponent(keys.join(","))}`;
      const value = await options.request<MovieLibraryReview>(
        `/api/library-review/movies${query}`,
      );
      setReview(value);
      if (keys === null)
        setSelectedLibraries(value.libraries.map((item) => item.key));
      setSelectedPlex(null);
      setSelectedVynode(null);
      setSelectedFolder(null);
      setFolderMatch(null);
      setFolderMatchTerm("");
      setQualityProfileId((current) =>
        value.profiles.some((profile) => profile.id === current)
          ? current
          : value.profiles[0]?.id || 0,
      );
      setPlexLimit(100);
      setVynodeLimit(100);
      setScanLimit(100);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Library review failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(null);
  }, []);

  const plexTitleKeys = useMemo(() => new Set((review?.plex || []).map((item) => comparisonTitleKey(item.title)).filter(Boolean)), [review]),
    plexTmdbIds = useMemo(() => new Set((review?.plex || []).map((item) => validTmdbId(item.tmdbId)).filter((id): id is number => id !== null)), [review]),
    vynodeTitleKeys = useMemo(() => new Set((review?.vynode || []).map((item) => comparisonTitleKey(item.title)).filter(Boolean)), [review]),
    vynodeTmdbIds = useMemo(() => new Set((review?.vynode || []).map((item) => validTmdbId(item.tmdbId)).filter((id): id is number => id !== null)), [review]),
    folderTitleKeys = useMemo(() => new Set((review?.scan || []).map((item) => comparisonTitleKey(item.name, true)).filter(Boolean)), [review]);

  const plexItems = useMemo(
      () =>
        (review?.plex || []).filter((item) =>
          matches(
            plexQuery,
            item.title,
            item.year,
            item.libraryTitle,
            item.tmdbId,
            ...item.filePaths,
          ),
        ),
      [review, plexQuery],
    ),
    vynodeItems = useMemo(
      () =>
        (review?.vynode || []).filter((item) => {
          const passesFilter =
              vynodeFilter === "all" ||
              (vynodeFilter === "plex-missing" && !hasLibraryIdentityMatch(plexTitleKeys, plexTmdbIds, item.title, item.tmdbId)) ||
              (vynodeFilter === "filename-mismatch" && hasFilenameMismatch(item.filePath, item.title));
          return passesFilter && matches(vynodeQuery, item.title, item.year, item.tmdbId, item.filePath);
        }),
      [review, vynodeQuery, vynodeFilter, plexTitleKeys, plexTmdbIds],
    ),
    scanItems = useMemo(
      () =>
        (review?.scan || []).filter(
          (item) =>
            (scanFilter === "all" || item.status === scanFilter) &&
            matches(scanQuery, item.name, item.path, item.filePath, item.tmdbId, item.vynodeTitle),
        ),
      [review, scanQuery, scanFilter],
    );

  const applyMatch = async ({ tmdbId, imdbId }: { tmdbId?: number | null; imdbId?: string | null }) => {
    if (!selectedVynode || (!tmdbId && !imdbId)) return;
    if (
      !window.confirm(
        `Change ${selectedVynode.title} to ${imdbId ? `IMDb ${imdbId}` : `TMDB ${tmdbId}`}? The media engine will update the match and organize its files.`,
      )
    )
      return;
    setSaving(true);
    try {
      await options.request("/api/media-match", {
        method: "POST",
        body: JSON.stringify({
          domain: "movie",
          mediaId: selectedVynode.id,
          tmdbId: tmdbId || null,
          imdbId: imdbId || null,
        }),
      });
      options.notify("Movie match updated.");
      setManualTmdbId("");
      await load(selectedLibraries);
    } catch (reason) {
      options.notify(
        reason instanceof Error ? reason.message : "The match was not updated.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const searchTmdbId = async () => {
    const externalId = manualTmdbId.trim(), tmdbId = Number(externalId), isImdb = /^tt\d+$/i.test(externalId);
    if (!isImdb && (!Number.isInteger(tmdbId) || tmdbId < 1)) return;
    setTmdbSearching(true);
    setManualTmdbMatch(null);
    try {
      if (isImdb) {
        const imdbId = externalId.toLowerCase(), value = await options.request<{ result: MatchCandidate[] }>(
          `/api/manage/movie/lookup?term=${encodeURIComponent(`imdb:${imdbId}`)}`,
        ), match = (value.result || []).find((item) => String(item.imdbId || "").toLowerCase() === imdbId);
        setManualTmdbMatch(match ? { ...match, tmdbId: 0, imdbId } : null);
        if (!match) options.notify("The movie engine could not find that IMDb ID.", "error");
      } else {
        const value = await options.request<{ item: MatchCandidate }>(`/api/discover/details/movie/${tmdbId}`);
        setManualTmdbMatch(value.item || null);
      }
    } catch (reason) {
      options.notify(reason instanceof Error ? reason.message : "That TMDB ID was not found.", "error");
    } finally {
      setTmdbSearching(false);
    }
  };

  const addScannedFolder = async () => {
    if (!selectedFolder || (!folderMatch && !selectedPlex?.tmdbId) || !qualityProfileId) return;
    setSaving(true);
    try {
      let movie: Record<string, unknown> | MatchCandidate | undefined = folderMatch || undefined;
      if (!movie && selectedPlex?.tmdbId) {
        const lookup = await options.request<{ result: Array<Record<string, unknown>> }>(`/api/manage/movie/lookup?term=${encodeURIComponent(`tmdb:${selectedPlex.tmdbId}`)}`);
        movie = (lookup.result || []).find((item) => Number(item.tmdbId) === selectedPlex.tmdbId);
      }
      if (!movie) throw new Error("Choose a TMDB or IMDb match for this folder.");
      const movieTitle = String(movie.title || selectedFolder.name);
      if (!window.confirm(`Add ${movieTitle} to VynodeArr using the existing folder ${selectedFolder.path}?`)) return;
      await options.request("/api/manage/movie/library", {
        method: "POST",
        body: JSON.stringify({
          ...movie,
          path: selectedFolder.path,
          rootFolderPath: selectedFolder.rootFolderPath,
          qualityProfileId,
          monitored: true,
          minimumAvailability: "announced",
          addOptions: { searchForMovie: false },
        }),
      });
      options.notify(`${movieTitle} added from the existing movie folder.`);
      await load(selectedLibraries);
    } catch (reason) {
      options.notify(reason instanceof Error ? reason.message : "The scanned folder was not added.", "error");
    } finally {
      setSaving(false);
    }
  };

  const searchFolderMatch = async () => {
    const value = folderMatchTerm.trim(), isImdb = /^tt\d+$/i.test(value), isTmdb = /^\d+$/.test(value);
    if (!selectedFolder || (!isImdb && !isTmdb)) return;
    setFolderSearching(true); setFolderMatch(null);
    try {
      const term = isImdb ? `imdb:${value.toLowerCase()}` : `tmdb:${value}`;
      const lookup = await options.request<{ result: MatchCandidate[] }>(`/api/manage/movie/lookup?term=${encodeURIComponent(term)}`), expected = value.toLowerCase();
      const match = (lookup.result || []).find((item) => isImdb ? String(item.imdbId || "").toLowerCase() === expected : Number(item.tmdbId) === Number(value));
      if (!match) throw new Error(`The movie engine could not find that ${isImdb ? "IMDb" : "TMDB"} ID.`);
      setFolderMatch(match);
    } catch (reason) { options.notify(reason instanceof Error ? reason.message : "The movie match could not be found.", "error"); }
    finally { setFolderSearching(false); }
  };

  const openRenamePreview = async () => {
    if (!selectedVynode) return;
    setRenameBusy("preview");
    try {
      const value = await options.request<{ preview: RenamePreviewRecord }>(
        `/api/media-files/rename?domain=movie&mediaId=${selectedVynode.id}`,
      );
      setRenamePreview(value.preview);
    } catch (reason) {
      options.notify(reason instanceof Error ? reason.message : "The rename preview could not be created.", "error");
    } finally {
      setRenameBusy("");
    }
  };

  const applyRename = async (selection: { moveFolder: boolean; fileIds: number[] }) => {
    if (!selectedVynode || !renamePreview) return;
    setRenameBusy("apply");
    try {
      await options.request("/api/media-files/rename", {
        method: "POST",
        body: JSON.stringify({
          domain: "movie",
          mediaId: selectedVynode.id,
          previewId: renamePreview.previewId,
          ...selection,
        }),
      });
      options.notify(`Naming-standard changes queued for ${selectedVynode.title}.`);
      setRenamePreview(null);
      await load(selectedLibraries);
    } catch (reason) {
      options.notify(reason instanceof Error ? reason.message : "The movie was not organized.", "error");
    } finally {
      setRenameBusy("");
    }
  };

  return (
    <div className="library-review-route">
      <div className="hero">
        <div>
          <span className="eyebrow">LIBRARY REVIEW</span>
          <h1>Compare every movie location</h1>
          <p className="lede">
            Review Plex, VynodeArr, and the movie folders on disk without
            forcing unrelated titles into the same row.
          </p>
        </div>
        <button className="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <ServiceTabs active="library-review" />
      {review?.libraries.length ? (
        <section className="panel library-review-libraries">
          <strong>Plex movie libraries</strong>
          <div>
            {review.libraries.map((library) => (
              <label key={library.key}>
                <input
                  type="checkbox"
                  checked={selectedLibraries.includes(library.key)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selectedLibraries, library.key]
                      : selectedLibraries.filter((key) => key !== library.key);
                    setSelectedLibraries(next);
                    void load(next);
                  }}
                />
                {library.title}
              </label>
            ))}
          </div>
        </section>
      ) : null}
      {error ? <div className="notice error-state">{error}</div> : null}
      <section className="panel library-review-match-tools">
        <div className="library-review-match-heading">
          <span className="eyebrow">FIX A VYNODEARR MATCH</span>
          <strong>Select one title in each library, or enter a TMDB ID.</strong>
        </div>
        <div>
          <strong>Selected VynodeArr title</strong>
          <span>{selectedVynode?.title || "Choose a VynodeArr movie below"}</span>
          <button className="secondary library-review-selected-action" type="button" disabled={!selectedVynode || Boolean(renameBusy)} onClick={() => void openRenamePreview()}>
            {renameBusy === "preview" ? "Building preview…" : "Rename & organize"}
          </button>
        </div>
        <div>
          <strong>Selected Plex TMDB match</strong>
          <span>
            {selectedPlex
              ? `${selectedPlex.title} · ${selectedPlex.tmdbId ? `TMDB ${selectedPlex.tmdbId}` : "No TMDB ID"}`
              : "Choose a Plex movie if you want to use its TMDB ID"}
          </span>
        </div>
        <button
          className="primary"
          disabled={saving || !selectedVynode || !selectedPlex?.tmdbId}
          onClick={() => void applyMatch({ tmdbId: selectedPlex?.tmdbId || null })}
        >
          Use Plex TMDB ID
        </button>
        <label>
          Search by TMDB or IMDb ID
          <span>
            <input
              type="text"
              inputMode="text"
              placeholder="TMDB ID or tt IMDb ID"
              value={manualTmdbId}
              onChange={(event) => {
                setManualTmdbId(event.target.value);
                setManualTmdbMatch(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchTmdbId();
                }
              }}
            />
            <button
              className="secondary"
              type="button"
              disabled={tmdbSearching || (!Number(manualTmdbId) && !/^tt\d+$/i.test(manualTmdbId.trim()))}
              onClick={() => void searchTmdbId()}
            >
              {tmdbSearching ? "Searching…" : "Search"}
            </button>
          </span>
          {manualTmdbMatch ? (
            <span className="library-review-tmdb-result">
              <strong>{manualTmdbMatch.title}{manualTmdbMatch.year ? ` (${manualTmdbMatch.year})` : ""}</strong>
              <small>{manualTmdbMatch.imdbId ? `IMDb ${manualTmdbMatch.imdbId}` : `TMDB ${manualTmdbMatch.tmdbId}`}</small>
              <button className="primary" type="button" disabled={saving || !selectedVynode} onClick={() => void applyMatch({ tmdbId: manualTmdbMatch.tmdbId || null, imdbId: manualTmdbMatch.imdbId || null })}>
                Use this match
              </button>
            </span>
          ) : null}
        </label>
      </section>
      <section className="panel library-review-folder-add">
        <div>
          <span className="eyebrow">ADD A MOVIE FOLDER</span>
          <strong>{selectedFolder?.name || "Select any movie folder"}</strong>
          <small>{selectedFolder?.path || "Then search by TMDB or IMDb ID, or select its Plex title."}</small>
        </div>
        <div>
          <strong>Movie match</strong>
          <small>{folderMatch ? `${folderMatch.title}${folderMatch.year ? ` (${folderMatch.year})` : ""}${folderMatch.imdbId ? ` · IMDb ${folderMatch.imdbId}` : folderMatch.tmdbId ? ` · TMDB ${folderMatch.tmdbId}` : ""}` : selectedPlex ? `${selectedPlex.title}${selectedPlex.tmdbId ? ` · TMDB ${selectedPlex.tmdbId}` : " · No TMDB ID"}` : "Search an ID or select a Plex movie"}</small>
          <span className="library-review-folder-search"><input type="text" value={folderMatchTerm} placeholder="TMDB ID or tt IMDb ID" aria-label="Search folder match by TMDB or IMDb ID" onChange={(event)=>{setFolderMatchTerm(event.target.value);setFolderMatch(null);}} onKeyDown={(event)=>{if(event.key==="Enter"){event.preventDefault();void searchFolderMatch();}}}/><button className="secondary" type="button" disabled={folderSearching || !selectedFolder || (!/^tt\d+$/i.test(folderMatchTerm.trim()) && !/^\d+$/.test(folderMatchTerm.trim()))} onClick={()=>void searchFolderMatch()}>{folderSearching ? "Searching…" : "Search"}</button></span>
        </div>
        <label>
          Quality profile
          <select value={qualityProfileId} onChange={(event) => setQualityProfileId(Number(event.target.value))}>
            {review?.profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}
          </select>
        </label>
        <button className="primary" type="button" disabled={saving || !selectedFolder || (!folderMatch && !selectedPlex?.tmdbId) || !qualityProfileId} onClick={() => void addScannedFolder()}>
          Add existing folder to VynodeArr
        </button>
      </section>
      <div className="library-review-columns">
        <section className="panel">
          <header>
            <div>
              <span className="eyebrow">PLEX</span>
              <h2>{plexItems.length.toLocaleString()} movies</h2>
            </div>
            <input
              type="search"
              placeholder="Find Plex title or filename"
              value={plexQuery}
              onChange={(event) => {
                setPlexQuery(event.target.value);
                setPlexLimit(100);
              }}
            />
          </header>
          <div
            className="library-review-list"
            onScroll={(event) => {
              const node = event.currentTarget;
              if (node.scrollTop + node.clientHeight >= node.scrollHeight - 160)
                setPlexLimit((value) => Math.min(value + 100, plexItems.length));
            }}
          >
            {plexItems.slice(0, plexLimit).map((item) => (
              <PlexMovieRow
                key={`${item.libraryKey}:${item.ratingKey}`}
                item={item}
                selected={
                  selectedPlex?.libraryKey === item.libraryKey &&
                  selectedPlex.ratingKey === item.ratingKey
                }
                onSelect={() => setSelectedPlex(item)}
                vynodeMatch={hasLibraryIdentityMatch(vynodeTitleKeys, vynodeTmdbIds, item.title, item.tmdbId)}
                folderMatch={folderTitleKeys.has(comparisonTitleKey(item.title))}
              />
            ))}
          </div>
        </section>
        <section className="panel">
          <header>
            <div>
              <span className="eyebrow">VYNODEARR</span>
              <h2>{vynodeItems.length.toLocaleString()} movies</h2>
            </div>
            <input
              type="search"
              placeholder="Find VynodeArr title or filename"
              value={vynodeQuery}
              onChange={(event) => {
                setVynodeQuery(event.target.value);
                setVynodeLimit(100);
              }}
            />
            <div className="library-review-filter-tabs" aria-label="Filter VynodeArr titles">
              {([
                ["all", "All", review?.vynode.length || 0],
                ["plex-missing", "No Plex match", (review?.vynode || []).filter((item) => !hasLibraryIdentityMatch(plexTitleKeys, plexTmdbIds, item.title, item.tmdbId)).length],
                ["filename-mismatch", "Filename mismatch", (review?.vynode || []).filter((item) => hasFilenameMismatch(item.filePath, item.title)).length],
              ] as const).map(([value, label, count]) => (
                <button type="button" className={vynodeFilter === value ? "active" : ""} key={value} onClick={() => { setVynodeFilter(value); setVynodeLimit(100); }}>
                  {label} {count}
                </button>
              ))}
            </div>
          </header>
          <div
            className="library-review-list"
            onScroll={(event) => {
              const node = event.currentTarget;
              if (node.scrollTop + node.clientHeight >= node.scrollHeight - 160)
                setVynodeLimit((value) =>
                  Math.min(value + 100, vynodeItems.length),
                );
            }}
          >
            {vynodeItems.slice(0, vynodeLimit).map((item) => (
              <VynodeMovieRow
                key={item.publicId}
                item={item}
                selected={selectedVynode?.publicId === item.publicId}
                onSelect={() => setSelectedVynode(item)}
                plexMatch={hasLibraryIdentityMatch(plexTitleKeys, plexTmdbIds, item.title, item.tmdbId)}
              />
            ))}
          </div>
        </section>
        <section className="panel folder-scan-column">
          <header>
            <div>
              <span className="eyebrow">MOVIE FOLDERS</span>
              <h2>{scanItems.length.toLocaleString()} folders</h2>
            </div>
            <input
              type="search"
              placeholder="Find folder or filename"
              value={scanQuery}
              onChange={(event) => {
                setScanQuery(event.target.value);
                setScanLimit(100);
              }}
            />
            <div className="library-review-filter-tabs" aria-label="Filter scanned folders">
              {(["all", "matched", "unmatched"] as const).map((value) => (
                <button
                  type="button"
                  className={scanFilter === value ? "active" : ""}
                  key={value}
                  onClick={() => {
                    setScanFilter(value);
                    setScanLimit(100);
                  }}
                >
                  {value[0].toUpperCase() + value.slice(1)} {value === "all"
                    ? review?.scan.length || 0
                    : review?.scan.filter((item) => item.status === value).length || 0}
                </button>
              ))}
            </div>
          </header>
          <div
            className="library-review-list"
            onScroll={(event) => {
              const node = event.currentTarget;
              if (node.scrollTop + node.clientHeight >= node.scrollHeight - 160)
                setScanLimit((value) => Math.min(value + 100, scanItems.length));
            }}
          >
            {scanItems.slice(0, scanLimit).map((item) => (
              <FolderScanRow
                item={item}
                key={item.path}
                selected={selectedFolder?.path === item.path}
                onSelect={() => { setSelectedFolder(item); setFolderMatch(null); setFolderMatchTerm(""); }}
                plexMatch={plexTitleKeys.has(comparisonTitleKey(item.name, true))}
              />
            ))}
          </div>
        </section>
      </div>
      {renamePreview ? <ModalPortal><RenamePreview preview={renamePreview} busy={renameBusy === "apply"} onClose={() => setRenamePreview(null)} onApply={applyRename} /></ModalPortal> : null}
    </div>
  );
}
