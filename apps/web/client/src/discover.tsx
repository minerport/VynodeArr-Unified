import { useCallback,useEffect,useMemo,useRef,useState,type CSSProperties } from 'react';
import type { DiscoverCategory,DiscoverDomain,DiscoverItem,DiscoverMountOptions,DiscoverPage,LibraryItem } from './discover-types';
import { cachedRequest } from './query-client';

const feeds=[
  ['trending','Trending now','Movies and series people are watching today'],
  ['popular_movies','Popular movies','Popular films across every genre'],
  ['upcoming_movies','Upcoming movies','Films arriving soon'],
  ['popular_tv','Popular television','Series worth settling in for'],
  ['upcoming_tv','Upcoming television','Series currently airing'],
] as const;
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'').trim();
const libraryKey=(domain:DiscoverDomain,title:string,year?:number|null)=>`${domain}:${normalize(title)}:${Number(year||0)}`;

function Card({item,inLibrary,onOpen}:{item:DiscoverItem;inLibrary:boolean;onOpen:(item:DiscoverItem)=>void}){
  return <article className="discover-card" role="button" tabIndex={0} onClick={()=>onOpen(item)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')onOpen(item);}}>
    <div className="discover-poster">{item.poster?<img src={item.poster} alt={`${item.title} poster`} loading="lazy"/>:<span className="discover-poster-fallback">{item.title[0]}</span>}
      {item.rating?<span className="discover-score">★ {item.rating.toFixed(1)}</span>:null}
      {inLibrary?<span className="discover-library-tag">In library</span>:null}
      <button className={`discover-action${inLibrary?' is-library':''}`} type="button" disabled={inLibrary} onClick={event=>{event.stopPropagation();onOpen(item);}}>{inLibrary?'✓':'+'}</button>
    </div>
    <div className="discover-card-copy"><h3>{item.title}</h3><p><span>{item.year||'TBA'}</span><span>{item.domain==='movie'?'Movie':'TV'}</span></p></div>
  </article>;
}

function Row({title,subtitle,items,library,onOpen,onMore}:{title:string;subtitle:string;items:DiscoverItem[];library:Set<string>;onOpen:(item:DiscoverItem)=>void;onMore?:()=>void}){
  const strip=useRef<HTMLDivElement>(null);
  return <section className="discover-row"><div className="discover-row-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><div className="discover-row-controls">
    <button type="button" onClick={()=>strip.current?.scrollBy({left:-strip.current.clientWidth*.8,behavior:'smooth'})}>←</button>
    <button type="button" onClick={()=>{strip.current?.scrollBy({left:strip.current.clientWidth*.8,behavior:'smooth'});onMore?.();}}>→</button>
  </div></div><div className="discover-strip" ref={strip}>{items.map(item=><Card key={item.id} item={item} inLibrary={library.has(libraryKey(item.domain,item.title,item.year))} onOpen={onOpen}/>)}</div></section>;
}

function Taxonomy({title,kind,items,onSelect}:{title:string;kind:'genre'|'studio'|'network';items:DiscoverCategory[];onSelect:(item:DiscoverCategory&{taxonomy:'genre'|'studio'|'network'})=>void}){
  const strip=useRef<HTMLDivElement>(null);
  if(!items.length)return null;
  return <section className="discover-row discover-taxonomy"><div className="discover-row-heading"><div><h2>{title}</h2></div><div className="discover-row-controls">
    <button onClick={()=>strip.current?.scrollBy({left:-700,behavior:'smooth'})}>←</button><button onClick={()=>strip.current?.scrollBy({left:700,behavior:'smooth'})}>→</button>
  </div></div><div className="discover-taxonomy-grid discover-strip" ref={strip}>{items.map((item,index)=><button key={`${item.domain}-${item.id}`} onClick={()=>onSelect({...item,taxonomy:kind})} style={{'--taxonomy-hue':String((index*47+(kind==='genre'?258:kind==='studio'?188:332))%360),...(item.backdrop?{'--taxonomy-image':`url("${item.backdrop}")`}:{})} as CSSProperties}><span>{kind==='genre'?'◇':kind==='studio'?'◆':'●'}</span><strong>{item.name}</strong><small>Browse all titles</small></button>)}</div></section>;
}

export function DiscoverView({options}:{options:DiscoverMountOptions}){
  const [rows,setRows]=useState<Record<string,DiscoverItem[]>>({});
  const [pages,setPages]=useState<Record<string,number>>({});
  const [library,setLibrary]=useState(new Set<string>());
  const [taxonomies,setTaxonomies]=useState<{movie:DiscoverCategory[];tv:DiscoverCategory[];studios:DiscoverCategory[];networks:DiscoverCategory[]}>({movie:[],tv:[],studios:[],networks:[]});
  const [domain,setDomain]=useState<'all'|DiscoverDomain>('all');
  const [query,setQuery]=useState('');
  const [searchResults,setSearchResults]=useState<DiscoverItem[]|null>(null);
  const [resultTitle,setResultTitle]=useState('');
  const [error,setError]=useState('');

  const loadFeed=useCallback(async(kind:string,page=1)=>{
    const value=await cachedRequest(`discover:feed:${kind}:${page}`,()=>options.request<DiscoverPage>(`/api/discover/feed?kind=${kind}&page=${page}`),90_000);
    setRows(current=>({...current,[kind]:page===1?value.results:[...(current[kind]||[]),...value.results.filter(item=>!(current[kind]||[]).some(existing=>existing.id===item.id))]}));
    setPages(current=>({...current,[kind]:value.page}));
  },[options]);

  useEffect(()=>{
    let active=true;
    void Promise.all([options.request<{items:LibraryItem[]}>('/api/media/movies'),options.request<{items:LibraryItem[]}>('/api/media/tv')]).then(([movies,tv])=>{
      if(active)setLibrary(new Set([...movies.items.map(item=>libraryKey('movie',item.title,item.year)),...tv.items.map(item=>libraryKey('tv',item.title,item.year))]));
    }).catch(()=>{});
    feeds.forEach(([kind])=>void loadFeed(kind).catch(reason=>setError(reason instanceof Error?reason.message:'Discover unavailable.')));
    void Promise.all([
      cachedRequest('discover:genres:movie',()=>options.request<{items:DiscoverCategory[]}>('/api/discover/genres?domain=movie'),6*60*60_000),
      cachedRequest('discover:genres:tv',()=>options.request<{items:DiscoverCategory[]}>('/api/discover/genres?domain=tv'),6*60*60_000),
      cachedRequest('discover:studios',()=>options.request<{items:DiscoverCategory[]}>('/api/discover/categories?type=studios'),6*60*60_000),
      cachedRequest('discover:networks',()=>options.request<{items:DiscoverCategory[]}>('/api/discover/categories?type=networks'),6*60*60_000),
    ]).then(([movie,tv,studios,networks])=>{if(active)setTaxonomies({movie:movie.items,tv:tv.items,studios:studios.items,networks:networks.items});}).catch(()=>{});
    return()=>{active=false;};
  },[loadFeed,options]);

  useEffect(()=>{
    const term=query.trim();if(!term){setSearchResults(null);setResultTitle('');return;}
    const controller=new AbortController(),timer=setTimeout(()=>{
      const domains:DiscoverDomain[]=domain==='all'?['movie','tv']:[domain];
      void Promise.all(domains.map(value=>options.request<DiscoverPage>(`/api/discover/browse?domain=${value}&query=${encodeURIComponent(term)}&page=1`,{signal:controller.signal}))).then(values=>{setResultTitle(`Search results for “${term}”`);setSearchResults(values.flatMap(value=>value.results));}).catch(()=>{});
    },250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,domain,options]);

  const featured=rows.trending?.find(item=>item.backdrop)||rows.trending?.[0];
  const visible=useMemo(()=>feeds.filter(([kind])=>domain==='all'||(domain==='movie'&&kind.includes('movie'))||(domain==='tv'&&kind.includes('tv'))),[domain]);
  const open=useCallback((item:DiscoverItem)=>window.dispatchEvent(new CustomEvent('vynodearr:discover-details',{detail:item})),[]);
  const browse=useCallback((item:DiscoverCategory&{taxonomy:'genre'|'studio'|'network'})=>{
    const parameter=item.taxonomy==='genre'?'genre':item.taxonomy==='studio'?'company':'network';
    setResultTitle(item.name);setSearchResults([]);
    void cachedRequest(`discover:browse:${item.domain}:${parameter}:${item.id}:1`,()=>options.request<DiscoverPage>(`/api/discover/browse?domain=${item.domain}&${parameter}=${item.id}&page=1`),5*60_000)
      .then(value=>setSearchResults(value.results)).catch(reason=>options.notify(reason instanceof Error?reason.message:'Collection unavailable.','error'));
  },[options]);

  return <div className="react-discover">
    {featured?<section className="discover-hero"><div className="discover-hero-backdrop">{(featured.backdrop||featured.poster)?<img src={featured.backdrop||featured.poster||''} alt=""/>:null}</div><div className="discover-hero-shade"/><div className="discover-hero-copy"><span className="eyebrow">TRENDING TODAY</span><h1>{featured.title}</h1><p>{featured.overview}</p><div className="discover-meta"><span>★ {featured.rating.toFixed(1)}</span><span>{featured.year||'TBA'}</span></div><button className="primary" onClick={()=>open(featured)}>View details</button></div></section>:<section className="discover-hero skeleton"><div className="discover-hero-copy"><span className="eyebrow">DISCOVER</span><h1>Loading trending titles…</h1></div></section>}
    <section className="discover-toolbar"><label className="discover-search"><span>⌕</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search all TMDB movies and television"/></label><div className="discover-domain-filter">{(['all','movie','tv'] as const).map(value=><button className={`chip${domain===value?' selected':''}`} onClick={()=>setDomain(value)} key={value}>{value==='all'?'Everything':value==='movie'?'Movies':'TV'}</button>)}</div><span className="discover-source">Live TMDB discovery · no Plex dependency</span></section>
    <div id="discover-rows">
      {error&&!Object.keys(rows).length?<div className="empty error-state"><h2>Connect Discover to TMDB</h2><p>{error}</p>{options.administrator?<a className="primary button-link" href="#service/discover">Configure Discover</a>:null}</div>:null}
      {searchResults?<Row title={resultTitle||'Browse results'} subtitle="Live TMDB title search" items={searchResults} library={library} onOpen={open}/>:visible.map(([kind,title,subtitle])=>{
        const items=rows[kind]||[];if(!items.length)return <section className="discover-row skeleton" key={kind}><div className="discover-row-heading"><h2>{title}</h2></div></section>;
        return <div key={kind}><Row title={title} subtitle={subtitle} items={items} library={library} onOpen={open} onMore={()=>loadFeed(kind,(pages[kind]||1)+1).catch(()=>{})}/>
          {kind==='popular_movies'?<><Taxonomy title="Movie genres" kind="genre" items={taxonomies.movie} onSelect={browse}/><Taxonomy title="Studios" kind="studio" items={taxonomies.studios} onSelect={browse}/></>:null}
          {kind==='popular_tv'?<><Taxonomy title="Television genres" kind="genre" items={taxonomies.tv} onSelect={browse}/><Taxonomy title="Networks" kind="network" items={taxonomies.networks} onSelect={browse}/></>:null}
        </div>;
      })}
    </div>
  </div>;
}
