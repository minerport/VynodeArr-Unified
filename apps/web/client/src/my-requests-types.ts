export type RequestStatus='pending_approval'|'requested'|'searching'|'downloading'|'imported'|'failed'|'rejected'|'canceled';
export interface UserRequest {
  id:string;userId:string;domain:'movie'|'tv';engineId:number|null;tmdbId:number;tvdbId?:number|null;
  title:string;year?:number|null;requestedAt:string;updatedAt:string;
  poster?:string|null;backdrop?:string|null;overview?:string;rating?:number;genres?:string[];
  runtime?:number|null;certification?:string|null;
  status:RequestStatus;statusLabel:string;message:string;rejectionReason?:string|null;canCorrect:boolean;canCancel:boolean;
  canApprove?:boolean;canReject?:boolean;
  user?:{id:string;name:string;username:string};
}
export interface MyRequestsMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
export interface RequestAllowance {
  enabled:boolean;period:'daily'|'weekly'|'monthly';startAt?:string;
  movie:{limit:number|null;used:number;remaining:number|null};
  tv:{limit:number|null;used:number;remaining:number|null};
  pending:{limit:number|null;used:number;remaining:number|null};
}
