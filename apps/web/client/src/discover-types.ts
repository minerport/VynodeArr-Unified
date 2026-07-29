export type DiscoverDomain='movie'|'tv';

export interface DiscoverItem{
  id:string;tmdbId:number;domain:DiscoverDomain;title:string;year:number|null;
  tvdbId?:number|null;imdbId?:string|null;
  overview:string;rating:number;poster:string|null;backdrop:string|null;
  genreIds:number[];genres?:string[];genre?:string;studio?:string|null;
  network?:string|null;runtime?:number|null;status?:string|null;
  certification?:string|null;
}
export interface DiscoverPage{page:number;totalPages:number;totalResults:number;results:DiscoverItem[]}
export interface DiscoverCategory{id:number;name:string;domain:DiscoverDomain;backdrop:string|null}
export interface LibraryItem{
  id:string|number;title:string;year?:number;hasFile?:boolean;sizeOnDisk?:number;
  episodeProgress?:string;artwork?:{url?:string};backdrop?:{url?:string};
}
export type DiscoverLibraryStatus='pending'|'available';
export interface DiscoverMountOptions{
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:'success'|'error')=>void;
  administrator:boolean;
}
