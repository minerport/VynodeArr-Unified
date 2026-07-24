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
    put:async(path,payload,query)=>{calls.push(['PUT',path,payload,query]);return payload;},
    delete:async(path)=>{calls.push(['DELETE',path]);return null;}
  };
  const service=new EngineManagementService({get:()=>({client})});
  assert.equal(service.available('movie'),true);
  const catalog=service.catalog('movie');
  assert.ok(catalog.some((item)=>item.key==='library'&&item.methods.includes('PUT')));
  assert.ok(catalog.some((item)=>item.key==='indexers'&&item.methods.includes('POST')));
  for(const key of ['calendar','wantedMissing','blocklist','releases','filesystem','remotePathMappings','indexerSchemas','downloadClientSettings','diskSpace','tasks','backups','updates','events'])assert.ok(catalog.some((item)=>item.key===key),key);
  await service.execute('movie','profiles','GET');
  await service.execute('movie','library','POST',{payload:{title:'New movie'}});
  await service.execute('movie','library','PUT',{id:7,payload:{id:7,monitored:true},query:{moveFiles:'true'}});
  await service.execute('movie','library','DELETE',{id:7});
  assert.deepEqual(calls.map((call)=>call.slice(0,2)),[
    ['GET','qualityprofile'],['POST','movie'],['PUT','movie/7'],['DELETE','movie/7']
  ]);
  assert.deepEqual(calls[2][3],{moveFiles:'true'});
  await assert.rejects(()=>service.execute('movie','system/status','DELETE',{id:1}),/not available/);
  await assert.rejects(()=>service.execute('movie','library','DELETE'),/identifier/);
});

