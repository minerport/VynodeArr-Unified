import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import type { QueueItem,QueueMountOptions } from './queue-types';
import {useVisibleRefresh} from './use-visible-refresh';
import {EngineInstanceFilter,useEngineInstances} from './engine-instance-control';
import './react-queue.css';
type SortKey='title'|'media'|'source'|'quality'|'size'|'progress'|'status';
const key=(item:QueueItem)=>`${item.domain}:${item.id}`;
const status=(item:QueueItem)=>item.clientStatus||item.status||item.trackedDownloadStatus||'Unknown';
const source=(item:QueueItem)=>item.engineInstanceName||`${item.domain==='movie'?'Movie':'Television'} engine`;
const quality=(item:QueueItem)=>typeof item.quality==='string'?item.quality:item.quality?.quality?.name||item.quality?.name||'Unknown';
const title=(item:QueueItem)=>{const name=item.media?.title||item.movie?.title||item.series?.title||'Unmatched download';return item.domain==='tv'&&item.episode?`${name} · S${item.episode.seasonNumber??'–'}E${item.episode.episodeNumber??'–'}${item.episode.title?` · ${item.episode.title}`:''}`:name;};
const progress=(item:QueueItem)=>Math.max(0,Math.min(100,Number.isFinite(item.clientPercentage)?Number(item.clientPercentage):(Number(item.size||0)-Number(item.sizeleft||0))/Math.max(1,Number(item.size||0))*100));
const complete=(item:QueueItem)=>/^(completed|complete)$/i.test(status(item));
const retryable=(item:QueueItem)=>/(fail|warning|import)/i.test(`${status(item)} ${item.trackedDownloadState||''}`);
const failedDownload=(item:QueueItem)=>retryable(item)||(complete(item)&&Number(item.size||0)===0&&item.statusMessages?.some(value=>value.messages?.some(message=>/no files.*eligible|import.*failed/i.test(message))));

