import type { OverlayLayer } from "./poster-overlays-types";

export type OverlayItemPreset = {
  id: string;
  name: string;
  description: string;
  variable: string;
  icon: string;
  shape: OverlayLayer["shape"];
  foreground: string;
  background: string;
  x: number;
  y: number;
  width: number;
  label?: string;
  prefix?: string;
};

export const overlayItemPresets: OverlayItemPreset[] = [
  { id: "media-status", name: "Media status", description: "Monitored, available, missing, or upgrade status.", variable: "availability", icon: "monitor", shape: "pill", foreground: "#9af4c4", background: "#0b5b3a", x: 4, y: 4, width: 43 },
  { id: "quality", name: "Quality", description: "Resolution, HDR, codec, or quality profile.", variable: "resolution", icon: "resolution", shape: "rounded", foreground: "#d8b4fe", background: "#4c1d95", x: 4, y: 4, width: 34 },
  { id: "audio", name: "Audio & subtitles", description: "Audio format, channels, language, or captions.", variable: "audio_codec", icon: "audio", shape: "tag", foreground: "#a5f3fc", background: "#075985", x: 4, y: 4, width: 42 },
  { id: "rating", name: "Ratings", description: "A compact score or audience-facing rating badge.", variable: "rating", icon: "star", shape: "pill", foreground: "#fde68a", background: "#111827", x: 66, y: 88, width: 30, prefix: "★ " },
  { id: "release", name: "Release & airing", description: "New releases, returning series, or the next episode.", variable: "next_episode_or_status", icon: "calendar", shape: "ribbon", foreground: "#f5f3ff", background: "#6d28d9", x: 4, y: 4, width: 62 },
  { id: "edition", name: "Edition", description: "Director's cut, extended, remastered, or custom editions.", variable: "edition", icon: "clapperboard", shape: "ticket", foreground: "#fef3c7", background: "#92400e", x: 4, y: 88, width: 47 },
  { id: "source", name: "Source & service", description: "Disc, web, streaming source, studio, or network.", variable: "source", icon: "stream", shape: "hexagon", foreground: "#a5f3fc", background: "#164e63", x: 62, y: 4, width: 34 },
  { id: "personal", name: "Personal label", description: "Favorites, Watch Next, Family Night, or your own text.", variable: "custom_text", icon: "star", shape: "chevron", foreground: "#fee2e2", background: "#991b1b", x: 4, y: 4, width: 48, label: "FAVORITE" },
];

export function overlayLayerFromPreset(preset: OverlayItemPreset, base: OverlayLayer): OverlayLayer {
  return {
    ...base,
    label: preset.label || `{${preset.variable}}`,
    variable: preset.variable,
    kind: "icon",
    iconName: preset.icon,
    iconColor: preset.foreground,
    iconSize: 18,
    contentGap: 10,
    contentPosition: "right",
    position: "custom",
    x: preset.x,
    y: preset.y,
    width: preset.width,
    height: 0,
    prefix: preset.prefix || "",
    foreground: preset.foreground,
    background: preset.background,
    fontSize: 28,
    fontWeight: 800,
    textAlign: "center",
    textTransform: "uppercase",
    backgroundOpacity: 0.94,
    posterAware: true,
    shape: preset.shape,
    padding: 10,
    borderRadius: preset.shape === "pill" ? 50 : 14,
    conditions: {
      join: "and",
      rules: [{ variable: preset.variable, operator: "truthy", value: "" }],
    },
  };
}
