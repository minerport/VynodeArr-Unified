export type LibraryKind = "movies" | "tv";
export type LibraryView = "poster" | "cards" | "compact" | "list";
import type { OverlayLayer } from "./poster-overlays-types";

export interface LibraryArtwork {
  url?: string;
  originalUrl?: string;
  overlayValues?: Record<string, string>;
  overlayTemplateId?: string;
  overlayTemplate?: {
    layers: OverlayLayer[];
  };
}
export interface LibraryQueue {
  progress?: number;
}

export interface LibraryItem {
  id: string;
  engineInstanceId?: string;
  title: string;
  sortTitle?: string;
  year?: number;
  tmdbId?: number | null;
  tvdbId?: number | null;
  imdbId?: string | null;
  overview?: string;
  artwork?: LibraryArtwork;
  monitoring?: string;
  state?: string;
  status?: string;
  nextEpisode?: { title?: string; airDateUtc?: string } | null;
  hasFile?: boolean;
  missingEpisodes?: number;
  cutoffUnmetEpisodes?: number;
  episodeProgress?: string;
  seasonProgress?: string;
  quality?: string;
  qualityProfile?: string;
  collection?: string;
  network?: string;
  genres?: string[];
  rating?: number;
  certification?: string | null;
  runtimeMinutes?: number;
  releaseDate?: string | null;
  firstAired?: string | null;
  addedAt?: string | null;
  completionPercent?: number;
  sizeOnDisk?: number;
  queue?: LibraryQueue;
}

export interface LibraryEngineOption {
  id:string;
  name:string;
  isDefault:boolean;
}

export interface LibraryMountOptions {
  kind: LibraryKind;
  administrator: boolean;
  items: LibraryItem[];
  initialView: LibraryView;
  request: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  notify: (message: string, tone?: string) => void;
  onViewChange: (view: LibraryView) => void;
  onItemChange?: (item: LibraryItem) => void;
  onLoaded?: (items: LibraryItem[], mode?: string) => void;
}
