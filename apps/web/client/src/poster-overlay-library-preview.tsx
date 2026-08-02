import type { OverlayMedia, OverlayTemplate } from "./poster-overlays-types";
const previewLayout = `@media(min-width:801px){.overlay-preview-column{grid-template-columns:1fr 1fr}.overlay-preview-column>.overlay-preview-hint,.overlay-preview-column>.overlay-preview,.overlay-preview-column>p:last-child{grid-column:1/-1}.overlay-preview-column>.overlay-preview{width:240px}}`;
const previewStyles = `.overlay-preview{box-shadow:none}.overlay-preview:before{position:absolute;inset:0;z-index:0;background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,.45));content:"";pointer-events:none}.overlay-preview-layer{z-index:3}`;
const exactStyles = `.overlay-library-chrome{z-index:2;gap:.25rem;padding:5rem .7rem .58rem;background:linear-gradient(180deg,transparent 0%,rgba(4,8,16,.76) 42%,rgba(4,8,16,.98) 100%)}.overlay-library-chrome>div{gap:.32rem}.overlay-library-chrome>div>*{min-height:1.15rem;padding:.18rem .36rem;border-radius:999px;font-size:.58rem;line-height:1}.overlay-library-chrome strong{padding-right:3.3rem;font-size:1rem;line-height:1.18}.overlay-library-chrome small{font-size:.72rem}.overlay-library-chrome em{right:.7rem;bottom:2.05rem;padding:.2rem .38rem;border:1px solid rgba(255,210,83,.25);border-radius:999px;background:rgba(9,13,22,.82);font-size:.68rem}.overlay-library-actions{gap:.3rem;margin-top:.18rem}.overlay-library-actions span{padding:.2rem .38rem;border:1px solid rgba(116,136,174,.48);border-radius:999px;font-size:.6rem;line-height:1.15}`;
const editorStyles = `.overlay-range{display:grid!important;grid-template-columns:1fr auto;gap:6px}.overlay-range span{color:var(--muted);font-variant-numeric:tabular-nums}.overlay-range input{grid-column:1/-1;width:100%}.overlay-resize-handle{position:absolute;right:-3px;bottom:-3px;width:14px;height:14px;border:2px solid #fff;border-radius:50%;background:#2787ff;cursor:ew-resize;box-shadow:0 1px 5px #000}.overlay-preview-hint{margin:0;color:var(--muted);text-align:center;font-size:.85rem}`;
const inputStyles = `.overlay-preview .poster-overlay-layer{pointer-events:auto!important}.overlay-resize-handle{right:2px;bottom:2px}`;
const styles = `.overlay-library-chrome{position:absolute;inset:auto 0 0;z-index:1;display:grid;gap:4px;padding:44px 10px 10px;background:linear-gradient(transparent,#020817 40%);pointer-events:none}.overlay-library-chrome>div{display:flex;flex-wrap:wrap;gap:4px;color:#8ef0bd;font-size:8px}.overlay-library-chrome b,.overlay-library-actions span{padding:3px 5px;border-radius:8px;background:#174733}.overlay-library-chrome strong{font-size:16px;line-height:1.05}.overlay-library-chrome small{color:var(--muted)}.overlay-library-chrome em{position:absolute;right:9px;bottom:34px;color:#ffd746}.overlay-library-actions{display:grid!important;grid-template-columns:1fr auto auto;color:#dbe5f6!important}.overlay-library-actions span{overflow:hidden;background:#07101dcc;text-overflow:ellipsis;white-space:nowrap}.overlay-plex-badges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.overlay-plex-badges label{display:flex;align-items:center;gap:7px}`;
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
    <>
      <style>
        {styles + editorStyles + exactStyles + previewStyles + previewLayout + inputStyles}
      </style>
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
    </>
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
      <style>
        {styles + editorStyles + exactStyles + previewStyles + previewLayout + inputStyles}
      </style>
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
