import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { ServiceTabs } from "./service-tabs";
import { ModalPortal } from "./modal-portal";
import type {
  OverlayAssignment,
  OverlayCollection,
  OverlayDomain,
  OverlayLayer,
  OverlayMedia,
  OverlayPosition,
  OverlayTemplate,
  OverlayUserCollection,
  PosterOverlayMountOptions,
} from "./poster-overlays-types";
import {
  OverlayLayerView,
  overlayConditionStatus,
  overlayClientId,
  overlayLayerVisible,
  resolveConditionalLayer,
} from "./poster-overlay-layer";
import { hydratePreviewValues, PosterLayerContent, resolveLayerContent } from "./poster-overlay-icons";
import { overlayLayerFromPreset } from "./poster-overlay-item-presets";
import { accessibilityIssues, nudgeLayers, transformLayers, type AlignmentAction } from "./poster-overlay-editor-tools";
import { errorMessage } from "./shell-utils";
import "./poster-overlay-inspector.css";
import "./poster-overlays-runtime.css";
const styles = `.poster-overlay-route{display:grid;gap:20px}.overlay-studio-grid{display:grid;grid-template-columns:minmax(320px,.8fr) minmax(420px,1.2fr);gap:20px}.overlay-template-list{display:grid;gap:14px}.overlay-template-card{display:grid;grid-template-columns:92px 1fr;gap:14px;align-items:center;padding:12px;border:1px solid var(--border);border-radius:14px}.overlay-template-card small,.overlay-media-picker small{display:block;color:var(--muted)}.overlay-preview{position:relative;width:min(100%,300px);aspect-ratio:2/3;overflow:hidden;border:1px solid var(--border);border-radius:14px;background:linear-gradient(145deg,#24324b,#07101d 62%,#02060d) center/cover;box-shadow:inset 0 -100px 80px -70px #000}.overlay-preview-layer{font-weight:800}.overlay-scope-row,.overlay-layer-editor{display:grid;grid-template-columns:1fr 1fr;gap:10px}.overlay-media-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:360px;overflow:auto}.overlay-media-picker label{display:grid;grid-template-columns:auto 38px 1fr;gap:8px;align-items:center;padding:8px;border:1px solid var(--border);border-radius:10px}.overlay-media-picker img{width:38px;aspect-ratio:2/3;object-fit:cover}.overlay-editor-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:#000c}.overlay-editor{display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(1100px,100%);max-height:calc(100dvh - 40px);overflow:hidden;border:1px solid var(--border);border-radius:18px;background:var(--panel,#08111f)}.overlay-editor-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;overflow:auto;padding:20px}.overlay-editor-fields{display:grid;gap:12px}.overlay-layer-editor{padding:12px;border:1px solid var(--border);border-radius:12px}.overlay-preview-column{display:grid;align-content:start;justify-items:center;gap:10px;position:sticky;top:0}.overlay-editor-footer{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid var(--border)}@media(max-width:800px){.overlay-studio-grid,.overlay-scope-row,.overlay-media-picker,.overlay-editor-grid,.overlay-layer-editor{grid-template-columns:1fr}.overlay-editor-backdrop{padding:0}.overlay-editor{width:100%;height:100dvh;max-height:none;border:0;border-radius:0}.overlay-editor-grid{padding:14px}.overlay-preview-column{position:static;order:-1}.overlay-preview-column .overlay-preview{width:180px}.poster-overlay-route .hero>.primary{width:100%}}`;
const responsiveLayoutStyles = `.poster-overlay-route{min-width:0}.poster-overlay-route .hero h1{font-size:clamp(2rem,5vw,4rem);overflow-wrap:anywhere}.poster-overlay-route>.settings-tabs{display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;padding:8px}.poster-overlay-route>.settings-tabs a{flex:0 0 auto;min-width:max-content;padding:10px 14px}.overlay-new-action{display:flex;align-items:center;gap:8px}.overlay-template-card{grid-template-columns:76px minmax(0,1fr);min-width:0}.overlay-template-card>.overlay-preview{width:76px}.overlay-template-content{min-width:0}.overlay-template-content .form-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.overlay-template-content button{width:100%;min-width:0}@media(max-width:800px){.poster-overlay-route{gap:14px}.poster-overlay-route>.panel{padding:14px}.overlay-studio-grid{grid-template-columns:1fr}.overlay-template-list{gap:10px}}@media(max-width:600px){.poster-overlay-route>.settings-tabs a{padding:9px 12px}.overlay-template-panel>.panel-heading{align-items:stretch}.overlay-template-panel .panel-heading .badge{align-self:flex-start}.overlay-new-action{display:grid;grid-template-columns:auto 1fr;width:100%}.overlay-new-action button{min-height:44px}.overlay-template-card{grid-template-columns:64px minmax(0,1fr);align-items:center;gap:10px;padding:10px}.overlay-template-card>.overlay-preview{width:64px}.overlay-template-content{display:grid;gap:5px}.overlay-template-content .form-actions{grid-template-columns:repeat(3,minmax(0,1fr));position:static;margin:3px 0 0;padding:0;border:0;background:none;backdrop-filter:none}.overlay-template-content button{min-height:44px;padding:6px 3px;font-size:.78rem}}`;
const LibraryChrome = lazy(() =>
  import("./poster-overlay-library-preview").then((module) => ({
    default: module.LibraryChrome,
  })),
);
const PlexBadgeChoices = lazy(() =>
  import("./poster-overlay-library-preview").then((module) => ({
    default: module.PlexBadgeChoices,
  })),
);
const PlexConnectionPanel = lazy(() =>
  import("./poster-overlays-plex").then((module) => ({
    default: module.PlexConnectionPanel,
  })),
);
const ApplicationReview = lazy(
  () => import("./poster-overlay-application-review"),
);
const OverlayWorkspaceOverview = lazy(
  () => import("./overlay-workspace-overview"),
);
const EditorRail = lazy(() => import("./poster-overlay-editor-rail"));
const LayerIdentity = lazy(() => import("./poster-overlay-layer-identity"));
const OverlayConditions = lazy(() => import("./poster-overlay-conditions"));
const OverlayCanvasTools = lazy(() => import("./poster-overlay-canvas-tools"));
const OverlayImportReview = lazy(() => import("./poster-overlay-import-review"));
const OverlayQuality = lazy(() => import("./poster-overlay-quality"));
type CanvasView = import("./poster-overlay-canvas-tools").OverlayCanvasView;
type TemplateIssue = import("./poster-overlay-quality").TemplateIssue;

const positions: OverlayPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "custom",
];
const positionCoordinates: Record<OverlayPosition, [number, number]> = {
  "top-left": [5, 5],
  "top-center": [30, 5],
  "top-right": [55, 5],
  "bottom-left": [5, 88],
  "bottom-center": [30, 88],
  "bottom-right": [55, 88],
  custom: [5, 5],
};
const blankLayer = (variable = "title"): OverlayLayer => ({
  id: `layer_${overlayClientId()}`,
  label:
    variable === "custom_text"
      ? "Custom badge"
      : variable === "icon"
        ? "movie"
        : `{${variable}}`,
  variable,
  kind: "text",
  iconName: "movie",
  contentPosition: "none",
  position: "bottom-left",
  x: 5,
  y: 88,
  width: 40,
  height: 0,
  prefix: "",
  suffix: "",
  foreground: "#ffffff",
  background: "#111827",
  fontSize: 32,
  fontFamily: "sans",
  fontWeight: 700,
  textAlign: "left",
  textTransform: "none",
  textOpacity: 1,
  backgroundOpacity: 0.92,
  posterAware: false,
  shape: "rounded",
  padding: 12,
  borderRadius: 18,
  enabled: true,
  condition: { operator: "truthy", value: "" },
  conditions: {
    join: "and",
    rules: [{ variable, operator: "truthy", value: "" }],
  },
  styleMode: "first",
  styleRules: [],
});
const blankTemplate = (): OverlayTemplate => ({
  id: "",
  name: "New poster style",
  domain: "" as OverlayDomain,
  target: "" as "vynode",
  enabled: true,
  previewPosterKey: "",
  tvFileAggregation: "most_common",
  layers: [],
  plexBadges: {
    monitored: false,
    availability: false,
    cutoff: false,
    rating: false,
  },
});
type EditorHistory = { present: OverlayTemplate | null; past: OverlayTemplate[]; future: OverlayTemplate[] };
type EditorHistoryAction =
  | { type: "set"; value: SetStateAction<OverlayTemplate | null> }
  | { type: "undo" }
  | { type: "redo" };
