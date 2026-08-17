export type StorageDomain='movie'|'tv';
export interface RootFolder{id:string|number;path:string;accessible?:boolean;freeSpace?:number;engineInstanceId?:string|null;engineInstanceName?:string|null;vynodePath?:string;storageStatus?:string;restartRequired?:boolean;unmappedFolders?:Array<{name?:string;path:string}>}
export interface EngineStorageMapping{engineInstanceId:string;engineInstanceName:string;domain:StorageDomain;enginePath:string;vynodePath:string;hostPath:string|null;mapped:boolean;exists:boolean;directory:boolean;writable:boolean;accessible:boolean;status:string;restartRequired:boolean;explanation:string;error:string|null;remediation:{docker:string;unraid:string}}
export interface EngineInventory{instance:{id:string;name:string;domain:StorageDomain;isDefault?:boolean};summary:{identified:number;unavailable:number;total:number};resources:Array<{resource:string;available:boolean;manageable:boolean;count:number;error?:string}>;storage:EngineStorageMapping[];syncedAt:string}
export interface Directory{name:string;path:string}
export interface DownloadFolders{movie?:{path?:string};tv?:{path?:string}}
export interface DestinationProfile{id:number;name:string;engineInstanceId?:string|null;engineInstanceName?:string|null}
export interface DestinationPlexLibrary{key:string|number;title:string;type:string;locations?:string[]}
export interface MediaDestination{id:string;domain:StorageDomain;engineInstanceId?:string|null;engineInstanceName?:string|null;name:string;rootFolderPath:string;vynodePath?:string;storageStatus?:string|null;qualityProfileId:number;qualityProfile?:DestinationProfile|null;isDefault?:boolean;administratorOnly?:boolean;ready?:boolean;rootAvailable?:boolean;restartRequired?:boolean;discovered?:boolean;plexLibraryKey?:string|null;plexLibrary?:DestinationPlexLibrary|null;suggestedPlexLibrary?:DestinationPlexLibrary|null;minimumAvailability?:string;monitor?:string;seriesType?:string;titleCount?:number}
export interface MediaDestinationResponse{destinations:MediaDestination[];profiles:Record<StorageDomain,DestinationProfile[]>;plexLibraries:DestinationPlexLibrary[]}
export interface AvailableLibraryFolder{path:string;label:string;domain:StorageDomain|null;configured:boolean;registered?:boolean;registeredMovie?:boolean;registeredTv?:boolean}
export interface AvailableLibraryFoldersResponse{mainMediaConfigured:boolean;folders:AvailableLibraryFolder[];mediaChildren:AvailableLibraryFolder[]}
export interface PathMigrationItem{id:number;title:string;oldPath:string;newPath:string}
export interface PathMigrationMatch{sourceRoot:string;targetRoot:string;affected:PathMigrationItem[];affectedCollections?:PathMigrationItem[]}
export interface PathMigrationPreview{domain:StorageDomain;targetRoot:string;equivalent:boolean;matches:PathMigrationMatch[];match:PathMigrationMatch|null}
export interface RootFoldersMountOptions{
  initialDomain?:StorageDomain;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
  startImport:(domain:StorageDomain,items:Array<{title:string;payload:Record<string,unknown>}>,engineInstanceId?:string|null)=>Promise<void>;
}
