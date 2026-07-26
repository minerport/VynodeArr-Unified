import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname,join,normalize,resolve } from 'node:path';
import { MediaEngineRegistry } from '../../../packages/platform/src/engine-registry.js';
import { loadEngineConfiguration,loadSecret,publicEngineConfiguration } from '../../../packages/platform/src/engine-config.js';
import { SynchronizationService } from '../../../packages/platform/src/synchronization-service.js';
import { ProjectionStore } from '../../../packages/platform/src/projection-store.js';
import { AuthService } from '../../../packages/platform/src/auth-service.js';
import { EngineSettingsService } from '../../../packages/platform/src/engine-settings-service.js';
import { EngineManagementService } from '../../../packages/platform/src/engine-management-service.js';
import { JsonStore } from '../../../packages/platform/src/json-store.js';
import { MovieEngineAdapter } from '../../../packages/movie-domain/src/engine-adapter.js';
import { TvEngineAdapter } from '../../../packages/tv-domain/src/engine-adapter.js';
import { MovieFixtureAdapter } from '../../../packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../../../packages/tv-domain/src/fixture-adapter.js';
import { completedQueueItemHasArrived } from '../../../packages/contracts/src/mappers.js';
import { TmdbDiscoveryService } from './tmdb-discovery.js';

const applicationVersion=JSON.parse(await readFile(resolve(process.cwd(),'package.json'),'utf8')).version;
const webRoot=resolve(process.cwd(),'apps/web/public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const cookies=(header='')=>Object.fromEntries(header.split(';').map((part)=>part.trim().split('=').map(decodeURIComponent)).filter(([key])=>key));
const redact=(value)=>String(value||'').replace(/https?:\/\/\S+/gi,'[internal service]').replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g,'[internal host]').replace(/[A-Za-z0-9_-]{24,}/g,'[redacted]');
async function body(req,maxSize=1_500_000){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>maxSize)throw new Error('Request is too large');chunks.push(chunk);}return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};}
function json(res,status,value,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...headers});res.end(JSON.stringify(value));}
function safeError(res,error,domain,url=''){const engine=Boolean(error?.safeMessage||error?.code?.startsWith('engine_'));const message=redact(engine?(error.safeMessage||(domain?`${domain} service unavailable`:'Media data could not be refreshed')):error?.message||'The request could not be completed.');const status=error?.code==='engine_validation_failed'?400:error?.code==='engine_authentication_failed'?502:engine?503:400;json(res,status,{error:{code:engine?(error.code||'service_unavailable'):'validation_failed',message}});}
function sessionFor(req,auth){return auth.session(cookies(req.headers.cookie).vynodearr_session);}
function requireSession(req,res,auth){const session=sessionFor(req,auth);if(!session){json(res,401,{error:{code:'authentication_required',message:'Sign in to VynodeArr to continue.'}});return null;}return session;}
function requireCsrf(req,res,session){if(req.headers['x-vynodearr-csrf']!==session.csrf){json(res,403,{error:{code:'csrf_invalid',message:'The security token was invalid.'}});return false;}return true;}
function administrator(res,session){if(session.user.role!=='administrator'){json(res,403,{error:{code:'administrator_required',message:'Administrator access is required.'}});return false;}return true;}
const hopHeaders=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
function dashboardAnalytics(movies=[],series=[],history=[],days=30,qualityProfiles={}){
  const dayKeys=Array.from({length:days},(_,index)=>new Date(Date.now()-(days-index-1)*86400000).toISOString().slice(0,10));
  const downloads={movie:Object.fromEntries(dayKeys.map(day=>[day,0])),tv:Object.fromEntries(dayKeys.map(day=>[day,0]))};
  const activity={movie:{completed:0,grabbed:0,failed:0},tv:{completed:0,grabbed:0,failed:0}};
  for(const item of history){
    const domain=item.domain==='tv'?'tv':'movie',event=String(item.eventType||'').toLowerCase();
    const parsedTimestamp=item.timestamp?new Date(item.timestamp):null;
    const day=parsedTimestamp&&!Number.isNaN(parsedTimestamp.getTime())?parsedTimestamp.toISOString().slice(0,10):'';
    if(event.includes('failed'))activity[domain].failed++;
    else if(event.includes('grabbed'))activity[domain].grabbed++;
    else if(event.includes('imported')||event.includes('downloaded')){
      activity[domain].completed++;
      if(day in downloads[domain])downloads[domain][day]++;
    }
  }
  const distribution=(items,selector)=>Object.entries(items.reduce((counts,item)=>{const value=selector(item)||'Unknown';counts[value]=(counts[value]||0)+1;return counts;},{})).map(([name,count])=>({name,count})).sort((left,right)=>right.count-left.count);
  const movieAvailable=movies.filter(item=>item.hasFile).length;
  const tvMissing=series.reduce((sum,item)=>sum+Number(item.monitoring==='none'?0:item.missingEpisodes||0),0);
  return{
    rangeDays:days,
    downloadsOverTime:{
      movie:dayKeys.map(date=>({date,count:downloads.movie[date]})),
      tv:dayKeys.map(date=>({date,count:downloads.tv[date]}))
    },
    qualityDistribution:{
      movie:distribution(movies,item=>item.quality),
      tv:distribution(series,item=>qualityProfiles.tv?.get(String(item.qualityProfile))||item.qualityProfile)
    },
    activity,
    library:{
      movie:{total:movies.length,available:movieAvailable,missing:movies.filter(item=>item.state==='missing').length,belowCutoff:movies.filter(item=>item.state==='cutoff').length,monitored:movies.filter(item=>item.monitoring!=='none').length,sizeOnDisk:movies.reduce((sum,item)=>sum+Number(item.sizeOnDisk||0),0)},
      tv:{total:series.length,complete:series.filter(item=>Number(item.missingEpisodes||0)===0).length,needsAttention:series.filter(item=>item.monitoring!=='none'&&Number(item.missingEpisodes||0)>0).length,monitored:series.filter(item=>item.monitoring!=='none').length,episodesMissing:tvMissing,sizeOnDisk:series.reduce((sum,item)=>sum+Number(item.sizeOnDisk||0),0)}
    }
  };
}

