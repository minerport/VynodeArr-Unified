export type EngineDomain='movie'|'tv';

export interface EngineConfiguration {
  configured:boolean;
  host:string;
  port:number;
  https:boolean;
  tlsVerify:boolean;
  urlBase:string;
  credentialConfigured?:boolean;
}

export interface EngineConnection {
  reachable:boolean;
  authenticated:boolean;
  compatible:boolean;
  latencyMs?:number;
  safeError?:string;
}

export interface EngineStatus {
  version?:string;
  branch?:string;
}

export interface EngineSync {
  lastSuccessAt?:string|null;
}

export interface EngineSummary {
  domain:EngineDomain;
  displayName:string;
  configuration:EngineConfiguration;
  connection:EngineConnection;
  status?:EngineStatus|null;
  synchronization?:EngineSync|null;
}

export interface EngineSystem {
  managed:boolean;
  configured:boolean;
  engines:EngineSummary[];
}

export interface EngineSettings {
  configured:boolean;
  movie:EngineConfiguration;
  tv:EngineConfiguration;
}

export interface EngineValidation {
  validated:boolean;
  connection:EngineConnection;
  counts?:Record<string,number>|null;
}

export interface EngineManagementMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,type?:string)=>void;
  onDirtyChange:(dirty:boolean)=>void;
  onConfigured:()=>void;
}
