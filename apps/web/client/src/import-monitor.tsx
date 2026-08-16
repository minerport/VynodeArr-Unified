import {useCallback,useEffect,useRef,useState} from 'react';
import type {ImportJob,ImportMonitorOptions} from './import-monitor-types';
import {useVisibleRefresh} from './use-visible-refresh';
import {errorMessage} from './shell-utils';

const storageKey='vynodearr.dismissedImportJobs';
const finished=(status:ImportJob['status'])=>status==='completed'||status==='failed'||status==='canceled';
const readDismissed=()=>{
  try{
    const value=JSON.parse(localStorage.getItem(storageKey)||'[]');
    return new Set<string>(Array.isArray(value)?value.map(String):[]);
  }catch{return new Set<string>();}
};

export function ImportMonitor({options}:{options:ImportMonitorOptions}){
  const [jobs,setJobs]=useState<ImportJob[]>([]),[collapsed,setCollapsed]=useState(false),[dismissed,setDismissed]=useState(readDismissed);
  const milestones=useRef(new Map<string,number>());
  const load=useCallback(async()=>{
    try{
      const value=await options.request<{items:ImportJob[]}>('/api/import-jobs');
      const items=value.items||[];
      setJobs(items);
      for(const job of items){
        const milestone=Math.floor(Number(job.completed||0)/50),previous=milestones.current.get(job.id)||0;
        if(milestone>previous){milestones.current.set(job.id,milestone);options.onMilestone?.(job);}
      }
    }catch{/* The global monitor stays quiet while the app reconnects. */}
  },[options]);
  useVisibleRefresh(load,2000);
  const dismiss=(id:string)=>setDismissed(current=>{const next=new Set(current);next.add(id);localStorage.setItem(storageKey,JSON.stringify([...next].slice(-200)));return next;});
  const cancel=async(id:string)=>{
    try{await options.request(`/api/import-jobs/${id}`,{method:'DELETE'});await load();}
    catch(reason){options.notify(errorMessage(reason,'The import could not be canceled.'),'error');}
  };
  const visible=jobs.filter(job=>!dismissed.has(job.id));
  useEffect(()=>{const host=document.querySelector<HTMLElement>('#import-progress');if(host)host.hidden=!visible.length;},[visible.length]);
  if(!visible.length)return null;
  const active=visible.filter(job=>['queued','running','canceling'].includes(job.status)).length;
  return <section className={`import-progress-react${collapsed?' collapsed':''}`}>
    <header className="import-progress-heading"><strong>Library imports</strong><span>{active} active</span><button className="text-button" onClick={()=>setCollapsed(value=>!value)}>{collapsed?'Show':'Minimize'}</button></header>
    {!collapsed?<div className="import-job-list">{visible.map(job=>{
      const skipped=Number(job.skipped||0),done=job.completed+job.failed+skipped,percent=Math.round(done/Math.max(1,job.total)*100);
      return <article className={`import-job${finished(job.status)?' finished':''}`} key={job.id}>
        <div><strong>{job.label} · {done}/{job.total}</strong>{finished(job.status)?<button className="text-button" onClick={()=>dismiss(job.id)}>Dismiss</button>:<button className="text-button" disabled={job.status==='canceling'} onClick={()=>void cancel(job.id)}>{job.status==='canceling'?'Canceling…':'Cancel'}</button>}</div>
        <div className="import-job-meter"><span style={{width:`${percent}%`}}/></div>
        <small>{job.currentTitle||job.status}{skipped?` · ${skipped} already present/skipped`:''}{job.failed?` · ${job.failed} failed`:''}</small>
        {job.errors?.length?<details open><summary>{job.errors.length} issue{job.errors.length===1?'':'s'} need attention</summary>{job.errors.map((issue,index)=><p key={`${issue.title}-${index}`}><strong>{issue.title}</strong><span>{issue.message}</span></p>)}</details>:null}
      </article>;
    })}</div>:null}
  </section>;
}
