import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import type {DiscoverDomain,DiscoverItem,DiscoverMountOptions} from './discover-types';

type EngineImage={coverType?:string;remoteUrl?:string;url?:string};
type EngineMatch=Record<string,unknown>&{
  title?:string;year?:number;overview?:string;remotePoster?:string;images?:EngineImage[];
  tmdbId?:number;tvdbId?:number;
};
type EngineProfile={id:number;name:string};
type EngineRoot={path:string};
type ImportOptions={match:EngineMatch|null;identity:{tmdbId:number;tvdbId:number|null};profiles:EngineProfile[];roots:EngineRoot[]};
const posterFor=(source:EngineMatch,item:DiscoverItem)=>
  source.remotePoster
  ||source.images?.find(value=>String(value.coverType||'').toLowerCase()==='poster')?.remoteUrl
  ||source.images?.find(value=>String(value.coverType||'').toLowerCase()==='poster')?.url
  ||item.poster;

export function DiscoverRequest({item,options,onClose,onRequested}:{item:DiscoverItem;options:DiscoverMountOptions;onClose:()=>void;onRequested:(item:DiscoverItem)=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [resolvedItem,setResolvedItem]=useState(item);
  const [data,setData]=useState<ImportOptions|null>(null);
  const [error,setError]=useState('');
  const [correcting,setCorrecting]=useState(false);
  const [matchQuery,setMatchQuery]=useState(item.title);
  const [candidates,setCandidates]=useState<DiscoverItem[]>([]);
  const [searching,setSearching]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [rootFolderPath,setRootFolderPath]=useState('');
  const [qualityProfileId,setQualityProfileId]=useState(0);
  const [minimumAvailability,setMinimumAvailability]=useState('announced');
  const [monitor,setMonitor]=useState('all');
  const [seriesType,setSeriesType]=useState('standard');
  const [searchNow,setSearchNow]=useState(true);
  const source=useMemo(()=>data?.match||undefined,[data]);

  useEffect(()=>{
    dialog.current?.showModal();
    let active=true;
    setData(null);setError('');
    void options.request<ImportOptions>(`/api/discover/import-options?domain=${resolvedItem.domain}&tmdbId=${resolvedItem.tmdbId}`)
      .then(value=>{
        if(!active)return;
        setData(value);
        setRootFolderPath(value.roots[0]?.path||'');
        setQualityProfileId(Number(value.profiles[0]?.id||0));
        if(!value.match)setError(`The ${resolvedItem.domain==='movie'?'movie':'TV'} engine could not resolve the exact external ID for this title. Nothing was added.`);
      })
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Title options could not be loaded.');});
    return()=>{active=false;};
  },[resolvedItem,options]);

  const close=()=>dialog.current?.close();
  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(!source||!rootFolderPath||!qualityProfileId)return;
    const movie=resolvedItem.domain==='movie';
    const payload={
      ...source,
      rootFolderPath,
      qualityProfileId,
      monitored:movie||monitor!=='none',
      addOptions:movie?{searchForMovie:searchNow}:{searchForMissingEpisodes:searchNow},
      ...(movie?{minimumAvailability}:{monitor,seriesType,seasonFolder:true}),
    };
    setSubmitting(true);
    try{
      await options.request('/api/discover/request',{method:'POST',body:JSON.stringify({domain:resolvedItem.domain,tmdbId:resolvedItem.tmdbId,payload})});
      options.notify(`${source.title||resolvedItem.title} requested and sent to the ${movie?'movie':'TV'} engine.`);
      onRequested(resolvedItem);
      close();
    }catch(reason){
      setSubmitting(false);
      options.notify(reason instanceof Error?reason.message:'The title could not be requested.','error');
    }
  };
  const findMatches=async()=>{
    if(!matchQuery.trim())return;
    setSearching(true);
    try{
      const value=await options.request<{results:DiscoverItem[]}>(`/api/discover/browse?domain=movie&query=${encodeURIComponent(matchQuery.trim())}&page=1`);
      setCandidates((value.results||[]).filter(candidate=>candidate.domain==='movie').slice(0,12));
    }catch(reason){
      options.notify(reason instanceof Error?reason.message:'Movie matches could not be loaded.','error');
    }finally{setSearching(false);}
  };
  const chooseCandidate=(candidate:DiscoverItem)=>{
    setResolvedItem(candidate);
    setMatchQuery(candidate.title);
    setCorrecting(false);
    setCandidates([]);
  };

  const ready=Boolean(source&&rootFolderPath&&qualityProfileId);
  const domainLabel=resolvedItem.domain==='movie'?'movie':'series';
  return createPortal(<dialog ref={dialog} className="discover-add-dialog" onClose={onClose} onCancel={event=>{event.preventDefault();close();}}>
    {!data&&!error?<div className="discover-add-loading"><div className="skeleton"/><h2>Finding the engine match…</h2><p>Loading library folders and quality profiles.</p></div>:null}
    {error&&!correcting?<div className="empty error-state"><h2>Title could not be added</h2><p>{error}</p><div className="form-actions"><button className="secondary" type="button" onClick={close}>Close</button>{resolvedItem.domain==='movie'?<button className="primary" type="button" onClick={()=>{setCorrecting(true);void findMatches();}}>Fix movie match</button>:<a className="primary button-link" href="#service/root-folders" onClick={close}>Review engine settings</a>}</div></div>:null}
    {correcting?<section className="match-browser discover-request-match"><div className="panel-heading"><div><span className="eyebrow">CORRECT MOVIE MATCH</span><h2>Choose the intended movie</h2><p className="muted">The selected TMDB ID will replace the current request match.</p></div><button className="secondary" type="button" onClick={()=>setCorrecting(false)}>Back</button></div><div className="match-search"><input value={matchQuery} onChange={event=>setMatchQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void findMatches();}}} aria-label="Search TMDB movies"/><button className="primary" type="button" disabled={searching} onClick={()=>void findMatches()}>{searching?'Searching…':'Search movies'}</button></div><div className="match-results">{!searching&&!candidates.length?<div className="empty compact"><p>Search by movie title, then choose the correct year and TMDB ID.</p></div>:candidates.map(candidate=><article className="match-result" key={candidate.tmdbId}>{candidate.poster?<img src={candidate.poster} alt="" loading="lazy"/>:<span className="art-fallback">TMDB</span>}<div><h3>{candidate.title} {candidate.year?<small>{candidate.year}</small>:null}</h3><p>{candidate.overview||'No overview available.'}</p><small>TMDB {candidate.tmdbId}</small></div><button className="secondary" type="button" onClick={()=>chooseCandidate(candidate)}>Use this ID</button></article>)}</div></section>:null}
    {data&&source&&!error&&!correcting?<form className="discover-add-form" onSubmit={submit}>
      <div className="discover-add-heading">{posterFor(source,resolvedItem)?<img src={posterFor(source,resolvedItem)||''} alt=""/>:<span className="discover-poster-fallback">?</span>}<div><span className="eyebrow">{resolvedItem.domain==='movie'?'MOVIE ENGINE':'TV ENGINE'} ID MATCH</span><h2>Request {source.title||resolvedItem.title}</h2><p>{String(source.overview||resolvedItem.overview||'')}</p><div className="discover-meta"><span>{Number(source.year||resolvedItem.year)||'TBA'}</span><span>TMDB {data.identity.tmdbId}</span>{data.identity.tvdbId?<span>TVDB {data.identity.tvdbId}</span>:null}</div>{resolvedItem.domain==='movie'?<button className="secondary" type="button" onClick={()=>{setCorrecting(true);void findMatches();}}>Fix movie match</button>:null}</div></div>
      <div className="discover-add-fields">
        <label>Library folder<select required value={rootFolderPath} onChange={event=>setRootFolderPath(event.target.value)}>{data.roots.map(root=><option value={root.path} key={root.path}>{root.path}</option>)}</select></label>
        <label>Quality profile<select required value={qualityProfileId} onChange={event=>setQualityProfileId(Number(event.target.value))}>{data.profiles.map(profile=><option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></label>
        {resolvedItem.domain==='movie'?<label>Availability<select value={minimumAvailability} onChange={event=>setMinimumAvailability(event.target.value)}><option value="announced">Announced</option><option value="inCinemas">In cinemas</option><option value="released">Released</option></select></label>:<>
          <label>Monitor<select value={monitor} onChange={event=>setMonitor(event.target.value)}><option value="all">All episodes</option><option value="future">Future episodes</option><option value="missing">Missing episodes</option><option value="none">None</option></select></label>
          <label>Series type<select value={seriesType} onChange={event=>setSeriesType(event.target.value)}><option value="standard">Standard</option><option value="daily">Daily</option><option value="anime">Anime</option></select></label>
        </>}
        <label className="check"><input type="checkbox" checked={searchNow} onChange={event=>setSearchNow(event.target.checked)}/> Search for available releases immediately</label>
      </div>
      {!data.roots.length?<p className="form-error">Add a root folder in Service Settings before requesting this title.</p>:null}
      {!data.profiles.length?<p className="form-error">Add a quality profile in Service Settings before requesting this title.</p>:null}
      <div className="form-actions"><button className="secondary" type="button" onClick={close}>Cancel</button><button className="primary" type="submit" disabled={!ready||submitting}>{submitting?'Requesting…':`Request ${domainLabel}`}</button></div>
    </form>:null}
  </dialog>,document.body);
}
