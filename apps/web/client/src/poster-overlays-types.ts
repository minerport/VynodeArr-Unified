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
  conditions: {
    join: "and" | "or";
    rules: Array<{
      variable: string;
      operator: "truthy" | "falsy" | "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "greater_than_or_equal" | "less_than_or_equal";
      value: string;
    }>;
  };
  styleMode: "first" | "merge";
  styleRules: Array<{
    id: string;
    name: string;
    rank: number;
    conditions: OverlayLayer["conditions"];
    overrides: Partial<Pick<OverlayLayer,"foreground"|"background"|"iconColor"|"iconSize"|"fontSize"|"fontFamily"|"fontWeight"|"textAlign"|"textTransform"|"textOpacity"|"backgroundOpacity"|"shape"|"padding"|"borderRadius"|"prefix"|"suffix"|"posterAware">>;
  }>;
}
export interface OverlayTemplate {
  id: string;
  name: string;
  domain: OverlayDomain;
  target: "vynode" | "plex";
  enabled: boolean;
  tvFileAggregation: "most_common" | "best" | "lowest" | "mixed" | "latest";
  layers: OverlayLayer[];
  plexBadges: {
    monitored: boolean;
    availability: boolean;
    cutoff: boolean;
    rating: boolean;
  };
  canvas?: {
    backgroundType: "solid" | "linear" | "radial";
    colorA: string;
    colorB: string;
    angle: number;
    backgroundAsset?: string;
    backgroundPreview?: string;
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
  qualityProfile?: string | number;
  collection?: string;
  studio?: string;
  originalLanguage?: string | { name?: string };
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
  runtimeMinutes?: number;
  certification?: string;
  seasonProgress?: string;
  episodeProgress?: string;
  seriesType?: string;
  firstAired?: string;
  addedAt?: string;
  plexAddedAt?: number | string | null;
  previewKey?: string;
  previewLabel?: string;
  releaseDate?: string;
  completionPercent?: number;
  sizeOnDisk?: number;
  tags?: string[];
  queue?: { status?: string; progress?: number; eta?: string } | null;
  fileMetadata?: { quality?: string; resolution?: string; videoCodec?: string; audioCodec?: string; audioChannels?: string | number; dynamicRange?: string; source?: string; languages?: string[]; subtitleLanguages?: string[]; bitrate?: number; edition?: string; releaseGroup?: string; customFormats?: string[]; customFormatScore?: number; size?: number; dateAdded?: string } | null;
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
export interface PlexOverlayConnection {
  configured: boolean;
  endpoint: string;
  server: null | { name: string; machineIdentifier: string; version: string };
  libraries: Array<{ key: string; title: string; type: "movie" | "show"; uuid: string }>;
  updatedAt?: string | null;
  artworkWritesEnabled: boolean;
}
export interface PlexMatchReview {
  generatedAt: string;
  summary: { matched: number; unmatched: number; ambiguous: number; total: number };
  entries: Array<{ domain: "movie"|"tv"; id: string; title: string; year?: number|null; externalIds: string[]; status: "matched"|"unmatched"|"ambiguous"; candidateCount?:number; variableValues?:Record<string,unknown>; plex: Array<{ratingKey:string;title:string;year?:number|null;type:string;thumb?:string;addedAt?:number|string|null}>; plexLibrary:{key:string;title:string;type:string} }>;
  artworkWritesEnabled: boolean;
}
export interface PlexPosterApplication { id:string;title:string;domain:"movie"|"tv";templateName:string;plexLibraryTitle:string;appliedAt:string;restoredAt:string|null;status:"applied"|"restored";variableValues:Record<string,unknown> }
export interface PosterOverlayMountOptions {
  request: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  notify: (message: string, tone?: string) => void;
}
