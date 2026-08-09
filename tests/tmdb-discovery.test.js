import test from 'node:test';
import assert from 'node:assert/strict';
import { TmdbDiscoveryService,networks,studios } from '../.server-build/apps/api/src/tmdb-discovery.js';

const response=value=>({ok:true,json:async()=>value});

test('TMDB discovery maps independent movie and television feeds',async()=>{
  const calls=[];
  const service=new TmdbDiscoveryService({token:'test-token',fetcher:async url=>{
    calls.push(String(url));
    return response({page:1,total_pages:8,total_results:150,results:[
      {id:10,media_type:'movie',title:'Film',release_date:'2026-01-02',poster_path:'/film.jpg',backdrop_path:'/film-bg.jpg',vote_average:8.2},
      {id:20,media_type:'tv',name:'Series',first_air_date:'2025-03-04',poster_path:'/series.jpg',vote_average:7.4}
    ]});
  }});
  const page=await service.feed('trending',1);
  assert.equal(page.results.length,2);assert.equal(page.results[0].domain,'movie');assert.equal(page.results[1].domain,'tv');
  assert.match(page.results[0].poster,/image\.tmdb\.org/);assert.match(calls[0],/trending\/all\/day/);
});

test('TMDB browse uses category parameters and fixed Seerr category counts',async()=>{
  let requested='';
  const service=new TmdbDiscoveryService({token:'test-token',fetcher:async url=>{requested=String(url);return response({page:2,total_pages:3,total_results:41,results:[]});}});
  const page=await service.browse({domain:'movie',genre:'28',company:'420',page:2});
  assert.equal(page.totalResults,41);assert.match(requested,/with_genres=28/);assert.match(requested,/with_companies=420/);
  assert.equal(studios.length,11);assert.equal(networks.length,22);
});

test('TMDB browse filters movie and television catalogs by streaming provider',async()=>{
  const requested=[];
  const service=new TmdbDiscoveryService({token:'test-token',fetcher:async url=>{requested.push(String(url));return response({page:1,total_pages:1,total_results:0,results:[]});}});
  await service.browse({domain:'movie',provider:8});
  await service.browse({domain:'tv',provider:8});
  assert.equal(requested.length,2);
  for(const url of requested){assert.match(url,/with_watch_providers=8/);assert.match(url,/watch_region=US/);}
});

test('TMDB studio and network categories use official brand logos',async()=>{
  const service=new TmdbDiscoveryService({token:'test-token',fetcher:async url=>{
    const path=new URL(url).pathname;
    if(path.endsWith('/images'))return response({logos:[{file_path:'/brand.png',iso_639_1:'en',vote_average:9}]});
    return response({page:1,total_pages:1,total_results:1,results:[{id:10,title:'Film',backdrop_path:'/film-bg.jpg'}]});
  }});
  const items=await service.categories('studios');
  assert.match(items[0].logo,/image\.tmdb\.org\/t\/p\/w500\/brand\.png/);
});

test('TMDB enrichment resolves a library title and maps credits, trailers, and external links',async()=>{
  const service=new TmdbDiscoveryService({token:'test-token',fetcher:async url=>{
    const path=new URL(url).pathname;
    if(path.endsWith('/search/movie'))return response({page:1,total_pages:1,total_results:1,results:[{id:10,title:'Film',release_date:'2026-01-02'}]});
    return response({id:10,title:'Film',release_date:'2026-01-02',genres:[{name:'Drama'}],credits:{cast:[{id:5,name:'Actor',character:'Lead',profile_path:'/actor.jpg'}]},videos:{results:[{site:'YouTube',type:'Trailer',official:true,key:'abc',name:'Trailer'}]},external_ids:{imdb_id:'tt123'},production_companies:[{name:'Studio'}]});
  }});
  const item=await service.enrich('movie',{title:'Film',year:2026});
  assert.equal(item.cast[0].name,'Actor');assert.match(item.trailer.url,/youtube\.com/);assert.equal(item.externalLinks[1].label,'IMDb');
});

test('TMDB requests reuse fresh responses and deduplicate concurrent work',async()=>{
  let calls=0;
  const fetcher=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));return{ok:true,json:async()=>({page:1,total_pages:1,total_results:1,results:[{id:7,title:'Cached title',release_date:'2026-01-01'}]})};};
  const service=new TmdbDiscoveryService({token:'read-token',fetcher});
  const [first,second]=await Promise.all([service.feed('popular_movies',1),service.feed('popular_movies',1)]);
  const third=await service.feed('popular_movies',1);
  assert.equal(calls,1);
  assert.equal(first.results[0].title,'Cached title');
  assert.deepEqual(second,third);
});
