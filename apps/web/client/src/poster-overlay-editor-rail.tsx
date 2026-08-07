import type { CSSProperties } from "react";
import type { OverlayDomain, OverlayLayer, OverlayTemplate } from "./poster-overlays-types";
import { PosterIcon, posterIcons } from "./poster-overlay-icons";
import "./poster-overlay-editor-layout";

const shapes: Array<[OverlayLayer["shape"], string, CSSProperties]> = [
  ["rounded", "Rounded", { borderRadius: 6 }],
  ["square", "Square", {}],
  ["pill", "Pill", { borderRadius: 999 }],
  ["circle", "Circle", { borderRadius: "50%", aspectRatio: "1" }],
  ["ticket", "Ticket", { clipPath: "polygon(4% 0,96% 0,100% 22%,96% 50%,100% 78%,96% 100%,4% 100%,0 78%,4% 50%,0 22%)" }],
  ["ribbon", "Ribbon", { clipPath: "polygon(0 0,94% 0,100% 50%,94% 100%,0 100%,5% 50%)" }],
  ["tag", "Tag", { clipPath: "polygon(0 0,88% 0,100% 50%,88% 100%,0 100%)" }],
  ["hexagon", "Hexagon", { clipPath: "polygon(8% 0,92% 0,100% 50%,92% 100%,8% 100%,0 50%)" }],
  ["chevron", "Chevron", { clipPath: "polygon(0 0,88% 0,100% 50%,88% 100%,0 100%,12% 50%)" }],
];

const css = `.overlay-layer-list{display:grid;gap:6px}.overlay-layer-list button{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;align-items:center;width:100%;padding:8px;text-align:left}.overlay-layer-list button.active{border-color:var(--accent);background:rgba(72,95,190,.22)}.overlay-layer-list strong,.overlay-layer-list small{min-width:0}.overlay-layer-list strong{overflow:hidden;text-overflow:ellipsis}.overlay-layer-list small{color:var(--muted)}.overlay-icon-library{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.overlay-icon-library button{display:grid;gap:3px;min-width:0;padding:7px 3px;place-items:center}.overlay-icon-library svg{width:20px}.overlay-icon-library span{max-width:100%;overflow:hidden;font-size:.58rem;text-overflow:ellipsis}.overlay-shape-library{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.overlay-shape-library button{display:grid;gap:5px;min-width:0;padding:6px;place-items:center}.overlay-shape-library button.active{border-color:var(--accent)}.overlay-shape-swatch{display:block;width:34px;height:18px;background:linear-gradient(135deg,var(--accent),#31d6c7)}.overlay-shape-library small{font-size:.58rem}@media(max-width:980px){.overlay-icon-library{grid-template-columns:repeat(6,minmax(0,1fr))}}@media(max-width:600px){.overlay-icon-library{grid-template-columns:repeat(4,minmax(0,1fr))}}`;

type Props = {
  editing: OverlayTemplate;
  selectedId: string;
  query: string;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onChange: (changes: Partial<OverlayTemplate>) => void;
  onAddText: () => void;
  onAddIcon: (name: string) => void;
  onAddShape: (shape: OverlayLayer["shape"]) => void;
};

export default function EditorRail({ editing, selectedId, query, onQuery, onSelect, onChange, onAddText, onAddIcon, onAddShape }: Props) {
  const icons = posterIcons.filter(([, label]) => !query || label.toLowerCase().includes(query.toLowerCase()));
  return (
    <aside className="overlay-editor-rail">
      <style>{css}</style>
      <div className="overlay-setup-heading">
        <span className="eyebrow">1 · SETUP</span>
        <small className="muted">Name the style and choose one media library.</small>
      </div>
      <label>Name<input value={editing.name} maxLength={80} onChange={event => onChange({ name: event.target.value })} /></label>
      <label>
        Applies to
        <select value={editing.domain} onChange={event => onChange({ domain: event.target.value as OverlayDomain })}>
          <option value="" disabled>Choose Movies or Television</option>
          {editing.domain === "all" ? <option value="all" disabled>Movies &amp; television (legacy)</option> : null}
          <option value="movie">Movies</option>
          <option value="tv">Television</option>
        </select>
      </label>
      {editing.domain === "tv" ? (
        <label>
          TV file metadata
          <small className="muted">How episode files become one series-poster value</small>
          <select value={editing.tvFileAggregation || "most_common"} onChange={event => onChange({ tvFileAggregation: event.target.value as OverlayTemplate["tvFileAggregation"] })}>
            <option value="most_common">Most common</option><option value="best">Best available</option><option value="lowest">Lowest available</option><option value="mixed">Show Mixed when different</option><option value="latest">Latest episode file</option>
          </select>
        </label>
      ) : null}
      <div className="panel-heading">
        <div><span className="eyebrow">2 · DESIGN</span><h3>Layers</h3></div>
        <button className="secondary" onClick={onAddText}>Add text</button>
      </div>
      {!editing.layers.length ? <p className="muted overlay-layer-list-empty">Start with text, a shape, or an icon.</p> : null}
      <div className="overlay-layer-list">
        {editing.layers.map((layer, index) => (
          <button className={layer.id === selectedId ? "active secondary" : "secondary"} onClick={() => onSelect(layer.id)} key={layer.id}>
            <span>{index + 1}</span>
            <strong>{layer.kind === "icon" ? posterIcons.find(([id]) => id === layer.iconName)?.[1] || "Icon" : layer.kind === "shape" ? `${layer.shape} shape` : layer.variable.replaceAll("_", " ")}</strong>
            <small>{layer.enabled ? "On" : "Off"}</small>
          </button>
        ))}
      </div>
      <div><h3>Add shape</h3><small className="muted">Creates an independent shape layer</small></div>
      <div className="overlay-shape-library">
        {shapes.map(([id, label, style]) => <button className="secondary" title={`Add ${label} shape`} onClick={() => onAddShape(id)} key={id}><span className="overlay-shape-swatch" style={style} /><small>{label}</small></button>)}
      </div>
      <div><h3>Media icons</h3><input aria-label="Find media icons" placeholder="Find icons" value={query} onChange={event => onQuery(event.target.value)} /></div>
      <div className="overlay-icon-library">
        {icons.map(([id, label]) => <button className="secondary" title={`Add ${label} icon`} onClick={() => onAddIcon(id)} key={id}><PosterIcon name={id} /><span>{label}</span></button>)}
      </div>
    </aside>
  );
}
