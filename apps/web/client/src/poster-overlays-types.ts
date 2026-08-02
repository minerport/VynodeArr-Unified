export type OverlayDomain = "all" | "movie" | "tv";
export type OverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "custom";
export interface OverlayLayer {
  id: string;
  label: string;
  variable: string;
  kind: "text" | "icon" | "shape";
  iconName: string;
  iconColor?: string;
  iconSize?: number;
  contentGap?: number;
  textFit?: "fixed" | "shrink" | "wrap";
  maxLines?: number;
  contentPosition: "none" | "inside" | "above" | "below" | "left" | "right";
  position: OverlayPosition;
  x: number;
  y: number;
  width: number;
  /** Poster-height percentage. Zero preserves the legacy content-sized height. */
  height: number;
  prefix: string;
  suffix: string;
  foreground: string;
  background: string;
  fontSize: number;
  fontFamily: "sans" | "serif" | "condensed" | "monospace";
  fontWeight: 400 | 500 | 600 | 700 | 800 | 900;
  textAlign: "left" | "center" | "right";
  textTransform: "none" | "uppercase" | "lowercase";
  textOpacity: number;
  backgroundOpacity: number;
  posterAware: boolean;
  shape: "rounded" | "square" | "pill" | "circle" | "ticket" | "ribbon" | "tag" | "hexagon" | "chevron";
  padding: number;
  borderRadius: number;
  enabled: boolean;
  condition: { operator: "truthy" | "equals" | "not_equals"; value: string };
}
export interface OverlayTemplate {
  id: string;
  name: string;
  domain: OverlayDomain;
  enabled: boolean;
  layers: OverlayLayer[];
  plexBadges: {
    monitored: boolean;
    availability: boolean;
    cutoff: boolean;
    rating: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}
export interface OverlayAssignment {
  id: string;
  templateId: string;
  name: string;
  enabled: boolean;
  scope: {
    type: "all" | "items" | "rules";
    domain: OverlayDomain;
    mediaIds: string[];
    rules: {
      genres: string[];
      years: number[];
      availability: string;
      monitoring: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
}
export interface OverlayMedia {
  id: string;
  title: string;
  year?: number;
  rating?: number;
  quality?: string;
  collection?: string;
  network?: string;
  genres?: string[];
  monitoring?: string;
  state?: string;
  hasFile?: boolean;
  missingEpisodes?: number;
  status?: string;
  nextEpisode?: { title?: string; airDateUtc?: string } | null;
  artwork?: {
    url?: string;
    originalUrl?: string;
    overlayValues?: Record<string, string>;
  };
  cutoffUnmetEpisodes?: number;
}
export interface OverlayCollection {
  id: string;
  name: string;
  members?: OverlayMedia[];
}
export interface OverlayUserCollection {
  user: { id: string; name: string; username: string };
  movies: OverlayMedia[];
  television: OverlayMedia[];
}
export interface PosterOverlayMountOptions {
  request: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  notify: (message: string, tone?: string) => void;
}
