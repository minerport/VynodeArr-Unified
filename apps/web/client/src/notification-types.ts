export interface NotificationItem{
  id:string;
  type:'approval'|'approved'|'rejected'|'failed'|'imported'|'grabbed';
  title:string;
  message:string;
  timestamp:string;
  href:string;
  requestId:string;
  read:boolean;
  actionable?:boolean;
  category?:'request'|'download'|'import'|'system'|'security';
  severity?:'information'|'success'|'warning'|'critical';
}

export interface NotificationMountOptions{
  administrator:boolean;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  canPoll:()=>boolean;
  onPageBadge:(badge:{href:'#request-management'|'#requests';count:number})=>void;
}

export interface NotificationPreferences{
  inApp:boolean;
  categories:Record<'request'|'download'|'import'|'system'|'security',boolean>;
  minimumSeverity:'information'|'warning'|'critical';
  quietHours:{enabled:boolean;start:number;end:number};
}

export interface NotificationChannel{
  id:string;type:'discord'|'telegram'|'gotify';name:string;enabled:boolean;categories:string[];chatId?:string;endpoint?:string;credential?:string;credentialConfigured?:boolean;template?:NotificationChannelTemplate;
}

export interface NotificationChannelTemplate{title:string;message:string;includeLink:boolean;accentColor:string;priority:number;json:string;}

export interface NotificationDelivery{
  id:string;channelId:string;channelName:string;type:string;eventId:string;title:string;status:'delivered'|'failed';error:string;attempt:number;timestamp:string;
}

export interface SearchActivity{
  id:string;domain:'movie'|'tv';source:string;scope:string;title:string;movieId:number|null;seriesId:number|null;seasonNumber:number|null;episodeIds:number[];commandId:number|null;
  status:'queued'|'searching'|'grabbed'|'downloading'|'imported'|'completed'|'failed'|'canceled';message:string;createdAt:string;updatedAt:string;finishedAt:string|null;
  selection?:{title:string;quality:string;size:number}|null;counts?:{total:number;completed:number;failed:number}|null;
}
