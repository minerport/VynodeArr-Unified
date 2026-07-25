const IMAGE_ROOT='https://image.tmdb.org/t/p/';
type MediaDomain='movie'|'tv';
type JsonRecord=Record<string,any>;
type CacheEntry={expires:number,value:any};
type BrowseOptions={domain:MediaDomain;genre?:number|string;company?:number|string;network?:number|string;page?:number;query?:string};
type DiscoveryOptions={token?:string;fetcher?:typeof fetch;language?:string};

export const studios=[
  {id:2,name:'Disney'},{id:127928,name:'20th Century Studios'},{id:34,name:'Sony Pictures'},
  {id:174,name:'Warner Bros. Pictures'},{id:33,name:'Universal Pictures'},{id:4,name:'Paramount Pictures'},
  {id:3,name:'Pixar'},{id:521,name:'DreamWorks Animation'},{id:420,name:'Marvel Studios'},
  {id:9993,name:'DC'},{id:41077,name:'A24'}
];

export const networks=[
  {id:213,name:'Netflix'},{id:2739,name:'Disney+'},{id:1024,name:'Prime Video'},{id:2552,name:'Apple TV+'},
  {id:453,name:'Hulu'},{id:49,name:'HBO'},{id:4353,name:'Discovery+'},{id:2,name:'ABC'},
  {id:19,name:'FOX'},{id:359,name:'Cinemax'},{id:174,name:'AMC'},{id:67,name:'Showtime'},
  {id:318,name:'Starz'},{id:71,name:'The CW'},{id:6,name:'NBC'},{id:16,name:'CBS'},
  {id:4330,name:'Paramount+'},{id:4,name:'BBC One'},{id:56,name:'Cartoon Network'},
  {id:80,name:'Adult Swim'},{id:13,name:'Nickelodeon'},{id:3353,name:'Peacock'}
];

const asPage=value=>Math.max(1,Math.min(500,Number(value)||1));
const yearOf=value=>Number(String(value||'').slice(0,4))||null;
const image=(path,size)=>path?`${IMAGE_ROOT}${size}${path}`:null;

export class TmdbDiscoveryService{
  token:string;
  fetcher:typeof fetch;
  language:string;
  cache:Map<string,CacheEntry>;
  inFlight:Map<string,Promise<any>>;

