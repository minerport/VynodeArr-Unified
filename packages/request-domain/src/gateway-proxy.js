import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const hopHeaders=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
const textTypes=['text/html','text/css','text/javascript','application/javascript','application/json','application/manifest+json'];
const vynodeArrTheme=`<style id="vynodearr-request-theme">
:root{--vynodearr-cyan:#38d8d2;--vynodearr-violet:#7652ff}
html{background:#070d19!important}
body{background:radial-gradient(circle at 80% 0,rgba(83,73,190,.18),transparent 38%),#070d19!important}
button,[role="button"],a[class*="button"]{border-radius:10px!important}
button[class*="primary"],a[class*="primary"],button[type="submit"]{background:linear-gradient(135deg,var(--vynodearr-violet),#9347ed)!important}
input,select,textarea{border-radius:9px!important}
nav,aside,header{backdrop-filter:blur(18px)}
body.vynodearr-embedded img[src*="logo_full"],body.vynodearr-embedded img[alt="Seerr"],body.vynodearr-embedded a[href="/"]>img{display:none!important}
</style>`;
const vynodeArrBridge=`<script id="vynodearr-request-bridge">
(()=>{if(window.self!==window.top)document.body?.classList.add('vynodearr-embedded');
let brandingPending=false;
const rename=()=>{brandingPending=false;if(document.title!=='VynodeArr Requests')document.title='VynodeArr Requests';document.body?.classList.toggle('vynodearr-embedded',window.self!==window.top);
const walker=document.createTreeWalker(document.body||document.documentElement,NodeFilter.SHOW_TEXT);let node;
while(node=walker.nextNode()){if(node.parentElement?.closest('script,style'))continue;const value=node.nodeValue||'';
if(/seerr/i.test(value)){const branded=value.replace(/Welcome to Seerr/gi,'Welcome to VynodeArr Requests').replace(/Seerr/gi,'VynodeArr Requests');if(branded!==value)node.nodeValue=branded;}}}
const scheduleRename=()=>{if(brandingPending)return;brandingPending=true;requestAnimationFrame(rename);};
const startBranding=()=>{rename();new MutationObserver(scheduleRename).observe(document.body||document.documentElement,{subtree:true,childList:true,characterData:true});};
if(document.readyState==='complete')setTimeout(startBranding,0);else addEventListener('load',()=>setTimeout(startBranding,0),{once:true});})();
</script>`;

function rewriteLocation(value,prefix){
  if(!value)return value;
  try{
    const parsed=new URL(value);
    return `${prefix}${parsed.pathname}${parsed.search}${parsed.hash}`;
  }catch{
    return value.startsWith('/')&&!value.startsWith(prefix)?`${prefix}${value}`:value;
  }
}

function rewriteCookie(value,prefix){
  return String(value).replace(/;\s*Path=\/(?:;|$)/i,`; Path=${prefix};`);
}

function rewriteBody(value,prefix,contentType=''){
  const isScript=contentType.includes('javascript');
  if(isScript){
    return value
      .replace(/(["'`])\/api\/v1/g,`$1${prefix}/api/v1`)
      .replace(/(["'`])\/_next/g,`$1${prefix}/_next`)
      .replace(/(["'`])\/login\/plex\/loading/g,`$1${prefix}/login/plex/loading`)
      .replace(/(["'`])\/(images|imageproxy|avatarproxy)\//g,`$1${prefix}/$2/`)
      .replace(/(["'`])\/(android-|apple-|favicon|logo_|site\.webmanifest)/g,`$1${prefix}/$2`);
  }
  const rewritten=value
    .replaceAll('href="/"',`href="${prefix}/"`)
    .replaceAll('href="/login"',`href="${prefix}/login"`)
    .replaceAll('href:"/"',`href:"${prefix}/"`)
    .replaceAll('/_next',`${prefix}/_next`)
    .replaceAll('/api/v1',`${prefix}/api/v1`)
    .replaceAll('/login/plex/loading',`${prefix}/login/plex/loading`)
    .replace(/(["'(])\/(images|imageproxy|avatarproxy)\//g,`$1${prefix}/$2/`)
    .replace(/(["'(])\/(android-|apple-|favicon|logo_|site\.webmanifest)/g,`$1${prefix}/$2`);
  return contentType.includes('text/html')&&!rewritten.includes('vynodearr-request-theme')
    ?(rewritten.includes('</head>')?rewritten.replace('</head>',`${vynodeArrTheme}${vynodeArrBridge}</head>`):`${vynodeArrTheme}${vynodeArrBridge}${rewritten}`)
    :rewritten;
}

export function createRequestEngineProxy({
  host='request-engine',
  port=5055,
  https=false,
  tlsVerify=true,
  prefix='/requests',
  timeoutMs=30000,
  maxTransformBytes=16*1024*1024
}={}){
  return function proxyRequestEngine(req,res,url){
    const relative=url.pathname.slice(prefix.length)||'/';
    const transport=https?httpsRequest:httpRequest,headers={};
    for(const[name,value]of Object.entries(req.headers)){
      if(!hopHeaders.has(name)&&name!=='host'&&value!==undefined)headers[name]=value;
    }
    headers.host=`${host}:${port}`;
    headers['x-forwarded-host']=req.headers.host||'';
    headers['x-forwarded-proto']=String(req.headers['x-forwarded-proto']||'http');
    headers['x-forwarded-prefix']=prefix;
    headers['accept-encoding']='identity';
    const upstream=transport({
      protocol:https?'https:':'http:',
      hostname:host,
      port,
      method:req.method,
      path:`${relative}${url.search}`,
      headers,
      rejectUnauthorized:tlsVerify
    },response=>{
      const responseHeaders={};
      for(const[name,value]of Object.entries(response.headers)){
        if(hopHeaders.has(name)||value===undefined||name==='content-length')continue;
        if(name==='location')responseHeaders[name]=rewriteLocation(value,prefix);
        else if(name==='set-cookie')responseHeaders[name]=(Array.isArray(value)?value:[value]).map(cookie=>rewriteCookie(cookie,prefix));
        else responseHeaders[name]=value;
      }
      const contentType=String(response.headers['content-type']||'').toLowerCase();
      if(!textTypes.some(type=>contentType.includes(type))){
        if(response.headers['content-length'])responseHeaders['content-length']=response.headers['content-length'];
        res.writeHead(response.statusCode||502,responseHeaders);
        return response.pipe(res);
      }
      const chunks=[];let size=0,finished=false;
      response.on('data',chunk=>{
        size+=chunk.length;
        if(size>maxTransformBytes){
          finished=true;upstream.destroy();
          if(!res.headersSent){res.writeHead(502,{'content-type':'text/plain; charset=utf-8'});res.end('Request service response was too large.');}
          return;
        }
        chunks.push(chunk);
      });
      response.on('end',()=>{
        if(finished)return;
        const output=Buffer.from(rewriteBody(Buffer.concat(chunks).toString('utf8'),prefix,contentType));
        delete responseHeaders.etag;
        delete responseHeaders['last-modified'];
        responseHeaders['cache-control']='no-store';
        responseHeaders['content-length']=String(output.length);
        res.writeHead(response.statusCode||502,responseHeaders);res.end(output);
      });
    });
    upstream.setTimeout(timeoutMs,()=>upstream.destroy(new Error('Request service timed out')));
    upstream.on('error',()=>{
      if(!res.headersSent){res.writeHead(502,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end('<h1>Requests unavailable</h1><p>The private request service is still starting or could not be reached.</p>');}
      else res.destroy();
    });
    req.pipe(upstream);
  };
}
