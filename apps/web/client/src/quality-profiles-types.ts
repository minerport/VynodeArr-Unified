export type EngineDomain='movie'|'tv';
export interface QualityItem{id?:number;name?:string;allowed:boolean;quality?:{id:number;name:string;resolution?:number};items?:QualityItem[]}
export interface FormatItem{format:number;score:number}
export interface QualityProfile{id?:number;name:string;upgradeAllowed:boolean;cutoff:number;items:QualityItem[];formatItems?:FormatItem[];minFormatScore?:number;cutoffFormatScore?:number;minUpgradeFormatScore?:number}
export interface CustomFormat{id:number;name:string}
export interface QualityDefinition{id:number;title?:string;name?:string;quality?:{name:string};minSize:number|null;preferredSize:number|null;maxSize:number|null}
export interface QualityProfilesMountOptions{request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;notify:(message:string,tone?:string)=>void;onDirtyChange:(dirty:boolean)=>void}
