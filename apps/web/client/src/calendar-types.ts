export type CalendarDomain='movie'|'tv';
export interface CalendarEvent {
  id:number; domain:CalendarDomain; title:string; overview?:string; monitored?:boolean;
  seriesId?:number; series?:{title?:string}; seasonNumber?:number; episodeNumber?:number;
  digitalRelease?:string; physicalRelease?:string; inCinemas?:string; releaseDate?:string; airDateUtc?:string;
}
export interface CalendarMountOptions {request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>}
