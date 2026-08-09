import type { PathMigrationMatch, PathMigrationPreview, RootFolder, RootFoldersMountOptions, StorageDomain } from "./root-folders-types";

export function reviewPathMigration(options: RootFoldersMountOptions, domain: StorageDomain, root: RootFolder) {
  return options.request<PathMigrationPreview>(`/api/storage/path-migration/preview?domain=${domain}&targetRoot=${encodeURIComponent(root.path)}`);
}

export function applyPathMigration(options: RootFoldersMountOptions, domain: StorageDomain, match: PathMigrationMatch, ids: number[], final: boolean) {
  return options.request<{ updated: number; collectionsUpdated?: number; engineUpdated:boolean; verification?:{engineTitlesRemaining:number;engineCollectionsRemaining:number;vynodeArrSynchronized:boolean}|null }>("/api/storage/path-migration", {
    method: "POST",
    body: JSON.stringify({ domain, sourceRoot: match.sourceRoot, targetRoot: match.targetRoot, ids, final }),
  });
}
