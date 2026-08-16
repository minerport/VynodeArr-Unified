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
  /** User-facing editor name; it does not affect rendered content. */
  name?: string;
  /** Locked layers remain visible but cannot be moved or resized on the canvas. */
  locked?: boolean;
  /** Optional editor grouping identifier. Rendering order remains layer based. */
  groupId?: string;
  componentId?: string;
  componentInstanceId?: string;
  componentLayerId?: string;
  componentOverrides?: Array<"content"|"appearance"|"geometry"|"visibility">;
  groupLayout?: "free" | "row" | "column";
  groupGap?: number;
  groupAlign?: "start" | "center" | "end";
  label: string;
  variable: string;
  /** Optional text expression such as "{title} ({year})". */
  contentTemplate?: string;
  fallbackText?: string;
  missingBehavior?: "hide" | "fallback";
  kind: "text" | "icon" | "shape" | "image";
  assetId?: string;
  assetName?: string;
  imageFit?: "contain" | "cover" | "fill";
  imageOpacity?: number;
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
  rotation?: number;
  borderWidth?: number;
  borderColor?: string;
  textStrokeWidth?: number;
  textStrokeColor?: string;
  shadow?: "none" | "soft" | "strong" | "glow";
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
  previewPosterKey?: string;
  tvFileAggregation: "most_common" | "best" | "lowest" | "mixed" | "latest";
  layers: OverlayLayer[];
  components?: Array<{id:string;name:string;layers:OverlayLayer[]}>;
  variants?: Array<{
    id: string;
    name: string;
    layers: OverlayLayer[];
  }>;
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
    /** Up to four TMDB posters displayed as a 2 x 2 collection collage. */
    quadPosters?: Array<{ domain: "movie" | "tv"; tmdbId: number; title?: string }>;
  };
  createdAt?: string;
  updatedAt?: string;
}
export interface OverlayAsset { id:string;name:string;mime:string;size:number;createdAt?:string;preview:string }
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
    overlayTemplateId?: string;
    overlayTemplate?: { layers: OverlayLayer[] };
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
  entries: Array<{ domain: "movie"|"tv"; id: string; title: string; year?: number|null; engineInstanceId?:string|null; engineInstanceName?:string|null; externalIds: string[]; status: "matched"|"unmatched"|"ambiguous"; candidateCount?:number; variableValues?:Record<string,unknown>; plex: Array<{ratingKey:string;title:string;year?:number|null;type:string;thumb?:string;addedAt?:number|string|null}>; plexLibrary:{key:string;title:string;type:string} }>;
  artworkWritesEnabled: boolean;
}
export interface PlexPosterApplication { id:string;title:string;domain:"movie"|"tv";engineInstanceId?:string|null;engineInstanceName?:string|null;templateName:string;plexLibraryTitle:string;appliedAt:string;restoredAt:string|null;status:"applied"|"restored";variableValues:Record<string,unknown>;source?:"plex"|"list";listId?:string;listName?:string;role?:"collection"|"placeholder"|"existing"|"newly_available"|"title_overlays";affectedCount?:number;restoreKind?:"collection"|"titles";restorable?:boolean }
export interface PosterOverlayMountOptions {
  request: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  notify: (message: string, tone?: string) => void;
}
