import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  HistoryDomain,
  HistoryItem,
  HistoryMountOptions,
} from "./history-types";
import { EngineInstanceFilter, useEngineInstances } from "./engine-instance-control";
import { RouteError, RouteLoading } from "./react-route-state";
import { errorMessage } from "./shell-utils";
import "./react-history.css";

type HistoryCategory =
  "all" | "imported" | "grabbed" | "failed" | "changed" | "deleted" | "other";
type HistoryDomainFilter = "all" | HistoryDomain;
type EventPresentation = {
  category: Exclude<HistoryCategory, "all">;
  label: string;
  description: string;
  tone: string;
  organizable: boolean;
};
const labels: Record<HistoryDomain, string> = {
  movie: "Movies",
  tv: "Television",
};
const when = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Time unavailable";
const eventPresentation = (eventType?: string): EventPresentation => {
  const value = String(eventType || "unknown").toLowerCase();
  if (
    value.includes("downloadfolderimported") ||
    value.includes("fileimported") ||
    value === "imported" ||
    value === "downloaded"
  )
    return {
      category: "imported",
      label: "Imported into library",
      description: "The downloaded file was moved into the library.",
      tone: "success",
      organizable: true,
    };
  if (value === "grabbed" || value.includes("downloadgrabbed"))
    return {
      category: "grabbed",
      label: "Download grabbed",
      description: "A release was sent to the configured download client.",
      tone: "active",
      organizable: false,
    };
  if (value.includes("failed") || value.includes("error"))
    return {
      category: "failed",
      label: "Download failed",
      description: "The engine reported a problem with this download.",
      tone: "danger",
      organizable: false,
    };
  if (value.includes("deleted"))
    return {
      category: "deleted",
      label: "Library file deleted",
      description: "A media file was removed from the library.",
      tone: "danger",
      organizable: false,
    };
  if (value.includes("renamed"))
    return {
      category: "changed",
      label: "File renamed",
      description:
        "The library file was renamed using the current naming rules.",
      tone: "success",
      organizable: true,
    };
  if (value.includes("retagged"))
    return {
      category: "changed",
      label: "File metadata updated",
      description: "The file metadata was updated.",
      tone: "neutral",
      organizable: false,
    };
  return {
    category: "other",
    label: String(eventType || "Unknown event").replace(
      /([a-z])([A-Z])/g,
      "$1 $2",
    ),
    description: "An engine activity event was recorded.",
    tone: "neutral",
    organizable: false,
  };
};

