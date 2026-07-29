import type {ImportJob} from './import-monitor-types';

interface ImportMonitorControllerOptions{
  request:<T>(path:string,options?:RequestInit)=>Promise<T>;
  canPoll:()=>boolean;
  render:(jobs:ImportJob[])=>void;
  onMilestone:(job:ImportJob)=>void|Promise<void>;
  intervalMs?:number;
}

export interface ImportMonitorController{
  poll:()=>Promise<void>;
  start:()=>void;
  stop:()=>void;
  isRunning:()=>boolean;
}

export function createImportMonitorController(options:ImportMonitorControllerOptions):ImportMonitorController{
  const milestones=new Map<string,number>();
  let timer:number|undefined;
  const poll=async()=>{
    if(!options.canPoll())return;
    try{
      const {items=[]}=await options.request<{items:ImportJob[]}>('/api/import-jobs');
      options.render(items);
      for(const job of items){
        const milestone=Math.floor(Number(job.completed||0)/50),previous=milestones.get(job.id)||0;
        if(milestone<=previous)continue;
        milestones.set(job.id,milestone);
        await options.onMilestone(job);
      }
    }catch{
      // Stay quiet while the app or bundled engines reconnect.
    }
  };
  return {
    poll,
    start(){
      if(timer!==undefined)return;
      void poll();
      timer=window.setInterval(()=>void poll(),options.intervalMs??2000);
    },
    stop(){
      if(timer===undefined)return;
      window.clearInterval(timer);
      timer=undefined;
    },
    isRunning:()=>timer!==undefined
  };
}
