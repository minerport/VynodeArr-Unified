import { useEffect,useState } from 'react';
import { DashboardAnalyticsView } from './dashboard-analytics';
import type { DashboardData,DashboardMountOptions,RecentActivityItem,RecentlyAddedItem } from './dashboard-types';

const dashboardSnapshotKey='vynodearr.dashboardSnapshot';

function readSnapshot():DashboardData|null {
  try{
    const value=JSON.parse(sessionStorage.getItem(dashboardSnapshotKey)||'null') as DashboardData|null;
    return value?.metrics?value:null;
  }catch{return null;}
}

export function DashboardRoute({options}:{options:DashboardMountOptions}){
  const [data,setData]=useState<DashboardData|null>(()=>readSnapshot());
  const [error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const value=await options.request<DashboardData>('/api/dashboard');
        if(!active)return;
        sessionStorage.setItem(dashboardSnapshotKey,JSON.stringify(value));
        setData(value);
        setError('');
      }catch(reason){
        if(active)setError(reason instanceof Error?reason.message:'Dashboard data is unavailable.');
      }
    };
    void load();
    const timer=window.setInterval(()=>{if(!document.hidden)void load();},15_000);
    return()=>{active=false;window.clearInterval(timer);};
  },[options]);

  if(!data&&!error)return <div className="panel skeleton react-route-loading">Loading dashboard…</div>;
  if(!data)return <div className="empty error-state"><h2>Dashboard unavailable</h2><p>{error}</p></div>;
  return <><DashboardView data={data}/>{error?<div className="notice warning"><strong>Dashboard refresh delayed.</strong><p>{error}</p></div>:null}</>;
}

function formatDate(value?:string){
  if(!value)return '';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date);
}
function formatBytes(value:string|number){
  const bytes=Number(value||0);
  if(!bytes)return'0 B';
  const units=['B','KB','MB','GB','TB'],index=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);
  return`${(bytes/1024**index).toFixed(index>=3?1:0)} ${units[index]}`;
}
function RecentTitle({item}:{item:RecentlyAddedItem}){
  return <article className="react-feed-row"><div><strong>{item.title||'Untitled'}</strong><span>{[item.type,item.year].filter(Boolean).join(' · ')}</span></div>{item.timestamp?<time>{formatDate(item.timestamp)}</time>:null}</article>;
}
function ActivityRow({item}:{item:RecentActivityItem}){
  const date=item.dateUtc||item.timestamp||item.eta,event=String(item.eventType||item.status||'Updated').replace(/([a-z])([A-Z])/g,'$1 $2');
  return <article className="react-feed-row"><div><strong>{item.title||'Activity'}</strong><span>{event}</span></div>{date?<time>{formatDate(date)}</time>:null}</article>;
}

export function DashboardView({data}:{data:DashboardData}){
  const metrics=[['Movies',data.metrics.movies,'#movies'],['TV series',data.metrics.tv,'#tv'],['Active queue',data.metrics.queue,'#queue'],['Library storage',formatBytes(data.metrics.storage),'#movies']] as const;
  const attention=[
    {label:'Missing media',value:data.metrics.missing,detail:'Monitored titles or episodes still needed',href:'#wanted',tone:data.metrics.missing?'warm':'good'},
    {label:'Health notices',value:data.metrics.health,detail:data.metrics.health?'Engine settings need attention':'Both engines report healthy',href:'#health',tone:data.metrics.health?'danger':'good'},
    {label:'Upcoming',value:data.metrics.upcomingMovies+data.metrics.upcomingEpisodes,detail:`${data.metrics.upcomingMovies} movies · ${data.metrics.upcomingEpisodes} episodes`,href:'#calendar',tone:'neutral',preview:data.upcoming},
    {label:'Downloading now',value:data.metrics.downloading,detail:data.metrics.downloading?'Transfers currently active':'No active transfers',href:'#queue',tone:'neutral'},
  ];
  const engineStatus=data.engines?.status;
  return <div className="react-dashboard">
    <section className="hero react-dashboard-hero"><div><p className="eyebrow">MEDIA OPERATIONS</p><h1>Dashboard</h1><p>Library health, downloads, and engine activity in one view.</p></div><div className="dashboard-engine-state"><span className={`status-dot ${engineStatus?.movie?.status==='ready'?'ready':'stale'}`}/><span>Movies {engineStatus?.movie?.status||'unknown'}</span><span className={`status-dot ${engineStatus?.tv?.status==='ready'?'ready':'stale'}`}/><span>Television {engineStatus?.tv?.status||'unknown'}</span></div></section>
    <section className="dashboard-grid react-metric-grid" aria-label="Library summary">{metrics.map(([label,value,href])=><a className="metric-card dashboard-metric-link" href={href} key={label}><strong>{value??0}</strong><span>{label}</span></a>)}</section>
    <section className="dashboard-attention-grid" aria-label="Items needing attention">{attention.map(item=><a href={item.href} className={`dashboard-attention-card ${item.tone}${item.preview?' has-preview':''}`} key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><p>{item.detail}</p><i aria-hidden="true">→</i>{item.preview?<span className="dashboard-upcoming-preview" role="tooltip"><b>Coming up</b>{item.preview.length?item.preview.map((event,index)=><span className="dashboard-upcoming-row" key={event.id??`${event.domain}-${event.title}-${index}`}><em className={event.domain}>{event.domain==='movie'?'Movie':'TV'}</em><span><strong>{event.title||'Untitled'}</strong>{event.context?<small>{event.context}</small>:null}</span><time>{formatDate(event.dateUtc)}</time></span>):<small>No scheduled items were returned.</small>}<u>Open the full calendar →</u></span>:null}</a>)}</section>
    {data.analytics?<DashboardAnalyticsView analytics={data.analytics}/>:null}
    <section className="split-panels dashboard-panels react-dashboard-feeds">
      <article className="panel"><div className="react-panel-heading"><p className="eyebrow">LIBRARY</p><h2>Recently imported</h2></div><div className="react-feed">{data.recentlyAdded?.length?data.recentlyAdded.map((item,index)=><RecentTitle item={item} key={item.id??`${item.title}-${index}`}/>):<p className="muted">No recent imports.</p>}</div></article>
      <article className="panel"><div className="react-panel-heading"><p className="eyebrow">ACTIVITY</p><h2>Recent engine events</h2></div><div className="react-feed">{data.recentActivity?.length?data.recentActivity.map((item,index)=><ActivityRow item={item} key={item.id??`${item.title}-${index}`}/>):<p className="muted">No recent activity.</p>}</div></article>
    </section>
  </div>;
}
