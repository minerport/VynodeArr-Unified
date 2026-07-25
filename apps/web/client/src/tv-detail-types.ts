export interface TvEpisode {id:string;title:string;episodeNumber:number;airDateUtc?:string;monitored:boolean;hasFile:boolean;quality?:string}
export interface TvSeason {seasonNumber:number;monitored:boolean;episodeCount:number;episodeFileCount:number;percentComplete?:number;episodes:TvEpisode[]}
export interface TvDetail {
  id:string;title:string;year?:number;overview?:string;network?:string;status?:string;monitoring?:string;episodeProgress?:string;
  missingEpisodes?:number;qualityProfile?:string;rootFolder?:string;seriesType?:string;genres?:string[];
  nextEpisode?:{title?:string;airDateUtc?:string}|null;artwork?:{url?:string};backdrop?:{url?:string};seasons:TvSeason[];
}
export interface TvDetailMountOptions {
  publicId:string;request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
