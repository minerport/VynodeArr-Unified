export type ProviderDomain='movie'|'tv';
export type ProviderKind='indexers'|'downloadClients'|'importLists';
export interface SelectOption{name:string;value:string|number;hint?:string}
export interface ProviderField{name:string;label?:string;helpText?:string;type?:string;value?:unknown;privacy?:string;advanced?:boolean;hidden?:boolean;isFloat?:boolean;selectOptions?:SelectOption[]}
export interface ProviderRecord{[key:string]:unknown;id?:number|string;name?:string;implementationName?:string;implementation?:string;protocol?:string;priority?:number;enable?:boolean;enableRss?:boolean;enableAutomaticSearch?:boolean;enableInteractiveSearch?:boolean;removeCompletedDownloads?:boolean;removeFailedDownloads?:boolean;fields?:ProviderField[]}
export interface ProviderSettingsMountOptions{
  kind:ProviderKind;
  initialDomain?:ProviderDomain;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
