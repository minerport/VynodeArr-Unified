import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import type { OverlayLayer } from "./poster-overlays-types";

export const overlayClientId = () =>
  crypto.randomUUID?.() ||
  [...crypto.getRandomValues(new Uint32Array(4))]
    .map((value) => value.toString(36))
    .join("");

export function overlayLayerVisible(layer: OverlayLayer, value: unknown) {
  if (!layer.enabled) return false;
  const artworkOnly = layer.kind !== "text" && layer.variable === "custom_text" && !String(value ?? "").trim();
  if (artworkOnly) return true;
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (layer.condition?.operator === "equals") return text === layer.condition.value;
  if (layer.condition?.operator === "not_equals") return text !== layer.condition.value;
  return true;
}

const rgba = (color: string, opacity: number) => {
  const hex = String(color || "#000000").replace("#", "");
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${opacity})`;
};

export function overlayLayerStyle(layer: OverlayLayer): CSSProperties {
  const width = Math.min(100, Math.max(15, layer.width ?? 40));
  const height = Math.min(100, Math.max(0, layer.height ?? 0));
  const x = width >= 100 ? 0 : Math.min(100 - width, Math.max(0, layer.x ?? 0));
  const adaptive = layer.posterAware === true;
  const shapes: Record<OverlayLayer["shape"], CSSProperties> = {
    rounded: {}, square: { borderRadius: 0 }, pill: { borderRadius: "999px" },
    circle: height > 0 ? { borderRadius: "50%" } : { borderRadius: "50%", aspectRatio: "1", width: `${Math.min(width, 40)}%` },
    ticket: { clipPath: "polygon(4% 0,96% 0,100% 22%,96% 50%,100% 78%,96% 100%,4% 100%,0 78%,4% 50%,0 22%)" },
    ribbon: { clipPath: "polygon(0 0,94% 0,100% 50%,94% 100%,0 100%,5% 50%)" },
    tag: { clipPath: "polygon(0 0,88% 0,100% 50%,88% 100%,0 100%)" },
    hexagon: { clipPath: "polygon(8% 0,92% 0,100% 50%,92% 100%,8% 100%,0 50%)" },
    chevron: { clipPath: "polygon(0 0,88% 0,100% 50%,88% 100%,0 100%,12% 50%)" },
  };
  return {
    left: `${x}%`,
    top: `${layer.y}%`,
    width: `${width}%`,
    height: layer.kind === "shape" && height > 0 ? `${height}%` : undefined,
    display: layer.kind === "shape" && height > 0 ? "grid" : undefined,
    alignItems: layer.kind === "shape" && height > 0 ? "center" : undefined,
    boxSizing: "border-box",
    color: rgba(layer.foreground, layer.textOpacity ?? 1),
    background: rgba(layer.background, layer.backgroundOpacity ?? 0.92),
    fontFamily: layer.fontFamily === "serif" ? "Georgia,serif" : layer.fontFamily === "monospace" ? "monospace" : layer.fontFamily === "condensed" ? "Arial Narrow,Arial,sans-serif" : "Arial,sans-serif",
    fontWeight: layer.fontWeight,
    textAlign: layer.textAlign,
    textTransform: layer.textTransform,
    fontSize: `${(layer.fontSize / 6).toFixed(3)}cqi`,
    padding: `${(layer.padding / 6).toFixed(3)}cqi`,
    borderRadius: `${(layer.borderRadius / 6).toFixed(3)}cqi`,
    backdropFilter: adaptive ? "blur(7px) saturate(.8) brightness(.72)" : undefined,
    WebkitBackdropFilter: adaptive ? "blur(7px) saturate(.8) brightness(.72)" : undefined,
    textShadow: adaptive ? "0 1px 2px rgba(0,0,0,.95),0 0 8px rgba(0,0,0,.7)" : undefined,
    boxShadow: adaptive ? "inset 0 0 0 1px rgba(255,255,255,.14),0 2px 10px rgba(0,0,0,.22)" : undefined,
    ...shapes[layer.shape || "rounded"],
  };
}

export function OverlayLayerView({ layer, children, className = "", style, ...props }: { layer: OverlayLayer; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={`poster-overlay-layer ${layer.kind === "icon" || layer.variable === "icon" ? "poster-overlay-icon" : ""} ${className}`} style={{ ...overlayLayerStyle(layer), ...style }}>{children}</span>;
}