export function QueueView({options}:{options:QueueMountOptions}){
  const [items,setItems]=useState<QueueItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [statusFilter,setStatusFilter]=useState(''),[mediaFilter,setMediaFilter]=useState(''),[engineInstanceId,setEngineInstanceId]=useState('all');
  const engineInstances=useEngineInstances(options.request);
  const [sortKey,setSortKey]=useState<SortKey>('title'),[direction,setDirection]=useState(1),[selected,setSelected]=useState<Set<string>>(new Set()),[busy,setBusy]=useState<Set<string>>(new Set());
  const requestSequence=useRef(0),requestPending=useRef(false);
  const load=useCallback(async(quiet=false)=>{if(requestPending.current)return;const sequence=++requestSequence.current;requestPending.current=true;if(!quiet)setLoading(true);try{const result=await options.request<{items:QueueItem[]}>('/api/activity/queue/live');if(sequence!==requestSequence.current)return;setItems(result.items||[]);setSelected(old=>new Set([...old].filter(value=>(result.items||[]).some(item=>key(item)===value))));setError('');}catch(reason){if(sequence===requestSequence.current)setError(reason instanceof Error?reason.message:'Queue could not be loaded.');}finally{requestPending.current=false;if(sequence===requestSequence.current)setLoading(false);}},[options]);
  useEffect(()=>{
    void load();
    const startupRetries=[window.setTimeout(()=>void load(true),1200),window.setTimeout(()=>void load(true),3500)];
    return()=>{requestSequence.current++;requestPending.current=false;startupRetries.forEach(window.clearTimeout);};
  },[load]);
  useVisibleRefresh(()=>load(true),5000,{immediate:false});
  const engineItems=useMemo(()=>engineInstanceId==='all'?items:items.filter(item=>item.engineInstanceId===engineInstanceId),[items,engineInstanceId]);
  const statuses=useMemo(()=>[...new Set(engineItems.map(status))].sort(),[engineItems]);
  const counts=useMemo(()=>({
    total:engineItems.length,
    movies:engineItems.filter(item=>item.domain==='movie').length,
    television:engineItems.filter(item=>item.domain==='tv').length,
  }),[engineItems]);
  const visible=useMemo(()=>engineItems.filter(item=>(!statusFilter||status(item)===statusFilter)&&(!mediaFilter||item.domain===mediaFilter)).sort((a,b)=>{const value=(item:QueueItem)=>sortKey==='title'?title(item):sortKey==='media'?item.domain:sortKey==='source'?source(item):sortKey==='quality'?quality(item):sortKey==='size'?Number(item.size||0):sortKey==='progress'?progress(item):status(item);const left=value(a),right=value(b);return direction*(typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right),undefined,{numeric:true,sensitivity:'base'}));}),[engineItems,statusFilter,mediaFilter,sortKey,direction]);
  const sort=(next:SortKey)=>{if(next===sortKey)setDirection(value=>-value);else{setSortKey(next);setDirection(1);}};
  const remove=async(item:QueueItem,ask=true)=>{const blocklist=Boolean(failedDownload(item));if(ask&&!window.confirm(blocklist?'Remove this failed queue item and blocklist this release so another result can be searched?':'Remove this queue item?'))return;const itemKey=key(item);setBusy(old=>new Set(old).add(itemKey));try{await options.request(`/api/manage/${item.domain}/queue/${item.id}?removeFromClient=true&blocklist=${blocklist}`,{method:'DELETE'});setItems(old=>old.filter(value=>key(value)!==itemKey));setSelected(old=>{const next=new Set(old);next.delete(itemKey);return next;});options.notify(blocklist?'Failed release removed and blocklisted. Search is ready to try another result.':'Queue item removed.');await load();}catch(reason){options.notify(reason instanceof Error?reason.message:'Queue item could not be removed.','error');}finally{setBusy(old=>{const next=new Set(old);next.delete(itemKey);return next;});}};
  const retry=async(item:QueueItem)=>{const itemKey=key(item);setBusy(old=>new Set(old).add(itemKey));try{await options.request(`/api/manage/${item.domain}/queueGrab/${item.id}`,{method:'POST',body:'{}'});options.notify('Import retry requested.');void load(true);}catch(reason){options.notify(reason instanceof Error?reason.message:'Import retry failed.','error');}finally{setBusy(old=>{const next=new Set(old);next.delete(itemKey);return next;});}};
  const select=(subset:QueueItem[])=>setSelected(old=>new Set([...old,...subset.map(key)]));
  const removeSelected=async()=>{
    const targets=items.filter(item=>selected.has(key(item)));
    if(!targets.length||!window.confirm(`Remove ${targets.length} selected queue item${targets.length===1?'':'s'}?`))return;
    const targetKeys=new Set(targets.map(key));setBusy(old=>new Set([...old,...targetKeys]));
    try{
      const result=await options.request<{removed:Array<{domain:string;id:string|number}>;failed:Array<{domain:string;id:string|number;message:string}>;items:QueueItem[]}>('/api/manage/queue/bulk-delete',{method:'POST',body:JSON.stringify({items:targets.map(item=>({domain:item.domain,id:item.id,blocklist:Boolean(failedDownload(item))})),removeFromClient:true})});
      setItems(result.items||[]);setSelected(new Set());
      if(result.failed?.length)options.notify(`${result.removed.length} removed; ${result.failed.length} could not be removed.`,result.removed.length?'info':'error');
      else options.notify(`${result.removed.length} queue item${result.removed.length===1?'':'s'} removed.`);
      await load(true);
    }catch(reason){options.notify(reason instanceof Error?reason.message:'Selected queue items could not be removed.','error');}
    finally{setBusy(old=>new Set([...old].filter(value=>!targetKeys.has(value))));}
  };
  return <div className="react-queue">
    <div className="hero"><div><span className="eyebrow">ACTIVITY</span><h1>Queue</h1><p className="lede">Live items reported by the movie and television engines, including paused downloads and import warnings.</p></div><button className="secondary" onClick={()=>void load()}>Refresh</button></div>
    <section className="dashboard-grid react-metric-grid" aria-label="Queue totals">
      <div className="metric-card"><strong>{loading?'—':counts.total}</strong><span>Total queued · both engines</span></div>
      <div className="metric-card"><strong>{loading?'—':counts.movies}</strong><span>Movies · Movie engine</span></div>
      <div className="metric-card"><strong>{loading?'—':counts.television}</strong><span>TV items · TV engine</span></div>
    </section>
    <div className="react-queue-toolbar panel"><label>Status<select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="">All statuses</option>{statuses.map(value=><option key={value}>{value}</option>)}</select></label><label>Media<select value={mediaFilter} onChange={event=>setMediaFilter(event.target.value)}><option value="">All media</option><option value="movie">Movies</option><option value="tv">Television</option></select></label><EngineInstanceFilter instances={engineInstances} value={engineInstanceId} onChange={setEngineInstanceId}/><div className="react-queue-selection"><button className="secondary" onClick={()=>select(visible)}>Select all</button><button className="secondary" onClick={()=>select(visible.filter(complete))}>Select all completed</button><button className="danger" disabled={!selected.size||[...selected].some(value=>busy.has(value))} onClick={()=>void removeSelected()}>{[...selected].some(value=>busy.has(value))?'Removing batch…':`Remove selected${selected.size?` (${selected.size})`:''}`}</button></div></div>
  {loading?<div className="panel skeleton">Loading…</div>:error?<div className="panel error-state"><p>{error}</p></div>:!visible.length?<div className="panel empty"><h2>Queue is clear</h2><p>Waiting for newly grabbed downloads…</p></div>:<div className="panel react-queue-list"><div className="react-queue-sort">Sort by {(['title','media','source','quality','size','progress','status'] as SortKey[]).map(value=><button key={value} className={sortKey===value?'active':''} onClick={()=>sort(value)}>{value}{sortKey===value?(direction>0?' ↑':' ↓'):''}</button>)}</div>{visible.map(item=>{const itemKey=key(item),poster=item.mediaId?`/api/artwork/${item.domain}/${item.domain==='movie'?'movie':'series'}_${item.mediaId}/poster`:'';return <article className="react-queue-row" key={itemKey}><input type="checkbox" aria-label={`Select ${title(item)}`} checked={selected.has(itemKey)} onChange={event=>setSelected(old=>{const next=new Set(old);event.target.checked?next.add(itemKey):next.delete(itemKey);return next;})}/><div className="react-queue-poster">{poster?<img src={poster} alt="" loading="lazy"/>:<span>{item.domain==='movie'?'M':'TV'}</span>}</div><div className="react-queue-main"><strong>{title(item)}</strong><small>{item.clientFilename||item.title||'Download'}</small>{item.requesters?.length?<small className="requester-attribution">Requested by {item.requesters.map(user=>user.name).join(', ')}</small>:null}{item.statusMessages?.flatMap(value=>value.messages||[]).map(message=><small className="form-error" key={message}>{message}</small>)}</div><dl><div><dt>Media</dt><dd>{item.domain==='movie'?'Movie':'Television'}</dd></div><div><dt>Source</dt><dd>{source(item)}</dd></div><div><dt>Quality</dt><dd>{quality(item)}</dd></div><div><dt>Size</dt><dd>{(Number(item.size||0)/1073741824).toFixed(2)} GB</dd></div></dl><div className="react-queue-progress"><span>{Math.round(progress(item))}%</span><i><b style={{width:`${progress(item)}%`}}/></i></div><div className="react-queue-state"><strong>{status(item)}</strong>{item.clientTimeLeft?<small>{item.clientTimeLeft} remaining</small>:null}{item.clientSpeed?<small>{item.clientSpeed}</small>:null}</div><div className="react-queue-actions">{retryable(item)?<button className="secondary" disabled={busy.has(itemKey)} onClick={()=>void retry(item)}>Retry</button>:null}<button className="danger" disabled={busy.has(itemKey)} onClick={()=>void remove(item)}>{busy.has(itemKey)?'Working…':'Remove'}</button></div></article>;})}</div>}</div>;
}
