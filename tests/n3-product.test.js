import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AuthService } from '../packages/platform/src/auth-service.js';
import { ProjectionStore } from '../packages/platform/src/projection-store.js';
import { SynchronizationService } from '../packages/platform/src/synchronization-service.js';
import { MovieFixtureAdapter } from '../packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../packages/tv-domain/src/fixture-adapter.js';
import { createApplication } from '../apps/api/src/app.js';

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
  const updated=await auth.updateAccount(admin.id,{name:'Updated Owner',username:'new-owner',email:'new@example.test',currentPassword:adminInput.password,newPassword:'Another-strong-pass2',confirmPassword:'Another-strong-pass2'},current.id);
  assert.equal(updated.username,'new-owner');assert.equal(updated.email,'new@example.test');assert.equal(auth.session(other.id),null);assert.ok(auth.session(current.id));
  assert.ok(await auth.login('new@example.test','Another-strong-pass2',{ip:'10.0.0.6'}));
}));
test('session listing masks IP and supports other-session revocation',()=>tempAuth(async(auth)=>{
  const admin=await auth.createInitialAdministrator(adminInput),current=await auth.createSession(admin,{ip:'192.168.1.44',userAgent:'Chrome Windows'}),other=await auth.createSession(admin,{ip:'192.168.1.45',userAgent:'Firefox Linux'});
  const sessions=await auth.listSessions(admin.id,current.id);assert.equal(sessions.length,2);assert.match(sessions[0].ipMasked,/…/);assert.ok(sessions.some((item)=>item.current));
  await auth.revokeOtherSessions(admin.id,current.id);assert.equal(auth.session(other.id),null);
}));
test('administrator creates, disables, roles, resets, forces logout, and safely deletes users',()=>tempAuth(async(auth)=>{
  const admin=await auth.createInitialAdministrator(adminInput),viewer=await auth.createUser({name:'Viewer',username:'viewer',email:'viewer@example.test',password:'Viewer-strong-pass3',role:'viewer'});
  const viewerSession=await auth.createSession(viewer,{ip:'127.0.0.1'});
  assert.equal((await auth.administerUser(viewer.id,{action:'role',role:'administrator'},admin.id)).role,'administrator');
  await auth.administerUser(viewer.id,{action:'forceLogout'},admin.id);assert.equal(auth.session(viewerSession.id),null);
  await auth.administerUser(viewer.id,{action:'disable'},admin.id);assert.equal((await auth.listUsers()).find((item)=>item.id===viewer.id).enabled,false);
  await auth.administerUser(viewer.id,{action:'enable'},admin.id);await auth.administerUser(viewer.id,{action:'resetPassword',password:'Reset-strong-pass4'},admin.id);
  await auth.administerUser(viewer.id,{action:'delete'},admin.id);assert.equal((await auth.listUsers()).length,1);
  await assert.rejects(()=>auth.administerUser(admin.id,{action:'delete'},admin.id),/own account/);
}));
test('durable projections hydrate and report incremental updates',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-projection-')),store=new ProjectionStore(join(directory,'projections.json'));
  const sync=new SynchronizationService({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter(),projectionStore:store,maxItems:100,pollIntervalMs:999999});
  await sync.startup();assert.equal(sync.snapshot().movie.itemsUpdated,3);await sync.startup();assert.equal(sync.snapshot().movie.itemsUpdated,0);
  const hydrated=new SynchronizationService({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter(),projectionStore:store,maxItems:100,pollIntervalMs:999999});await hydrated.hydrate();assert.equal((await hydrated.list('movie')).length,3);
  await rm(directory,{recursive:true,force:true});
});

async function appSession(options,run){
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-n3-api-')),app=createApplication({...options,env:{VYNODEARR_DATA_MODE:'fixture',VYNODEARR_DATA_DIR:directory,VYNODEARR_MASTER_KEY:'test-master-key-with-32-characters'}});
  const server=createServer(app.handleRequest);await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const setup=await fetch(`${base}/api/auth/setup`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(adminInput)}),result=await setup.json(),cookie=setup.headers.get('set-cookie').split(';')[0];
    await run({base,cookie,csrf:result.csrf,app});
  }finally{await new Promise((resolve)=>server.close(resolve));app.sync.stopPolling();await rm(directory,{recursive:true,force:true});}
}
test('authenticated artwork proxy caches binary responses without exposing engine URLs',()=>appSession({
  movie:Object.assign(new MovieFixtureAdapter(),{getArtwork:async()=>({body:Buffer.from('image-data'),contentType:'image/jpeg'})}),tv:new TvFixtureAdapter()
},async({base,cookie})=>{
  const response=await fetch(`${base}/api/artwork/movie/movie_1/poster`,{headers:{cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');assert.equal(Buffer.from(await response.arrayBuffer()).toString(),'image-data');
  assert.equal((await fetch(`${base}/api/artwork/movie/movie_1/poster`)).status,401);
}));
test('dashboard API returns useful product metrics',()=>appSession({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter()},async({base,cookie})=>{
  const response=await fetch(`${base}/api/dashboard`,{headers:{cookie}}),value=await response.json();assert.equal(value.metrics.movies,3);assert.equal(value.metrics.tv,3);assert.ok('missing'in value.metrics&&'upcomingEpisodes'in value.metrics);assert.ok(value.recentActivity.length);
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