function HistorySection({
  domain,
  items,
  options,
}: {
  domain: HistoryDomain;
  items: HistoryItem[];
  options: HistoryMountOptions;
}) {
  const [busy, setBusy] = useState<Record<string, boolean>>({}),
    [completed, setCompleted] = useState<Record<string, boolean>>({});
  async function organize(item: HistoryItem) {
    const mediaId = Number(String(item.mediaId || "").split('_').at(-1));
    if (!Number.isFinite(mediaId)) return;
    setBusy((value) => ({ ...value, [item.id]: true }));
    try {
      await options.request("/api/media-files/rename", {
        method: "POST",
        body: JSON.stringify({ domain, mediaId,engineInstanceId:item.engineInstanceId }),
      });
      setCompleted((value) => ({ ...value, [item.id]: true }));
      options.notify(`${item.title} was queued to rename and organize.`);
    } catch (error) {
      setBusy((value) => ({ ...value, [item.id]: false }));
      options.notify(
        errorMessage(error, "The organize request failed."),
        "error",
      );
    }
  }
  return (
    <section className="system-domain-section react-history-domain">
      <header className="panel-heading">
        <div>
          <span className="eyebrow">
            {domain === "movie" ? "MOVIE ENGINE" : "TELEVISION ENGINE"}
          </span>
          <h2>{labels[domain]} history</h2>
          <p className="muted">
            {items.length
              ? `${items.length} matching event${items.length === 1 ? "" : "s"}`
              : "No matching events"}
          </p>
        </div>
        <span className="badge">{items.length}</span>
      </header>
      <div className="react-history-list">
        {items.slice(0, 100).map((item) => {
          const event = eventPresentation(item.eventType);
          return (
            <article
              className={`react-history-row history-tone-${event.tone}`}
              key={item.id}
            >
              <span className="history-event-marker" aria-hidden="true" />
              <div className="history-event-copy">
                <div className="history-event-heading">
                  <strong>{item.title}</strong>
                  <span className={`history-event-badge ${event.tone}`}>
                    {event.label}
                  </span>
                </div>
                {item.context ? (
                  <span className="history-context">{item.context}</span>
                ) : null}
                {item.engineInstanceName?<span className="history-context">Engine: {item.engineInstanceName}</span>:null}
                <span className="history-event-description">
                  {event.description}
                  {item.quality ? ` · ${item.quality}` : ""}
                </span>
                {item.details ? <small>{item.details}</small> : null}
                {item.requesters?.length ? <small className="requester-attribution">Requested by {item.requesters.map(user => user.name).join(", ")}</small> : null}
                <small className="history-raw-event">
                  Engine event: {item.eventType || "unknown"}
                </small>
              </div>
              <div className="history-event-actions">
                <time>{when(item.timestamp)}</time>
                {options.administrator && item.mediaId && event.organizable ? (
                  <button
                    className="secondary"
                    disabled={busy[item.id] || completed[item.id]}
                    onClick={() => void organize(item)}
                  >
                    {completed[item.id]
                      ? "Organize queued ✓"
                      : busy[item.id]
                        ? "Queueing…"
                        : "Organize again"}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {!items.length ? (
        <div className="empty compact">
          <h3>No activity here</h3>
          <p>Try another event filter or search term.</p>
        </div>
      ) : null}
    </section>
  );
}

export function HistoryView({ options }: { options: HistoryMountOptions }) {
  const engineInstances = useEngineInstances(options.request);
  const [items, setItems] = useState(options.items || []),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState<HistoryCategory>("all"),
    [domain, setDomain] = useState<HistoryDomainFilter>("all"),
    [engineInstanceId, setEngineInstanceId] = useState("all"),
    [refreshing, setRefreshing] = useState(false),
    [loading, setLoading] = useState(!options.items),
    [loadError, setLoadError] = useState("");
  const refresh = useCallback(async (announce = true) => {
    setRefreshing(true);
    try {
      const value = await options.request<{ items?: HistoryItem[] }>(
        "/api/activity/history",
      );
      setItems(value.items || []);
      setLoadError("");
      if (announce) options.notify("History refreshed.");
    } catch (error) {
      const message =
        errorMessage(error, "History could not be refreshed.");
      setLoadError(message);
      if (announce) options.notify(message, "error");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [options]);
  useEffect(() => {
    if (!options.items) void refresh(false);
  }, [options.items, refresh]);
  const scopedItems = useMemo(() => items.filter(item => engineInstanceId === "all" || item.engineInstanceId === engineInstanceId), [items, engineInstanceId]);
  const counts = useMemo(
    () =>
      scopedItems.reduce<Record<Exclude<HistoryCategory, "all">, number>>(
        (result, item) => {
          result[eventPresentation(item.eventType).category]++;
          return result;
        },
        {
          imported: 0,
          grabbed: 0,
          failed: 0,
          changed: 0,
          deleted: 0,
          other: 0,
        },
      ),
    [scopedItems],
  );
  const filtered = useMemo(
    () =>
      scopedItems.filter(
        (item) =>
          (category === "all" ||
            eventPresentation(item.eventType).category === category) &&
          (!query ||
            `${item.title} ${item.context || ""} ${item.details || ""} ${eventPresentation(item.eventType).label}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [scopedItems, category, query],
  );
  const categories: [HistoryCategory, string][] = [
    ["all", "All activity"],
    ["imported", "Imported"],
    ["grabbed", "Grabbed"],
    ["failed", "Failed"],
    ["changed", "Renamed & changed"],
    ["deleted", "Deleted"],
    ["other", "Other"],
  ];
  if (loading)
    return <RouteLoading route>Loading history…</RouteLoading>;
  if (loadError && !items.length)
    return <RouteError title="History unavailable" message={loadError}/>;
  return (
    <div className="react-history">
      {loadError ? <div className="notice warning"><strong>History refresh delayed.</strong><p>{loadError}</p></div> : null}
      <div className="hero">
        <div>
          <span className="eyebrow">ACTIVITY</span>
          <h1>History</h1>
          <p className="lede">
            A clear timeline of what each media engine did and what, if
            anything, you can do next.
          </p>
        </div>
        <button
          className="secondary"
          disabled={refreshing}
          onClick={() => void refresh(true)}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="history-summary" aria-label="History summary">
        <div>
          <strong>{scopedItems.length}</strong>
          <span>Total events</span>
        </div>
        <div>
          <strong>{counts.imported}</strong>
          <span>Imported</span>
        </div>
        <div>
          <strong>{counts.grabbed}</strong>
          <span>Grabbed</span>
        </div>
        <div className={counts.failed ? "has-warning" : ""}>
          <strong>{counts.failed}</strong>
          <span>Failed</span>
        </div>
      </div>
      <div className="history-help notice">
        <strong>When is “Organize again” available?</strong>
        <p>
          Only imported or previously renamed library items can be organized
          again. It moves and renames existing files using the engine’s current
          library and naming settings. Grabbed, deleted, and failed events are
          history records, so they do not show that action.
        </p>
      </div>
      <div className="react-history-toolbar">
        <EngineInstanceFilter instances={engineInstances} value={engineInstanceId} onChange={setEngineInstanceId}/>
        <label>
          Media library
          <select
            value={domain}
            onChange={(event) =>
              setDomain(event.target.value as HistoryDomainFilter)
            }
          >
            <option value="all">Movies &amp; television</option>
            <option value="movie">Movies only</option>
            <option value="tv">Television only</option>
          </select>
        </label>
        <label>
          Find activity
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, episode, or message"
          />
        </label>
        <label>
          Activity type
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as HistoryCategory)
            }
          >
            {categories.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
                {value === "all" ? ` (${scopedItems.length})` : ` (${counts[value]})`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="system-domain-grid">
        {domain !== "tv" ? <HistorySection
          domain="movie"
          items={filtered.filter((item) => item.domain === "movie")}
          options={options}
        /> : null}
        {domain !== "movie" ? <HistorySection
          domain="tv"
          items={filtered.filter((item) => item.domain === "tv")}
          options={options}
        /> : null}
      </div>
    </div>
  );
}
