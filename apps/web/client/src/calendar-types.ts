export type CalendarDomain='movie'|'tv';
export interface CalendarEvent {
  id:string; domain:CalendarDomain; mediaId:string; title:string; context?:string|null;
  engineInstanceId?:string;engineInstanceName?:string;
  dateUtc?:string|null; eventType:'release'|'airing';
  artwork?:{url?:string};
}
export interface CalendarMountOptions {request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>}
