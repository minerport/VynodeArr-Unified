import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AuthService } from '../.server-build/packages/platform/src/auth-service.js';
import { ProjectionStore } from '../.server-build/packages/platform/src/projection-store.js';
import { SynchronizationService } from '../.server-build/packages/platform/src/synchronization-service.js';
import { MovieFixtureAdapter } from '../.server-build/packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../.server-build/packages/tv-domain/src/fixture-adapter.js';
import { createApplication } from '../.server-build/apps/api/src/app.js';

async function tempAuth(run){
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-n3-auth-'));
  const auth=new AuthService({userFile:join(directory,'users.json'),sessionFile:join(directory,'sessions.json'),secureCookies:false});
  await auth.initialize();try{await run(auth,directory);}finally{await rm(directory,{recursive:true,force:true});}
}
const adminInput={name:'Owner Name',username:'owner',email:'owner@example.test',password:'Strong-review-pass1',confirmPassword:'Strong-review-pass1'};

test('first administrator validates identity uniqueness and setup never repeats',()=>tempAuth(async(auth)=>{
  assert.equal(await auth.setupRequired(),true);const admin=await auth.createInitialAdministrator(adminInput);
  assert.equal(admin.role,'administrator');assert.equal(await auth.setupRequired(),false);
  await assert.rejects(()=>auth.createInitialAdministrator(adminInput),/already complete/);
  await assert.rejects(()=>auth.createUser({...adminInput,role:'viewer'}),/already in use/);
}));
test('account updates email and username, password change invalidates other sessions',()=>tempAuth(async(auth)=>{
  const admin=await auth.createInitialAdministrator(adminInput),current=await auth.createSession(admin,{ip:'10.0.0.4',userAgent:'Mozilla Chrome Windows'}),other=await auth.createSession(admin,{ip:'10.0.0.5',userAgent:'Mozilla Firefox Linux'});
  const updated=await auth.updateAccount(admin.id,{name:'Updated Owner',username:'new-owner',email:'new@example.test',uiStyle:'oled',uiDensity:'compact',motionPreference:'reduced',currentPassword:adminInput.password,newPassword:'Another-strong-pass2',confirmPassword:'Another-strong-pass2'},current.id);
  assert.equal(updated.username,'new-owner');assert.equal(updated.email,'new@example.test');assert.equal(updated.uiStyle,'oled');assert.equal(updated.uiDensity,'compact');assert.equal(updated.motionPreference,'reduced');assert.equal(auth.session(other.id),null);assert.ok(auth.session(current.id));
  const unchanged=await auth.updateAccount(admin.id,{uiStyle:'unsupported',uiDensity:'unsupported',motionPreference:'unsupported'},current.id);
  assert.equal(unchanged.uiStyle,'oled');assert.equal(unchanged.uiDensity,'compact');assert.equal(unchanged.motionPreference,'reduced');
  assert.ok(await auth.login('new@example.test','Another-strong-pass2',{ip:'10.0.0.6'}));
}));
test('session listing masks IP and supports other-session revocation',()=>tempAuth(async(auth)=>{
  const admin=await auth.createInitialAdministrator(adminInput),current=await auth.createSession(admin,{ip:'192.168.1.44',userAgent:'Chrome Windows'}),other=await auth.createSession(admin,{ip:'192.168.1.45',userAgent:'Firefox Linux'});
  const sessions=await auth.listSessions(admin.id,current.id);assert.equal(sessions.length,2);assert.match(sessions[0].ipMasked,/…/);assert.ok(sessions.some((item)=>item.current));
  await auth.revokeOtherSessions(admin.id,current.id);assert.equal(auth.session(other.id),null);
}));
test('administrator creates, disables, roles, resets, forces logout, and safely deletes users',()=>tempAuth(async(auth)=>{
  const admin=await auth.createInitialAdministrator(adminInput),user=await auth.createUser({name:'User',username:'user',email:'user@example.test',password:'Viewer-strong-pass3',role:'user',permissions:{dashboard:true,discover:false,movies:true,tv:false,calendar:true},requestApprovalRequired:true});
  const userSession=await auth.createSession(user,{ip:'127.0.0.1'});
  assert.deepEqual(user.permissions,{dashboard:true,discover:false,movies:true,tv:false,calendar:true});
  assert.equal(user.requestApprovalRequired,false);
  await auth.administerUser(user.id,{action:'permissions',permissions:{discover:true,tv:true},requestApprovalRequired:true},admin.id);
  assert.deepEqual(auth.session(userSession.id).user.permissions,{dashboard:false,discover:true,movies:false,tv:true,calendar:false});
  assert.equal(auth.session(userSession.id).user.requestApprovalRequired,true);
  assert.equal((await auth.administerUser(user.id,{action:'role',role:'administrator'},admin.id)).role,'administrator');
  await auth.administerUser(user.id,{action:'forceLogout'},admin.id);assert.equal(auth.session(userSession.id),null);
  await auth.administerUser(user.id,{action:'disable'},admin.id);assert.equal((await auth.listUsers()).find((item)=>item.id===user.id).enabled,false);
  await auth.administerUser(user.id,{action:'enable'},admin.id);await auth.administerUser(user.id,{action:'resetPassword',password:'Reset-strong-pass4'},admin.id);
  await auth.administerUser(user.id,{action:'delete'},admin.id);assert.equal((await auth.listUsers()).length,1);
  await assert.rejects(()=>auth.administerUser(admin.id,{action:'delete'},admin.id),/own account/);
}));
test('durable projections hydrate and report incremental updates',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-projection-')),store=new ProjectionStore(join(directory,'projections.json'));
  const sync=new SynchronizationService({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter(),projectionStore:store,maxItems:100,pollIntervalMs:999999});
  await sync.startup();assert.equal(sync.snapshot().movie.itemsUpdated,3);await sync.startup();assert.equal(sync.snapshot().movie.itemsUpdated,0);
  const hydrated=new SynchronizationService({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter(),projectionStore:store,maxItems:100,pollIntervalMs:999999});await hydrated.hydrate();assert.equal((await hydrated.list('movie')).length,3);
  await rm(directory,{recursive:true,force:true});
});
test('targeted projection reconciliation updates, adds, removes, and deduplicates one title',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-projection-item-')),store=new ProjectionStore(join(directory,'projections.json'));
  let reads=0,current={id:'movie_1',title:'Changed title',year:2026};
  const movie={listMovies:async()=>[{id:'movie_1',title:'Original title',year:2025}],getMovieSummary:async()=>{reads+=1;await new Promise(resolve=>setTimeout(resolve,10));return current;}};
  const tv={listSeries:async()=>[],getQueue:async()=>[],getHistory:async()=>[],getCalendar:async()=>[],getHealth:async()=>[]};
  Object.assign(movie,{getQueue:async()=>[],getHistory:async()=>[],getCalendar:async()=>[],getHealth:async()=>[]});
  const sync=new SynchronizationService({movie,tv,projectionStore:store,maxItems:100,pollIntervalMs:999999});
  await sync.synchronize('movie');
  const [first,duplicate]=await Promise.all([sync.reconcileItem('movie','movie_1'),sync.reconcileItem('movie','movie_1')]);
  assert.equal(reads,1);assert.equal(first.item.title,'Changed title');assert.equal(duplicate.item.title,'Changed title');assert.equal((await store.domain('movie'))[0].year,2026);
  current={id:'movie_2',title:'Added title',year:2026};await sync.reconcileItem('movie','movie_2');assert.equal((await sync.list('movie')).length,2);
  current=null;const removed=await sync.reconcileItem('movie','movie_2');assert.equal(removed.removed,1);assert.deepEqual((await store.domain('movie')).map(item=>item.id),['movie_1']);
  await rm(directory,{recursive:true,force:true});
});
test('full reconciliation reports removals and notifies subscribers once',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-projection-removal-')),store=new ProjectionStore(join(directory,'projections.json'));
  let items=[{id:'movie_1',title:'One'},{id:'movie_2',title:'Two'}],notifications=[];
  const movie={listMovies:async()=>structuredClone(items),getQueue:async()=>[],getHistory:async()=>[],getCalendar:async()=>[],getHealth:async()=>[]};
  const tv={listSeries:async()=>[],getQueue:async()=>[],getHistory:async()=>[],getCalendar:async()=>[],getHealth:async()=>[]};
  const sync=new SynchronizationService({movie,tv,projectionStore:store,pollIntervalMs:999999});sync.onFullSync(value=>notifications.push(value));
  await sync.synchronize('movie');items=items.slice(0,1);await sync.synchronize('movie');
  assert.equal(sync.snapshot().movie.itemsRemoved,1);assert.equal(sync.snapshot().movie.itemsUpdated,1);assert.equal(notifications.length,2);assert.equal(notifications[1].itemsRemoved,1);
  await rm(directory,{recursive:true,force:true});
});
test('targeted reconciliation waits for an active full reconciliation so the newest item wins',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-projection-order-')),store=new ProjectionStore(join(directory,'projections.json'));
  let releaseFull;const fullReady=new Promise(resolve=>{releaseFull=resolve;});
  const movie={listMovies:async()=>{await fullReady;return[{id:'movie_1',title:'Full snapshot'}];},getMovieSummary:async()=>({id:'movie_1',title:'Newest targeted value'}),getQueue:async()=>[],getHistory:async()=>[],getCalendar:async()=>[],getHealth:async()=>[]};
  const tv={listSeries:async()=>[],getQueue:async()=>[],getHistory:async()=>[],getCalendar:async()=>[],getHealth:async()=>[]};
  const sync=new SynchronizationService({movie,tv,projectionStore:store,pollIntervalMs:999999}),full=sync.synchronize('movie'),targeted=sync.reconcileItem('movie','movie_1');
  releaseFull();await Promise.all([full,targeted]);assert.equal((await sync.list('movie'))[0].title,'Newest targeted value');
  await rm(directory,{recursive:true,force:true});
});
test('operational synchronization is single flight under overlapping callers',async()=>{
  let reads=0,release;const ready=new Promise(resolve=>{release=resolve;});
  const engine={
    getQueue:async()=>{reads+=1;await ready;return[];},getHistory:async()=>[],getCalendar:async()=>[],getHealth:async()=>[]
  };
  const sync=new SynchronizationService({movie:engine,tv:engine,pollIntervalMs:999999});
  const first=sync.synchronizeOperations(),second=sync.synchronizeOperations();
  release();
  assert.strictEqual(await first,await second);
  assert.equal(reads,2,'each engine queue is read once for a shared operation cycle');
});

