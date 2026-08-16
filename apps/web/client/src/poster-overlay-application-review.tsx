import { ModalPortal } from "./modal-portal";
import { LibraryCardPreview } from "./library";
import type { LibraryItem, LibraryKind, LibraryView } from "./library-types";
import type { OverlayLayer, OverlayMedia, OverlayTemplate } from "./poster-overlays-types";
import { overlayLayerVisible, resolveConditionalLayer } from "./poster-overlay-layer";
const valueFor = (
  layer: OverlayTemplate["layers"][number],
  item: OverlayMedia,
) => {
  if (layer.variable === "custom_text") return layer.label;
  const resolved = item.artwork?.overlayValues?.[layer.variable];
  if (resolved !== undefined) return resolved;
  if (layer.variable === "resolution")
    return (
      String(item.quality || "").match(/(?:2160|1080|720|480)p?/i)?.[0] || ""
    );
  if (layer.variable === "monitored")
    return item.monitoring === "none" ? "Unmonitored" : "Monitored";
  if (layer.variable === "availability")
    return item.hasFile || item.state === "available" ? "Available" : "Missing";
  const value = (item as unknown as Record<string, unknown>)[layer.variable];
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
};
export function buildApplicationReview(
  template: OverlayTemplate,
  label: string,
  scope: string,
  domain: string,
  mediaIds: string[],
  filters: {
    genres: string;
    yearFrom: string;
    yearTo: string;
    availability: string;
    monitoring: string;
  },
) {
  const from = Number(filters.yearFrom),
    to = Number(filters.yearTo || filters.yearFrom),
    years =
      Number.isFinite(from) && from > 1800
        ? Array.from(
            {
              length: Math.min(
                100,
                Math.max(1, (Number.isFinite(to) ? to : from) - from + 1),
              ),
            },
            (_, index) => from + index,
          )
        : [];
  return {
    template,
    label,
    mediaIds,
    payload: {
      templateId: template.id,
      name: `${template.name} — ${scope === "rules" ? "matching rules" : label}`,
      scope: {
        type: ["collection", "user-collection"].includes(scope)
          ? "items"
          : scope,
        domain,
        mediaIds: ["items", "collection", "user-collection"].includes(scope)
          ? mediaIds
          : [],
        rules: {
          genres: filters.genres
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          years,
          availability: filters.availability,
          monitoring: filters.monitoring,
        },
      },
    },
  };
}
export default function ApplicationReview({
  template,
  label,
  items,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  template: OverlayTemplate;
  label: string;
  items: OverlayMedia[];
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const assessed=items.map(item=>({item,visible:template.layers.filter(layer=>{const resolved=resolveConditionalLayer(layer,item.artwork?.overlayValues||{});return overlayLayerVisible(resolved,valueFor(resolved,item),item.artwork?.overlayValues||{});}).length})),willRender=assessed.filter(result=>result.visible>0).length,withoutVisibleLayers=assessed.length-willRender;
  const previewLayers = (layers: OverlayLayer[], source: "current" | "new") =>
    layers.map((layer, index) => ({
      ...layer,
      // Layer ids are only used as renderer keys in this review. Namespacing
      // prevents two independently-created templates from hiding one another
      // when they happen to use the same generated id.
      id: `review-${source}-${index}-${layer.id}`,
    }));
  const groups = (["movies", "tv"] as LibraryKind[])
    .map((kind) => ({
      kind,
      label: kind === "movies" ? "Movie library" : "TV library",
      item: items.find((item) =>
        kind === "tv"
          ? Boolean(item.episodeProgress || item.seasonProgress || item.network || item.firstAired)
          : !Boolean(item.episodeProgress || item.seasonProgress || item.network || item.firstAired),
      ),
    }))
    .filter((group) => group.item)
    .map((group) => {
      const item = group.item!;
      const existingLayers = item.artwork?.overlayTemplate?.layers || [];
      const combinedLayers = [
        ...previewLayers(existingLayers, "current"),
        ...previewLayers(template.layers, "new"),
      ];
      return {
        ...group,
        currentPreview: {
          ...item,
          artwork: {
            ...item.artwork,
            overlayTemplate: { layers: previewLayers(existingLayers, "current") },
          },
        } as LibraryItem,
        afterPreview: {
          ...item,
          artwork: {
            ...item.artwork,
            overlayTemplate: { layers: combinedLayers },
          },
        } as LibraryItem,
      };
    });
  if (!groups.length && items[0]) {
    const item = items[0];
    groups.push({
      kind: template.domain === "tv" ? "tv" : "movies",
      label: template.domain === "tv" ? "TV library" : "Movie library",
      item,
      currentPreview: {
        ...item,
        artwork: {
          ...item.artwork,
          overlayTemplate: {
            layers: previewLayers(item.artwork?.overlayTemplate?.layers || [], "current"),
          },
        },
      } as LibraryItem,
      afterPreview: {
        ...item,
        artwork: {
          ...item.artwork,
          overlayTemplate: {
            layers: [
              ...previewLayers(item.artwork?.overlayTemplate?.layers || [], "current"),
              ...previewLayers(template.layers, "new"),
            ],
          },
        },
      } as LibraryItem,
    });
  }
  const views: Array<{ view: LibraryView; label: string }> = [
    { view: "poster", label: "Poster grid" },
    { view: "cards", label: "Information cards" },
    { view: "compact", label: "Compact grid" },
    { view: "list", label: "Detailed list" },
  ];
  return (
    <ModalPortal>
      <div className="overlay-editor-backdrop">
        <section
          className="overlay-editor"
          role="dialog"
          aria-modal="true"
          aria-labelledby="overlay-apply-title"
        >
          <header className="panel-heading">
            <div>
              <span className="eyebrow">VYNODEARR APPLICATION</span>
              <h2 id="overlay-apply-title">Review poster assignment</h2>
            </div>
            <button className="secondary" onClick={onCancel}>
              Close
            </button>
          </header>
          <div className="overlay-application-review-grid">
            <aside className="overlay-application-details" aria-label="Assignment details">
              <div className="notice">
                <strong>{template.name}</strong>
                <p>
                  Add this style to {label}. It will be combined with any other compatible VynodeArr styles already assigned to the same titles. Custom layers render above the poster, status badges, and card details.
                </p>
              </div>
              <div className="overlay-application-summary" aria-label="Application summary">
                <div><strong>{items.length||"Dynamic"}</strong><small>titles in scope</small></div>
                <div><strong>{items.length?willRender:"Evaluated live"}</strong><small>currently receive a visible layer</small></div>
                <div><strong>{items.length?withoutVisibleLayers:"—"}</strong><small>currently skipped by layer conditions</small></div>
                <div><strong>{template.layers.filter(layer=>layer.enabled).length}</strong><small>enabled layers per matching title</small></div>
              </div>
              {withoutVisibleLayers?<div className="notice warning"><strong>Some titles do not currently match a visible layer</strong><p>They remain in the assignment and will be reevaluated automatically when their metadata changes.</p></div>:null}
              {busy?<div className="notice" role="status" aria-live="polite"><strong>Applying reviewed assignment…</strong><p>The assignment is being saved. Keep this window open until it completes.</p></div>:null}
              {error?<div className="notice warning" role="alert"><strong>Application failed</strong><p>{error}</p><small>No assignment was saved. Correct the problem or retry safely.</small></div>:null}
              <div className="overlay-media-picker">
                {items.slice(0, 8).map((item) => (
                  <label key={item.id}>
                    {item.artwork?.url ? (
                      <img
                        src={item.artwork.originalUrl || item.artwork.url}
                        alt=""
                      />
                    ) : null}
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.year || "Year unknown"}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="notice warning">
                <strong>Safe and reversible</strong>
                <p>
                  Original artwork remains available. Removing this assignment
                  restores it immediately.
                </p>
              </div>
            </aside>
            <div className="panel overlay-review-preview">
              <header className="overlay-review-preview-heading">
                <div>
                  <span className="eyebrow">EXACT LIBRARY PREVIEW</span>
                  <h3>{label}</h3>
                  <small className="muted">
                    Exact before and after using the same cards and layouts as the live Movies and TV pages.
                  </small>
                </div>
                <span className="badge">{template.layers.length} new layer{template.layers.length === 1 ? "" : "s"}</span>
              </header>
              {groups.length ? groups.map((group) => (
                <section className="overlay-review-library" key={group.kind}>
                  <div className="overlay-review-library-heading">
                    <div><strong>{group.label}</strong><small>{group.afterPreview.title} · {group.afterPreview.year || "Year unknown"}</small></div>
                    <span className="badge green">Current + new overlays</span>
                  </div>
                  <div className="overlay-review-views">
                    {views.map(({ view, label: viewLabel }) => (
                      <figure className={`overlay-review-view overlay-review-view-${view}`} key={view}>
                        <figcaption>{viewLabel}</figcaption>
                        <div className="overlay-review-comparison">
                          <div>
                            <small>Current library</small>
                            <LibraryCardPreview item={group.currentPreview} kind={group.kind} view={view} />
                          </div>
                          <div>
                            <small>After assignment</small>
                            <LibraryCardPreview item={group.afterPreview} kind={group.kind} view={view} />
                          </div>
                        </div>
                      </figure>
                    ))}
                  </div>
                </section>
              )) : <div className="empty"><strong>Live preview unavailable</strong><p>Matching titles will be evaluated as they enter this dynamic scope.</p></div>}
            </div>
          </div>
          <footer className="overlay-editor-footer">
            <button className="secondary" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
            <button className="primary" disabled={busy} onClick={onConfirm}>
              {busy ? "Applying…" : error ? "Retry application" : "Apply to VynodeArr"}
            </button>
          </footer>
        </section>
      </div>
    </ModalPortal>
  );
}