  constructor({token,fetcher=fetch,language='en-US'}:DiscoveryOptions={}){
    this.token=String(token||'').trim();this.fetcher=fetcher;this.language=language;this.cache=new Map();this.inFlight=new Map();
  }
  configured(){return Boolean(this.token);}
  setToken(token:string){this.token=String(token||'').trim();this.cache.clear();return this.configured();}
  async request(path:string,params:JsonRecord={}){
    if(!this.configured())throw new Error('TMDB discovery is not configured');
    const url=new URL(`https://api.themoviedb.org/3${path}`);
    url.searchParams.set('language',this.language);
    for(const[key,value]of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));
    const key=url.toString(),cached=this.cache.get(key);
    if(cached&&cached.expires>Date.now())return cached.value;
    if(this.inFlight.has(key))return this.inFlight.get(key);
    const load=(async()=>{
      const response=await this.fetcher(url,{headers:{accept:'application/json',authorization:`Bearer ${this.token}`},signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error(response.status===401?'TMDB rejected the configured read token':'TMDB discovery is temporarily unavailable');
      const value=await response.json(),ttl=/\/search\//.test(path)?60_000:/\/(trending|discover|upcoming|on_the_air)\//.test(path)?5*60_000:30*60_000;
      this.cache.set(key,{expires:Date.now()+ttl,value});return value;
    })();
    this.inFlight.set(key,load);
    try{return await load;}finally{this.inFlight.delete(key);}
  }
  media(item:JsonRecord,domain?:MediaDomain){
    const resolved=domain||(item.media_type==='tv'?'tv':'movie'),title=resolved==='tv'?item.name:item.title,date=resolved==='tv'?item.first_air_date:item.release_date;
    return{id:`tmdb-${resolved}-${item.id}`,tmdbId:Number(item.id),domain:resolved,title:title||'Untitled',year:yearOf(date),overview:item.overview||'',rating:Number(item.vote_average||0),poster:image(item.poster_path,'w500'),backdrop:image(item.backdrop_path,'w1280'),genreIds:item.genre_ids||[]};
  }
  page(value:JsonRecord,domain?:MediaDomain){
    const results=(value.results||[]).filter(item=>item.media_type!=='person').map(item=>this.media(item,domain)).filter(item=>item.title);
    return{page:Number(value.page||1),totalPages:Number(value.total_pages||1),totalResults:Number(value.total_results||results.length),results};
  }
  async feed(kind:string,page=1){
    const routes:Record<string,[string,JsonRecord,MediaDomain|null]>={
      trending:['/trending/all/day',{},null],
      popular_movies:['/discover/movie',{sort_by:'popularity.desc',include_adult:false,include_video:false},'movie'],
      popular_tv:['/discover/tv',{sort_by:'popularity.desc',include_adult:false},'tv'],
      upcoming_movies:['/movie/upcoming',{},'movie'],
      upcoming_tv:['/tv/on_the_air',{},'tv']
    };
    const route=routes[kind];if(!route)throw new Error('Unknown discovery feed');
    return this.page(await this.request(route[0],{...route[1],page:asPage(page)}),route[2]);
  }
  async browse({domain,genre,company,network,page=1,query}:BrowseOptions){
    if(!['movie','tv'].includes(domain))throw new Error('Choose movies or television');
    if(query){
      const path=domain==='movie'?'/search/movie':'/search/tv';
      return this.page(await this.request(path,{query,page:asPage(page),include_adult:false}),domain);
    }
    const params:JsonRecord={page:asPage(page),sort_by:'popularity.desc',include_adult:false};
    if(genre)params.with_genres=genre;
    if(company&&domain==='movie')params.with_companies=company;
    if(network&&domain==='tv')params.with_networks=network;
    return this.page(await this.request(`/discover/${domain}`,params),domain);
  }
  async genres(domain:MediaDomain){
    if(!['movie','tv'].includes(domain))throw new Error('Choose movies or television');
    const cacheKey=`genres:${domain}`,cached=this.cache.get(cacheKey);
    if(cached&&cached.expires>Date.now())return cached.value;
    const list=await this.request(`/genre/${domain}/list`);
    const values=await Promise.all((list.genres||[]).map(async genre=>{
      const page=await this.browse({domain,genre:genre.id,page:1});
      const backdrops=page.results.map(item=>item.backdrop).filter(Boolean);
      return{id:Number(genre.id),name:genre.name,domain,backdrop:backdrops[4]||backdrops.at(-1)||null};
    }));
    values.sort((left,right)=>left.name.localeCompare(right.name));
    this.cache.set(cacheKey,{expires:Date.now()+6*60*60*1000,value:values});return values;
  }
  async categories(type:'studios'|'networks'){
    const source=type==='studios'?studios:type==='networks'?networks:null;
    if(!source)throw new Error('Unknown discovery category');
    const domain=type==='studios'?'movie':'tv',key=type==='studios'?'company':'network';
    const values=await Promise.all(source.map(async entry=>{
      const page=await this.browse({domain,[key]:entry.id,page:1});
      const backdrops=page.results.map(item=>item.backdrop).filter(Boolean);
      return{...entry,domain,backdrop:backdrops[4]||backdrops.at(-1)||null};
    }));
    return values;
  }
  async details(domain:MediaDomain,id:number|string){
    if(!['movie','tv'].includes(domain)||!Number.isFinite(Number(id)))throw new Error('Invalid title');
    const item=await this.request(`/${domain}/${Number(id)}`,{append_to_response:'content_ratings,release_dates,credits,videos,external_ids'});
    const base=this.media(item,domain),certification=domain==='movie'
      ?item.release_dates?.results?.find(value=>value.iso_3166_1==='US')?.release_dates?.find(value=>value.certification)?.certification
      :item.content_ratings?.results?.find(value=>value.iso_3166_1==='US')?.rating;
    const videos=item.videos?.results||[],trailer=videos.find(value=>value.site==='YouTube'&&value.type==='Trailer'&&value.official)||videos.find(value=>value.site==='YouTube'&&value.type==='Trailer')||videos.find(value=>value.site==='YouTube');
    const imdbId=item.external_ids?.imdb_id||item.imdb_id||null,tvdbId=item.external_ids?.tvdb_id||null;
    return{...base,imdbId,tvdbId,genres:(item.genres||[]).map(value=>value.name),genre:(item.genres||[])[0]?.name||'Uncategorized',studio:item.production_companies?.[0]?.name||null,productionCompanies:(item.production_companies||[]).map(value=>value.name),network:item.networks?.[0]?.name||null,runtime:domain==='movie'?Number(item.runtime||0)||null:Number(item.episode_run_time?.[0]||item.last_episode_to_air?.runtime||0)||null,status:item.status||null,certification:certification||null,tagline:item.tagline||null,originalTitle:domain==='movie'?item.original_title:item.original_name,originalLanguage:item.original_language||null,countries:(item.production_countries||item.origin_country||[]).map(value=>value.name||value),budget:Number(item.budget||0)||null,revenue:Number(item.revenue||0)||null,cast:(item.credits?.cast||[]).slice(0,14).map(value=>({id:Number(value.id),name:value.name,character:value.character||null,photo:image(value.profile_path,'w185')})),trailer:trailer?{name:trailer.name||'Official trailer',url:`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} :null,externalLinks:[{label:'TMDB',url:`https://www.themoviedb.org/${domain}/${Number(id)}`},...(imdbId?[{label:'IMDb',url:`https://www.imdb.com/title/${imdbId}/`}]:[]),...(tvdbId?[{label:'TVDB',url:`https://thetvdb.com/dereferrer/series/${tvdbId}`}]:[])],seasons:domain==='tv'?(item.seasons||[]).map(value=>({seasonNumber:Number(value.season_number),name:value.name,episodeCount:Number(value.episode_count||0),airDate:value.air_date||null,poster:image(value.poster_path,'w342')})):[]};
  }
  async enrich(domain:MediaDomain,{title,year}:{title?:string;year?:number|string}={}){
    if(!['movie','tv'].includes(domain)||!String(title||'').trim())throw new Error('Invalid title');
    const page=await this.browse({domain,query:String(title).trim(),page:1}),normalized=String(title).trim().toLowerCase();
    const candidates=page.results.map(item=>({...item,score:(item.title.toLowerCase()===normalized?100:0)+(Number(year)&&item.year===Number(year)?25:0)})).sort((left,right)=>right.score-left.score);
    const match=candidates[0];if(!match||match.score<25)return null;
    return this.details(domain,match.tmdbId);
  }
}
