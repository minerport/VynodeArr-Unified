import { useEffect, useMemo, useState } from "react";
import { ServiceTabs } from "./service-tabs";
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

function PlexMovieRow({
  item,
  selected,
  onSelect,
}: {
  item: PlexReviewMovie;
  selected: boolean;
  onSelect: () => void;
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
      <code>{item.filePaths.join("\n") || "No Plex filename reported"}</code>
      {filenameMismatch ? <small className="filename-mismatch-note">Filename does not match library title</small> : null}
    </button>
  );
}

function VynodeMovieRow({
  item,
  selected,
  onSelect,
}: {
  item: VynodeReviewMovie;
  selected: boolean;
  onSelect: () => void;
}) {
  const filenameMismatch =
    Boolean(item.filePath) && !filenameMatchesTitle(item.filePath, item.title);
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
      <code>{item.filePath || "No VynodeArr filename reported"}</code>
      {filenameMismatch ? <small className="filename-mismatch-note">Filename does not match library title</small> : null}
    </button>
  );
}

function FolderScanRow({ item }: { item: FolderScanMovie }) {
  const filenameMismatch =
    item.status === "matched" &&
    Boolean(item.filePath) &&
    !filenameMatchesTitle(item.filePath, item.name);
  return (
    <article className={`library-review-item folder-scan-item ${item.status}${filenameMismatch ? " filename-mismatch" : ""}`}>
      <span>
        <strong>{item.name}</strong>
        <small>
          <span className={`badge ${item.status === "matched" ? "green" : "warm"}`}>
            {item.status === "matched" ? "Matched" : "Unmatched"}
          </span>
          {item.tmdbId ? ` TMDB ${item.tmdbId}` : ""}
        </small>
      </span>
      <code>{item.path}</code>
      {item.filePath && item.filePath !== item.path ? <code>{item.filePath}</code> : null}
      {filenameMismatch ? <small className="filename-mismatch-note">Filename does not match library title</small> : null}
    </article>
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
    [scanQuery, setScanQuery] = useState(""),
    [scanFilter, setScanFilter] = useState<"all" | "matched" | "unmatched">("all"),
    [selectedPlex, setSelectedPlex] = useState<PlexReviewMovie | null>(null),
    [selectedVynode, setSelectedVynode] =
      useState<VynodeReviewMovie | null>(null),
    [manualTmdbId, setManualTmdbId] = useState(""),
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
        (review?.vynode || []).filter((item) =>
          matches(
            vynodeQuery,
            item.title,
            item.year,
            item.tmdbId,
            item.filePath,
          ),
        ),
      [review, vynodeQuery],
    ),
    scanItems = useMemo(
      () =>
        (review?.scan || []).filter(
          (item) =>
            (scanFilter === "all" || item.status === scanFilter) &&
            matches(scanQuery, item.name, item.path, item.filePath, item.tmdbId),
        ),
      [review, scanQuery, scanFilter],
    );

  const applyMatch = async (tmdbId: number | null) => {
    if (!selectedVynode || !tmdbId) return;
    if (
      !window.confirm(
        `Change ${selectedVynode.title} to TMDB ${tmdbId}? The media engine will update the match and organize its files.`,
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
          tmdbId,
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
          onClick={() => void applyMatch(selectedPlex?.tmdbId || null)}
        >
          Use Plex TMDB ID
        </button>
        <label>
          Or enter a TMDB ID
          <span>
            <input
              type="number"
              min="1"
              value={manualTmdbId}
              onChange={(event) => setManualTmdbId(event.target.value)}
            />
            <button
              className="secondary"
              disabled={saving || !selectedVynode || !Number(manualTmdbId)}
              onClick={() => void applyMatch(Number(manualTmdbId) || null)}
            >
              Fix match
            </button>
          </span>
        </label>
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
              <FolderScanRow item={item} key={item.path} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
