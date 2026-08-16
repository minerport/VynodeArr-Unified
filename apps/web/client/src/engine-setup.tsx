import {useCallback,useEffect,useState} from 'react';
import {ExternalEngineForm} from './engine-management';
import {RouteError,RouteLoading} from './react-route-state';
import type {EngineSettings} from './engine-management-types';
import type {EngineSetupMountOptions} from './engine-setup-types';
import {errorMessage} from './shell-utils';

const message=(reason:unknown)=>errorMessage(reason,'Engine setup is unavailable.');

export function EngineSetupView({options}:{options:EngineSetupMountOptions}){
 const [settings,setSettings]=useState<EngineSettings|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{setError('');try{setSettings(await options.request<EngineSettings>('/api/settings/engines'));}catch(reason){setError(message(reason));}},[options]);
 useEffect(()=>{void load();},[load]);
 if(error)return <RouteError title="Engine setup unavailable" message={error} onRetry={()=>void load()}/>;
 if(!settings)return <RouteLoading route>Loading engine setup…</RouteLoading>;
 return <div className="react-engine-setup">
  <div className="hero"><div><span className="eyebrow">SETUP · STEP 2 OF 2</span><h1>Connect your engines</h1><p className="lede">VynodeArr validates access before saving encrypted credentials.</p></div></div>
  <div className="engine-wizard"><ExternalEngineForm domain="movie" initial={settings.movie} options={options}/><ExternalEngineForm domain="tv" initial={settings.tv} options={options}/></div>
  <div className="wizard-footer"><button className="text-button" onClick={()=>{options.onDirtyChange(false);options.notify('Engine setup skipped. Review data remains available.','info');options.onSkip();}}>Skip for now and use review data</button><span>Both engines are required to complete connection setup.</span></div>
 </div>;
}
