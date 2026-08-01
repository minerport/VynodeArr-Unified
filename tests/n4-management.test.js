import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EngineManagementService } from '../.server-build/packages/platform/src/engine-management-service.js';
import { EngineSettingsService } from '../.server-build/packages/platform/src/engine-settings-service.js';
import { televisionAddPayload } from '../.server-build/apps/api/src/app.js';

test('television adds preserve monitoring and immediate automatic-search options',()=>{
  assert.deepEqual(televisionAddPayload({title:'Series',monitor:'future',monitored:true,addOptions:{searchForMissingEpisodes:true}}).addOptions,{monitor:'future',searchForMissingEpisodes:true,searchForCutoffUnmetEpisodes:false});
  assert.deepEqual(televisionAddPayload({title:'Series',monitored:false,addOptions:{}}).addOptions,{monitor:'none',searchForMissingEpisodes:false,searchForCutoffUnmetEpisodes:false});
});

test('management gateway exposes native capabilities and forwards only allowlisted operations',async()=>{
  const calls=[];
  const client={
    get:async(path,query)=>{calls.push(['GET',path,query]);return[{id:1,name:'Profile'}];},
    post:async(path,payload)=>{calls.push(['POST',path,payload]);return{id:2,...payload};},
    put:async(path,payload,query)=>{calls.push(['PUT',path,payload,query]);return payload;},
    delete:async(path,query,payload)=>{calls.push(['DELETE',path,payload,query]);return null;}
  };
  const service=new EngineManagementService({get:()=>({client})});
  assert.equal(service.available('movie'),true);
  const catalog=service.catalog('movie');
  assert.ok(catalog.some((item)=>item.key==='library'&&item.methods.includes('PUT')));
  assert.ok(catalog.some((item)=>item.key==='libraryFolder'&&item.methods.includes('GET')));
  assert.ok(catalog.some((item)=>item.key==='libraryEditor'&&item.methods.includes('DELETE')));
  assert.ok(catalog.some((item)=>item.key==='indexers'&&item.methods.includes('POST')));
  assert.ok(catalog.some((item)=>item.key==='customFormats'&&item.methods.includes('PUT')));
  assert.ok(catalog.some((item)=>item.key==='customFormatSchemas'&&item.methods.length===1&&item.methods[0]==='GET'));
  assert.ok(catalog.some((item)=>item.key==='restrictions'&&item.methods.includes('POST')));
  assert.ok(catalog.some((item)=>item.key==='releaseProfiles'&&item.methods.includes('POST')));
  assert.ok(service.catalog('tv').some((item)=>item.key==='releaseProfiles'&&item.methods.includes('PUT')));
  for(const key of ['calendar','wantedMissing','blocklist','releases','filesystem','remotePathMappings','indexerSchemas','downloadClientSettings','diskSpace','tasks','backups','updates','events'])assert.ok(catalog.some((item)=>item.key===key),key);
  await service.execute('movie','profiles','GET');
  await service.execute('movie','library','POST',{payload:{title:'New movie'}});
  await service.execute('movie','library','PUT',{id:7,payload:{id:7,monitored:true},query:{moveFiles:'true'}});
  await service.execute('movie','library','DELETE',{id:7});
  await service.execute('movie','libraryEditor','DELETE',{payload:{movieIds:[7],deleteFiles:false}});
  await service.execute('movie','libraryFolder','GET',{id:7});
  await service.execute('tv','library','POST',{payload:{title:'New series',addOptions:{monitor:'all',searchForMissingEpisodes:true,searchForCutoffUnmetEpisodes:false}}});
  await service.execute('tv','commands','POST',{payload:{name:'SeriesSearch',seriesId:8}});
  await service.execute('tv','commands','POST',{payload:{name:'SeasonSearch',seriesId:8,seasonNumber:1}});
  await service.execute('tv','commands','POST',{payload:{name:'EpisodeSearch',episodeIds:[81,82]}});
  assert.deepEqual(calls.map((call)=>call.slice(0,2)),[
    ['GET','qualityprofile'],['POST','movie'],['PUT','movie/7'],['DELETE','movie/7'],['DELETE','movie/editor'],['GET','movie/7/folder'],['POST','series'],['POST','command'],['POST','command'],['POST','command']
  ]);
  assert.deepEqual(calls[2][3],{moveFiles:'true'});
  assert.deepEqual(calls[4][2],{movieIds:[7],deleteFiles:false});
  assert.equal(calls[6][2].addOptions.searchForMissingEpisodes,true);
  assert.deepEqual(calls.slice(7,10).map(call=>call[2].name),['SeriesSearch','SeasonSearch','EpisodeSearch']);
  await service.execute('movie','customFormatSchemas','GET');
  await service.execute('movie','releaseProfiles','POST',{payload:{name:'No Italian',ignored:['ITA','ITALIAN']}});
  await service.execute('tv','releaseProfiles','PUT',{id:9,payload:{id:9,name:'No Italian'}});
  assert.deepEqual(calls.slice(-3).map((call)=>call.slice(0,2)),[
    ['GET','customformat/schema'],['POST','releaseprofile'],['PUT','releaseprofile/9']
  ]);
  await assert.rejects(()=>service.execute('movie','system/status','DELETE',{id:1}),/not available/);
  await assert.rejects(()=>service.execute('movie','library','DELETE'),/identifier/);
});

