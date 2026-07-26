import type { DashboardAnalytics,DistributionItem,Domain,TrendPoint } from './dashboard-types';
import './react-dashboard.css';

const number=(value:number)=>Number(value||0).toLocaleString();

function formatBytes(value:number){
  if(!value)return '0 B';
  const units=['B','KB','MB','GB','TB','PB'];
  const index=Math.min(Math.floor(Math.log(value)/Math.log(1024)),units.length-1);
  return `${(value/1024**index).toFixed(index>2?1:0)} ${units[index]}`;
}

function TrendChart({points,domain}:{points:TrendPoint[];domain:Domain}){
  const width=620,height=92,padding=12;
  const values=points.map((point)=>Number(point.count||0));
  const total=values.reduce((sum,value)=>sum+value,0);
  if(!total)return <div className={`analytics-chart analytics-chart-empty ${domain}`}>
    <span className="analytics-empty-mark" aria-hidden="true"/>
    <div><strong>No completed downloads</strong><span>No completions were recorded in this {points.length}-day window.</span></div>
  </div>;
  const peak=Math.max(1,...values);
  const step=(width-padding*2)/Math.max(1,points.length-1);
  const coordinates=values.map((value,index)=>`${padding+index*step},${height-padding-value/peak*(height-padding*2)}`).join(' ');
  const labels=points.length?[points[0],points[Math.floor(points.length/2)],points.at(-1)!]:[];
  return <div className={`analytics-chart ${domain}`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Completed downloads over the last ${points.length} days`}>
      <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding}/>
      <polyline points={coordinates}/>
      {values.map((value,index)=>value?<circle key={points[index].date} cx={padding+index*step} cy={height-padding-value/peak*(height-padding*2)} r="3"><title>{points[index].date}: {value}</title></circle>:null)}
    </svg>
    <div>{labels.map((point)=><span key={point.date}>{new Date(`${point.date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>)}</div>
  </div>;
}

function DistributionBars({items}:{items:DistributionItem[]}){
  const visible=(items||[]).slice(0,8);
  const peak=Math.max(1,...visible.map((item)=>Number(item.count||0)));
  if(!visible.length)return <p className="muted">No quality data reported yet.</p>;
  return <div className="quality-distribution">{visible.map((item)=><div className="distribution-row" key={item.name}>
    <span>{item.name}</span><div><i style={{width:`${Number(item.count||0)/peak*100}%`}}/></div><strong>{number(item.count)}</strong>
  </div>)}</div>;
}

function AnalyticsPanel({domain,analytics}:{domain:Domain;analytics:DashboardAnalytics}){
  const movie=domain==='movie';
  const library=analytics.library[domain];
  const activity=analytics.activity[domain];
  const stats=movie
    ?[['Available',analytics.library.movie.available],['Missing',analytics.library.movie.missing],['Below cutoff',analytics.library.movie.belowCutoff],['Storage',formatBytes(library.sizeOnDisk)]]
    :[['Complete',analytics.library.tv.complete],['Need attention',analytics.library.tv.needsAttention],['Missing episodes',analytics.library.tv.episodesMissing],['Storage',formatBytes(library.sizeOnDisk)]];
  return <article className={`analytics-card ${domain}`}>
    <div className="analytics-card-heading">
      <div className="analytics-card-identity">
        <span className="analytics-domain-mark" aria-hidden="true">{movie?'M':'TV'}</span>
        <div><span className="eyebrow">{movie?'MOVIE LIBRARY':'TELEVISION LIBRARY'}</span><h2>{movie?'Movie insights':'Television insights'}</h2><p>{movie?'Availability, upgrades, storage, and download activity.':'Episode coverage, storage, and download activity.'}</p></div>
      </div>
      <div className="analytics-total"><strong>{number(library.total)}</strong><span>{movie?'movies':'series'}</span></div>
    </div>
    <h3>Completed downloads · last {analytics.rangeDays} days</h3>
    <TrendChart points={analytics.downloadsOverTime[domain]} domain={domain}/>
    <div className="analytics-activity"><span><strong>{number(activity.completed)}</strong> completed</span><span><strong>{number(activity.grabbed)}</strong> grabbed</span><span><strong>{number(activity.failed)}</strong> failed</span></div>
    <div className="analytics-stat-grid">{stats.map(([label,value])=><div key={label}><strong>{typeof value==='number'?number(value):value}</strong><span>{label}</span></div>)}</div>
    <h3>{movie?'File quality':'Quality profiles'}</h3>
    <DistributionBars items={analytics.qualityDistribution[domain]}/>
  </article>;
}

export function DashboardAnalyticsView({analytics}:{analytics:DashboardAnalytics}){
  return <section className="analytics-section react-analytics-section">
    <div className="section-heading">
      <div className="section-heading-copy"><span className="eyebrow">LIBRARY ANALYTICS</span><h2>Library performance</h2><p>Coverage, quality, storage, and 30-day activity.</p></div>
      <span className="analytics-source">Last {analytics.rangeDays} days · Live engine data</span>
    </div>
    <div className="analytics-grid"><AnalyticsPanel domain="movie" analytics={analytics}/><AnalyticsPanel domain="tv" analytics={analytics}/></div>
  </section>;
}
