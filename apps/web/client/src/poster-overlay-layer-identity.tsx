import type { OverlayLayer } from "./poster-overlays-types";
import { posterIcons } from "./poster-overlay-icons";
const shapes=["rounded","square","pill","circle","ticket","ribbon","tag","hexagon","chevron"] as const;
export default function LayerIdentity({layer,variables,onChange}:{layer:OverlayLayer;variables:string[];onChange:(changes:Partial<OverlayLayer>)=>void}){
 const kind=layer.kind||(layer.variable==="icon"?"icon":"text"),variable=layer.variable==="icon"?"custom_text":layer.variable;
 return <>
  <div className="notice"><strong>{kind[0].toUpperCase()+kind.slice(1)} layer</strong><small className="muted">{kind==="text"?"Metadata rendered as text":kind==="icon"?"Icon artwork with optional metadata":"Shape with optional metadata"}</small></div>
  {kind==="icon"?<>
   <label>Icon artwork<select value={layer.iconName||layer.label||"movie"} onChange={e=>onChange({iconName:e.target.value})}>{posterIcons.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
   <label>Outer shape<select value={layer.shape||"rounded"} onChange={e=>onChange({shape:e.target.value as OverlayLayer["shape"]})}>{shapes.map(shape=><option value={shape} key={shape}>{shape}</option>)}</select></label>
   <label>Icon color<input type="color" value={layer.iconColor||layer.foreground} onChange={e=>onChange({iconColor:e.target.value})}/></label>
   <label className="overlay-range"><span>Icon size</span><span>{Math.round(layer.iconSize||70)}%</span><input type="range" min="10" max="100" value={layer.iconSize||70} onChange={e=>onChange({iconSize:Number(e.target.value)})}/></label>
  </>:null}
  {kind==="shape"?<><label>Shape<select value={layer.shape||"rounded"} onChange={e=>onChange({shape:e.target.value as OverlayLayer["shape"]})}>{shapes.map(shape=><option value={shape} key={shape}>{shape}</option>)}</select></label><label className="overlay-range"><span>Shape height</span><span>{Math.round(layer.height||6)}%</span><input type="range" min="3" max="100" value={layer.height||6} onChange={e=>{const height=Number(e.target.value);onChange({height,...(layer.y+height>100?{position:"custom",y:Math.max(0,100-height)}:{})})}}/></label></>:null}
  <label>{kind==="text"?"Variable":"Optional variable"}<select value={variable} onChange={e=>{const value=e.target.value;onChange({variable:value,label:value==="custom_text"?"":`{${value}}`,contentPosition:kind==="text"?"none":layer.contentPosition==="none"?"inside":layer.contentPosition})}}>{variables.filter(value=>value!=="icon").map(value=><option value={value} key={value}>{value==="custom_text"?(kind==="text"?"custom text":"No variable / custom text"):value.replaceAll("_"," ")}</option>)}</select></label>
  {variable==="custom_text"?<label>{kind==="text"?"Custom text":"Optional custom text"}<input value={layer.label} maxLength={80} placeholder={kind==="text"?"Custom badge":"Leave blank for artwork only"} onChange={e=>onChange({label:e.target.value})}/></label>:null}
  {kind!=="text"?<label>Variable placement<select value={layer.contentPosition||"none"} onChange={e=>onChange({contentPosition:e.target.value as OverlayLayer["contentPosition"]})}><option value="none">Do not show text</option><option value="inside">Inside</option><option value="above">Above</option><option value="below">Below</option><option value="left">Left</option><option value="right">Right</option></select></label>:null}
  <label>Text fitting<select value={layer.textFit||"fixed"} onChange={e=>onChange({textFit:e.target.value as OverlayLayer["textFit"]})}><option value="fixed">Fixed size</option><option value="shrink">Auto-shrink to fit</option><option value="wrap">Wrap to lines</option></select></label>
  {layer.textFit==="wrap"?<label className="overlay-range"><span>Maximum lines</span><span>{layer.maxLines||2}</span><input type="range" min="1" max="6" value={layer.maxLines||2} onChange={e=>onChange({maxLines:Number(e.target.value)})}/></label>:null}
  {kind==="icon"&&!["none","inside"].includes(layer.contentPosition)?<label className="overlay-range"><span>Icon/text spacing</span><span>{Math.round(layer.contentGap??12)}px</span><input type="range" min="0" max="120" value={layer.contentGap??12} onChange={e=>onChange({contentGap:Number(e.target.value)})}/></label>:null}
 </>;
}
