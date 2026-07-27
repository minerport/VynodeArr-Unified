export type LibraryKind='movies'|'tv';
export type LibraryView='poster'|'cards'|'compact'|'list';

export interface LibraryArtwork { url?:string }
export interface LibraryQueue { progress?:number }

export interface LibraryItem {
  id:string;
  title:string;
  year?:number;
  overview?:string;
  artwork?:LibraryArtwork;
  monitoring?:string;
  state?:string;
  status?:string;
  hasFile?:boolean;
  missingEpisodes?:number;
  cutoffUnmetEpisodes?:number;
  episodeProgress?:string;
  seasonProgress?:string;
  quality?:string;
  qualityProfile?:string;
  collection?:string;
  network?:string;
  genres?:string[];
  rating?:number;
  queue?:LibraryQueue;
}

export interface LibraryMountOptions {
  kind:LibraryKind;
  items:LibraryItem[];
  initialView:LibraryView;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
  onViewChange:(view:LibraryView)=>void;
  onItemChange?:(item:LibraryItem)=>void;
  onLoaded?:(items:LibraryItem[],mode?:string)=>void;
}
