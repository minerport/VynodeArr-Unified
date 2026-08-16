import {useCallback,useEffect,useState} from 'react';
import type {LibraryDiagnostics,MediaManagementDomain,MediaManagementMountOptions} from './media-management-types';
import {ServiceTabs} from './service-tabs';
import {errorMessage} from './shell-utils';

const errorText=(reason:unknown)=>errorMessage(reason,'Library diagnostics are unavailable.');

export function LibraryHealthView({options}:{options:MediaManagementMountOptions}){
  const [domain,setDomain]=useState<MediaManagementDomain>('movie');
  const [diagnostics,setDiagnostics]=useState<LibraryDiagnostics|null>(null);
  const [filter,setFilter]=useState<'all'|'critical'|'warning'|'info'>('all');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{setDiagnostics(await options.request<LibraryDiagnostics>(`/api/library/diagnostics?domain=${domain}`));}catch(reason){setDiagnostics(null);setError(errorText(reason));}finally{setLoading(false);}},[domain,options]);
  useEffect(()=>{void load();},[load]);
  const items=diagnostics?.items.filter(item=>filter==='all'||item.severity===filter)||[];
  return <div className="media-management-react-route library-health-route"><div className="hero"><div><span className="eyebrow">SERVICE SETTINGS</span><h1>Library Health</h1><p className="lede">Find identity, metadata, storage, monitoring, availability, and quality issues without changing your library.</p></div><button className="secondary" disabled={loading} onClick={()=>void load()}>{loading?'Inspecting…':'Refresh diagnostics'}</button></div>
    <ServiceTabs active="library-health"/>
    <div className="management-toolbar"><label>Library<select value={domain} onChange={event=>setDomain(event.target.value as MediaManagementDomain)}><option value="movie">Movies</option><option value="tv">Television</option></select></label></div>
    <section className="panel library-diagnostics"><div className="panel-heading"><div><span className="eyebrow">LIBRARY HEALTH</span><h2>Diagnostic overview</h2><p className="muted">Each finding links to the existing workflow that can resolve it. Opening a workflow does not start downloads or change files.</p></div></div>
      {diagnostics?<><div className="naming-audit-summary"><div><strong>{diagnostics.summary.total}</strong><span>Total findings</span></div><div><strong>{diagnostics.summary.critical}</strong><span>Critical</span></div><div><strong>{diagnostics.summary.warning}</strong><span>Warnings</span></div><div><strong>{diagnostics.summary.info}</strong><span>Advisories</span></div></div><div className="diagnostic-controls"><label>Show<select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}><option value="all">All findings</option><option value="critical">Critical</option><option value="warning">Warnings</option><option value="info">Advisories</option></select></label><small>Generated {new Date(diagnostics.generatedAt).toLocaleString()}</small></div>{items.length?<div className="diagnostic-list">{items.map((item,index)=><article className={`diagnostic-${item.severity}`} key={`${item.mediaId}-${item.code}-${index}`}><span className="diagnostic-severity">{item.severity}</span><div><strong>{item.title}</strong><h3>{item.summary}</h3><p>{item.details}</p><small><b>Recommended:</b> {item.recommendation}</small></div><a className="secondary button-link" href={item.href}>{item.actionLabel}</a></article>)}</div>:<div className="notice"><strong>No findings in this view.</strong><p>The selected library has no issues matching this severity.</p></div>}</>:loading?<div className="skeleton">Inspecting library health…</div>:<div className="notice warning"><strong>Library diagnostics unavailable.</strong><p>{error||'Check the connected engine and try refreshing diagnostics.'}</p></div>}
    </section>
  </div>;
}
