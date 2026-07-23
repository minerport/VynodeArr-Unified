import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
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
async function body(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1_500_000)throw new Error('Request is too large');chunks.push(chunk);}return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};}
function json(res,status,value,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...headers});res.end(JSON.stringify(value));}
function safeError(res,error,domain,url=''){const engine=Boolean(error?.safeMessage||error?.code?.startsWith('engine_'));const message=redact(engine?(error.safeMessage||(domain?`${domain} service unavailable`:'Media data could not be refreshed')):error?.message||'The request could not be completed.');json(res,engine?(error.code==='engine_authentication_failed'?502:503):400,{error:{code:engine?(error.code||'service_unavailable'):'validation_failed',message}});}
function sessionFor(req,auth){return auth.session(cookies(req.headers.cookie).vynodenew_session);}
function requireSession(req,res,auth){const session=sessionFor(req,auth);if(!session){json(res,401,{error:{code:'authentication_required',message:'Sign in to VynodeNew to continue.'}});return null;}return session;}
function requireCsrf(req,res,session){if(req.headers['x-vynodenew-csrf']!==session.csrf){json(res,403,{error:{code:'csrf_invalid',message:'The security token was invalid.'}});return false;}return true;}
function administrator(res,session){if(session.user.role!=='administrator'){json(res,403,{error:{code:'administrator_required',message:'Administrator access is required.'}});return false;}return true;}

