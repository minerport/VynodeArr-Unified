import {useCallback,useEffect,useState} from 'react';

type Request=<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
interface Attribution{id:string;name:string;username:string;source:'request'|'saved';requestedAt:string|null;}

export function MediaCollectionControl({domain,mediaId,title,request,notify}:{domain:'movie'|'tv';mediaId:string|number;title:string;request:Request;notify:(message:string,tone?:string)=>void}){
  const [state,setState]=useState<{included:boolean;canRemove:boolean}>({included:false,canRemove:false}),[users,setUsers]=useState<Attribution[]>([]),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const [membership,attribution]=await Promise.all([request<{included:boolean;canRemove:boolean}>(`/api/user-collections/contains?domain=${domain}&mediaId=${encodeURIComponent(mediaId)}`),request<{users:Attribution[]}>(`/api/user-collections/attribution?domain=${domain}&mediaId=${encodeURIComponent(mediaId)}`)]);setState(membership);setUsers(attribution.users||[]);},[domain,mediaId,request]);
  useEffect(()=>{void load().catch(()=>{});},[load]);
  const change=async()=>{if(busy||state.included&&!state.canRemove)return;setBusy(true);try{if(state.canRemove){await request(`/api/user-collections/items/${domain}/${encodeURIComponent(mediaId)}`,{method:'DELETE'});notify(`${title} was removed from your collection.`);}else{await request('/api/user-collections/items',{method:'POST',body:JSON.stringify({domain,mediaId})});notify(`${title} was added to your collection.`);}await load();}catch(error){notify(error instanceof Error?error.message:'Your collection could not be updated.','error');}finally{setBusy(false);}};
  return <div className="media-collection-control"><button type="button" className="secondary" disabled={busy||state.included&&!state.canRemove} onClick={()=>void change()}>{busy?'Updating…':state.canRemove?'Remove from my collection':state.included?'In my collection':'Add to my collection'}</button>{users.length?<p><strong>Requested by</strong> {users.map(user=>user.name).join(', ')}</p>:<p className="muted">No requester attribution is recorded.</p>}</div>;
}
