import {useEffect,useRef,useState} from 'react';
import './detail-hero-trailer.css';

type DetailHeroTrailerProps={artwork?:string;title:string;source:string;fallbackTrailer?:{name?:string;url:string}|null};

export function DetailHeroTrailer({artwork,title,source,fallbackTrailer}:DetailHeroTrailerProps){
  const video=useRef<HTMLVideoElement|null>(null),[enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[muted,setMuted]=useState(true),[failed,setFailed]=useState(false);
  useEffect(()=>{
    const connection=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection;
    if(connection?.saveData||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timer=window.setTimeout(()=>setEnabled(true),900);return()=>window.clearTimeout(timer);
  },[source]);
  useEffect(()=>()=>{video.current?.pause();if(video.current)video.current.removeAttribute('src');},[]);
  const togglePlayback=()=>{const player=video.current;if(!player)return;if(player.paused)void player.play();else player.pause();};
  const toggleSound=()=>{const player=video.current;if(!player)return;player.muted=!player.muted;setMuted(player.muted);if(player.paused)void player.play();};
  return <div className={`detail-backdrop${ready&&!failed?' trailer-ready':''}`}>
    {artwork?<img src={artwork} alt="" aria-hidden="true"/>:null}
    {enabled&&!failed?<video ref={video} src={source} muted autoPlay playsInline preload="metadata" aria-label={`${title} trailer`} onLoadedData={()=>setReady(true)} onCanPlay={()=>setReady(true)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>{setFailed(true);setReady(false);}}/>:null}
    {ready&&!failed?<div className="detail-trailer-controls" aria-label="Trailer controls"><button type="button" className="secondary" onClick={togglePlayback}>{playing?'Pause trailer':'Play trailer'}</button><button type="button" className="secondary" onClick={toggleSound}>{muted?'Turn sound on':'Mute trailer'}</button></div>:fallbackTrailer?<a className="detail-trailer-fallback secondary" href={fallbackTrailer.url} target="_blank" rel="noreferrer">Watch {fallbackTrailer.name||'official trailer'} ↗</a>:null}
  </div>;
}
