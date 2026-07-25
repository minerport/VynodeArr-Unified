import { DashboardAnalyticsView } from './dashboard-analytics';
import type { DashboardData,RecentActivityItem,RecentlyAddedItem } from './dashboard-types';

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
    {label:'Upcoming',value:data.metrics.upcomingMovies+data.metrics.upcomingEpisodes,detail:`${data.metrics.upcomingMovies} movies · ${data.metrics.upcomingEpisodes} episodes`,href:'#calendar',tone:'neutral'},
    {label:'Downloading now',value:data.metrics.downloading,detail:data.metrics.downloading?'Transfers currently active':'No active transfers',href:'#queue',tone:'neutral'},
  ];
  const engineStatus=data.engines?.status;
  return <div className="react-dashboard">
    <header className="hero react-dashboard-hero"><div><p className="eyebrow">YOUR MEDIA SYSTEM</p><h1>Dashboard</h1><p>Library coverage, active work, and engine health at a glance.</p></div><div className="dashboard-engine-state"><span className={`status-dot ${engineStatus?.movie?.status==='ready'?'ready':'stale'}`}/><span>Movies {engineStatus?.movie?.status||'unknown'}</span><span className={`status-dot ${engineStatus?.tv?.status==='ready'?'ready':'stale'}`}/><span>Television {engineStatus?.tv?.status||'unknown'}</span></div></header>
    <section className="dashboard-grid react-metric-grid" aria-label="Library summary">{metrics.map(([label,value,href])=><a className="metric-card dashboard-metric-link" href={href} key={label}><strong>{value??0}</strong><span>{label}</span></a>)}</section>
    <section className="dashboard-attention-grid" aria-label="Items needing attention">{attention.map(item=><a href={item.href} className={`dashboard-attention-card ${item.tone}`} key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><p>{item.detail}</p><i aria-hidden="true">→</i></a>)}</section>
    {data.analytics?<DashboardAnalyticsView analytics={data.analytics}/>:null}
    <section className="split-panels dashboard-panels react-dashboard-feeds">
      <article className="panel"><header className="react-panel-heading"><p className="eyebrow">LIBRARY</p><h2>Recently imported</h2></header><div className="react-feed">{data.recentlyAdded?.length?data.recentlyAdded.map((item,index)=><RecentTitle item={item} key={item.id??`${item.title}-${index}`}/>):<p className="muted">No recent imports.</p>}</div></article>
      <article className="panel"><header className="react-panel-heading"><p className="eyebrow">ACTIVITY</p><h2>Recent engine events</h2></header><div className="react-feed">{data.recentActivity?.length?data.recentActivity.map((item,index)=><ActivityRow item={item} key={item.id??`${item.title}-${index}`}/>):<p className="muted">No recent activity.</p>}</div></article>
    </section>
  </div>;
}
