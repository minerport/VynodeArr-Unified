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

async function appSession(options,run){
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-n3-api-')),app=createApplication({...options,env:{VYNODEARR_DATA_MODE:'fixture',VYNODEARR_DATA_DIR:directory,VYNODEARR_MASTER_KEY:'test-master-key-with-32-characters'}});
  const server=createServer(app.handleRequest);await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const setup=await fetch(`${base}/api/auth/setup`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(adminInput)}),result=await setup.json(),cookie=setup.headers.get('set-cookie').split(';')[0];
    await run({base,cookie,csrf:result.csrf,app});
  }finally{server.closeAllConnections?.();await new Promise((resolve)=>server.close(resolve));app.sync.stopPolling();await rm(directory,{recursive:true,force:true});}
}
test('authenticated artwork proxy caches binary responses without exposing engine URLs',()=>appSession({
  movie:Object.assign(new MovieFixtureAdapter(),{getArtwork:async()=>({body:Buffer.from('image-data'),contentType:'image/jpeg'})}),tv:new TvFixtureAdapter()
},async({base,cookie})=>{
  const response=await fetch(`${base}/api/artwork/movie/movie_1/poster`,{headers:{cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');assert.equal(Buffer.from(await response.arrayBuffer()).toString(),'image-data');
  assert.equal((await fetch(`${base}/api/artwork/movie/movie_1/poster`)).status,401);
}));
test('dashboard API returns useful product metrics',()=>appSession({movie:new MovieFixtureAdapter(),tv:new TvFixtureAdapter()},async({base,cookie})=>{
  const response=await fetch(`${base}/api/dashboard`,{headers:{cookie}}),value=await response.json();assert.equal(value.metrics.movies,3);assert.equal(value.metrics.tv,3);assert.ok('missing'in value.metrics&&'upcomingEpisodes'in value.metrics);assert.ok(Array.isArray(value.upcoming));assert.ok(value.recentActivity.length);
  assert.equal(value.analytics.rangeDays,30);assert.equal(value.analytics.downloadsOverTime.movie.length,30);assert.equal(value.analytics.downloadsOverTime.tv.length,30);
  assert.ok(Array.isArray(value.analytics.qualityDistribution.movie));assert.ok(Array.isArray(value.analytics.qualityDistribution.tv));
  assert.equal(value.analytics.library.movie.total,3);assert.equal(value.analytics.library.tv.total,3);
  const diagnostics=await (await fetch(`${base}/api/library/diagnostics?domain=movie`,{headers:{cookie}})).json();
  assert.equal(diagnostics.summary.total,diagnostics.items.length);assert.ok(diagnostics.items.every(item=>item.domain==='movie'&&['#movie/','#wanted','#service/root-folders'].some(prefix=>item.href.startsWith(prefix))&&item.actionLabel));
}));
test('user page permissions are enforced by APIs and update active sessions immediately',()=>appSession({},async({base,cookie,csrf})=>{
  const create=await fetch(`${base}/api/admin/users`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'Limited User',username:'limited',email:'limited@example.test',password:'Limited-strong-pass5',role:'user',permissions:{dashboard:false,discover:true,movies:true,tv:false,calendar:true}})});
  assert.equal(create.status,201);const created=(await create.json()).user;
  const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'limited',password:'Limited-strong-pass5'})});
  assert.equal(login.status,200);const userLogin=await login.json(),userCookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${base}/api/dashboard`,{headers:{cookie:userCookie}})).status,403);
  assert.equal((await fetch(`${base}/api/media/movies`,{headers:{cookie:userCookie}})).status,200);
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
  assert.equal((await fetch(`${base}/api/collections`,{headers:{cookie:userCookie}})).status,403);
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
  return appSession({movie:Object.assign(new MovieFixtureAdapter(),{client:movieClient}),tv:new TvFixtureAdapter(),discovery},async({base,cookie,csrf})=>{
    const create=await fetch(`${base}/api/admin/users`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({name:'Approval User',username:'approval-user',email:'approval@example.test',password:'Approval-strong-pass6',role:'user',permissions:{discover:true},requestApprovalRequired:true,requestLimits:{enabled:true,period:'weekly',movie:2,tv:1,maxPending:null}})});
    const created=(await create.json()).user;assert.equal(created.requestApprovalRequired,true);assert.equal(created.requestLimits.movie,2);
    const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'approval-user',password:'Approval-strong-pass6'})}),userLogin=await login.json(),userCookie=login.headers.get('set-cookie').split(';')[0];
    const requested=await fetch(`${base}/api/discover/request`,{method:'POST',headers:{cookie:userCookie,'content-type':'application/json','x-vynodearr-csrf':userLogin.csrf},body:JSON.stringify({domain:'movie',tmdbId:123,payload:{tmdbId:123,title:'Approval Film',year:2026,rootFolderPath:'/movies',qualityProfileId:1,monitored:true,addOptions:{searchForMovie:true}}})}),requestValue=await requested.json();
    assert.equal(requested.status,202);assert.equal(requestValue.request.status,'pending_approval');assert.equal(posts.length,0);
    const adminNotifications=await (await fetch(`${base}/api/notifications`,{headers:{cookie}})).json();
    assert.equal(adminNotifications.unread,1);assert.equal(adminNotifications.items[0].type,'approval');assert.equal(adminNotifications.items[0].href,'#request-management');assert.deepEqual(adminNotifications.pageBadge,{href:'#request-management',count:1});
    const readNotification=await fetch(`${base}/api/notifications/read`,{method:'POST',headers:{cookie,'content-type':'application/json','x-vynodearr-csrf':csrf},body:JSON.stringify({ids:[adminNotifications.items[0].id]})});
    assert.equal(readNotification.status,200);assert.equal((await (await fetch(`${base}/api/notifications`,{headers:{cookie}})).json()).unread,0);
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
    assert.equal(userNotifications.pageBadge.href,'#requests');assert.equal(userNotifications.pageBadge.count,userNotifications.unread);
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
  const audit=(await (await fetch(`${base}/api/manage/audit`,{headers:{cookie}})).json()).items;
  assert.ok(audit.some(item=>item.action==='collection.created'&&item.metadata.collectionId===collection.id));
  assert.ok(audit.some(item=>item.action==='collection.updated'&&item.metadata.collectionId===collection.id));
  assert.ok(audit.some(item=>item.action==='collection.deleted'&&item.metadata.collectionId===collection.id));
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
