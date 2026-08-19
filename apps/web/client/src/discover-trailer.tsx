import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {DiscoverItem,DiscoverMountOptions} from './discover-types';
import {errorMessage} from './shell-utils';
import './discover-trailer.css';

const youtubeEmbed=(value?:string)=>{try{const url=new URL(String(value||'')),host=url.hostname.toLowerCase(),id=host==='youtu.be'?url.pathname.slice(1):host.endsWith('youtube.com')?url.searchParams.get('v'):'';return id&&/^[A-Za-z0-9_-]{6,20}$/.test(id)?`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=0&playsinline=1&controls=1&rel=0`:'';}catch{return '';}};

export function DiscoverTrailer({item,options,onClose}:{item:DiscoverItem;options:DiscoverMountOptions;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),[trailer,setTrailer]=useState<{name?:string;url:string}|null>(item.trailer||null),[loading,setLoading]=useState(!item.trailer),[error,setError]=useState('');
  const source=useMemo(()=>youtubeEmbed(trailer?.url),[trailer]);
  useEffect(()=>{
    dialog.current?.showModal();
    if(item.trailer)return;
    let active=true;
    void options.request<{item:DiscoverItem}>(`/api/discover/details/${item.domain}/${item.tmdbId}`).then(value=>{
      if(!active)return;
      if(value.item?.trailer?.url)setTrailer(value.item.trailer);
      else setError(`No trailer is currently listed for ${item.title}.`);
    }).catch(reason=>{if(active)setError(errorMessage(reason,'Trailer unavailable.'));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[item,options]);
  const close=()=>dialog.current?.close();
  return createPortal(<dialog ref={dialog} className="discover-trailer-dialog" aria-label={`${item.title} trailer`} onClose={onClose} onCancel={event=>{event.preventDefault();close();}}>
    <header><div><span className="eyebrow">TRAILER</span><h2>{trailer?.name||item.title}</h2></div><button className="icon-button" type="button" aria-label="Close trailer" onClick={close}>×</button></header>
    <div className="discover-trailer-stage">
      {loading?<div className="discover-trailer-message"><span className="spinner"/><p>Loading trailer…</p></div>:null}
      {error?<div className="discover-trailer-message"><p>{error}</p></div>:null}
      {source?<iframe src={source} title={`${item.title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>:null}
    </div>
    <footer><span>Playback opens with sound enabled. Use the player controls to adjust volume or enter fullscreen.</span><button className="secondary" type="button" onClick={close}>Close</button></footer>
  </dialog>,document.body);
}
