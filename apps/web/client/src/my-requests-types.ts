export type RequestStatus='requested'|'searching'|'downloading'|'imported'|'failed'|'rejected';
export interface UserRequest {
  id:string;domain:'movie'|'tv';engineId:number;tmdbId:number;tvdbId?:number|null;
  title:string;year?:number|null;requestedAt:string;updatedAt:string;
  status:RequestStatus;statusLabel:string;message:string;canCorrect:boolean;canCancel:boolean;
}
export interface MyRequestsMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