export function createApplication(options={}){
  const env=options.env||process.env,baseConfig=options.config||loadEngineConfiguration(env);
  const dataDir=resolve(env.VYNODENEW_DATA_DIR||fileURLToPath(new URL('../../../data/',import.meta.url)));
  const auth=options.auth||new AuthService({userFile:join(dataDir,'users.json'),sessionFile:join(dataDir,'sessions.json'),secureCookies:String(env.VYNODENEW_SECURE_COOKIES||env.NODE_ENV==='production')==='true'});
  const engineSettings=options.engineSettings||new EngineSettingsService({path:join(dataDir,'engine-settings.json'),vaultPath:join(dataDir,'credentials.enc'),masterKey:options.masterKey||loadSecret(env,'VYNODENEW_MASTER_KEY')||'local-development-key-change-me-2026',defaults:baseConfig});
  const projectionStore=options.projectionStore||new ProjectionStore(join(dataDir,'projections.json'));
  const auditStore=options.auditStore||new JsonStore(join(dataDir,'management-audit.json'),{version:1,entries:[]});
  const artworkCache=new Map();let mode=baseConfig.dataMode;
  let movie=options.movie||(mode==='fixture'?new MovieFixtureAdapter(baseConfig.movie):new MovieEngineAdapter(baseConfig.movie));
  let tv=options.tv||(mode==='fixture'?new TvFixtureAdapter(baseConfig.tv):new TvEngineAdapter(baseConfig.tv));
  const registry=options.registry||new MediaEngineRegistry().register('movie',movie).register('tv',tv);
  const sync=options.sync||new SynchronizationService({movie,tv,maxItems:baseConfig.cacheMaxItems,pollIntervalMs:baseConfig.pollIntervalMs,projectionStore});
  const management=new EngineManagementService(registry);
  let initialized=false;
  async function rebuildFromSettings(){
    const runtime=await engineSettings.runtime();if(!runtime)return;
    movie=new MovieEngineAdapter(runtime.movie);tv=new TvEngineAdapter(runtime.tv);registry.register('movie',movie).register('tv',tv);sync.setEngines(movie,tv);mode='engine';
  }
  async function ensureBundledRootFolders(){
    if(String(env.VYNODENEW_BOOTSTRAP_ROOT_FOLDERS||'false')!=='true'||mode!=='engine')return;
    for(const [domain,path] of [['movie','/movies'],['tv','/tv']]){
      const client=registry.get(domain).client,roots=await client.get('rootfolder');
      if(Array.isArray(roots)&&roots.length===0)await client.post('rootfolder',{path});
    }
  }
  async function initialize(){
    if(initialized)return;await Promise.all([auth.initialize(),engineSettings.initialize()]);if(!options.movie)await rebuildFromSettings();await ensureBundledRootFolders();await sync.startup();sync.startPolling();initialized=true;
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

  async function handleRequest(req,res){
    const url=new URL(req.url,'http://vynodenew.local');if(!initialized)await initialize();
    try{
      if(req.method==='GET'&&url.pathname==='/healthz')return json(res,200,{status:'ready',service:'VynodeNew'});
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
        const session=requireSession(req,res,auth);if(!session)return;const sessionId=cookies(req.headers.cookie).vynodenew_session;
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
        const engineTest=url.pathname.match(/^\/api\/settings\/engines\/(movie|tv)\/test$/);
        if(engineTest&&req.method==='POST'){if(!administrator(res,session)||!requireCsrf(req,res,session))return;return json(res,200,await testEngine(engineTest[1],await body(req)));}
        const engineSave=url.pathname.match(/^\/api\/settings\/engines\/(movie|tv)$/);
        if(engineSave&&req.method==='PUT'){
          if(!administrator(res,session)||!requireCsrf(req,res,session))return;const input=await body(req),result=await testEngine(engineSave[1],input);if(!result.validated)return json(res,422,{error:{code:'engine_validation_failed',message:result.connection.safeError||'Engine validation did not succeed.'}});
          await engineSettings.save(engineSave[1],input,input.apiCredential);await rebuildFromSettings();await sync.startup();return json(res,200,{saved:true,settings:engineSettings.public(),validation:result});
        }
        if(url.pathname==='/api/system/sync'&&req.method==='POST'){if(!requireCsrf(req,res,session))return;const results=await sync.startup();return json(res,200,{synchronized:true,results:results.map((item)=>item.status),state:sync.snapshot()});}
        const catalogMatch=url.pathname.match(/^\/api\/manage\/(movie|tv)$/);
        if(catalogMatch&&req.method==='GET'){if(!administrator(res,session))return;return json(res,200,{domain:catalogMatch[1],available:management.available(catalogMatch[1]),resources:management.catalog(catalogMatch[1])});}
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
            if(['library','episodes','episodeFiles','queue'].includes(managementMatch[2]))await sync.startup();
          }
          return json(res,method==='POST'?201:200,{result});
        }
        if(url.pathname==='/api/manage/audit'&&req.method==='GET'){if(!administrator(res,session))return;const audit=await auditStore.read();return json(res,200,{items:audit.entries||[]});}
        if(req.method!=='GET')return json(res,405,{error:{code:'read_only',message:'Read-only review mode'}});
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
        if(url.pathname==='/api/activity/queue')return json(res,200,{items:await sync.operations('queue')});
        if(url.pathname==='/api/activity/history')return json(res,200,{items:await sync.operations('history')});
        if(url.pathname==='/api/calendar')return json(res,200,{items:await sync.operations('calendar')});
        if(url.pathname==='/api/system/health')return json(res,200,{items:await sync.operations('health'),sync:sync.snapshot()});
        if(url.pathname==='/api/dashboard'){
          const [movies,tvItems,queue,history,calendar,health]=await Promise.all([sync.list('movie'),sync.list('tv'),sync.operations('queue'),sync.operations('history'),sync.operations('calendar'),sync.operations('health')]);
          return json(res,200,{metrics:{movies:movies.length,tv:tvItems.length,queue:queue.length,upcomingMovies:calendar.filter((item)=>item.domain==='movie').length,upcomingEpisodes:calendar.filter((item)=>item.domain==='tv').length,missing:movies.filter((item)=>item.state==='missing').length+tvItems.reduce((sum,item)=>sum+item.missingEpisodes,0),downloading:queue.filter((item)=>String(item.status).toLowerCase().includes('down')).length,health:health.length,storage:movies.filter((item)=>item.hasFile).length+tvItems.length},recentlyAdded:[...movies.slice(-3),...tvItems.slice(-3)].slice(0,6),recentActivity:history.slice(0,6),engines:{configured:engineSettings.configured(),mode,status:sync.snapshot()}});
        }
        if(url.pathname==='/api/system/engines'){const [movieTest,tvTest,movieStatus,tvStatus]=await Promise.all([registry.movie().testConnection(),registry.tv().testConnection(),registry.movie().getSystemStatus().catch(()=>null),registry.tv().getSystemStatus().catch(()=>null)]);const publicSettings=engineSettings.public();return json(res,200,{mode,configured:engineSettings.configured(),engines:[{domain:'movie',displayName:'Movies',configuration:publicSettings.movie||publicEngineConfiguration(baseConfig.movie),connection:movieTest,status:movieStatus,synchronization:sync.snapshot().movie},{domain:'tv',displayName:'TV',configuration:publicSettings.tv||publicEngineConfiguration(baseConfig.tv),connection:tvTest,status:tvStatus,synchronization:sync.snapshot().tv}]});}
        return json(res,404,{error:{code:'not_found',message:'The requested VynodeNew resource was not found.'}});
      }
      const requested=url.pathname==='/'?'index.html':url.pathname.slice(1),safe=normalize(requested).replace(/^(\.\.[/\\])+/, '');
      try{const path=join(webRoot,safe),value=await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});return res.end(value);}catch{const value=await readFile(join(webRoot,'index.html'));res.writeHead(200,{'content-type':mime['.html']});return res.end(value);}
    }catch(error){if(url.pathname.startsWith('/api/'))return safeError(res,error,url.pathname.includes('/tv')?'TV':url.pathname.includes('/movies')?'Movie':null,url.pathname);res.writeHead(500);res.end();}
  }
  return{handleRequest,registry,sync,auth,config:baseConfig,engineSettings,initialize};
}

export const defaultApplication=createApplication();
export const handleRequest=defaultApplication.handleRequest;
