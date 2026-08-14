export type WantedDomain='movie'|'tv';
export type WantedView='wantedMissing'|'wantedCutoff';
export interface WantedItem {
  id:number; domain:WantedDomain; seriesId?:number; seasonNumber?:number; episodeNumber?:number; title?:string; status?:string;
  engineInstanceId?:string; engineInstanceName?:string;
  airDateUtc?:string; releaseDate?:string; runtime?:number; monitored?:boolean;
  movie?:{title?:string;year?:number;runtime?:number;studio?:string;genres?:string[];qualityProfileId?:number};
  series?:{title?:string;tvdbId?:number;year?:number;network?:string;genres?:string[]};
  qualityProfile?:{name?:string};
  requesters?:Array<{id:string;name:string;username:string;requestedAt?:string|null}>;
}
export interface WantedLibraryItem {id:number;domain:WantedDomain;engineInstanceId?:string;engineInstanceName?:string;title?:string;tvdbId?:number;year?:number;network?:string;studio?:string;genres?:string[];qualityProfile?:string}
export interface SearchJob {id:string;domain:WantedDomain;engineInstanceId?:string;engineInstanceName?:string;label:string;status:string;total:number;completed:number;failed:number;currentTitle?:string;createdAt:string}
export interface WantedMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
