import {useEffect,useRef,useState} from 'react';
import './detail-hero-trailer.css';

type DetailHeroTrailerProps={artwork?:string;title:string;source:string;fallbackTrailer?:{name?:string;url:string}|null};

const youtubeEmbed=(value?:string)=>{try{const url=new URL(String(value||''));const host=url.hostname.toLowerCase();const id=host==='youtu.be'?url.pathname.slice(1):host.endsWith('youtube.com')?url.searchParams.get('v'):'';return id&&/^[A-Za-z0-9_-]{6,20}$/.test(id)?`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0`:'';}catch{return '';}};

export function DetailHeroTrailer({artwork,title,source,fallbackTrailer}:DetailHeroTrailerProps){
  const video=useRef<HTMLVideoElement|null>(null),[enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[muted,setMuted]=useState(true),[failed,setFailed]=useState(false);
  const remoteTrailer=youtubeEmbed(fallbackTrailer?.url);
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
    {enabled&&failed&&remoteTrailer?<iframe src={remoteTrailer} title={`${title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>:null}
    {ready&&!failed?<div className="detail-trailer-controls" aria-label="Trailer controls"><button type="button" className="secondary" onClick={togglePlayback}>{playing?'Pause trailer':'Play trailer'}</button><button type="button" className="secondary" onClick={toggleSound}>{muted?'Turn sound on':'Mute trailer'}</button></div>:null}
  </div>;
}