const editorHistoryReducer = (state: EditorHistory, action: EditorHistoryAction): EditorHistory => {
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    return previous ? { present: previous, past: state.past.slice(0, -1), future: state.present ? [state.present, ...state.future].slice(0, 40) : state.future } : state;
  }
  if (action.type === "redo") {
    const next = state.future[0];
    return next ? { present: next, past: state.present ? [...state.past, state.present].slice(-40) : state.past, future: state.future.slice(1) } : state;
  }
  const next = typeof action.value === "function" ? action.value(state.present) : action.value;
  if (!state.present || !next) return { present: next, past: [], future: [] };
  return { present: next, past: [...state.past, state.present].slice(-40), future: [] };
};
const errorText = (reason: unknown) =>
  errorMessage(reason, "The request could not be completed.");
const scrollLayerSettings=(id:string)=>document.getElementById(`overlay-layer-settings-${id}`)?.scrollIntoView({behavior:"smooth",block:"start"});
const previewValue = (variable: string, media?: OverlayMedia) => {
  const resolved = media?.artwork?.overlayValues?.[variable];
  if (resolved != null && String(resolved).trim()) return String(resolved);
  if (variable === "resolution")
    return (
      String(media?.quality || "").match(/(?:2160|1080|720|480)p?/i)?.[0] || ""
    );
  if (variable === "monitored")
    return media?.monitoring === "none" ? "Unmonitored" : "Monitored";
  if (variable === "availability")
    return media?.hasFile || media?.state === "available"
      ? "Available"
      : "Missing";
  if (variable === "cutoff_status")
    return media?.state === "cutoff" || Number(media?.cutoffUnmetEpisodes) > 0
      ? "Cutoff unmet"
      : "At cutoff";
  const value = (media as unknown as Record<string, unknown>)?.[variable];
  if(Array.isArray(value)&&value.length)return value.join(", ");
  if(value!==undefined&&value!==null&&String(value).trim())return String(value);
  if(variable==="plex_days_since_added"){
    const raw=media?.plexAddedAt??media?.addedAt,numeric=Number(raw),added=Number.isFinite(numeric)&&numeric>0?new Date(numeric<1e12?numeric*1000:numeric):new Date(raw||""),now=new Date();
    if(Number.isFinite(added.getTime()))return String(Math.max(1,Math.floor((Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())-Date.UTC(added.getUTCFullYear(),added.getUTCMonth(),added.getUTCDate()))/86400000)));
    return "1";
  }
  const defaults:Record<string,string>={title:"Example title",year:String(new Date().getUTCFullYear()),rating:"8.0",quality:"1080p",resolution:"1080p",quality_profile:"HD",video_codec:"HEVC",audio_codec:"EAC3",audio_channels:"5.1",dynamic_range:"HDR",source:"WEB-DL",runtime:"120 min",certification:"PG-13",studio:"Example studio",network:"Example network",genres:"Drama",original_language:"English",library_status:"Available",completion_percent:"100%",file_size:"8 GB",tags:"Featured",date_added:"Today",added_ago:"7 days ago",release_date:"Today",release_age:"30 days ago",download_status:"Downloading",download_progress:"50%",download_eta:"In 1 day",series_status:"Continuing",next_episode:"Next episode in 7 days",requested_by:"Example user",request_count:"1"};
  return defaults[variable]||variable.replaceAll("_"," ").replace(/^./,letter=>letter.toUpperCase());
};

function Preview({
  template,
  poster,
  media,
  target,
  onLayerChange,
  onLayerSelect,
  selectedLayerId,
  selectedLayerIds = [],
  canvasView,
}: {
  template: OverlayTemplate;
  poster?: string;
  media?: OverlayMedia;
  target?: "vynode" | "plex";
  onLayerChange?: (id: string, changes: Partial<OverlayLayer>) => void;
  onLayerSelect?: (id: string, additive?: boolean) => void;
  selectedLayerId?: string;
  selectedLayerIds?: string[];
  canvasView?: CanvasView;
}) {
  const [drag, setDrag] = useState<{
    id: string;
    dx: number;
    dy: number;
    pointerId: number;
  } | null>(null);
  const previewValues = hydratePreviewValues(template.layers,{ ...(media?.artwork?.overlayValues || {}) },key=>previewValue(key,media));
  const snap=(value:number)=>canvasView?.snap?Math.round(value/canvasView.snap)*canvasView.snap:value;
  return (
    <div
      className="overlay-preview"
      style={{
        containerType: "inline-size",
        ...(canvasView?{width:`${3*canvasView.zoom}px`,height:`${4.5*canvasView.zoom}px`,minHeight:`${4.5*canvasView.zoom}px`,flex:"0 0 auto"}:{}),
        ...(poster ? { backgroundImage: `url(${poster})` } : {}),
      }}
    >
      {canvasView?.grid?<span className="overlay-canvas-grid" aria-hidden="true"/>:null}
      {canvasView?.safe?<span className="overlay-canvas-safe" aria-hidden="true"/>:null}
      {media ? (
        <Suspense>
          <LibraryChrome
            media={media}
            plex={
              target === "plex"
                ? template.plexBadges || {
                    monitored: false,
                    availability: false,
                    cutoff: false,
                    rating: false,
                  }
                : undefined
            }
          />
        </Suspense>
      ) : null}
      {template.layers.map((layer) => {
        const values = previewValues,
          resolvedLayer = resolveConditionalLayer(layer, values),
          value = resolveLayerContent(resolvedLayer, values);
        if (!overlayLayerVisible(resolvedLayer, value, values)) return null;
        const fallback =
            positionCoordinates[layer.position] || positionCoordinates.custom,
          x = Number.isFinite(resolvedLayer.x) ? resolvedLayer.x : fallback[0],
          y = Number.isFinite(resolvedLayer.y) ? resolvedLayer.y : fallback[1],
          width = Number.isFinite(resolvedLayer.width)
            ? resolvedLayer.width
            : 40,
          height = Number.isFinite(resolvedLayer.height)
            ? resolvedLayer.height
            : 0;
        return (
          <OverlayLayerView
            className={`overlay-preview-layer${selectedLayerIds.includes(layer.id) || selectedLayerId === layer.id ? " selected" : ""}`}
            title="Select layers; unlocked layers move and resize"
            role={onLayerSelect?"button":undefined}
            tabIndex={onLayerSelect?0:undefined}
            aria-label={onLayerSelect?`Select ${layer.name||layer.label||"overlay layer"}`:undefined}
            key={layer.id}
            layer={resolvedLayer}
            style={{
              cursor: onLayerChange ? "grab" : "default",
              touchAction: "none",
            }}
            onPointerDown={(event) => {
              onLayerSelect?.(
                layer.id,
                event.ctrlKey || event.metaKey || event.shiftKey,
              );
              if (!onLayerChange || layer.locked) return;
              const rect = event.currentTarget.getBoundingClientRect();
              event.currentTarget.setPointerCapture(event.pointerId);
              setDrag({
                id: layer.id,
                dx: event.clientX - rect.left,
                dy: event.clientY - rect.top,
                pointerId: event.pointerId,
              });
            }}
            onFocus={()=>onLayerSelect?.(layer.id)}
            onKeyDown={event=>{if((event.key==="Enter"||event.key===" ")&&onLayerSelect){event.preventDefault();onLayerSelect(layer.id,event.ctrlKey||event.metaKey||event.shiftKey);}}}
            onPointerMove={(event) => {
              if (!onLayerChange || layer.locked || !drag || drag.id !== layer.id) return;
              const parent =
                event.currentTarget.parentElement?.getBoundingClientRect();
              if (!parent) return;
              onLayerChange(layer.id, {
                position: "custom",
                x: Math.max(
                  0,
                  Math.min(
                    100 - width,
                    snap(((event.clientX - parent.left - drag.dx) / parent.width)*100),
                  ),
                ),
                y: Math.max(
                  0,
                  Math.min(
                    96,
                    snap(((event.clientY - parent.top - drag.dy) / parent.height)*100),
                  ),
                ),
              });
            }}
            onPointerUp={(event) => {
              if (drag?.pointerId === event.pointerId) setDrag(null);
            }}
          >
            <PosterLayerContent
              layer={resolvedLayer}
              text={`${resolvedLayer.prefix}${value}${resolvedLayer.suffix}`}
            />
            {onLayerChange && !layer.locked ? (
              <span
                className="overlay-resize-handle"
                aria-label="Resize layer"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const startX = event.clientX;
                  const startY = event.clientY;
                  const startWidth = width;
                  const layerRect =
                    event.currentTarget.parentElement?.getBoundingClientRect();
                  const posterRect =
                    event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                  const posterWidth = posterRect?.width || 1;
                  const posterHeight = posterRect?.height || 1;
                  const startHeight =
                    height > 0
                      ? height
                      : ((layerRect?.height || 1) / posterHeight) * 100;
                  const resize = (move: PointerEvent) => {
                    const changes: Partial<OverlayLayer> = {
                      position: "custom",
                      width: Math.max(
                        15,
                        Math.min(
                          100 - x,
                          snap(startWidth+((move.clientX-startX)/posterWidth)*100),
                        ),
                      ),
                    };
                    changes.height = Math.max(
                      3,
                      Math.min(
                        100 - y,
                        snap(startHeight+((move.clientY-startY)/posterHeight)*100),
                      ),
                    );
                    onLayerChange(layer.id, changes);
                  };
                  const finish = () => {
                    window.removeEventListener("pointermove", resize);
                    window.removeEventListener("pointerup", finish);
                  };
                  window.addEventListener("pointermove", resize);
                  window.addEventListener("pointerup", finish);
                }}
              />
            ) : null}
          </OverlayLayerView>
        );
      })}
    </div>
  );
}

