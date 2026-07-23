import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MediaEngineRegistry } from '../../../packages/platform/src/engine-registry.js';
import { loadEngineConfiguration, publicEngineConfiguration } from '../../../packages/platform/src/engine-config.js';
import { SynchronizationService } from '../../../packages/platform/src/synchronization-service.js';
import { AuthService } from '../../../packages/platform/src/auth-service.js';
import { MovieEngineAdapter } from '../../../packages/movie-domain/src/engine-adapter.js';
import { TvEngineAdapter } from '../../../packages/tv-domain/src/engine-adapter.js';
import { MovieFixtureAdapter } from '../../../packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../../../packages/tv-domain/src/fixture-adapter.js';

const webRoot = fileURLToPath(new URL('../../web/public/', import.meta.url));
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon' };
const cookies = (header='') => Object.fromEntries(header.split(';').map((part)=>part.trim().split('=').map(decodeURIComponent)).filter(([key])=>key));
const redact = (value) => String(value || '').replace(/https?:\/\/\S+/gi, '[internal service]').replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[internal host]');

async function body(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) { size+=chunk.length; if(size>64_000) throw new Error('Request too large'); chunks.push(chunk); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}
function json(res,status,value,headers={}) {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers});
  res.end(JSON.stringify(value));
}
function safeError(res,error,domain) {
  const message=redact(error?.safeMessage || (domain ? `${domain} service unavailable` : 'Media data could not be refreshed'));
  json(res,error?.code==='engine_authentication_failed'?502:503,{error:{code:error?.code||'service_unavailable',message}});
}
function sessionFor(req,auth){return auth.session(cookies(req.headers.cookie).vynodenew_session);}
function requireSession(req,res,auth) {
  const session=sessionFor(req,auth);
  if(!session){json(res,401,{error:{code:'authentication_required',message:'Sign in to VynodeNew to continue.'}});return null;}
  return session;
}
function requireCsrf(req,res,session) {
  if(req.headers['x-vynodenew-csrf']!==session.csrf){json(res,403,{error:{code:'csrf_invalid',message:'The security token was invalid.'}});return false;}
  return true;
}

