import type { OverlayLayer, OverlayTemplate } from "./poster-overlays-types";

export type AlignmentAction = "left" | "center-x" | "right" | "top" | "center-y" | "bottom" | "distribute-x" | "distribute-y" | "safe";

export function transformLayers(layers: OverlayLayer[], ids: string[], action: AlignmentAction) {
  const chosen = layers.filter(layer => ids.includes(layer.id) && !layer.locked);
  if (!chosen.length) return layers;
  const minX = Math.min(...chosen.map(layer => layer.x));
  const maxRight = Math.max(...chosen.map(layer => layer.x + layer.width));
  const minY = Math.min(...chosen.map(layer => layer.y));
  const maxBottom = Math.max(...chosen.map(layer => layer.y + (layer.height || 4)));
  const ordered = action === "distribute-x" ? [...chosen].sort((a,b)=>a.x-b.x) : [...chosen].sort((a,b)=>a.y-b.y);
  const indexById = new Map(ordered.map((layer,index)=>[layer.id,index]));
  return layers.map<OverlayLayer>(layer => {
    if (!ids.includes(layer.id) || layer.locked) return layer;
    if (action === "left") return {...layer,position:"custom",x:minX};
    if (action === "right") return {...layer,position:"custom",x:Math.max(0,maxRight-layer.width)};
    if (action === "center-x") return {...layer,position:"custom",x:Math.max(0,Math.min(100-layer.width,(minX+maxRight-layer.width)/2))};
    if (action === "top") return {...layer,position:"custom",y:minY};
    if (action === "bottom") return {...layer,position:"custom",y:Math.max(0,maxBottom-(layer.height||4))};
    if (action === "center-y") return {...layer,position:"custom",y:Math.max(0,Math.min(96,(minY+maxBottom-(layer.height||4))/2))};
    if (action === "safe") return {...layer,position:"custom",x:Math.max(5,Math.min(95-layer.width,layer.x)),y:Math.max(5,Math.min(91-(layer.height||4),layer.y))};
    const index=indexById.get(layer.id)||0;
    if (action === "distribute-x" && ordered.length>2) return {...layer,position:"custom",x:minX+index*((maxRight-minX-layer.width)/(ordered.length-1))};
    if (action === "distribute-y" && ordered.length>2) return {...layer,position:"custom",y:minY+index*((maxBottom-minY-(layer.height||4))/(ordered.length-1))};
    return layer;
  });
}

export function nudgeLayers(layers:OverlayLayer[],ids:string[],dx:number,dy:number){
  const selected=new Set(ids),groups=new Set(layers.filter(layer=>selected.has(layer.id)&&layer.groupId).map(layer=>layer.groupId));
  return layers.map(layer=>!layer.locked&&(selected.has(layer.id)||(layer.groupId&&groups.has(layer.groupId)))?{...layer,position:"custom" as const,x:Math.max(0,Math.min(100-layer.width,layer.x+dx)),y:Math.max(0,Math.min(100-Math.max(0,layer.height),layer.y+dy))}:layer);
}

const luminance=(hex:string)=>{const rgb=(hex.match(/[a-f\d]{2}/gi)||["00","00","00"]).map(value=>{const channel=parseInt(value,16)/255;return channel<=.03928?channel/12.92:((channel+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};
export function accessibilityIssues(template:OverlayTemplate) {
  const issues:string[]=[];
  for(const [index,layer] of template.layers.entries()){
    if(!layer.enabled)continue;
    const a=luminance(layer.foreground),b=luminance(layer.background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    if(layer.kind!=="shape"&&ratio<4.5)issues.push(`Layer ${index+1}: text contrast is ${ratio.toFixed(1)}:1; aim for at least 4.5:1.`);
    if(layer.kind!=="shape"&&layer.fontSize<16)issues.push(`Layer ${index+1}: text may be too small.`);
    if(layer.textOpacity<.55)issues.push(`Layer ${index+1}: text opacity may reduce readability.`);
    if(layer.x<0||layer.y<0||layer.x+layer.width>100||layer.y+(layer.height||4)>100)issues.push(`Layer ${index+1}: part of the layer is outside the poster.`);
  }
  for(let a=0;a<template.layers.length;a++)for(let b=a+1;b<template.layers.length;b++){
    const x=template.layers[a],y=template.layers[b];
    if(x.enabled&&y.enabled&&(!x.groupId||x.groupId!==y.groupId)&&x.x<y.x+y.width&&x.x+x.width>y.x&&x.y<y.y+(y.height||4)&&x.y+(x.height||4)>y.y)issues.push(`Layers ${a+1} and ${b+1} overlap; verify the preview is intentional.`);
  }
  return issues.slice(0,8);
}
