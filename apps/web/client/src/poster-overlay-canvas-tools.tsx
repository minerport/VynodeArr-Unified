import { useEffect } from "react";

export type OverlayCanvasView = { zoom:number; grid:boolean; safe:boolean; snap:number };
const styles=`.overlay-canvas-tools{display:grid;gap:8px;width:100%;padding:10px;border:1px solid var(--border);border-radius:11px;background:color-mix(in srgb,var(--accent) 5%,transparent)}.overlay-canvas-tools small{color:var(--muted);line-height:1.35}.overlay-canvas-zoom{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:5px;align-items:center}.overlay-canvas-zoom button{min-width:34px;padding:6px}.overlay-canvas-zoom label{display:grid;grid-template-columns:auto minmax(55px,1fr) auto;gap:6px;align-items:center;font-size:.75rem}.overlay-canvas-zoom input{min-width:0;width:100%}.overlay-canvas-zoom span{font-variant-numeric:tabular-nums}.overlay-canvas-toggles{display:flex;flex-wrap:wrap;gap:7px 12px;align-items:center}.overlay-canvas-toggles label{display:flex!important;width:auto!important;gap:5px;align-items:center;font-size:.78rem}.overlay-canvas-toggles input{width:auto}.overlay-canvas-toggles select{width:auto;min-width:65px;padding:5px}.overlay-canvas-stage{box-sizing:border-box;display:grid;width:100%;max-height:60vh;overflow:auto;padding:12px;border:1px solid color-mix(in srgb,var(--border) 65%,transparent);border-radius:12px;background:#050912;place-items:start center}.overlay-canvas-grid,.overlay-canvas-safe{position:absolute;inset:0;z-index:6;pointer-events:none}.overlay-canvas-grid{background-image:linear-gradient(to right,#79b8ff2e 1px,transparent 1px),linear-gradient(to bottom,#79b8ff2e 1px,transparent 1px);background-size:10% 10%}.overlay-canvas-safe{inset:5%;border:1px dashed #ffd658e6;box-shadow:0 0 0 1px #0006 inset}.overlay-canvas-safe:after,.overlay-canvas-safe:before{position:absolute;background:#ffd65880;content:""}.overlay-canvas-safe:before{left:50%;width:1px;height:100%}.overlay-canvas-safe:after{top:50%;width:100%;height:1px}`;

export default function OverlayCanvasTools({view,onChange,onNudge,selectionCount,onUndo,onRedo}:{
  view:OverlayCanvasView;
  onChange:(view:OverlayCanvasView)=>void;
  onNudge:(dx:number,dy:number)=>void;
  selectionCount:number;
  onUndo:()=>void;
  onRedo:()=>void;
}) {
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target?.closest("input,select,textarea,[contenteditable=true]"))return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){
        event.preventDefault();
        event.shiftKey?onRedo():onUndo();
        return;
      }
      const movement:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      const direction=movement[event.key];
      if(!direction||!selectionCount)return;
      event.preventDefault();
      const distance=event.altKey?.1:event.shiftKey?5:1;
      onNudge(direction[0]*distance,direction[1]*distance);
    };
    window.addEventListener("keydown",key);
    return()=>window.removeEventListener("keydown",key);
  },[onNudge,onRedo,onUndo,selectionCount]);
  const update=(changes:Partial<OverlayCanvasView>)=>onChange({...view,...changes});
  return <><style>{styles}</style><section className="overlay-canvas-tools" aria-label="Canvas controls">
    <div className="overlay-canvas-zoom">
      <button type="button" className="secondary" aria-label="Zoom out" onClick={()=>update({zoom:Math.max(50,view.zoom-10)})}>−</button>
      <label>Zoom <input aria-label="Canvas zoom" type="range" min="50" max="160" step="10" value={view.zoom} onChange={event=>update({zoom:Number(event.target.value)})}/><span>{view.zoom}%</span></label>
      <button type="button" className="secondary" aria-label="Zoom in" onClick={()=>update({zoom:Math.min(160,view.zoom+10)})}>+</button>
      <button type="button" className="secondary" onClick={()=>update({zoom:100})}>Fit</button>
    </div>
    <div className="overlay-canvas-toggles">
      <label><input type="checkbox" checked={view.grid} onChange={event=>update({grid:event.target.checked})}/> Grid</label>
      <label><input type="checkbox" checked={view.safe} onChange={event=>update({safe:event.target.checked})}/> Safe area</label>
      <label>Snap <select value={view.snap} onChange={event=>update({snap:Number(event.target.value)})}><option value="0">Off</option><option value="1">1%</option><option value="2.5">2.5%</option><option value="5">5%</option></select></label>
    </div>
    <small>{selectionCount?`Arrow keys move ${selectionCount} selected layer${selectionCount===1?"":"s"}; Shift moves 5%, Alt moves 0.1%.`:`Select a layer to use keyboard nudging.`}</small>
  </section></>;
}