test('native interaction workflows replace an upstream-shaped generic shell',async()=>{
  const [html,script,apiSource,clientSource,librarySource,queueSource,releaseBrowser,stateSource,importAnalysisSource,importMonitorSource,legacyImportViewSource]=await Promise.all([
    readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/client/src/app-shell.ts',import.meta.url),'utf8'),
    readFile(new URL('../apps/api/src/app.js',import.meta.url),'utf8'),
    readFile(new URL('../packages/platform/src/read-only-engine-client.ts',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/client/src/library.tsx',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/client/src/queue.tsx',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/client/src/release-browser.tsx',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/client/src/app-state.ts',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/client/src/library-import-analysis.ts',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/client/src/import-monitor-controller.ts',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/client/src/legacy-import-monitor-view.ts',import.meta.url),'utf8')
  ]);
  for(const route of ['#add','#wanted','#queue','#service/root-folders','#system'])assert.match(html,new RegExp(route));
  for(const workflow of ['wanted-series-search','wanted-season-search','SeriesSearch','SeasonSearch','Search entire show','Search entire season'])assert.match(script,new RegExp(workflow));
  for(const workflow of ['seasonTone','episodeTone','availability-complete','availability-missing','availability-unmonitored','availability-count'])assert.match(script,new RegExp(workflow));
  for(const workflow of ['season-monitor','data-file-count','This season is no longer available','Season ${seasonNumber} monitored'])assert.ok(script.includes(workflow));
  for(const workflow of ['setupLibraryBulkSelection','bulk-select-visible','Refresh & scan selected','Edit selected','Remove selected','libraryEditor','movieIds:ids','seriesIds:ids','Change quality profile','Change root folder','Change minimum availability','setupTvDetailBulk','season-select','episode-select','bulk-monitor','bulk-unmonitor','SeasonSearch'])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ['wireLibraryImportReview','Select all shown','Unmatched only','Possible mismatches','Find match','run-import-lookup','import-mismatch','import-unmatched','Already imported match','selected match is already in the library'])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ['scanNameParts','comparableTitle','scanDuplicateKey','analyzeDuplicateFolders','classifyImportChoice'])assert.ok(importAnalysisSource.includes(workflow),workflow);
  for(const workflow of ['item.backdrop','detail-backdrop','detail-copy'])assert.match(script,new RegExp(workflow.replace('.','\\.')));
  for(const workflow of ['wantedImage','wanted-art','wanted-movie-row','wanted-episode-row','/api/artwork/movie/movie_${item.id}/poster','/api/artwork/tv/series_${seriesId}/fanart','/api/artwork/tv-metadata/${tvdbId}','season?season=${season}','episode?season=${season}&episode=${item.episodeNumber}'])assert.ok(script.includes(workflow));
  for(const workflow of ['queuePoll','load({quiet:true})','queue-poster','tone=item','clientFilename','clientTimeLeft','/api/activity/queue/live','showMediaManagement','media-management','mediaSettingOptions','flattenMediaSettings','mediaManagement','Naming and folders','Importing and file management'])assert.ok(script.includes(workflow));
  for(const workflow of ['releaseEligible','Grab anyway','release-warning','Only rejected releases were returned. Use Interactive Search','No releases were returned by the configured indexers.'])assert.ok(script.includes(workflow)||apiSource.includes(workflow),workflow);
  assert.match(releaseBrowser,/Grab anyway/);
  assert.doesNotMatch(releaseBrowser,/grabbing!==null\|\|!isAccepted/);
  for(const workflow of ['/api/media-match','rematchMedia','addImportExclusion:false','addImportListExclusion:false','The original match was restored when possible',"already in the ${domain==='movie'?'Movies':'Television'} library",'Fix match'])assert.ok(script.includes(workflow)||apiSource.includes(workflow),workflow);
  for(const workflow of ['quality-range-track','data-control="range"','qualityDefinitionLimits','data-dirty="true"','Save limits to engine',"`/api/manage/${domain.value}/qualityDefinitions/${payload.id}`","method:'PUT'"])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ['liveQueue','includeMovie:true','includeSeries:true','includeEpisode:true','trackedDownloadState','clientStatus','clientFilename','/api/activity/queue/live'])assert.ok(apiSource.includes(workflow));
  assert.match(queueSource,/if\(requestPending\.current\)return/);
  assert.match(queueSource,/Queue item removed\.'\);await load\(\)/);
  assert.ok(!apiSource.includes('includeUnknownMovieItems:true'),'live queue must not request untracked movie download-client items');
  assert.ok(!apiSource.includes('includeUnknownSeriesItems:true'),'live queue must not request untracked television download-client items');
  assert.ok(apiSource.includes('engineRecords.filter(item=>{const id=linkedId(item);return Number.isFinite(id)&&id>0;})'),'live queue must exclude records that are not associated with engine media');
assert.ok(apiSource.includes('return !importedEvent(item)'),'live queue must retain paused and completed-pending-import records until import history confirms completion');
assert.ok(apiSource.includes('scheduleImportedUpgradeRename(domain,item,confirmedImport)'),'confirmed upgrade imports must apply the engine naming rules before queue cleanup');
assert.ok(apiSource.includes("event?.data?.isUpgrade??event?.isUpgrade"),'post-import rename must be limited to engine-confirmed upgrades');
  assert.match(apiSource,/domain==='movie'\?naming\?\.renameMovies:naming\?\.renameEpisodes/,'post-upgrade renaming must respect each engine naming setting');
assert.ok(apiSource.includes("domain==='movie'?{name:'RenameMovie',movieIds:[mediaId]}:{name:'RenameSeries',seriesIds:[mediaId]}"),'post-upgrade renaming must use the native movie and television rename commands');
  assert.ok(!apiSource.includes("apikey:apiKey"),'live queue must rely on the engines authenticated client polling, not masked provider credentials');
  for(const workflow of ['tvMetadataArtwork','api.tvmaze.com/lookup/shows','api.tvmaze.com/shows/${show.id}/seasons','episodebynumber','static.tvmaze.com'])assert.ok(apiSource.includes(workflow));
  for(const workflow of ['showEngineManagement','Repair automatic connections','external-engine-settings','Engine keys are created once during installation','Changing this key affects external applications','Seerr and every other connected application','/api/settings/engines/repair'])assert.ok(script.includes(workflow));
  for(const workflow of ['External application access','Reveal','Copy','Generate new key','/api/settings/engines/${domain}/api-key'])assert.ok(script.includes(workflow));
  for(const workflow of ["reveal.textContent==='Hide'","code.textContent='Hidden'","reveal.textContent='Reveal'"])assert.ok(script.includes(workflow));
  for(const workflow of ["client.post('command',{name:'ResetApiKey'})","/engine-config/${domain}/config.xml",'The engine did not provide its newly generated API key'])assert.ok(apiSource.includes(workflow));
  for(const workflow of ["proxyCompatibilityApi","'/movies'","'/tv'","Compatibility API endpoint not found"])assert.ok(apiSource.includes(workflow));
  assert.ok(apiSource.includes("xml.match(/<ApiKey>([^<]+)<\\/ApiKey>/i)"),'bundled engine configuration must remain the credential source of truth');
  assert.ok(apiSource.includes('did not reconnect with the new API key'));
  for(const workflow of ['taskSections(items)','MOVIE ENGINE','TELEVISION ENGINE','Automatic schedules are active','Automatically every','item.interval','lastExecution','nextExecution','Queueing…','Queued ✓','/api/system/application-update','VynodeArr updates'])assert.ok(script.includes(workflow)||apiSource.includes(workflow));
  for(const workflow of ['backupSections(items)','configuration backup','Create Movies and Television backups','restore-backup','/api/system/backups/${button.dataset.domain}/${button.dataset.id}/restore','did not reconnect after restoring the backup'])assert.ok(script.includes(workflow)||apiSource.includes(workflow));
  for(const workflow of ["client.post('command',{name:'Restart'})",'historySections(items)','eventSections(items)','wireEventFilters','event-toolbar','Movie and television activity separated by library'])assert.ok(script.includes(workflow)||apiSource.includes(workflow));
  for(const workflow of ['Download backups before uninstalling','Upload & restore','backup-upload-input','/download','/upload','completeEngineRestore','Backup must be a .zip, .db, or .xml file'])assert.ok(script.includes(workflow)||apiSource.includes(workflow));
  for(const workflow of ['vynodearr-application-backup','aes-256-gcm','scryptSync','application_backup.downloaded','application_backup.restored','pre-restore-','backup_download_expired'])assert.ok(apiSource.includes(workflow),workflow);
  for(const workflow of ['systemValidation','system-validation.json','automaticValidation','/api/system/validation','validation.synchronized','validation.engine_connections_repaired','unsupported_repair'])assert.ok(apiSource.includes(workflow),workflow);
  for(const workflow of ['VynodeArr_${domain===','vynodearr.libraryView.${kind}','views:{movies:savedLibraryView'])assert.ok(script.includes(workflow)||apiSource.includes(workflow)||stateSource.includes(workflow),workflow);
  for(const workflow of ["serviceTabs('advanced')",'statusSections(values)','storage-summary','status-domain-section'])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ['privateProviderKeys','providerPresentation','mergeProviderPayload','Provider help is available through VynodeArr.'])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ['mediaPath(values.rootFolderPath,raw.path)','path:mediaPath','moveFiles=true'])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ['requestRemoteArtwork','image?.remoteUrl','tmdb.org','thetvdb.com'])assert.ok(clientSource.includes(workflow),workflow);
  for(const workflow of ['showAddMedia','discovery-art','remotePoster','showCalendar','calendar-grid','calendar-movies','showWanted','wanted-domain','wanted-show','wanted-season','wanted-interactive','showQueue','queue-table','data-queue-sort','showRootFolders','storage-config-grid','Download folder','Library folders','reviewMovieImport','reviewTvImport','reviewLibraryImport','Not imported','Already imported','imported-folder-group','vynodearr.dismissedImportJobs','saveDismissedImportJobs','startBackgroundImport','checkbox.checked=false','/api/import-jobs','Library imports','const target=event.currentTarget','Scan for','Import selected movies','Import selected series','showProfiles','showProviders','loadPolicy','Failed download handling','autoRedownloadFailed','Indexers','Download Clients','All provider options','folder-browser','Choose folder','Use this folder','attachDetailActions','episode-monitor','episode-auto-search','episode-interactive-search','Monitoring…','Unmonitoring…','Automatic search','Interactive search','release-table','data-sort','Source','Quality','Size','Seeders','grab-release','createRecord','Refresh & scan','Allowed qualities','Custom format scores','Create Movies and Television backups'])assert.match(script+legacyImportViewSource,new RegExp(workflow.replace(/[&]/g,'&')));
  assert.doesNotMatch(script,/button\.textContent='Importing…'/);
  for(const workflow of ['importIdentityKeys','skipped:job.skipped','already present/skipped','importPaceMs','VYNODEARR_IMPORT_PACE_MS','sync.invalidate(domain)','mapWithConcurrency(folders,4','toggle-import-panel'])assert.ok(script.includes(workflow)||apiSource.includes(workflow)||legacyImportViewSource.includes(workflow),workflow);
  for(const redundantWork of ['Scanning imported folders','movieIds:createdIds','setTimeout(()=>sync.synchronize(domain).catch(()=>{}),15_000)'])assert.ok(!apiSource.includes(redundantWork),redundantWork);
  for(const workflow of ['duplicateImportError','qualityRank','eligibleRelease','approved!==false','downloadAllowed!==false','customFormatScore','compareReleases','automaticSearch','acceptedCandidates','Selecting best release','Media location','fileLocation'])assert.ok(script.includes(workflow)||apiSource.includes(workflow),workflow);
  for(const workflow of ['televisionSeriesReleases','includeEpisodeFile:true','query.seriesId','query.seasonNumber','episode.seasonNumber','batchSize=8','interactiveReleaseCache','releaseCacheTtlMs=45_000','cachedInteractiveReleases','clearReleaseCache','reacquireRelease','mappedMovieId','mappedEpisodeInfo','episodeId','query.movieId','query.episodeId','no longer available from the search source','explainEmptyTelevisionSearch','No television indexer is enabled for interactive search'])assert.ok(apiSource.includes(workflow),workflow);
  assert.match(apiSource,/if\(mode==='engine'\)\{void sync\.synchronize/,'engine library edits must return before a full background library synchronization');
  for(const workflow of ["route=movie?'movie':'series'",'freshRoots','monitored=true'])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ["String(path).replace(/^\\/+?/,'')==='release'".replace('+?','+'),'120_000'])assert.ok(clientSource.includes(workflow),workflow);
  for(const workflow of ['[400,404,409,422,500]','item?.detail','item?.description'])assert.ok(clientSource.includes(workflow),workflow);
  for(const workflow of ['VYNODEARR_IMPORT_PACE_MS||25','cancelRequested',"status='canceling'",'cancel-import-job','milestones=new Map<string,number>','job.completed%50===0','Stopping after the current item','Refresh and folder scan queued','includeFiles=true','Video files ('])assert.ok(script.includes(workflow)||apiSource.includes(workflow)||importMonitorSource.includes(workflow)||legacyImportViewSource.includes(workflow),workflow);
  for(const workflow of ['startMissingSearchJob','/api/search-jobs','Search all missing','Stopping after the current batch','MoviesSearch','EpisodeSearch','ensureBundledDownloadPathMappings','VYNODEARR_DOWNLOAD_CLIENT_REMOTE_PATH','/data/complete','/downloads','detail-navigation','← Previous','Next →'])assert.ok(script.includes(workflow)||apiSource.includes(workflow),workflow);
  for(const workflow of ['/api/library-events','text/event-stream','library-updated','queueImportedLibraryReconciliation','completedLibraryImports','new EventSource','events.close()'])assert.ok(script.includes(workflow)||apiSource.includes(workflow)||librarySource.includes(workflow),workflow);
  for(const workflow of ['closeDetailFromBackdrop','backdropPress','onpointercancel'])assert.ok(script.includes(workflow),workflow);
  assert.ok(!librarySource.includes('window.setInterval(resume,30_000)'),'mounted libraries must react to imported-history events instead of polling every 30 seconds');
  for(const workflow of ['reassignMediaFile','/api/media-files/reassign','filterExistingFiles:false',"name:'ManualImport'","importMode:'Auto'",'Choose movie file','episode-change-file','CHOOSE MEDIA FILE','This replaces its stale file association'])assert.ok(script.includes(workflow)||apiSource.includes(workflow),workflow);
  for(const workflow of ['queue-removing',"button.classList.add('activated')","button.textContent='Removing…'",'queue-select-all','queue-select-completed','queue-status-filter','queue-media-filter','queue-source-filter','removeQueueButton'])assert.ok(script.includes(workflow),workflow);
  for(const workflow of ['showCollectionsV2','collection-builder-layout','LIVE PREVIEW','titleContains','genres','decade','includedMovieIds','excludedMovieIds','Changing rules replaces the current matches','retain-preview-movie','remove-preview-movie','Edit rules & movies'])assert.ok(script.includes(workflow)||apiSource.includes(workflow),workflow);
  for(const workflow of ['Rename & organize','Rename selected','Retry organize','wireHistoryActions','/api/media-files/rename','renameMediaPreview','renamePlans','previewId','renameMediaSignature','This media changed after the rename preview','existingPath','newPath','renameAfterFolderMove',"name:'RenameFiles'","name:'RefreshMovie'","name:'RefreshSeries'",'refreshStatus','timed-out','file.path||item.existingPath','outsideLibraryFolder','requestedIds','moveFolder','fileIds','deleteRenamePreviewFile','movieFiles','episodeFiles','moveFiles:true','libraryFolder'])assert.ok(script.includes(workflow)||apiSource.includes(workflow),workflow);
  for(const workflow of ['namingAuditJobs','runNamingAudit','publicNamingAuditJob','/api/media-files/naming-audit','storePlan:false'])assert.ok(apiSource.includes(workflow),workflow);
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
