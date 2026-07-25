export type SelectionDomain='movie'|'tv';
export type SelectionSection='custom-formats'|'release-profiles';
export type ApiRecord=Record<string,unknown>&{id?:number;name?:string};
export interface QualityProfile extends ApiRecord {
  minFormatScore?:number;
  formatItems?:Array<{format:number;name?:string;score:number}>;
}
export interface CustomFormat extends ApiRecord {
  includeCustomFormatWhenRenaming?:boolean;
  specifications?:ApiRecord[];
}
export interface ReleaseProfile extends ApiRecord {
  enabled?:boolean;
  required?:string[]|string;
  ignored?:string[]|string;
  tags?:number[];
  excludedTags?:number[];
  indexerId?:number;
}
export interface SelectionRulesMountOptions {
  section:SelectionSection;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
