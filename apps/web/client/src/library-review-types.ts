export interface LibraryReviewMountOptions {
  request: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  notify: (message: string, tone?: string) => void;
}

export interface PlexReviewMovie {
  ratingKey: string;
  title: string;
  year: number | null;
  tmdbId: number | null;
  libraryKey: string;
  libraryTitle: string;
  filePaths: string[];
}

export interface VynodeReviewMovie {
  id: number;
  publicId: string;
  title: string;
  year: number | null;
  tmdbId: number | null;
  folderPath: string;
  filePath: string;
}

export interface FolderScanMovie {
  path: string;
  name: string;
  status: "matched" | "unmatched";
  movieId: number | null;
  tmdbId: number | null;
  filePath: string;
}

export interface MovieLibraryReview {
  libraries: Array<{ key: string; title: string; type: string }>;
  plex: PlexReviewMovie[];
  vynode: VynodeReviewMovie[];
  scan: FolderScanMovie[];
}
