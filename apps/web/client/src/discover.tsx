import { useCallback,useEffect,useMemo,useRef,useState,type CSSProperties } from 'react';
import type { DiscoverCategory,DiscoverDomain,DiscoverItem,DiscoverLibraryStatus,DiscoverMountOptions,DiscoverPage,LibraryItem } from './discover-types';
import { cachedRequest } from './query-client';
import {DiscoverDetail} from './discover-detail';
import {DiscoverRequest} from './discover-request';

const feeds=[
  ['trending','Trending now','Movies and series people are watching today'],
  ['popular_movies','Popular movies','Popular films across every genre'],
  ['upcoming_movies','Upcoming movies','Films arriving soon'],
  ['popular_tv','Popular television','Series worth settling in for'],
  ['upcoming_tv','Upcoming television','Series currently airing'],
] as const;
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'').trim();
const libraryKey=(domain:DiscoverDomain,title:string,year?:number|null)=>`${domain}:${normalize(title)}:${Number(year||0)}`;
const libraryKeys=(domain:DiscoverDomain,title:string,year?:number|null)=>[
  libraryKey(domain,title,year),
  ...(domain==='tv'?[`${domain}:${normalize(title)}`]:[]),
];
const findLibraryStatus=(library:Map<string,DiscoverLibraryStatus>,item:Pick<DiscoverItem,'domain'|'title'|'year'>)=>
  libraryKeys(item.domain,item.title,item.year).map(key=>library.get(key)).find(Boolean);
const addLibraryStatus=(library:Map<string,DiscoverLibraryStatus>,domain:DiscoverDomain,item:Pick<LibraryItem,'title'|'year'>,status:DiscoverLibraryStatus)=>{
  libraryKeys(domain,item.title,item.year).forEach(key=>library.set(key,status));
};
const mergeUnique=(pages:DiscoverPage[])=>{
  const seen=new Set<string>();
  return pages.flatMap(page=>page.results).filter(item=>!seen.has(item.id)&&Boolean(seen.add(item.id)));
};
type BrowseContext={domain:DiscoverDomain;returnDomain:'all'|DiscoverDomain;parameter:'genre'|'company'|'network';id:number;page:number;totalPages:number;totalResults:number;loading:boolean};
const libraryStatus=(domain:DiscoverDomain,item:LibraryItem):DiscoverLibraryStatus=>{
  if(domain==='movie')return item.hasFile||Number(item.sizeOnDisk||0)>0?'available':'pending';
  return Number.parseInt(item.episodeProgress||'0',10)>0||Number(item.sizeOnDisk||0)>0?'available':'pending';
};

function Card({item,status,onOpen}:{item:DiscoverItem;status?:DiscoverLibraryStatus;onOpen:(item:DiscoverItem)=>void}){
  const tracked=Boolean(status);
  return <article className="discover-card" role="button" tabIndex={0} onClick={()=>onOpen(item)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onOpen(item);}}}>
    <div className="discover-poster">{item.poster?<img src={item.poster} alt={`${item.title} poster`} loading="lazy"/>:<span className="discover-poster-fallback">{item.title[0]}</span>}
      {item.rating?<span className="discover-score">★ {item.rating.toFixed(1)}</span>:null}
      {status?<span className={`discover-library-tag${status==='pending'?' pending':''}`}>{status==='available'?'In library':'Pending'}</span>:null}
      {!tracked?<button className="discover-action" type="button" aria-label={`Add ${item.title}`} onClick={event=>{event.stopPropagation();onOpen(item);}}><span aria-hidden="true">+</span> Add</button>:null}
    </div>
    <div className="discover-card-copy"><h3>{item.title}</h3><p><span>{item.year||'TBA'}</span><span>{item.domain==='movie'?'Movie':'TV'}</span></p></div>
  </article>;
}

function Row({title,subtitle,items,library,onOpen,onMore,onBack,grid=false}:{title:string;subtitle:string;items:DiscoverItem[];library:Map<string,DiscoverLibraryStatus>;onOpen:(item:DiscoverItem)=>void;onMore?:()=>void;onBack?:()=>void;grid?:boolean}){
  const strip=useRef<HTMLDivElement>(null);
  return <section className={`discover-row${grid?' discover-results-grid':''}`}>{onBack?<button className="discover-results-back" type="button" onClick={onBack}>← Back to Discover</button>:null}<div className="discover-row-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><div className="discover-row-controls">
    <button type="button" aria-label={`Previous ${title}`} title="Previous" onClick={()=>strip.current?.scrollBy({left:-strip.current.clientWidth*.8,behavior:'smooth'})}>‹</button>
    <button type="button" aria-label={`Next ${title}`} title="Next" onClick={()=>{strip.current?.scrollBy({left:strip.current.clientWidth*.8,behavior:'smooth'});onMore?.();}}>›</button>
    {grid?<button className="discover-results-more" type="button" onClick={onMore} disabled={!onMore}>{onMore?'Load more':'All loaded'}</button>:null}
  </div></div><div className="discover-strip" ref={strip}>{items.map(item=><Card key={item.id} item={item} status={findLibraryStatus(library,item)} onOpen={onOpen}/>)}</div></section>;
}

