import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createLogger} from '../.server-build/packages/platform/src/logger.js';
import {ReadOnlyEngineClient} from '../.server-build/packages/platform/src/read-only-engine-client.js';
import {SynchronizationService} from '../.server-build/packages/platform/src/synchronization-service.js';

const captureSink=()=>{
  const lines=[];
  return{lines,sink:{log:value=>lines.push(value),warn:value=>lines.push(value),error:value=>lines.push(value)}};
};

test('structured logger filters levels and redacts credentials in metadata and messages',()=>{
  const {lines,sink}=captureSink(),logger=createLogger({env:{VYNODEARR_LOG_LEVEL:'info',VYNODEARR_LOG_FORMAT:'json'},context:{component:'engine',instance:'Living Room'},sink});
  logger.debug('hidden','not emitted',{apiKey:'hidden'});
  logger.info('engine.test','Connected using apiKey=super-secret',{apiCredential:'super-secret',url:'http://engine/api?apikey=super-secret',itemCount:42});
  assert.equal(lines.length,1);
  assert.doesNotMatch(lines[0],/super-secret/);
  const record=JSON.parse(lines[0]);
  assert.equal(record.event,'engine.test');
  assert.equal(record.instance,'Living Room');
  assert.equal(record.apiCredential,'[REDACTED]');
  assert.equal(record.itemCount,42);
});

test('external engine logs connection loss and restoration without exposing its key',async()=>{
  let available=false;
  const server=createServer((request,response)=>{
    response.writeHead(available?200:503,{'content-type':'application/json'});
    response.end(available?'[]':'{}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {lines,sink}=captureSink(),logger=createLogger({env:{VYNODEARR_LOG_LEVEL:'info',VYNODEARR_LOG_FORMAT:'json'},context:{component:'engine',domain:'movie',source:'external',instance:'Archive'},sink});
  const client=new ReadOnlyEngineClient({enabled:true,host:'127.0.0.1',port:server.address().port,https:false,urlBase:'',apiCredential:'do-not-log',timeoutMs:100,retries:0,tlsVerify:true},'Movie',logger);
  await assert.rejects(()=>client.get('movie'));
  available=true;
  await client.get('movie');
  await new Promise(resolve=>server.close(resolve));
  const records=lines.map(line=>JSON.parse(line));
  assert.ok(records.some(record=>record.event==='engine.connection.failed'&&record.instance==='Archive'));
  assert.ok(records.some(record=>record.event==='engine.connection.restored'&&record.source==='external'));
  assert.doesNotMatch(lines.join('\n'),/do-not-log/);
});

test('catalog synchronization logs useful counts and retained-catalog failures',async()=>{
  const {lines,sink}=captureSink(),logger=createLogger({env:{VYNODEARR_LOG_LEVEL:'info',VYNODEARR_LOG_FORMAT:'json'},context:{component:'catalog'},sink});
  let fail=false;
  const movie={listMovies:async()=>{if(fail)throw new Error('upstream unavailable');return[{id:'movie_1'}];}},tv={listSeries:async()=>[]};
  const sync=new SynchronizationService({movie,tv,logger});
  await sync.synchronize('movie');
  fail=true;
  assert.equal((await sync.synchronize('movie')).length,1);
  const records=lines.map(line=>JSON.parse(line));
  assert.ok(records.some(record=>record.event==='catalog.sync.completed'&&record.itemCount===1));
  assert.ok(records.some(record=>record.event==='catalog.sync.deferred'&&record.retainedCatalog===true));
});
