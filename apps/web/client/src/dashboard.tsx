import { DashboardAnalyticsView } from './dashboard-analytics';
import type { DashboardData,RecentActivityItem,RecentlyAddedItem } from './dashboard-types';

function formatDate(value?:string){
  if(!value)return '';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date);
}

function RecentTitle({item}:{item:RecentlyAddedItem}){
  return <article className="react-feed-row"><div><strong>{item.title||'Untitled'}</strong><span>{[item.type,item.year].filter(Boolean).join(' · ')}</span></div></article>;
}

function ActivityRow({item}:{item:RecentActivityItem}){
  const date=item.dateUtc||item.timestamp||item.eta;
  return <article className="react-feed-row"><div><strong>{item.title||'Activity'}</strong><span>{item.eventType||item.status||'Updated'}</span></div>{date?<time>{formatDate(date)}</time>:null}</article>;
}

export function DashboardView({data}:{data:DashboardData}){
  const metrics=[
    ['Movies',data.metrics.movies],['TV series',data.metrics.tv],['Queue',data.metrics.queue],
    ['Upcoming movies',data.metrics.upcomingMovies],['Upcoming episodes',data.metrics.upcomingEpisodes],
    ['Missing media',data.metrics.missing],['Downloading',data.metrics.downloading],
    ['Health',data.metrics.health],['Library storage',data.metrics.storage],
  ];
  return <div className="react-dashboard">
    <header className="hero react-dashboard-hero"><p className="eyebrow">Good to see you</p><h1>Dashboard</h1><p>Your media horizon at a glance.</p></header>
    <section className="dashboard-grid react-metric-grid" aria-label="Library summary">
      {metrics.map(([label,value])=><article className="metric-card" key={label}><strong>{value??0}</strong><span>{label}</span></article>)}
    </section>
    {data.analytics?<DashboardAnalyticsView analytics={data.analytics}/>:null}
    <section className="split-panels dashboard-panels react-dashboard-feeds">
      <article className="panel"><header className="react-panel-heading"><p className="eyebrow">Library</p><h2>Recently added</h2></header><div className="react-feed">
        {data.recentlyAdded?.length?data.recentlyAdded.map((item,index)=><RecentTitle item={item} key={item.id??`${item.title}-${index}`}/>):<p className="muted">No recently added media.</p>}
      </div></article>
      <article className="panel"><header className="react-panel-heading"><p className="eyebrow">Activity</p><h2>Recent events</h2></header><div className="react-feed">
        {data.recentActivity?.length?data.recentActivity.map((item,index)=><ActivityRow item={item} key={item.id??`${item.title}-${index}`}/>):<p className="muted">No recent activity.</p>}
      </div></article>
    </section>
  </div>;
}
