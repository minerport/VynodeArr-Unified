export interface MediaExpansionOptions{initialSection:'music'|'subtitles';initialView:string;administrator:boolean;request:<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;notify:(message:string,type?:string)=>void;}
export interface ProviderSummary{id:string;name:string;implementation:string;enabled:boolean;priority:number;configured:boolean;capabilities:string[];}
