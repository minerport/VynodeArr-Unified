import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from '../.server-build/apps/api/src/app.js';
import { AuthService } from '../.server-build/packages/platform/src/auth-service.js';
import { MovieFixtureAdapter } from '../.server-build/packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../.server-build/packages/tv-domain/src/fixture-adapter.js';

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
test('public errors and health are neutral',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-error-'));const app=createApplication({env:{VYNODEARR_DATA_MODE:'fixture',VYNODEARR_DATA_DIR:directory}});
  const server=createServer(app.handleRequest);await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try{assert.equal((await fetch(`${base}/healthz`)).status,200);const value=await (await fetch(`${base}/api/media/movies`)).json();assert.match(value.error.message,/Sign in/);assert.doesNotMatch(JSON.stringify(value),/\b(radarr|sonarr)\b/i);}
  finally{await new Promise((resolve)=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
});
test('static assets use safe caching, validation, and gzip compression',()=>fixtureServer(async({base})=>{
  const first=await fetch(`${base}/styles.css`,{headers:{'accept-encoding':'identity'}});
  assert.equal(first.status,200);assert.match(first.headers.get('cache-control'),/max-age=3600/);
  const tag=first.headers.get('etag');assert.match(tag,/^W\//);assert.equal(first.headers.get('vary'),'Accept-Encoding');assert.equal(first.headers.get('x-content-type-options'),'nosniff');
  const unchanged=await fetch(`${base}/styles.css`,{headers:{'if-none-match':tag,'accept-encoding':'identity'}});
  assert.equal(unchanged.status,304);assert.equal(unchanged.headers.get('vary'),'Accept-Encoding');
  const compressed=await fetch(`${base}/styles.css`,{headers:{'accept-encoding':'gzip'}});
  assert.equal(compressed.status,200);assert.equal(compressed.headers.get('content-encoding'),'gzip');assert.match(await compressed.text(),/--bg/);
  const shell=await fetch(`${base}/not-a-real-route`);
  assert.equal(shell.status,200);assert.equal(shell.headers.get('cache-control'),'no-cache');assert.match(await shell.text(),/VynodeArr/);
}));
test('UI exposes login, dashboard, media, operations, settings, and responsive shell',async()=>{
  const html=await readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8');const script=await readFile(new URL('../apps/web/client/src/app-shell.ts',import.meta.url),'utf8');const loader=await readFile(new URL('../apps/web/public/app.js',import.meta.url),'utf8');const css=await readFile(new URL('../apps/web/public/styles.css',import.meta.url),'utf8');
  for(const value of ['Create Administrator','Sign in','Username or email','Remember me','Forgot password','Discover','Movies','TV','Queue','History','Calendar','Settings','System','Read-only mode'])assert.match(html,new RegExp(value));
  for(const value of ['showDashboard','showDiscover','showDiscoverSettings','Configure Discover','/api/settings/discover','TMDB_API_READ_TOKEN','renderDiscoverRows','resolveDiscoverItem','openDiscoverDetails','addDiscoverToEngine','markLiveDiscoverRequested','scrollPositions','discoverLibraryKey','discover-taxonomy','discover-request-title','showHealthReact','mountHealth','showMedia','showDetail','showOperational','showSettings','showEngineSetup','showAccountSettings','showSessions','showUsers'])assert.match(script,new RegExp(value));
  assert.doesNotMatch(script,/requested and sent[^;]+;location\.hash/);
  assert.match(loader,/\/react\/vynodearr-app\.js/);
  assert.match(css,/@media\(max-width:760px\)/);
});
