import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MovieEngineAdapter } from '../packages/movie-domain/src/engine-adapter.js';
import { TvEngineAdapter } from '../packages/tv-domain/src/engine-adapter.js';
import { ReadOnlyEngineClient } from '../packages/platform/src/read-only-engine-client.js';
import { SynchronizationService } from '../packages/platform/src/synchronization-service.js';
import { EncryptedCredentialVault } from '../packages/platform/src/credential-vault.js';
import { MovieFixtureAdapter } from '../packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../packages/tv-domain/src/fixture-adapter.js';

class FakeClient{constructor(values){this.values=values;}async get(path){if(path in this.values)return structuredClone(this.values[path]);return path.startsWith('movie/')?this.values.movieDetail:path.startsWith('series/')?this.values.seriesDetail:[];}}
const movieRecord={id:1,title:'Mapped Movie',year:2025,monitored:true,status:'released',hasFile:true,movieFile:{quality:{quality:{name:'1080p'}}},qualityProfileId:2,path:'/media',tags:[],images:[]};
const seriesRecord={id:2,title:'Mapped Series',year:2024,monitored:true,status:'continuing',network:'Network',qualityProfileId:3,path:'/tv',tags:[],images:[],seasons:[{seasonNumber:1,monitored:true}],statistics:{episodeCount:1,episodeFileCount:1}};
test('movie adapter maps records and all read-only operational surfaces',async()=>{
  const client=new FakeClient({movie:[movieRecord],movieDetail:movieRecord,queue:{records:[]},'wanted/cutoff':{records:[]},history:{records:[]},calendar:[],health:[],'system/status':{version:'1.0'}});
  const adapter=new MovieEngineAdapter({enabled:true},client);assert.equal((await adapter.listMovies())[0].id,'movie_1');assert.equal((await adapter.getMovie('movie_1')).quality,'1080p');assert.equal((await adapter.testConnection()).reachable,true);
});
test('TV adapter maps seasons, episodes, and operational surfaces',async()=>{
  const client=new FakeClient({series:[seriesRecord],seriesDetail:seriesRecord,episode:[{id:4,seasonNumber:1,episodeNumber:1,title:'Pilot',monitored:true,hasFile:true}],queue:{records:[]},history:{records:[]},calendar:[],health:[],'system/status':{version:'1.0'}});
  const adapter=new TvEngineAdapter({enabled:true},client);assert.equal((await adapter.listSeries())[0].id,'series_2');assert.equal((await adapter.getSeries('series_2')).seasons[0].episodes[0].title,'Pilot');
});
test('authentication failure, timeout, and invalid response are neutral',async()=>{
  const authServer=createServer((req,res)=>{res.writeHead(401);res.end('{}');});await new Promise((resolve)=>authServer.listen(0,'127.0.0.1',resolve));
  const authClient=new ReadOnlyEngineClient({enabled:true,host:'127.0.0.1',port:authServer.address().port,https:false,urlBase:'',apiCredential:'secret',timeoutMs:100,retries:0,tlsVerify:true},'Movie');
  await assert.rejects(()=>authClient.get('movie'),(error)=>error.code==='engine_authentication_failed'&&!error.message.includes('secret'));await new Promise((resolve)=>authServer.close(resolve));
  const slow=createServer(()=>{});await new Promise((resolve)=>slow.listen(0,'127.0.0.1',resolve));const timeoutClient=new ReadOnlyEngineClient({enabled:true,host:'127.0.0.1',port:slow.address().port,https:false,urlBase:'',apiCredential:'secret',timeoutMs:30,retries:0,tlsVerify:true},'TV');
  await assert.rejects(()=>timeoutClient.get('series'),(error)=>error.code==='engine_timeout');await new Promise((resolve)=>slow.close(resolve));
  const invalid=new MovieEngineAdapter({enabled:true},new FakeClient({movie:{wrong:true},queue:{records:[]},'wanted/cutoff':{records:[]}}));await assert.rejects(()=>invalid.listMovies(),(error)=>error.code==='engine_response_invalid');
});
test('bounded cache reuses data, invalidates, and recovers stale values',async()=>{
  let calls=0;const movie=new MovieFixtureAdapter();const original=movie.listMovies.bind(movie);movie.listMovies=async(...args)=>{calls++;return original(...args);};const sync=new SynchronizationService({movie,tv:new TvFixtureAdapter(),maxItems:2,pollIntervalMs:999999});
  assert.equal((await sync.list('movie')).length,2);await sync.list('movie');assert.equal(calls,1);sync.invalidate('movie');await sync.list('movie');assert.equal(calls,2);movie.listMovies=async()=>{throw new Error('private failure');};assert.equal((await sync.synchronize('movie')).length,2);assert.equal(sync.snapshot().movie.status,'stale');
});
test('credential vault encrypts, replaces, redacts status, and removes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'vynodenew-vault-'));const path=join(dir,'credentials.enc');const vault=new EncryptedCredentialVault(path,'a-long-review-master-key-value');
  await vault.replace('movie','top-secret-value');assert.equal(await vault.get('movie'),'top-secret-value');const raw=await readFile(path,'utf8');assert.doesNotMatch(raw,/top-secret-value/);assert.deepEqual(await vault.status(),[{name:'movie',configured:true}]);await vault.replace('movie','replacement');assert.equal(await vault.get('movie'),'replacement');await vault.remove('movie');assert.equal(await vault.get('movie'),null);await rm(dir,{recursive:true,force:true});
});
