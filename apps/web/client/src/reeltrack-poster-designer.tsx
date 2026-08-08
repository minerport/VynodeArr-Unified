import { useEffect, useMemo, useState } from "react";
import { ModalPortal } from "./modal-portal";
import type { OverlayLayer, OverlayTemplate } from "./poster-overlays-types";

const variables = [
  "custom_text", "collection_name", "collection_title_count", "collection_media_type",
  "collection_last_sync", "title", "year", "rating", "quality", "resolution",
  "availability", "library_status", "release_date", "genres", "studio",
];
const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);
const layer = (kind: OverlayLayer["kind"] = "text"): OverlayLayer => ({
  id: `layer_${uid()}`, label: kind === "text" ? "Collection name" : "", variable: kind === "text" ? "collection_name" : "custom_text",
  kind, iconName: "movie", contentPosition: "none", position: "custom", x: kind === "shape" ? 0 : 8,
  y: kind === "shape" ? 0 : 72, width: kind === "shape" ? 100 : 84, height: kind === "shape" ? 100 : 0,
  prefix: "", suffix: "", foreground: "#ffffff", background: kind === "shape" ? "#08111f" : "#111827",
  fontSize: 42, fontFamily: "sans", fontWeight: 700, textAlign: "left", textTransform: "none",
  textOpacity: 1, backgroundOpacity: kind === "shape" ? 1 : .86, posterAware: false, shape: "rounded",
  padding: 12, borderRadius: 18, enabled: true, condition: { operator: "truthy", value: "" },
  conditions: { join: "and", rules: [{ variable: kind === "text" ? "collection_name" : "custom_text", operator: "truthy", value: "" }] },
  styleMode: "first", styleRules: [],
});
export const newReeltrackPosterTemplate = (mode: "collection" | "title"): OverlayTemplate => {
  const background = layer("shape"), heading = layer("text");
  heading.label = mode === "collection" ? "Collection name" : "Title";
  heading.variable = mode === "collection" ? "collection_name" : "title";
  heading.conditions.rules[0].variable = heading.variable;
  return { id: `overlay_${uid()}`, name: mode === "collection" ? "Collection poster" : "Collection title overlay", domain: "all", target: "plex", enabled: true, tvFileAggregation: "most_common", layers: mode === "collection" ? [background, heading] : [heading], plexBadges: { monitored: false, availability: false, cutoff: false, rating: false } };
};

type Props = {
  mode: "collection" | "title";
  template: OverlayTemplate | null;
  collectionName: string;
  titleCount: number;
  sample?: { domain: "movie" | "tv"; tmdbId?: number | null; title: string; year?: number | null };
  request: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  onClose: () => void;
  onSave: (template: OverlayTemplate) => void;
};

