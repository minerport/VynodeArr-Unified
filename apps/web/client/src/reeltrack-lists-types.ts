export interface ReeltrackListItem {
  mediaId?:number|string;
  title:string;
  type:string;
  year?:number|null;
  source:string;
  externalId:string;
  tmdbId?:number|null;
  posterUrl?:string|null;
  overview?:string|null;
  rank?:number|null;
  domain:'movie'|'tv';
  library?:{id:string|number;title:string;status:'available'|'pending';canView:boolean}|null;
  canRequest:boolean;
  requestBlockReason?:string|null;
}
export interface ReeltrackList {
  id:string|number;
  name:string;
  description?:string|null;
  kind?:string;
  items?:ReeltrackListItem[];
  imported?:boolean;
}
export interface ReeltrackListsMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
  administrator:boolean;
}
