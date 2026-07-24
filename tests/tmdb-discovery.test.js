import test from 'node:test';
import assert from 'node:assert/strict';
import { TmdbDiscoveryService,networks,studios } from '../apps/api/src/tmdb-discovery.js';

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
