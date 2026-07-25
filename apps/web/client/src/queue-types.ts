export type QueueDomain='movie'|'tv';
export interface QueueItem {
  id:string|number; domain:QueueDomain; mediaId?:string|number|null;
  media?:{title?:string}; movie?:{title?:string}; series?:{title?:string};
  episode?:{seasonNumber?:number;episodeNumber?:number;title?:string};
  title?:string; clientFilename?:string; downloadClient?:string; protocol?:string; indexer?:string;
  quality?:string|{name?:string;quality?:{name?:string}};
  clientStatus?:string; status?:string; trackedDownloadStatus?:string; trackedDownloadState?:string;
  clientPercentage?:number; size?:number; sizeleft?:number; clientTimeLeft?:string; clientSpeed?:string;
  statusMessages?:Array<{messages?:string[]}>;
}
export interface QueueMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