test('native interaction workflows replace an upstream-shaped generic shell',async()=>{
  const [html,script,apiSource,clientSource]=await Promise.all([
    readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/api/src/app.js',import.meta.url),'utf8'),
    readFile(new URL('../packages/platform/src/read-only-engine-client.js',import.meta.url),'utf8')
  ]);
  for(const route of ['#add','#wanted','#queue','#service/root-folders','#system'])assert.match(html,new RegExp(route));
  for(const workflow of ['wanted-series-search','wanted-season-search','SeriesSearch','SeasonSearch','Search entire show','Search entire season'])assert.match(script,new RegExp(workflow));
  for(const workflow of ['seasonTone','episodeTone','availability-complete','availability-missing','availability-unmonitored','availability-count'])assert.match(script,new RegExp(workflow));
  for(const workflow of ['season-monitor','data-file-count','This season is no longer available','Season ${seasonNumber} monitored'])assert.ok(script.includes(workflow));
  for(const workflow of ['setupLibraryBulkSelection','bulk-select-visible','Edit selected','Remove selected','Change quality profile','Change root folder','Change minimum availability','setupTvDetailBulk','season-select','episode-select','bulk-monitor','bulk-unmonitor','SeasonSearch'])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ['item.backdrop','detail-backdrop','detail-copy'])assert.match(script,new RegExp(workflow.replace('.','\\.')));
  for(const workflow of ['wantedImage','wanted-art','wanted-movie-row','wanted-episode-row','/api/artwork/movie/movie_${item.id}/poster','/api/artwork/tv/series_${seriesId}/fanart','/api/artwork/tv-metadata/${tvdbId}','season?season=${season}','episode?season=${season}&episode=${item.episodeNumber}'])assert.ok(script.includes(workflow));
  for(const workflow of ['queuePoll','load({quiet:true})','queue-poster','tone=item','clientFilename','clientTimeLeft','/api/activity/queue/live','showMediaManagement','media-management','mediaSettingOptions','flattenMediaSettings','mediaManagement','Naming and folders','Importing and file management'])assert.ok(script.includes(workflow));
  for(const workflow of ['liveQueue','includeMovie:true','includeSeries:true','includeEpisode:true','trackedDownloadState','clientStatus','clientFilename','/api/activity/queue/live'])assert.ok(apiSource.includes(workflow));
  assert.ok(!apiSource.includes("apikey:apiKey"),'live queue must rely on the engines authenticated client polling, not masked provider credentials');
  for(const workflow of ['tvMetadataArtwork','api.tvmaze.com/lookup/shows','api.tvmaze.com/shows/${show.id}/seasons','episodebynumber','static.tvmaze.com'])assert.ok(apiSource.includes(workflow));
  for(const workflow of ['showEngineManagement','Repair automatic connections','external-engine-settings','Engine keys are created once during installation','Changing this key affects external applications','Seerr and every other connected application','/api/settings/engines/repair'])assert.ok(script.includes(workflow));
  for(const workflow of ['External application access','Reveal','Copy','Generate new key','/api/settings/engines/${domain}/api-key'])assert.ok(script.includes(workflow));
  for(const workflow of ["reveal.textContent==='Hide'","code.textContent='Hidden'","reveal.textContent='Reveal'"])assert.ok(script.includes(workflow));
  for(const workflow of ["client.post('command',{name:'ResetApiKey'})","/engine-config/${domain}/config.xml",'The engine did not provide its newly generated API key'])assert.ok(apiSource.includes(workflow));
  for(const workflow of ["proxyCompatibilityApi","'/movies'","'/tv'","Compatibility API endpoint not found"])assert.ok(apiSource.includes(workflow));
  assert.ok(apiSource.includes("xml.match(/<ApiKey>([^<]+)<\\/ApiKey>/i)"),'bundled engine configuration must remain the credential source of truth');
  assert.ok(apiSource.includes('did not reconnect with the new API key'));
  for(const workflow of ['taskSections(items)','MOVIE ENGINE','TELEVISION ENGINE','/api/system/application-update','VynodeArr updates'])assert.ok(script.includes(workflow)||apiSource.includes(workflow));
  for(const workflow of ['backupSections(items)','configuration backup','Create Movies and Television backups','restore-backup','/api/system/backups/${button.dataset.domain}/${button.dataset.id}/restore','did not reconnect after restoring the backup'])assert.ok(script.includes(workflow)||apiSource.includes(workflow));
  for(const workflow of ["client.post('command',{name:'Restart'})",'historySections(items)','eventSections(items)','Movie and television activity separated by library'])assert.ok(script.includes(workflow)||apiSource.includes(workflow));
  for(const workflow of ['Download backups before uninstalling','Upload & restore','backup-upload-input','/download','/upload','completeEngineRestore','Backup must be a .zip, .db, or .xml file'])assert.ok(script.includes(workflow)||apiSource.includes(workflow));
  for(const workflow of ['VynodeArr_${domain===','vynodearr.libraryView.${kind}','views:{movies:savedLibraryView'])assert.ok(script.includes(workflow)||apiSource.includes(workflow),workflow);
  for(const workflow of ["serviceTabs('advanced')",'statusSections(values)','storage-summary','status-domain-section'])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ['privateProviderKeys','providerPresentation','mergeProviderPayload','Provider help is available through VynodeArr.'])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ['mediaPath(values.rootFolderPath,raw.path)','path:mediaPath','moveFiles=true'])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ['requestRemoteArtwork','image?.remoteUrl','tmdb.org','thetvdb.com'])assert.ok(clientSource.includes(workflow),workflow);
  for(const workflow of ['showAddMedia','discovery-art','remotePoster','showCalendar','calendar-grid','calendar-movies','showWanted','wanted-domain','wanted-show','wanted-season','wanted-interactive','showQueue','queue-table','data-queue-sort','showRootFolders','reviewMovieImport','reviewTvImport','startBackgroundImport','/api/import-jobs','Library imports','const target=event.currentTarget','Scan for','Import selected movies','Import selected series','showProfiles','showProviders','loadPolicy','Failed download handling','autoRedownloadFailed','Indexers','Download Clients','All provider options','folder-browser','Browse…','Use this folder','attachDetailActions','episode-monitor','episode-auto-search','episode-interactive-search','Monitoring…','Unmonitoring…','Automatic search','Interactive search','release-table','data-sort','Source','Quality','Size','Seeders','grab-release','createRecord','Refresh & scan','Allowed qualities','Custom format scores','Create Movies and Television backups'])assert.match(script,new RegExp(workflow.replace(/[&]/g,'&')));
  assert.doesNotMatch(script,/button\.textContent='Importing…'/);
});

test('environment engine credentials auto-configure the private gateway once',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-n4-'));
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
