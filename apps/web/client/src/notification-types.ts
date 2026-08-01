export interface NotificationItem{
  id:string;
  type:'approval'|'approved'|'rejected'|'failed'|'imported';
  title:string;
  message:string;
  timestamp:string;
  href:'#request-management'|'#requests';
  requestId:string;
  read:boolean;
  actionable?:boolean;
}

export interface NotificationMountOptions{
  administrator:boolean;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  canPoll:()=>boolean;
  onPageBadge:(badge:{href:'#request-management'|'#requests';count:number})=>void;
}

export interface SearchActivity{
  id:string;domain:'movie'|'tv';source:string;scope:string;title:string;movieId:number|null;seriesId:number|null;seasonNumber:number|null;episodeIds:number[];commandId:number|null;
  status:'queued'|'searching'|'grabbed'|'downloading'|'imported'|'completed'|'failed'|'canceled';message:string;createdAt:string;updatedAt:string;finishedAt:string|null;
  selection?:{title:string;quality:string;size:number}|null;counts?:{total:number;completed:number;failed:number}|null;
}
