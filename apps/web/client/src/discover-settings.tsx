import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {ServiceTabs} from './service-tabs';
import type {DiscoverSettingsMountOptions,DiscoverSettingsStatus} from './discover-settings-types';

const message=(reason:unknown)=>reason instanceof Error?reason.message:'Discover settings are unavailable.';

export function DiscoverSettingsView({options}:{options:DiscoverSettingsMountOptions}){
  const [status,setStatus]=useState<DiscoverSettingsStatus|null>(null),[token,setToken]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('');
  const load=useCallback(async()=>{setError('');try{setStatus(await options.request<DiscoverSettingsStatus>('/api/settings/discover'));}catch(reason){setError(message(reason));}},[options]);
  useEffect(()=>{void load();},[load]);
  const change=(value:string)=>{setToken(value);options.onDirtyChange(Boolean(value.trim()));};
  const test=async()=>{if(!token.trim())return options.notify('Paste a TMDB read access token first.','error');setBusy('test');try{await options.request('/api/settings/discover/test',{method:'POST',body:JSON.stringify({token:token.trim()})});options.notify('TMDB connection successful.');}catch(reason){options.notify(message(reason),'error');}finally{setBusy('');}};
  const save=async(event:FormEvent)=>{event.preventDefault();if(!token.trim())return;setBusy('save');try{setStatus(await options.request<DiscoverSettingsStatus>('/api/settings/discover',{method:'POST',body:JSON.stringify({token:token.trim()})}));setToken('');options.onDirtyChange(false);options.notify('Discover connection saved.');}catch(reason){options.notify(message(reason),'error');}finally{setBusy('');}};
  const remove=async()=>{if(!confirm('Remove the saved TMDB token and disable Discover?'))return;setBusy('remove');try{setStatus(await options.request<DiscoverSettingsStatus>('/api/settings/discover',{method:'DELETE'}));setToken('');options.onDirtyChange(false);options.notify('Discover connection removed.');}catch(reason){options.notify(message(reason),'error');}finally{setBusy('');}};
  return <div className="discover-settings-route">
    <div className="hero"><div><span className="eyebrow">SERVICE SETTINGS</span><h1>Discover</h1><p className="lede">Connect your own TMDB account for live discovery metadata.</p></div></div>
    <ServiceTabs active="discover"/>
    <section className="panel discover-settings-panel">
      <div className="panel-heading"><div><h2>TMDB metadata</h2><p className="muted">The read access token is encrypted in VynodeArr&apos;s credential vault and is never displayed again.</p></div><span className={`badge${status?.configured?' green':''}`}>{error?'Unavailable':status?status.configured?'Configured':'Not configured':'Checking…'}</span></div>
      {error?<div className="notice error-state"><strong>Discover status unavailable</strong><p>{error}</p><button className="secondary" onClick={()=>void load()}>Try again</button></div>:null}
      <form onSubmit={event=>void save(event)}>
        <label>TMDB API read access token<input required type="password" autoComplete="new-password" value={token} placeholder="Paste your TMDB API v4 read access token" onChange={event=>change(event.target.value)}/><small className="field-help">Create a token in your TMDB account under Settings → API. Environment and Unraid variables can bootstrap this value, but you can replace it here later.</small></label>
        <div className="form-actions"><button className="secondary" type="button" disabled={Boolean(busy)} onClick={()=>void test()}>{busy==='test'?'Testing…':'Test token'}</button><button className="primary" type="submit" disabled={!token.trim()||Boolean(busy)}>{busy==='save'?'Saving…':'Save token'}</button><button className="danger" type="button" disabled={!status?.configured||Boolean(busy)} onClick={()=>void remove()}>{busy==='remove'?'Removing…':'Remove token'}</button></div>
      </form>
      <div className="notice"><strong>Container configuration is optional</strong><p>Set <code>TMDB_API_READ_TOKEN</code> during installation for automatic first-run setup, or leave it empty and configure Discover here after signing in.</p></div>
    </section>
  </div>;
}
