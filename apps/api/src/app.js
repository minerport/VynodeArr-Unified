import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname,join,normalize,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const webRoot=fileURLToPath(new URL('../../web/public/',import.meta.url));
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

export function createApplication(options={}){
  const env=options.env||process.env,baseConfig=options.config||loadEngineConfiguration(env);
  const dataDir=resolve(env.VYNODEARR_DATA_DIR||fileURLToPath(new URL('../../../data/',import.meta.url)));
  const auth=options.auth||new AuthService({userFile:join(dataDir,'users.json'),sessionFile:join(dataDir,'sessions.json'),secureCookies:String(env.VYNODEARR_SECURE_COOKIES||env.NODE_ENV==='production')==='true'});
  const engineSettings=options.engineSettings||new EngineSettingsService({path:join(dataDir,'engine-settings.json'),vaultPath:join(dataDir,'credentials.enc'),masterKey:options.masterKey||loadSecret(env,'VYNODEARR_MASTER_KEY')||'local-development-key-change-me-2026',defaults:baseConfig});
  const projectionStore=options.projectionStore||new ProjectionStore(join(dataDir,'projections.json'));
  const auditStore=options.auditStore||new JsonStore(join(dataDir,'management-audit.json'),{version:1,entries:[]});
  const artworkCache=new Map(),tvMetadataCache=new Map();let mode=baseConfig.dataMode;
  let movie=options.movie||(mode==='fixture'?new MovieFixtureAdapter(baseConfig.movie):new MovieEngineAdapter(baseConfig.movie));
  let tv=options.tv||(mode==='fixture'?new TvFixtureAdapter(baseConfig.tv):new TvEngineAdapter(baseConfig.tv));
  const registry=options.registry||new MediaEngineRegistry().register('movie',movie).register('tv',tv);
  const sync=options.sync||new SynchronizationService({movie,tv,maxItems:baseConfig.cacheMaxItems,pollIntervalMs:baseConfig.pollIntervalMs,projectionStore});
  const management=new EngineManagementService(registry);
  const importJobs=new Map();
  let initialized=false;
  function importIdentityKeys(value={}){
    const keys=[],title=String(value.title||value.name||'').trim().toLowerCase(),year=Number(value.year||0);
    for(const field of ['tmdbId','tvdbId','imdbId'])if(value[field])keys.push(`${field}:${String(value[field]).toLowerCase()}`);
    const path=String(value.path||'').replaceAll('\\','/').replace(/\/+$/,'').toLowerCase();if(path)keys.push(`path:${path}`);
    if(!keys.length&&title)keys.push(`title:${title}:${year||''}`);
    return keys;
  }
  function publicImportJob(job){return{id:job.id,domain:job.domain,label:job.label,status:job.status,total:job.total,completed:job.completed,skipped:job.skipped,failed:job.failed,currentTitle:job.currentTitle,errors:job.errors.slice(-25),createdAt:job.createdAt,finishedAt:job.finishedAt};}
  const duplicateImportError=(message)=>/(?:already|existing).*(?:add|exist|configur|use)|(?:path|tmdb|tvdb|title).*(?:already|exist|configur|use)|another (?:movie|series)/i.test(String(message||''));
  const qualityRank=(release)=>{
    const name=String(release?.quality?.quality?.name||release?.quality?.name||release?.title||'').toLowerCase();
    const resolution=name.includes('2160')?4000:name.includes('1080')?3000:name.includes('720')?2000:name.includes('480')||name.includes('576')?1000:0;
    const source=name.includes('remux')?900:name.includes('bluray')||name.includes('blu-ray')?800:name.includes('webdl')||name.includes('web-dl')?700:name.includes('webrip')||name.includes('web-rip')?650:name.includes('hdtv')?500:name.includes('dvd')?300:0;
    return Number(release?.qualityWeight||0)||resolution+source;
  };
  const eligibleRelease=(release)=>Boolean(release)&&release.rejected!==true&&release.approved!==false&&release.downloadAllowed!==false&&!(release.rejections||[]).length;
  const compareReleases=(left,right)=>qualityRank(right)-qualityRank(left)||Number(right.customFormatScore||0)-Number(left.customFormatScore||0)||Number(left.size||Number.MAX_SAFE_INTEGER)-Number(right.size||Number.MAX_SAFE_INTEGER);
  const importPaceMs=Math.max(0,Math.min(2000,Number(env.VYNODEARR_IMPORT_PACE_MS||200)));
  const pause=(milliseconds)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  function startImportJob(userId,input){
    const domain=input.domain,label=domain==='movie'?'Movies':'Television',items=Array.isArray(input.items)?input.items:[];
    if(!['movie','tv'].includes(domain)||!items.length||items.length>5000)throw new Error('Select between 1 and 5,000 titles to import');
    const job={id:`import_${randomUUID()}`,userId,domain,label,status:'queued',total:items.length,completed:0,skipped:0,failed:0,currentTitle:null,errors:[],createdAt:new Date().toISOString(),finishedAt:null};
    importJobs.set(job.id,job);
    void(async()=>{
      job.status='running';const known=new Set();
      try{const existing=await management.execute(domain,'library','GET',{});for(const record of Array.isArray(existing)?existing:existing?.records||[])for(const key of importIdentityKeys(record))known.add(key);}catch{}
      for(const item of items){
        job.currentTitle=String(item.title||'Untitled');const keys=importIdentityKeys(item.payload),duplicate=keys.some(key=>known.has(key));
        if(duplicate){job.skipped+=1;continue;}
        try{await management.execute(domain,'library','POST',{payload:item.payload});job.completed+=1;for(const key of keys)known.add(key);}
        catch(error){const message=redact(error?.safeMessage||error?.message||'Import failed');if(duplicateImportError(message))job.skipped+=1;else{job.failed+=1;job.errors.push({title:job.currentTitle,message});}}
        if(importPaceMs)await pause(importPaceMs);
      }
      job.currentTitle=null;job.status=job.failed===job.total?'failed':'completed';job.finishedAt=new Date().toISOString();sync.invalidate(domain);setTimeout(()=>sync.synchronize(domain).catch(()=>{}),10_000);setTimeout(()=>importJobs.delete(job.id),6*60*60*1000);
    })();
    return publicImportJob(job);
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
    await restoreBundledCredentials();
    if(!options.movie)await rebuildFromSettings();
    try{
      await ensureBundledRootFolders();
      await sync.startup();
    }catch(error){
      console.warn('Engine startup synchronization deferred:',redact(error?.safeMessage||error?.message||'Engine unavailable'));
    }
    sync.startPolling();
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
      const [queueValue,library]=await Promise.all([
        client.get('queue',{page:1,pageSize:500,includeUnknownMovieItems:true,includeUnknownSeriesItems:true,includeMovie:true,includeSeries:true,includeEpisode:true}),
        client.get(domain==='movie'?'movie':'series').catch(()=>[])
      ]);
      const records=Array.isArray(queueValue?.records)?queueValue.records:[],libraryById=new Map((Array.isArray(library)?library:[]).map(item=>[Number(item.id),item]));
      return records.map(item=>{
        const mediaId=Number(domain==='movie'?(item.movieId||item.movie?.id):(item.seriesId||item.series?.id||item.episode?.seriesId)),media=item[domain==='movie'?'movie':'series']||libraryById.get(mediaId)||null,size=Number(item.size||0),sizeLeft=Number(item.sizeleft||0),percentage=size>0?(size-sizeLeft)/size*100:null;
        return{...item,domain,media,mediaId,clientStatus:item.status||item.trackedDownloadState||null,clientFilename:item.title||null,clientPercentage:Number.isFinite(percentage)?percentage:null,clientTimeLeft:item.timeleft||item.estimatedCompletionTime||null,clientSizeLeftMb:Number.isFinite(sizeLeft)?sizeLeft/1048576:null,clientSpeed:null};
      });
    }));
    return results.flat();
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
      if(url.pathname==='/api/auth/status'&&req.method==='GET'){const session=sessionFor(req,auth);return json(res,200,{setupRequired:await auth.setupRequired(),authenticated:Boolean(session),user:session?.user||null,csrf:session?.csrf||null,enginesConfigured:engineSettings.configured()});}
      if(url.pathname==='/api/auth/setup'&&req.method==='POST'){
        const input=await body(req),user=await auth.createInitialAdministrator(input),result=await auth.createSession(user,{ip:req.socket.remoteAddress,userAgent:req.headers['user-agent'],remember:true});
        return json(res,201,{created:true,authenticated:true,user:result.user,csrf:result.csrf,enginesConfigured:engineSettings.configured()},{'set-cookie':auth.cookie(result.id,false,true)});
      }
      if(url.pathname==='/api/auth/login'&&req.method==='POST'){
        const input=await body(req),result=await auth.login(input.identifier||input.username,input.password,{ip:req.socket.remoteAddress,userAgent:req.headers['user-agent'],remember:Boolean(input.remember)});
        if(!result)return json(res,401,{error:{code:'login_failed',message:'The username, email, or password was not accepted.'}});
        return json(res,200,{authenticated:true,user:result.user,csrf:result.csrf,enginesConfigured:engineSettings.configured()},{'set-cookie':auth.cookie(result.id,false,Boolean(input.remember))});
      }
      if(url.pathname.startsWith('/api/')){
        const session=requireSession(req,res,auth);if(!session)return;const sessionId=cookies(req.headers.cookie).vynodearr_session;
        if(url.pathname==='/api/import-jobs'&&req.method==='GET')return json(res,200,{items:[...importJobs.values()].filter(job=>job.userId===session.user.id).map(publicImportJob)});
        if(url.pathname==='/api/import-jobs'&&req.method==='POST'){if(!requireCsrf(req,res,session))return;return json(res,202,{job:startImportJob(session.user.id,await body(req,25_000_000))});}
        if(url.pathname==='/api/auth/logout'&&req.method==='POST'){if(!requireCsrf(req,res,session))return;await auth.logout(sessionId);return json(res,200,{authenticated:false},{'set-cookie':auth.cookie('',true)});}
        if(url.pathname==='/api/account'&&req.method==='GET')return json(res,200,{user:session.user});
        if(url.pathname==='/api/account'&&req.method==='PATCH'){if(!requireCsrf(req,res,session))return;return json(res,200,{user:await auth.updateAccount(session.user.id,await body(req),sessionId)});}
        if(url.pathname==='/api/account/sessions'&&req.method==='GET')return json(res,200,{items:await auth.listSessions(session.user.id,sessionId)});
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
        if(url.pathname==='/api/system/application-update'&&req.method==='GET')return json(res,200,{application:'VynodeArr',installedVersion:String(env.VYNODEARR_VERSION||'1.0.10'),channel:String(env.VYNODEARR_UPDATE_CHANNEL||'develop'),mechanism:'Container image',repository:'https://github.com/minerport/VynodeArr-Unified',message:'Pull the newest VynodeArr container image, then recreate the application container. Engine updates are managed separately.'});
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
        const catalogMatch=url.pathname.match(/^\/api\/manage\/(movie|tv)$/);
        if(catalogMatch&&req.method==='GET'){if(!administrator(res,session))return;return json(res,200,{domain:catalogMatch[1],available:management.available(catalogMatch[1]),resources:management.catalog(catalogMatch[1])});}
        const automaticSearchMatch=url.pathname.match(/^\/api\/manage\/(movie|tv)\/automaticSearch$/);
        if(automaticSearchMatch&&req.method==='POST'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;
          const domain=automaticSearchMatch[1],input=await body(req),query=domain==='movie'?{movieId:Number(input.movieId)}:{episodeId:Number(input.episodeId)};
          if(!Number.isFinite(query.movieId??query.episodeId))throw new Error(`Choose a ${domain==='movie'?'movie':'television episode'} to search`);
          const releases=await management.execute(domain,'releases','GET',{query}),accepted=(Array.isArray(releases)?releases:[]).filter(eligibleRelease);
          if(!accepted.length)throw new Error('No accepted releases matched the configured quality profile and restrictions');
          accepted.sort(compareReleases);
          const selected=accepted[0],result=await management.execute(domain,'releases','POST',{payload:selected});
          return json(res,201,{result,selection:{title:selected.title,quality:selected.quality?.quality?.name||selected.quality?.name||'Unknown',size:Number(selected.size||0),acceptedCandidates:accepted.length}});
        }
        const managementMatch=url.pathname.match(/^\/api\/manage\/(movie|tv)\/([A-Za-z][A-Za-z0-9]*)(?:\/([A-Za-z0-9_-]+))?$/);
        if(managementMatch){
          if(!administrator(res,session))return;
          const method=req.method||'GET';
          if(method!=='GET'&&!requireCsrf(req,res,session))return;
          const input=method==='GET'?{}:await body(req);
          const result=await management.execute(managementMatch[1],managementMatch[2],method,{id:managementMatch[3],query:Object.fromEntries(url.searchParams),payload:input});
          if(method!=='GET'){
            const audit=await auditStore.read(),entries=Array.isArray(audit.entries)?audit.entries:[];
            entries.unshift({id:`change_${randomUUID()}`,timestamp:new Date().toISOString(),userId:session.user.id,username:session.user.username,domain:managementMatch[1],resource:managementMatch[2],method,resourceId:managementMatch[3]||null});
            await auditStore.write({version:1,entries:entries.slice(0,1000)});
            if(['library','libraryEditor'].includes(managementMatch[2]))await sync.synchronize(managementMatch[1]);
            else if(['episodes','episodeFiles'].includes(managementMatch[2]))await sync.synchronize('tv');
            else if(managementMatch[2]==='queue')await sync.synchronizeOperations();
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
          if(!value){value=await registry.get(artworkMatch[1]).getArtwork(artworkMatch[2],artworkMatch[3]);if(!value){res.writeHead(204,{'cache-control':'private, max-age=60'});return res.end();}artworkCache.set(key,{...value,cachedAt:Date.now()});}
          res.writeHead(200,{'content-type':value.contentType,'cache-control':'private, max-age=3600','x-content-type-options':'nosniff'});return res.end(value.body);
        }
        if(url.pathname==='/api/media/movies')return json(res,200,{items:await sync.list('movie',{refresh:url.searchParams.get('refresh')==='true'}),mode,sync:sync.snapshot().movie});
        const movieMatch=url.pathname.match(/^\/api\/media\/movies\/(movie_[A-Za-z0-9_-]+)$/);if(movieMatch){const item=await registry.movie().getMovie(movieMatch[1]);return item?json(res,200,{item,mode}):json(res,404,{error:{code:'not_found',message:'Movie was not found.'}});}
        if(url.pathname==='/api/media/tv')return json(res,200,{items:await sync.list('tv',{refresh:url.searchParams.get('refresh')==='true'}),mode,sync:sync.snapshot().tv});
        const tvMatch=url.pathname.match(/^\/api\/media\/tv\/(series_[A-Za-z0-9_-]+)$/);if(tvMatch){const item=await registry.tv().getSeries(tvMatch[1]);return item?json(res,200,{item,mode}):json(res,404,{error:{code:'not_found',message:'TV series was not found.'}});}
        if(url.pathname==='/api/activity/queue/live')return json(res,200,{items:await liveQueue()});
        if(url.pathname==='/api/activity/queue')return json(res,200,{items:await sync.operations('queue')});
        if(url.pathname==='/api/activity/history')return json(res,200,{items:await sync.operations('history')});
        if(url.pathname==='/api/calendar')return json(res,200,{items:await sync.operations('calendar')});
        if(url.pathname==='/api/system/health')return json(res,200,{items:await sync.operations('health'),sync:sync.snapshot()});
        if(url.pathname==='/api/dashboard'){
          const [movies,tvItems,queue,history,calendar,health]=await Promise.all([sync.list('movie'),sync.list('tv'),sync.operations('queue'),sync.operations('history'),sync.operations('calendar'),sync.operations('health')]);
          return json(res,200,{metrics:{movies:movies.length,tv:tvItems.length,queue:queue.length,upcomingMovies:calendar.filter((item)=>item.domain==='movie').length,upcomingEpisodes:calendar.filter((item)=>item.domain==='tv').length,missing:movies.filter((item)=>item.state==='missing').length+tvItems.reduce((sum,item)=>sum+item.missingEpisodes,0),downloading:queue.filter((item)=>String(item.status).toLowerCase().includes('down')).length,health:health.length,storage:movies.filter((item)=>item.hasFile).length+tvItems.length},recentlyAdded:[...movies.slice(-3),...tvItems.slice(-3)].slice(0,6),recentActivity:history.slice(0,6),engines:{configured:engineSettings.configured(),mode,status:sync.snapshot()}});
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
