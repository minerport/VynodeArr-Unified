export type ImportJobStatus='queued'|'running'|'canceling'|'canceled'|'completed'|'failed';

export interface ImportJobIssue{title:string;message:string}
export interface ImportJob{
  id:string;
  domain:'movie'|'tv';
  label:string;
  status:ImportJobStatus;
  total:number;
  completed:number;
  failed:number;
  skipped?:number;
  currentTitle?:string;
  errors?:ImportJobIssue[];
}

export interface ImportMonitorOptions{
  request:<T>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,tone?:'success'|'error')=>void;
  onMilestone?:(job:ImportJob)=>void;
}
