import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {AccountTabs} from './account-tabs';
import type {EngineAuthenticationSettings,EngineConfiguration,EngineDomain,EngineManagementMountOptions,EngineSettings,EngineSummary,EngineSystem,EngineValidation} from './engine-management-types';

const errorText=(reason:unknown)=>reason instanceof Error?reason.message:'Engine management is unavailable.';
const display=(domain:EngineDomain)=>domain==='movie'?'Movies':'TV';
const healthy=(engine:EngineSummary)=>engine.connection?.reachable&&engine.connection?.authenticated&&engine.connection?.compatible;
const when=(value?:string|null)=>value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Pending';

function EngineCard({engine}:{engine:EngineSummary}){
  const ready=healthy(engine);
  return <article className="engine-status-card">
    <div className="engine-status-heading"><span className={`status-dot${ready?'':' offline'}`}/><div><h2>{engine.displayName}</h2><p>{ready?'Connected through the private gateway':'Connection needs attention'}</p></div><span className={`badge ${ready?'green':'warm'}`}>{ready?'Healthy':'Unavailable'}</span></div>
    <dl><dt>Version</dt><dd>{engine.status?.version||'Unknown'}</dd><dt>Branch</dt><dd>{engine.status?.branch||'stable'}</dd><dt>Last synchronized</dt><dd>{when(engine.synchronization?.lastSuccessAt)}</dd><dt>Credential</dt><dd>{engine.configuration?.credentialConfigured?'Encrypted and managed':'Not configured'}</dd></dl>
  </article>;
}

function IntegrationKey({engine,managed,options}:{engine:EngineSummary;managed:boolean;options:EngineManagementMountOptions}){
  const [key,setKey]=useState(''),[busy,setBusy]=useState('');
  const reveal=async()=>{if(key){setKey('');return;}setBusy('reveal');try{const value=await options.request<{apiKey:string}>(`/api/settings/engines/${engine.domain}/api-key`);setKey(value.apiKey);}catch(reason){options.notify(errorText(reason),'error');}finally{setBusy('');}};
  const copy=async()=>{try{await navigator.clipboard.writeText(key);options.notify(`${display(engine.domain)} engine API key copied.`);}catch(reason){options.notify(errorText(reason),'error');}};
  const regenerate=async()=>{
    if(!confirm(`Generate a new ${engine.domain==='movie'?'movie':'TV'} engine API key? VynodeArr will update itself, but Seerr and every other connected application will stop working until you update them.`))return;
    setBusy('regenerate');
    try{const value=await options.request<{apiKey:string}>(`/api/settings/engines/${engine.domain}/api-key`,{method:'POST',body:'{}'});setKey(value.apiKey);options.notify('New API key generated. Update every connected external application now.','info');}
    catch(reason){options.notify(errorText(reason),'error');}finally{setBusy('');}
  };
  return <div className="integration-key-row"><strong>{engine.displayName} · {engine.domain==='movie'?'/movies':'/tv'}</strong><code>{key||'Hidden'}</code><button className="secondary" disabled={Boolean(busy)} onClick={()=>void reveal()}>{busy==='reveal'?'Loading…':key?'Hide':'Reveal'}</button><button className="secondary" disabled={!key||Boolean(busy)} onClick={()=>void copy()}>Copy</button><button className="danger" disabled={!managed||Boolean(busy)} title={managed?'':'Key generation is available only for installation-managed engines'} onClick={()=>void regenerate()}>{busy==='regenerate'?'Generating…':'Generate new key'}</button></div>;
}

