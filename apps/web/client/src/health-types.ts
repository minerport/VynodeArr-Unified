export type HealthDomain='movie'|'tv';

export interface HealthItem {
  id:string;
  domain:HealthDomain;
  severity?:string|null;
  message:string;
  source?:string|null;
}

export interface HealthMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
}
