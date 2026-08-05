import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  LibraryItem,
  LibraryMountOptions,
  LibraryView,
} from "./library-types";
import {
  defaultSortDirection,
  isLibrarySort,
  librarySortOptions,
  sortLibraryItems,
  type LibrarySort,
  type SortDirection,
} from "./library-sorting";
import "./react-library.css";
import {
  OverlayLayerView,
  overlayLayerVisible,
  resolveConditionalLayer,
} from "./poster-overlay-layer";
import { PosterLayerContent } from "./poster-overlay-icons";

const views: LibraryView[] = ["poster", "cards", "compact", "list"];
const viewLabels: Record<LibraryView, string> = {
  poster: "Poster grid",
  cards: "Information cards",
  compact: "Compact grid",
  list: "Detailed list",
};
const alphabet = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const titleLetter = (item: Pick<LibraryItem, "title" | "sortTitle">) => {
  const letter = (item.sortTitle || item.title).trim()[0]?.toUpperCase() || "#";
  return /^[A-Z]$/.test(letter) ? letter : "#";
};

function libraryState(item: LibraryItem, movie: boolean) {
  const monitored = item.monitoring !== "none";
  const available = movie
    ? Boolean(item.hasFile)
    : Number(item.missingEpisodes || 0) === 0;
  const cutoffMet =
    available &&
    (movie
      ? item.state !== "cutoff"
      : Number(item.cutoffUnmetEpisodes || 0) === 0);
  return { monitored, available, cutoffMet };
}

function LibraryStatusBadges({
  item,
  movie,
  className = "",
}: {
  item: LibraryItem;
  movie: boolean;
  className?: string;
}) {
  const { monitored, available, cutoffMet } = libraryState(item, movie);
  return (
    <span className={`library-status-badges ${className}`}>
      <span className={`badge ${monitored ? "green" : "muted"}`}>
        {monitored ? "Monitored" : "Unmonitored"}
      </span>
      <span className={`badge ${available ? "green" : "warm"}`}>
        {available ? "Available" : "Missing"}
      </span>
      <span
        className={`badge cutoff-status ${cutoffMet ? "green" : "warm"}`}
        aria-label={cutoffMet ? "Quality cutoff met" : "Quality cutoff unmet"}
      >
        {cutoffMet ? "✓ At cutoff" : "× Cutoff unmet"}
      </span>
    </span>
  );
}
function PosterAssignmentLayers({ item }: { item: LibraryItem }) {
  const layers = item.artwork?.overlayTemplate?.layers || [],
    value = (variable: string) => {
      const resolved = item.artwork?.overlayValues?.[variable];
      if (resolved !== undefined) return resolved;
      if (variable === "resolution")
        return (
          String(item.quality || "").match(/(?:2160|1080|720|480)p?/i)?.[0] ||
          ""
        );
      if (variable === "monitored")
        return item.monitoring === "none" ? "Unmonitored" : "Monitored";
      if (variable === "availability")
        return item.hasFile || item.state === "available"
          ? "Available"
          : "Missing";
      const raw = (item as unknown as Record<string, unknown>)[variable];
      return Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
    };
  return (
    <>
      {layers
        .filter((layer) => layer.enabled)
        .map((layer) => {
          const resolvedLayer = resolveConditionalLayer(
            layer,
            item.artwork?.overlayValues || {},
          );
          const text =
            resolvedLayer.variable === "custom_text"
              ? resolvedLayer.label
              : value(resolvedLayer.variable);
          return overlayLayerVisible(
            resolvedLayer,
            text,
            item.artwork?.overlayValues || {},
          ) ? (
            <OverlayLayerView
              className="library-poster-assignment"
              key={layer.id}
              layer={resolvedLayer}
            >
              <PosterLayerContent
                layer={resolvedLayer}
                text={`${resolvedLayer.prefix}${text}${resolvedLayer.suffix}`}
              />
            </OverlayLayerView>
          ) : null;
        })}
    </>
  );
}