function Taxonomy({title,kind,items,onSelect}:{title:string;kind:'genre'|'studio'|'network';items:DiscoverCategory[];onSelect:(item:DiscoverCategory&{taxonomy:'genre'|'studio'|'network'})=>void}){
  const strip=useRef<HTMLDivElement>(null);
  if(!items.length)return null;
  return <section className="discover-row discover-taxonomy"><div className="discover-row-heading"><div><h2>{title}</h2></div><div className="discover-row-controls">
    <button type="button" aria-label={`Previous ${title}`} title="Previous" onClick={()=>strip.current?.scrollBy({left:-700,behavior:'smooth'})}>‹</button><button type="button" aria-label={`Next ${title}`} title="Next" onClick={()=>strip.current?.scrollBy({left:700,behavior:'smooth'})}>›</button>
  </div></div><div className="discover-taxonomy-grid discover-strip" ref={strip}>{items.map((item,index)=><button key={`${item.domain}-${item.id}`} onClick={()=>onSelect({...item,taxonomy:kind})} style={{'--taxonomy-hue':String((index*47+(kind==='genre'?258:kind==='studio'?188:332))%360),...(item.backdrop?{'--taxonomy-image':`url("${item.backdrop}")`}:{})} as CSSProperties}><span>{kind==='genre'?'◇':kind==='studio'?'◆':'●'}</span><strong>{item.name}</strong><small>Browse all titles</small></button>)}</div></section>;
}

