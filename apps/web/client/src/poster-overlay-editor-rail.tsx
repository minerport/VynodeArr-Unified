import { useEffect, useState, type CSSProperties } from "react";
import type { OverlayAsset, OverlayDomain, OverlayLayer, OverlayTemplate, PosterOverlayMountOptions } from "./poster-overlays-types";
import { PosterIcon, posterIcons } from "./poster-overlay-icons";
import { overlayItemPresets, overlayLayerFromAsset, type OverlayItemPreset } from "./poster-overlay-item-presets";
import "./poster-overlay-editor-layout.css";

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

type Props = {
  editing: OverlayTemplate;
  request: PosterOverlayMountOptions["request"];
  notify: PosterOverlayMountOptions["notify"];
  selectedId: string;
  selectedIds: string[];
  query: string;
  onQuery: (value: string) => void;
  onSelect: (id: string, additive?: boolean) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onChange: (changes: Partial<OverlayTemplate>) => void;
  onAddText: () => void;
  onAddIcon: (name: string) => void;
  onAddShape: (shape: OverlayLayer["shape"]) => void;
  onAddPreset: (preset: OverlayItemPreset) => void;
};

export default function EditorRail({ editing, request, notify, selectedId, selectedIds, query, onQuery, onSelect, onDuplicate, onMove, onChange, onAddText, onAddIcon, onAddShape, onAddPreset }: Props) {
  const icons = posterIcons.filter(([, label]) => !query || label.toLowerCase().includes(query.toLowerCase()));
  const [draggedId,setDraggedId]=useState("");
  const [assets,setAssets]=useState<OverlayAsset[]>([]),[uploading,setUploading]=useState(false);
  const selected=editing.layers.find(layer=>layer.id===selectedId),group=selected?.groupId?editing.layers.filter(layer=>layer.groupId===selected.groupId):[],groupLayout=group[0]?.groupLayout||"free",groupGap=group[0]?.groupGap??2,groupAlign=group[0]?.groupAlign||"start";
  const saveComponent=()=>{const chosen=editing.layers.filter(layer=>selectedIds.includes(layer.id));if(chosen.length<2)return notify("Select at least two layers to save a component.","error");const name=prompt("Name this reusable component")?.trim();if(!name)return;const id=`component_${crypto.randomUUID()}`,instanceId=`component_instance_${crypto.randomUUID()}`,groupId=chosen[0].groupId||`group_${crypto.randomUUID()}`,minX=Math.min(...chosen.map(layer=>layer.x)),minY=Math.min(...chosen.map(layer=>layer.y)),layers=chosen.map(layer=>({...structuredClone(layer),id:`layer_${crypto.randomUUID()}`,x:layer.x-minX,y:layer.y-minY,componentId:id,componentInstanceId:undefined,componentLayerId:undefined,componentOverrides:[]})),byId=new Map(chosen.map((layer,index)=>[layer.id,layers[index].id]));onChange({components:[...(editing.components||[]),{id,name,layers}],layers:editing.layers.map(layer=>byId.has(layer.id)?{...layer,groupId,componentId:id,componentInstanceId:instanceId,componentLayerId:byId.get(layer.id),componentOverrides:[]}:layer)});notify(`${name} saved as a linked reusable component.`);};
  const insertComponent=(component:NonNullable<OverlayTemplate["components"]>[number])=>{if(editing.layers.length+component.layers.length>12)return notify("This component would exceed the 12-layer poster limit.","error");const groupId=`group_${crypto.randomUUID()}`,instanceId=`component_instance_${crypto.randomUUID()}`,layers=component.layers.map(layer=>({...structuredClone(layer),id:`layer_${crypto.randomUUID()}`,groupId,componentId:component.id,componentInstanceId:instanceId,componentLayerId:layer.id,componentOverrides:[],position:"custom" as const,x:Math.max(0,Math.min(100-layer.width,5+layer.x)),y:Math.max(0,Math.min(96,5+layer.y))}));onChange({layers:[...editing.layers,...layers]});onSelect(layers[0].id);notify(`${component.name} inserted.`);};
  const activeInstance=selected?.componentId&&selected.componentInstanceId?editing.layers.filter(layer=>layer.componentId===selected.componentId&&layer.componentInstanceId===selected.componentInstanceId):[],activeComponent=selected?.componentId?(editing.components||[]).find(component=>component.id===selected.componentId):undefined;
  const syncComponent=()=>{if(!activeComponent||!activeInstance.length)return;const minX=Math.min(...activeInstance.map(layer=>layer.x)),minY=Math.min(...activeInstance.map(layer=>layer.y)),sourceByDefinition=new Map(activeInstance.map(layer=>[layer.componentLayerId,layer])),definitions=activeComponent.layers.map(definition=>{const source=sourceByDefinition.get(definition.id);return source?{...structuredClone(source),id:definition.id,x:source.x-minX,y:source.y-minY,groupId:undefined,componentInstanceId:undefined,componentLayerId:undefined,componentOverrides:[]}:definition;}),origins=new Map<string,{x:number;y:number}>();for(const layer of editing.layers.filter(layer=>layer.componentId===activeComponent.id&&layer.componentInstanceId)){const key=layer.componentInstanceId!;const origin=origins.get(key)||{x:layer.x,y:layer.y};origin.x=Math.min(origin.x,layer.x);origin.y=Math.min(origin.y,layer.y);origins.set(key,origin);}const content=['name','label','variable','contentTemplate','fallbackText','missingBehavior','kind','assetId','assetName','imageFit','imageOpacity','iconName','contentPosition','contentGap','textFit','maxLines'],appearance=['iconColor','iconSize','foreground','background','fontSize','fontFamily','fontWeight','textAlign','textTransform','textOpacity','backgroundOpacity','posterAware','shape','padding','borderRadius','rotation','borderWidth','borderColor','textStrokeWidth','textStrokeColor','shadow'],geometry=['position','x','y','width','height','groupLayout','groupGap','groupAlign'],visibility=['enabled','condition','conditions','styleMode','styleRules'],protectedKeys=(layer:OverlayLayer)=>new Set((layer.componentOverrides||[]).flatMap(scope=>scope==='content'?content:scope==='appearance'?appearance:scope==='geometry'?geometry:visibility)),byDefinition=new Map(definitions.map(layer=>[layer.id,layer])),layers=editing.layers.map(layer=>{if(layer.componentId!==activeComponent.id||!layer.componentLayerId||!layer.componentInstanceId)return layer;const definition=byDefinition.get(layer.componentLayerId);if(!definition)return layer;const keep=protectedKeys(layer),origin=origins.get(layer.componentInstanceId)! as {x:number;y:number},merged={...layer};for(const [key,value] of Object.entries(definition))if(!keep.has(key)&&!["id","groupId","componentId","componentInstanceId","componentLayerId","componentOverrides","x","y"].includes(key))(merged as unknown as Record<string,unknown>)[key]=structuredClone(value);if(!keep.has('x'))merged.x=Math.max(0,Math.min(100-merged.width,origin.x+definition.x));if(!keep.has('y'))merged.y=Math.max(0,Math.min(96,origin.y+definition.y));return merged;});onChange({components:(editing.components||[]).map(component=>component.id===activeComponent.id?{...component,layers:definitions}:component),layers});notify(`${activeComponent.name} updated across linked copies.`);};
  const detachInstance=()=>{if(!activeInstance.length)return;const ids=new Set(activeInstance.map(layer=>layer.id));onChange({layers:editing.layers.map(layer=>ids.has(layer.id)?{...layer,componentId:undefined,componentInstanceId:undefined,componentLayerId:undefined,componentOverrides:[]}:layer)});notify("Component copy detached; its layers remain editable.");};
  const arrange=(layout:OverlayLayer["groupLayout"],gap=groupGap,align=groupAlign)=>{if(group.length<2)return;const widths=group.map(layer=>layer.width),heights=group.map(layer=>layer.height||6),maxWidth=Math.max(...widths),maxHeight=Math.max(...heights),baseX=Math.min(...group.map(layer=>layer.x)),baseY=Math.min(...group.map(layer=>layer.y));let cursor=0;const total=layout==="row"?widths.reduce((sum,value)=>sum+value,0):heights.reduce((sum,value)=>sum+value,0),resolvedGap=Math.max(0,Math.min(gap,(100-total)/(group.length-1))),start=layout==="row"?Math.min(baseX,Math.max(0,100-total-resolvedGap*(group.length-1))):Math.min(baseY,Math.max(0,100-total-resolvedGap*(group.length-1))),changes=new Map(group.map((layer,index)=>{const cross=align==="center"?(layout==="row"?(maxHeight-heights[index])/2:(maxWidth-widths[index])/2):align==="end"?(layout==="row"?maxHeight-heights[index]:maxWidth-widths[index]):0,value=layout==="row"?{x:start+cursor,y:Math.min(100-heights[index],baseY+cross)}:layout==="column"?{x:Math.min(100-widths[index],baseX+cross),y:start+cursor}:{x:layer.x,y:layer.y};cursor+=(layout==="row"?widths[index]:heights[index])+resolvedGap;return[layer.id,value];}));onChange({layers:editing.layers.map(layer=>layer.groupId===selected?.groupId?{...layer,...changes.get(layer.id),position:"custom",groupLayout:layout,groupGap:gap,groupAlign:align}:layer)});};
  useEffect(()=>{void request<{assets:OverlayAsset[]}>("/api/poster-overlays").then(value=>setAssets(value.assets||[])).catch(()=>{});},[request]);
  const add=(asset:OverlayAsset)=>{const layer=overlayLayerFromAsset(asset);onChange({layers:[...editing.layers,layer]});onSelect(layer.id);},remove=async(asset:OverlayAsset)=>{try{await request(`/api/poster-overlays/assets/${asset.id}`,{method:"DELETE"});setAssets(current=>current.filter(item=>item.id!==asset.id));notify(`${asset.name} deleted.`);}catch(reason){notify(reason instanceof Error?reason.message:"The image could not be deleted.","error");}},upload=async(file:File)=>{setUploading(true);try{const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("The image could not be read."));reader.readAsDataURL(file);}),value=await request<{asset:OverlayAsset}>("/api/poster-overlays/assets",{method:"POST",body:JSON.stringify({name:file.name.replace(/\.[^.]+$/,"")||"Overlay image",image})});setAssets(current=>[...current,value.asset]);add(value.asset);notify(`${value.asset.name} uploaded and added.`);}catch(reason){notify(reason instanceof Error?reason.message:"The image could not be uploaded.","error");}finally{setUploading(false);}};
  return (
    <aside className="overlay-editor-rail">
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
          <div className={`overlay-layer-list-row${selectedIds.includes(layer.id) ? " active" : ""}`} draggable onDragStart={()=>setDraggedId(layer.id)} onDragEnd={()=>setDraggedId("")} onDragOver={event=>event.preventDefault()} onDrop={()=>{const from=editing.layers.findIndex(item=>item.id===draggedId),to=editing.layers.findIndex(item=>item.id===layer.id),layers=[...editing.layers];if(from>=0&&to>=0&&from!==to){const [moved]=layers.splice(from,1);layers.splice(to,0,moved);onChange({layers});}setDraggedId("");}} key={layer.id}>
            <button className="secondary overlay-layer-select" onClick={(event) => onSelect(layer.id, event.ctrlKey || event.metaKey || event.shiftKey)}>
              <span>{index + 1}</span>
              <strong>{layer.name || (layer.kind === "icon" ? posterIcons.find(([id]) => id === layer.iconName)?.[1] || "Icon" : layer.kind === "shape" ? `${layer.shape} shape` : layer.variable.replaceAll("_", " "))}</strong>
              <small>{layer.enabled ? layer.locked ? "On · Locked" : "On" : "Hidden"}</small>
            </button>
            <div className="overlay-layer-row-actions">
              <button type="button" className="secondary" aria-label={`Move layer ${index + 1} up`} disabled={index === 0} onClick={() => onMove(layer.id, -1)}>&uarr;</button>
              <button type="button" className="secondary" aria-label={`Move layer ${index + 1} down`} disabled={index === editing.layers.length - 1} onClick={() => onMove(layer.id, 1)}>&darr;</button>
              <button type="button" className="secondary" onClick={() => onDuplicate(layer.id)}>Duplicate</button>
            </div>
          </div>
        ))}
      </div>
      {group.length>1?<fieldset className="overlay-condition-builder"><legend>Selected group layout</legend><small className="muted">Keep the group freeform or arrange its layers as an automatically spaced row or stack.</small><label>Layout<select value={groupLayout} onChange={event=>arrange(event.target.value as OverlayLayer["groupLayout"])}><option value="free">Freeform</option><option value="row">Horizontal row</option><option value="column">Vertical stack</option></select></label><label>Alignment<select value={groupAlign} onChange={event=>arrange(groupLayout,groupGap,event.target.value as OverlayLayer["groupAlign"])}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option></select></label><label className="overlay-range"><span>Gap</span><span>{groupGap}%</span><input type="range" min="0" max="10" step=".5" value={groupGap} onChange={event=>arrange(groupLayout,Number(event.target.value),groupAlign)}/></label><button type="button" className="secondary" disabled={groupLayout==="free"} onClick={()=>arrange(groupLayout)}>Reflow group</button></fieldset>:null}
      <fieldset className="overlay-condition-builder"><legend>Reusable components</legend><small className="muted">Save selected layers once, insert linked copies, and protect instance-specific overrides before synchronizing changes.</small><button type="button" className="secondary" disabled={selectedIds.length<2} onClick={saveComponent}>Save selection as component</button>{activeComponent?<div style={{display:"grid",gap:5}}><button type="button" className="secondary" onClick={syncComponent}>Update component and linked copies</button><button type="button" className="secondary" onClick={detachInstance}>Detach selected copy</button></div>:null}{(editing.components||[]).map(component=><div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 34px",gap:5}} key={component.id}><button type="button" className="secondary" onClick={()=>insertComponent(component)}>{component.name} · {component.layers.length} layers</button><button type="button" className="danger" aria-label={`Delete ${component.name}`} onClick={()=>onChange({components:editing.components?.filter(item=>item.id!==component.id)})}>×</button></div>)}</fieldset>
      <div className="overlay-item-heading"><h3>Images &amp; logos</h3><small className="muted">Upload a transparent logo or reusable raster image. JPEG, PNG, or WebP up to 5 MB.</small></div>
      <label className="secondary" style={{display:"grid",placeItems:"center",minHeight:42,cursor:"pointer"}}>{uploading?"Uploading…":"Upload image"}<input style={{display:"none"}} type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file);event.currentTarget.value="";}}/></label>
      <div style={{display:"grid",gap:6}}>{assets.map(asset=><div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 34px",gap:5}} key={asset.id}><button type="button" className="secondary" style={{display:"grid",gridTemplateColumns:"36px minmax(0,1fr)",alignItems:"center",gap:7,minWidth:0,textAlign:"left"}} title={`Add ${asset.name}`} onClick={()=>add(asset)}><img src={asset.preview} alt="" style={{width:36,height:36,objectFit:"contain"}}/><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{asset.name}</span></button><button type="button" className="danger" aria-label={`Delete ${asset.name}`} onClick={()=>void remove(asset)}>×</button></div>)}</div>
      <div className="overlay-item-heading"><h3>Quick overlay items</h3><small className="muted">Add a polished starter, then freely change its text, metadata, color, size, shape, and position.</small></div>
      <div className="overlay-item-presets">
        {overlayItemPresets.map((preset) => (
          <button className="secondary" title={`Add ${preset.name}`} onClick={() => onAddPreset(preset)} key={preset.id}>
            <span className={`overlay-item-sample shape-${preset.shape}`} style={{ color: preset.foreground, background: preset.background }}><PosterIcon name={preset.icon} /><strong>{preset.name}</strong></span>
            <small>{preset.description}</small>
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