export function PosterOverlaysView({
  options,
}: {
  options: PosterOverlayMountOptions;
}) {
  const [templates, setTemplates] = useState<OverlayTemplate[]>([]),
    [assignments, setAssignments] = useState<OverlayAssignment[]>([]),
    [variables, setVariables] = useState<string[]>([]),
    [media, setMedia] = useState<
      Array<OverlayMedia & { domain: "movie" | "tv" }>
    >([]),
    [plexPreviewMedia, setPlexPreviewMedia] = useState<
      Array<OverlayMedia & { domain: "movie" | "tv" }>
    >([]),
    [collections, setCollections] = useState<OverlayCollection[]>([]),
    [userCollections, setUserCollections] = useState<OverlayUserCollection[]>(
      [],
    ),
    [editorHistory, dispatchEditor] = useReducer(editorHistoryReducer, { present: null, past: [], future: [] }),
    [selectedLayerId, setSelectedLayerId] = useState(""),
    [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]),
    [collapsedLayerIds, setCollapsedLayerIds] = useState<string[]>([]),
    [iconQuery, setIconQuery] = useState(""),
    [previewId, setPreviewId] = useState(""),
    [canvasView,setCanvasView]=useState<CanvasView>({zoom:100,grid:false,safe:true,snap:1}),
    [previewLimit, setPreviewLimit] = useState(100),
    [applicationReview, setApplicationReview] = useState<{
      template: OverlayTemplate;
      payload: Record<string, unknown>;
      label: string;
      mediaIds: string[];
    } | null>(null),
    [importReview,setImportReview]=useState<{value:unknown;template:OverlayTemplate;assetCount:number;existing?:OverlayTemplate}|null>(null),
    [qualityIssues,setQualityIssues]=useState<TemplateIssue[]>([]),
    [applicationError,setApplicationError]=useState(""),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [mediaLimit, setMediaLimit] = useState(100),
    [selected, setSelected] = useState<string[]>([]),
    [scope, setScope] = useState<
      "all" | "items" | "collection" | "user-collection" | "rules"
    >("all"),
    [scopeId, setScopeId] = useState(""),
    [domain, setDomain] = useState<OverlayDomain>("all"),
    [busy, setBusy] = useState(false),
    [genres, setGenres] = useState(""),
    [yearFrom, setYearFrom] = useState(""),
    [yearTo, setYearTo] = useState(""),
    [availability, setAvailability] = useState(""),
    [monitoring, setMonitoring] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const [recoverableDraft, setRecoverableDraft] = useState<OverlayTemplate | null>(()=>{
    try{return JSON.parse(localStorage.getItem("vynodearr.poster-overlay-draft")||"null")?.template||null;}catch{return null;}
  });
  const editing = editorHistory.present;
  const setEditing = useCallback((value: SetStateAction<OverlayTemplate | null>) => dispatchEditor({ type: "set", value }), []);
  const [workspace, setWorkspace] = useState<
    "overview" | "templates" | "assignments" | "plex"
  >("overview");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [configuration, movies, tv, collectionValue] = await Promise.all([
        options.request<{
          templates: OverlayTemplate[];
          assignments: OverlayAssignment[];
          variables: string[];
        }>("/api/poster-overlays"),
        options.request<{ items: OverlayMedia[] }>("/api/media/movies"),
        options.request<{ items: OverlayMedia[] }>("/api/media/tv"),
        options.request<{
          items: OverlayCollection[];
          userCollections: OverlayUserCollection[];
        }>("/api/collections"),
      ]);
      setTemplates(configuration.templates || []);
      setAssignments(configuration.assignments || []);
      setVariables(configuration.variables || []);
      setCollections(collectionValue.items || []);
      setUserCollections(collectionValue.userCollections || []);
      setMedia([
        ...(movies.items || []).map((item) => ({
          ...item,
          domain: "movie" as const,
        })),
        ...(tv.items || []).map((item) => ({ ...item, domain: "tv" as const })),
      ]);
    } catch (reason) {
      options.notify(errorText(reason), "error");
    } finally {
      setLoading(false);
    }
  }, [options]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    let active=true;
    if(editing?.target!=="plex"||!["movie","tv"].includes(editing.domain)){setPlexPreviewMedia([]);return()=>{active=false;};}
    void (async()=>{
      try{
        const {loadPlexPreviewMedia}=await import("./poster-overlay-plex-preview");
        const items=await loadPlexPreviewMedia(options,media,editing.domain as "movie"|"tv");
        if(active)setPlexPreviewMedia(items);
      }catch{if(active)setPlexPreviewMedia([]);}
    })();
    return()=>{active=false;};
  },[editing?.target,editing?.domain,media,options]);
  useEffect(() => {
    if (
      editing &&
      !editing.layers.some((layer) => layer.id === selectedLayerId)
    ) {
      const firstId=editing.layers[0]?.id||"";
      setSelectedLayerId(firstId);
      setSelectedLayerIds(firstId?[firstId]:[]);
    }
  }, [editing, selectedLayerId]);
  useEffect(()=>{
    if(!editing||!editorHistory.past.length)return;
    const timer=window.setTimeout(()=>{
      localStorage.setItem("vynodearr.poster-overlay-draft",JSON.stringify({savedAt:new Date().toISOString(),template:editing}));
      setRecoverableDraft(editing);
    },400);
    return()=>window.clearTimeout(timer);
  },[editing,editorHistory.past.length]);
  useEffect(() => {
    if (!editing || !selectedLayerId) return;
    scrollLayerSettings(selectedLayerId);
  }, [selectedLayerId, editing?.layers.length]);
  useEffect(()=>setPreviewLimit(100),[editing?.target,editing?.domain]);
  useEffect(()=>{let active=true;if(!editing){setQualityIssues([]);return;}void import("./poster-overlay-quality").then(({validateTemplate})=>{if(active)setQualityIssues(validateTemplate(editing,variables));});return()=>{active=false};},[editing,variables]);
  const selectLayer=(id:string,additive=false)=>{setCollapsedLayerIds(value=>value.filter(item=>item!==id));setSelectedLayerId(id);setSelectedLayerIds(current=>additive?(current.includes(id)?current.filter(item=>item!==id):[...current,id]):[id]);requestAnimationFrame(()=>scrollLayerSettings(id));};
  useEffect(()=>setMediaLimit(100),[domain,query,scope]);
  const filteredMedia = useMemo(
    () =>
      media
        .filter(
          (item) =>
            (domain === "all" || item.domain === domain) &&
            (!query ||
              `${item.title} ${item.year || ""}`
                .toLowerCase()
                .includes(query.toLowerCase())),
        ),
    [media, domain, query],
  ),visible=filteredMedia.slice(0,mediaLimit);
  const saveTemplate = async () => {
    if (!editing) return;
    const {validateTemplate}=await import("./poster-overlay-quality"),blocking=validateTemplate(editing,variables).filter(issue=>issue.severity==="error");
    if(blocking.length){options.notify(`Fix ${blocking.length} blocking design issue${blocking.length===1?"":"s"} before saving.`,"error");return;}
    if (
      !editing.name.trim() ||
      !["movie", "tv"].includes(editing.domain) ||
      !["vynode", "plex"].includes(editing.target) ||
      !editing.layers.length
    ) {
      options.notify("Choose Movies or Television, choose a destination, and add a layer before saving.", "error");
      return;
    }
    setBusy(true);
    try {
      const path = editing.id
          ? `/api/poster-overlays/templates/${editing.id}`
          : "/api/poster-overlays/templates",
        method = editing.id ? "PUT" : "POST";
      const fallbackPreview=previewMedia||editingMedia[0],previewPosterKey=fallbackPreview?(fallbackPreview.previewKey||`${fallbackPreview.domain}:${fallbackPreview.id}`):editing.previewPosterKey||"";
      await options.request(path, { method, body: JSON.stringify({...editing,previewPosterKey}) });
      const appliedCount = assignments.filter(
        (item) => item.templateId === editing.id,
      ).length;
      options.notify(
        editing.id && appliedCount
          ? `Poster style updated across ${appliedCount} active ${appliedCount === 1 ? "assignment" : "assignments"}.`
          : editing.id
            ? "Poster style updated."
            : "Poster style saved.",
      );
      localStorage.removeItem("vynodearr.poster-overlay-draft");
      setRecoverableDraft(null);
      setEditing(null);
      await load();
    } catch (reason) {
      options.notify(errorText(reason), "error");
    } finally {
      setBusy(false);
    }
  };
  const removeTemplate = async (template: OverlayTemplate) => {
    if (!confirm(`Delete “${template.name}” and its assignments?`)) return;
    try {
      await options.request(`/api/poster-overlays/templates/${template.id}`, {
        method: "DELETE",
      });
      options.notify("Poster style deleted.");
      await load();
    } catch (reason) {
      options.notify(errorText(reason), "error");
    }
  };
  const assign = async (template: OverlayTemplate) => {
    let mediaIds = selected,
      label =
        scope === "all"
          ? domain === "movie"
            ? "all movies"
            : domain === "tv"
              ? "all series"
              : "the entire media library"
          : `${selected.length} selected titles`;
    if (scope === "collection") {
      const collection = collections.find((item) => item.id === scopeId);
      mediaIds = (collection?.members || []).map((item) => item.id);
      label = collection?.name || "saved collection";
    }
    if (scope === "user-collection") {
      const collection = userCollections.find(
        (item) => item.user.id === scopeId,
      );
      mediaIds = [
        ...(domain === "tv" ? [] : collection?.movies || []),
        ...(domain === "movie" ? [] : collection?.television || []),
      ].map((item) => item.id);
      label = collection
        ? `${collection.user.name}'s collection`
        : "user collection";
    }
    if (
      ["items", "collection", "user-collection"].includes(scope) &&
      !mediaIds.length
    ) {
      options.notify(
        "Choose a collection or at least one library title.",
        "error",
      );
      return;
    }
    const { buildApplicationReview } =
      await import("./poster-overlay-application-review");
    setApplicationReview(
      buildApplicationReview(template, label, scope, domain, mediaIds, {
        genres,
        yearFrom,
        yearTo,
        availability,
        monitoring,
      }),
    );
    setApplicationError("");
  };
  const confirmApplication = async () => {
    if (!applicationReview) return;
    setBusy(true);
    try {
      await options.request("/api/poster-overlays/assignments", {
        method: "POST",
        body: JSON.stringify(applicationReview.payload),
      });
      options.notify("Poster assignment applied.");
      setSelected([]);
      setApplicationReview(null);
      await load();
    } catch (reason) {
      const message=errorText(reason);setApplicationError(message);options.notify(message, "error");
    } finally {
      setBusy(false);
    }
  };
  const removeAssignment = async (item: OverlayAssignment) => {
    if(!confirm(`Remove “${item.name}”? Titles will immediately return to the remaining assigned styles or their original artwork.`))return;
    try {
      await options.request(`/api/poster-overlays/assignments/${item.id}`, {
        method: "DELETE",
      });
      options.notify("Poster assignment removed.");
      await load();
    } catch (reason) {
      options.notify(errorText(reason), "error");
    }
  };
  const editTemplate = (template: OverlayTemplate) => {
    setPreviewId(template.previewPosterKey || "");
    setSelectedLayerId("");
    setSelectedLayerIds([]);
    setEditing(structuredClone(template));
  };
  const assignmentName = (item: OverlayAssignment) => {
    const template = templates.find(
        (candidate) => candidate.id === item.templateId,
      ),
      separator = item.name.indexOf(" — ");
    if (!template) return item.name;
    return separator >= 0
      ? `${template.name}${item.name.slice(separator)}`
      : item.name;
  };
  const selectedLayer = editing?.layers.find(
      (layer) => layer.id === selectedLayerId,
    ),
    editingMedia = editing
      ? (editing.target==="plex"?plexPreviewMedia:media).filter((item) => item.domain === editing.domain)
      : [],
    previewMedia =
      editingMedia.find(
        (item) => (item.previewKey||`${item.domain}:${item.id}`) === previewId,
      ) || editingMedia.find((item) => item.artwork?.url),
    missingEditorChoices = editing
      ? [
          !["movie", "tv"].includes(editing.domain) ? "Movies or Television" : "",
          !["vynode", "plex"].includes(editing.target) ? "VynodeArr or Plex" : "",
          !editing.layers.length ? "at least one layer" : "",
        ].filter(Boolean)
      : [],
    updateSelectedLayer = (
      changes:
        | Partial<OverlayLayer>
        | ((layer: OverlayLayer) => Partial<OverlayLayer>),
    ) =>
      setEditing(current=>current?
          {
              ...current,
              layers: current.layers.map((layer) =>
                layer.id === selectedLayerId
                  ? {
                      ...layer,
                      ...(typeof changes==="function"?changes(layer):changes),
                    }
                  : layer,
              ),
            }
          : current,
      );
  const selectedLayerPreviewValues: Record<string, unknown> = { ...(previewMedia?.artwork?.overlayValues || {}) };
  if (selectedLayer) {
    for (const rule of [
      ...(selectedLayer.conditions?.rules || []),
      ...(selectedLayer.styleRules || []).flatMap((style) => style.conditions.rules),
    ]) if (!String(selectedLayerPreviewValues[rule.variable] ?? "").trim()) selectedLayerPreviewValues[rule.variable] = previewValue(rule.variable, previewMedia);
  }
  const selectedLayerConditionStatus = selectedLayer ? overlayConditionStatus(selectedLayer, selectedLayerPreviewValues) : null;
  const editorAccessibilityIssues = editing ? accessibilityIssues(editing) : [];
  const applyLayerTool=(action:AlignmentAction)=>setEditing(current=>current?{...current,layers:transformLayers(current.layers,selectedLayerIds.length?selectedLayerIds:[selectedLayerId],action)}:current);
  const groupSelectedLayers=()=>{
    if(!editing||selectedLayerIds.length<2)return;
    const groupId=`group_${overlayClientId()}`;
    setEditing({...editing,layers:editing.layers.map(layer=>selectedLayerIds.includes(layer.id)?{...layer,groupId}:layer)});
  };
  const ungroupSelectedLayers=()=>setEditing(current=>current?{...current,layers:current.layers.map(layer=>selectedLayerIds.includes(layer.id)?{...layer,groupId:undefined}:layer)}:current);
  const saveVariant=()=>{
    if(!editing)return;
    const name=window.prompt("Name this template variant",`Variant ${(editing.variants?.length||0)+1}`)?.trim();
    if(!name)return;
    setEditing({...editing,variants:[...(editing.variants||[]),{id:`variant_${overlayClientId()}`,name,layers:structuredClone(editing.layers)}]});
  };
  return (
    <div className="poster-overlay-route">
      <style>{styles + responsiveLayoutStyles}</style>
      <div className="hero">
        <div>
          <span className="eyebrow">ARTWORK WORKSPACE</span>
          <h1>Overlays</h1>
          <p className="lede">
            Design reusable poster styles, choose where they appear, and safely manage Plex artwork from one place.
          </p>
        </div>
        <button type="button" className="primary" onClick={() => {setWorkspace("templates");setPreviewId("");setEditing(blankTemplate());}}>
          Create style
        </button>
      </div>
      <ServiceTabs active="poster-overlays" />
      <nav className="overlay-workspace-nav" aria-label="Overlay workspace">
        {([
          ["overview", "Overview"],
          ["templates", "Templates"],
          ["assignments", "Assignments"],
          ["plex", "Plex artwork"],
        ] as const).map(([value,label])=><button type="button" className={workspace===value?"active":""} aria-current={workspace===value?"page":undefined} onClick={()=>setWorkspace(value)} key={value}>{label}</button>)}
      </nav>
      {workspace === "overview" ? (
        <Suspense fallback={<div className="panel skeleton">Loading overlay overview…</div>}>
          <OverlayWorkspaceOverview
            templateCount={templates.length}
            vynodeCount={templates.filter(item=>item.target==="vynode").length}
            plexCount={templates.filter(item=>item.target==="plex").length}
            assignmentCount={assignments.length}
            onNavigate={setWorkspace}
          />
        </Suspense>
      ) : null}
      {workspace === "plex" ? (
        <Suspense fallback={<div className="panel skeleton">Loading Plex artwork tools…</div>}>
          <PlexConnectionPanel options={options} templates={templates} variables={variables} />
        </Suspense>
      ) : null}
      {loading ? (
        workspace === "templates" || workspace === "assignments" ? <div className="panel skeleton">Loading overlay workspace…</div> : null
      ) : (
        workspace === "templates" || workspace === "assignments" ? <div className={`overlay-studio-grid overlay-workspace-${workspace}`}>
          {workspace === "templates" ? (
          <section className="panel overlay-template-panel">
            <div className="panel-heading">
              <div>
                <h2>Poster styles</h2>
                <p className="muted">Reusable layers and variables.</p>
              </div>
              <div className="overlay-new-action">
                <span className="badge">{templates.length}</span>
                <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={async event=>{
                  const file=event.target.files?.[0];event.currentTarget.value="";if(!file)return;
                  try{const value=JSON.parse(await file.text()),{inspectTemplatePack}=await import("./poster-overlay-template-pack"),summary=inspectTemplatePack(value),existing=templates.find(item=>item.name.trim().toLowerCase()===summary.template.name.trim().toLowerCase());setImportReview({...summary,value,existing});}catch(reason){options.notify(errorText(reason),"error");}
                }}/>
                <button type="button" className="secondary" onClick={()=>importInputRef.current?.click()}>Import</button>
                <button type="button" className="primary" onClick={() => {setPreviewId("");setEditing(blankTemplate());}}>
                  Create new style
                </button>
              </div>
            </div>
            {recoverableDraft&&!editing?<div className="notice overlay-draft-recovery"><div><strong>Unsaved poster draft available</strong><p>Resume the most recent local draft or discard it. Drafts stay in this browser only.</p></div><div className="form-actions"><button className="secondary" onClick={()=>{setPreviewId(recoverableDraft.previewPosterKey||"");setEditing(structuredClone(recoverableDraft));}}>Resume draft</button><button className="danger" onClick={()=>{localStorage.removeItem("vynodearr.poster-overlay-draft");setRecoverableDraft(null);}}>Discard</button></div></div>:null}
            <div className="overlay-template-list">
              {(["vynode", "plex"] as const).map((target) => {
                const groupedTemplates = templates.filter(
                  (template) => template.target === target,
                );
                return (
                  <section
                    className="overlay-template-group"
                    data-destination={target}
                    key={target}
                  >
                    <header className="overlay-template-group-heading">
                      <div>
                        <h3>{target === "vynode" ? "VynodeArr templates" : "Plex templates"}</h3>
                        <p>
                          {target === "vynode"
                            ? "Styles used only on posters displayed inside VynodeArr."
                            : "Styles saved for applying directly to Plex artwork."}
                        </p>
                      </div>
                      <span className="badge">{groupedTemplates.length}</span>
                    </header>
                    <div className="overlay-template-group-list">
              {groupedTemplates.map((template) => (
                <article className="overlay-template-card" key={template.id}>
                  <Preview
                    template={template}
                    target={template.target}
                    poster={(()=>{const eligible=media.filter(item=>(template.domain==="all"||item.domain===template.domain)&&item.artwork?.url);if(!eligible.length)return undefined;const chosen=eligible.find(item=>(item.previewKey||`${item.domain}:${item.id}`)===template.previewPosterKey)||eligible[0];return chosen?.artwork?.originalUrl||chosen?.artwork?.url;})()}
                  />
                  <div className="overlay-template-content">
                    <strong>{template.name}</strong>
                    <small>
                      {template.domain === "all"
                        ? "Movies & television"
                        : template.domain === "movie"
                          ? "Movies"
                          : "Television"}{" "}
                      · {template.layers.length} layer
                      {template.layers.length === 1 ? "" : "s"}
                      {" · saved preview poster"}
                    </small>
                    <div className="form-actions">
                      <button
                        className="secondary"
                        onClick={() => editTemplate(template)}
                      >
                        {assignments.some((item) => item.templateId === template.id)
                          ? "Update"
                          : "Edit"}
                      </button>
                      <button
                        className="secondary"
                        onClick={() =>
                          {setPreviewId(template.previewPosterKey||"");setEditing({
                            ...structuredClone(template),
                            id: "",
                            name: `${template.name} copy`,
                          });}
                        }
                      >
                        Duplicate
                      </button>
                      <button className="secondary" onClick={()=>void import("./poster-overlay-template-pack").then(module=>module.downloadTemplate(template)).catch(reason=>options.notify(errorText(reason),"error"))}>Export pack</button>
                      <button
                        className="danger"
                        onClick={() => void removeTemplate(template)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!groupedTemplates.length ? (
                <div className="empty compact overlay-template-empty">
                  <h4>No {target === "vynode" ? "VynodeArr" : "Plex"} templates</h4>
                  <p>
                    Create a style and choose {target === "vynode" ? "VynodeArr" : "Plex"} as its destination.
                  </p>
                </div>
              ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
          ) : null}
          {workspace === "assignments" ? (
          <section className="panel overlay-assignment-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">VYNODEARR LIBRARY OVERLAYS</span>
                <h2>Apply saved styles inside VynodeArr</h2>
                <p className="muted">
                  This section changes posters shown in VynodeArr only. It does not change artwork stored in Plex.
                </p>
              </div>
            </div>
            <div className="notice"><strong>Styles stack instead of replacing one another</strong><p>Apply as many compatible templates as you need. VynodeArr combines their layers on matching titles; removing one assignment leaves the others in place.</p></div>
            <div className="overlay-scope-row">
              <label>
                Library
                <select
                  value={domain}
                  onChange={(event) => {
                    setDomain(event.target.value as OverlayDomain);
                    setScope("all");
                    setScopeId("");
                    setSelected([]);
                  }}
                >
                  <option value="all">Movies & television</option>
                  <option value="movie">Movies</option>
                  <option value="tv">Television</option>
                </select>
              </label>
              <label>
                Apply to
                <select
                  value={scope}
                  onChange={(event) => {
                    setScope(event.target.value as typeof scope);
                    setScopeId("");
                  }}
                >
                  <option value="all">Entire selected library</option>
                  <option value="items">Specific titles</option>
                  <option value="collection">Saved collection</option>
                  <option value="user-collection">User collection</option>
                  <option value="rules">Matching rules</option>
                </select>
              </label>
            </div>
            {scope === "items" ? (
              <>
                <label>
                  Find titles
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title or year"
                  />
                </label>
                <div className="overlay-media-picker" onScroll={event=>{const node=event.currentTarget;if(node.scrollTop+node.clientHeight>=node.scrollHeight-80)setMediaLimit(value=>Math.min(value+100,filteredMedia.length));}}>
                  {visible.map((item) => (
                    <label key={`${item.domain}:${item.id}`}>
                      <input
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, item.id]
                              : current.filter((id) => id !== item.id),
                          )
                        }
                      />
                      {item.artwork?.url ? (
                        <img src={item.artwork.url} alt="" />
                      ) : null}
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {item.domain === "movie" ? "Movie" : "TV"} ·{" "}
                          {item.year || "Year unknown"}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            ) : scope === "collection" ? (
              <label>
                Saved collection
                <select
                  value={scopeId}
                  onChange={(event) => setScopeId(event.target.value)}
                >
                  <option value="">Choose a collection</option>
                  {collections.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · {item.members?.length || 0} titles
                    </option>
                  ))}
                </select>
              </label>
            ) : scope === "user-collection" ? (
              <label>
                User collection
                <select
                  value={scopeId}
                  onChange={(event) => setScopeId(event.target.value)}
                >
                  <option value="">Choose a user</option>
                  {userCollections.map((item) => (
                    <option value={item.user.id} key={item.user.id}>
                      {item.user.name} ·{" "}
                      {item.movies.length + item.television.length} titles
                    </option>
                  ))}
                </select>
              </label>
            ) : scope === "rules" ? (
              <div className="overlay-rule-grid">
                <label>
                  Genres
                  <input
                    value={genres}
                    onChange={(event) => setGenres(event.target.value)}
                    placeholder="Drama, Science Fiction"
                  />
                </label>
                <label>
                  Year from
                  <input
                    type="number"
                    min="1800"
                    max="2200"
                    value={yearFrom}
                    onChange={(event) => setYearFrom(event.target.value)}
                  />
                </label>
                <label>
                  Year to
                  <input
                    type="number"
                    min="1800"
                    max="2200"
                    value={yearTo}
                    onChange={(event) => setYearTo(event.target.value)}
                  />
                </label>
                <label>
                  Availability
                  <select
                    value={availability}
                    onChange={(event) => setAvailability(event.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="available">Available</option>
                    <option value="missing">Missing</option>
                    <option value="cutoff">Cutoff unmet</option>
                  </select>
                </label>
                <label>
                  Monitoring
                  <select
                    value={monitoring}
                    onChange={(event) => setMonitoring(event.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="monitored">Monitored</option>
                    <option value="unmonitored">Unmonitored</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="notice warning">
                <strong>Every matching title will use this style.</strong>
                <p>This is reversible by removing the assignment below.</p>
              </div>
            )}
            <div className="overlay-apply-list">
              {templates
                .filter(
                  (template) =>
                    template.target === "vynode" &&
                    (template.domain === "all" || template.domain === domain),
                )
                .map((template) => (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void assign(template)}
                    key={template.id}
                  >
                    Review “{template.name}”
                  </button>
                ))}
            </div>
            <h3>Active assignments</h3>
            <p className="muted">
              Update an applied style in place. Every library assignment using it refreshes automatically—there is no need to remove and reapply it.
            </p>
            {assignments.map((item) => (
              <div className="data-row" key={item.id}>
                <span>
                  <strong>{assignmentName(item)}</strong>
                  <small>
                    {item.scope.domain} · {item.scope.type}
                    {item.scope.type === "items"
                      ? ` · ${item.scope.mediaIds.length} titles`
                      : ""}
                    {" · combined layers"}
                  </small>
                </span>
                <div className="form-actions">
                  <button
                    className="secondary"
                    disabled={!templates.some((template) => template.id === item.templateId)}
                    onClick={() => {
                      const template = templates.find((candidate) => candidate.id === item.templateId);
                      if (template) editTemplate(template);
                    }}
                  >
                    Update style
                  </button>
                  <button
                    className="danger"
                    onClick={() => void removeAssignment(item)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!assignments.length ? (
              <p className="muted">
                No styles are assigned. All posters are original.
              </p>
            ) : null}
          </section>
          ) : null}
        </div> : null
      )}
      {applicationReview ? (
        <Suspense>
          <ApplicationReview
            template={applicationReview.template}
            label={applicationReview.label}
            items={media
              .filter(
                (item) =>
                  !applicationReview.mediaIds.length ||
                  applicationReview.mediaIds.includes(item.id),
              )
              .filter((item) => domain === "all" || item.domain === domain)}
            busy={busy}
            error={applicationError}
            onCancel={() => setApplicationReview(null)}
            onConfirm={() => void confirmApplication()}
          />
        </Suspense>
      ) : null}
      {importReview?<Suspense><OverlayImportReview template={importReview.template} assetCount={importReview.assetCount} existing={importReview.existing} onCancel={()=>setImportReview(null)} onConfirm={async(mode,name)=>{try{const {importTemplatePack}=await import("./poster-overlay-template-pack"),template=await importTemplatePack(importReview.value,options.request);template.name=name;if(mode==="replace"&&importReview.existing)template.id=importReview.existing.id;setImportReview(null);setPreviewId("");setEditing(template);options.notify("Poster pack imported into the editor. Review the real-title matrix, then save.");}catch(reason){options.notify(errorText(reason),"error");}}}/></Suspense>:null}
      {editing ? (
        <ModalPortal>
          <div className="overlay-editor-backdrop" role="presentation">
            <section
              className="overlay-editor"
              role="dialog"
              aria-modal="true"
              aria-labelledby="overlay-editor-title"
            >
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">POSTER STYLE</span>
                  <h2 id="overlay-editor-title">
                    {editing.id && assignments.some((item) => item.templateId === editing.id)
                      ? "Update applied style"
                      : editing.id
                        ? "Edit style"
                        : "Create style"}
                  </h2>
                  {editing.id && assignments.some((item) => item.templateId === editing.id) ? (
                    <p className="muted">
                      Saving updates every active VynodeArr assignment that uses this style while keeping its existing library scope.
                    </p>
                  ) : null}
                </div>
                <div className="overlay-editor-history-actions" aria-label="Edit history">
                  <button className="secondary" disabled={!editorHistory.past.length} onClick={() => dispatchEditor({ type: "undo" })}>Undo</button>
                  <button className="secondary" disabled={!editorHistory.future.length} onClick={() => dispatchEditor({ type: "redo" })}>Redo</button>
                  <button className="secondary" onClick={() => setEditing(null)}>Close</button>
                </div>
              </div>
              <div className="overlay-editor-grid">
                <Suspense>
                  <EditorRail
                    editing={editing}
                    request={options.request}
                    notify={options.notify}
                    selectedId={selectedLayerId}
                    selectedIds={selectedLayerIds}
                    query={iconQuery}
                    onQuery={setIconQuery}
                    onSelect={selectLayer}
                    onDuplicate={(id) => {
                      const source = editing.layers.find((layer) => layer.id === id);
                      if (!source) return;
                      const copy = { ...structuredClone(source), id: `layer_${overlayClientId()}`, groupId: undefined };
                      const index = editing.layers.findIndex((layer) => layer.id === id);
                      const layers = [...editing.layers];
                      layers.splice(index + 1, 0, copy);
                      setEditing({ ...editing, layers });
                      selectLayer(copy.id);
                    }}
                    onMove={(id, direction) => {
                      const index = editing.layers.findIndex((layer) => layer.id === id), target = index + direction;
                      if (index < 0 || target < 0 || target >= editing.layers.length) return;
                      const layers = [...editing.layers];
                      [layers[index], layers[target]] = [layers[target], layers[index]];
                      setEditing({ ...editing, layers });
                    }}
                    onChange={(changes) => {
                      if (changes.domain !== undefined && changes.domain !== editing.domain)
                        setPreviewId("");
                      setEditing({ ...editing, ...changes });
                    }}
                    onAddText={() => {
                      const layer = {...blankLayer(variables[0]),position:"custom" as const,x:30,y:45};
                      setEditing({
                        ...editing,
                        layers: [...editing.layers, layer],
                      });
                      selectLayer(layer.id);
                    }}
                    onAddIcon={(name) => {
                      const layer = {
                        ...blankLayer("custom_text"),
                        kind: "icon" as const,
                        iconName: name,
                        label: "",
                        contentPosition: "none" as const,
                        width: 22,
                        position: "custom" as const,
                        x: 39,
                        y: 45,
                        fontSize: 56,
                      };
                      setEditing({
                        ...editing,
                        layers: [...editing.layers, layer],
                      });
                      selectLayer(layer.id);
                    }}
                    onAddShape={(shape) => {
                      const layer = {
                        ...blankLayer("custom_text"),
                        kind: "shape" as const,
                        label: "",
                        shape,
                        width: 40,
                        height: 10,
                        position: "custom" as const,
                        x: 30,
                        y: 45,
                      };
                      setEditing({
                        ...editing,
                        layers: [...editing.layers, layer],
                      });
                      selectLayer(layer.id);
                    }}
                    onAddPreset={(preset) => {
                      if (editing.layers.length >= 12) {
                        options.notify("A poster style can contain up to 12 layers.", "error");
                        return;
                      }
                      const layer = overlayLayerFromPreset(preset, blankLayer(preset.variable));
                      setEditing({ ...editing, layers: [...editing.layers, layer] });
                      selectLayer(layer.id);
                    }}
                  />
                </Suspense>
                <div className="overlay-editor-fields">
                  <section className="overlay-layout-tools" aria-label="Layer layout tools">
                    <div><strong>Arrange layers</strong><small className="muted">Select layer names in the left column or select items directly on the preview. Ctrl/Cmd-click or Shift-click to select several. Grouped layers move together on the poster.</small></div>
                    <div className="overlay-layout-actions">
                      <button className="secondary" disabled={selectedLayerIds.length<2} onClick={groupSelectedLayers}>Group</button>
                      <button className="secondary" disabled={!selectedLayerIds.length} onClick={ungroupSelectedLayers}>Ungroup</button>
                      {([['left','Left'],['center-x','Center'],['right','Right'],['top','Top'],['center-y','Middle'],['bottom','Bottom'],['distribute-x','Space across'],['distribute-y','Space down'],['safe','Safe margin']] as Array<[AlignmentAction,string]>).map(([action,label])=><button className="secondary" disabled={!selectedLayerId} onClick={()=>applyLayerTool(action)} key={action}>{label}</button>)}
                    </div>
                    <div className="overlay-variant-tools">
                      <button className="secondary" onClick={saveVariant}>Save current as variant</button>
                      {(editing.variants||[]).map(variant=><span className="overlay-variant" key={variant.id}><button className="secondary" onClick={()=>setEditing({...editing,layers:structuredClone(variant.layers)})}>{variant.name}</button><button className="danger" aria-label={`Delete ${variant.name}`} onClick={()=>setEditing({...editing,variants:editing.variants?.filter(item=>item.id!==variant.id)})}>×</button></span>)}
                    </div>
                  </section>
                  {!editing.layers.length ? (
                    <div className="empty compact overlay-layer-empty">
                      <strong>No layers yet</strong>
                      <p>Add text, a shape, or a media icon from the first column.</p>
                    </div>
                  ) : null}
                  {editing.target === "plex" ? (
                    <Suspense>
                      <PlexBadgeChoices
                        value={editing.plexBadges}
                        onChange={(plexBadges) =>
                          setEditing({ ...editing, plexBadges })
                        }
                      />
                    </Suspense>
                  ) : null}
                  {editing.layers.map((layer, index) => {
                    const hasRankedConditions = Boolean(layer.styleRules?.length);
                    const update = (changes: Partial<OverlayLayer>) =>
                      setEditing({
                        ...editing,
                        layers: editing.layers.map((item, i) =>
                          i === index ? { ...item, ...changes } : item,
                        ),
                      });
                    return (
                      <details
                        id={`overlay-layer-settings-${layer.id}`}
                        className={`overlay-layer-editor${layer.id===selectedLayerId?" selected":""}`}
                        key={layer.id}
                        open={!collapsedLayerIds.includes(layer.id)}
                        onToggle={event=>{const open=event.currentTarget.open;setCollapsedLayerIds(current=>open?current.filter(id=>id!==layer.id):current.includes(layer.id)?current:[...current,layer.id])}}
                      >
                        <summary onClick={()=>setSelectedLayerId(layer.id)}>
                          <span className="layer-heading">
                            <strong>{layer.name || `L${index + 1}`}</strong>
                            <small>
                              {layer.variable.replaceAll("_", " ")}
                              {" · "}
                              {layer.position.replace("-", " ")}
                            </small>
                          </span>
                          <span className="layer-actions">
                            <span className="layer-collapse" />
                            <button
                              type="button"
                              className="danger overlay-remove-layer"
                              onClick={(event) => {
                                event.preventDefault();
                                setEditing({
                                  ...editing,
                                  layers: editing.layers.filter((_, i) => i !== index),
                                });
                              }}
                            >
                              Remove layer
                            </button>
                          </span>
                        </summary>
                        <div className="overlay-layer-body">
                          <label className="overlay-layer-toggle">
                            <input
                              type="checkbox"
                              checked={layer.enabled}
                              onChange={(event) =>
                                update({ enabled: event.target.checked })
                              }
                            />
                            Show this layer
                          </label>
                          <Suspense>
                            <LayerIdentity
                              layer={layer}
                              variables={variables}
                              onChange={update}
                            />
                          </Suspense>
                          <div className="overlay-control-group-heading overlay-placement-heading">
                            <span className="eyebrow">PLACEMENT &amp; SIZE</span>
                            <strong>Place the layer</strong>
                            <small className="muted">Use a preset or fine-tune the exact position and dimensions.</small>
                          </div>
                          <label>
                            Position
                            <select
                              value={layer.position}
                              onChange={(event) => {
                                const position = event.target
                                  .value as OverlayPosition;
                                const [x, y] = positionCoordinates[position];
                                update({ position, x, y });
                              }}
                            >
                              {positions.map((position) => (
                                <option value={position} key={position}>
                                  {position.replace("-", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="overlay-control-group-heading overlay-copy-heading">
                            <span className="eyebrow">TEXT &amp; COLORS</span>
                            <strong>Format the content</strong>
                            <small className="muted">Add surrounding text and set the base appearance.</small>
                          </div>
                          <label>
                            Prefix
                            <input
                              value={layer.prefix}
                              onChange={(event) =>
                                update({ prefix: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            Suffix
                            <input
                              value={layer.suffix}
                              onChange={(event) =>
                                update({ suffix: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            Text color
                            <input
                              type="color"
                              value={layer.foreground}
                              onChange={(event) =>
                                update({ foreground: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            Badge color
                            <input
                              type="color"
                              value={layer.background}
                              onChange={(event) =>
                                update({ background: event.target.value })
                              }
                            />
                          </label>
                          <div className="overlay-control-group-heading overlay-geometry-heading">
                            <span className="eyebrow">FINE POSITION</span>
                            <strong>Adjust on the poster</strong>
                            <small className="muted">Dragging the preview updates these same values.</small>
                          </div>
                          <label className="overlay-range">
                            <span>Horizontal position</span>
                            <span>{Math.round(layer.x ?? 5)}%</span>
                            <input
                              type="range"
                              min="0"
                              max="95"
                              value={layer.x ?? 5}
                              onChange={(event) =>
                                update({
                                  position: "custom",
                                  x: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="overlay-range">
                            <span>Vertical position</span>
                            <span>{Math.round(layer.y ?? 5)}%</span>
                            <input
                              type="range"
                              min="0"
                              max="96"
                              value={layer.y ?? 5}
                              onChange={(event) =>
                                update({
                                  position: "custom",
                                  y: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="overlay-range">
                            <span>Layer width</span>
                            <span>{Math.round(layer.width ?? 40)}%</span>
                            <input
                              type="range"
                              min="15"
                              max="100"
                              value={layer.width ?? 40}
                              onChange={(event) =>
                                update({
                                  width: Number(event.target.value),
                                  ...(Number(event.target.value) === 100
                                    ? { position: "custom", x: 0 }
                                    : {}),
                                })
                              }
                            />
                          </label>
                          <div className="overlay-control-group-heading overlay-type-heading">
                            <span className="eyebrow">TYPOGRAPHY</span>
                            <strong>Refine readability</strong>
                            <small className="muted">
                              {hasRankedConditions
                                ? "These are the default typography settings. A matching ranked condition overrides only the typography options enabled for that condition; titles that match this layer but no ranked condition use these defaults."
                                : "Control type, alignment, spacing, and opacity."}
                            </small>
                          </div>
                          <label className="overlay-layer-toggle overlay-poster-aware">
                            <span>Adaptive poster contrast</span>
                            <span className="muted">
                              Tints and softens the artwork beneath this layer
                              while preserving your chosen colors.
                            </span>
                            <input
                              type="checkbox"
                              checked={layer.posterAware === true}
                              onChange={(event) =>
                                update({ posterAware: event.target.checked })
                              }
                            />
                          </label>
                          <label className="overlay-range">
                            <span>Font size</span>
                            <span>{layer.fontSize ?? 32}px</span>
                            <input
                              type="range"
                              min="12"
                              max="96"
                              value={layer.fontSize ?? 32}
                              onChange={(event) =>
                                update({ fontSize: Number(event.target.value) })
                              }
                            />
                          </label>
                          <label>
                            Font
                            <select
                              value={layer.fontFamily ?? "sans"}
                              onChange={(event) =>
                                update({
                                  fontFamily: event.target
                                    .value as OverlayLayer["fontFamily"],
                                })
                              }
                            >
                              <option value="sans">Sans serif</option>
                              <option value="serif">Serif</option>
                              <option value="condensed">Condensed</option>
                              <option value="monospace">Monospace</option>
                            </select>
                          </label>
                          <label>
                            Font weight
                            <select
                              value={layer.fontWeight ?? 700}
                              onChange={(event) =>
                                update({
                                  fontWeight: Number(
                                    event.target.value,
                                  ) as OverlayLayer["fontWeight"],
                                })
                              }
                            >
                              <option value="400">Regular</option>
                              <option value="500">Medium</option>
                              <option value="600">Semibold</option>
                              <option value="700">Bold</option>
                              <option value="800">Extra bold</option>
                              <option value="900">Black</option>
                            </select>
                          </label>
                          <label>
                            Text alignment
                            <select
                              value={layer.textAlign ?? "left"}
                              onChange={(event) =>
                                update({
                                  textAlign: event.target
                                    .value as OverlayLayer["textAlign"],
                                })
                              }
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </label>
                          <label>
                            Capitalization
                            <select
                              value={layer.textTransform ?? "none"}
                              onChange={(event) =>
                                update({
                                  textTransform: event.target
                                    .value as OverlayLayer["textTransform"],
                                })
                              }
                            >
                              <option value="none">As entered</option>
                              <option value="uppercase">Uppercase</option>
                              <option value="lowercase">Lowercase</option>
                            </select>
                          </label>
                          <label className="overlay-range">
                            <span>Text opacity</span>
                            <span>
                              {Math.round((layer.textOpacity ?? 1) * 100)}%
                            </span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={layer.textOpacity ?? 1}
                              onChange={(event) =>
                                update({
                                  textOpacity: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="overlay-range">
                            <span>Shape opacity</span>
                            <span>
                              {Math.round(
                                (layer.backgroundOpacity ?? 0.92) * 100,
                              )}
                              %
                            </span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={layer.backgroundOpacity ?? 0.92}
                              onChange={(event) =>
                                update({
                                  backgroundOpacity: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="overlay-range">
                            <span>Inner spacing</span>
                            <span>{layer.padding ?? 12}px</span>
                            <input
                              type="range"
                              min="2"
                              max="30"
                              value={layer.padding ?? 12}
                              onChange={(event) =>
                                update({ padding: Number(event.target.value) })
                              }
                            />
                          </label>
                          <label className="overlay-range">
                            <span>Corner radius</span>
                            <span>{layer.borderRadius ?? 18}px</span>
                            <input
                              type="range"
                              min="0"
                              max="50"
                              value={layer.borderRadius ?? 18}
                              onChange={(event) =>
                                update({
                                  borderRadius: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                        </div>
                      </details>
                    );
                  })}
                </div>
                <div className="overlay-preview-column">
                  <p className="overlay-preview-hint">
                    Choose where this style will be used, then build against a
                    real matching poster.
                  </p>
                  <label>
                    Destination
                    <select
                      value={editing.target}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          target: event.target.value as "vynode" | "plex",
                        })
                      }
                    >
                      <option value="" disabled>Choose a destination</option>
                      <option value="vynode">VynodeArr</option>
                      <option value="plex">Plex</option>
                    </select>
                  </label>
                  <label>
                    Preview title
                    <select
                      value={previewId}
                      onChange={(event) => setPreviewId(event.target.value)}
                      onScroll={event=>{const node=event.currentTarget;if(node.scrollTop+node.clientHeight>=node.scrollHeight-80)setPreviewLimit(value=>Math.min(value+100,editingMedia.length));}}
                    >
                      <option value="">
                        {editingMedia.length
                          ? "First available poster"
                          : "Choose Movies or Television first"}
                      </option>
                      {editingMedia
                        .slice(0, previewLimit)
                        .map((item) => (
                          <option
                            value={item.previewKey||`${item.domain}:${item.id}`}
                            key={item.previewKey||`${item.domain}:${item.id}`}
                          >
                            {item.previewLabel||`${item.title} ${item.year ? `(${item.year})` : ""}`}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Suspense><OverlayCanvasTools view={canvasView} onChange={setCanvasView} selectionCount={selectedLayerIds.length} onUndo={()=>dispatchEditor({type:"undo"})} onRedo={()=>dispatchEditor({type:"redo"})} onNudge={(dx,dy)=>setEditing(current=>current?{...current,layers:nudgeLayers(current.layers,selectedLayerIds.length?selectedLayerIds:[selectedLayerId],dx,dy)}:current)}/></Suspense>
                  <div className="overlay-canvas-stage"><Preview
                    template={editing}
                    target={editing.target || undefined}
                    media={previewMedia}
                    poster={
                      previewMedia?.artwork?.originalUrl ||
                      previewMedia?.artwork?.url
                    }
                    onLayerSelect={selectLayer}
                    selectedLayerId={selectedLayerId}
                    selectedLayerIds={selectedLayerIds}
                    canvasView={canvasView}
                    onLayerChange={(id, changes) =>
                      setEditing(current=>{
                        if(!current)return current;
                        const source=current.layers.find(layer=>layer.id===id),dx=changes.x===undefined||!source?0:changes.x-source.x,dy=changes.y===undefined||!source?0:changes.y-source.y;
                        return {...current,layers:current.layers.map(layer=>layer.id===id?{...layer,...changes}:source?.groupId&&layer.groupId===source.groupId&&(dx||dy)?{...layer,position:"custom",x:Math.max(0,Math.min(100-layer.width,layer.x+dx)),y:Math.max(0,Math.min(96,layer.y+dy))}:layer)};
                      })
                    }
                  /></div>
                  <p className="muted">
                    Preview values demonstrate placement. Saved posters use each
                    title’s real metadata.
                  </p>
                  <section className={`overlay-accessibility-check ${editorAccessibilityIssues.length?"warning":"ready"}`} aria-live="polite">
                    <strong>{editorAccessibilityIssues.length?`${editorAccessibilityIssues.length} design check${editorAccessibilityIssues.length===1?"":"s"}`:"Design checks passed"}</strong>
                    {editorAccessibilityIssues.length?<ul>{editorAccessibilityIssues.map(issue=><li key={issue}>{issue}</li>)}</ul>:<small>Contrast, readable type, bounds, and layer collisions look good.</small>}
                  </section>
                  <Suspense><OverlayQuality template={editing} items={editingMedia} issues={qualityIssues}/></Suspense>
                </div>
                {selectedLayer ? (
                  <div className="overlay-condition-row">
                    <div className="notice overlay-condition-live-status" role="status">
                      <strong>{selectedLayerConditionStatus?.applied.length ? `Preview uses ${selectedLayerConditionStatus.applied.map((rule) => rule.name).join(", ")}` : "Preview uses layer defaults"}</strong>
                      <small className="muted">
                        {selectedLayerConditionStatus?.applied.length
                          ? `${selectedLayerConditionStatus.overriddenKeys.length} setting${selectedLayerConditionStatus.overriddenKeys.length === 1 ? "" : "s"} overridden; all other settings inherit the layer defaults.`
                          : selectedLayer.styleRules?.length
                            ? "No ranked sub-condition matches this preview title. Matching titles without a ranked match use the defaults."
                            : "No ranked sub-conditions are configured for this layer."}
                      </small>
                      {selectedLayerConditionStatus?.diagnostics.length?<details className="overlay-condition-diagnostics"><summary>Why conditions did or did not match</summary>{selectedLayerConditionStatus.diagnostics.map(rule=><div className={rule.matches?"matches":"misses"} key={rule.id}><strong>{rule.matches?"✓":"×"} {rule.name}</strong>{rule.rules.map((condition,index)=><small key={`${condition.variable}:${index}`}>{condition.matches?"✓":"×"} {condition.variable.replaceAll("_"," ")} is “{condition.actual||"empty"}” · {condition.operator.replaceAll("_"," ")} {condition.expected?`“${condition.expected}”`:""}</small>)}</div>)}</details>:null}
                    </div>
                    <Suspense>
                      <OverlayConditions
                        layer={selectedLayer}
                        variables={variables}
                        onChange={updateSelectedLayer}
                      />
                    </Suspense>
                  </div>
                ) : null}
              </div>
              <div className="overlay-editor-footer">
                {missingEditorChoices.length ? (
                  <p className="overlay-save-guidance" role="status">
                    To save, choose {missingEditorChoices.join(", ")}.
                  </p>
                ) : null}
                <button className="secondary" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !editing.name.trim() ||
                    qualityIssues.some(issue=>issue.severity==="error") ||
                    missingEditorChoices.length > 0
                  }
                  onClick={() => void saveTemplate()}
                >
                  {busy
                    ? "Saving…"
                    : editing.id && assignments.some((item) => item.templateId === editing.id)
                      ? "Update applied style"
                      : editing.id
                        ? "Update poster style"
                        : "Save poster style"}
                </button>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}
