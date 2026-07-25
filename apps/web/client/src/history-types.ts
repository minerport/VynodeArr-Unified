export type HistoryDomain='movie'|'tv';

export interface HistoryItem {
  id:string;
  domain:HistoryDomain;
  mediaId?:string|null;
  title:string;
  context?:string|null;
  eventType?:string;
  quality?:string|null;
  timestamp?:string|null;
  details?:string|null;
}

export interface HistoryMountOptions {
  items:HistoryItem[];
  administrator:boolean;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
