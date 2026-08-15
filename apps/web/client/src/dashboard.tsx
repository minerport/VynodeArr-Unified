import {useCallback,useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {DashboardAnalyticsView} from './dashboard-analytics';
import type {DashboardData,DashboardMountOptions,RecentActivityItem,RecentlyAddedItem} from './dashboard-types';
import {useVisibleRefresh} from './use-visible-refresh';
import {useEngineInstances,type EngineInstance,type EngineInstanceDomain} from './engine-instance-control';

const snapshotKey=(movieId:string,tvId:string)=>`vynodearr.dashboardSnapshot.${movieId}.${tvId}`;
const selectionKey=(domain:EngineInstanceDomain)=>`vynodearr:dashboard-engine:${domain}`;
const remembered=(domain:EngineInstanceDomain)=>{try{return localStorage.getItem(selectionKey(domain))||'all';}catch{return'all';}};
const remember=(domain:EngineInstanceDomain,value:string)=>{try{localStorage.setItem(selectionKey(domain),value);}catch{/* Storage is optional. */}};
function readSnapshot(movieId:string,tvId:string):DashboardData|null{try{const value=JSON.parse(sessionStorage.getItem(snapshotKey(movieId,tvId))||'null') as DashboardData|null;return value?.metrics?value:null;}catch{return null;}}

function DashboardEngineFilter({domain,instances,value,onChange}:{domain:EngineInstanceDomain;instances:EngineInstance[];value:string;onChange:(value:string)=>void}){
  const movie=domain==='movie',label=movie?'Movies':'Television';
  return <label className={`dashboard-engine-filter ${domain}`}><span><b>{label}</b><small>{movie?'Movie':'TV'} engine scope</small></span><select aria-label={`${label} engine scope`} value={value} onChange={event=>onChange(event.target.value)}><option value="all">All {movie?'movie':'TV'} engines</option>{instances.map(item=><option key={item.id} value={item.id}>{item.name}{item.isDefault?' — default':''}</option>)}</select></label>;
}

export function DashboardRoute({options}:{options:DashboardMountOptions}){
  const [movieEngineId,setMovieEngineId]=useState(()=>remembered('movie')),[tvEngineId,setTvEngineId]=useState(()=>remembered('tv'));
  const engineInstances=useEngineInstances(options.request),movieEngines=engineInstances.filter(item=>item.domain==='movie'),tvEngines=engineInstances.filter(item=>item.domain==='tv');
  const [data,setData]=useState<DashboardData|null>(()=>readSnapshot(remembered('movie'),remembered('tv'))),[error,setError]=useState('');
  useEffect(()=>{if(movieEngines.length)setMovieEngineId(current=>current==='all'||movieEngines.some(item=>item.id===current)?current:'all');if(tvEngines.length)setTvEngineId(current=>current==='all'||tvEngines.some(item=>item.id===current)?current:'all');},[engineInstances]);
  const load=useCallback(async()=>{try{const value=await options.request<DashboardData>(`/api/dashboard?movieEngineInstanceId=${encodeURIComponent(movieEngineId)}&tvEngineInstanceId=${encodeURIComponent(tvEngineId)}`);sessionStorage.setItem(snapshotKey(movieEngineId,tvEngineId),JSON.stringify(value));setData(value);setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Dashboard data is unavailable.');}},[options,movieEngineId,tvEngineId]);
  useVisibleRefresh(load,15_000);
  const choose=(domain:EngineInstanceDomain,value:string)=>{remember(domain,value);const movie=domain==='movie'?value:movieEngineId,tv=domain==='tv'?value:tvEngineId;if(domain==='movie')setMovieEngineId(value);else setTvEngineId(value);setData(readSnapshot(movie,tv));};
  if(!data&&!error)return <div className="panel skeleton react-route-loading">Loading dashboard…</div>;
  if(!data)return <div className="empty error-state"><h2>Dashboard unavailable</h2><p>{error}</p></div>;
  const engineFilters=<div className="dashboard-engine-filters" aria-label="Dashboard engine scope"><DashboardEngineFilter domain="movie" instances={movieEngines} value={movieEngineId} onChange={value=>choose('movie',value)}/><DashboardEngineFilter domain="tv" instances={tvEngines} value={tvEngineId} onChange={value=>choose('tv',value)}/></div>;
  return <><DashboardView data={data} engineFilters={engineFilters}/>{error?<div className="notice warning"><strong>Dashboard refresh delayed.</strong><p>{error}</p></div>:null}</>;
}

function formatDate(value?:string){if(!value)return'';const date=new Date(value);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date);}
function formatBytes(value:string|number){const bytes=Number(value||0);if(!bytes)return'0 B';const units=['B','KB','MB','GB','TB'],index=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);return`${(bytes/1024**index).toFixed(index>=3?1:0)} ${units[index]}`;}
function RecentTitle({item}:{item:RecentlyAddedItem}){return <article className="react-feed-row"><div><strong>{item.title||'Untitled'}</strong><span>{[item.type,item.year,item.engineInstanceName].filter(Boolean).join(' · ')}</span></div>{item.timestamp?<time>{formatDate(item.timestamp)}</time>:null}</article>;}
function ActivityRow({item}:{item:RecentActivityItem}){const date=item.dateUtc||item.timestamp||item.eta,event=String(item.eventType||item.status||'Updated').replace(/([a-z])([A-Z])/g,'$1 $2');return <article className="react-feed-row"><div><strong>{item.title||'Activity'}</strong><span>{event}{item.engineInstanceName?` · ${item.engineInstanceName}`:''}</span></div>{date?<time>{formatDate(date)}</time>:null}</article>;}

export function DashboardView({data,engineFilters=null}:{data:DashboardData;engineFilters?:ReactNode}){
  const scope=data.scope||{movie:{id:'all',name:'All movie engines',instanceCount:1},tv:{id:'all',name:'All TV engines',instanceCount:1}},metrics=[['Movies',data.metrics.movies,'#movies'],['TV series',data.metrics.tv,'#tv'],['Active queue',data.metrics.queue,'#queue'],['Library storage',formatBytes(data.metrics.storage),'#movies']] as const;
  const attention=[{label:'Missing media',value:data.metrics.missing,detail:'Monitored titles or episodes still needed',href:'#wanted',tone:data.metrics.missing?'warm':'good'},{label:'Health notices',value:data.metrics.health,detail:data.metrics.health?'Selected engines need attention':'Selected engines report healthy',href:'#health',tone:data.metrics.health?'danger':'good'},{label:'Upcoming',value:data.metrics.upcomingMovies+data.metrics.upcomingEpisodes,detail:`${data.metrics.upcomingMovies} movies · ${data.metrics.upcomingEpisodes} episodes`,href:'#calendar',tone:'neutral',preview:data.upcoming},{label:'Downloading now',value:data.metrics.downloading,detail:data.metrics.downloading?'Transfers currently active':'No active transfers',href:'#queue',tone:'neutral'}];
  const engineStatus=data.engines?.status;
  return <div className="react-dashboard">
    <section className="hero react-dashboard-hero"><div className="dashboard-hero-copy"><p className="eyebrow">MEDIA OPERATIONS</p><h1>Dashboard</h1><p>Combined operations for {scope.movie.name} and {scope.tv.name}.</p></div><div className="dashboard-hero-controls">{engineFilters}<div className="dashboard-engine-state"><span className={`status-dot ${engineStatus?.movie?.status==='ready'?'ready':'stale'}`}/><span>{scope.movie.name} · {engineStatus?.movie?.status||'unknown'}</span><span className={`status-dot ${engineStatus?.tv?.status==='ready'?'ready':'stale'}`}/><span>{scope.tv.name} · {engineStatus?.tv?.status||'unknown'}</span></div></div></section>
    <section className="dashboard-grid react-metric-grid" aria-label="Library summary">{metrics.map(([label,value,href])=><a className="metric-card dashboard-metric-link" href={href} key={label}><strong>{value??0}</strong><span>{label}</span></a>)}</section>
    <section className="dashboard-attention-grid" aria-label="Items needing attention">{attention.map(item=><a href={item.href} className={`dashboard-attention-card ${item.tone}${item.preview?' has-preview':''}`} key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><p>{item.detail}</p><i aria-hidden="true">→</i>{item.preview?<span className="dashboard-upcoming-preview" role="tooltip"><b>Coming up</b>{item.preview.length?item.preview.map((event,index)=><span className="dashboard-upcoming-row" key={event.id??`${event.domain}-${event.title}-${index}`}><em className={event.domain}>{event.domain==='movie'?'Movie':'TV'}</em><span><strong>{event.title||'Untitled'}</strong>{event.context?<small>{event.context}</small>:null}</span><time>{formatDate(event.dateUtc)}</time></span>):<small>No scheduled items were returned.</small>}<u>Open the full calendar →</u></span>:null}</a>)}</section>
    {data.analytics?<DashboardAnalyticsView analytics={data.analytics}/>:null}
    <section className="split-panels dashboard-panels react-dashboard-feeds"><article className="panel"><div className="react-panel-heading"><p className="eyebrow">LIBRARY</p><h2>Recently imported</h2></div><div className="react-feed">{data.recentlyAdded?.length?data.recentlyAdded.map((item,index)=><RecentTitle item={item} key={item.id??`${item.title}-${index}`}/>):<p className="muted">No recent imports.</p>}</div></article><article className="panel"><div className="react-panel-heading"><p className="eyebrow">ACTIVITY</p><h2>Recent engine events</h2></div><div className="react-feed">{data.recentActivity?.length?data.recentActivity.map((item,index)=><ActivityRow item={item} key={item.id??`${item.title}-${index}`}/>):<p className="muted">No recent activity.</p>}</div></article></section>
  </div>;
}
