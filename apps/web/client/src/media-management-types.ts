export type MediaManagementDomain='movie'|'tv';
export type MediaSettings=Record<string,unknown>;
export interface MediaSettingField{path:string;key:string;value:unknown}
export interface MediaManagementMountOptions{
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
