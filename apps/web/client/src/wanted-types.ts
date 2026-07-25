export type WantedDomain='movie'|'tv';
export type WantedView='wantedMissing'|'wantedCutoff';
export interface WantedItem {
  id:number; domain:WantedDomain; seriesId?:number; seasonNumber?:number; episodeNumber?:number; title?:string; status?:string;
  movie?:{title?:string}; series?:{title?:string;tvdbId?:number}; qualityProfile?:{name?:string};
}
export interface WantedLibraryItem {id:number;domain:WantedDomain;title?:string;tvdbId?:number}
export interface SearchJob {id:string;domain:WantedDomain;label:string;status:string;total:number;completed:number;failed:number;currentTitle?:string;createdAt:string}
export interface WantedMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
