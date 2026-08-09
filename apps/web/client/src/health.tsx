import { useCallback,useEffect,useState } from 'react';
import type { EnginePathVerification,HealthDomain,HealthItem,HealthMountOptions } from './health-types';

const fix=(item:HealthItem):[string,string]=>{
  const text=`${item.source||''} ${item.message||''}`.toLowerCase();
  if(/root folder|rootfolder|path does not exist|missing root/.test(text))return['Review root folders','#service/root-folders'];
  if(/download client|sabnzbd|nzbget|qbittorrent|transmission|deluge/.test(text))return['Review download clients','#service/download-clients'];
  if(/indexer|rss sync/.test(text))return['Review indexers','#service/indexers'];
  if(/import list|importlist|lists unavailable/.test(text))return['Review import lists','#service/import-lists'];
  if(/quality profile|qualityprofile|custom format/.test(text))return['Review quality profiles','#service/profiles'];
  if(/disk|space|storage/.test(text))return['Review storage','#system'];
  return['Review advanced settings','#management'];
};

const warningPath=(item:HealthItem)=>`${item.source||''} ${item.message||''}`.match(/(?:[A-Za-z]:[\\/]|\/)[^:(),\r\n]+/)?.[0]?.trim()||'';
type DomainHealthProps={domain:HealthDomain;items:HealthItem[];busy:string;verifications:Record<string,EnginePathVerification>;onDismiss:(item:HealthItem)=>void;onRematch:(item:HealthItem)=>void;onVerify:(item:HealthItem)=>void;onRemap:(item:HealthItem,target:string)=>void};

function DomainHealth({domain,items,busy,verifications,onDismiss,onRematch,onVerify,onRemap}:DomainHealthProps){
  const label=domain==='movie'?'Movies':'Television',eyebrow=domain==='movie'?'MOVIE ENGINE':'TELEVISION ENGINE';
  return <section className="system-domain-section health-domain-section">
    <div className="panel-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{label}</h2><p className="muted">{items.length?`${items.length} issue${items.length===1?'':'s'} need attention`:'No reported issues'}</p></div><span className={`badge ${items.length?'warm':'green'}`}>{items.length?'Needs attention':'Healthy'}</span></div>
    <div className="health-issue-list">{items.length?items.map(item=>{
      const [actionLabel,href]=fix(item),severity=String(item.severity||'notice').toLowerCase().replace(/[^a-z0-9_-]/g,''),recovery=item.recovery,path=warningPath(item),verification=verifications[item.id];
      const explanation=recovery
        ?recovery.libraryItem
          ?recovery.replacement
            ?`${recovery.libraryItem.title} is in your library. A replacement match was found: ${recovery.replacement.title}${recovery.replacement.year?` (${recovery.replacement.year})`:''}.`
            :`${recovery.libraryItem.title} is in your library, but no different valid TMDB match was found.`
          :'This removed TMDB entry is not present in your VynodeArr movie library.'
        :'';
      return <article className={`health-issue health-${severity}`} key={`${domain}:${item.id}`}>
        <div><strong>{item.message}</strong>{item.source?<small>{item.source}</small>:null}{explanation?<p className="muted">{explanation}</p>:null}{verification?<p className="muted"><strong>Engine verification:</strong> {verification.path} is {verification.rootRegistered?'still registered':'not registered'} · {verification.titleCount} title{verification.titleCount===1?'':'s'} · {verification.collectionCount} collection{verification.collectionCount===1?'':'s'}{verification.collectionExamples.length?` (${verification.collectionExamples.join(', ')})`:''}</p>:null}</div>
        <div className="health-issue-actions">
          {recovery?.libraryItem&&recovery.replacement?<button className="primary" disabled={busy===item.id} onClick={()=>onRematch(item)}>{busy===item.id?'Updating…':'Update match'}</button>:null}
          {path?<button className="secondary" disabled={busy===item.id} onClick={()=>onVerify(item)}>{busy===item.id?'Verifying...':'Verify engine mapping'}</button>:null}
          {verification&&verification.titleCount+verification.collectionCount>0?verification.equivalentTargets.map(target=><button className="primary" disabled={busy===item.id} key={target} onClick={()=>onRemap(item,target)}>Remap engine to {target}</button>):null}
          {recovery?<button className="secondary" disabled={busy===item.id} onClick={()=>onDismiss(item)}>Dismiss</button>:<a className="secondary button-link" href={href}>{actionLabel}</a>}
        </div>
      </article>;
    }):<div className="empty compact"><h3>Everything looks healthy</h3><p>No service warnings are currently being reported.</p></div>}</div>
  </section>;
}

