import {useCallback,useEffect,useMemo,useState} from 'react';
import type {MyRequestsMountOptions,UserRequest} from './my-requests-types';

const message=(reason:unknown)=>reason instanceof Error?reason.message:'The request could not be updated.';

export function RequestManagementView({options}:{options:MyRequestsMountOptions}){
  const [items,setItems]=useState<UserRequest[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[userId,setUserId]=useState(''),[pendingOnly,setPendingOnly]=useState(false),[busy,setBusy]=useState('');
  const load=useCallback(async(quiet=false)=>{if(!quiet)setLoading(true);try{const value=await options.request<{items:UserRequest[]}>('/api/requests');setItems(value.items||[]);setError('');}catch(reason){setError(message(reason));}finally{setLoading(false);}},[options]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(true),10000);return()=>window.clearInterval(timer);},[load]);
  const users=useMemo(()=>[...new Map(items.filter(item=>item.user).map(item=>[item.userId,item.user!])).values()].sort((a,b)=>a.name.localeCompare(b.name)),[items]);
  const visible=items.filter(item=>(!userId||item.userId===userId)&&(!pendingOnly||item.status==='pending_approval'));
  const decide=async(record:UserRequest,action:'approve'|'reject')=>{
    let body='{}';
    if(action==='approve'&&!window.confirm(`Approve ${record.title} for ${record.user?.name||'this user'} and add it to the media engine?`))return;
    if(action==='reject'){const reason=window.prompt(`Why is ${record.title} being declined?`,'This request was not approved.');if(reason==null)return;body=JSON.stringify({reason});}
    setBusy(record.id);
    try{await options.request(`/api/requests/${record.id}/${action}`,{method:'POST',body});options.notify(action==='approve'?'Request approved and added.':'Request declined.');await load(true);}catch(reason){options.notify(message(reason),'error');}finally{setBusy('');}
  };
  return <div className="react-request-management">
    <div className="hero"><div><span className="eyebrow">DISCOVER ADMINISTRATION</span><h1>User Requests</h1><p className="lede">Review request history by user and decide which approval-required titles are added.</p></div><button className="secondary" onClick={()=>void load()}>Refresh</button></div>
    <div className="management-toolbar request-management-toolbar"><label>User<select value={userId} onChange={event=>setUserId(event.target.value)}><option value="">All users</option>{users.map(user=><option value={user.id} key={user.id}>{user.name} ({user.username})</option>)}</select></label><label className="check"><input type="checkbox" checked={pendingOnly} onChange={event=>setPendingOnly(event.target.checked)}/> Awaiting approval only</label><span className="badge warm">{items.filter(item=>item.status==='pending_approval').length} awaiting approval</span></div>
    {loading?<div className="panel skeleton">Loading user requests…</div>:error?<div className="panel error-state"><h2>Requests unavailable</h2><p>{error}</p></div>:!visible.length?<div className="panel empty"><h2>No matching requests</h2><p>Change the filters or wait for a user to submit a request.</p></div>:<div className="admin-request-list">{visible.map(record=><article className="admin-request-card panel" key={record.id}>
      <div className="admin-request-poster">{record.poster?<img src={record.poster} alt="" loading="lazy"/>:<span>{record.domain==='movie'?'MOVIE':'TV'}</span>}</div>
      <div className="admin-request-copy"><div className="request-title"><div><span className="eyebrow">{record.user?.name||'Deleted user'} · @{record.user?.username||'deleted'}</span><h2>{record.title} {record.year?<small>({record.year})</small>:null}</h2><p>{record.genres?.join(', ')||'Genre unavailable'} · Requested {new Date(record.requestedAt).toLocaleString()}</p></div><span className={`request-state ${record.status}`}>{record.statusLabel}</span></div><p className="admin-request-overview">{record.overview||'No overview is available for this title.'}</p><div className="request-facts">{record.rating?<span>★ {record.rating.toFixed(1)}</span>:null}{record.runtime?<span>{record.runtime} min</span>:null}{record.certification?<span>{record.certification}</span>:null}<span>TMDB {record.tmdbId}</span>{record.tvdbId?<span>TVDB {record.tvdbId}</span>:null}<span>{record.domain==='movie'?'Movie':'Television'}</span></div><p className="request-explanation">{record.message}</p></div>
      <div className="request-actions">{record.canApprove?<button className="primary" disabled={busy===record.id} onClick={()=>void decide(record,'approve')}>{busy===record.id?'Adding…':'Approve & add'}</button>:null}{record.canReject?<button className="danger" disabled={busy===record.id} onClick={()=>void decide(record,'reject')}>Decline</button>:null}</div>
    </article>)}</div>}
  </div>;
}