export function createApplication(options={}){
  const env=options.env||process.env,baseConfig=options.config||loadEngineConfiguration(env);
  let dashboardSnapshot=null,dashboardSnapshotExpires=0,dashboardSnapshotRun=null;
  const dataDir=resolve(env.VYNODEARR_DATA_DIR||resolve(process.cwd(),'data'));
  const auth=options.auth||new AuthService({userFile:join(dataDir,'users.json'),sessionFile:join(dataDir,'sessions.json'),secureCookies:String(env.VYNODEARR_SECURE_COOKIES||env.NODE_ENV==='production')==='true'});
  const engineSettings=options.engineSettings||new EngineSettingsService({path:join(dataDir,'engine-settings.json'),vaultPath:join(dataDir,'credentials.enc'),masterKey:options.masterKey||loadSecret(env,'VYNODEARR_MASTER_KEY')||'local-development-key-change-me-2026',defaults:baseConfig});
  const projectionStore=options.projectionStore||new ProjectionStore(join(dataDir,'projections.json'));
  const auditStore=options.auditStore||new JsonStore(join(dataDir,'management-audit.json'),{version:1,entries:[]});
  const collectionStore=options.collectionStore||new JsonStore(join(dataDir,'collections.json'),{version:1,collections:[]});
  const defaultDownloadFolder=domain=>String(env[domain==='movie'?'VYNODEARR_MOVIE_DOWNLOADS_PATH':'VYNODEARR_TV_DOWNLOADS_PATH']||env.VYNODEARR_DOWNLOADS_PATH||'/downloads').replace(/\/+$/,'')||'/downloads';
  const downloadClientRemotePath=domain=>String(env[domain==='movie'?'VYNODEARR_MOVIE_DOWNLOAD_CLIENT_REMOTE_PATH':'VYNODEARR_TV_DOWNLOAD_CLIENT_REMOTE_PATH']||env.VYNODEARR_DOWNLOAD_CLIENT_REMOTE_PATH||'/data/complete').replace(/\/+$/,'')||'/data/complete';
  const downloadFolderStore=options.downloadFolderStore||new JsonStore(join(dataDir,'download-folders.json'),{version:1,movie:{path:defaultDownloadFolder('movie')},tv:{path:defaultDownloadFolder('tv')},updatedAt:null});
  const discovery=options.discovery||new TmdbDiscoveryService({token:env.TMDB_API_READ_TOKEN||env.TMDB_API_KEY});
  const artworkCache=new Map(),artworkRuns=new Map(),tvMetadataCache=new Map();let mode=baseConfig.dataMode;
  let movie=options.movie||(mode==='fixture'?new MovieFixtureAdapter(baseConfig.movie):new MovieEngineAdapter(baseConfig.movie));
  let tv=options.tv||(mode==='fixture'?new TvFixtureAdapter(baseConfig.tv):new TvEngineAdapter(baseConfig.tv));
  const registry=options.registry||new MediaEngineRegistry().register('movie',movie).register('tv',tv);
  const sync=options.sync||new SynchronizationService({movie,tv,maxItems:baseConfig.cacheMaxItems,pollIntervalMs:baseConfig.pollIntervalMs,projectionStore});
  const enginesConfigured=()=>mode==='fixture'||engineSettings.configured();
  const management=new EngineManagementService(registry);
const importJobs=new Map(),searchJobs=new Map(),completedQueueRefreshes=new Map(),completedQueueCleanups=new Map(),completedUpgradeRenames=new Map(),interactiveReleaseCache=new Map(),renamePlans=new Map();
  let initialized=false,queueCompletionTimer=null;
  function importIdentityKeys(value={}){
    const keys=[],title=String(value.title||value.name||'').trim().toLowerCase(),year=Number(value.year||0);
    for(const field of ['tmdbId','tvdbId','imdbId'])if(value[field])keys.push(`${field}:${String(value[field]).toLowerCase()}`);
    const path=String(value.path||'').replaceAll('\\','/').replace(/\/+$/,'').toLowerCase();if(path)keys.push(`path:${path}`);
    if(!keys.length&&title)keys.push(`title:${title}:${year||''}`);
    return keys;
  }
  function publicImportJob(job){return{id:job.id,domain:job.domain,label:job.label,status:job.status,total:job.total,completed:job.completed,skipped:job.skipped,failed:job.failed,currentTitle:job.currentTitle,errors:job.errors.slice(-25),createdAt:job.createdAt,finishedAt:job.finishedAt};}
  function publicSearchJob(job){return{id:job.id,domain:job.domain,label:job.label,status:job.status,total:job.total,completed:job.completed,failed:job.failed,currentTitle:job.currentTitle,errors:job.errors.slice(-25),createdAt:job.createdAt,finishedAt:job.finishedAt};}
  const duplicateImportError=(message)=>/(?:already|existing).*(?:add|exist|configur|use)|(?:path|tmdb|tvdb|title).*(?:already|exist|configur|use)|another (?:movie|series)/i.test(String(message||''));
  const qualityRank=(release)=>{
    const name=String(release?.quality?.quality?.name||release?.quality?.name||release?.title||'').toLowerCase();
    const resolution=name.includes('2160')?4000:name.includes('1080')?3000:name.includes('720')?2000:name.includes('480')||name.includes('576')?1000:0;
    const source=name.includes('remux')?900:name.includes('bluray')||name.includes('blu-ray')?800:name.includes('webdl')||name.includes('web-dl')?700:name.includes('webrip')||name.includes('web-rip')?650:name.includes('hdtv')?500:name.includes('dvd')?300:0;
    return Number(release?.qualityWeight||0)||resolution+source;
  };
  const eligibleRelease=(release)=>Boolean(release)&&release.rejected!==true&&release.approved!==false&&release.downloadAllowed!==false&&!(release.rejections||[]).length;
  const compareReleases=(left,right)=>qualityRank(right)-qualityRank(left)||Number(right.customFormatScore||0)-Number(left.customFormatScore||0)||Number(left.size||Number.MAX_SAFE_INTEGER)-Number(right.size||Number.MAX_SAFE_INTEGER);
  const releaseCacheTtlMs=45_000;
  const releaseCacheKey=(domain,query)=>`${domain}:${Object.entries(query||{}).filter(([key,value])=>key!=='force'&&value!==undefined&&value!=='').sort(([left],[right])=>left.localeCompare(right)).map(([key,value])=>`${key}=${value}`).join('&')}`;
  const clearReleaseCache=domain=>{for(const key of interactiveReleaseCache.keys())if(!domain||key.startsWith(`${domain}:`))interactiveReleaseCache.delete(key);};
  async function cachedInteractiveReleases(domain,query,loader){
    const key=releaseCacheKey(domain,query),now=Date.now(),cached=interactiveReleaseCache.get(key),force=String(query?.force||'')==='true';
    if(!force&&cached&&cached.expiresAt>now)return cached.promise;
    const promise=Promise.resolve().then(loader).then(result=>Array.isArray(result)?result:[]).catch(error=>{interactiveReleaseCache.delete(key);throw error;});
    interactiveReleaseCache.set(key,{expiresAt:now+releaseCacheTtlMs,promise});
    return promise;
  }
  async function televisionSeriesReleases(seriesId,seasonNumber){
    const episodes=await management.execute('tv','episodes','GET',{query:{seriesId:Number(seriesId),includeEpisodeFile:true}});
    const candidates=(Array.isArray(episodes)?episodes:[])
      .filter(episode=>seasonNumber===undefined||seasonNumber===''||Number(episode.seasonNumber)===Number(seasonNumber))
      .filter(episode=>episode.monitored!==false)
      .sort((left,right)=>Number(Boolean(left.hasFile))-Number(Boolean(right.hasFile))||new Date(right.airDateUtc||right.airDate||0)-new Date(left.airDateUtc||left.airDate||0));
    const releases=[],seen=new Set(),batchSize=8,limit=Math.min(candidates.length,40);
    for(let offset=0;offset<limit;offset+=batchSize){
      const episodeBatch=candidates.slice(offset,offset+batchSize);
      const batch=await Promise.all(episodeBatch.map(episode=>{const query={episodeId:Number(episode.id)};return cachedInteractiveReleases('tv',query,()=>management.execute('tv','releases','GET',{query})).catch(()=>[]);}));
      for(let batchIndex=0;batchIndex<batch.length;batchIndex++)for(const rawRelease of Array.isArray(batch[batchIndex])?batch[batchIndex]:[]){
        const release={...rawRelease,episodeId:Number(rawRelease.episodeId||episodeBatch[batchIndex].id)};
        const key=String(release.guid||release.downloadUrl||release.title||'');
        if(!key||seen.has(key))continue;
        seen.add(key);releases.push(release);
      }
      if(releases.length>=100)break;
    }
    return releases.sort(compareReleases).slice(0,200);
  }
  async function reacquireRelease(domain,release){
    const movieId=Number(release?.mappedMovieId||release?.movieId);
    const mappedEpisode=Array.isArray(release?.mappedEpisodeInfo)?release.mappedEpisodeInfo[0]:null;
    const episodeId=Number(release?.episodeId||release?.mappedEpisodeId||mappedEpisode?.id);
    const identity=domain==='movie'?movieId:episodeId;
    const guid=String(release?.guid||''),indexerId=Number(release?.indexerId);
    if(!Number.isFinite(identity)||!guid||!Number.isFinite(indexerId)){
      throw new Error(`This release is missing its ${domain==='movie'?'movie':'television episode'} or indexer identity. Search again before grabbing it.`);
    }
    const current=await management.execute(domain,'releases','GET',{query:domain==='movie'?{movieId}:{episodeId}});
    const match=(Array.isArray(current)?current:[]).find(item=>Number(item.indexerId)===indexerId&&String(item.guid||'')===guid);
    if(!match)throw new Error('This release is no longer available from the search source. Search again and choose another result.');
    return match;
  }
  async function explainEmptyTelevisionSearch(query,result){
    if(!query.episodeId||!Array.isArray(result)||result.length)return result;
    const indexers=await management.execute('tv','indexers','GET').catch(()=>[]);
    const enabled=(Array.isArray(indexers)?indexers:[]).filter(indexer=>(indexer.enable??true)&&indexer.enableInteractiveSearch!==false);
    if(!enabled.length)throw new Error('No television indexer is enabled for interactive search. Open Service Settings, choose Television, and configure an indexer.');
    return result;
  }
  async function rematchMedia(input){
    const domain=String(input.domain||''),mediaId=Number(input.mediaId),tmdbId=Number(input.tmdbId);
    if(!['movie','tv'].includes(domain)||!Number.isFinite(mediaId)||!Number.isFinite(tmdbId))throw new Error('Choose a valid TMDB match');
    if(!discovery.configured())throw new Error('Add a TMDB key in Service Settings before fixing library matches.');
    const current=await management.execute(domain,'library','GET',{id:mediaId}),metadata=await discovery.details(domain,tmdbId);
    const lookupTerms=[`tmdb:${tmdbId}`,metadata.title].filter(Boolean);let matches=[];
    for(const term of lookupTerms){matches=await management.execute(domain,'lookup','GET',{query:{term}});if(Array.isArray(matches)&&matches.length)break;}
    const normalized=String(metadata.title||'').toLowerCase(),match=(Array.isArray(matches)?matches:[]).find(value=>Number(value.tmdbId)===tmdbId||(metadata.tvdbId&&Number(value.tvdbId)===Number(metadata.tvdbId)))||(Array.isArray(matches)?matches:[]).find(value=>String(value.title||'').toLowerCase()===normalized&&(!metadata.year||!value.year||Number(value.year)===Number(metadata.year)));
    if(!match)throw new Error(`The ${domain==='movie'?'movie':'television'} engine could not resolve that TMDB title. Try another match.`);
    const library=await management.execute(domain,'library','GET'),records=Array.isArray(library)?library:library?.records||[],duplicate=records.find(value=>Number(value.id)!==mediaId&&(Number(value.tmdbId)===tmdbId||(metadata.tvdbId&&Number(value.tvdbId)===Number(metadata.tvdbId))));
    if(duplicate)throw new Error(`${match.title} is already matched elsewhere in this library.`);
    const currentPath=String(current.path||'').replace(/[\\/]+$/,''),rootFolderPath=current.rootFolderPath||currentPath.replace(/[\\/][^\\/]+$/,'');
    const replacement={...match,path:current.path,rootFolderPath,qualityProfileId:current.qualityProfileId,monitored:current.monitored,tags:current.tags||[],...(domain==='movie'?{minimumAvailability:current.minimumAvailability,addOptions:{searchForMovie:false}}:{seriesType:current.seriesType,seasonFolder:current.seasonFolder,addOptions:{monitor:current.monitored?'all':'none',searchForMissingEpisodes:false,searchForCutoffUnmetEpisodes:false}})};
    const rollback={...current};for(const key of ['id','movieFile','statistics','sizeOnDisk','added'])delete rollback[key];
    await management.execute(domain,'library','DELETE',{id:mediaId,query:domain==='movie'?{deleteFiles:false,addImportExclusion:false}:{deleteFiles:false,addImportListExclusion:false}});
    let result;
    try{result=await management.execute(domain,'library','POST',{payload:replacement});}
    catch(error){await management.execute(domain,'library','POST',{payload:rollback}).catch(()=>{});throw new Error(`The engine could not apply the new match. The original match was restored when possible. ${error.message}`);}
    await management.execute(domain,'commands','POST',{payload:{name:domain==='movie'?'RefreshMovie':'RefreshSeries',...(domain==='movie'?{movieIds:[Number(result.id)]}:{seriesId:Number(result.id)})}}).catch(()=>{});
    sync.invalidate(domain);await sync.synchronize(domain);
    return{domain,id:Number(result.id),title:result.title||metadata.title,tmdbId};
  }
  async function reassignMediaFile(input){
    const domain=String(input.domain||''),selectedPath=String(input.path||'').trim().replaceAll('\\','/');
    if(!['movie','tv'].includes(domain)||!selectedPath||!/\.(?:avi|mkv|mp4|m4v|mov|wmv|mpg|mpeg|ts|m2ts|webm)$/i.test(selectedPath))throw new Error('Choose a supported video file');
    const movieId=Number(input.movieId),episodeId=Number(input.episodeId),seriesId=Number(input.seriesId);
    if(domain==='movie'&&!Number.isFinite(movieId))throw new Error('Choose the movie that owns this file');
    if(domain==='tv'&&(!Number.isFinite(episodeId)||!Number.isFinite(seriesId)))throw new Error('Choose the television episode that owns this file');
    const selectedFolder=selectedPath.slice(0,selectedPath.lastIndexOf('/'))||'/';
    if(domain==='movie'){
      const movieRecord=await management.execute('movie','library','GET',{id:movieId});
      await management.execute('movie','library','PUT',{id:movieId,query:{moveFiles:false},payload:{...movieRecord,path:selectedFolder}});
      const result=await management.execute('movie','commands','POST',{payload:{name:'RefreshMovie',movieIds:[movieId]}});
      sync.invalidate('movie');
      setTimeout(()=>sync.synchronize('movie').catch(()=>{}),5_000);
      setTimeout(()=>sync.synchronize('movie').catch(()=>{}),20_000);
      return result;
    }
    const value=await management.execute(domain,'manualImport','GET',{query:{seriesId,folder:selectedFolder,filterExistingFiles:false}});
    const candidates=Array.isArray(value)?value:value?.records||[],normalize=value=>String(value||'').replaceAll('\\','/').replace(/\/+$/,'').toLowerCase();
    const candidate=candidates.find(item=>normalize(item.path)===normalize(selectedPath));
    if(!candidate)throw new Error('The selected file could not be validated by the media service');
    const assignment={...candidate,path:selectedPath,...(domain==='movie'?{movieId,movie:{...(candidate.movie||{}),id:movieId}}:{seriesId,episodeIds:[episodeId],episodes:[...(candidate.episodes||[])],series:{...(candidate.series||{}),id:seriesId}})};
    const reprocessed=await management.execute(domain,'manualImport','POST',{payload:[assignment]});
    const processed=(Array.isArray(reprocessed)?reprocessed:[assignment])[0]||assignment;
    const file={...processed,path:selectedPath,folderName:processed.folderName||selectedPath.split('/').slice(-2,-1)[0]||'',...(domain==='movie'?{movieId}:{seriesId,episodeIds:[episodeId]})};
    const result=await management.execute(domain,'commands','POST',{payload:{name:'ManualImport',files:[file],importMode:'Auto',priority:'high'}});
    sync.invalidate(domain);setTimeout(()=>sync.synchronize(domain).catch(()=>{}),2_000);
    return result;
  }
  const normalizeMediaPath=value=>String(value||'').replaceAll('\\','/').replace(/\/+$/,'');
  const parentMediaPath=value=>{
    const path=normalizeMediaPath(value),index=path.lastIndexOf('/');
    return index>0?path.slice(0,index):'/';
  };
  const joinMediaPath=(root,folder)=>{
    const separator=String(root||'').includes('\\')?'\\':'/';
    return `${String(root||'').replace(/[\\/]+$/,'')}${separator}${String(folder||'').replace(/^[\\/]+/,'')}`;
  };
  const renameMediaSignature=record=>JSON.stringify({
    id:record.id,path:normalizeMediaPath(record.path),sizeOnDisk:Number(record.sizeOnDisk||record.statistics?.sizeOnDisk||0),
    movieFile:record.movieFile?{id:record.movieFile.id,relativePath:record.movieFile.relativePath,size:record.movieFile.size,dateAdded:record.movieFile.dateAdded}:null,
    statistics:record.statistics?{episodeFileCount:record.statistics.episodeFileCount,episodeCount:record.statistics.episodeCount,sizeOnDisk:record.statistics.sizeOnDisk}:null,
    seasons:Array.isArray(record.seasons)?record.seasons.map(season=>({seasonNumber:season.seasonNumber,statistics:season.statistics?{episodeFileCount:season.statistics.episodeFileCount,sizeOnDisk:season.statistics.sizeOnDisk}:null})):null
  });
  function saveRenamePlan(preview,record){
    const previewId=randomUUID(),now=Date.now();
    renamePlans.set(previewId,{preview,signature:renameMediaSignature(record),expiresAt:now+2*60*1000});
    if(renamePlans.size>500)for(const[id,plan]of renamePlans)if(plan.expiresAt<=now)renamePlans.delete(id);
    return{...preview,previewId,expiresAt:new Date(now+2*60*1000).toISOString()};
  }
  async function renameMediaPreview(input){
    const domain=String(input.domain||''),mediaId=Number(input.mediaId);
    if(!['movie','tv'].includes(domain)||!Number.isFinite(mediaId))throw new Error('Choose a movie or television series to organize');
    const record=await management.execute(domain,'library','GET',{id:mediaId});
    const folderResult=await management.execute(domain,'libraryFolder','GET',{id:mediaId});
    const folder=String(folderResult?.folder||'').trim();
    if(!folder)throw new Error('The media service could not calculate the configured folder name');
    const rootFolderPath=String(record.rootFolderPath||parentMediaPath(record.path));
    const destinationPath=joinMediaPath(rootFolderPath,folder);
    const renameItems=await management.execute(domain,'renamePreview','GET',{query:domain==='movie'?{movieId:mediaId}:{seriesId:mediaId}});
    const preview={
      domain,mediaId,title:record.title,currentPath:record.path,rootFolderPath,destinationPath,folderChange:normalizeMediaPath(record.path)!==normalizeMediaPath(destinationPath),
      files:(Array.isArray(renameItems)?renameItems:[]).map(item=>({
        id:item.movieFileId??item.episodeFileId??item.id,
        existingPath:item.existingPath||item.path||'',
        newPath:item.newPath||''
      }))
    };
    return input.storePlan===false?preview:saveRenamePlan(preview,record);
  }
  async function renameMedia(input){
    let preview,record;
    if(input.previewId){
      const previewId=String(input.previewId),plan=renamePlans.get(previewId);renamePlans.delete(previewId);
      if(!plan||plan.expiresAt<=Date.now())throw new Error('This rename preview expired. Generate a fresh preview before applying changes.');
      preview=plan.preview;record=await management.execute(preview.domain,'library','GET',{id:preview.mediaId});
      if((input.domain&&input.domain!==preview.domain)||(input.mediaId&&Number(input.mediaId)!==preview.mediaId))throw new Error('This rename preview does not match the selected media.');
      if(renameMediaSignature(record)!==plan.signature)throw new Error('This media changed after the rename preview was created. Generate a fresh preview before applying changes.');
    }else preview=await renameMediaPreview({...input,storePlan:false});
    const domain=preview.domain,mediaId=preview.mediaId;
    if(preview.folderChange){
      record||=await management.execute(domain,'library','GET',{id:mediaId});
      await management.execute(domain,'library','PUT',{id:mediaId,query:{moveFiles:true},payload:{...record,path:preview.destinationPath,rootFolderPath:preview.rootFolderPath}});
    }
    const command=await management.execute(domain,'commands','POST',{payload:domain==='movie'?{name:'RenameMovie',movieIds:[mediaId]}:{name:'RenameSeries',seriesIds:[mediaId]}});
    sync.invalidate(domain);
    for(const delay of [2_000,10_000,30_000])setTimeout(()=>sync.synchronize(domain).catch(()=>{}),delay);
    return{preview,command};
  }
  function queueRecordKey(domain,item){
    return `${domain}:${String(item.id||item.downloadId||item.downloadClientId||item.title||'unknown')}`;
  }
  function truthyEngineValue(value){
    return value===true||['true','1','yes','on'].includes(String(value??'').trim().toLowerCase());
  }
  function scheduleImportedUpgradeRename(domain,item,event){
    if(!truthyEngineValue(event?.data?.isUpgrade??event?.isUpgrade))return;
    const mediaId=Number(domain==='movie'?(item.movieId||item.movie?.id):(item.seriesId||item.series?.id||item.episode?.seriesId));
  if(!Number.isFinite(mediaId)||mediaId<=0)return;
    const eventIdentity=String(event?.id||event?.movieFileId||event?.episodeFileId||event?.downloadId||event?.data?.downloadId||event?.date||item.id||item.title||'unknown');
    const key=`${domain}:${mediaId}:${eventIdentity}`,now=Date.now(),last=completedUpgradeRenames.get(key)||0;
    if(now-last<24*60*60*1000)return;
    completedUpgradeRenames.set(key,now);
    void(async()=>{
      try{
        const naming=await management.execute(domain,'naming','GET',{});
        const renameEnabled=domain==='movie'?naming?.renameMovies:naming?.renameEpisodes;
        if(!truthyEngineValue(renameEnabled))return;
        const payload=domain==='movie'?{name:'RenameMovie',movieIds:[mediaId]}:{name:'RenameSeries',seriesIds:[mediaId]};
        await management.execute(domain,'commands','POST',{payload});
        sync.invalidate(domain);
        for(const delay of [2_000,10_000,30_000])setTimeout(()=>sync.synchronize(domain).catch(()=>{}),delay);
      }catch{completedUpgradeRenames.delete(key);}
    })();
    if(completedUpgradeRenames.size>2_000)for(const [recordKey,timestamp] of completedUpgradeRenames)if(now-timestamp>24*60*60*1000)completedUpgradeRenames.delete(recordKey);
  }
  function scheduleCompletedMediaRefresh(domain,item){
    const mediaId=Number(domain==='movie'?(item.movieId||item.movie?.id):(item.seriesId||item.series?.id||item.episode?.seriesId));
    if(!Number.isFinite(mediaId))return;
    const key=queueRecordKey(domain,item),last=completedQueueRefreshes.get(key)||0,now=Date.now();
    if(now-last<30*60*1000)return;
    completedQueueRefreshes.set(key,now);
    const payload=domain==='movie'?{name:'RefreshMovie',movieIds:[mediaId]}:{name:'RefreshSeries',seriesId:mediaId};
    for(const delay of [2_000,15_000]){
      setTimeout(async()=>{
        try{await management.execute(domain,'commands','POST',{payload});sync.invalidate(domain);await sync.synchronize(domain);}
        catch{}
      },delay);
    }
    if(completedQueueRefreshes.size>2_000)for(const [recordKey,timestamp] of completedQueueRefreshes)if(now-timestamp>24*60*60*1000)completedQueueRefreshes.delete(recordKey);
  }
  const importPaceMs=Math.max(0,Math.min(2000,Number(env.VYNODEARR_IMPORT_PACE_MS||25)));
  const pause=(milliseconds)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  function startImportJob(userId,input){
    const domain=input.domain,label=domain==='movie'?'Movies':'Television',items=Array.isArray(input.items)?input.items:[];
    if(!['movie','tv'].includes(domain)||!items.length||items.length>5000)throw new Error('Select between 1 and 5,000 titles to import');
    const job={id:`import_${randomUUID()}`,userId,domain,label,status:'queued',total:items.length,completed:0,skipped:0,failed:0,currentTitle:null,errors:[],createdAt:new Date().toISOString(),finishedAt:null,cancelRequested:false};
    importJobs.set(job.id,job);
    void(async()=>{
      job.status='running';const known=new Set();
      try{const existing=await management.execute(domain,'library','GET',{});for(const record of Array.isArray(existing)?existing:existing?.records||[])for(const key of importIdentityKeys(record))known.add(key);}catch{}
      for(const item of items){
        if(job.cancelRequested)break;
        job.currentTitle=String(item.title||'Untitled');const keys=importIdentityKeys(item.payload),duplicate=keys.some(key=>known.has(key));
        if(duplicate){job.skipped+=1;continue;}
        try{await management.execute(domain,'library','POST',{payload:item.payload});job.completed+=1;for(const key of keys)known.add(key);if(job.completed%50===0){sync.invalidate(domain);void sync.synchronize(domain).catch(()=>{});}}
        catch(error){const message=redact(error?.safeMessage||error?.message||'Import failed');if(duplicateImportError(message))job.skipped+=1;else{job.failed+=1;job.errors.push({title:job.currentTitle,message});}}
        if(importPaceMs)await pause(importPaceMs);
      }
      job.currentTitle=null;job.status=job.cancelRequested?'canceled':job.failed===job.total?'failed':'completed';job.finishedAt=new Date().toISOString();sync.invalidate(domain);setTimeout(()=>sync.synchronize(domain).catch(()=>{}),10_000);setTimeout(()=>importJobs.delete(job.id),6*60*60*1000);
    })();
    return publicImportJob(job);
  }
  function startMissingSearchJob(userId,input){
    const domain=input.domain,label=domain==='movie'?'Movies':'Television';
    if(!['movie','tv'].includes(domain))throw new Error('Choose Movies or Television');
    const active=[...searchJobs.values()].find(job=>job.userId===userId&&job.domain===domain&&['queued','running','canceling'].includes(job.status));
    if(active)return publicSearchJob(active);
    const job={id:`search_${randomUUID()}`,userId,domain,label,status:'queued',total:0,completed:0,failed:0,currentTitle:'Loading missing items',errors:[],createdAt:new Date().toISOString(),finishedAt:null,cancelRequested:false};
    searchJobs.set(job.id,job);
    void(async()=>{
      job.status='running';
      try{
        const value=await management.execute(domain,'wantedMissing','GET',{query:{page:1,pageSize:10000,sortKey:'title',sortDirection:'ascending',...(domain==='tv'?{monitored:true}:{})}});
        const items=Array.isArray(value)?value:value?.records||[];
        job.total=items.length;
        const batchSize=domain==='movie'?20:40;
        for(let offset=0;offset<items.length&&!job.cancelRequested;offset+=batchSize){
          const batch=items.slice(offset,offset+batchSize),ids=batch.map(item=>Number(item.id)).filter(Number.isFinite);
          job.currentTitle=`${offset+1}-${Math.min(offset+batch.length,items.length)} of ${items.length}`;
          if(!ids.length){job.failed+=batch.length;continue;}
          try{
            await management.execute(domain,'commands','POST',{payload:domain==='movie'?{name:'MoviesSearch',movieIds:ids}:{name:'EpisodeSearch',episodeIds:ids}});
            job.completed+=ids.length;
          }catch(error){
            const message=redact(error?.safeMessage||error?.message||'Search batch failed');
            job.failed+=ids.length;job.errors.push({title:job.currentTitle,message});
          }
          await pause(250);
        }
      }catch(error){job.failed=Math.max(job.failed,job.total||1);job.errors.push({title:'Missing search',message:redact(error?.safeMessage||error?.message||'Search failed')});}
      job.currentTitle=null;job.status=job.cancelRequested?'canceled':job.failed&&job.completed===0?'failed':'completed';job.finishedAt=new Date().toISOString();
      setTimeout(()=>searchJobs.delete(job.id),6*60*60*1000);
    })();
    return publicSearchJob(job);
  }
  async function rebuildFromSettings(){
    const runtime=await engineSettings.runtime();if(!runtime)return;
    movie=new MovieEngineAdapter(runtime.movie);tv=new TvEngineAdapter(runtime.tv);registry.register('movie',movie).register('tv',tv);sync.setEngines(movie,tv);mode='engine';
  }
  async function ensureBundledRootFolders(){
    if(String(env.VYNODEARR_BOOTSTRAP_ROOT_FOLDERS||'false')!=='true'||mode!=='engine')return;
    for(const [domain,path] of [['movie','/movies'],['tv','/tv']]){
      const client=registry.get(domain).client,roots=await client.get('rootfolder');
      if(Array.isArray(roots)&&roots.length===0)await client.post('rootfolder',{path});
    }
  }
  async function ensureBundledDownloadPathMappings(selectedDomain=null){
    if(String(env.VYNODEARR_BUNDLED_ENGINES||'false')!=='true'||mode!=='engine')return;
    const saved=await downloadFolderStore.read();
    const results=[];
    for(const domain of selectedDomain?[selectedDomain]:['movie','tv']){
      try{
        const remotePath=downloadClientRemotePath(domain),localPath=String(saved?.[domain]?.path||defaultDownloadFolder(domain)).replace(/\/+$/,'')||defaultDownloadFolder(domain);
        const client=registry.get(domain).client,[clients,mappings]=await Promise.all([client.get('downloadclient'),client.get('remotepathmapping')]);
        for(const provider of Array.isArray(clients)?clients:[]){
          if(provider.enable===false)continue;
          const host=String((provider.fields||[]).find(field=>String(field.name).toLowerCase()==='host')?.value||provider.host||'').trim();
          if(!host)continue;
          const existing=(Array.isArray(mappings)?mappings:[]).find(mapping=>String(mapping.host).toLowerCase()===host.toLowerCase()&&String(mapping.remotePath).replace(/\/+$/,'')===remotePath);
          if(existing&&String(existing.localPath).replace(/\/+$/,'')!==localPath)await client.put(`remotepathmapping/${existing.id}`,{...existing,host,remotePath,localPath});
          else if(!existing)await client.post('remotepathmapping',{host,remotePath,localPath});
          results.push({domain,host,remotePath,localPath,configured:true});
        }
      }catch(error){const message=redact(error?.safeMessage||error?.message||'engine unavailable');console.warn(`${domain} download path mapping deferred:`,message);results.push({domain,configured:false,error:message});}
    }
    return results;
  }
  async function restoreBundledCredentials(){
    if(String(env.VYNODEARR_BUNDLED_ENGINES||'false')!=='true')return false;
    const configured=await engineSettings.runtime(),readKey=async domain=>{
      const path=env[domain==='movie'?'MOVIE_ENGINE_CONFIG_PATH':'TV_ENGINE_CONFIG_PATH']||`/engine-config/${domain}/config.xml`,xml=await readFile(path,'utf8').catch(()=>'');
      return xml.match(/<ApiKey>([^<]+)<\/ApiKey>/i)?.[1]||baseConfig[domain].apiCredential||'';
    },[movieKey,tvKey]=await Promise.all([readKey('movie'),readKey('tv')]);
    if(!movieKey||!tvKey)return false;
    await engineSettings.save('movie',configured?.movie||baseConfig.movie,movieKey);
    await engineSettings.save('tv',configured?.tv||baseConfig.tv,tvKey);
    return true;
  }
  async function initialize(){
    if(initialized)return;
    await Promise.all([auth.initialize(),engineSettings.initialize()]);
    const storedDiscoveryCredential=await engineSettings.discoveryCredential();
    if(storedDiscoveryCredential)discovery.setToken(storedDiscoveryCredential);
    else if(discovery.configured())await engineSettings.saveDiscoveryCredential(discovery.token);
    await restoreBundledCredentials();
    if(!options.movie)await rebuildFromSettings();
    try{
      await ensureBundledRootFolders();
      await ensureBundledDownloadPathMappings();
      await sync.startup();
    }catch(error){
      console.warn('Engine startup synchronization deferred:',redact(error?.safeMessage||error?.message||'Engine unavailable'));
    }
    sync.startPolling();
    if(mode==='engine'&&!queueCompletionTimer){
      const interval=Math.max(10_000,Number(env.VYNODEARR_QUEUE_COMPLETION_POLL_MS||15_000));
      queueCompletionTimer=setInterval(()=>liveQueue().catch(()=>{}),interval);
      queueCompletionTimer.unref?.();
    }
    initialized=true;
  }
  async function testEngine(domain,input){
    const config=engineSettings.normalize(domain,input);config.apiCredential=String(input.apiCredential||'');
    const adapter=domain==='movie'?new MovieEngineAdapter(config):new TvEngineAdapter(config);
    const connection=await adapter.testConnection();let counts=null;
    if(connection.reachable&&connection.authenticated&&connection.compatible){
      const [library,queue,calendar,health]=await Promise.all([domain==='movie'?adapter.listMovies({limit:10000}):adapter.listSeries({limit:10000}),adapter.getQueue(),adapter.getCalendar(),adapter.getHealth()]);
      counts={library:library.length,queue:queue.length,calendar:calendar.length,health:health.length};
    }
    return{connection,counts,validated:Boolean(connection.reachable&&connection.authenticated&&connection.compatible)};
  }
  async function repairBundledConnections(){
    if(String(env.VYNODEARR_BUNDLED_ENGINES||'false')!=='true')throw new Error('Automatic connection repair is only available for bundled engines');
    await rebuildFromSettings();
    let checks=await Promise.all([registry.movie().testConnection(),registry.tv().testConnection()]);
    if(checks.some(check=>!check.reachable||!check.authenticated||!check.compatible)){
      if(!await restoreBundledCredentials())throw new Error('Installation-managed engine credentials are unavailable');
      await rebuildFromSettings();checks=await Promise.all([registry.movie().testConnection(),registry.tv().testConnection()]);
    }
    if(checks.some(check=>!check.reachable||!check.authenticated||!check.compatible))throw new Error('Automatic engine reconnection did not succeed');
    await sync.startup();return ['movie','tv'];
  }
  async function completeEngineRestore(domain,previousStartTime){
    let connection=null,restarted=false;
    for(let attempt=0;attempt<120;attempt+=1){
      await restoreBundledCredentials();await rebuildFromSettings();
      const client=registry.get(domain).client,status=await client.get('system/status').catch(()=>null);
      restarted=Boolean(status&&String(status.startTime||'')!==String(previousStartTime||''));
      connection=await registry.get(domain).testConnection().catch(()=>null);
      if(restarted&&connection?.reachable&&connection?.authenticated&&connection?.compatible)break;
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    if(!restarted||!connection?.reachable||!connection?.authenticated||!connection?.compatible)throw new Error(`${domain==='movie'?'Movie':'Television'} engine did not reconnect after restoring the backup`);
    await sync.startup();
  }
  async function tvMetadataArtwork(tvdbId,kind,seasonNumber,episodeNumber){
    const key=`tvmaze:${tvdbId}:${kind}:${seasonNumber||0}:${episodeNumber||0}`;
    if(tvMetadataCache.has(key))return tvMetadataCache.get(key);
    try{
      const request=async url=>{
        const response=await fetch(url,{headers:{accept:'application/json','user-agent':'VynodeArr/1.0'},signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw new Error('Metadata artwork unavailable');
        return response.json();
      };
      const show=await request(`https://api.tvmaze.com/lookup/shows?thetvdb=${Number(tvdbId)}`);
      let record;
      if(kind==='season'){
        const seasons=await request(`https://api.tvmaze.com/shows/${show.id}/seasons`);
        record=seasons.find(item=>Number(item.number)===Number(seasonNumber));
      }else{
        record=await request(`https://api.tvmaze.com/shows/${show.id}/episodebynumber?season=${Number(seasonNumber)}&number=${Number(episodeNumber)}`);
      }
      const imageUrl=record?.image?.original||record?.image?.medium;
      if(!imageUrl||new URL(imageUrl).hostname!=='static.tvmaze.com')return null;
      const imageResponse=await fetch(imageUrl,{signal:AbortSignal.timeout(10000)});
      const contentType=imageResponse.headers.get('content-type')||'';
      if(!imageResponse.ok||!contentType.startsWith('image/'))return null;
      const value={body:Buffer.from(await imageResponse.arrayBuffer()),contentType};
      tvMetadataCache.set(key,value);return value;
    }catch{return null;}
  }
  async function liveQueue(){
    const results=await Promise.all(['movie','tv'].map(async domain=>{
      const client=registry.get(domain).client;
      const queueQuery=domain==='movie'
        ?{page:1,pageSize:500,includeMovie:true}
        :{page:1,pageSize:500,includeSeries:true,includeEpisode:true};
      const [queueValue,library,historyValue]=await Promise.all([
        client.get('queue',queueQuery),
        client.get(domain==='movie'?'movie':'series').catch(()=>[]),
        client.get('history',{page:1,pageSize:500,sortKey:'date',sortDirection:'descending'}).catch(()=>({records:[]}))
      ]);
      const engineRecords=Array.isArray(queueValue?.records)?queueValue.records:[],linkedId=item=>Number(domain==='movie'?(item.movieId||item.movie?.id):(item.seriesId||item.series?.id||item.episode?.seriesId)),records=engineRecords.filter(item=>{const id=linkedId(item);return Number.isFinite(id)&&id>0;}),libraryById=new Map((Array.isArray(library)?library:[]).map(item=>[Number(item.id),item]));
      const importedHistory=(Array.isArray(historyValue?.records)?historyValue.records:[]).filter(event=>String(event.eventType).toLowerCase()==='downloadfolderimported');
      const importedByDownloadId=new Map(),importedBySourceTitle=new Map();
      for(const event of importedHistory){
        const downloadId=String(event.downloadId||event.data?.downloadId||''),sourceTitle=String(event.sourceTitle||'').toLowerCase();
        if(downloadId&&!importedByDownloadId.has(downloadId))importedByDownloadId.set(downloadId,event);
        if(sourceTitle&&!importedBySourceTitle.has(sourceTitle))importedBySourceTitle.set(sourceTitle,event);
      }
      const importedEvent=item=>{
        const downloadId=String(item.downloadId||item.downloadClientId||''),sourceTitle=String(item.title||'').toLowerCase();
        return downloadId?(importedByDownloadId.get(downloadId)||null):(sourceTitle?(importedBySourceTitle.get(sourceTitle)||null):null);
      };
      for(const item of records){
        const mediaId=Number(domain==='movie'?(item.movieId||item.movie?.id):(item.seriesId||item.series?.id||item.episode?.seriesId));
        const status=String(item.status||item.trackedDownloadStatus||item.trackedDownloadState||'').toLowerCase(),sizeLeft=Number(item.sizeleft??item.sizeLeft??0),terminal=(status==='completed'||status==='complete')&&sizeLeft<=0;
        if(!terminal)continue;
        const confirmedImport=importedEvent(item);
        if(confirmedImport){
          scheduleImportedUpgradeRename(domain,item,confirmedImport);
          const key=queueRecordKey(domain,item),last=completedQueueCleanups.get(key)||0,now=Date.now();
          if(item.id!=null&&now-last>30*60*1000){
            completedQueueCleanups.set(key,now);
            void client.delete(`queue/${encodeURIComponent(String(item.id))}`,{removeFromClient:true,blocklist:false}).then(()=>sync.invalidate(domain)).catch(()=>{});
          }
        }else scheduleCompletedMediaRefresh(domain,item);
      }
      return records.filter(item=>{
        return !importedEvent(item);
      }).map(item=>{
        const engineMediaId=linkedId(item),mediaId=engineMediaId,media=item[domain==='movie'?'movie':'series']||libraryById.get(mediaId)||null,size=Number(item.size||0),sizeLeft=Number(item.sizeleft??item.sizeLeft??0),percentage=size>0?(size-sizeLeft)/size*100:null;
        return{...item,domain,media,mediaId,clientStatus:item.status||item.trackedDownloadState||null,clientFilename:item.title||null,clientPercentage:Number.isFinite(percentage)?percentage:null,clientTimeLeft:item.timeleft||item.estimatedCompletionTime||null,clientSizeLeftMb:Number.isFinite(sizeLeft)?sizeLeft/1048576:null,clientSpeed:null};
      });
    }));
    return results.flat();
  }
  function resolveCollectionMembers(collection,movies){
    if(collection.type!=='smart')return(collection.movieIds||[]).map(id=>movies.find(movie=>movie.id===id)).filter(Boolean);
    const rules=collection.rules||{titleContains:collection.titleContains||''},title=String(rules.titleContains||'').trim().toLowerCase(),genres=(rules.genres||[]).map(value=>String(value).toLowerCase()),year=Number(rules.year||0),decade=Number(rules.decade||0),libraryCollection=String(rules.collection||''),monitoring=String(rules.monitoring||''),availability=String(rules.availability||'');
    const matches=movies.filter(movie=>(!title||movie.title.toLowerCase().includes(title))&&(!genres.length||genres.every(genre=>(movie.genres||[]).some(value=>String(value).toLowerCase()===genre)))&&(!year||movie.year===year)&&(!decade||movie.year>=decade&&movie.year<decade+10)&&(!libraryCollection||movie.collection===libraryCollection)&&(!monitoring||(monitoring==='monitored'?movie.monitoring!=='none':movie.monitoring==='none'))&&(!availability||(availability==='available'?movie.hasFile:!movie.hasFile)));
    const excluded=new Set((collection.excludedMovieIds||[]).map(String)),included=new Set((collection.includedMovieIds||[]).map(String)),ids=new Set(matches.filter(movie=>!excluded.has(movie.id)).map(movie=>movie.id));
    for(const id of included)ids.add(id);
    return[...ids].map(id=>movies.find(movie=>movie.id===id)).filter(Boolean);
  }
  function proxyCompatibilityApi(req,res,url,domain,prefix){
    const adapter=registry.get(domain),config=adapter.config||adapter.client?.config;
    if(!config?.enabled)return json(res,503,{error:{message:`${domain==='movie'?'Movie':'Television'} service unavailable`}});
    const relative=url.pathname.slice(prefix.length)||'/';
    if(!/^\/(?:api\/|ping\/?$)/i.test(relative))return json(res,404,{error:{message:'Compatibility API endpoint not found'}});
    const upstreamBase=config.urlBase?`/${String(config.urlBase).replace(/^\/+|\/+$/g,'')}`:'';
    const transport=config.https?httpsRequest:httpRequest,headers={};
    for(const[name,value]of Object.entries(req.headers))if(!hopHeaders.has(name)&&name!=='host'&&value!==undefined)headers[name]=value;
    headers.host=`${config.host}:${config.port}`;
    if(/^\/api\//i.test(relative))headers.accept='application/json';
    const upstream=transport({protocol:config.https?'https:':'http:',hostname:config.host,port:config.port,method:req.method,path:`${upstreamBase}${relative}${url.search}`,headers,rejectUnauthorized:config.tlsVerify},response=>{
      const responseHeaders={};
      for(const[name,value]of Object.entries(response.headers))if(!hopHeaders.has(name)&&value!==undefined)responseHeaders[name]=value;
      res.writeHead(response.statusCode||502,responseHeaders);response.pipe(res);
    });
    upstream.setTimeout(config.timeoutMs||10000,()=>upstream.destroy(new Error('Compatibility API timed out')));
    upstream.on('error',()=>{if(!res.headersSent)json(res,502,{error:{message:`${domain==='movie'?'Movie':'Television'} service unavailable`}});else res.destroy();});
    req.pipe(upstream);
  }

  async function handleRequest(req,res){
    const url=new URL(req.url,'http://vynodearr.local');if(!initialized)await initialize();
    try{
      if(req.method==='GET'&&url.pathname==='/healthz')return json(res,200,{status:'ready',service:'VynodeArr'});
      if(url.pathname==='/movies'||url.pathname.startsWith('/movies/'))return proxyCompatibilityApi(req,res,url,'movie','/movies');
      if(url.pathname==='/tv'||url.pathname.startsWith('/tv/'))return proxyCompatibilityApi(req,res,url,'tv','/tv');
      if(url.pathname==='/api/auth/status'&&req.method==='GET'){const session=sessionFor(req,auth);return json(res,200,{setupRequired:await auth.setupRequired(),authenticated:Boolean(session),user:session?.user||null,csrf:session?.csrf||null,enginesConfigured:enginesConfigured()});}
      if(url.pathname==='/api/auth/setup'&&req.method==='POST'){
        const input=await body(req),user=await auth.createInitialAdministrator(input),result=await auth.createSession(user,{ip:req.socket.remoteAddress,userAgent:req.headers['user-agent'],remember:true});
        return json(res,201,{created:true,authenticated:true,user:result.user,csrf:result.csrf,enginesConfigured:enginesConfigured()},{'set-cookie':auth.cookie(result.id,false,true)});
      }
      if(url.pathname==='/api/auth/login'&&req.method==='POST'){
        const input=await body(req),result=await auth.login(input.identifier||input.username,input.password,{ip:req.socket.remoteAddress,userAgent:req.headers['user-agent'],remember:Boolean(input.remember)});
        if(!result)return json(res,401,{error:{code:'login_failed',message:'The username, email, or password was not accepted.'}});
        return json(res,200,{authenticated:true,user:result.user,csrf:result.csrf,enginesConfigured:enginesConfigured()},{'set-cookie':auth.cookie(result.id,false,Boolean(input.remember))});
      }
      if(url.pathname.startsWith('/api/')){
        const session=requireSession(req,res,auth);if(!session)return;const sessionId=cookies(req.headers.cookie).vynodearr_session;
        if(url.pathname==='/api/import-jobs'&&req.method==='GET')return json(res,200,{items:[...importJobs.values()].filter(job=>job.userId===session.user.id).map(publicImportJob)});
        if(url.pathname==='/api/import-jobs'&&req.method==='POST'){if(!requireCsrf(req,res,session))return;return json(res,202,{job:startImportJob(session.user.id,await body(req,25_000_000))});}
        const importJobMatch=url.pathname.match(/^\/api\/import-jobs\/(import_[A-Za-z0-9-]+)$/);
        if(importJobMatch&&req.method==='DELETE'){if(!requireCsrf(req,res,session))return;const job=importJobs.get(importJobMatch[1]);if(!job||job.userId!==session.user.id)return json(res,404,{error:{code:'not_found',message:'Import job was not found'}});if(['queued','running'].includes(job.status)){job.cancelRequested=true;job.status='canceling';job.currentTitle='Stopping after the current item';}return json(res,200,{job:publicImportJob(job)});}
        if(url.pathname==='/api/search-jobs'&&req.method==='GET')return json(res,200,{items:[...searchJobs.values()].filter(job=>job.userId===session.user.id).map(publicSearchJob)});
        if(url.pathname==='/api/search-jobs'&&req.method==='POST'){if(!administrator(res,session)||!requireCsrf(req,res,session))return;return json(res,202,{job:startMissingSearchJob(session.user.id,await body(req))});}
        const searchJobMatch=url.pathname.match(/^\/api\/search-jobs\/(search_[A-Za-z0-9-]+)$/);
        if(searchJobMatch&&req.method==='DELETE'){if(!administrator(res,session)||!requireCsrf(req,res,session))return;const job=searchJobs.get(searchJobMatch[1]);if(!job||job.userId!==session.user.id)return json(res,404,{error:{code:'not_found',message:'Search job was not found'}});if(['queued','running'].includes(job.status)){job.cancelRequested=true;job.status='canceling';job.currentTitle='Stopping after the current batch';}return json(res,200,{job:publicSearchJob(job)});}
        if(url.pathname==='/api/auth/logout'&&req.method==='POST'){if(!requireCsrf(req,res,session))return;await auth.logout(sessionId);return json(res,200,{authenticated:false},{'set-cookie':auth.cookie('',true)});}
        if(url.pathname==='/api/account'&&req.method==='GET')return json(res,200,{user:session.user});
        if(url.pathname==='/api/account'&&req.method==='PATCH'){if(!requireCsrf(req,res,session))return;return json(res,200,{user:await auth.updateAccount(session.user.id,await body(req),sessionId)});}
        if(url.pathname==='/api/account/sessions'&&req.method==='GET')return json(res,200,{items:await auth.listSessions(session.user.id,sessionId)});
        if(url.pathname==='/api/discover/status'&&req.method==='GET')return json(res,200,{configured:discovery.configured(),provider:'TMDB'});
        if(url.pathname==='/api/settings/discover'&&req.method==='GET'){if(!administrator(res,session))return;return json(res,200,{configured:discovery.configured(),provider:'TMDB'});}
        if(url.pathname==='/api/settings/discover/test'&&req.method==='POST'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          const input=await body(req),candidate=new TmdbDiscoveryService({token:input.token});
          const result=await candidate.feed('trending',1);return json(res,200,{valid:true,provider:'TMDB',sampleResults:result.results.length});
        }
        if(url.pathname==='/api/settings/discover'&&req.method==='POST'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          const input=await body(req),candidate=new TmdbDiscoveryService({token:input.token});
          await candidate.feed('trending',1);await engineSettings.saveDiscoveryCredential(input.token);discovery.setToken(input.token);
          return json(res,200,{configured:true,provider:'TMDB'});
        }
        if(url.pathname==='/api/settings/discover'&&req.method==='DELETE'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          await engineSettings.removeDiscoveryCredential();discovery.setToken('');
          return json(res,200,{configured:false,provider:'TMDB'});
        }
        if(url.pathname==='/api/settings/download-folders'&&req.method==='GET'){
          if(!administrator(res,session))return;
          const saved=await downloadFolderStore.read();
          return json(res,200,{
            movie:{path:saved.movie?.path||defaultDownloadFolder('movie'),remotePath:downloadClientRemotePath('movie')},
            tv:{path:saved.tv?.path||defaultDownloadFolder('tv'),remotePath:downloadClientRemotePath('tv')}
          });
        }
        if(url.pathname==='/api/settings/download-folders'&&req.method==='PUT'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          const input=await body(req),domain=String(input.domain||''),path=String(input.path||'').trim().replaceAll('\\','/').replace(/\/+$/,'')||'/';
          if(!['movie','tv'].includes(domain)||!path.startsWith('/'))throw new Error('Choose an absolute download folder');
          const client=registry.get(domain).client;
          const listing=await client.get('filesystem',{path,includeFiles:false,allowFoldersWithoutTrailingSlashes:true});
          if(listing?.exists===false)throw new Error('The selected download folder is not accessible to this engine');
          const current=await downloadFolderStore.read(),next={...current,[domain]:{path},updatedAt:new Date().toISOString()};
          await downloadFolderStore.write(next);
          const mappings=await ensureBundledDownloadPathMappings(domain);
          const failed=mappings?.find(item=>item.configured===false);
          if(failed)throw new Error(`Download folder saved, but the engine mapping could not be applied: ${failed.error}`);
          return json(res,200,{saved:true,domain,path,mappings:mappings||[]});
        }
        if(url.pathname==='/api/discover/feed'&&req.method==='GET')return json(res,200,await discovery.feed(url.searchParams.get('kind'),url.searchParams.get('page')));
        if(url.pathname==='/api/discover/genres'&&req.method==='GET')return json(res,200,{items:await discovery.genres(url.searchParams.get('domain'))});
        if(url.pathname==='/api/discover/categories'&&req.method==='GET')return json(res,200,{items:await discovery.categories(url.searchParams.get('type'))});
        if(url.pathname==='/api/discover/browse'&&req.method==='GET')return json(res,200,await discovery.browse(Object.fromEntries(url.searchParams)));
        if(url.pathname==='/api/discover/enrich'&&req.method==='GET'){
          if(!discovery.configured())return json(res,200,{configured:false,item:null});
          return json(res,200,{configured:true,item:await discovery.enrich(url.searchParams.get('domain'),{title:url.searchParams.get('title'),year:url.searchParams.get('year')})});
        }
        const discoverDetails=url.pathname.match(/^\/api\/discover\/details\/(movie|tv)\/(\d+)$/);
        if(discoverDetails&&req.method==='GET')return json(res,200,{item:await discovery.details(discoverDetails[1],discoverDetails[2])});
        if(url.pathname==='/api/account/sessions/others'&&req.method==='DELETE'){if(!requireCsrf(req,res,session))return;await auth.revokeOtherSessions(session.user.id,sessionId);return json(res,200,{revoked:true});}
        const sessionMatch=url.pathname.match(/^\/api\/account\/sessions\/([A-Za-z0-9_-]+)$/);
        if(sessionMatch&&req.method==='DELETE'){if(!requireCsrf(req,res,session))return;const current=await auth.revokeSession(session.user.id,sessionMatch[1],sessionId);return json(res,200,{revoked:true,current},current?{'set-cookie':auth.cookie('',true)}:{});}
        if(url.pathname==='/api/admin/users'&&req.method==='GET'){if(!administrator(res,session))return;return json(res,200,{items:await auth.listUsers()});}
        if(url.pathname==='/api/admin/users'&&req.method==='POST'){if(!administrator(res,session)||!requireCsrf(req,res,session))return;return json(res,201,{user:await auth.createUser(await body(req))});}
        const userMatch=url.pathname.match(/^\/api\/admin\/users\/(user_[A-Za-z0-9_-]+)$/);
        if(userMatch&&req.method==='PATCH'){if(!administrator(res,session)||!requireCsrf(req,res,session))return;return json(res,200,{user:await auth.administerUser(userMatch[1],await body(req),session.user.id)});}
        if(url.pathname==='/api/settings/engines'&&req.method==='GET')return json(res,200,engineSettings.public());
        if(url.pathname==='/api/settings/engines/repair'&&req.method==='POST'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          return json(res,200,{repaired:await repairBundledConnections(),at:new Date().toISOString()});
        }
        const engineKey=url.pathname.match(/^\/api\/settings\/engines\/(movie|tv)\/api-key$/);
        if(engineKey&&req.method==='GET'){
          if(!administrator(res,session))return;
          const host=await registry.get(engineKey[1]).client.get('config/host');
          return json(res,200,{domain:engineKey[1],apiKey:String(host.apiKey||'')});
        }
        if(engineKey&&req.method==='POST'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          if(String(env.VYNODEARR_BUNDLED_ENGINES||'false')!=='true')throw new Error('API key generation is available only for installation-managed engines');
          const domain=engineKey[1],client=registry.get(domain).client,host=await client.get('config/host'),previousKey=String(host.apiKey||''),configPath=env[domain==='movie'?'MOVIE_ENGINE_CONFIG_PATH':'TV_ENGINE_CONFIG_PATH']||`/engine-config/${domain}/config.xml`;
          await client.post('command',{name:'ResetApiKey'});
          let apiKey='';
          for(let attempt=0;attempt<40;attempt+=1){
            const xml=await readFile(configPath,'utf8').catch(()=>''),match=xml.match(/<ApiKey>([^<]+)<\/ApiKey>/i);
            if(match?.[1]&&match[1]!==previousKey){apiKey=match[1];break;}
            await new Promise(resolve=>setTimeout(resolve,250));
          }
          if(!apiKey)throw new Error('The engine did not provide its newly generated API key');
          const runtime=await engineSettings.runtime();await engineSettings.save(domain,runtime[domain],apiKey);await rebuildFromSettings();
          let connection=null;
          for(let attempt=0;attempt<40;attempt+=1){
            connection=await registry.get(domain).testConnection().catch(()=>null);
            if(connection?.reachable&&connection?.authenticated&&connection?.compatible)break;
            await new Promise(resolve=>setTimeout(resolve,500));
          }
          if(!connection?.reachable||!connection?.authenticated||!connection?.compatible)throw new Error(`${domain==='movie'?'Movie':'TV'} engine did not reconnect with the new API key`);
          return json(res,200,{domain,apiKey,regenerated:true});
        }
        const engineTest=url.pathname.match(/^\/api\/settings\/engines\/(movie|tv)\/test$/);
        if(engineTest&&req.method==='POST'){if(!administrator(res,session)||!requireCsrf(req,res,session))return;return json(res,200,await testEngine(engineTest[1],await body(req)));}
        const engineSave=url.pathname.match(/^\/api\/settings\/engines\/(movie|tv)$/);
        if(engineSave&&req.method==='PUT'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;const input=await body(req),result=await testEngine(engineSave[1],input);if(!result.validated)return json(res,422,{error:{code:'engine_validation_failed',message:result.connection.safeError||'Engine validation did not succeed.'}});
          await engineSettings.save(engineSave[1],input,input.apiCredential);await rebuildFromSettings();await sync.startup();return json(res,200,{saved:true,settings:engineSettings.public(),validation:result});
        }
        if(url.pathname==='/api/system/application-update'&&req.method==='GET')return json(res,200,{application:'VynodeArr',installedVersion:String(env.VYNODEARR_VERSION||applicationVersion),channel:String(env.VYNODEARR_UPDATE_CHANNEL||'develop'),mechanism:'Container image',repository:'https://github.com/minerport/VynodeArr-Unified',message:'Pull the newest VynodeArr container image, then recreate the application container. Engine updates are managed separately.'});
        const backupRestore=url.pathname.match(/^\/api\/system\/backups\/(movie|tv)\/(\d+)\/restore$/);
        if(backupRestore&&req.method==='POST'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          const domain=backupRestore[1],id=backupRestore[2],client=registry.get(domain).client,before=await client.get('system/status');
          await client.post(`system/backup/restore/${id}`,{});
          await client.post('command',{name:'Restart'});
          await completeEngineRestore(domain,before.startTime);return json(res,200,{restored:true,domain,backupId:id});
        }
        const backupDownload=url.pathname.match(/^\/api\/system\/backups\/(movie|tv)\/(\d+)\/download$/);
        if(backupDownload&&req.method==='GET'){
          if(!administrator(res,session))return;
          const domain=backupDownload[1],client=registry.get(domain).client,backups=await client.get('system/backup'),backup=backups.find(item=>String(item.id)===backupDownload[2]);
          if(!backup)return json(res,404,{error:{code:'backup_not_found',message:'Backup not found'}});
          const config=client.config,prefix=config.urlBase?`/${String(config.urlBase).replace(/^\/+|\/+$/g,'')}`:'',downloadUrl=new URL(`${config.https?'https':'http'}://${config.host}:${config.port}${prefix}${backup.path}`);
          const response=await fetch(downloadUrl,{headers:{'x-api-key':config.apiCredential},signal:AbortSignal.timeout(30000)});
          if(!response.ok)throw new Error('The backup could not be downloaded');
          const extension=(String(backup.name||backup.path||'').match(/\.(zip|db|xml)$/i)||[])[0]||'.zip',stamp=new Date(backup.time||Date.now()).toISOString().replace(/\.\d{3}Z$/,'Z').replace(/:/g,'-'),filename=`VynodeArr_${domain==='movie'?'Movies':'Television'}_Backup_${stamp}${extension.toLowerCase()}`;
          res.writeHead(200,{'content-type':'application/zip','content-disposition':`attachment; filename="${filename}"`,'cache-control':'no-store','x-content-type-options':'nosniff'});return res.end(Buffer.from(await response.arrayBuffer()));
        }
        const backupUpload=url.pathname.match(/^\/api\/system\/backups\/(movie|tv)\/upload$/);
        if(backupUpload&&req.method==='POST'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          const domain=backupUpload[1],client=registry.get(domain).client,before=await client.get('system/status'),incoming=new Request('http://vynodearr.local/upload',{method:'POST',headers:req.headers,body:req,duplex:'half'}),form=await incoming.formData(),file=form.get('file');
          if(!(file instanceof File)||file.size===0||file.size>500000000)throw new Error('Choose a backup file smaller than 500 MB');
          if(!/\.(zip|db|xml)$/i.test(file.name))throw new Error('Backup must be a .zip, .db, or .xml file');
          const config=client.config,prefix=config.urlBase?`/${String(config.urlBase).replace(/^\/+|\/+$/g,'')}`:'',uploadUrl=new URL(`${config.https?'https':'http'}://${config.host}:${config.port}${prefix}/api/v3/system/backup/restore/upload`),upload=new FormData();
          upload.append('file',file,file.name);
          const response=await fetch(uploadUrl,{method:'POST',headers:{'x-api-key':config.apiCredential},body:upload,signal:AbortSignal.timeout(120000)});
          if(!response.ok)throw new Error('The engine rejected the uploaded backup');
          await client.post('command',{name:'Restart'});await completeEngineRestore(domain,before.startTime);return json(res,200,{restored:true,domain,uploaded:true});
        }
        if(url.pathname==='/api/system/sync'&&req.method==='POST'){if(!requireCsrf(req,res,session))return;const results=await sync.startup();return json(res,200,{synchronized:true,results:results.map((item)=>item.status),state:sync.snapshot()});}
        if(url.pathname==='/api/collections'&&req.method==='GET'){
          const stored=await collectionStore.read(),movies=await sync.list('movie'),collections=(stored.collections||[]).map(collection=>{
            const members=resolveCollectionMembers(collection,movies);
            return{...collection,movieIds:members.map(movie=>movie.id),members,count:members.length};
          });
          return json(res,200,{items:collections});
        }
        if(url.pathname==='/api/collections'&&req.method==='POST'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          const input=await body(req),name=String(input.name||'').trim(),type=input.type==='smart'?'smart':'custom',rules=input.rules&&typeof input.rules==='object'?input.rules:{titleContains:String(input.titleContains||'').trim()};
          if(!name)throw new Error('Collection name is required');
          if(type==='smart'&&!Object.values(rules).some(value=>Array.isArray(value)?value.length:Boolean(value)))throw new Error('Smart collections require at least one rule');
          if(type==='smart'&&String(rules.titleContains||'').trim()){
            const title=String(rules.titleContains).trim().toLowerCase(),movies=await sync.list('movie');
            if(movies.filter(movie=>String(movie.title||'').toLowerCase().includes(title)).length<2)throw new Error('A title-based smart collection requires at least two matching movies');
          }
          const stored=await collectionStore.read(),collections=stored.collections||[];
          if(collections.some(collection=>collection.name.toLowerCase()===name.toLowerCase()))throw new Error('A collection with this name already exists');
          const collection={id:`collection_${randomUUID()}`,name,type,rules:type==='smart'?rules:{},movieIds:type==='custom'?[...new Set((input.movieIds||[]).map(String))]:[],includedMovieIds:type==='smart'?[...new Set((input.includedMovieIds||[]).map(String))]:[],excludedMovieIds:type==='smart'?[...new Set((input.excludedMovieIds||[]).map(String))]:[],createdAt:new Date().toISOString()};
          collections.push(collection);await collectionStore.write({version:1,collections});return json(res,201,{item:collection});
        }
        const collectionMatch=url.pathname.match(/^\/api\/collections\/(collection_[A-Za-z0-9-]+)$/);
        if(collectionMatch&&req.method==='PUT'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          const input=await body(req),stored=await collectionStore.read(),collections=stored.collections||[],index=collections.findIndex(collection=>collection.id===collectionMatch[1]);
          if(index<0)return json(res,404,{error:{message:'Collection not found'}});
          const name=String(input.name||'').trim(),type=input.type==='smart'?'smart':'custom',rules=input.rules&&typeof input.rules==='object'?input.rules:{};
          if(!name)throw new Error('Collection name is required');
          if(type==='smart'&&!Object.values(rules).some(value=>Array.isArray(value)?value.length:Boolean(value)))throw new Error('Smart collections require at least one rule');
          if(type==='smart'&&String(rules.titleContains||'').trim()){
            const title=String(rules.titleContains).trim().toLowerCase(),movies=await sync.list('movie');
            if(movies.filter(movie=>String(movie.title||'').toLowerCase().includes(title)).length<2)throw new Error('A title-based smart collection requires at least two matching movies');
          }
          if(collections.some((collection,collectionIndex)=>collectionIndex!==index&&collection.name.toLowerCase()===name.toLowerCase()))throw new Error('A collection with this name already exists');
          collections[index]={...collections[index],name,type,rules:type==='smart'?rules:{},movieIds:type==='custom'?[...new Set((input.movieIds||[]).map(String))]:[],includedMovieIds:type==='smart'?[...new Set((input.includedMovieIds||[]).map(String))]:[],excludedMovieIds:type==='smart'?[...new Set((input.excludedMovieIds||[]).map(String))]:[],updatedAt:new Date().toISOString()};
          await collectionStore.write({version:1,collections});return json(res,200,{item:collections[index]});
        }
        if(collectionMatch&&req.method==='DELETE'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          const stored=await collectionStore.read(),collections=(stored.collections||[]).filter(collection=>collection.id!==collectionMatch[1]);
          await collectionStore.write({version:1,collections});return json(res,200,{deleted:true});
        }
        if(url.pathname==='/api/media-files/reassign'&&req.method==='POST'){if(!administrator(res,session)||!requireCsrf(req,res,session))return;return json(res,200,{reassigned:true,result:await reassignMediaFile(await body(req))});}
        if(url.pathname==='/api/media-match'&&req.method==='POST'){if(!administrator(res,session)||!requireCsrf(req,res,session))return;return json(res,200,{matched:true,result:await rematchMedia(await body(req))});}
        if(url.pathname==='/api/media-files/rename'&&req.method==='GET'){if(!administrator(res,session))return;return json(res,200,{preview:await renameMediaPreview(Object.fromEntries(url.searchParams))});}
        if(url.pathname==='/api/media-files/rename'&&req.method==='POST'){if(!administrator(res,session)||!requireCsrf(req,res,session))return;return json(res,202,{queued:true,result:await renameMedia(await body(req))});}
        const catalogMatch=url.pathname.match(/^\/api\/manage\/(movie|tv)$/);
        if(catalogMatch&&req.method==='GET'){if(!administrator(res,session))return;return json(res,200,{domain:catalogMatch[1],available:management.available(catalogMatch[1]),resources:management.catalog(catalogMatch[1])});}
        const automaticSearchMatch=url.pathname.match(/^\/api\/manage\/(movie|tv)\/automaticSearch$/);
        if(automaticSearchMatch&&req.method==='POST'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          const domain=automaticSearchMatch[1],input=await body(req),query=domain==='movie'?{movieId:Number(input.movieId)}:{episodeId:Number(input.episodeId)};
          if(!Number.isFinite(query.movieId??query.episodeId))throw new Error(`Choose a ${domain==='movie'?'movie':'television episode'} to search`);
          const releases=await management.execute(domain,'releases','GET',{query}),candidates=Array.isArray(releases)?releases:[],accepted=candidates.filter(eligibleRelease);
          if(!candidates.length)throw new Error('No releases were returned by the configured indexers.');
          if(!accepted.length)throw new Error('Only rejected releases were returned. Use Interactive Search to review and grab one anyway if you choose.');
          accepted.sort(compareReleases);
          const selected=accepted[0],result=await management.execute(domain,'releases','POST',{payload:await reacquireRelease(domain,selected)});
          clearReleaseCache(domain);
          return json(res,201,{result,selection:{title:selected.title,quality:selected.quality?.quality?.name||selected.quality?.name||'Unknown',size:Number(selected.size||0),acceptedCandidates:accepted.length}});
        }
        if(url.pathname==='/api/manage/queue/bulk-delete'&&req.method==='POST'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          const input=await body(req),items=Array.isArray(input.items)?input.items.slice(0,250):[];
          if(!items.length)throw new Error('Choose at least one queue item to remove');
          const results=await Promise.allSettled(items.map(item=>{
            const domain=item?.domain;
            if(!['movie','tv'].includes(domain)||!item?.id)return Promise.reject(new Error('A queue item is missing its engine or identifier'));
            return management.execute(domain,'queue','DELETE',{id:String(item.id),query:{removeFromClient:String(input.removeFromClient!==false),blocklist:String(input.blocklist===true)},payload:{}});
          }));
          const removed=[],failed=[];
          results.forEach((result,index)=>{
            const item=items[index];
            if(result.status==='fulfilled')removed.push({domain:item.domain,id:item.id});
            else failed.push({domain:item.domain,id:item.id,message:result.reason instanceof Error?result.reason.message:String(result.reason)});
          });
          return json(res,failed.length?207:200,{removed,failed,items:mode==='engine'?await liveQueue():await sync.operations('queue')});
        }
        const managementMatch=url.pathname.match(/^\/api\/manage\/(movie|tv)\/([A-Za-z][A-Za-z0-9]*)(?:\/([A-Za-z0-9_-]+))?$/);
        if(managementMatch){
          if(!administrator(res,session))return;
          const method=req.method||'GET';
          if(method!=='GET'&&!requireCsrf(req,res,session))return;
          const input=method==='GET'?{}:await body(req);
          const query=Object.fromEntries(url.searchParams);
          let result;
          if(managementMatch[2]==='releases'&&method==='GET'){
            const domain=managementMatch[1],load=()=>domain==='tv'&&query.seriesId?televisionSeriesReleases(query.seriesId,query.seasonNumber):management.execute(domain,'releases','GET',{query:Object.fromEntries(Object.entries(query).filter(([key])=>key!=='force'))});
            result=await cachedInteractiveReleases(domain,query,load);
            if(domain==='tv'&&!query.seriesId)result=await explainEmptyTelevisionSearch(query,result);
          }
          else{
            const payload=managementMatch[2]==='releases'&&method==='POST'?await reacquireRelease(managementMatch[1],input):input;
            result=await management.execute(managementMatch[1],managementMatch[2],method,{id:managementMatch[3],query,payload});
          }
          if(method!=='GET'){
            if(['releases','indexers','profiles','customFormats','delayProfiles','restrictions','releaseProfiles'].includes(managementMatch[2]))clearReleaseCache(managementMatch[1]);
            const audit=await auditStore.read(),entries=Array.isArray(audit.entries)?audit.entries:[];
            entries.unshift({id:`change_${randomUUID()}`,timestamp:new Date().toISOString(),userId:session.user.id,username:session.user.username,domain:managementMatch[1],resource:managementMatch[2],method,resourceId:managementMatch[3]||null});
            await auditStore.write({version:1,entries:entries.slice(0,1000)});
            if(['library','libraryEditor'].includes(managementMatch[2])){
              sync.invalidate(managementMatch[1]);
              await sync.synchronize(managementMatch[1]);
            }
            else if(['episodes','episodeFiles'].includes(managementMatch[2]))await sync.synchronize('tv');
            else if(managementMatch[2]==='queue')await sync.synchronizeOperations();
            else if(managementMatch[2]==='downloadClients')setTimeout(()=>ensureBundledDownloadPathMappings().catch(()=>{}),500);
            else if(managementMatch[2]==='commands'&&/^Refresh(?:Movie|Series)$/.test(String(input.name||''))){sync.invalidate(managementMatch[1]);setTimeout(()=>sync.synchronize(managementMatch[1]).catch(()=>{}),5_000);}
          }
          return json(res,method==='POST'?201:200,{result});
        }
        if(url.pathname==='/api/manage/audit'&&req.method==='GET'){if(!administrator(res,session))return;const audit=await auditStore.read();return json(res,200,{items:audit.entries||[]});}
        if(req.method!=='GET')return json(res,405,{error:{code:'read_only',message:'Read-only review mode'}});
        const metadataArtworkMatch=url.pathname.match(/^\/api\/artwork\/tv-metadata\/(\d+)\/(season|episode)$/);
        if(metadataArtworkMatch){
          const value=await tvMetadataArtwork(metadataArtworkMatch[1],metadataArtworkMatch[2],url.searchParams.get('season'),url.searchParams.get('episode'));
          if(!value){res.writeHead(204,{'cache-control':'private, max-age=300'});return res.end();}
          res.writeHead(200,{'content-type':value.contentType,'cache-control':'private, max-age=86400','x-content-type-options':'nosniff'});return res.end(value.body);
        }
        const artworkMatch=url.pathname.match(/^\/api\/artwork\/(movie|tv)\/((?:movie|series)_[A-Za-z0-9_-]+)\/(poster|fanart|logo|banner|episode|season)$/);
        if(artworkMatch){
          const key=artworkMatch.slice(1).join(':');let value=artworkCache.get(key);
          if(!value){
            let run=artworkRuns.get(key);
            if(!run){
              run=registry.get(artworkMatch[1]).getArtwork(artworkMatch[2],artworkMatch[3]).then(result=>{if(result)artworkCache.set(key,{...result,cachedAt:Date.now()});return result;}).finally(()=>artworkRuns.delete(key));
              artworkRuns.set(key,run);
            }
            value=await run;
            if(!value){res.writeHead(204,{'cache-control':'private, max-age=300'});return res.end();}
          }
          res.writeHead(200,{'content-type':value.contentType,'cache-control':'private, max-age=86400, stale-while-revalidate=604800','x-content-type-options':'nosniff'});return res.end(value.body);
        }
        if(url.pathname==='/api/media/movies')return json(res,200,{items:await sync.list('movie',{refresh:url.searchParams.get('refresh')==='true'}),mode,sync:sync.snapshot().movie});
        const movieMatch=url.pathname.match(/^\/api\/media\/movies\/(movie_[A-Za-z0-9_-]+)$/);if(movieMatch){const item=await registry.movie().getMovie(movieMatch[1]);return item?json(res,200,{item,mode}):json(res,404,{error:{code:'not_found',message:'Movie was not found.'}});}
        if(url.pathname==='/api/media/tv')return json(res,200,{items:await sync.list('tv',{refresh:url.searchParams.get('refresh')==='true'}),mode,sync:sync.snapshot().tv});
        const tvMatch=url.pathname.match(/^\/api\/media\/tv\/(series_[A-Za-z0-9_-]+)$/);if(tvMatch){const item=await registry.tv().getSeries(tvMatch[1]);return item?json(res,200,{item,mode}):json(res,404,{error:{code:'not_found',message:'TV series was not found.'}});}
        if(url.pathname==='/api/activity/queue/live'||url.pathname==='/api/activity/queue')return json(res,200,{items:mode==='engine'?await liveQueue():await sync.operations('queue')});
        if(url.pathname==='/api/activity/history')return json(res,200,{items:await sync.operations('history')});
        if(url.pathname==='/api/calendar')return json(res,200,{items:await sync.operations('calendar')});
        if(url.pathname==='/api/system/health')return json(res,200,{items:await sync.operations('health'),sync:sync.snapshot()});
        if(url.pathname==='/api/dashboard'){
          if(dashboardSnapshot&&dashboardSnapshotExpires>Date.now())return json(res,200,dashboardSnapshot,{'x-vynodearr-cache':'hit'});
          if(!dashboardSnapshotRun)dashboardSnapshotRun=(async()=>{const[movies,tvItems,queue,history,calendar,health,tvProfiles]=await Promise.all([sync.list('movie'),sync.list('tv'),mode==='engine'?liveQueue():sync.operations('queue'),sync.operations('history'),sync.operations('calendar'),sync.operations('health'),management.execute('tv','profiles','GET').catch(()=>[])]),profileNames={tv:new Map((Array.isArray(tvProfiles)?tvProfiles:[]).map(profile=>[String(profile.id),profile.name||`Profile ${profile.id}`]))},analytics=dashboardAnalytics(movies,tvItems,history,30,profileNames),recentImports=history.filter(item=>String(item.eventType||'').toLowerCase().includes('imported')),seen=new Set(),recentlyAdded=[];for(const item of recentImports){const key=`${item.domain}:${item.mediaId||item.title}`;if(seen.has(key))continue;seen.add(key);recentlyAdded.push({id:item.mediaId||item.id,title:item.title,type:item.domain==='movie'?'Movie':'TV',timestamp:item.timestamp});if(recentlyAdded.length===6)break;}return{metrics:{movies:movies.length,tv:tvItems.length,queue:queue.length,upcomingMovies:calendar.filter((item)=>item.domain==='movie').length,upcomingEpisodes:calendar.filter((item)=>item.domain==='tv').length,missing:movies.filter((item)=>item.state==='missing').length+tvItems.reduce((sum,item)=>sum+item.missingEpisodes,0),downloading:queue.filter((item)=>String(item.status).toLowerCase().includes('down')).length,health:health.length,storage:analytics.library.movie.sizeOnDisk+analytics.library.tv.sizeOnDisk},analytics,recentlyAdded,recentActivity:history.slice(0,8),engines:{configured:engineSettings.configured(),mode,status:sync.snapshot()}};})();
          try{dashboardSnapshot=await dashboardSnapshotRun;dashboardSnapshotExpires=Date.now()+15_000;return json(res,200,dashboardSnapshot,{'x-vynodearr-cache':'miss'});}finally{dashboardSnapshotRun=null;}
        }
        if(url.pathname==='/api/system/engines'){const [movieTest,tvTest,movieStatus,tvStatus]=await Promise.all([registry.movie().testConnection(),registry.tv().testConnection(),registry.movie().getSystemStatus().catch(()=>null),registry.tv().getSystemStatus().catch(()=>null)]);const publicSettings=engineSettings.public();return json(res,200,{mode,managed:String(env.VYNODEARR_BUNDLED_ENGINES||'false')==='true',configured:engineSettings.configured(),engines:[{domain:'movie',displayName:'Movies',configuration:publicSettings.movie||publicEngineConfiguration(baseConfig.movie),connection:movieTest,status:movieStatus,synchronization:sync.snapshot().movie},{domain:'tv',displayName:'TV',configuration:publicSettings.tv||publicEngineConfiguration(baseConfig.tv),connection:tvTest,status:tvStatus,synchronization:sync.snapshot().tv}]});}
        return json(res,404,{error:{code:'not_found',message:'The requested VynodeArr resource was not found.'}});
      }
      const requested=url.pathname==='/'?'index.html':url.pathname.slice(1),safe=normalize(requested).replace(/^(\.\.[/\\])+/, '');
      try{const path=join(webRoot,safe),value=await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});return res.end(value);}catch{const value=await readFile(join(webRoot,'index.html'));res.writeHead(200,{'content-type':mime['.html']});return res.end(value);}
    }catch(error){if(url.pathname.startsWith('/api/'))return safeError(res,error,url.pathname.includes('/tv')?'TV':url.pathname.includes('/movies')?'Movie':null,url.pathname);res.writeHead(500);res.end();}
  }
  return{handleRequest,registry,sync,auth,config:baseConfig,engineSettings,initialize};
}

export const defaultApplication=createApplication();
export const handleRequest=defaultApplication.handleRequest;
