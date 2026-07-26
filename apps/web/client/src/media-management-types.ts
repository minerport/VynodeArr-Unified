export type MediaManagementDomain='movie'|'tv';
export type NamingAuditFile={id?:number;existingPath:string;newPath:string};
export type NamingAuditResult={domain:MediaManagementDomain;mediaId:number;title:string;currentPath:string;destinationPath:string;folderChange:boolean;files:NamingAuditFile[]};
export type NamingAuditJob={id:string;domain:MediaManagementDomain;status:'running'|'completed'|'failed';total:number;completed:number;matching:number;mismatched:number;failed:number;currentTitle:string;results:NamingAuditResult[];errors:Array<{title:string;message:string}>};
export type MediaSettings=Record<string,unknown>;
export interface MediaSettingField{path:string;key:string;value:unknown}
export interface MediaManagementMountOptions{
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
