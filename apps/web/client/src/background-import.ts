import type {ImportJob} from './import-monitor-types';

export type ImportDomain='movie'|'tv';
export interface BackgroundImportItem{title:string;payload:Record<string,unknown>}
interface QueueBackgroundImportOptions{
  domain:ImportDomain;
  items:BackgroundImportItem[];
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:string)=>void;
}
export async function queueBackgroundImport(options:QueueBackgroundImportOptions):Promise<ImportJob>{
  const {job}=await options.request<{job:ImportJob}>('/api/import-jobs',{method:'POST',body:JSON.stringify({domain:options.domain,items:options.items})});
  const label=options.domain==='movie'?'movie':'television';
  options.notify(`${options.items.length} ${label} title${options.items.length===1?'':'s'} queued for background import.`);
  return job;
}
