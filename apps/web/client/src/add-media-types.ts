export type AddMediaDomain='movie'|'tv';

export interface AddMediaProfile { id:number;name:string }
export interface AddMediaRoot { path:string }
export interface AddMediaImage { coverType?:string;remoteUrl?:string }
export interface AddMediaResult {
  title:string;
  year?:number;
  overview?:string;
  remotePoster?:string;
  images?:AddMediaImage[];
  [key:string]:unknown;
}
export interface AddMediaMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
  onAdded:(domain:AddMediaDomain)=>void;
}
