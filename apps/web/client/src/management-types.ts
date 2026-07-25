export type ManagementDomain='movie'|'tv';
export interface ManagementRecord{[key:string]:unknown;id?:number|string;name?:string;title?:string;label?:string;fields?:ManagementField[]}
export interface ManagementField{[key:string]:unknown;name:string;label?:string;helpText?:string;type?:string;value?:unknown;hidden?:boolean;advanced?:boolean;privacy?:string}
export interface ManagementResource{key:string;methods?:string[]}
export interface AuditEntry{method:string;domain:string;resource:string;username:string;timestamp:string}
export interface ManagementMountOptions{
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
