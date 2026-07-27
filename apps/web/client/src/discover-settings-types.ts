export interface DiscoverSettingsStatus {
  configured:boolean;
  provider:'TMDB'|string;
}

export interface DiscoverSettingsMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,type?:string)=>void;
  onDirtyChange:(dirty:boolean)=>void;
}