function LibraryCard({
  item,
  kind,
  view,
  priority,
  administrator,
  onMonitor,
}: {
  item: LibraryItem;
  kind: LibraryMountOptions["kind"];
  view: LibraryView;
  priority: boolean;
  administrator: boolean;
  onMonitor: (item: LibraryItem) => Promise<void>;
}) {
  const movie = kind === "movies",
    href = `#${movie ? "movie" : "series"}/${item.id}`;
  const context = movie ? item.collection : item.network,
    quality = movie
      ? item.quality || item.qualityProfile || "Quality unknown"
      : item.episodeProgress || "Episode count unknown";
  const episodeCounts = String(item.episodeProgress || "").match(
      /(\d+)\s*\/\s*(\d+)/,
    ),
    episodePercent =
      episodeCounts && Number(episodeCounts[2]) > 0
        ? (Number(episodeCounts[1]) / Number(episodeCounts[2])) * 100
        : Math.max(0, 100 - Number(item.missingEpisodes || 0) * 5);
  const details = movie
    ? [
        ["Quality", item.quality || item.qualityProfile || "Not reported"],
        ["Collection", item.collection || "None"],
        [
          "Rating",
          item.rating ? `${item.rating.toFixed(1)} / 10` : "Not rated",
        ],
        ["Genres", item.genres?.slice(0, 3).join(", ") || "Not specified"],
      ]
    : [
        ["Episodes", item.episodeProgress || "Not reported"],
        ["Seasons", item.seasonProgress || "Not reported"],
        ["Network", item.network || "Not specified"],
        ["Genres", item.genres?.slice(0, 3).join(", ") || "Not specified"],
      ];
  const prefetch = () => {
    window.VynodeArrReact?.preloadRoute?.(movie ? "movie" : "series");
  };
  return (
    <article
      className={`card react-library-card ${view}`}
      data-library-id={item.id}
      data-library-letter={titleLetter(item)}
      onPointerEnter={prefetch}
      onFocus={prefetch}
    >
      <a className="poster" href={href}>
        {item.artwork?.url ? (
          <img
            src={item.artwork.url}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
          />
        ) : (
          <span className="art-fallback">{movie ? "M" : "TV"}</span>
        )}
        {view !== "poster" ? <PosterAssignmentLayers item={item} /> : null}
      </a>
      {view === "poster" ? <PosterAssignmentLayers item={item} /> : null}
      {view === "poster" ? (
        <div className="react-poster-title">
          <LibraryStatusBadges item={item} movie={movie} />
          <strong>
            <a href={href}>{item.title}</a>
          </strong>
          <span>
            {[item.year, context].filter(Boolean).join(" · ") || quality}
          </span>
          {item.rating ? (
            <em aria-label={`Rating ${item.rating.toFixed(1)} out of 10`}>
              ★ {item.rating.toFixed(1)}
            </em>
          ) : null}
          <div className="react-poster-quick-actions">
            <span className="react-poster-quality" title={quality}>
              {quality}
            </span>
            <a href={href} aria-label={`View details for ${item.title}`}>
              Details
            </a>
            {administrator ? (
              <button type="button" onClick={() => void onMonitor(item)}>
                {item.monitoring === "none" ? "Monitor" : "Unmonitor"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="card-body">
        <div className="react-library-heading">
          <div>
            <h2>
              <a href={href}>{item.title}</a>
            </h2>
            <p>{[item.year, context].filter(Boolean).join(" · ")}</p>
          </div>
          {view !== "poster" ? (
            <LibraryStatusBadges item={item} movie={movie} />
          ) : null}
        </div>
        <div className="progress">
          <span
            style={{
              width: movie
                ? item.hasFile
                  ? "100%"
                  : "0%"
                : `${Math.min(100, episodePercent)}%`,
            }}
          />
        </div>
        <div className="detail-row">
          <span>{quality}</span>
          <span>
            {movie
              ? item.hasFile
                ? "On disk"
                : "Missing"
              : `${Number(item.missingEpisodes || 0)} missing`}
          </span>
        </div>
        {view === "cards" ? (
          <p className="react-library-overview">
            {item.overview || "No summary is available yet."}
          </p>
        ) : null}
        <dl className="react-library-list-details">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <footer className="react-library-card-actions">
          <a className="secondary react-library-details" href={href}>
            Details
          </a>
          {administrator ? (
            <button
              className="secondary"
              type="button"
              onClick={() => void onMonitor(item)}
            >
              {item.monitoring === "none" ? "Monitor" : "Unmonitor"}
            </button>
          ) : null}
        </footer>
      </div>
    </article>
  );
}

export function LibraryView({ options }: { options: LibraryMountOptions }) {
  const { kind, request, notify } = options,
    movie = kind === "movies";
  const storageKey = `vynodearr.libraryState.${kind}`,
    saved = useMemo(() => {
      try {
        return JSON.parse(sessionStorage.getItem(storageKey) || "{}") as {
          filter?: string;
          sort?: string;
          direction?: SortDirection;
          query?: string;
          scrollY?: number;
        };
      } catch {
        return {};
      }
    }, [storageKey]);
  const initialSort: LibrarySort =
    saved.sort && isLibrarySort(saved.sort) ? saved.sort : "title";
  const [items, setItems] = useState(options.items),
    [attention, setAttention] = useState<{
      missing: number;
      cutoff: number;
    } | null>(null),
    [filter, setFilter] = useState(saved.filter || "all"),
    [sort, setSort] = useState<LibrarySort>(initialSort),
    [direction, setDirection] = useState<SortDirection>(
      saved.direction === "ascending" || saved.direction === "descending"
        ? saved.direction
        : defaultSortDirection(kind, initialSort),
    ),
    [randomSeed, setRandomSeed] = useState(() => Date.now()),
    [query, setQuery] = useState(saved.query || ""),
    [debouncedQuery, setDebouncedQuery] = useState(saved.query || ""),
    [view, setView] = useState(options.initialView),
    [batchSize, setBatchSize] = useState(60),
    [limit, setLimit] = useState(60),
    [total, setTotal] = useState(options.items.length),
    [letterIndex, setLetterIndex] = useState<
      Record<string, { offset: number; count: number }>
    >({}),
    [pendingLetter, setPendingLetter] = useState<string | null>(null),
    [searching, setSearching] = useState(false),
    [priorityIds, setPriorityIds] = useState<Set<string>>(() => new Set()),
    [loading, setLoading] = useState(!options.items.length),
    [syncing, setSyncing] = useState(false),
    [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null),
    [loadError, setLoadError] = useState("");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const alphabetRef = useRef<HTMLElement | null>(null);
  const [railTop, setRailTop] = useState(120);
  const [activeLetter, setActiveLetter] = useState("#");
  useEffect(() => {
    let active = true,
      pending = false,
      lastLoadedAt = 0;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const parameters = new URLSearchParams({
          limit: String(limit),
          offset: "0",
          query: debouncedQuery,
          filter,
          sort,
          direction,
          randomSeed: String(randomSeed),
        });
        const value = await request<{
          items?: LibraryItem[];
          page?: {
            total: number;
            hasMore: boolean;
            preferredLimit?: number;
            letters?: Record<string, { offset: number; count: number }>;
          };
          attention?: { missing: number; cutoff: number };
          mode?: string;
          sync?: { lastSuccess?: string | null };
        }>(`${movie ? "/api/media/movies" : "/api/media/tv"}?${parameters}`);
        if (active && Array.isArray(value.items)) {
          setItems(value.items);
          options.onLoaded?.(value.items, value.mode);
          setTotal(value.page?.total ?? value.items.length);
          const preferred = Number(value.page?.preferredLimit);
          if (
            Number.isFinite(preferred) &&
            preferred >= 20 &&
            preferred <= 250
          ) {
            setBatchSize(preferred);
            if (limit === 60 && preferred !== 60) setLimit(preferred);
          }
          if (value.page?.letters) setLetterIndex(value.page.letters);
          lastLoadedAt = Date.now();
        }
        if (active && value.attention) setAttention(value.attention);
        if (active && value.sync?.lastSuccess)
          setLastSyncedAt(value.sync.lastSuccess);
        if (active) setLoadError("");
      } catch (error) {
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : "The library could not be loaded.",
          );
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    const resume = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastLoadedAt >= 5 * 60 * 1000
      )
        void refresh();
    };
    void refresh();
    const events = new EventSource("/api/library-events");
    events.addEventListener("library-updated", (raw) => {
      try {
        const update = JSON.parse((raw as MessageEvent<string>).data) as {
          domain?: string;
          items?: LibraryItem[];
          removedIds?: string[];
          replaceAll?: boolean;
          attention?: { missing: number; cutoff: number };
          updatedAt?: string;
        };
        if (update.domain !== (movie ? "movie" : "tv")) return;
        if (update.attention) setAttention(update.attention);
        if (update.updatedAt) setLastSyncedAt(update.updatedAt);
        if (update.replaceAll) {
          void refresh();
          return;
        }
        if (
          (Array.isArray(update.items) && update.items.length) ||
          (Array.isArray(update.removedIds) && update.removedIds.length)
        ) {
          const replacements = new Map(
            (update.items || []).map((item) => [item.id, item]),
          );
          const removed = new Set(update.removedIds || []);
          setItems((current) => {
            const next = current
              .filter((item) => !removed.has(item.id))
              .map((item) => replacements.get(item.id) || item);
            const known = new Set(next.map((item) => item.id));
            for (const item of replacements.values())
              if (!known.has(item.id)) next.push(item);
            return next;
          });
          for (const item of update.items || []) {
            const detailPath = movie
              ? `/api/media/movies/${encodeURIComponent(item.id)}`
              : `/api/media/tv/${encodeURIComponent(item.id)}`;
            void request<{ item?: LibraryItem }>(detailPath)
              .then((value) => {
                if (!value.item) return;
                setItems((current) => {
                  const index = current.findIndex(
                    (candidate) => candidate.id === value.item?.id,
                  );
                  if (index < 0) return [...current, value.item as LibraryItem];
                  const next = [...current];
                  next[index] = value.item as LibraryItem;
                  return next;
                });
              })
              .catch(() => {});
          }
        }
      } catch {}
    });
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      events.close();
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [
    movie,
    request,
    options,
    limit,
    debouncedQuery,
    filter,
    sort,
    direction,
    randomSeed,
  ]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 200);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    setLimit(batchSize);
  }, [filter, sort, debouncedQuery, view, batchSize]);
  useEffect(() => {
    const persist = () =>
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          filter,
          sort,
          direction,
          query,
          scrollY: window.scrollY,
        }),
      );
    persist();
    window.addEventListener("scroll", persist, { passive: true });
    return () => {
      persist();
      window.removeEventListener("scroll", persist);
    };
  }, [storageKey, filter, sort, direction, query]);
  useEffect(() => {
    const y = Number(saved.scrollY || 0);
    if (y) requestAnimationFrame(() => window.scrollTo({ top: y }));
  }, []);
  const visible = useMemo(
    () =>
      sortLibraryItems(
        items
          .filter((item) =>
            item.title.toLowerCase().includes(debouncedQuery.toLowerCase()),
          )
          .filter(
            (item) =>
              filter === "all" ||
              (filter === "monitored" && item.monitoring !== "none") ||
              (filter === "unmonitored" && item.monitoring === "none") ||
              (filter === "missing" &&
                item.monitoring !== "none" &&
                (movie
                  ? item.state === "missing"
                  : Number(item.missingEpisodes || 0) > 0)) ||
              (filter === "cutoff" &&
                item.monitoring !== "none" &&
                (movie
                  ? item.state === "cutoff"
                  : Number(item.cutoffUnmetEpisodes || 0) > 0)),
          ),
        kind,
        sort,
        direction,
        randomSeed,
      ),
    [items, filter, sort, direction, randomSeed, debouncedQuery, movie, kind],
  );
  const availableLetters = useMemo(
    () =>
      new Set(
        Object.keys(letterIndex).length
          ? Object.keys(letterIndex)
          : visible.map((item) => titleLetter(item)),
      ),
    [visible, letterIndex],
  );
  const jumpToLetter = useCallback(
    (letter: string) => {
      const indexed = letterIndex[letter];
      if (indexed && indexed.offset >= visible.length) {
        setSort("title");
        setDirection("ascending");
        setActiveLetter(letter);
        setPendingLetter(letter);
        setLimit(indexed.offset + Math.min(24, indexed.count));
        return;
      }
      const alphabetical = [...visible].sort((a, b) =>
        (a.sortTitle || a.title).localeCompare(b.sortTitle || b.title),
      );
      const index = alphabetical.findIndex(
        (item) => titleLetter(item) === letter,
      );
      if (index < 0) return;
      const destination = alphabetical.slice(index, index + 24),
        target = alphabetical[index];
      setPriorityIds(new Set(destination.map((item) => item.id)));
      for (const item of destination) {
        if (!item.artwork?.url) continue;
        const image = new Image();
        image.decoding = "async";
        image.src = item.artwork.url;
      }
      setSort("title");
      setDirection("ascending");
      setActiveLetter(letter);
      setLimit((current) => Math.max(current, index + destination.length));
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(`[data-library-id="${target.id}"]`)
            ?.scrollIntoView({ behavior: "auto", block: "start" }),
        ),
      );
    },
    [visible, letterIndex],
  );
  useEffect(() => {
    if (!pendingLetter) return;
    const target = visible.find((item) => titleLetter(item) === pendingLetter);
    if (!target) return;
    setPendingLetter(null);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-library-id="${target.id}"]`)
        ?.scrollIntoView({ behavior: "auto", block: "start" }),
    );
  }, [visible, pendingLetter]);
  const selectFromPointer = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const bounds = alphabetRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const index = Math.max(
        0,
        Math.min(
          alphabet.length - 1,
          Math.floor(
            ((event.clientY - bounds.top) / bounds.height) * alphabet.length,
          ),
        ),
      );
      const letter = alphabet[index];
      if (availableLetters.has(letter)) jumpToLetter(letter);
    },
    [availableLetters, jumpToLetter],
  );
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || limit >= total || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          setLimit((value) => value + batchSize);
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [limit, total, batchSize]);
  useEffect(() => {
    const alignRail = () =>
      setRailTop(
        Math.max(
          120,
          Math.round(gridRef.current?.getBoundingClientRect().top || 120),
        ),
      );
    alignRail();
    window.addEventListener("scroll", alignRail, { passive: true });
    window.addEventListener("resize", alignRail);
    const observer =
      "ResizeObserver" in window && gridRef.current
        ? new ResizeObserver(alignRail)
        : null;
    if (observer && gridRef.current) observer.observe(gridRef.current);
    return () => {
      window.removeEventListener("scroll", alignRail);
      window.removeEventListener("resize", alignRail);
      observer?.disconnect();
    };
  }, [view, filter, debouncedQuery]);

  useEffect(() => {
    let frame = 0;
    const syncActiveLetter = () => {
      frame = 0;
      const cards = Array.from(
        gridRef.current?.querySelectorAll<HTMLElement>(
          "[data-library-letter]",
        ) || [],
      );
      if (!cards.length) return;
      const gridTop = gridRef.current?.getBoundingClientRect().top || 120;
      const readingLine = Math.min(
        Math.max(120, gridTop) + 12,
        window.innerHeight * 0.4,
      );
      const current =
        cards.find(
          (card) => card.getBoundingClientRect().bottom > readingLine,
        ) || cards[cards.length - 1];
      const letter = current.dataset.libraryLetter;
      if (letter && alphabet.includes(letter)) setActiveLetter(letter);
    };
    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncActiveLetter);
    };
    scheduleSync();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    return () => {
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [visible, limit, view]);
  const monitored = items.filter((item) => item.monitoring !== "none"),
    derivedMissing = monitored.reduce(
      (sum, item) =>
        sum +
        (movie
          ? Number(item.state === "missing")
          : Number(item.missingEpisodes || 0)),
      0,
    ),
    derivedCutoff = monitored.reduce(
      (sum, item) =>
        sum +
        (movie
          ? Number(item.state === "cutoff")
          : Number(item.cutoffUnmetEpisodes || 0)),
      0,
    ),
    missing = attention?.missing ?? derivedMissing,
    cutoff = attention?.cutoff ?? derivedCutoff,
    coverage = Math.round(
      (items.filter((item) =>
        movie ? item.hasFile : Number(item.missingEpisodes || 0) === 0,
      ).length /
        Math.max(items.length, 1)) *
        100,
    );
  async function monitor(item: LibraryItem) {
    const domain = movie ? "movie" : "tv",
      engineId = item.id.replace(movie ? "movie_" : "series_", "");
    try {
      const value = await request<{ result: Record<string, unknown> }>(
          `/api/manage/${domain}/library/${engineId}`,
        ),
        raw = value.result,
        next = !raw.monitored;
      const saved = await request<{ result: Record<string, unknown> }>(
        `/api/manage/${domain}/library/${engineId}`,
        { method: "PUT", body: JSON.stringify({ ...raw, monitored: next }) },
      );
      const monitored = Boolean(saved.result?.monitored ?? next),
        updated = {
          ...item,
          monitoring: monitored ? (movie ? "monitored" : "all") : "none",
        };
      setItems((current) =>
        current.map((value) => (value.id === item.id ? updated : value)),
      );
      options.onItemChange?.(updated);
      notify(
        monitored
          ? `${movie ? "Movie" : "Series"} monitored.`
          : `${movie ? "Movie" : "Series"} unmonitored.`,
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "The monitoring change failed.",
        "error",
      );
    }
  }
  async function searchAllMissing() {
    const ids = visible
      .filter((item) => item.state === "missing" && item.monitoring !== "none")
      .map((item) => Number(item.id.replace(/^movie_/, "")))
      .filter(Number.isFinite);
    if (!ids.length) return;
    setSearching(true);
    try {
      for (let index = 0; index < ids.length; index += 100)
        await request("/api/manage/movie/commands", {
          method: "POST",
          body: JSON.stringify({
            name: "MoviesSearch",
            movieIds: ids.slice(index, index + 100),
          }),
        });
      notify(
        `Search queued for ${ids.length} missing movie${ids.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "The missing movie search failed.",
        "error",
      );
    } finally {
      setSearching(false);
    }
  }
  const synchronizeLibrary = async () => {
    setSyncing(true);
    try {
      const value = await request<{
        items?: LibraryItem[];
        attention?: { missing: number; cutoff: number };
        mode?: string;
        sync?: { lastSuccess?: string | null };
      }>(`${movie ? "/api/media/movies" : "/api/media/tv"}?refresh=true`);
      if (Array.isArray(value.items)) {
        setItems(value.items);
        options.onLoaded?.(value.items, value.mode);
      }
      if (value.attention) setAttention(value.attention);
      if (value.sync?.lastSuccess) setLastSyncedAt(value.sync.lastSuccess);
      setLoadError("");
      options.notify("Library synchronized with the media engine.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Library synchronization failed.";
      setLoadError(message);
      options.notify(message, "error");
    } finally {
      setSyncing(false);
    }
  };
  function chooseView(next: LibraryView) {
    setView(next);
    options.onViewChange(next);
  }
  function chooseSort(next: LibrarySort) {
    setSort(next);
    setDirection(defaultSortDirection(kind, next));
    if (next === "random") setRandomSeed(Date.now());
  }
  if (loading && !items.length)
    return (
      <div className="panel skeleton react-route-loading">
        Loading {movie ? "movies" : "television"}…
      </div>
    );
  if (loadError && !items.length)
    return (
      <div className="empty error-state">
        <h2>{movie ? "Movie" : "TV"} service unavailable</h2>
        <p>{loadError}</p>
      </div>
    );
  return (
    <div className="react-library">
      <div className="hero">
        <div>
          <span className="eyebrow">YOUR LIBRARY</span>
          <h1>{movie ? "Movies" : "TV"}</h1>
          <p className="lede">
            {movie
              ? "Every story, presented through one secure gateway."
              : "Every season and episode, normalized in one library."}
          </p>
        </div>
        <div
          className="library-hero-actions"
          style={{ display: "grid", gap: ".65rem", justifyItems: "stretch" }}
        >
          <span className="read-only">
            Connected library
            {lastSyncedAt
              ? ` · updated ${new Date(lastSyncedAt).toLocaleString()}`
              : ""}
          </span>
          {options.administrator ? (
            <button
              className="secondary"
              disabled={syncing}
              onClick={() => void synchronizeLibrary()}
            >
              {syncing ? "Synchronizing…" : "Sync now"}
            </button>
          ) : null}
        </div>
      </div>
      {loadError ? (
        <div className="notice warning">
          <strong>Library refresh delayed.</strong>
          <p>{loadError}</p>
        </div>
      ) : null}
      <div className="summary">
        <div>
          <strong>{items.length}</strong>
          <span>Titles</span>
        </div>
        <div>
          <strong>{monitored.length}</strong>
          <span>Monitored</span>
        </div>
        <div>
          <strong>{missing + cutoff}</strong>
          <span>Need attention</span>
          <small>
            {movie
              ? `${missing} missing · ${cutoff} below cutoff`
              : `${missing} missing episodes · ${cutoff} below cutoff`}
          </small>
        </div>
        <div>
          <strong>{coverage}%</strong>
          <span>Library coverage</span>
        </div>
      </div>
      <div className="toolbar react-library-toolbar">
        <div className="filters">
          {["all", "monitored", "unmonitored", "missing", "cutoff"].map(
            (value) => (
              <button
                key={value}
                type="button"
                className={`chip ${filter === value ? "selected" : ""}`}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "cutoff"
                  ? "Cutoff unmet"
                  : value[0].toUpperCase() + value.slice(1)}
              </button>
            ),
          )}
        </div>
        {options.administrator && movie && filter === "missing" ? (
          <button
            className="primary react-library-search-missing"
            disabled={searching || !visible.length}
            onClick={() => void searchAllMissing()}
          >
            {searching
              ? "Queuing searches…"
              : `Search all missing (${visible.length})`}
          </button>
        ) : null}
        <label className="react-library-search">
          Filter titles
          <span className="react-library-search-field">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${movie ? "movies" : "television"}`}
            />
            {query ? (
              <button
                type="button"
                className="react-library-search-clear"
                aria-label={`Clear ${movie ? "movie" : "television"} filter`}
                title="Clear filter"
                onClick={() => setQuery("")}
              >
                ×
              </button>
            ) : null}
          </span>
        </label>
        <div className="react-library-view-controls">
          <span className="react-library-sort-controls">
            <select
              className="sort"
              aria-label="Sort media"
              value={sort}
              onChange={(event) =>
                chooseSort(event.target.value as LibrarySort)
              }
            >
              {librarySortOptions(kind).map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {sort === "random" ? (
              <button
                type="button"
                className="icon-button"
                title="Shuffle again"
                aria-label="Shuffle library again"
                onClick={() => setRandomSeed(Date.now())}
              >
                ↻
              </button>
            ) : (
              <button
                type="button"
                className="icon-button sort-direction"
                title={
                  direction === "ascending"
                    ? "Ascending; click for descending"
                    : "Descending; click for ascending"
                }
                aria-label={`Sort ${direction}; click to reverse`}
                onClick={() =>
                  setDirection((value) =>
                    value === "ascending" ? "descending" : "ascending",
                  )
                }
              >
                {direction === "ascending" ? "↑" : "↓"}
              </button>
            )}
          </span>
          {views.map((value) => (
            <button
              key={value}
              type="button"
              className={`icon-button ${view === value ? "selected" : ""}`}
              title={viewLabels[value]}
              aria-label={viewLabels[value]}
              aria-pressed={view === value}
              onClick={() => chooseView(value)}
            >
              {value === "poster"
                ? "▦"
                : value === "cards"
                  ? "▥"
                  : value === "compact"
                    ? "▤"
                    : "☷"}
            </button>
          ))}
        </div>
      </div>
      <div ref={gridRef} className={`grid view-${view} library-results-grid`}>
        {visible.slice(0, limit).map((item) => (
          <LibraryCard
            key={item.id}
            item={item}
            kind={kind}
            view={view}
            priority={priorityIds.has(item.id)}
            administrator={options.administrator}
            onMonitor={monitor}
          />
        ))}
      </div>
      <nav
        className="library-alphabet-rail"
        style={{ top: `${railTop}px` }}
        ref={alphabetRef}
        aria-label={`Jump through ${movie ? "movies" : "television"} alphabetically`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          selectFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            selectFromPointer(event);
        }}
      >
        <span
          className="library-alphabet-slider"
          style={{
            top: `${((alphabet.indexOf(activeLetter) + 0.5) / alphabet.length) * 100}%`,
          }}
          aria-hidden="true"
        />
        {alphabet.map((letter) => (
          <button
            key={letter}
            type="button"
            className={activeLetter === letter ? "active" : ""}
            disabled={!availableLetters.has(letter)}
            onClick={() => jumpToLetter(letter)}
            aria-label={`Jump to ${letter === "#" ? "numbers and symbols" : letter}`}
          >
            {letter}
          </button>
        ))}
      </nav>
      {!visible.length ? (
        <div className="empty">
          <h2>No titles match</h2>
          <p>Change the search or library filter.</p>
        </div>
      ) : null}
      {limit < visible.length ? (
        <div className="library-load-more" ref={loadMoreRef}>
          <p>
            Showing {limit.toLocaleString()} of{" "}
            {visible.length.toLocaleString()}
          </p>
          <button
            className="secondary"
            type="button"
            onClick={() => setLimit((value) => value + batchSize)}
          >
            Load more
          </button>
        </div>
      ) : null}
    </div>
  );
}
