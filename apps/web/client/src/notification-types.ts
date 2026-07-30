export interface NotificationItem{
  id:string;
  type:'approval'|'approved'|'rejected'|'failed'|'imported';
  title:string;
  message:string;
  timestamp:string;
  href:'#request-management'|'#requests';
  requestId:string;
  read:boolean;
}

export interface NotificationMountOptions{
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  canPoll:()=>boolean;
  onPageBadge:(badge:{href:'#request-management'|'#requests';count:number})=>void;
}
