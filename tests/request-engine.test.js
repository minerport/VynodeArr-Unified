import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequestEngineProxy } from '../packages/request-domain/src/gateway-proxy.js';

test('request engine gateway rewrites subpath assets, APIs, redirects, and cookies',async()=>{
  const upstream=createServer((req,res)=>{
    if(req.url==='/login'){res.writeHead(302,{location:'/setup','set-cookie':'connect.sid=test; Path=/; HttpOnly'});return res.end();}
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    res.end('<a href="/">Home</a><script src="/_next/app.js"></script><script>fetch("/api/v1/status")</script><img src="/images/a.jpg">');
  });
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const proxy=createRequestEngineProxy({host:'127.0.0.1',port:upstream.address().port});
  const gateway=createServer((req,res)=>proxy(req,res,new URL(req.url,'http://gateway')));
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${gateway.address().port}`;
    const page=await fetch(`${base}/requests/`),html=await page.text();
    assert.match(html,/href="\/requests\/"/);
    assert.match(html,/\/requests\/_next\/app\.js/);
    assert.match(html,/\/requests\/api\/v1\/status/);
    assert.match(html,/\/requests\/images\/a\.jpg/);
    const redirect=await fetch(`${base}/requests/login`,{redirect:'manual'});
    assert.equal(redirect.headers.get('location'),'/requests/setup');
    assert.match(redirect.headers.get('set-cookie'),/Path=\/requests/);
  }finally{
    await new Promise(resolve=>gateway.close(resolve));
    await new Promise(resolve=>upstream.close(resolve));
  }
});

test('request engine integration is isolated from existing media adapters',async()=>{
  const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../apps/api/src/app.js',import.meta.url),'utf8'));
  assert.match(source,/createRequestEngineProxy/);
  assert.match(source,/\/requests/);
  assert.doesNotMatch(source,/register\('(?:movie|tv)',request/);
});
