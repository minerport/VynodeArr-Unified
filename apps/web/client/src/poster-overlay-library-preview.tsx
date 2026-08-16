import type { OverlayMedia, OverlayTemplate } from "./poster-overlays-types";
import { LibraryCardPreview } from "./library";
import type { LibraryItem, LibraryKind, LibraryView } from "./library-types";

export function ExactLibraryCardPreview({
  item,
  template,
  kind,
  view,
}: {
  item: OverlayMedia;
  template: OverlayTemplate;
  kind: LibraryKind;
  view: LibraryView;
}) {
  const draftLayerIds = new Set(template.layers.map((layer) => layer.id));
  const currentLayers = item.artwork?.overlayTemplate?.layers || [];
  const currentTemplateId = item.artwork?.overlayTemplateId || "";
  const retainedLayers =
    template.id && currentTemplateId === template.id
      ? []
      : currentLayers.filter(
          (layer) =>
            !draftLayerIds.has(layer.id) &&
            !(template.id && layer.id.startsWith(`${template.id}:`)),
        );
  const previewItem = {
    ...item,
    qualityProfile:
      item.qualityProfile == null ? undefined : String(item.qualityProfile),
    artwork: {
      ...item.artwork,
      overlayTemplate: {
        layers: [
          ...retainedLayers,
          ...template.layers,
        ],
      },
    },
  } as LibraryItem;

  return <LibraryCardPreview item={previewItem} kind={kind} view={view} />;
}

export function LibraryChrome({
  media,
  plex,
}: {
  media: OverlayMedia;
  plex?: OverlayTemplate["plexBadges"];
}) {
  const app = !plex;
  if (!app && !Object.values(plex).some(Boolean)) return null;
  return (
    <div className="overlay-library-chrome">
        <div>
          {app || plex.monitored ? (
            <span>
              {media.monitoring === "none" ? "UNMONITORED" : "MONITORED"}
            </span>
          ) : null}
          {app || plex.availability ? (
            <b>
              {media.hasFile || media.state === "available"
                ? "AVAILABLE"
                : "MISSING"}
            </b>
          ) : null}
          {app || plex.cutoff ? (
            <b>
              {media.state === "cutoff" || Number(media.cutoffUnmetEpisodes) > 0
                ? "× CUTOFF UNMET"
                : "✓ AT CUTOFF"}
            </b>
          ) : null}
        </div>
        {app ? (
          <>
            <strong>{media.title}</strong>
            <small>
              {[media.year, media.collection || media.network]
                .filter(Boolean)
                .join(" · ")}
            </small>
            <div className="overlay-library-actions">
              <span>{media.quality || "Not available"}</span>
              <span>Details</span>
              <span>
                {media.monitoring === "none" ? "Monitor" : "Unmonitor"}
              </span>
            </div>
          </>
        ) : null}
        {(app || plex.rating) && media.rating ? (
          <em>★ {media.rating.toFixed(1)}</em>
        ) : null}
    </div>
  );
}
export function PlexBadgeChoices({
  value,
  onChange,
}: {
  value?: OverlayTemplate["plexBadges"];
  onChange: (value: OverlayTemplate["plexBadges"]) => void;
}) {
  const current = {
    monitored: false,
    availability: false,
    cutoff: false,
    rating: false,
    ...value,
  };
  return (
    <fieldset>
      <legend>Plex artwork badges</legend>
      <small className="muted">
        Choose only the VynodeArr badges that should be baked into Plex artwork.
      </small>
      <div className="overlay-plex-badges">
        {(
          [
            ["monitored", "Monitoring"],
            ["availability", "Availability"],
            ["cutoff", "Quality cutoff"],
            ["rating", "Rating"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={current[key]}
              onChange={(event) =>
                onChange({ ...current, [key]: event.target.checked })
              }
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
