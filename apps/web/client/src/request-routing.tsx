export type RequestRouteDomain='movie'|'tv';
export type RequestRouteEngine={id:string;name:string;isDefault?:boolean};
export type RequestRouteDestination={
  id:string;name:string;rootFolderPath:string;qualityProfile?:{name?:string}|null;
  plexLibrary?:{title?:string}|null;engineInstanceName?:string|null;
};

const routeKey=(domain:RequestRouteDomain,part:'engine'|'destination')=>`vynodearr:request-route:${domain}:${part}`;
export const implicitEngineName=(domain:RequestRouteDomain)=>domain==='movie'?'VynodeArr Movies':'VynodeArr Television';
export const rememberedRoute=(domain:RequestRouteDomain,part:'engine'|'destination')=>{try{return localStorage.getItem(routeKey(domain,part))||'';}catch{return'';}};
export const rememberRoute=(domain:RequestRouteDomain,part:'engine'|'destination',value:string)=>{try{if(value)localStorage.setItem(routeKey(domain,part),value);else localStorage.removeItem(routeKey(domain,part));}catch{/* Storage is optional. */}};

export function RequestEngineField({domain,engines,value,onChange}:{domain:RequestRouteDomain;engines:RequestRouteEngine[];value:string;onChange:(value:string)=>void}){
  const selected=engines.find(engine=>engine.id===value)||engines.find(engine=>engine.isDefault)||engines[0];
  if(engines.length>1)return <label>Media engine<select required value={value} onChange={event=>onChange(event.target.value)}>{engines.map(engine=><option value={engine.id} key={engine.id}>{engine.name}{engine.isDefault?' — default':''}</option>)}</select><small>This instance receives the request and supplies its own folders and profiles.</small></label>;
  return <div className="request-engine-field"><small>Media engine</small><strong>{selected?.name||implicitEngineName(domain)}</strong><span>{selected?'Only one configured instance is available.':'The installation-managed default engine receives this request.'}</span></div>;
}

export function RequestRoutingSummary({domain,engine,destination}:{domain:RequestRouteDomain;engine?:RequestRouteEngine|null;destination?:RequestRouteDestination|null}){
  const engineName=destination?.engineInstanceName||engine?.name||implicitEngineName(domain);
  return <section className="request-routing-summary" aria-label="Request routing summary"><span className="eyebrow">REQUEST ROUTING</span><div><span><small>Engine</small><strong>{engineName}</strong></span><b aria-hidden="true">→</b><span><small>Folder</small><strong>{destination?.rootFolderPath||'Choose a destination'}</strong></span><b aria-hidden="true">→</b><span><small>Quality</small><strong>{destination?.qualityProfile?.name||'Choose a profile'}</strong></span>{destination?.plexLibrary?.title?<><b aria-hidden="true">→</b><span><small>Plex library</small><strong>{destination.plexLibrary.title}</strong></span></>:null}</div></section>;
}
