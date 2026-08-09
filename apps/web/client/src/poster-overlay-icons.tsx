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
  ["filmstrip", "Film strip", "M3 5h18v14H3zM3 9h18M3 15h18M7 5v4M12 5v4M17 5v4M7 15v4M12 15v4M17 15v4"],
  ["clapperboard", "Clapperboard", "M3 8h18v12H3zM3 8l2-5h16l-2 5M7 3l3 5M14 3l3 5"],
  ["megaphone", "Megaphone", "M3 10v4h4l9 5V5L7 10zM7 14l2 6h4l-2-5M19 9a4 4 0 010 6"],
  ["popcorn", "Popcorn", "M6 9h12l-2 12H8zM7 9C4 8 5 4 8 5c0-4 5-4 5 0 3-2 7 1 4 4"],
  ["spotlight", "Spotlight", "M4 4h7v5H4zM11 6l9-3v15l-9-7zM6 9v11M9 9v11"],
  ["flame", "Flame", "M12 2c2 5-2 6 1 10 1-3 4-4 5-6 3 6 1 14-6 16-6 2-11-3-10-8 1 2 2 3 4 4-1-5 3-7 4-10z"],
  ["laurel", "Laurel", "M8 20C3 16 3 9 7 4M6 16l-3-1M5 12l-3-2M6 8L4 5M16 20c5-4 5-11 1-16m2 12 3-1m-2-3 3-2m-4-2 2-3"],
  ["marquee", "Marquee", "M3 6h18v12H3zM6 3h12M6 21h12M7 9h10M7 13h7"],
  ["ticket", "Ticket", "M3 7h18v4a2 2 0 000 4v4H3v-4a2 2 0 000-4zM9 7v10"],
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
