import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EngineManagementService } from '../packages/platform/src/engine-management-service.js';
import { EngineSettingsService } from '../packages/platform/src/engine-settings-service.js';

test('management gateway exposes native capabilities and forwards only allowlisted operations',async()=>{
  const calls=[];
  const client={
    get:async(path,query)=>{calls.push(['GET',path,query]);return[{id:1,name:'Profile'}];},
    post:async(path,payload)=>{calls.push(['POST',path,payload]);return{id:2,...payload};},
    put:async(path,payload)=>{calls.push(['PUT',path,payload]);return payload;},
    delete:async(path)=>{calls.push(['DELETE',path]);return null;}
  };
  const service=new EngineManagementService({get:()=>({client})});
  assert.equal(service.available('movie'),true);
  const catalog=service.catalog('movie');
  assert.ok(catalog.some((item)=>item.key==='library'&&item.methods.includes('PUT')));
  assert.ok(catalog.some((item)=>item.key==='indexers'&&item.methods.includes('POST')));
  for(const key of ['wantedMissing','blocklist','releases','filesystem','remotePathMappings','indexerSchemas','diskSpace','tasks','backups','updates','events'])assert.ok(catalog.some((item)=>item.key===key),key);
  await service.execute('movie','profiles','GET');
  await service.execute('movie','library','POST',{payload:{title:'New movie'}});
  await service.execute('movie','library','PUT',{id:7,payload:{id:7,monitored:true}});
  await service.execute('movie','library','DELETE',{id:7});
  assert.deepEqual(calls.map((call)=>call.slice(0,2)),[
    ['GET','qualityprofile'],['POST','movie'],['PUT','movie/7'],['DELETE','movie/7']
  ]);
  await assert.rejects(()=>service.execute('movie','system/status','DELETE',{id:1}),/not available/);
  await assert.rejects(()=>service.execute('movie','library','DELETE'),/identifier/);
});

test('native interaction workflows replace an upstream-shaped generic shell',async()=>{
  const [html,script]=await Promise.all([
    readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/app.js',import.meta.url),'utf8')
  ]);
  for(const route of ['#add','#wanted','#queue','#service/root-folders','#system'])assert.match(html,new RegExp(route));
  for(const workflow of ['showAddMedia','showWanted','showQueue','queue-table','data-queue-sort','showRootFolders','reviewMovieImport','reviewTvImport','const target=event.currentTarget','Scan for','Import selected movies','Import selected series','showProfiles','showProviders','Indexers','Download Clients','All provider options','folder-browser','Browse…','Use this folder','attachDetailActions','episode-monitor','episode-auto-search','episode-interactive-search','Automatic search','Interactive search','release-table','data-sort','Source','Quality','Size','Seeders','grab-release','createRecord','Refresh & scan','Allowed qualities','Custom format scores','Create both backups'])assert.match(script,new RegExp(workflow.replace(/[&]/g,'&')));
});

test('environment engine credentials auto-configure the private gateway once',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodenew-n4-'));
  try{
    const defaults={dataMode:'engine',movie:{enabled:true,host:'movie.internal',port:7878,apiCredential:'movie-secret'},tv:{enabled:true,host:'tv.internal',port:8989,apiCredential:'tv-secret'}};
    const service=new EngineSettingsService({path:join(directory,'settings.json'),vaultPath:join(directory,'credentials.enc'),masterKey:'test-master-key-with-32-characters',defaults});
    await service.initialize();
    assert.equal(service.configured(),true);
    const runtime=await service.runtime();
    assert.equal(runtime.movie.host,'movie.internal');
    assert.equal(runtime.tv.host,'tv.internal');
    assert.equal(runtime.movie.apiCredential,'movie-secret');
    assert.equal(JSON.stringify(service.public()).includes('movie-secret'),false);
  }finally{await rm(directory,{recursive:true,force:true});}
});
