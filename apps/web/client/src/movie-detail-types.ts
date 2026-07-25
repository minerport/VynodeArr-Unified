export interface MovieDetail {
  id:string;title:string;year?:number;overview?:string;monitoring?:string;runtimeMinutes?:number;availability?:string;
  quality?:string;qualityProfile?:string;collection?:string;genres?:string[];studio?:string;certification?:string;
  originalLanguage?:string;rating?:number;rootFolder?:string;hasFile?:boolean;
  location?:string;fileLocation?:string;
  artwork?:{url?:string};backdrop?:{url?:string};releaseDates?:{digital?:string};
}
export interface MovieDetailMountOptions {
  publicId:string;request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
