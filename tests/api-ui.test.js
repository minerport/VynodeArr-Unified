import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer,request as httpRequest } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from '../.server-build/apps/api/src/app.js';
import { AuthService } from '../.server-build/packages/platform/src/auth-service.js';
import { MovieFixtureAdapter } from '../.server-build/packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../.server-build/packages/tv-domain/src/fixture-adapter.js';
import { exactEngineMatch,lookupTermsForIdentity,payloadMatchesIdentity } from '../.server-build/apps/api/src/discovery-engine-match.js';

async function fixtureServer(run){
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-api-'));
  const auth=new AuthService({userFile:join(directory,'users.json'),secureCookies:false});
  const app=createApplication({env:{VYNODEARR_DATA_MODE:'fixture',VYNODEARR_DATA_DIR:directory},auth,movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter()});
  const server=createServer(app.handleRequest);await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const setup=await fetch(`${base}/api/auth/setup`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Review Administrator',username:'reviewer',email:'reviewer@example.test',password:'Correct-horse-review1',confirmPassword:'Correct-horse-review1'})});
    const setupBody=await setup.json();const cookie=setup.headers.get('set-cookie').split(';')[0];
    await run({base,cookie,csrf:setupBody.csrf});
  }finally{await new Promise((resolve)=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
}
const get=(base,path,cookie)=>fetch(`${base}${path}`,{headers:{cookie}});

test('Discover and correction matching use external IDs and never title order',()=>{
  const identity={tmdbId:2316,tvdbId:73244};
  const results=[
    {title:'The Office',year:2001,tmdbId:2996,tvdbId:78107},
    {title:'The Office (US)',year:2005,tmdbId:2316,tvdbId:73244}
  ];
  assert.deepEqual(lookupTermsForIdentity('tv',identity),['tvdb:73244','tmdb:2316']);
  assert.equal(exactEngineMatch('tv',identity,results),results[1]);
  assert.equal(exactEngineMatch('tv',identity,[results[0]]),undefined);
  assert.equal(exactEngineMatch('tv',identity,[{...results[0],tmdbId:2316}]),undefined);
  assert.equal(payloadMatchesIdentity('tv',identity,results[1]),true);
  assert.equal(payloadMatchesIdentity('tv',identity,results[0]),false);
  assert.equal(payloadMatchesIdentity('movie',{tmdbId:550},{tmdbId:550}),true);
  assert.equal(payloadMatchesIdentity('movie',{tmdbId:550},{tmdbId:551}),false);
});

test('setup auto-login, session validation, CSRF, and logout',()=>fixtureServer(async({base,cookie,csrf})=>{
  const status=await (await get(base,'/api/auth/status',cookie)).json();assert.equal(status.authenticated,true);assert.equal(status.user.role,'administrator');assert.equal(status.enginesConfigured,true);
  const rejected=await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{cookie}});assert.equal(rejected.status,403);
  const logout=await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{cookie,'x-vynodearr-csrf':csrf}});assert.equal(logout.status,200);
}));
test('neutral movie/TV list and detail APIs',()=>fixtureServer(async({base,cookie})=>{
  const movies=await (await get(base,'/api/media/movies',cookie)).json();const tv=await (await get(base,'/api/media/tv',cookie)).json();
  assert.equal(movies.items.length,3);assert.equal(tv.items.length,3);assert.equal(movies.mode,'fixture');
  const movie=await (await get(base,`/api/media/movies/${movies.items[0].id}`,cookie)).json();
  const series=await (await get(base,`/api/media/tv/${tv.items[0].id}`,cookie)).json();
  assert.ok(movie.item.overview&&movie.item.recentHistory);assert.ok(series.item.seasons[0].episodes);
}));
test('Discover settings expose status without returning credentials',()=>fixtureServer(async({base,cookie})=>{
  const response=await get(base,'/api/settings/discover',cookie),value=await response.json();
  assert.equal(response.status,200);assert.equal(value.configured,false);assert.equal(value.provider,'TMDB');assert.equal('token' in value,false);
}));
test('unified queue, history, calendar, health, and engine status',()=>fixtureServer(async({base,cookie})=>{
  for(const [path,min] of [['/api/activity/queue',2],['/api/activity/history',6],['/api/calendar',5],['/api/system/health',0]]){
    const response=await get(base,path,cookie);assert.equal(response.status,200);const value=await response.json();assert.ok(value.items.length>=min,path);
  }
  const engines=await (await get(base,'/api/system/engines',cookie)).json();assert.equal(engines.engines.length,2);assert.equal(JSON.stringify(engines).includes('apiCredential'),false);
}));
test('Action Center normalizes existing activity and safely retains dismiss state',()=>fixtureServer(async({base,cookie,csrf})=>{
  const timelineResponse=await get(base,'/api/operations/timeline',cookie),timeline=await timelineResponse.json();
  assert.equal(timelineResponse.status,200);assert.ok(timeline.items.length>=6);assert.ok(timeline.items.every(item=>item.id&&item.source&&item.title&&item.timestamp));
  const movieResponse=await get(base,'/api/operations/timeline?domain=movie',cookie),movies=await movieResponse.json();assert.equal(movieResponse.status,200);assert.ok(movies.items.every(item=>item.domain==='movie'));
  const actionsResponse=await get(base,'/api/operations/actions?dismissed=true',cookie),actions=await actionsResponse.json();assert.equal(actionsResponse.status,200);assert.ok(Array.isArray(actions.items));
  if(actions.items.length){const item=actions.items[0],path=`/api/operations/actions/${encodeURIComponent(item.id)}`;const rejected=await fetch(`${base}${path}/dismiss`,{method:'POST',headers:{cookie}});assert.equal(rejected.status,403);const dismissed=await fetch(`${base}${path}/dismiss`,{method:'POST',headers:{cookie,'x-vynodearr-csrf':csrf,'content-type':'application/json'},body:'{}'});assert.equal(dismissed.status,200);const hidden=await (await get(base,'/api/operations/actions',cookie)).json();assert.equal(hidden.items.some(value=>value.id===item.id),false);const restored=await fetch(`${base}${path}/restore`,{method:'POST',headers:{cookie,'x-vynodearr-csrf':csrf,'content-type':'application/json'},body:'{}'});assert.equal(restored.status,200);}
}));
test('public errors and health are neutral',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-error-'));const app=createApplication({env:{VYNODEARR_DATA_MODE:'fixture',VYNODEARR_DATA_DIR:directory}});
  const server=createServer(app.handleRequest);await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try{assert.equal((await fetch(`${base}/healthz`)).status,200);const value=await (await fetch(`${base}/api/media/movies`)).json();assert.match(value.error.message,/Sign in/);assert.doesNotMatch(JSON.stringify(value),/\b(radarr|sonarr)\b/i);}
  finally{await new Promise((resolve)=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
});
test('compatibility proxy completes normally and cancels upstream work when the caller disconnects',async()=>{
  let upstreamClosedResolve;const upstreamClosed=new Promise(resolve=>{upstreamClosedResolve=resolve;});
  const upstream=createServer((req,res)=>{
    if(req.url==='/ping'){res.writeHead(200,{'content-type':'application/json'});res.end('{"status":"ok"}');return;}
    res.writeHead(200,{'content-type':'application/json'});res.write('{"items":[');
    const timer=setInterval(()=>res.write('{"id":1},'),20);
    res.once('close',()=>{clearInterval(timer);upstreamClosedResolve();});
  });
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-proxy-abort-'));
  const movie=new MovieFixtureAdapter({enabled:true,host:'127.0.0.1',port:upstream.address().port,https:false,urlBase:'',timeoutMs:10_000,tlsVerify:true});
  const app=createApplication({env:{VYNODEARR_DATA_MODE:'fixture',VYNODEARR_DATA_DIR:directory},movie,tv:new TvFixtureAdapter()});
  const server=createServer(app.handleRequest);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const normal=await fetch(`http://127.0.0.1:${server.address().port}/movies/ping`);assert.equal(normal.status,200);assert.deepEqual(await normal.json(),{status:'ok'});
    await new Promise((resolve,reject)=>{
      const request=httpRequest({hostname:'127.0.0.1',port:server.address().port,path:'/movies/api/v3/movie'},response=>{
        response.once('data',()=>{request.destroy();resolve();});
      });
      request.once('error',error=>{if(error.code!=='ECONNRESET')reject(error);});request.end();
    });
    await Promise.race([upstreamClosed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Upstream response was not canceled promptly')),500))]);
  }finally{
    await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>upstream.close(resolve));await rm(directory,{recursive:true,force:true});
  }
});
test('static assets use safe caching, validation, and gzip compression',()=>fixtureServer(async({base})=>{
  const first=await fetch(`${base}/styles.css`,{headers:{'accept-encoding':'identity'}});
  assert.equal(first.status,200);assert.equal(first.headers.get('cache-control'),'no-cache');
  const tag=first.headers.get('etag');assert.match(tag,/^W\//);assert.equal(first.headers.get('vary'),'Accept-Encoding');assert.equal(first.headers.get('x-content-type-options'),'nosniff');
  const unchanged=await fetch(`${base}/styles.css`,{headers:{'if-none-match':tag,'accept-encoding':'identity'}});
  assert.equal(unchanged.status,304);assert.equal(unchanged.headers.get('vary'),'Accept-Encoding');
  const compressed=await fetch(`${base}/styles.css`,{headers:{'accept-encoding':'gzip'}});
  assert.equal(compressed.status,200);assert.equal(compressed.headers.get('content-encoding'),'gzip');assert.match(await compressed.text(),/--bg/);
  const shell=await fetch(`${base}/not-a-real-route`);
  assert.equal(shell.status,200);assert.equal(shell.headers.get('cache-control'),'no-cache');const shellHtml=await shell.text();assert.match(shellHtml,/VynodeArr/);
  const packageVersion=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
  assert.ok(shellHtml.includes(`/react/vynodearr-app.js?v=${packageVersion}`));assert.ok(shellHtml.includes(`/react/vynodearr-react.js?v=${packageVersion}`));assert.doesNotMatch(shellHtml,/__VYNODEARR_VERSION__/);
  const stableEntry=await fetch(`${base}/react/vynodearr-react.js`);assert.equal(stableEntry.headers.get('cache-control'),'no-cache');
}));
test('UI exposes login, dashboard, media, operations, settings, and responsive shell',async()=>{
  const html=await readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8');const script=await readFile(new URL('../apps/web/client/src/app-shell.ts',import.meta.url),'utf8');const loader=await readFile(new URL('../apps/web/public/app.js',import.meta.url),'utf8');const css=await readFile(new URL('../apps/web/public/styles.css',import.meta.url),'utf8');
  for(const value of ['Create Administrator','Sign in','Username or email','Remember me','Forgot password','Discover','Movies','TV','Action Center','Queue','History','Calendar','Settings','System','Read-only mode'])assert.match(html,new RegExp(value));
  for(const value of ['showDashboard','showDiscoverV2','showDiscoverSettings','Configure Discover','/api/settings/discover','TMDB_API_READ_TOKEN','openLiveDiscoverDetails','addDiscoverToEngine','markLiveDiscoverRequested','scrollPositions','discoverLibraryKey','discover-taxonomy','discover-request-title','showHealthReact','mountHealth','showMedia','showDetail','showHistoryReact','showSettings','showEngineSetup','showAccountSettings','showSessions','showUsers'])assert.match(script,new RegExp(value));
  assert.doesNotMatch(script,/requested and sent[^;]+;location\.hash/);
  assert.match(loader,/\/react\/vynodearr-app\.js/);
  assert.match(css,/@media\(max-width:760px\)/);
  for(const value of ['.operations-toolbar label{display:grid!important','.operations-timeline article{display:grid;grid-template-columns:minmax(0,1fr)',".operations-timeline article p,.operations-timeline article small{display:block;max-width:100%;overflow-wrap:anywhere",'.operations-timeline article>a{width:100%'])assert.ok(css.includes(value),value);
});