export function DiscoverView({options}:{options:DiscoverMountOptions}){
  const [rows,setRows]=useState<Record<string,DiscoverItem[]>>({});
  const [pages,setPages]=useState<Record<string,number>>({});
  const [library,setLibrary]=useState(new Map<string,DiscoverLibraryStatus>());
  const [libraryItems,setLibraryItems]=useState(new Map<string,LibraryItem>());
  const [selected,setSelected]=useState<DiscoverItem|null>(null);
  const [requesting,setRequesting]=useState<DiscoverItem|null>(null);
  const [taxonomies,setTaxonomies]=useState<{movie:DiscoverCategory[];tv:DiscoverCategory[];studios:DiscoverCategory[];networks:DiscoverCategory[]}>({movie:[],tv:[],studios:[],networks:[]});
  const [domain,setDomain]=useState<'all'|DiscoverDomain>('all');
  const [query,setQuery]=useState('');
  const [searchResults,setSearchResults]=useState<DiscoverItem[]|null>(null);
  const [resultTitle,setResultTitle]=useState('');
  const [browseContext,setBrowseContext]=useState<BrowseContext|null>(null);
  const [error,setError]=useState('');
  const browseRequest=useRef(0);

  const loadFeed=useCallback(async(kind:string,page=1)=>{
    const value=await cachedRequest(`discover:feed:${kind}:${page}`,()=>options.request<DiscoverPage>(`/api/discover/feed?kind=${kind}&page=${page}`),90_000);
    setRows(current=>({...current,[kind]:page===1?value.results:[...(current[kind]||[]),...value.results.filter(item=>!(current[kind]||[]).some(existing=>existing.id===item.id))]}));
    setPages(current=>({...current,[kind]:value.page}));
  },[options]);
  const refreshLibrary=useCallback(async()=>{
    const [movies,tv]=await Promise.all([options.request<{items:LibraryItem[]}>('/api/media/movies'),options.request<{items:LibraryItem[]}>('/api/media/tv')]);
    const next=new Map<string,DiscoverLibraryStatus>();
    const records=new Map<string,LibraryItem>();
    movies.items.forEach(item=>addLibraryStatus(next,'movie',item,libraryStatus('movie',item)));
    tv.items.forEach(item=>addLibraryStatus(next,'tv',item,libraryStatus('tv',item)));
    movies.items.forEach(item=>libraryKeys('movie',item.title,item.year).forEach(key=>records.set(key,item)));
    tv.items.forEach(item=>libraryKeys('tv',item.title,item.year).forEach(key=>records.set(key,item)));
    setLibrary(next);
    setLibraryItems(records);
  },[options]);

  useEffect(()=>{
    let active=true;
    void refreshLibrary().catch(()=>{});
    const requested=(event:Event)=>{
      const item=(event as CustomEvent<{domain:DiscoverDomain;title:string;year?:number|null}>).detail;
      if(item)setLibrary(current=>{
        const next=new Map(current);
        libraryKeys(item.domain,item.title,item.year).forEach(key=>next.set(key,'pending'));
        return next;
      });
    };
    const focused=()=>void refreshLibrary().catch(()=>{});
    window.addEventListener('vynodearr:discover-requested',requested);
    window.addEventListener('focus',focused);
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refreshLibrary().catch(()=>{});},30_000);
    feeds.forEach(([kind])=>void loadFeed(kind).catch(reason=>setError(reason instanceof Error?reason.message:'Discover unavailable.')));
    void Promise.all([
      cachedRequest('discover:genres:movie',()=>options.request<{items:DiscoverCategory[]}>('/api/discover/genres?domain=movie'),6*60*60_000),
      cachedRequest('discover:genres:tv',()=>options.request<{items:DiscoverCategory[]}>('/api/discover/genres?domain=tv'),6*60*60_000),
      cachedRequest('discover:studios',()=>options.request<{items:DiscoverCategory[]}>('/api/discover/categories?type=studios'),6*60*60_000),
      cachedRequest('discover:networks',()=>options.request<{items:DiscoverCategory[]}>('/api/discover/categories?type=networks'),6*60*60_000),
    ]).then(([movie,tv,studios,networks])=>{if(active)setTaxonomies({movie:movie.items,tv:tv.items,studios:studios.items,networks:networks.items});}).catch(()=>{});
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',focused);window.removeEventListener('vynodearr:discover-requested',requested);};
  },[loadFeed,options,refreshLibrary]);

  useEffect(()=>{
    const term=query.trim();if(!term){if(!browseContext)setSearchResults(null);return;}
    setBrowseContext(null);
    const controller=new AbortController(),timer=setTimeout(()=>{
      const domains:DiscoverDomain[]=domain==='all'?['movie','tv']:[domain];
      void Promise.all(domains.map(value=>options.request<DiscoverPage>(`/api/discover/browse?domain=${value}&query=${encodeURIComponent(term)}&page=1`,{signal:controller.signal}))).then(values=>{setResultTitle(`Search results for “${term}”`);setSearchResults(values.flatMap(value=>value.results));}).catch(()=>{});
    },250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,domain,options,browseContext]);

  const featured=rows.trending?.find(item=>item.backdrop)||rows.trending?.[0];
  const visible=useMemo(()=>feeds.filter(([kind])=>domain==='all'||(domain==='movie'&&kind.includes('movie'))||(domain==='tv'&&kind.includes('tv'))),[domain]);
  const open=useCallback((item:DiscoverItem)=>setSelected(item),[]);
  const loadBrowsePages=useCallback(async(context:BrowseContext,start:number,count:number,replace=false)=>{
    if(context.loading||start>context.totalPages)return;
    const requestId=++browseRequest.current,end=Math.min(context.totalPages,start+count-1);
    setBrowseContext(current=>current?{...current,loading:true}:current);
    try{
      const pages=await Promise.all(Array.from({length:end-start+1},(_,index)=>{
        const page=start+index,path=`/api/discover/browse?domain=${context.domain}&${context.parameter}=${context.id}&page=${page}`;
        return cachedRequest(`discover:browse:${context.domain}:${context.parameter}:${context.id}:${page}`,()=>options.request<DiscoverPage>(path),5*60_000);
      }));
      if(requestId!==browseRequest.current)return;
      const incoming=mergeUnique(pages);
      setSearchResults(current=>replace?incoming:mergeUnique([{page:1,totalPages:1,totalResults:0,results:[...(current||[]),...incoming]}]));
      setBrowseContext(current=>current?{...current,page:end,totalPages:pages[0]?.totalPages||current.totalPages,totalResults:pages[0]?.totalResults||current.totalResults,loading:false}:current);
    }catch(reason){
      if(requestId===browseRequest.current){
        setBrowseContext(current=>current?{...current,loading:false}:current);
        options.notify(reason instanceof Error?reason.message:'Collection unavailable.','error');
      }
    }
  },[options]);
  const browse=useCallback((item:DiscoverCategory&{taxonomy:'genre'|'studio'|'network'})=>{
    const parameter=item.taxonomy==='genre'?'genre':item.taxonomy==='studio'?'company':'network',requestId=++browseRequest.current;
    setQuery('');setDomain(item.domain);setResultTitle(item.name);setSearchResults([]);
    const firstPath=`/api/discover/browse?domain=${item.domain}&${parameter}=${item.id}&page=1`;
    void cachedRequest(`discover:browse:${item.domain}:${parameter}:${item.id}:1`,()=>options.request<DiscoverPage>(firstPath),5*60_000).then(first=>{
      if(requestId!==browseRequest.current)return;
      const context:BrowseContext={domain:item.domain,returnDomain:domain,parameter,id:item.id,page:0,totalPages:first.totalPages,totalResults:first.totalResults,loading:false};
      setBrowseContext(context);
      if(first.totalPages<=1){setSearchResults(first.results);setBrowseContext({...context,page:1});return;}
      void loadBrowsePages(context,1,5,true);
    }).catch(reason=>options.notify(reason instanceof Error?reason.message:'Collection unavailable.','error'));
  },[domain,loadBrowsePages,options]);
  const closeBrowse=useCallback(()=>{
    browseRequest.current+=1;
    const returnDomain=browseContext?.returnDomain||'all';
    setBrowseContext(null);setSearchResults(null);setResultTitle('');setQuery('');setDomain(returnDomain);
  },[browseContext]);

  return <div className="react-discover">
    {selected?<DiscoverDetail item={selected} libraryItem={libraryKeys(selected.domain,selected.title,selected.year).map(key=>libraryItems.get(key)).find(Boolean)} options={options} onRequest={setRequesting} onClose={()=>setSelected(null)}/>:null}
    {requesting?<DiscoverRequest item={requesting} options={options} onClose={()=>setRequesting(null)} onRequested={requested=>{
      setLibrary(current=>{
        const next=new Map(current);
        libraryKeys(requested.domain,requested.title,requested.year).forEach(key=>next.set(key,'pending'));
        return next;
      });
    }}/>:null}
    {featured?<section className="discover-hero"><div className="discover-hero-backdrop">{(featured.backdrop||featured.poster)?<img src={featured.backdrop||featured.poster||''} alt=""/>:null}</div><div className="discover-hero-shade"/><div className="discover-hero-copy"><span className="eyebrow">TRENDING TODAY</span><h1>{featured.title}</h1><p>{featured.overview}</p><div className="discover-meta"><span>★ {featured.rating.toFixed(1)}</span><span>{featured.year||'TBA'}</span></div><button className="primary" onClick={()=>open(featured)}>View details</button></div></section>:<section className="discover-hero skeleton"><div className="discover-hero-copy"><span className="eyebrow">DISCOVER</span><h1>Loading trending titles…</h1></div></section>}
    <section className="discover-toolbar"><label className="discover-search"><span>⌕</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search all TMDB movies and television"/></label><div className="discover-domain-filter">{(['all','movie','tv'] as const).map(value=><button className={`chip${domain===value?' selected':''}`} onClick={()=>setDomain(value)} key={value}>{value==='all'?'Everything':value==='movie'?'Movies':'TV'}</button>)}</div><span className="discover-source">Live TMDB discovery · no Plex dependency</span></section>
    <div id="discover-rows">
      {error&&!Object.keys(rows).length?<div className="empty error-state"><h2>Connect Discover to TMDB</h2><p>{error}</p>{options.administrator?<a className="primary button-link" href="#service/discover">Configure Discover</a>:null}</div>:null}
      {searchResults?<Row title={resultTitle||'Browse results'} subtitle={browseContext?`${searchResults.length.toLocaleString()} of ${browseContext.totalResults.toLocaleString()} TMDB titles`:'Live TMDB title search'} items={searchResults} library={library} onOpen={open} grid={Boolean(browseContext)} onBack={browseContext?closeBrowse:undefined} onMore={browseContext&&browseContext.page<browseContext.totalPages&&!browseContext.loading?()=>void loadBrowsePages(browseContext,browseContext.page+1,3):undefined}/>:visible.map(([kind,title,subtitle])=>{
        const items=rows[kind]||[];if(!items.length)return <section className="discover-row skeleton" key={kind}><div className="discover-row-heading"><h2>{title}</h2></div></section>;
        return <div key={kind}><Row title={title} subtitle={subtitle} items={items} library={library} onOpen={open} onMore={()=>loadFeed(kind,(pages[kind]||1)+1).catch(()=>{})}/>
          {kind==='popular_movies'?<><Taxonomy title="Movie genres" kind="genre" items={taxonomies.movie} onSelect={browse}/><Taxonomy title="Studios" kind="studio" items={taxonomies.studios} onSelect={browse}/></>:null}
          {kind==='popular_tv'?<><Taxonomy title="Television genres" kind="genre" items={taxonomies.tv} onSelect={browse}/><Taxonomy title="Networks" kind="network" items={taxonomies.networks} onSelect={browse}/></>:null}
        </div>;
      })}
    </div>
  </div>;
}
