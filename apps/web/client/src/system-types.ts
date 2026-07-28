export type SystemDomain='movie'|'tv';
export type SystemView='status'|'tasks'|'backups'|'updates'|'security'|'events';

export interface DiskSpace {path:string;freeSpace:number;totalSpace:number}
export interface SystemRecord {
  id?:string|number;
  domain:SystemDomain;
  name?:string;
  taskName?:string;
  interval?:number;
  lastExecution?:string;
  nextExecution?:string;
  time?:string;
  type?:string;
  size?:number;
  level?:string;
  message?:string;
  exception?:string;
}
export interface ApplicationUpdate {installedVersion:string;channel:string;mechanism:string;repository:string;message:string}
export interface MasterKeyStatus {managed:boolean;source:string;canRotate:boolean;storage:string}
export interface SystemMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,type?:string)=>void;
}
