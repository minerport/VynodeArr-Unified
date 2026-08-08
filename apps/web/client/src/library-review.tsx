import { useEffect, useMemo, useState } from "react";
import { ServiceTabs } from "./service-tabs";
import type {
  LibraryReviewMountOptions,
  MovieLibraryReview,
  PlexReviewMovie,
  VynodeReviewMovie,
} from "./library-review-types";
import "./library-review.css";

const matches = (query: string, ...values: unknown[]) =>
  !query || values.join(" ").toLowerCase().includes(query.toLowerCase());

function PlexMovieRow({
  item,
  selected,
  onSelect,
}: {
  item: PlexReviewMovie;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`library-review-item${selected ? " selected" : ""}`}
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
  return (
    <button
      className={`library-review-item${selected ? " selected" : ""}`}
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
    [selectedPlex, setSelectedPlex] = useState<PlexReviewMovie | null>(null),
    [selectedVynode, setSelectedVynode] =
      useState<VynodeReviewMovie | null>(null),
    [manualTmdbId, setManualTmdbId] = useState(""),
    [plexLimit, setPlexLimit] = useState(100),
    [vynodeLimit, setVynodeLimit] = useState(100),
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
          <h1>Plex and VynodeArr movies</h1>
          <p className="lede">
            Review two independent library lists at the same time. Titles are
            never forced into matching rows.
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
      </div>
    </div>
  );
}
