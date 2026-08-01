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
export interface UserCollectionMember extends LibraryItem {domain:'movie'|'tv';collectionKey:string;requestedAt?:string|null;collectionSource:'request'|'saved';requestStatus:string;}
export interface UserCollectionSharing {visibility:'private'|'household'|'specific';sharedWith:string[];}
export interface UserCollectionStatistics {movies:number;television:number;available:number;missing:number;sizeOnDisk:number;requested:number;saved:number;}
export interface UserMediaCollection {user:{id:string;name:string;username:string};movies:UserCollectionMember[];television:UserCollectionMember[];count:number;sharing:UserCollectionSharing;statistics:UserCollectionStatistics;}
export interface UserCollectionTimelineEvent {id:string;type:'request'|'approval'|'cancel'|'search'|'decision'|'history';domain:'movie'|'tv';mediaId:string|number|null;title:string;status:string;timestamp:string;detail:string;}

export interface CollectionsMountOptions {
  administrator:boolean;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