export function HealthView({options}:{options:HealthMountOptions}){
  const [items,setItems]=useState<HealthItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(''),[verifications,setVerifications]=useState<Record<string,EnginePathVerification>>({});
  const load=useCallback(async(refresh=false)=>{setLoading(true);try{const value=await options.request<{items?:HealthItem[]}>(`/api/system/health${refresh?'?refresh=1':''}`);setItems(value.items||[]);setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Health checks could not be loaded.');}finally{setLoading(false);}},[options]);
  useEffect(()=>{void load();},[load]);
  const dismiss=async(item:HealthItem)=>{setBusy(item.id);try{await options.request(`/api/system/health/${encodeURIComponent(item.id)}/dismiss`,{method:'POST'});setItems(current=>current.filter(value=>value.id!==item.id));}catch(reason){setError(reason instanceof Error?reason.message:'The warning could not be dismissed.');}finally{setBusy('');}};
  const rematch=async(item:HealthItem)=>{const recovery=item.recovery;if(!recovery?.libraryItem||!recovery.replacement)return;if(!window.confirm(`Update ${recovery.libraryItem.title} to ${recovery.replacement.title}${recovery.replacement.year?` (${recovery.replacement.year})`:''}? Existing files and library settings will be preserved.`))return;setBusy(item.id);try{await options.request(`/api/system/health/${encodeURIComponent(item.id)}/rematch`,{method:'POST',body:JSON.stringify({mediaId:recovery.libraryItem.id,tmdbId:recovery.replacement.tmdbId})});setItems(current=>current.filter(value=>value.id!==item.id));}catch(reason){setError(reason instanceof Error?reason.message:'The library match could not be updated.');}finally{setBusy('');}};
  const verify=async(item:HealthItem)=>{const path=warningPath(item);if(!path)return;setBusy(item.id);try{const value=await options.request<EnginePathVerification>(`/api/storage/engine-path-verification?domain=${item.domain}&path=${encodeURIComponent(path)}`);setVerifications(current=>({...current,[item.id]:value}));}catch(reason){setError(reason instanceof Error?reason.message:'The engine mapping could not be verified.');}finally{setBusy('');}};
  const remap=async(item:HealthItem,target:string)=>{const sourceRoot=warningPath(item),verification=verifications[item.id];if(!sourceRoot||!verification?.equivalentTargets.includes(target))return;const total=verification.titleCount+verification.collectionCount;if(!window.confirm(`Update ${total} stored ${item.domain==='movie'?'movie/collection':'television'} path${total===1?'':'s'} from ${sourceRoot} to ${target}? No files will be moved.`))return;setBusy(item.id);try{await options.request('/api/storage/engine-path-remap',{method:'POST',body:JSON.stringify({domain:item.domain,sourceRoot,targetRoot:target})});const value=await options.request<EnginePathVerification>(`/api/storage/engine-path-verification?domain=${item.domain}&path=${encodeURIComponent(sourceRoot)}`);setVerifications(current=>({...current,[item.id]:value}));}catch(reason){setError(reason instanceof Error?reason.message:'The engine paths could not be remapped.');}finally{setBusy('');}};
  return <div className="react-health"><div className="hero"><div><span className="eyebrow">SYSTEM HEALTH</span><h1>Health</h1><p className="lede">Issues reported by the movie and television services, with direct paths to resolve them.</p></div><button className="secondary" disabled={loading} onClick={()=>void load(true)}>{loading?'Checking engines…':'Check health now'}</button></div>
    {error?<div className="notice error-state"><strong>Health action failed</strong><p>{error}</p><button className="secondary" onClick={()=>setError('')}>Close</button></div>:null}
    {loading&&!items.length?<div className="system-domain-grid health-domain-grid skeleton">Loading health checks…</div>:<div className="system-domain-grid health-domain-grid"><DomainHealth domain="movie" items={items.filter(item=>item.domain==='movie')} busy={busy} verifications={verifications} onDismiss={dismiss} onRematch={rematch} onVerify={verify} onRemap={remap}/><DomainHealth domain="tv" items={items.filter(item=>item.domain==='tv')} busy={busy} verifications={verifications} onDismiss={dismiss} onRematch={rematch} onVerify={verify} onRemap={remap}/></div>}
  </div>;
}