function AuthenticationControls({value,options,onChange}:{value:EngineAuthenticationSettings;options:EngineManagementMountOptions;onChange:(value:EngineAuthenticationSettings)=>void}){
  const [busy,setBusy]=useState<EngineDomain|null>(null);
  const toggle=async(domain:EngineDomain,required:boolean)=>{
    if(!required&&!confirm(`Allow Docker-network clients to reach the ${display(domain)} engine without authentication? API-key authentication is strongly recommended.`))return;
    setBusy(domain);
    try{
      const updated=await options.request<{required:boolean;mode:string}>(`/api/settings/engines/${domain}/authentication`,{method:'PUT',body:JSON.stringify({required})});
      onChange({...value,[domain]:{available:true,required:updated.required,mode:updated.mode}});
      options.notify(`${display(domain)} engine authentication ${updated.required?'required':'allowed to bypass on local addresses'}.`,updated.required?'info':'error');
    }catch(reason){options.notify(errorText(reason),'error');}
    finally{setBusy(null);}
  };
  const protectedEngines=value.movie.required===true&&value.tv.required===true,unavailable=!value.movie.available||!value.tv.available;
  return <section className="panel engine-authentication"><div className="panel-heading"><div><span className="eyebrow">NETWORK SECURITY</span><h2>Require engine authentication</h2></div><span className={`badge ${protectedEngines?'green':'warm'}`}>{protectedEngines?'Protected':unavailable?'Status unavailable':'Local bypass enabled'}</span></div><p className="muted">When enabled, every client—including other containers on the Docker network—must provide the engine API key. Disable this only for a trusted, isolated network.</p><div className="engine-authentication-grid">{(['movie','tv'] as EngineDomain[]).map(domain=><label className="config-switch" key={domain}><span><strong>{display(domain)}</strong><small>{!value[domain].available?'Connect this engine to review its setting':value[domain].required?'API key required from every address':'Local and Docker-network addresses may bypass authentication'}</small></span><input type="checkbox" checked={value[domain].required===true} disabled={busy!==null||!value[domain].available} onChange={event=>void toggle(domain,event.target.checked)}/></label>)}</div></section>;
}

export function ExternalEngineForm({domain,initial,options}:{domain:EngineDomain;initial:EngineConfiguration;options:EngineManagementMountOptions}){
  const [value,setValue]=useState<EngineConfiguration&{apiCredential:string}>({...initial,apiCredential:''}),[validation,setValidation]=useState<EngineValidation|null>(null),[busy,setBusy]=useState('');
  const update=<K extends keyof typeof value>(key:K,next:(typeof value)[K])=>{setValue(current=>({...current,[key]:next}));setValidation(null);options.onDirtyChange(true);};
  const test=async()=>{setBusy('test');try{const result=await options.request<EngineValidation>(`/api/settings/engines/${domain}/test`,{method:'POST',body:JSON.stringify(value)});setValidation(result);if(!result.validated)options.notify(result.connection.safeError||'Connection validation failed.','error');}catch(reason){setValidation(null);options.notify(errorText(reason),'error');}finally{setBusy('');}};
  const save=async(event:FormEvent)=>{event.preventDefault();if(!validation?.validated)return;if(initial.configured&&!confirm(`Replace the ${domain==='movie'?'movie':'TV'} engine API key? Seerr and every other connected application must be updated with this same key.`))return;setBusy('save');try{const result=await options.request<{settings:EngineSettings}>(`/api/settings/engines/${domain}`,{method:'PUT',body:JSON.stringify(value)});options.onDirtyChange(false);options.notify(`${display(domain)} engine saved. Remember to update connected external applications.`);if(result.settings.configured)options.onConfigured();}catch(reason){options.notify(errorText(reason),'error');}finally{setBusy('');}};
  return <form className="engine-form" onSubmit={event=>void save(event)}>
    <div className="engine-title"><div><span className={`status-indicator ${validation?.validated?'green':validation?'red':'idle'}`}/><h2>{display(domain)}</h2></div><span className="validation-text">{busy==='test'?'Testing…':validation?.validated?'Connection validated':validation?.connection.safeError||'Not tested'}</span></div>
    <div className="form-grid"><label>Internal host<input required value={value.host||''} placeholder={`${domain}-engine`} onChange={event=>update('host',event.target.value)}/></label><label>Port<input required type="number" min="1" max="65535" value={value.port||''} onChange={event=>update('port',Number(event.target.value))}/></label></div>
    <div className="form-grid compact-fields"><label className="check"><input type="checkbox" checked={value.https} onChange={event=>update('https',event.target.checked)}/> HTTPS</label><label className="check"><input type="checkbox" checked={value.tlsVerify!==false} onChange={event=>update('tlsVerify',event.target.checked)}/> Verify TLS</label></div>
    <label>URL base<input value={value.urlBase||''} placeholder="Optional" onChange={event=>update('urlBase',event.target.value)}/></label>
    <label>API key<input required type="password" autoComplete="off" value={value.apiCredential} placeholder={initial.configured?'Replace configured credential':'Required'} onChange={event=>update('apiCredential',event.target.value)}/></label>
    {initial.configured?<div className="notice credential-dependency-warning"><strong>Changing this key affects external applications.</strong><p>Update Seerr and every other application connected to this engine with the same new API key immediately after saving.</p></div>:null}
    <div className="form-actions"><button className="secondary" type="button" disabled={Boolean(busy)} onClick={()=>void test()}>{busy==='test'?'Testing…':'Test connection'}</button><button className="primary" type="submit" disabled={!validation?.validated||Boolean(busy)}>{busy==='save'?'Saving…':`Save ${display(domain)}`}</button></div>
    {validation?.counts?<div className="capability-results"><div className="validation-grid">{Object.entries(validation.counts).map(([name,count])=><span key={name}><strong>{count}</strong>{name}</span>)}</div><p>Version compatible · {validation.connection.latencyMs||0} ms</p></div>:null}
  </form>;
}