async function appSession(options,run){
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-n3-api-')),app=createApplication({...options,env:{VYNODEARR_DATA_MODE:'fixture',VYNODEARR_DATA_DIR:directory,VYNODEARR_MASTER_KEY:'test-master-key-with-32-characters',...(options.env||{})}});
  const server=createServer(app.handleRequest);await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const setup=await fetch(`${base}/api/auth/setup`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(adminInput)}),result=await setup.json(),cookie=setup.headers.get('set-cookie').split(';')[0];
    await run({base,cookie,csrf:result.csrf,app});
  }finally{server.closeAllConnections?.();await new Promise((resolve)=>server.close(resolve));app.sync.stopPolling();await rm(directory,{recursive:true,force:true});}
}
test('Reeltrack lists keep API keys server-side and match library titles only by durable external IDs',()=>{
  const reeltrackFetch=async(input,init={})=>{
    const url=String(input);
    assert.equal(init.headers['X-API-Key'],'rt_live_test-key');
    if(url.endsWith('/api/v1/lists'))return new Response(JSON.stringify({data:[{id:5,name:'My watchlist',description:'Imported from Reeltrack',kind:'custom'}]}),{status:200,headers:{'content-type':'application/json'}});
    if(url.includes('/api/v1/lists/5/items'))return new Response(JSON.stringify({data:[
      {mediaId:123,title:'Durable match',type:'movie',year:2026,tmdbId:1003598,source:'tmdb',externalId:'1003598',rank:1},
      {mediaId:124,title:'Durable match',type:'movie',year:2026,tmdbId:9999999,source:'tmdb',externalId:'9999999',rank:2},
      {mediaId:125,title:'TV match',type:'tv',year:2026,source:'tvdb',externalId:'4567',tmdbId:7654,rank:3},
      {mediaId:126,title:'Durable match',type:'movie',year:2026,tmdbId:null,source:'plex',externalId:'1003598',rank:4},
      {mediaId:127,title:'Durable match',type:'movie',year:2026,tmdbId:null,source:'jellyfin',externalId:'1003598',rank:5}
    ]}),{status:200,headers:{'content-type':'application/json'}});
    throw new Error(`Unexpected Reeltrack request: ${url}`);
  };
  const addedLibrary=[],movieRecords=[{id:1,title:'Durable match',tmdbId:1003598}],tvRecords=[{id:2,title:'TV match',tmdbId:7654,tvdbId:4567}],engineClient=(domain,records)=>({get:async(path,query)=>{if(path===(domain==='movie'?'movie':'series'))return records;if(path==='qualityprofile')return[{id:1,name:'Default'}];if(path==='rootfolder')return[{id:1,path:domain==='movie'?'/movies':'/tv'}];if(path===(domain==='movie'?'movie/lookup':'series/lookup')){const id=Number(String(query?.term||'').match(/\d+/)?.[0]);return[{title:`Engine ${id}`,tmdbId:id,...(domain==='tv'?{tvdbId:id}:{})}]};return[];},post:async(path,payload)=>{if(path===(domain==='movie'?'movie':'series')){const value={...payload,id:records.length+10};records.push(value);addedLibrary.push({domain,payload:value});return value}return{};}}),
    movie=Object.assign(new MovieFixtureAdapter(),{client:engineClient('movie',movieRecords),listMovies:async()=>[{id:'movie_durable',title:'Durable match',year:2026,tmdbId:1003598,hasFile:true}]}),
    tv=Object.assign(new TvFixtureAdapter(),{client:engineClient('tv',tvRecords),listSeries:async()=>[{id:'series_durable',title:'TV match',year:2026,tmdbId:7654,tvdbId:4567,episodeProgress:'1 / 2'}]}),
    trailerCalls=[],collectionCalls=[],removeCalls=[],automationState={realArrived:false},trailerDownloader={status:async()=>({available:true,version:'test',root:'/movies',roots:{movie:'/movies',tv:'/tv'}}),download:async(input)=>{trailerCalls.push(input);const root=input.domain==='tv'?'/tv':'/movies';return{...input,path:`${root}/${input.tmdbId}/Trailer.mp4`,folder:`${root}/${input.tmdbId}`};},remove:async job=>{removeCalls.push(job);return true;}},
    discovery={configured:()=>false,setToken:()=>{},details:async(_domain,id)=>({title:`Trailer ${id}`,year:2026,trailer:{url:'https://youtube.com/watch?v=test'}})},
    plexService={inspect:async()=>({endpoint:'http://plex.local:32400',server:{name:'Test Plex',machineIdentifier:'server-1'},libraries:[{key:'1',title:'Movies',type:'movie',uuid:'movies',locations:['/movies']},{key:'2',title:'Shows',type:'show',uuid:'shows',locations:['/tv']}]}),libraryItems:async(_endpoint,_token,library)=>{const domain=library.type==='show'?'tv':'movie',root=domain==='tv'?'/tv':'/movies',calls=trailerCalls.filter(item=>item.domain===domain),placeholders=calls.map((item,index)=>({ratingKey:`${library.key}${200+index}`,title:item.title||`Trailer ${item.tmdbId}`,type:library.type,files:[`${root}/${item.tmdbId}/Trailer.mp4`],Guid:[{id:`tmdb://${item.tmdbId}`}] }));return automationState.realArrived?[...placeholders,...calls.map((item,index)=>({ratingKey:`${library.key}${800+index}`,title:`Real ${item.tmdbId}`,type:library.type,files:[`${root}/${item.tmdbId}/Real.mkv`],Guid:[{id:`tmdb://${item.tmdbId}`}] }))]:placeholders;},refreshLibrary:async()=>true,syncCollection:async(_endpoint,_token,input)=>{collectionCalls.push(input);return{ratingKey:`500-${input.libraryKey}`,title:input.title,itemCount:input.ratingKeys.length};}};
  return appSession({movie,tv,fetcher:reeltrackFetch,trailerDownloader,discovery,plexService},async({base,cookie,csrf})=>{
    const mutationHeaders={cookie,'content-type':'application/json','x-vynodearr-csrf':csrf};
    const connected=await fetch(`${base}/api/reeltrack/connection`,{method:'PUT',headers:mutationHeaders,body:JSON.stringify({apiKey:'rt_live_test-key'})});
    assert.equal(connected.status,200);
    const status=await (await fetch(`${base}/api/reeltrack/status`,{headers:{cookie}})).json();
    assert.deepEqual(status,{configured:true,importedCount:0,updatedAt:null});
    assert.equal(JSON.stringify(status).includes('rt_live_test-key'),false);
    const importedResponse=await fetch(`${base}/api/reeltrack/imported-lists`,{method:'POST',headers:mutationHeaders,body:JSON.stringify({listIds:[5]})});
    assert.equal(importedResponse.status,200);
    const imported=await importedResponse.json(),items=imported.items[0].items;
    assert.equal(items[0].library.id,'movie_durable');
    assert.equal(items[1].library,null,'an identical title must not bypass the external-ID mismatch');
    assert.equal(items[1].canRequest,true);
    assert.equal(items[2].library.id,'series_durable');
    assert.equal(items[3].library,null,'a Plex identity must not be interpreted as a TMDB identity');
    assert.equal(items[3].tmdbId,null);assert.equal(items[3].canRequest,false);
    assert.equal(items[4].library,null,'a Jellyfin identity must not be interpreted as a TMDB identity');
    assert.equal(items[4].tmdbId,null);assert.equal(items[4].canRequest,false);
    const trailerStatus=await (await fetch(`${base}/api/reeltrack/trailers/status`,{headers:{cookie}})).json();assert.equal(trailerStatus.available,true);
    const trailerResponse=await fetch(`${base}/api/reeltrack/trailers/download`,{method:'POST',headers:mutationHeaders,body:JSON.stringify({listId:5,domain:'movie',tmdbId:9999999})});assert.equal(trailerResponse.status,201);assert.equal(trailerCalls.length,1);assert.equal(trailerCalls[0].url,'https://youtube.com/watch?v=test');
    const plexConnection=await fetch(`${base}/api/poster-overlays/plex`,{method:'POST',headers:mutationHeaders,body:JSON.stringify({endpoint:'http://plex.local:32400',token:'plex-token'})});assert.equal(plexConnection.status,200);
    const enabled=await fetch(`${base}/api/reeltrack/imported-lists/5/automation`,{method:'PUT',headers:mutationHeaders,body:JSON.stringify({enabled:true,plexMovieLibraryKey:'1',plexTvLibraryKey:'2',collectionName:'My watchlist',intervalMinutes:60})});assert.equal(enabled.status,200);
    const automated=await fetch(`${base}/api/reeltrack/imported-lists/5/automation/run`,{method:'POST',headers:mutationHeaders}),automatedValue=await automated.json();assert.equal(automated.status,200,JSON.stringify(automatedValue));assert.equal(automatedValue.item.automation.status,'ready');assert.deepEqual(automatedValue.item.automation.plexLibraryLocations,{movie:'/movies',tv:'/tv'});assert.ok((automatedValue.item.automation.summary.libraryAdded||0)+(automatedValue.item.automation.summary.libraryExisting||0)>=3,JSON.stringify(automatedValue.item.automation));assert.ok(addedLibrary.some(item=>item.domain==='movie'&&Number(item.payload.tmdbId)===9999999&&item.payload.addOptions.searchForMovie===false));assert.ok(Object.keys(automatedValue.item.automation.jobs||{}).length>=1,JSON.stringify(automatedValue.item.automation));assert.ok(collectionCalls.some(call=>call.libraryKey==='1'&&call.ratingKeys.length>=1));assert.ok(collectionCalls.some(call=>call.libraryKey==='2'&&call.ratingKeys.length>=1));assert.equal(collectionCalls.at(-1).title,'My watchlist');
    automationState.realArrived=true;const reconciled=await fetch(`${base}/api/reeltrack/imported-lists/5/automation/run`,{method:'POST',headers:mutationHeaders}),reconciledValue=await reconciled.json();assert.equal(reconciled.status,200,JSON.stringify(reconciledValue));assert.ok(removeCalls.length>=1,JSON.stringify(reconciledValue));assert.equal(collectionCalls.at(-1).ratingKeys.length,0,'real Plex media removes managed placeholders from the collection');
  });
});
test('authenticated artwork proxy caches binary responses without exposing engine URLs',()=>appSession({
  movie:Object.assign(new MovieFixtureAdapter(),{getArtwork:async()=>({body:Buffer.from('image-data'),contentType:'image/jpeg'})}),tv:new TvFixtureAdapter()
},async({base,cookie})=>{
  const response=await fetch(`${base}/api/artwork/movie/movie_1/poster`,{headers:{cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');assert.equal(Buffer.from(await response.arrayBuffer()).toString(),'image-data');
  assert.equal((await fetch(`${base}/api/artwork/movie/movie_1/poster`)).status,401);
}));
test('composed posters reuse the same bounded artwork cache as library posters',()=>{
  let artworkReads=0;const movie=Object.assign(new MovieFixtureAdapter(),{getArtwork:async()=>{artworkReads+=1;return{body:Buffer.from('image-data'),contentType:'image/jpeg'};}});
  return appSession({movie,tv:new TvFixtureAdapter()},async({base,cookie})=>{
    assert.equal((await fetch(`${base}/api/artwork/movie/movie_orbit-city/poster`,{headers:{cookie}})).status,200);
    assert.equal((await fetch(`${base}/api/poster-overlays/render/movie/movie_orbit-city`,{headers:{cookie}})).status,200);
    assert.equal(artworkReads,1);
  });
});
test('repeated detail reads are deduplicated without refreshing the full library',()=>{
  let movieDetails=0,tvDetails=0;const movie=new MovieFixtureAdapter(),tv=new TvFixtureAdapter(),readMovie=movie.getMovie.bind(movie),readSeries=tv.getSeries.bind(tv);
  movie.getMovie=async(...args)=>{movieDetails+=1;return readMovie(...args);};tv.getSeries=async(...args)=>{tvDetails+=1;return readSeries(...args);};
  return appSession({movie,tv},async({base,cookie,csrf})=>{
    const first=await (await fetch(`${base}/api/media/movies/movie_orbit-city`,{headers:{cookie}})).json(),second=await (await fetch(`${base}/api/media/movies/movie_orbit-city`,{headers:{cookie}})).json();
    assert.equal(first.freshness.source,'engine');assert.equal(second.freshness.source,'cache');
    await fetch(`${base}/api/media/tv/series_afterlight`,{headers:{cookie}});await fetch(`${base}/api/media/tv/series_afterlight`,{headers:{cookie}});
    assert.equal(movieDetails,1);assert.equal(tvDetails,1);
    const refreshed=await (await fetch(`${base}/api/media/movies/movie_orbit-city?refresh=true`,{headers:{cookie}})).json();assert.equal(refreshed.freshness.source,'engine');assert.equal(movieDetails,2);
    const performance=await (await fetch(`${base}/api/system/performance`,{headers:{cookie}})).json();assert.ok(performance.activity.engineReads>=1);assert.ok(performance.activity.targetedReconciliations>=1);assert.equal(typeof performance.activity.catalogReads,'number');assert.equal(performance.catalog.integrity.movie.healthy,true);assert.equal(performance.sync.movie.workQueue.depth,0);
    const recovery=await fetch(`${base}/api/system/catalog/recovery`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({domain:'movie',action:'retry'})});assert.equal(recovery.status,200);assert.equal((await recovery.json()).integrity.healthy,true);
  });
});
test('dashboard API returns useful product metrics',()=>appSession({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter()},async({base,cookie})=>{
  const response=await fetch(`${base}/api/dashboard`,{headers:{cookie}}),value=await response.json();assert.equal(value.metrics.movies,3);assert.equal(value.metrics.tv,3);assert.ok('missing'in value.metrics&&'upcomingEpisodes'in value.metrics);assert.ok(Array.isArray(value.upcoming));assert.ok(value.recentActivity.length);
  assert.equal(value.analytics.rangeDays,30);assert.equal(value.analytics.downloadsOverTime.movie.length,30);assert.equal(value.analytics.downloadsOverTime.tv.length,30);
  assert.ok(Array.isArray(value.analytics.qualityDistribution.movie));assert.ok(Array.isArray(value.analytics.qualityDistribution.tv));
  assert.equal(value.analytics.library.movie.total,3);assert.equal(value.analytics.library.tv.total,3);
  const diagnostics=await (await fetch(`${base}/api/library/diagnostics?domain=movie`,{headers:{cookie}})).json();
  assert.equal(diagnostics.summary.total,diagnostics.items.length);assert.ok(diagnostics.items.every(item=>item.domain==='movie'&&['#movie/','#wanted','#service/root-folders'].some(prefix=>item.href.startsWith(prefix))&&item.actionLabel));
}));
test('repeated library page reads use the projection until an administrator requests recovery',()=>{
  let fullReads=0;const movie=new MovieFixtureAdapter(),original=movie.listMovies.bind(movie);movie.listMovies=async(...args)=>{fullReads+=1;return original(...args);};movie.getAttentionSummary=async()=>{const error=new Error('Engine attention unavailable');error.safeMessage='Load failed';throw error;};
  return appSession({movie,tv:new TvFixtureAdapter()},async({base,cookie})=>{
    await fetch(`${base}/api/media/movies`,{headers:{cookie}});await fetch(`${base}/api/media/movies`,{headers:{cookie}});assert.equal(fullReads,1);
    const refreshed=await fetch(`${base}/api/media/movies?refresh=true`,{headers:{cookie}}),value=await refreshed.json();assert.equal(refreshed.status,200);assert.equal(value.items.length,3);assert.deepEqual(value.attention,{missing:1,cutoff:1});assert.deepEqual(value.summary,{total:3,monitored:3,covered:2});assert.equal(fullReads,2);
  });
});
test('poster overlays are opt-in, administrator-managed, and safely rendered',()=>appSession({
  movie:Object.assign(new MovieFixtureAdapter(),{getArtwork:async()=>({body:Buffer.from('image-data'),contentType:'image/jpeg'})}),tv:Object.assign(new TvFixtureAdapter(),{getArtwork:async()=>({body:Buffer.from('image-data'),contentType:'image/jpeg'})})
},async({base,cookie,csrf})=>{
  const before=await (await fetch(`${base}/api/media/movies`,{headers:{cookie}})).json(),movie=before.items[0];assert.doesNotMatch(String(movie.artwork?.url||''),/\/api\/poster-overlays\/render\//);
  const created=await fetch(`${base}/api/poster-overlays/templates`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'Quality badge',domain:'movie',layers:[{variable:'title',position:'bottom-left'}]})}),template=(await created.json()).template;assert.equal(created.status,201);
  const tvCreated=await fetch(`${base}/api/poster-overlays/templates`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'TV only',domain:'tv',tvFileAggregation:'best',layers:[{variable:'video_codec'},{variable:'next_episode_code',conditions:{join:'and',rules:[{variable:'next_episode_season',operator:'greater_than',value:'0'},{variable:'series_status',operator:'equals',value:'Continuing'}]}}]})}),tvTemplate=(await tvCreated.json()).template;assert.equal(tvTemplate.tvFileAggregation,'best');
  const mismatch=await fetch(`${base}/api/poster-overlays/assignments`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({templateId:tvTemplate.id,scope:{type:'all',domain:'movie'}})});assert.equal(mismatch.status,400);assert.equal((await mismatch.json()).error.code,'template_domain_mismatch');
  const assigned=await fetch(`${base}/api/poster-overlays/assignments`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'Selected movie',templateId:template.id,scope:{type:'items',domain:'movie',mediaIds:[movie.id]}})});assert.equal(assigned.status,201);
  const tvAssigned=await fetch(`${base}/api/poster-overlays/assignments`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'All television',templateId:tvTemplate.id,scope:{type:'all',domain:'tv'}})});assert.equal(tvAssigned.status,201);
  const after=await (await fetch(`${base}/api/media/movies`,{headers:{cookie}})).json(),decorated=after.items.find(item=>item.id===movie.id);assert.equal(decorated.artwork.url,movie.artwork.url);
  assert.equal(decorated.artwork.overlayTemplateId,template.id);assert.equal(decorated.artwork.overlayTemplate.layers[0].variable,'title');assert.equal(decorated.artwork.overlayValues.title,movie.title);
  const television=await (await fetch(`${base}/api/media/tv`,{headers:{cookie}})).json(),series=television.items[0];assert.equal(series.artwork.overlayValues.video_codec,'HEVC');assert.equal(series.artwork.overlayValues.dynamic_range,'HDR10');assert.equal(series.artwork.overlayValues.next_episode_code,'S02E01');
  const renderedTv=await fetch(`${base}/api/poster-overlays/render/tv/${series.id}`,{headers:{cookie}}),renderedTvSvg=await renderedTv.text();assert.equal(renderedTv.status,200);assert.match(renderedTv.headers.get('content-type'),/image\/svg\+xml/);assert.match(renderedTvSvg,/HEVC/);
  assert.equal((await fetch(`${base}/api/poster-overlays`)).status,401);
}));
test('Plex poster connection previews, applies one title with rollback, and restores it',()=>{const uploads=[],original=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#315c88"/></svg>');return appSession({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter(),plexService:{inspect:async(endpoint,token)=>{assert.equal(endpoint,'http://plex.local:32400');assert.equal(token,'protected-token');return{endpoint,server:{name:'Review Plex',machineIdentifier:'plex-1',version:'1.41.0'},libraries:[{key:'1',title:'Movies',type:'movie',uuid:'movies-1'}]};},libraryItems:async()=>[{ratingKey:'91',title:'Orbit City',thumb:'/library/metadata/91/thumb/7',Guid:[{id:'tmdb://101'}]}],match:items=>items.map((item,index)=>({domain:item.domain,id:item.id,title:item.title,year:item.year,externalIds:index===0?['tmdb:101']:[],status:index===0?'matched':'unmatched',plex:index===0?[{ratingKey:'91',title:'Orbit City',year:2025,type:'movie',thumb:'/library/metadata/91/thumb/7'}]:[]})),artwork:async()=>({body:original,contentType:'image/svg+xml'}),uploadPoster:async(endpoint,token,ratingKey,value,contentType)=>{uploads.push({endpoint,token,ratingKey,value,contentType});}}},async({base,cookie,csrf})=>{
  assert.equal((await fetch(`${base}/api/poster-overlays/plex`)).status,401);
  const saved=await fetch(`${base}/api/poster-overlays/plex`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({endpoint:'http://plex.local:32400',token:'protected-token'})}),value=await saved.json();
  assert.equal(saved.status,200);assert.equal(value.configured,true);assert.equal(value.artworkWritesEnabled,true);assert.equal(value.server.name,'Review Plex');assert.equal(value.token,undefined);
  const status=await (await fetch(`${base}/api/poster-overlays/plex`,{headers:{cookie}})).json();assert.equal(status.configured,true);assert.equal(status.libraries[0].title,'Movies');assert.equal(JSON.stringify(status).includes('protected-token'),false);
  const reviewed=await fetch(`${base}/api/poster-overlays/plex/matches`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({libraryKeys:['1']})}),review=await reviewed.json();assert.equal(reviewed.status,200);assert.equal(review.summary.matched,1);assert.equal(review.artworkWritesEnabled,true);assert.equal(typeof review.entries[0].variableValues,'object');
  const vynodeStyleResponse=await fetch(`${base}/api/poster-overlays/templates`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'VynodeArr only',domain:'movie',target:'vynode',layers:[{variable:'title'}]})}),vynodeStyle=(await vynodeStyleResponse.json()).template;
  const styleResponse=await fetch(`${base}/api/poster-overlays/templates`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'Plex preview',domain:'movie',target:'plex',plexBadges:{monitored:true,availability:true,cutoff:true,rating:true},layers:[{variable:'title'}]})}),style=(await styleResponse.json()).template,matched=review.entries.find(item=>item.status==='matched'),params=new URLSearchParams({libraryKey:'1',ratingKey:'91',templateId:style.id});
  assert.equal(style.target,'plex');assert.equal(vynodeStyle.target,'vynode');
  const originalResponse=await fetch(`${base}/api/poster-overlays/plex/original/movie/${matched.id}?${params}`,{headers:{cookie}});assert.equal(originalResponse.status,200);assert.deepEqual(Buffer.from(await originalResponse.arrayBuffer()),original);
  const wrongPreviewParams=new URLSearchParams({libraryKey:'1',ratingKey:'91',templateId:vynodeStyle.id}),wrongPreview=await fetch(`${base}/api/poster-overlays/plex/preview/movie/${matched.id}?${wrongPreviewParams}`,{headers:{cookie}});assert.equal(wrongPreview.status,400);
  const preview=await fetch(`${base}/api/poster-overlays/plex/preview/movie/${matched.id}?${params}`,{headers:{cookie}}),previewBytes=Buffer.from(await preview.arrayBuffer());assert.equal(preview.status,200);assert.match(preview.headers.get('content-type'),/image\/jpeg/);assert.ok(previewBytes.length>original.length);
  const wrongTarget=await fetch(`${base}/api/poster-overlays/plex/apply`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({templateId:vynodeStyle.id,domain:'movie',mediaId:matched.id,libraryKey:'1',ratingKey:'91'})});assert.equal(wrongTarget.status,400);assert.equal(uploads.length,0);
  const applied=await fetch(`${base}/api/poster-overlays/plex/apply`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({templateId:style.id,domain:'movie',mediaId:matched.id,libraryKey:'1',ratingKey:'91'})}),application=(await applied.json()).application;assert.equal(applied.status,201);assert.equal(application.status,'applied');assert.equal(typeof application.variableValues,'object');assert.equal(uploads.length,1);assert.equal(uploads[0].contentType,'image/jpeg');assert.deepEqual(uploads[0].value,previewBytes);assert.notDeepEqual(uploads[0].value,original);
  const restored=await fetch(`${base}/api/poster-overlays/plex/applications/${application.id}/restore`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:'{}'});assert.equal(restored.status,200);assert.equal((await restored.json()).application.status,'restored');assert.equal(uploads.length,2);assert.deepEqual(uploads[1].value,original);assert.equal(uploads[1].contentType,'image/svg+xml');
  const batchTarget={domain:'movie',mediaId:matched.id,title:matched.title,libraryKey:'1',ratingKey:'91'},batch=await fetch(`${base}/api/poster-overlays/plex/apply-batch`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({templateId:style.id,targets:[batchTarget]})}),batchValue=await batch.json();assert.equal(batch.status,200);assert.deepEqual(batchValue.summary,{requested:1,applied:1,failed:0});assert.equal(uploads.length,3);
  const duplicateBatch=await fetch(`${base}/api/poster-overlays/plex/apply-batch`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({templateId:style.id,targets:[batchTarget,batchTarget]})});assert.equal(duplicateBatch.status,400);assert.equal(uploads.length,3);
  const removed=await fetch(`${base}/api/poster-overlays/plex`,{method:'DELETE',headers:{cookie,'x-vynodearr-csrf':csrf}});assert.equal(removed.status,200);assert.equal((await removed.json()).configured,false);
});});
test('encrypted application backups can be downloaded once and inspected before restore',()=>appSession({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter()},async({base,cookie,csrf})=>{
  const password='Portable-backup-passphrase-27';
  const created=await fetch(`${base}/api/system/application-backup`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({password,includeHistory:false,includeAudit:true})}),createdValue=await created.json();
  assert.equal(created.status,201);assert.match(createdValue.filename,/\.vynodearr-backup$/);
  const downloaded=await fetch(`${base}${createdValue.downloadUrl}`,{headers:{cookie}}),archive=await downloaded.arrayBuffer();
  assert.equal(downloaded.status,200);assert.ok(archive.byteLength>100);
  assert.equal((await fetch(`${base}${createdValue.downloadUrl}`,{headers:{cookie}})).status,404,'application backup download must be one-time');
  const inspectForm=new FormData();inspectForm.append('file',new Blob([archive]),createdValue.filename);inspectForm.append('password',password);
  const inspected=await fetch(`${base}/api/system/application-backup/inspect`,{method:'POST',headers:{cookie,'x-vynodearr-csrf':csrf},body:inspectForm}),summary=(await inspected.json()).summary;
  assert.equal(inspected.status,200);assert.equal(summary.groups.identity,true);assert.equal(summary.groups.audit,true);assert.equal(summary.groups.history,false);assert.ok(summary.fileCount>=2);
  const wrongForm=new FormData();wrongForm.append('file',new Blob([archive]),createdValue.filename);wrongForm.append('password','Incorrect-backup-password-27');
  const wrong=await fetch(`${base}/api/system/application-backup/inspect`,{method:'POST',headers:{cookie,'x-vynodearr-csrf':csrf},body:wrongForm});
  assert.equal(wrong.status,400);assert.match((await wrong.json()).error.message,/incorrect|damaged/i);
}));
test('administrator validation center reports installation checks and restricts repairs',()=>appSession({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter()},async({base,cookie,csrf})=>{
  assert.equal((await fetch(`${base}/api/system/validation`)).status,401);
  const response=await fetch(`${base}/api/system/validation`,{headers:{cookie}}),report=await response.json();
  assert.equal(response.status,200);assert.ok(['healthy','warning','failed'].includes(report.overall));assert.ok(report.checks.some(item=>item.id==='movie-connection'));assert.ok(report.checks.some(item=>item.id==='application-data'));assert.equal(report.summary.healthy+report.summary.warning+report.summary.failed,report.checks.length);
  const unsupported=await fetch(`${base}/api/system/validation/repair`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({action:'delete-everything'})});
  assert.equal(unsupported.status,400);assert.equal((await unsupported.json()).error.code,'unsupported_repair');
  const synchronized=await fetch(`${base}/api/system/validation/repair`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({action:'synchronize'})});
  assert.equal(synchronized.status,200);assert.equal((await synchronized.json()).repaired,true);
}));
test('interactive movie grabs create search activity and an in-app notification',()=>{
  const release={title:'Review.Movie.2026.1080p.WEB-DL',guid:'review-guid',indexerId:4,mappedMovieId:7,size:2147483648,quality:{quality:{name:'WEBDL-1080p'}}},posts=[];
  const client={get:async(path)=>{if(path==='release')return[release];if(path==='movie/7')return{id:7,title:'Review Movie'};if(path==='queue')return{records:[{id:91,movieId:7,status:'downloading'}]};if(path==='history')return{records:[]};throw new Error(`Unexpected movie GET ${path}`);},post:async(path,payload)=>{assert.equal(path,'release');posts.push(payload);return{id:91};},delete:async()=>({})};
  const movie=Object.assign(new MovieFixtureAdapter(),{client});
  return appSession({movie,tv:new TvFixtureAdapter()},async({base,cookie,csrf})=>{
    const grabbed=await fetch(`${base}/api/manage/movie/releases`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify(release)});assert.equal(grabbed.status,201);assert.equal(posts.length,1);
    const activities=(await (await fetch(`${base}/api/search-activities`,{headers:{cookie}})).json()).items,activity=activities.find(item=>item.source==='interactive');assert.equal(activity.movieId,7);assert.equal(activity.title,'Review Movie');assert.equal(activity.status,'downloading');
    const notifications=(await (await fetch(`${base}/api/notifications`,{headers:{cookie}})).json()).items,notification=notifications.find(item=>item.type==='grabbed');assert.equal(notification.title,'Review Movie was grabbed');assert.equal(notification.href,'#queue');
  });
});
test('download decisions retain native candidate evidence and automatic selection',()=>{
  const candidates=[{title:'Accepted.Movie.1080p',guid:'accepted-guid',indexerId:1,indexer:'Review Indexer',size:2147483648,age:2,seeders:44,customFormatScore:120,preferredWordScore:10,isUpgrade:true,quality:{quality:{name:'WEBDL-1080p'}},mappedMovieId:7,rejections:[]},{title:'Rejected.Movie.720p',guid:'rejected-guid',indexerId:1,indexer:'Review Indexer',size:1073741824,age:8,seeders:2,customFormatScore:-25,quality:{quality:{name:'HDTV-720p'}},mappedMovieId:7,rejections:['Quality for existing file on disk is of equal or higher preference','Not enough seeders']}],posts=[];
  const client={get:async(path)=>{if(path==='release')return candidates;if(path==='movie/7')return{id:7,title:'Decision Movie'};throw new Error(`Unexpected movie GET ${path}`);},post:async(path,payload)=>{assert.equal(path,'release');posts.push(payload);return{id:88};},delete:async()=>({})},movie=Object.assign(new MovieFixtureAdapter(),{client});
  return appSession({movie,tv:new TvFixtureAdapter()},async({base,cookie,csrf})=>{
    const searched=await fetch(`${base}/api/manage/movie/releases?movieId=7`,{headers:{cookie}});assert.equal(searched.status,200);
    let decisions=(await (await fetch(`${base}/api/download-decisions`,{headers:{cookie}})).json()).items;assert.equal(decisions.length,2);assert.equal(decisions.find(item=>item.decision==='rejected').seeders,2);assert.match(decisions.find(item=>item.decision==='rejected').reasons.join(' '),/higher preference/);
    const automatic=await fetch(`${base}/api/manage/movie/automaticSearch`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({movieId:7})});assert.equal(automatic.status,201);assert.equal(posts.length,1);
    decisions=(await (await fetch(`${base}/api/download-decisions?decision=selected`,{headers:{cookie}})).json()).items;assert.equal(decisions.length,1);assert.equal(decisions[0].title,'Accepted.Movie.1080p');assert.equal(decisions[0].upgradeEligible,true);
  });
});
test('native engine background grabs appear as upgrade decisions',()=>{
  const grabbed={id:501,eventType:'grabbed',date:'2026-08-03T01:00:00Z',movie:{id:7,title:'Background Movie'},sourceTitle:'Background.Movie.2026.1080p.WEB-DL.PROPER',downloadId:'rss-501',quality:{quality:{name:'WEBDL-1080p'}},customFormatScore:125,data:{indexer:'RSS Indexer',protocol:'torrent',isUpgrade:'true',customFormatScore:125}},deleted={id:502,eventType:'movieFileDeleted',date:'2026-08-03T01:02:00Z',movie:{id:7,title:'Background Movie'},downloadId:'rss-501',quality:{quality:{name:'WEBDL-1080p'}},customFormatScore:25,data:{customFormatScore:25}},imported={id:503,eventType:'downloadFolderImported',date:'2026-08-03T01:03:00Z',movie:{id:7,title:'Background Movie'},downloadId:'rss-501',quality:{quality:{name:'WEBDL-1080p'}},data:{isUpgrade:'true'}},history={records:[imported,deleted,grabbed]};
  const client={get:async path=>path==='queue'?{records:[]}:path==='history'?history:[]},movie=Object.assign(new MovieFixtureAdapter(),{client}),tv=Object.assign(new TvFixtureAdapter(),{client:{get:async path=>path==='queue'||path==='history'?{records:[]}:[]}});
  return appSession({movie,tv,env:{VYNODEARR_DATA_MODE:'engine'}},async({base,cookie})=>{
    assert.equal((await fetch(`${base}/api/notifications`,{headers:{cookie}})).status,200);
    const decisions=(await (await fetch(`${base}/api/download-decisions`,{headers:{cookie}})).json()).items,item=decisions.find(value=>value.source==='engine');
    assert.equal(item.title,grabbed.sourceTitle);assert.equal(item.previousQuality,'WEBDL-1080p');assert.equal(item.previousCustomFormatScore,25);assert.equal(item.currentCustomFormatScore,125);assert.equal(item.upgradeEligible,true);assert.match(item.reasons.join(' '),/score improved from 25 to 125/i);
    const activities=(await (await fetch(`${base}/api/search-activities`,{headers:{cookie}})).json()).items,activity=activities.find(value=>value.source==='engine');
    assert.equal(activity.title,'Background Movie');assert.equal(activity.movieId,7);assert.equal(activity.status,'imported');assert.match(activity.message,/imported into the library/i);
  });
});
test('native replacement events without download IDs still explain same-quality grabs',()=>{
  const grabbed={id:701,eventType:'grabbed',date:'2026-08-03T01:00:00Z',movie:{id:9,title:'Same Quality Movie'},sourceTitle:'Same.Quality.Movie.2026.1080p.WEB-DL',downloadId:'rss-701',quality:{quality:{name:'WEBDL-1080p'}},customFormatScore:0,data:{indexer:'RSS Indexer',protocol:'usenet'}},deleted={id:702,eventType:'movieFileDeleted',date:'2026-08-03T01:02:00Z',movie:{id:9,title:'Same Quality Movie'},quality:{quality:{name:'WEBDL-1080p'}},customFormatScore:0,data:{reason:'Upgrade'}},imported={id:703,eventType:'downloadFolderImported',date:'2026-08-03T01:03:00Z',movie:{id:9,title:'Same Quality Movie'},downloadId:'rss-701',quality:{quality:{name:'WEBDL-1080p'}},data:{}};
  const client={get:async path=>path==='queue'?{records:[]}:path==='history'?{records:[imported,deleted,grabbed]}:[]},movie=Object.assign(new MovieFixtureAdapter(),{client}),tv=Object.assign(new TvFixtureAdapter(),{client:{get:async path=>path==='queue'||path==='history'?{records:[]}:[]}});
  return appSession({movie,tv,env:{VYNODEARR_DATA_MODE:'engine'}},async({base,cookie})=>{
    await fetch(`${base}/api/notifications`,{headers:{cookie}});const decisions=(await (await fetch(`${base}/api/download-decisions`,{headers:{cookie}})).json()).items,item=decisions.find(value=>value.id.includes('701'));
    assert.equal(item.upgradeEligible,true);assert.equal(item.previousQuality,'WEBDL-1080p');assert.match(item.reasons.join(' '),/same-quality replacement/i);assert.match(item.reasons.join(' '),/replacement reason: Upgrade/i);
  });
});
test('native engine grabs remain pending until import evidence arrives',()=>{
  const grabbed={id:601,eventType:'grabbed',date:'2026-08-03T01:00:00Z',movie:{id:8,title:'Pending Movie'},sourceTitle:'Pending.Movie.2026.1080p.WEB-DL',downloadId:'rss-601',quality:{quality:{name:'WEBDL-1080p'}},data:{indexer:'RSS Indexer',protocol:'torrent'}};
  const client={get:async path=>path==='queue'?{records:[]}:path==='history'?{records:[grabbed]}:[]},movie=Object.assign(new MovieFixtureAdapter(),{client}),tv=Object.assign(new TvFixtureAdapter(),{client:{get:async path=>path==='queue'||path==='history'?{records:[]}:[]}});
  return appSession({movie,tv,env:{VYNODEARR_DATA_MODE:'engine'}},async({base,cookie})=>{
    await fetch(`${base}/api/notifications`,{headers:{cookie}});const decisions=(await (await fetch(`${base}/api/download-decisions`,{headers:{cookie}})).json()).items,item=decisions.find(value=>value.id.includes('601'));
    assert.equal(item.upgradeEligible,null);assert.match(item.reasons.join(' '),/waiting for the engine import event/i);
  });
});
test('user page permissions are enforced by APIs and update active sessions immediately',()=>appSession({},async({base,cookie,csrf})=>{
  const create=await fetch(`${base}/api/admin/users`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'Limited User',username:'limited',email:'limited@example.test',password:'Limited-strong-pass5',role:'user',permissions:{dashboard:false,discover:true,movies:true,tv:false,calendar:true}})});
  assert.equal(create.status,201);const created=(await create.json()).user;
  const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'limited',password:'Limited-strong-pass5'})});
  assert.equal(login.status,200);const userLogin=await login.json(),userCookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${base}/api/dashboard`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/media/movies`,{headers:{cookie:userCookie}})).status,200);
  assert.equal((await fetch(`${base}/api/media/movies?refresh=true`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/media/tv`,{headers:{cookie:userCookie}})).status,403);
  const calendarResponse=await fetch(`${base}/api/calendar?start=2026-08-01&end=2026-09-01&movies=true&tv=false`,{headers:{cookie:userCookie}});
  assert.equal(calendarResponse.status,200);
  assert.ok((await calendarResponse.json()).items.every(item=>item.domain==='movie'));
  assert.equal((await fetch(`${base}/api/discover/status`,{headers:{cookie:userCookie}})).status,200);
  const presenceResponse=await fetch(`${base}/api/discover/library-presence`,{headers:{cookie:userCookie}}),presence=await presenceResponse.json();
  assert.equal(presenceResponse.status,200);assert.equal(presence.items.length,6);
  assert.ok(presence.items.filter(item=>item.domain==='movie').every(item=>item.canView===true));
  assert.ok(presence.items.filter(item=>item.domain==='tv').every(item=>item.canView===false));
  assert.equal((await fetch(`${base}/api/requests/mine`,{headers:{cookie:userCookie}})).status,200);
  assert.equal((await fetch(`${base}/api/settings/engines`,{headers:{cookie:userCookie}})).status,403);
  const userCollections=await fetch(`${base}/api/collections`,{headers:{cookie:userCookie}});assert.equal(userCollections.status,200);assert.equal((await userCollections.json()).userCollections.length,1);
  assert.equal((await fetch(`${base}/api/activity/history`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/system/health`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/library/diagnostics`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/import-jobs`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/import-jobs`,{method:'POST',headers:{cookie:userCookie,'content-type':'application/json','x-vynodearr-csrf':userLogin.csrf},body:JSON.stringify({domain:'movie',items:[{title:'Not allowed',payload:{}}]})})).status,403);
  assert.equal((await fetch(`${base}/api/system/sync`,{method:'POST',headers:{cookie:userCookie,'x-vynodearr-csrf':userLogin.csrf}})).status,403);
  const update=await fetch(`${base}/api/admin/users/${created.id}`,{method:'PATCH',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({action:'permissions',permissions:{dashboard:true,discover:false,movies:false,tv:true,calendar:false}})});
  assert.equal(update.status,200);
  assert.equal((await fetch(`${base}/api/dashboard`,{headers:{cookie:userCookie}})).status,200);
  assert.equal((await fetch(`${base}/api/media/movies`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/media/tv`,{headers:{cookie:userCookie}})).status,200);
  assert.equal((await fetch(`${base}/api/calendar`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/discover/status`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/discover/library-presence`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/requests/mine`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/system/sync`,{method:'POST',headers:{cookie,'x-vynodearr-csrf':csrf}})).status,200);
  const audit=(await (await fetch(`${base}/api/manage/audit`,{headers:{cookie}})).json()).items;
  assert.ok(audit.some(item=>item.action==='synchronization.started'));
  assert.ok(audit.some(item=>item.action==='user.permissions'&&item.metadata.targetUserId===created.id));
  assert.ok(audit.some(item=>item.action==='user.request_limits_removed'&&item.metadata.targetUserId===created.id));
}));
test('approval-required Discover requests stay out of the engine until an administrator approves them',()=>{
  const library=[],posts=[];
  const movieClient={
    get:async(path)=>{
      if(path==='qualityprofile')return[{id:1,name:'HD'}];
      if(path==='rootfolder')return[{id:1,path:'/movies'}];
      if(path==='movie')return library;
      if(path==='queue'||path==='history')return{records:[]};
      throw new Error(`Unexpected movie GET ${path}`);
    },
    post:async(path,payload)=>{
      assert.equal(path,'movie');posts.push(payload);const result={...payload,id:99,title:payload.title||'Approval Film',year:2026,hasFile:false};library.push(result);return result;
    },
    delete:async()=>({})
  };
  const discovery={token:'test-discovery-token',configured:()=>true,setToken:()=>{},details:async(_domain,id)=>({tmdbId:Number(id),tvdbId:null,title:Number(id)===123?'Approval Film':`Approval Film ${id}`,year:2026,poster:'https://image.test/poster.jpg',backdrop:'https://image.test/backdrop.jpg',overview:'A request awaiting a deliberate decision.',rating:8.4,genres:['Drama'],runtime:112,certification:'PG-13'})};
  return appSession({movie:Object.assign(new MovieFixtureAdapter(),{client:movieClient,listMovies:async()=>library}),tv:new TvFixtureAdapter(),discovery},async({base,cookie,csrf})=>{
    const create=await fetch(`${base}/api/admin/users`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'Approval User',username:'approval-user',email:'approval@example.test',password:'Approval-strong-pass6',role:'user',permissions:{discover:true},requestApprovalRequired:true,requestLimits:{enabled:true,period:'weekly',movie:2,tv:1,maxPending:null}})});
    const created=(await create.json()).user;assert.equal(created.requestApprovalRequired,true);assert.equal(created.requestLimits.movie,2);
    const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'approval-user',password:'Approval-strong-pass6'})}),userLogin=await login.json(),userCookie=login.headers.get('set-cookie').split(';')[0];
    const requested=await fetch(`${base}/api/discover/request`,{method:'POST',headers:{cookie:userCookie,'content-type':'application/json','x-vynodearr-csrf':userLogin.csrf},body:JSON.stringify({domain:'movie',tmdbId:123,payload:{tmdbId:123,title:'Approval Film',year:2026,rootFolderPath:'/movies',qualityProfileId:1,monitored:true,addOptions:{searchForMovie:true}}})}),requestValue=await requested.json();
    assert.equal(requested.status,202);assert.equal(requestValue.request.status,'pending_approval');assert.equal(posts.length,0);
    const adminNotifications=await (await fetch(`${base}/api/notifications`,{headers:{cookie}})).json();
    assert.equal(adminNotifications.unread,1);assert.equal(adminNotifications.items[0].type,'approval');assert.equal(adminNotifications.items[0].href,'#request-management');assert.deepEqual(adminNotifications.pageBadge,{href:'#request-management',count:1});
    const testNotification=await fetch(`${base}/api/notifications/test`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:'{}'});assert.equal(testNotification.status,201);
    const reviewedAdminRequests=await fetch(`${base}/api/notifications/review-requests`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:'{}'}),reviewedAdminValue=await reviewedAdminRequests.json();
    assert.equal(reviewedAdminRequests.status,200);assert.deepEqual(reviewedAdminValue.reviewed,[adminNotifications.items[0].id]);
    const reviewedAdminNotifications=await (await fetch(`${base}/api/notifications`,{headers:{cookie}})).json();
    assert.equal(reviewedAdminNotifications.unread,1);assert.deepEqual(reviewedAdminNotifications.pageBadge,{href:'#request-management',count:0});
    const mine=(await (await fetch(`${base}/api/requests/mine`,{headers:{cookie:userCookie}})).json()).items;
    assert.equal(mine[0].status,'pending_approval');assert.equal(mine[0].poster,'https://image.test/poster.jpg');assert.equal('payload'in mine[0],false);
    const administered=(await (await fetch(`${base}/api/requests`,{headers:{cookie}})).json()).items;
    assert.equal(administered[0].user.id,created.id);assert.equal(administered[0].canApprove,true);
    const approved=await fetch(`${base}/api/requests/${requestValue.request.id}/approve`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:'{}'});
    assert.equal(approved.status,200);assert.equal(posts.length,1);
    const retainedAdminNotifications=await (await fetch(`${base}/api/notifications`,{headers:{cookie}})).json();
    assert.equal(retainedAdminNotifications.items.some(item=>item.id===adminNotifications.items[0].id),true);assert.equal(retainedAdminNotifications.items.find(item=>item.id===adminNotifications.items[0].id).type,'approved');assert.deepEqual(retainedAdminNotifications.pageBadge,{href:'#request-management',count:0});
    const duplicate=await fetch(`${base}/api/requests/${requestValue.request.id}/approve`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:'{}'});
    assert.equal(duplicate.status,409);assert.equal(posts.length,1);
    const duplicateSubmission=await fetch(`${base}/api/discover/request`,{method:'POST',headers:{cookie:userCookie,'content-type':'application/json','x-vynodearr-csrf':userLogin.csrf},body:JSON.stringify({domain:'movie',tmdbId:123,payload:{tmdbId:123,title:'Alternate Approval Film Title',year:2025,rootFolderPath:'/movies',qualityProfileId:1,monitored:true,addOptions:{searchForMovie:true}}})});
    assert.equal(duplicateSubmission.status,400);assert.match((await duplicateSubmission.json()).error.message,/already in your library/i);assert.equal(posts.length,1);
    const updated=(await (await fetch(`${base}/api/requests/mine`,{headers:{cookie:userCookie}})).json()).items[0];
    assert.equal(updated.status,'searching');assert.equal(updated.engineId,99);
    const adminCollections=await (await fetch(`${base}/api/collections`,{headers:{cookie}})).json(),approvalCollection=adminCollections.userCollections.find(item=>item.user.id===created.id);assert.equal(approvalCollection.movies[0].title,'Approval Film');assert.equal(approvalCollection.movies[0].collectionSource,'request');assert.equal(approvalCollection.television.length,0);
    const privateCollections=await (await fetch(`${base}/api/collections`,{headers:{cookie:userCookie}})).json();assert.deepEqual(privateCollections.userCollections.map(item=>item.user.id),[created.id]);
    const secondRequest=await fetch(`${base}/api/discover/request`,{method:'POST',headers:{cookie:userCookie,'content-type':'application/json','x-vynodearr-csrf':userLogin.csrf},body:JSON.stringify({domain:'movie',tmdbId:124,payload:{tmdbId:124,title:'Approval Film 124',year:2026,rootFolderPath:'/movies',qualityProfileId:1,monitored:true,addOptions:{searchForMovie:true}}})}),secondValue=await secondRequest.json();
    const emptyReason=await fetch(`${base}/api/requests/${secondValue.request.id}/reject`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({reason:'   '})});
    assert.equal(emptyReason.status,400);
    const rejected=await fetch(`${base}/api/requests/${secondValue.request.id}/reject`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({reason:'Already available on another service.'})});
    assert.equal(rejected.status,200);
    const rejectedHistory=(await (await fetch(`${base}/api/requests/mine`,{headers:{cookie:userCookie}})).json()).items.find(item=>item.id===secondValue.request.id);
    assert.equal(rejectedHistory.status,'rejected');assert.equal(rejectedHistory.rejectionReason,'Already available on another service.');assert.match(rejectedHistory.message,/Declined by an administrator/);
    const userNotifications=await (await fetch(`${base}/api/notifications`,{headers:{cookie:userCookie}})).json();
    assert.ok(userNotifications.items.some(item=>item.type==='approved'&&item.requestId===requestValue.request.id));
    assert.ok(userNotifications.items.some(item=>item.type==='rejected'&&item.requestId===secondValue.request.id&&item.href==='#requests'));
    assert.equal(userNotifications.pageBadge.href,'#requests');assert.equal(userNotifications.pageBadge.count,userNotifications.items.filter(item=>item.category==='request'&&item.href==='#requests'&&!item.read).length);
    const reviewedUserRequests=await fetch(`${base}/api/notifications/review-requests`,{method:'POST',headers:{cookie:userCookie,'content-type':'application/json','x-vynodearr-csrf':userLogin.csrf},body:'{}'});assert.equal(reviewedUserRequests.status,200);
    const reviewedUserNotifications=await (await fetch(`${base}/api/notifications`,{headers:{cookie:userCookie}})).json();assert.equal(reviewedUserNotifications.pageBadge.count,0);
    const allowance=(await (await fetch(`${base}/api/requests/allowance`,{headers:{cookie:userCookie}})).json()).allowance;
    assert.equal(allowance.movie.used,2);assert.equal(allowance.movie.remaining,0);assert.equal(allowance.tv.remaining,1);
    const limited=await fetch(`${base}/api/discover/request`,{method:'POST',headers:{cookie:userCookie,'content-type':'application/json','x-vynodearr-csrf':userLogin.csrf},body:JSON.stringify({domain:'movie',tmdbId:125,payload:{tmdbId:125,title:'Approval Film 125',year:2026,rootFolderPath:'/movies',qualityProfileId:1,monitored:true,addOptions:{searchForMovie:true}}})});
    assert.equal(limited.status,429);assert.equal((await limited.json()).error.code,'request_limit_reached');
    const cancelled=await fetch(`${base}/api/requests/mine/${requestValue.request.id}`,{method:'DELETE',headers:{cookie:userCookie,'x-vynodearr-csrf':userLogin.csrf}});
    assert.equal(cancelled.status,200);
    const cancelledHistory=(await (await fetch(`${base}/api/requests/mine`,{headers:{cookie:userCookie}})).json()).items.find(item=>item.id===requestValue.request.id);
    assert.equal(cancelledHistory.status,'canceled');assert.equal(cancelledHistory.statusLabel,'Cancelled by user');assert.equal(cancelledHistory.rejectionReason,null);
    const allowanceAfterCancel=(await (await fetch(`${base}/api/requests/allowance`,{headers:{cookie:userCookie}})).json()).allowance;
    assert.equal(allowanceAfterCancel.movie.used,1);assert.equal(allowanceAfterCancel.movie.remaining,1);
    const retried=await fetch(`${base}/api/discover/request`,{method:'POST',headers:{cookie:userCookie,'content-type':'application/json','x-vynodearr-csrf':userLogin.csrf},body:JSON.stringify({domain:'movie',tmdbId:125,payload:{tmdbId:125,title:'Approval Film 125',year:2026,rootFolderPath:'/movies',qualityProfileId:1,monitored:true,addOptions:{searchForMovie:true}}})});
    assert.equal(retried.status,202);
    assert.equal((await fetch(`${base}/api/manage/audit`,{headers:{cookie:userCookie}})).status,403);
    const audit=(await (await fetch(`${base}/api/manage/audit`,{headers:{cookie}})).json()).items;
    assert.ok(audit.some(item=>item.action==='user.created'&&item.metadata.targetUserId===created.id));
    assert.ok(audit.some(item=>item.action==='request.approved'&&item.metadata.requestId===requestValue.request.id));
    assert.ok(audit.some(item=>item.action==='request.rejected'&&item.metadata.reason==='Already available on another service.'));
    assert.ok(audit.some(item=>item.action==='request.blocked_by_limit'));
  });
});
test('master-key status is administrator-only and environment-managed rotation is refused',()=>appSession({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter()},async({base,cookie,csrf})=>{
  assert.equal((await fetch(`${base}/api/system/master-key`)).status,401);
  const statusResponse=await fetch(`${base}/api/system/master-key`,{headers:{cookie}}),status=await statusResponse.json();
  assert.equal(statusResponse.status,200);assert.equal(status.managed,false);assert.equal(status.canRotate,false);
  const withoutCsrf=await fetch(`${base}/api/system/master-key/rotate`,{method:'POST',headers:{cookie}});
  assert.equal(withoutCsrf.status,403);
  const rotation=await fetch(`${base}/api/system/master-key/rotate`,{method:'POST',headers:{cookie,'x-vynodearr-csrf':csrf,'content-type':'application/json'},body:'{}'}),value=await rotation.json();
  assert.equal(rotation.status,409);assert.equal(value.error.code,'master_key_environment_managed');
}));
test('administrators can require engine authentication independently',()=>{
  const host=(name)=>{let value={id:1,instanceName:name,authenticationMethod:'External',authenticationRequired:'DisabledForLocalAddresses'};return{get:async path=>{assert.equal(path,'config/host');return value;},put:async(path,next)=>{assert.equal(path,'config/host');value=next;return value;}};};
  const movieClient=host('Movies'),tvClient=host('TV'),movie=Object.assign(new MovieFixtureAdapter(),{client:movieClient}),tv=Object.assign(new TvFixtureAdapter(),{client:tvClient});
  return appSession({movie,tv},async({base,cookie,csrf})=>{
    const initial=await (await fetch(`${base}/api/settings/engines/authentication`,{headers:{cookie}})).json();
    assert.equal(initial.movie.required,false);assert.equal(initial.tv.required,false);
    const changedResponse=await fetch(`${base}/api/settings/engines/movie/authentication`,{method:'PUT',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({required:true})}),changed=await changedResponse.json();
    assert.equal(changedResponse.status,200);assert.equal(changed.required,true);assert.equal(changed.mode,'Enabled');
    const current=await (await fetch(`${base}/api/settings/engines/authentication`,{headers:{cookie}})).json();
    assert.equal(current.movie.required,true);assert.equal(current.tv.required,false);
  });
});
test('dashboard upcoming excludes calendar events before today',()=>{
  const yesterday=new Date(Date.now()-86400000).toISOString(),tomorrow=new Date(Date.now()+86400000).toISOString();
  const movie=Object.assign(new MovieFixtureAdapter(),{getCalendar:async()=>[
    {id:'past',domain:'movie',title:'Already released',dateUtc:yesterday},
    {id:'future',domain:'movie',title:'Coming soon',dateUtc:tomorrow}
  ]}),tv=Object.assign(new TvFixtureAdapter(),{getCalendar:async()=>[]});
  return appSession({movie,tv},async({base,cookie})=>{
    const value=await (await fetch(`${base}/api/dashboard`,{headers:{cookie}})).json();
    assert.deepEqual(value.upcoming.map(item=>item.title),['Coming soon']);
    assert.equal(value.metrics.upcomingMovies,1);
  });
});
test('smart collections combine rules with retained and excluded movie choices',()=>appSession({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter()},async({base,cookie,csrf})=>{
  const movies=(await (await fetch(`${base}/api/media/movies`,{headers:{cookie}})).json()).items,first=movies[0],retained=movies[1];
  const interest=await fetch(`${base}/api/user-collections/items`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({domain:'movie',mediaId:String(first.id).replace(/^movie_/, '')})});assert.equal(interest.status,201);
  const duplicateInterest=await fetch(`${base}/api/user-collections/items`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({domain:'movie',mediaId:first.id})});assert.equal(duplicateInterest.status,201);
  const contains=await (await fetch(`${base}/api/user-collections/contains?domain=movie&mediaId=${first.id}`,{headers:{cookie}})).json();assert.equal(contains.included,true);assert.equal(contains.canRemove,true);
  const attributionByPublicId=await (await fetch(`${base}/api/user-collections/attribution?domain=movie&mediaId=${first.id}`,{headers:{cookie}})).json();assert.equal(attributionByPublicId.users.length,1);
  const attributionByEngineId=await (await fetch(`${base}/api/user-collections/attribution?domain=movie&mediaId=${String(first.id).replace(/^movie_/, '')}`,{headers:{cookie}})).json();assert.equal(attributionByEngineId.users.length,1);assert.equal(attributionByEngineId.users[0].source,'saved');
  const owned=(await (await fetch(`${base}/api/collections`,{headers:{cookie}})).json()).userCollections[0];assert.equal(owned.count,1);assert.equal(owned.movies[0].title,first.title);assert.equal(owned.movies[0].collectionSource,'saved');
  assert.equal(owned.sharing.visibility,'private');assert.equal(owned.statistics.movies,1);assert.equal(owned.statistics.saved,1);
  const sharing=await fetch(`${base}/api/user-collections/sharing`,{method:'PUT',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({visibility:'household'})});assert.equal(sharing.status,200);assert.equal((await sharing.json()).preference.visibility,'household');
  const exported=await fetch(`${base}/api/user-collections/export?format=json`,{headers:{cookie}}),exportValue=await exported.json();assert.equal(exported.status,200);assert.equal(exportValue.items[0].title,first.title);
  const csv=await fetch(`${base}/api/user-collections/export?format=csv`,{headers:{cookie}});assert.equal(csv.status,200);assert.match(await csv.text(),/domain,id,title,year/);
  const timeline=await fetch(`${base}/api/user-collections/timeline`,{headers:{cookie}}),timelineValue=await timeline.json();assert.equal(timeline.status,200,JSON.stringify(timelineValue));assert.ok(Array.isArray(timelineValue.items));
  const created=await fetch(`${base}/api/collections`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'Flexible picks',type:'smart',rules:{year:first.year,genres:first.genres?.slice(0,1)||[]},includedMovieIds:[retained.id],excludedMovieIds:[first.id]})});
  assert.equal(created.status,201);
  const collection=(await (await fetch(`${base}/api/collections`,{headers:{cookie}})).json()).items[0];
  assert.ok(collection.movieIds.includes(retained.id));
  assert.ok(!collection.movieIds.includes(first.id));
  const updated=await fetch(`${base}/api/collections/${collection.id}`,{method:'PUT',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'Hand picked',type:'custom',movieIds:[first.id]})});
  assert.equal(updated.status,200);
  const edited=(await (await fetch(`${base}/api/collections`,{headers:{cookie}})).json()).items[0];
  assert.deepEqual(edited.movieIds,[first.id]);
  const removed=await fetch(`${base}/api/collections/${collection.id}`,{method:'DELETE',headers:{cookie,'x-vynodearr-csrf':csrf}});assert.equal(removed.status,200);
  const bulkRemoved=await fetch(`${base}/api/user-collections/bulk`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({action:'remove',items:[{domain:'movie',id:first.id}]})});assert.equal(bulkRemoved.status,200);assert.equal((await bulkRemoved.json()).completed,1);
  const imported=await fetch(`${base}/api/user-collections/import`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify(exportValue)});assert.equal(imported.status,200);assert.equal((await imported.json()).matched,1);
  const removedInterest=await fetch(`${base}/api/user-collections/items/movie/${first.id}`,{method:'DELETE',headers:{cookie,'x-vynodearr-csrf':csrf}});assert.equal(removedInterest.status,200);assert.equal((await removedInterest.json()).removed,true);
  const audit=(await (await fetch(`${base}/api/manage/audit`,{headers:{cookie}})).json()).items;
  assert.ok(audit.some(item=>item.action==='collection.created'&&item.metadata.collectionId===collection.id));
  assert.ok(audit.some(item=>item.action==='collection.updated'&&item.metadata.collectionId===collection.id));
  assert.ok(audit.some(item=>item.action==='collection.deleted'&&item.metadata.collectionId===collection.id));
}));
test('movie and television detail IDs resolve requester attribution with or without public prefixes',()=>appSession({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter()},async({base,cookie,csrf})=>{
  const headers={cookie,'content-type':'application/json','x-vynodearr-csrf':csrf};
  for(const domain of ['movie','tv']){
    const item=(await (await fetch(`${base}/api/media/${domain==='movie'?'movies':'tv'}`,{headers:{cookie}})).json()).items[0];
    const engineId=String(item.id).replace(domain==='movie'?/^movie_/:/^series_/,'');
    const added=await fetch(`${base}/api/user-collections/items`,{method:'POST',headers,body:JSON.stringify({domain,mediaId:engineId})});assert.equal(added.status,201);
    for(const mediaId of [item.id,engineId]){
      const value=await (await fetch(`${base}/api/user-collections/attribution?domain=${domain}&mediaId=${mediaId}`,{headers:{cookie}})).json();
      assert.equal(value.users.length,1,`${domain}:${mediaId}`);assert.equal(value.users[0].source,'saved');
      const direct=await (await fetch(`${base}/api/request-attribution?domain=${domain}&mediaIds=${mediaId}`,{headers:{cookie}})).json();assert.equal(direct.items[`${domain}:${mediaId}`].length,1,`direct:${domain}:${mediaId}`);
    }
  }
}));
test('Pushover channels validate advanced settings and keep every secret protected',()=>appSession({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter()},async({base,cookie,csrf})=>{
  const headers={cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},secret='a'.repeat(64),input={type:'pushover',name:'Family phones',credential:'app-token-secret',userKey:'user-key-secret',encryptionKey:secret,devices:['phone','tablet'],pushoverPriority:2,retry:45,expire:1800,ttl:600,sound:'cosmic',categories:['request','download'],template:{title:'{title}',message:'{message}',includeLink:true}};
  const created=await fetch(`${base}/api/notifications/channels`,{method:'POST',headers,body:JSON.stringify(input)}),createdValue=await created.json();assert.equal(created.status,200);assert.equal(createdValue.channel.type,'pushover');assert.equal(createdValue.channel.pushoverPriority,2);assert.deepEqual(createdValue.channel.devices,['phone','tablet']);
  const listed=await (await fetch(`${base}/api/notifications/channels`,{headers:{cookie}})).json(),serialized=JSON.stringify(listed);assert.equal(listed.channels[0].credentialConfigured,true);assert.doesNotMatch(serialized,/app-token-secret|user-key-secret|a{64}/);
  const nativeFetch=globalThis.fetch;let delivered;globalThis.fetch=async(resource,options)=>{if(String(resource)==='https://api.pushover.net/1/messages.json'){delivered=new URLSearchParams(String(options.body));return new Response('{}',{status:200});}return nativeFetch(resource,options);};try{const tested=await fetch(`${base}/api/notifications/channels/${createdValue.channel.id}/test`,{method:'POST',headers,body:'{}'});assert.equal(tested.status,200);}finally{globalThis.fetch=nativeFetch;}assert.equal(delivered.get('token'),'app-token-secret');assert.equal(delivered.get('user'),'user-key-secret');assert.equal(delivered.get('device'),'phone,tablet');assert.equal(delivered.get('priority'),'2');assert.equal(delivered.get('retry'),'45');assert.equal(delivered.get('expire'),'1800');assert.equal(delivered.get('ttl'),'600');assert.equal(delivered.get('sound'),'cosmic');assert.equal(delivered.get('encrypted'),'1');assert.notEqual(delivered.get('title'),'VynodeArr test notification');
  const preserved=await fetch(`${base}/api/notifications/channels`,{method:'POST',headers,body:JSON.stringify({...listed.channels[0],name:'Updated phones',credential:'',userKey:'',encryptionKey:''})});assert.equal(preserved.status,200);
  const invalid=await fetch(`${base}/api/notifications/channels`,{method:'POST',headers,body:JSON.stringify({...input,id:'channel_invalid',encryptionKey:'not-a-key'})});assert.equal(invalid.status,400);assert.equal((await invalid.json()).error.code,'invalid_encryption_key');
}));
test('engine wizard validates actual read-only HTTP capabilities and saves only successful connections',async()=>{
  const engine=createServer((req,res)=>{
    if(req.headers['x-api-key']!=='review-key'){res.writeHead(401);return res.end('{}');}
    const path=new URL(req.url,'http://engine').pathname;let value=[];
    if(path.endsWith('/system/status'))value={version:'1.0.0'};
    else if(path.endsWith('/queue')||path.endsWith('/history')||path.includes('/wanted/'))value={records:[]};
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(value));
  });await new Promise((resolve)=>engine.listen(0,'127.0.0.1',resolve));const port=engine.address().port;
  try{await appSession({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter()},async({base,cookie,csrf})=>{
    const input={host:'127.0.0.1',port,https:false,urlBase:'',apiCredential:'review-key',timeoutMs:1000,retries:0,tlsVerify:true};
    for(const domain of ['movie','tv']){
      const tested=await fetch(`${base}/api/settings/engines/${domain}/test`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify(input)}),testValue=await tested.json();assert.equal(testValue.validated,true);assert.ok(testValue.counts);
      const saved=await fetch(`${base}/api/settings/engines/${domain}`,{method:'PUT',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify(input)});assert.equal(saved.status,200);
    }
    const settings=await (await fetch(`${base}/api/settings/engines`,{headers:{cookie}})).json();assert.equal(settings.configured,true);assert.doesNotMatch(JSON.stringify(settings),/review-key/);
  });}finally{await new Promise((resolve)=>engine.close(resolve));}
});
