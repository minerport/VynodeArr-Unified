export type StorageDomain='movie'|'tv';
export interface RootFolder{id:string|number;path:string;accessible?:boolean;freeSpace?:number;unmappedFolders?:Array<{name?:string;path:string}>}
export interface Directory{name:string;path:string}
export interface DownloadFolders{movie?:{path?:string};tv?:{path?:string}}
export interface RootFoldersMountOptions{
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
  startImport:(domain:StorageDomain,items:Array<{title:string;payload:Record<string,unknown>}>)=>Promise<void>;
}