export function EngineManagementView({options}:{options:EngineManagementMountOptions}){
  const [system,setSystem]=useState<EngineSystem|null>(null),[settings,setSettings]=useState<EngineSettings|null>(null),[authentication,setAuthentication]=useState<EngineAuthenticationSettings|null>(null),[loading,setLoading]=useState(true),[repairing,setRepairing]=useState(false),[error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{const [systemValue,settingsValue,authenticationValue]=await Promise.all([options.request<EngineSystem>('/api/system/engines'),options.request<EngineSettings>('/api/settings/engines'),options.request<EngineAuthenticationSettings>('/api/settings/engines/authentication')]);setSystem(systemValue);setSettings(settingsValue);setAuthentication(authenticationValue);}catch(reason){setError(errorText(reason));}finally{setLoading(false);}},[options]);
  useEffect(()=>{void load();},[load]);
  const repair=async()=>{setRepairing(true);try{await options.request('/api/settings/engines/repair',{method:'POST',body:'{}'});options.notify('Automatic engine connections repaired.');await load();}catch(reason){options.notify(errorText(reason),'error');}finally{setRepairing(false);}};
  if(loading)return <div className="panel skeleton react-route-loading">Loading engine management…</div>;
  if(error||!system||!settings||!authentication)return <div className="empty error-state"><h2>Engine management unavailable</h2><p>{error||'Engine settings could not be loaded.'}</p><button className="secondary" onClick={()=>void load()}>Try again</button></div>;
  return <div className="react-engine-management">
    <div className="hero"><div><span className="eyebrow">ENGINE MANAGEMENT</span><h1>Media engines</h1><p className="lede">{system.managed?'Installed engines are connected and maintained automatically.':'Review connections for separately managed engines.'}</p></div>{system.managed?<button className="secondary" disabled={repairing} onClick={()=>void repair()}>{repairing?'Repairing…':'Repair automatic connections'}</button>:null}</div>
    <AccountTabs active="engines" administrator/>
    <div className="engine-status-grid">{system.engines.map(engine=><EngineCard engine={engine} key={engine.domain}/>)}</div>
    <section className="panel integration-access"><h2>External application access</h2><p className="muted">Connect Seerr and similar applications to this VynodeArr host on port <strong>8686</strong>. Use URL Base <code>/movies</code> for movies and <code>/tv</code> for television.</p>{system.engines.map(engine=><IntegrationKey engine={engine} managed={system.managed} options={options} key={engine.domain}/>)}</section>
    <AuthenticationControls value={authentication} options={options} onChange={setAuthentication}/>
    {system.managed?<div className="notice managed-engine-notice"><strong>Engine keys are created once during installation.</strong><p>VynodeArr does not rotate them during restarts or updates. External applications such as Seerr must use the matching movie or TV engine key and must be updated after any manual key change.</p></div>:null}
    <details className="external-engine-settings"><summary><span><strong>Advanced: external engines</strong><small>Only use this when connecting engines maintained outside this installation.</small></span></summary><div className="engine-wizard"><ExternalEngineForm domain="movie" initial={settings.movie} options={options}/><ExternalEngineForm domain="tv" initial={settings.tv} options={options}/></div></details>
  </div>;
}
