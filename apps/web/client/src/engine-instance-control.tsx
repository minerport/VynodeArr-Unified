import {useEffect,useMemo,useState} from 'react';

export type EngineInstanceDomain='movie'|'tv';
export type EngineInstance={id:string;name:string;domain:EngineInstanceDomain;enabled?:boolean;isDefault?:boolean};
type Request=<T>(path:string,init?:RequestInit)=>Promise<T>;

export function useEngineInstances(request:Request){
  const [instances,setInstances]=useState<EngineInstance[]>([]);
  useEffect(()=>{let active=true;void request<{instances:EngineInstance[]}>('/api/settings/engines').then(value=>{if(active)setInstances((value.instances||[]).filter(item=>item.enabled!==false));}).catch(()=>{if(active)setInstances([]);});return()=>{active=false;};},[request]);
  return instances;
}

export function useEngineInstance(request:Request,domain:EngineInstanceDomain){
  const allInstances=useEngineInstances(request),instances=useMemo(()=>allInstances.filter(item=>item.domain===domain),[allInstances,domain]);
  const [instanceId,setInstanceId]=useState('');
  useEffect(()=>{setInstanceId(current=>instances.some(item=>item.id===current)?current:(instances.find(item=>item.isDefault)||instances[0])?.id||'');},[instances]);
  const query=useMemo(()=>instanceId?`engineInstanceId=${encodeURIComponent(instanceId)}`:'',[instanceId]);
  const route=(path:string)=>query?`${path}${path.includes('?')?'&':'?'}${query}`:path;
  return{instances,instanceId,setInstanceId,route,ready:!instances.length||Boolean(instanceId)};
}

export function EngineInstanceFilter({instances,value,onChange}:{instances:EngineInstance[];value:string;onChange:(value:string)=>void}){
  if(instances.length<2)return null;
  return <label>Engine instance<select value={value} onChange={event=>onChange(event.target.value)}><option value="all">All engines</option>{instances.map(item=><option key={item.id} value={item.id}>{item.name} · {item.domain==='movie'?'Movies':'Television'}{item.isDefault?' — default':''}</option>)}</select><small>Show every connected engine or one individual instance.</small></label>;
}

export function EngineInstanceSelect({instances,value,onChange}:{instances:EngineInstance[];value:string;onChange:(value:string)=>void}){
  if(!instances.length)return null;
  return <label>Engine instance<select value={value} onChange={event=>onChange(event.target.value)}>{instances.map(item=><option key={item.id} value={item.id}>{item.name}{item.isDefault?' — default':''}</option>)}</select><small>Changes on this page apply only to this instance.</small></label>;
}
