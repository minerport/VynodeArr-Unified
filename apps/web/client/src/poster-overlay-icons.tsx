import type { CSSProperties } from "react";
export const posterIcons = [
  ["movie", "Movie", "M4 6h16v12H4zM7 3l2 3m3-3 2 3m3-3 2 3"],
  ["television", "Television", "M3 6h18v13H3zM8 22h8M9 2l3 4 3-4"],
  ["play", "Play", "M8 5v14l11-7z"],
  ["collection", "Collection", "M4 5h16v14H4zM7 2h10M7 22h10"],
  ["resolution", "Resolution", "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"],
  ["quality", "Quality", "M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"],
  ["audio", "Audio", "M5 9v6h4l5 4V5L9 9zM17 8a5 5 0 010 8M19 5a9 9 0 010 14"],
  ["subtitles", "Subtitles", "M3 5h18v14H3zM6 10h5M6 14h8M13 10h5M16 14h2"],
  ["calendar", "Calendar", "M4 5h16v16H4zM8 2v6M16 2v6M4 10h16"],
  ["clock", "Runtime", "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l4 2"],
  ["star", "Rating", "M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"],
  ["network", "Network", "M5 7h14v10H5zM2 10h3M19 10h3M9 20h6M12 17v3"],
  ["stream", "Streaming", "M4 7h16v10H4zM9 4h6M8 20h8M10 10l5 2-5 2z"],
  ["download", "Downloaded", "M12 3v12M7 10l5 5 5-5M4 20h16"],
  ["monitor", "Monitored", "M2 12s4-7 10-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z"],
  ["missing", "Missing", "M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v6M12 17h.01"],
] as const;
export const posterIconPath = (name: string) => posterIcons.find(([id]) => id === name)?.[2] || posterIcons[0][2];
export function PosterIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" style={{display:"block",width:"100%",height:"auto",aspectRatio:"1",color:"inherit"}}><path d={posterIconPath(name)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function PosterLayerContent({layer,text}:{layer:OverlayLayer;text:string}){
  const kind=layer.kind||(layer.variable==="icon"?"icon":"text"),position=layer.contentPosition||"none";
  const textStyle:CSSProperties|undefined=layer.textFit==="wrap"?{display:"-webkit-box",whiteSpace:"normal",overflowWrap:"anywhere",WebkitBoxOrient:"vertical",WebkitLineClamp:layer.maxLines||2,overflow:"hidden"}:layer.textFit==="shrink"?{display:"block",fontSize:`${Math.max(42,Math.min(100,2800/Math.max(28,text.length)))}%`,whiteSpace:"nowrap"}:undefined;
  if(kind!=="icon")return <span style={textStyle}>{text}</span>;
  const iconStyle={display:"block",width:`${layer.iconSize||70}%`,color:layer.iconColor||layer.foreground,flex:"0 0 auto"} as const;
  if(position==="inside")return <span style={{display:"grid",placeItems:"center",position:"relative",width:"100%"}}><span style={iconStyle}><PosterIcon name={layer.iconName||layer.label}/></span>{text?<span style={{position:"absolute",inset:0,display:"grid",placeItems:"center",overflow:"hidden",textShadow:"0 1px 4px #000",...textStyle}}>{text}</span>:null}</span>;
  const vertical=position==="above"||position==="below",reverse=position==="above"||position==="left";
  return <span style={{display:"flex",flexDirection:vertical?(reverse?"column-reverse":"column"):(reverse?"row-reverse":"row"),alignItems:"center",justifyContent:"center",gap:`${(layer.contentGap??12)/6}cqi`,width:"100%"}}><span style={iconStyle}><PosterIcon name={layer.iconName||layer.label}/></span>{position!=="none"&&text?<span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",...textStyle}}>{text}</span>:null}</span>;
}
import type { OverlayLayer } from "./poster-overlays-types";
