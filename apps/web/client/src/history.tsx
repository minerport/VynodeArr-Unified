import { useMemo,useState } from 'react';
import type { HistoryDomain,HistoryItem,HistoryMountOptions } from './history-types';
import './react-history.css';

const labels:Record<HistoryDomain,string>={movie:'Movies',tv:'Television'};
const when=(value?:string|null)=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Time unavailable';

function HistorySection({domain,items,options}:{domain:HistoryDomain;items:HistoryItem[];options:HistoryMountOptions}){
  const [busy,setBusy]=useState<Record<string,boolean>>({}),[completed,setCompleted]=useState<Record<string,boolean>>({});
  async function retry(item:HistoryItem){
    const mediaId=Number(String(item.mediaId||'').replace(/^[^_]+_/,''));
    if(!Number.isFinite(mediaId))return;
    setBusy(value=>({...value,[item.id]:true}));
    try{await options.request('/api/media-files/rename',{method:'POST',body:JSON.stringify({domain,mediaId})});setCompleted(value=>({...value,[item.id]:true}));options.notify(`${item.title} was queued to move and rename.`);}
    catch(error){setBusy(value=>({...value,[item.id]:false}));options.notify(error instanceof Error?error.message:'The organize retry failed.','error');}
  }
  return <section className="system-domain-section react-history-domain"><header className="panel-heading"><div><span className="eyebrow">{domain==='movie'?'MOVIE ENGINE':'TELEVISION ENGINE'}</span><h2>{labels[domain]} history</h2></div><span className="badge">{items.length}</span></header><div className="react-history-list">{items.slice(0,100).map(item=><article className="react-history-row" key={item.id}><div><strong>{item.title}</strong><span>{item.eventType||'unknown'}{item.quality?` · ${item.quality}`:''}</span>{item.details?<small>{item.details}</small>:null}</div><div><time>{when(item.timestamp)}</time>{options.administrator&&item.mediaId?<button className="secondary" disabled={busy[item.id]||completed[item.id]} onClick={()=>void retry(item)}>{completed[item.id]?'Queued ✓':busy[item.id]?'Retrying…':'Retry organize'}</button>:null}</div></article>)}</div>{!items.length?<p className="muted">No history reported.</p>:null}</section>;
}

export function HistoryView({options}:{options:HistoryMountOptions}){
  const [query,setQuery]=useState(''),[eventType,setEventType]=useState('all');
  const eventTypes=useMemo(()=>[...new Set(options.items.map(item=>item.eventType).filter((value):value is string=>Boolean(value)))].sort(),[options.items]);
  const filtered=useMemo(()=>options.items.filter(item=>(eventType==='all'||item.eventType===eventType)&&(!query||`${item.title} ${item.details||''}`.toLowerCase().includes(query.toLowerCase()))),[options.items,eventType,query]);
  return <div className="react-history"><div className="hero"><div><span className="eyebrow">ACTIVITY</span><h1>History</h1><p className="lede">Movie and television activity separated by library.</p></div></div><div className="history-help notice"><strong>Import or naming problem?</strong><p>Retry organize moves the title into its configured library folder and applies the engine’s current naming rules.</p></div><div className="react-history-toolbar"><label>Find activity<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Title or message"/></label><label>Event<select value={eventType} onChange={event=>setEventType(event.target.value)}><option value="all">All events</option>{eventTypes.map(value=><option key={value} value={value}>{value}</option>)}</select></label></div><div className="system-domain-grid"><HistorySection domain="movie" items={filtered.filter(item=>item.domain==='movie')} options={options}/><HistorySection domain="tv" items={filtered.filter(item=>item.domain==='tv')} options={options}/></div></div>;
}