export function createApplication(options={}) {
  const env=options.env||process.env;
  const config=options.config||loadEngineConfiguration(env);
  const movie=options.movie||(config.dataMode==='fixture'?new MovieFixtureAdapter(config.movie):new MovieEngineAdapter(config.movie));
  const tv=options.tv||(config.dataMode==='fixture'?new TvFixtureAdapter(config.tv):new TvEngineAdapter(config.tv));
  const registry=options.registry||new MediaEngineRegistry().register('movie',movie).register('tv',tv);
  const sync=options.sync||new SynchronizationService({movie,tv,maxItems:config.cacheMaxItems,pollIntervalMs:config.pollIntervalMs});
  const dataDir=resolve(env.VYNODENEW_DATA_DIR||fileURLToPath(new URL('../../../data/',import.meta.url)));
  const auth=options.auth||new AuthService({userFile:join(dataDir,'users.json'),secureCookies:String(env.VYNODENEW_SECURE_COOKIES||env.NODE_ENV==='production')==='true'});

  async function handleRequest(req,res) {
    const url=new URL(req.url,'http://vynodenew.local');
    try {
      if(req.method==='GET'&&url.pathname==='/healthz')return json(res,200,{status:'ready',service:'VynodeNew'});
      if(url.pathname==='/api/auth/status'&&req.method==='GET') {
        const session=sessionFor(req,auth);
        return json(res,200,{setupRequired:await auth.setupRequired(),authenticated:Boolean(session),user:session?.user||null,csrf:session?.csrf||null});
      }
      if(url.pathname==='/api/auth/setup'&&req.method==='POST') {
        const input=await body(req);
        await auth.createInitialAdministrator(String(input.username||''),String(input.password||''));
        return json(res,201,{created:true});
      }
      if(url.pathname==='/api/auth/login'&&req.method==='POST') {
        const input=await body(req); const result=await auth.login(input.username,input.password,req.socket.remoteAddress);
        if(!result)return json(res,401,{error:{code:'login_failed',message:'The username or password was not accepted.'}});
        return json(res,200,{authenticated:true,user:result.user,csrf:result.csrf},{'set-cookie':auth.cookie(result.id)});
      }
      if(url.pathname.startsWith('/api/')) {
        const session=requireSession(req,res,auth); if(!session)return;
        if(url.pathname==='/api/auth/logout'&&req.method==='POST') {
          if(!requireCsrf(req,res,session))return;
          auth.logout(cookies(req.headers.cookie).vynodenew_session);
          return json(res,200,{authenticated:false},{'set-cookie':auth.cookie('',true)});
        }
        if(url.pathname==='/api/system/sync'&&req.method==='POST') {
          if(!requireCsrf(req,res,session))return;
          const results=await sync.startup();
          return json(res,200,{synchronized:true,results:results.map((item)=>item.status),state:sync.snapshot()});
        }
        if(req.method!=='GET')return json(res,405,{error:{code:'read_only',message:'Read-only review mode'}});

        if(url.pathname==='/api/media/movies')return json(res,200,{items:await sync.list('movie',{refresh:url.searchParams.get('refresh')==='true'}),mode:config.dataMode,sync:sync.snapshot().movie});
        const movieMatch=url.pathname.match(/^\/api\/media\/movies\/(movie_[A-Za-z0-9_-]+)$/);
        if(movieMatch){const item=await registry.movie().getMovie(movieMatch[1]);return item?json(res,200,{item,mode:config.dataMode}):json(res,404,{error:{code:'not_found',message:'Movie was not found.'}});}
        if(url.pathname==='/api/media/tv')return json(res,200,{items:await sync.list('tv',{refresh:url.searchParams.get('refresh')==='true'}),mode:config.dataMode,sync:sync.snapshot().tv});
        const tvMatch=url.pathname.match(/^\/api\/media\/tv\/(series_[A-Za-z0-9_-]+)$/);
        if(tvMatch){const item=await registry.tv().getSeries(tvMatch[1]);return item?json(res,200,{item,mode:config.dataMode}):json(res,404,{error:{code:'not_found',message:'TV series was not found.'}});}
        if(url.pathname==='/api/activity/queue')return json(res,200,{items:[...await registry.movie().getQueue(),...await registry.tv().getQueue()]});
        if(url.pathname==='/api/activity/history')return json(res,200,{items:[...await registry.movie().getHistory(),...await registry.tv().getHistory()].sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)))});
        if(url.pathname==='/api/calendar')return json(res,200,{items:[...await registry.movie().getCalendar(),...await registry.tv().getCalendar()].sort((a,b)=>String(a.dateUtc).localeCompare(String(b.dateUtc)))});
        if(url.pathname==='/api/system/health')return json(res,200,{items:[...await registry.movie().getHealth(),...await registry.tv().getHealth()],sync:sync.snapshot()});
        if(url.pathname==='/api/system/engines') {
          const [movieTest,tvTest,movieStatus,tvStatus]=await Promise.all([registry.movie().testConnection(),registry.tv().testConnection(),registry.movie().getSystemStatus().catch(()=>null),registry.tv().getSystemStatus().catch(()=>null)]);
          return json(res,200,{mode:config.dataMode,engines:[
            {domain:'movie',displayName:'Movies',configuration:publicEngineConfiguration(config.movie),connection:movieTest,status:movieStatus,synchronization:sync.snapshot().movie},
            {domain:'tv',displayName:'TV',configuration:publicEngineConfiguration(config.tv),connection:tvTest,status:tvStatus,synchronization:sync.snapshot().tv}
          ]});
        }
        return json(res,404,{error:{code:'not_found',message:'The requested VynodeNew resource was not found.'}});
      }

      const requested=url.pathname==='/'?'index.html':url.pathname.slice(1);
      const safe=normalize(requested).replace(/^(\.\.[/\\])+/, '');
      try { const path=join(webRoot,safe); const value=await readFile(path); res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}); return res.end(value); }
      catch { const value=await readFile(join(webRoot,'index.html')); res.writeHead(200,{'content-type':mime['.html']}); return res.end(value); }
    } catch(error) {
      if(url.pathname.startsWith('/api/'))return safeError(res,error,url.pathname.includes('/tv')?'TV':url.pathname.includes('/movies')?'Movie':null);
      res.writeHead(500);res.end();
    }
  }
  return {handleRequest,registry,sync,auth,config};
}

export const defaultApplication=createApplication();
export const handleRequest=defaultApplication.handleRequest;
