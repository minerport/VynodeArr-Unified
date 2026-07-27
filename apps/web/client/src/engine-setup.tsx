import {useCallback,useEffect,useState} from 'react';
import {ExternalEngineForm} from './engine-management';
import type {EngineSettings} from './engine-management-types';
import type {EngineSetupMountOptions} from './engine-setup-types';

const message=(reason:unknown)=>reason instanceof Error?reason.message:'Engine setup is unavailable.';

export function EngineSetupView({options}:{options:EngineSetupMountOptions}){
 const [settings,setSettings]=useState<EngineSettings|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{setError('');try{setSettings(await options.request<EngineSettings>('/api/settings/engines'));}catch(reason){setError(message(reason));}},[options]);
 useEffect(()=>{void load();},[load]);
 if(error)return <div className="empty error-state"><h2>Engine setup unavailable</h2><p>{error}</p><button className="secondary" onClick={()=>void load()}>Try again</button></div>;
 if(!settings)return <div className="panel skeleton react-route-loading">Loading engine setup…</div>;
 return <div className="react-engine-setup">
  <div className="hero"><div><span className="eyebrow">SETUP · STEP 2 OF 2</span><h1>Connect your engines</h1><p className="lede">VynodeArr validates access before saving encrypted credentials.</p></div></div>
  <div className="engine-wizard"><ExternalEngineForm domain="movie" initial={settings.movie} options={options}/><ExternalEngineForm domain="tv" initial={settings.tv} options={options}/></div>
  <div className="wizard-footer"><button className="text-button" onClick={()=>{options.onDirtyChange(false);options.notify('Engine setup skipped. Review data remains available.','info');options.onSkip();}}>Skip for now and use review data</button><span>Both engines are required to complete connection setup.</span></div>
 </div>;
}
