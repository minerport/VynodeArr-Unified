export type HealthDomain='movie'|'tv';

export interface HealthItem {
  id:string;
  domain:HealthDomain;
  severity?:string|null;
  message:string;
  source?:string|null;
  recovery?:{
    kind:'removed-tmdb';
    oldTmdbId:number|null;
    libraryItem:{id:number;title:string;year:number|null}|null;
    replacement:{tmdbId:number;title:string;year:number|null}|null;
  }|null;
}

export interface HealthMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
}
export interface EnginePathVerification {path:string;rootRegistered:boolean;titleCount:number;collectionCount:number;titleExamples:string[];collectionExamples:string[];equivalentTargets:string[];checkedAt:string}