export function ReeltrackPosterDesigner({ mode, template, collectionName, titleCount, sample, request, onClose, onSave }: Props) {
  const [editing, setEditing] = useState<OverlayTemplate>(() => structuredClone(template || newReeltrackPosterTemplate(mode))),
    [selectedId, setSelectedId] = useState(""), [preview, setPreview] = useState(""), [previewing, setPreviewing] = useState(false), [error, setError] = useState("");
  const selected = editing.layers.find((value) => value.id === selectedId) || editing.layers.at(-1), domain = sample?.domain || "movie";
  const updateLayer = (changes: Partial<OverlayLayer>) => selected && setEditing((current) => ({ ...current, layers: current.layers.map((value) => value.id === selected.id ? { ...value, ...changes } : value) }));
  const add = (kind: OverlayLayer["kind"]) => { const value = layer(kind); setEditing((current) => ({ ...current, layers: [...current.layers, value] })); setSelectedId(value.id); };
  const previewKey = useMemo(() => JSON.stringify([editing, collectionName, titleCount, sample]), [editing, collectionName, titleCount, sample]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!editing.layers.length) return;
      setPreviewing(true); setError("");
      void request<{ image: string }>("/api/reeltrack/poster-design/preview", { method: "POST", body: JSON.stringify({ mode, template: editing, domain, tmdbId: sample?.tmdbId, title: sample?.title, year: sample?.year, collectionName, titleCount }) })
        .then((value) => setPreview(value.image)).catch((reason) => setError(reason instanceof Error ? reason.message : "Preview failed")).finally(() => setPreviewing(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [previewKey]);
  return <ModalPortal><div className="overlay-editor-backdrop" role="presentation"><section className="overlay-editor reeltrack-poster-designer" style={{width:"min(1180px,100%)",height:"min(880px,100%)"}} role="dialog" aria-modal="true">
    <div className="panel-heading"><div><span className="eyebrow">{mode === "collection" ? "COLLECTION POSTER" : "TITLE OVERLAY"}</span><h2>Design artwork</h2></div><button className="secondary" onClick={onClose}>Close</button></div>
    <div style={{ display: "grid", gridTemplateColumns: "240px minmax(340px,1fr) minmax(280px,360px)", gap: 16, minHeight: 0, padding: 16, overflow: "auto" }}>
      <aside className="panel" style={{ padding: 14, overflow: "auto" }}><label>Design name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })}/></label><div className="panel-heading"><strong>Layers</strong></div>
        <div className="overlay-layer-list">{editing.layers.map((value, index) => <button key={value.id} className={value.id === selected?.id ? "active secondary" : "secondary"} onClick={() => setSelectedId(value.id)}><span>{index + 1}</span><strong>{value.kind === "shape" ? `${value.shape} shape` : value.variable.replaceAll("_", " ")}</strong></button>)}</div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}><button className="secondary" onClick={() => add("text")}>Add text</button><button className="secondary" onClick={() => add("shape")}>Add shape</button></div>
      </aside>
      <main className="panel" style={{ padding: 14, overflow: "auto" }}>{selected ? <div className="overlay-layer-body" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
        <label style={{ gridColumn: "1/-1" }}><input type="checkbox" checked={selected.enabled} onChange={(event) => updateLayer({ enabled: event.target.checked })}/> Show layer</label>
        {selected.kind === "text" ? <><label>Content<select value={selected.variable} onChange={(event) => updateLayer({ variable: event.target.value, conditions: { ...selected.conditions, rules: selected.conditions.rules.map((rule, index) => index ? rule : { ...rule, variable: event.target.value }) } })}>{variables.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>{selected.variable === "custom_text" ? <label>Text<input value={selected.label} onChange={(event) => updateLayer({ label: event.target.value })}/></label> : null}<label>Prefix<input value={selected.prefix} onChange={(event) => updateLayer({ prefix: event.target.value })}/></label><label>Suffix<input value={selected.suffix} onChange={(event) => updateLayer({ suffix: event.target.value })}/></label></> : <label>Shape<select value={selected.shape} onChange={(event) => updateLayer({ shape: event.target.value as OverlayLayer["shape"] })}>{["rounded","square","pill","circle","ticket","ribbon","tag","hexagon","chevron"].map((value) => <option key={value}>{value}</option>)}</select></label>}
        <label>X (%)<input type="number" min="0" max="100" value={selected.x} onChange={(event) => updateLayer({ x: Number(event.target.value) })}/></label><label>Y (%)<input type="number" min="0" max="100" value={selected.y} onChange={(event) => updateLayer({ y: Number(event.target.value) })}/></label><label>Width (%)<input type="number" min="15" max="100" value={selected.width} onChange={(event) => updateLayer({ width: Number(event.target.value) })}/></label><label>Height (%)<input type="number" min="0" max="100" value={selected.height} onChange={(event) => updateLayer({ height: Number(event.target.value) })}/></label>
        <label>Text color<input type="color" value={selected.foreground} onChange={(event) => updateLayer({ foreground: event.target.value })}/></label><label>Background<input type="color" value={selected.background} onChange={(event) => updateLayer({ background: event.target.value })}/></label><label>Background opacity<input type="range" min="0" max="1" step=".05" value={selected.backgroundOpacity} onChange={(event) => updateLayer({ backgroundOpacity: Number(event.target.value) })}/></label><label>Font size<input type="number" min="12" max="96" value={selected.fontSize} onChange={(event) => updateLayer({ fontSize: Number(event.target.value) })}/></label>
        <label>Alignment<select value={selected.textAlign} onChange={(event) => updateLayer({ textAlign: event.target.value as OverlayLayer["textAlign"] })}><option>left</option><option>center</option><option>right</option></select></label><label>Weight<select value={selected.fontWeight} onChange={(event) => updateLayer({ fontWeight: Number(event.target.value) as OverlayLayer["fontWeight"] })}>{[400,500,600,700,800,900].map((value) => <option key={value}>{value}</option>)}</select></label>
        <button className="danger" style={{ gridColumn: "1/-1" }} onClick={() => setEditing((current) => ({ ...current, layers: current.layers.filter((value) => value.id !== selected.id) }))}>Remove layer</button>
      </div> : <div className="empty compact">Add a text or shape layer.</div>}</main>
      <aside className="panel" style={{ padding: 14, textAlign: "center" }}><strong>Exact Plex preview</strong><div style={{ aspectRatio: "2/3", marginTop: 12, borderRadius: 10, overflow: "hidden", background: "#08111f" }}>{preview ? <img src={preview} alt="Poster preview" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : null}</div><small className="muted">{previewing ? "Rendering…" : error || "Rendered by the same server pipeline used for Plex."}</small></aside>
    </div>
    <div className="overlay-editor-footer"><span className="overlay-save-guidance">Save automation afterward to apply this design now and on every sync.</span><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={!editing.layers.length} onClick={() => onSave(editing)}>Use design</button></div>
  </section></div></ModalPortal>;
}
