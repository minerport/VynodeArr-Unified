import { ModalPortal } from "./modal-portal";
import type { OverlayMedia, OverlayTemplate } from "./poster-overlays-types";
import { LibraryChrome } from "./poster-overlay-library-preview";
import { OverlayLayerView, overlayLayerVisible, resolveConditionalLayer } from "./poster-overlay-layer";
import { PosterLayerContent } from "./poster-overlay-icons";
const previewStyles = `.overlay-application-preview{position:relative;width:min(240px,100%);aspect-ratio:2/3;overflow:hidden;border:1px solid var(--border);border-radius:14px;background:center/cover}.overlay-application-preview>span{position:absolute;z-index:3;overflow:hidden;padding:4px 6px;line-height:1.1;white-space:nowrap}.overlay-review-preview{display:grid;justify-items:center;gap:8px}`;
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
  onCancel,
  onConfirm,
}: {
  template: OverlayTemplate;
  label: string;
  items: OverlayMedia[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const sample = items[0];
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
          <div className="overlay-editor-grid">
            <div className="overlay-editor-fields">
              <div className="notice">
                <strong>{template.name}</strong>
                <p>
                  Apply this style to {label}. Custom layers render above the
                  poster, status badges, and card details.
                </p>
              </div>
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
            </div>
            <div className="panel overlay-review-preview">
              <style>{previewStyles}</style>
              <span className="eyebrow">SCOPE</span>
              <h3>{label}</h3>
              <small className="muted">
                {items.length
                  ? `${items.length} current title${items.length === 1 ? "" : "s"} included`
                  : "Titles will be matched dynamically"}
              </small>
              <p>
                {template.layers.length} custom layer
                {template.layers.length === 1 ? "" : "s"} will render above
                VynodeArr’s live card information.
              </p>
              {sample ? (
                <>
                  <strong>Final VynodeArr preview</strong>
                  <div
                    className="overlay-application-preview"
                    style={{
                      containerType: "inline-size",
                      backgroundImage: `url(${sample.artwork?.originalUrl || sample.artwork?.url})`,
                    }}
                  >
                    {template.layers.map((layer) => {
                      const resolvedLayer=resolveConditionalLayer(layer,sample.artwork?.overlayValues||{}),value=valueFor(resolvedLayer,sample);
                      return overlayLayerVisible(resolvedLayer,value,sample.artwork?.overlayValues||{}) ? (
                        <OverlayLayerView
                          key={layer.id}
                          layer={resolvedLayer}
                        >
                          <PosterLayerContent layer={resolvedLayer} text={`${resolvedLayer.prefix}${value}${resolvedLayer.suffix}`} />
                        </OverlayLayerView>
                      ) : null;
                    })}
                    <LibraryChrome media={sample} />
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <footer className="overlay-editor-footer">
            <button className="secondary" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
            <button className="primary" disabled={busy} onClick={onConfirm}>
              {busy ? "Applying…" : "Apply to VynodeArr"}
            </button>
          </footer>
        </section>
      </div>
    </ModalPortal>
  );
}
