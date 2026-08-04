export type OperationDomain='movie'|'tv'|null;
export interface OperationTimelineItem{id:string;source:string;category:string;domain:OperationDomain;title:string;summary:string;status:string;timestamp:string;href:string;actor:string}
export interface OperationActionItem{id:string;severity:'critical'|'warning'|'information';domain:OperationDomain;title:string;what:string;why:string;affected:string;recommended:string;href:string;timestamp:string;source:string;dismissedAt?:string|null}
export interface OperationsMountOptions{request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;notify:(message:string,tone?:string)=>void}
