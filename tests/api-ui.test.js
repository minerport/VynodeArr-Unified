import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from '../apps/api/src/app.js';
import { AuthService } from '../packages/platform/src/auth-service.js';
import { MovieFixtureAdapter } from '../packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../packages/tv-domain/src/fixture-adapter.js';

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
  const status=await (await get(base,'/api/auth/status',cookie)).json();assert.equal(status.authenticated,true);assert.equal(status.user.role,'administrator');
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
test('UI exposes login, dashboard, media, operations, settings, and responsive shell',async()=>{
  const html=await readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8');const script=await readFile(new URL('../apps/web/public/app.js',import.meta.url),'utf8');const css=await readFile(new URL('../apps/web/public/styles.css',import.meta.url),'utf8');
  for(const value of ['Create Administrator','Sign in','Username or email','Remember me','Forgot password','Movies','TV','Queue','History','Calendar','Settings','System','Read-only mode'])assert.match(html,new RegExp(value));
  for(const value of ['showDashboard','showMedia','showDetail','showOperational','showSettings','showEngineSetup','showAccountSettings','showSessions','showUsers'])assert.match(script,new RegExp(value));
  assert.match(css,/@media\(max-width:760px\)/);
});
