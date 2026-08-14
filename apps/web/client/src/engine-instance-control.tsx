import {useEffect,useMemo,useState} from 'react';

export type EngineInstanceDomain='movie'|'tv';
export type EngineInstance={id:string;name:string;domain:EngineInstanceDomain;enabled?:boolean;isDefault?:boolean};
type Request=<T>(path:string,init?:RequestInit)=>Promise<T>;

export function useEngineInstances(request:Request){
  const [instances,setInstances]=useState<EngineInstance[]>([]);
  useEffect(()=>{let active=true;void request<{instances:EngineInstance[]}>('/api/settings/engines').then(value=>{if(active)setInstances((value.instances||[]).filter(item=>item.enabled!==false));}).catch(()=>{if(active)setInstances([]);});return()=>{active=false;};},[request]);
  return instances;
}

export function useEngineInstance(request:Request,domain:EngineInstanceDomain,{allowAll=false}:{allowAll?:boolean}={}){
  const allInstances=useEngineInstances(request),instances=useMemo(()=>allInstances.filter(item=>item.domain===domain),[allInstances,domain]);
  const [instanceId,setInstanceId]=useState('');
  useEffect(()=>{setInstanceId(current=>allowAll&&current==='all'?'all':instances.some(item=>item.id===current)?current:(allowAll&&instances.length>1?'all':(instances.find(item=>item.isDefault)||instances[0])?.id||''));},[instances,allowAll]);
  const route=(path:string,ownedInstanceId?:string)=>{const id=ownedInstanceId||(instanceId==='all'?'':instanceId);return id?`${path}${path.includes('?')?'&':'?'}engineInstanceId=${encodeURIComponent(id)}`:path;};
  return{instances,instanceId,setInstanceId,route,isAll:instanceId==='all',ready:!instances.length||Boolean(instanceId)};
}

export function EngineInstanceFilter({instances,value,onChange}:{instances:EngineInstance[];value:string;onChange:(value:string)=>void}){
  if(instances.length<2)return null;
  return <label>Engine instance<select value={value} onChange={event=>onChange(event.target.value)}><option value="all">All engines</option>{instances.map(item=><option key={item.id} value={item.id}>{item.name} · {item.domain==='movie'?'Movies':'Television'}{item.isDefault?' — default':''}</option>)}</select><small>Show every connected engine or one individual instance.</small></label>;
}

export function EngineInstanceSelect({instances,value,onChange}:{instances:EngineInstance[];value:string;onChange:(value:string)=>void}){
  if(!instances.length)return null;
  return <label>Engine instance<select value={value} onChange={event=>onChange(event.target.value)}>{instances.map(item=><option key={item.id} value={item.id}>{item.name}{item.isDefault?' — default':''}</option>)}</select><small>Changes on this page apply only to this instance.</small></label>;
}

export async function loadForEngineInstances<T>(request:Request,instances:EngineInstance[],path:string){
  const groups=await Promise.all(instances.map(async instance=>{
    const separator=path.includes('?')?'&':'?';
    const response=await request<{result:T[]}>(`${path}${separator}engineInstanceId=${encodeURIComponent(instance.id)}`);
    return(response.result||[]).map(item=>({...item,engineInstanceId:instance.id,engineInstanceName:instance.name}));
  }));
  return groups.flat() as (T&{engineInstanceId:string;engineInstanceName:string})[];
}
