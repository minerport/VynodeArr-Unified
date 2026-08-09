export type StorageDomain='movie'|'tv';
export interface RootFolder{id:string|number;path:string;accessible?:boolean;freeSpace?:number;unmappedFolders?:Array<{name?:string;path:string}>}
export interface Directory{name:string;path:string}
export interface DownloadFolders{movie?:{path?:string};tv?:{path?:string}}
export interface DestinationProfile{id:number;name:string}
export interface DestinationPlexLibrary{key:string|number;title:string;type:string;locations?:string[]}
export interface MediaDestination{id:string;domain:StorageDomain;name:string;rootFolderPath:string;qualityProfileId:number;qualityProfile?:DestinationProfile|null;isDefault?:boolean;administratorOnly?:boolean;ready?:boolean;rootAvailable?:boolean;restartRequired?:boolean;discovered?:boolean;plexLibraryKey?:string|null;plexLibrary?:DestinationPlexLibrary|null;suggestedPlexLibrary?:DestinationPlexLibrary|null;minimumAvailability?:string;monitor?:string;seriesType?:string;titleCount?:number}
export interface MediaDestinationResponse{destinations:MediaDestination[];profiles:Record<StorageDomain,DestinationProfile[]>;plexLibraries:DestinationPlexLibrary[]}
export interface AvailableLibraryFolder{path:string;label:string;domain:StorageDomain|null;configured:boolean;registered?:boolean;registeredMovie?:boolean;registeredTv?:boolean}
export interface AvailableLibraryFoldersResponse{mainMediaConfigured:boolean;folders:AvailableLibraryFolder[];mediaChildren:AvailableLibraryFolder[]}
export interface PathMigrationItem{id:number;title:string;oldPath:string;newPath:string}
export interface PathMigrationMatch{sourceRoot:string;targetRoot:string;affected:PathMigrationItem[];affectedCollections?:PathMigrationItem[]}
export interface PathMigrationPreview{domain:StorageDomain;targetRoot:string;equivalent:boolean;matches:PathMigrationMatch[];match:PathMigrationMatch|null}
export interface RootFoldersMountOptions{
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
  startImport:(domain:StorageDomain,items:Array<{title:string;payload:Record<string,unknown>}>)=>Promise<void>;
}
