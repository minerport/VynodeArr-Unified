export type SelectionDomain='movie'|'tv';
export type SelectionSection='custom-formats'|'release-profiles';
export type ApiRecord=Record<string,unknown>&{id?:number;name?:string};

export interface NativeField extends ApiRecord {
  label?:string;
  helpText?:string;
  value?:unknown;
  type?:string;
  advanced?:boolean;
  selectOptions?:Array<{value:unknown;name?:string;label?:string}>;
}
export interface CustomFormatSpecification extends ApiRecord {
  implementation?:string;
  implementationName?:string;
  negate?:boolean;
  required?:boolean;
  fields?:NativeField[];
}
export interface QualityProfile extends ApiRecord {
  minFormatScore?:number;
  cutoffFormatScore?:number;
  minUpgradeFormatScore?:number;
  formatItems?:Array<{format:number;name?:string;score:number}>;
}
export interface CustomFormat extends ApiRecord {
  includeCustomFormatWhenRenaming?:boolean;
  specifications?:CustomFormatSpecification[];
}
export interface ReleaseProfile extends ApiRecord {
  enabled?:boolean;
  required?:string[]|string;
  ignored?:string[]|string;
  preferred?:Array<{key:string;value:number}>;
  includePreferredWhenRenaming?:boolean;
  tags?:number[];
  excludedTags?:number[];
  indexerId?:number;
  airDateRestriction?:string;
  airDateGracePeriod?:number;
  allowSeasonPackWithoutAllEpisodesAired?:boolean;
}
export interface SelectionRulesMountOptions {
  section:SelectionSection;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
