import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MovieEngineAdapter } from '../.server-build/packages/movie-domain/src/engine-adapter.js';
import { TvEngineAdapter } from '../.server-build/packages/tv-domain/src/engine-adapter.js';
import { ReadOnlyEngineClient } from '../.server-build/packages/platform/src/read-only-engine-client.js';
import { SynchronizationService } from '../.server-build/packages/platform/src/synchronization-service.js';
import { EncryptedCredentialVault } from '../.server-build/packages/platform/src/credential-vault.js';
import { MovieFixtureAdapter } from '../.server-build/packages/movie-domain/src/fixture-adapter.js';
import { completedQueueItemHasArrived, completedQueueItemIsTerminal } from '../.server-build/packages/contracts/src/mappers.js';
import { TvFixtureAdapter } from '../.server-build/packages/tv-domain/src/fixture-adapter.js';
import { BoundedCache } from '../.server-build/packages/platform/src/bounded-cache.js';

class FakeClient{constructor(values){this.values=values;}async get(path){if(path in this.values)return structuredClone(this.values[path]);return path.startsWith('movie/')?this.values.movieDetail:path.startsWith('series/')?this.values.seriesDetail:[];}}
const movieRecord={id:1,tmdbId:101,imdbId:'tt0000101',title:'Mapped Movie',sortTitle:'mapped movie',year:2025,releaseDate:'2025-02-03T00:00:00Z',added:'2026-01-02T00:00:00Z',runtime:110,certification:'PG-13',ratings:{imdb:{value:7.4}},monitored:true,status:'released',hasFile:true,sizeOnDisk:1024,movieFile:{quality:{quality:{name:'1080p'}}},qualityProfileId:2,path:'/media',tags:[],images:[]};
const seriesRecord={id:2,tmdbId:202,tvdbId:303,imdbId:'tt0000202',title:'Mapped Series',sortTitle:'mapped series',year:2024,firstAired:'2024-03-04T00:00:00Z',added:'2026-01-03T00:00:00Z',runtime:45,certification:'TV-14',ratings:{value:8.1},monitored:true,status:'continuing',network:'Network',qualityProfileId:3,path:'/tv',tags:[],images:[],seasons:[{seasonNumber:1,monitored:true}],statistics:{episodeCount:4,episodeFileCount:1,sizeOnDisk:2048}};
test('movie adapter maps records and all read-only operational surfaces',async()=>{
  const client=new FakeClient({movie:[movieRecord],movieDetail:movieRecord,queue:{records:[]},'wanted/cutoff':{records:[]},history:{records:[]},calendar:[],health:[],'system/status':{version:'1.0'}});
  const adapter=new MovieEngineAdapter({enabled:true},client),item=(await adapter.listMovies())[0];assert.equal(item.id,'movie_1');assert.equal(item.tmdbId,101);assert.equal(item.imdbId,'tt0000101');assert.equal(item.releaseDate,'2025-02-03T00:00:00Z');assert.equal(item.addedAt,'2026-01-02T00:00:00Z');assert.equal(item.completionPercent,100);assert.equal((await adapter.getMovie('movie_1')).quality,'1080p');assert.equal((await adapter.testConnection()).reachable,true);
});
test('movie adapter recognizes scanned media when the engine reports disk usage before file metadata',async()=>{
  const pendingFile={...movieRecord,hasFile:false,movieFile:null,sizeOnDisk:734003200,path:'/movies/Scanned Movie'};
  const adapter=new MovieEngineAdapter({enabled:true},new FakeClient({movie:[pendingFile],queue:{records:[]},'wanted/cutoff':{records:[]}})),item=(await adapter.listMovies())[0];
  assert.equal(item.hasFile,true);assert.equal(item.state,'available');assert.equal(item.quality,'Detected media');
});
test('engine attention summaries use authoritative wanted totals',async()=>{
  const values={'wanted/missing':{records:[],totalRecords:30},'wanted/cutoff':{records:[],totalRecords:1000}};
  assert.deepEqual(await new MovieEngineAdapter({enabled:true},new FakeClient(values)).getAttentionSummary(),{missing:30,cutoff:1000});
  assert.deepEqual(await new TvEngineAdapter({enabled:true},new FakeClient(values)).getAttentionSummary(),{missing:30,cutoff:1000});
});
test('engine history paging covers the requested window instead of truncating to the latest page',async()=>{
  const now=Date.now(),records=Array.from({length:620},(_,index)=>({
    id:index+1,eventType:index%2?'downloadFolderImported':'grabbed',
    date:new Date(now-index*60_000).toISOString(),movie:{id:1,title:'Mapped Movie'}
  }));
  const client={async get(path,query={}){
    assert.equal(path,'history');
    const start=(Number(query.page)-1)*Number(query.pageSize);
    return{records:records.slice(start,start+Number(query.pageSize)),totalRecords:records.length};
  }};
  const items=await new MovieEngineAdapter({enabled:true},client).getHistorySince({since:new Date(now-500*60_000),pageSize:200});
  assert.equal(items.length,501);
  assert.equal(items.filter(item=>item.eventType==='downloadFolderImported').length,250);
});
test('engine history preserves native background upgrade evidence',async()=>{
  const record={id:44,eventType:'grabbed',date:'2026-08-03T01:00:00Z',movie:{id:1,title:'Mapped Movie'},sourceTitle:'Mapped.Movie.2026.1080p.WEB-DL.PROPER',downloadId:'native-download',quality:{quality:{name:'WEBDL-1080p'}},customFormatScore:125,data:{isUpgrade:'true',indexer:'Native RSS',protocol:'torrent',customFormatScore:125}};
  const [item]=await new MovieEngineAdapter({enabled:true},new FakeClient({history:{records:[record]}})).getHistory();
  assert.equal(item.sourceTitle,record.sourceTitle);assert.equal(item.downloadId,'native-download');assert.equal(item.indexer,'Native RSS');assert.equal(item.protocol,'torrent');assert.equal(item.customFormatScore,125);assert.equal(item.isUpgrade,true);assert.equal(item.data.isUpgrade,'true');
});
test('movie cutoff attention includes every engine result page',async()=>{
  const movies=Array.from({length:1001},(_,index)=>({...movieRecord,id:index+1,title:`Movie ${index+1}`}));
  const client={
    async get(path,query={}){
      if(path==='movie')return movies;
      if(path==='queue')return{records:[]};
      if(path==='wanted/cutoff'){
        const start=(Number(query.page||1)-1)*Number(query.pageSize||1000);
        return{records:movies.slice(start,start+Number(query.pageSize||1000)),totalRecords:movies.length};
      }
      return[];
    }
  };
  const items=await new MovieEngineAdapter({enabled:true},client).listMovies({limit:2000});
  assert.equal(items.filter(item=>item.state==='cutoff').length,1001);
});
test('single movie details do not load the full cutoff library',async()=>{
  let cutoffRequests=0;
  const client={async get(path){if(path==='movie/1')return movieRecord;if(path==='queue')return{records:[]};if(path==='wanted/cutoff'){cutoffRequests++;return{records:[]};}return[];}};
  const item=await new MovieEngineAdapter({enabled:true},client).getMovie('movie_1');
  assert.equal(item.title,'Mapped Movie');
  assert.equal(cutoffRequests,0);
});
test('completed queue records clear once they are no longer active in the download client',async()=>{
  const movie=new MovieEngineAdapter({enabled:true},new FakeClient({queue:{records:[
    {id:1,status:'completed',size:100,sizeleft:0,movie:{id:1,title:'Arrived',hasFile:true}},
    {id:2,status:'completed',size:100,sizeleft:0,movie:{id:2,title:'Needs import',hasFile:false}},
    {id:3,status:'downloading',size:100,sizeleft:50,movie:{id:3,title:'Active',hasFile:true}}
  ]}}));
  const tv=new TvEngineAdapter({enabled:true},new FakeClient({queue:{records:[
    {id:4,status:'completed',size:100,sizeleft:0,series:{id:2,title:'Arrived show'},episode:{id:9,seriesId:2,hasFile:true}},
    {id:5,status:'completed',size:100,sizeleft:0,series:{id:2,title:'Needs import'},episode:{id:10,seriesId:2,hasFile:false}}
  ]}}));
  assert.deepEqual((await movie.getQueue()).map(item=>item.title),['Active']);
  assert.deepEqual((await tv.getQueue()).map(item=>item.title),[]);
});
test('completed queue cleanup can use the current library record',()=>{
  assert.equal(completedQueueItemHasArrived({status:'completed',sizeleft:0,movieId:7},'movie',{id:7,hasFile:true}),true);
  assert.equal(completedQueueItemHasArrived({status:'completed',sizeleft:0,movieId:7},'movie',{id:7,hasFile:false}),false);
  assert.equal(completedQueueItemIsTerminal({status:'completed',sizeleft:0}),true);
  assert.equal(completedQueueItemIsTerminal({status:'downloading',sizeleft:100}),false);
});
test('TV adapter maps seasons, episodes, and operational surfaces',async()=>{
  const client=new FakeClient({series:[seriesRecord],seriesDetail:seriesRecord,episode:[{id:4,seasonNumber:1,episodeNumber:1,title:'Pilot',monitored:true,hasFile:true}],queue:{records:[]},history:{records:[]},calendar:[],health:[],'system/status':{version:'1.0'}});
  const adapter=new TvEngineAdapter({enabled:true},client),item=(await adapter.listSeries())[0];assert.equal(item.id,'series_2');assert.equal(item.tmdbId,202);assert.equal(item.tvdbId,303);assert.equal(item.imdbId,'tt0000202');assert.equal(item.firstAired,'2024-03-04T00:00:00Z');assert.equal(item.addedAt,'2026-01-03T00:00:00Z');assert.equal(item.completionPercent,25);assert.equal((await adapter.getSeries('series_2')).seasons[0].episodes[0].title,'Pilot');
});
test('TV overlay metadata derives latest and next episode fields from paged episode responses',async()=>{
  const now=Date.now(),client=new FakeClient({episode:{records:[
    {id:1,seasonNumber:2,episodeNumber:7,title:'Previously',airDateUtc:new Date(now-2*86400000).toISOString(),hasFile:true},
    {id:2,seasonNumber:2,episodeNumber:8,title:'Latest Chapter',airDateUtc:new Date(now-3600000).toISOString(),hasFile:true},
    {id:3,seasonNumber:2,episodeNumber:9,title:'Next Chapter',airDateUtc:new Date(now+86400000).toISOString(),hasFile:false},
    {id:4,seasonNumber:0,episodeNumber:1,title:'Special',airDateUtc:new Date(now+1800000).toISOString(),hasFile:false}
  ]}}),metadata=await new TvEngineAdapter({enabled:true},client).getSeriesOverlayMetadata('series_2');
  assert.deepEqual(metadata.latestEpisode,{title:'Latest Chapter',seasonNumber:2,episodeNumber:8,airDateUtc:metadata.latestEpisode.airDateUtc});
  assert.deepEqual(metadata.nextEpisode,{title:'Next Chapter',seasonNumber:2,episodeNumber:9,airDateUtc:metadata.nextEpisode.airDateUtc});
  assert.equal(metadata.seasonCount,1);assert.equal(metadata.currentSeason.seasonNumber,2);
});
test('TV attention counts only monitored missing episodes',async()=>{
  const monitored={...seriesRecord,statistics:{episodeCount:4,episodeFileCount:1}};
  const unmonitored={...monitored,id:3,title:'Unmonitored Series',monitored:false};
  const client=new FakeClient({series:[monitored,unmonitored],queue:{records:[]},'wanted/missing':{records:[
    {id:10,seriesId:2,monitored:true},{id:11,seriesId:2,monitored:false},{id:12,seriesId:3,monitored:true}
  ]}});
  const items=await new TvEngineAdapter({enabled:true},client).listSeries();
  assert.equal(items[0].missingEpisodes,1);
  assert.equal(items[1].missingEpisodes,0);
});
test('health adapters remove bundled engine product names from public messages',async()=>{
  const movie=new MovieEngineAdapter({enabled:true},new FakeClient({health:[{type:'warning',source:'Radarr.Core.Health',message:'Radarr will not grab releases'}]}));
  const tv=new TvEngineAdapter({enabled:true},new FakeClient({health:[{type:'warning',source:'Sonarr.Core.Health',message:'Sonarr will not grab episodes'}]}));
  const values=[...(await movie.getHealth()),...(await tv.getHealth())];
  assert.doesNotMatch(JSON.stringify(values),/\b(radarr|sonarr)\b/i);
  assert.match(values[0].message,/movie service/i);
  assert.match(values[1].message,/television service/i);
});
test('authentication failure, timeout, and invalid response are neutral',async()=>{
  const authServer=createServer((req,res)=>{res.writeHead(401);res.end('{}');});await new Promise((resolve)=>authServer.listen(0,'127.0.0.1',resolve));
  const authClient=new ReadOnlyEngineClient({enabled:true,host:'127.0.0.1',port:authServer.address().port,https:false,urlBase:'',apiCredential:'secret',timeoutMs:100,retries:0,tlsVerify:true},'Movie');
  await assert.rejects(()=>authClient.get('movie'),(error)=>error.code==='engine_authentication_failed'&&!error.message.includes('secret'));await new Promise((resolve)=>authServer.close(resolve));
  const slow=createServer(()=>{});await new Promise((resolve)=>slow.listen(0,'127.0.0.1',resolve));const timeoutClient=new ReadOnlyEngineClient({enabled:true,host:'127.0.0.1',port:slow.address().port,https:false,urlBase:'',apiCredential:'secret',timeoutMs:30,retries:0,tlsVerify:true},'TV');
  await assert.rejects(()=>timeoutClient.get('series'),(error)=>error.code==='engine_timeout');await new Promise((resolve)=>slow.close(resolve));
  const invalid=new MovieEngineAdapter({enabled:true},new FakeClient({movie:{wrong:true},queue:{records:[]},'wanted/cutoff':{records:[]}}));await assert.rejects(()=>invalid.listMovies(),(error)=>error.code==='engine_response_invalid');
});
test('engine mutation validation remains actionable',async()=>{
  const server=createServer((req,res)=>{res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify([{errorMessage:"Invalid Path: 'E:/movies'"}]));});await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const client=new ReadOnlyEngineClient({enabled:true,host:'127.0.0.1',port:server.address().port,https:false,urlBase:'',apiCredential:'secret',timeoutMs:100,retries:0,tlsVerify:true},'Movie');
  await assert.rejects(()=>client.post('rootfolder',{path:'E:/movies'}),(error)=>error.code==='engine_validation_failed'&&error.safeMessage==="Invalid Path: 'E:/movies'");
  await new Promise((resolve)=>server.close(resolve));
});
test('bounded cache reuses data, invalidates, and recovers stale values',async()=>{
  let calls=0;const movie=new MovieFixtureAdapter();const original=movie.listMovies.bind(movie);movie.listMovies=async(...args)=>{calls++;return original(...args);};const sync=new SynchronizationService({movie,tv:new TvFixtureAdapter(),maxItems:2,pollIntervalMs:999999});
  assert.equal((await sync.list('movie')).length,2);await sync.list('movie');assert.equal(calls,1);sync.invalidate('movie');await sync.list('movie');assert.equal(calls,2);movie.listMovies=async()=>{throw new Error('private failure');};assert.equal((await sync.synchronize('movie')).length,2);assert.equal(sync.snapshot().movie.status,'stale');
});
test('binary cache expires entries and remains within item and byte limits',async()=>{
  const cache=new BoundedCache({maxItems:2,maxBytes:6,ttlMs:20,sizeOf:value=>value.length});
  cache.set('one',Buffer.alloc(3,1)).set('two',Buffer.alloc(3,2));
  assert.equal(cache.stats().bytes,6);assert.equal(cache.get('one')[0],1);
  cache.set('three',Buffer.alloc(3,3));
  assert.equal(cache.has('two'),false);assert.equal(cache.size,2);assert.equal(cache.stats().bytes,6);
  cache.set('oversized',Buffer.alloc(7));assert.equal(cache.has('oversized'),false);
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(cache.size,0);assert.equal(cache.stats().bytes,0);
});
test('credential vault encrypts, replaces, redacts status, and removes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'vynodearr-vault-'));const path=join(dir,'credentials.enc');const vault=new EncryptedCredentialVault(path,'a-long-review-master-key-value');
  await vault.replace('movie','top-secret-value');assert.equal(await vault.get('movie'),'top-secret-value');const raw=await readFile(path,'utf8');assert.doesNotMatch(raw,/top-secret-value/);assert.deepEqual(await vault.status(),[{name:'movie',configured:true}]);await vault.replace('movie','replacement');assert.equal(await vault.get('movie'),'replacement');await vault.remove('movie');assert.equal(await vault.get('movie'),null);await rm(dir,{recursive:true,force:true});
});
