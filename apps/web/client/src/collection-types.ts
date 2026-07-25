import type { LibraryItem } from './library-types';

export type CollectionKind='smart'|'custom';

export interface CollectionRules {
  titleContains:string;
  genres:string[];
  year:number|'';
  decade:number|'';
  collection:string;
  monitoring:string;
  availability:string;
}
export interface MediaCollection {
  id:string;
  name:string;
  type:CollectionKind;
  rules?:Partial<CollectionRules>;
  titleContains?:string;
  movieIds:string[];
  includedMovieIds?:string[];
  excludedMovieIds?:string[];
  members:LibraryItem[];
  count:number;
}

export interface CollectionsMountOptions {
  administrator:boolean;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
