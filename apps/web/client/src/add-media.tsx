import { useState } from 'react';
import type { AddMediaDestination,AddMediaDomain,AddMediaMountOptions,AddMediaProfile,AddMediaResult,AddMediaRoot } from './add-media-types';

interface SearchData {items:AddMediaResult[];profiles:AddMediaProfile[];roots:AddMediaRoot[];destinations:AddMediaDestination[]}
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'VynodeArr could not complete this request.';

function AddResult({item,index,domain,profiles,roots,destinations,options}:{item:AddMediaResult;index:number;domain:AddMediaDomain;profiles:AddMediaProfile[];roots:AddMediaRoot[];destinations:AddMediaDestination[];options:AddMediaMountOptions}){
  const initial=destinations.find(value=>value.isDefault&&value.ready)||destinations.find(value=>value.ready);
  const [destinationId,setDestinationId]=useState(initial?.id||''),[minimumAvailability,setMinimumAvailability]=useState('announced'),[monitor,setMonitor]=useState('all'),[seriesType,setSeriesType]=useState('standard'),[searchNow,setSearchNow]=useState(true),[adding,setAdding]=useState(false);
  const destination=destinations.find(value=>value.id===destinationId),rootFolderPath=destination?.rootFolderPath||roots[0]?.path||'',qualityProfileId=destination?.qualityProfileId||profiles[0]?.id||0,movie=domain==='movie',poster=item.remotePoster||item.images?.find(image=>image.coverType==='poster')?.remoteUrl;
  async function add(event:React.FormEvent){
    event.preventDefault();if(adding)return;setAdding(true);
    const payload={...item,mediaDestinationId:destinationId||undefined,rootFolderPath,qualityProfileId,monitored:movie||monitor!=='none',addOptions:movie?{searchForMovie:searchNow}:{monitor,searchForMissingEpisodes:searchNow,searchForCutoffUnmetEpisodes:false},...(movie?{minimumAvailability}:{monitor,seriesType,seasonFolder:true})};
    try{await options.request(`/api/manage/${domain}/library`,{method:'POST',body:JSON.stringify(payload)});options.notify(`${item.title} added to ${destination?.name||'your library'}.`);options.onAdded(domain);}catch(error){options.notify(errorMessage(error),'error');setAdding(false);}
  }
  return <article className="discovery-card" data-result-index={index}>
    <div className="discovery-art">{poster?<img src={poster} alt={`${item.title} poster`} loading="lazy" referrerPolicy="no-referrer"/>:<span className="art-fallback">{movie?'M':'TV'}</span>}</div>
    <div className="discovery-copy"><span className="eyebrow">{movie?'MOVIE':'TELEVISION'}</span><h2>{item.title} {item.year?<small>{item.year}</small>:null}</h2><p>{item.overview||'No overview available.'}</p></div>
    <form onSubmit={event=>void add(event)}>
      {destinations.length>1?<label>Add to<select value={destinationId} onChange={event=>setDestinationId(event.target.value)}>{destinations.map(value=><option key={value.id} value={value.id} disabled={!value.ready}>{value.name}{value.ready?'':' — unavailable'}</option>)}</select></label>:null}
      {destination?<p className="destination-summary"><strong>{destination.name}</strong><span>{destination.rootFolderPath} · {destination.qualityProfile?.name||'Profile unavailable'}{destination.plexLibrary?.title?` · Plex: ${destination.plexLibrary.title}`:''}</span></p>:null}
      {!destination?(movie?<label>Availability<select value={minimumAvailability} onChange={event=>setMinimumAvailability(event.target.value)}><option value="announced">Announced</option><option value="inCinemas">In cinemas</option><option value="released">Released</option></select></label>:<><label>Monitor<select value={monitor} onChange={event=>setMonitor(event.target.value)}><option value="all">All episodes</option><option value="future">Future episodes</option><option value="missing">Missing episodes</option><option value="none">None</option></select></label><label>Series type<select value={seriesType} onChange={event=>setSeriesType(event.target.value)}><option value="standard">Standard</option><option value="daily">Daily</option><option value="anime">Anime</option></select></label></>):null}
      <label className="check"><input type="checkbox" checked={searchNow} onChange={event=>setSearchNow(event.target.checked)}/> Search for available releases now</label>
      <button className="primary" type="submit" disabled={adding||!rootFolderPath||!qualityProfileId||Boolean(destinations.length&&!destination?.ready)}>{adding?'Adding…':'Add to library'}</button>
      {!roots.length?<p className="form-error">Add a root folder in Service Settings first.</p>:null}
      {!profiles.length?<p className="form-error">Add a quality profile in Service Settings first.</p>:null}
    </form>
  </article>;
}

export function AddMediaView({options}:{options:AddMediaMountOptions}){
  const [domain,setDomain]=useState<AddMediaDomain>('movie'),[term,setTerm]=useState(''),[data,setData]=useState<SearchData|null>(null),[searching,setSearching]=useState(false),[error,setError]=useState('');
  async function search(event?:React.FormEvent){
    event?.preventDefault();const query=term.trim();if(!query||searching)return;setSearching(true);setError('');setData(null);
    try{const [lookup,profiles,roots,destinationValue]=await Promise.all([
      options.request<{result:AddMediaResult[]}>(`/api/manage/${domain}/lookup?term=${encodeURIComponent(query)}`),
      options.request<{result:AddMediaProfile[]}>(`/api/manage/${domain}/profiles`),
      options.request<{result:AddMediaRoot[]}>(`/api/manage/${domain}/rootFolders`),
      options.request<{destinations:AddMediaDestination[]}>(`/api/media-destinations?domain=${domain}`),
    ]);setData({items:lookup.result||[],profiles:profiles.result||[],roots:roots.result||[],destinations:destinationValue.destinations||[]});}catch(error){setError(errorMessage(error));}finally{setSearching(false);}
  }
  function changeDomain(value:AddMediaDomain){setDomain(value);setData(null);setError('');}
  return <div className="react-add-media">
    <div className="hero"><div><span className="eyebrow">DISCOVER</span><h1>Add Media</h1><p className="lede">Choose a destination and VynodeArr applies its folder, quality profile, and library defaults.</p></div></div>
    <form className="management-toolbar" onSubmit={event=>void search(event)}>
      <label>Media type<select value={domain} onChange={event=>changeDomain(event.target.value as AddMediaDomain)}><option value="movie">Movie</option><option value="tv">Television</option></select></label>
      <label className="grow">Title or external ID<input value={term} onChange={event=>setTerm(event.target.value)} placeholder="Search by title"/></label>
      <button className="primary" type="submit" disabled={searching||!term.trim()}>{searching?'Searching…':'Search'}</button>
    </form>
    <div className="discovery-grid">{searching?<div className="panel skeleton">Searching…</div>:error?<div className="empty error-state"><h2>Search unavailable</h2><p>{error}</p></div>:data?data.items.length?data.items.slice(0,30).map((item,index)=><AddResult key={`${domain}-${String(item.title)}-${item.year||index}`} item={item} index={index} domain={domain} profiles={data.profiles} roots={data.roots} destinations={data.destinations} options={options}/>):<div className="empty"><h2>No matches</h2><p>Try another title or an external database ID.</p></div>:<div className="empty"><h2>Find something new</h2><p>Results come directly from the connected metadata services.</p></div>}</div>
  </div>;
}
