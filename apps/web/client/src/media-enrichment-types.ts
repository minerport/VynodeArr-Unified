export interface MediaEnrichment {
  tmdbId:number;tagline?:string|null;originalTitle?:string|null;originalLanguage?:string|null;
  countries?:string[];productionCompanies?:string[];budget?:number|null;revenue?:number|null;
  cast?:Array<{id:number;name:string;character?:string|null;photo?:string|null}>;
  trailer?:{name:string;url:string}|null;externalLinks?:Array<{label:string;url:string}>;
  seasons?:Array<{seasonNumber:number;name:string;episodeCount:number;airDate?:string|null;poster?:string|null}>;
}
