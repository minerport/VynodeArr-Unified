import assert from 'node:assert/strict';
import test from 'node:test';
import {PlexService,sanitizePlexEndpoint} from '../packages/platform/src/plex-service.js';

test('Plex connection validates identity and discovers movie and television libraries',async()=>{
  const calls=[],service=new PlexService({fetchImpl:async(url,options)=>{calls.push({url,token:options.headers['x-plex-token']});return url.endsWith('/identity')?new Response(JSON.stringify({MediaContainer:{machineIdentifier:'server-1',version:'1.41.0',friendlyName:'Living Room'}})):new Response(JSON.stringify({MediaContainer:{Directory:[{key:'1',title:'Movies',type:'movie',uuid:'movies-1'},{key:'2',title:'Shows',type:'show',uuid:'shows-1'},{key:'3',title:'Music',type:'artist',uuid:'music-1'}]}}));}});
  const result=await service.inspect('http://plex.local:32400/','secret');
  assert.equal(result.endpoint,'http://plex.local:32400');assert.equal(result.server.name,'Living Room');assert.deepEqual(result.libraries.map(item=>item.title),['Movies','Shows']);assert.deepEqual(calls.map(item=>item.token),['secret','secret']);
});

test('Plex connection accepts XML responses and rejects unsafe endpoint credentials',async()=>{
  const service=new PlexService({fetchImpl:async url=>new Response(url.endsWith('/identity')?'<MediaContainer machineIdentifier="abc" version="1.2.3"/>':'<MediaContainer><Directory key="5" title="TV &amp; More" type="show" uuid="tv-5"/></MediaContainer>')});
  const result=await service.inspect('https://plex.example.test:32400','token');assert.equal(result.server.machineIdentifier,'abc');assert.equal(result.libraries[0].title,'TV & More');
  assert.throws(()=>sanitizePlexEndpoint('http://user:password@plex.local:32400'),/credentials/);
});

test('Plex authentication errors are actionable without exposing the token',async()=>{
  const service=new PlexService({fetchImpl:async()=>new Response('',{status:401})});
  await assert.rejects(service.inspect('http://plex.local:32400','super-secret'),error=>error.message==='Plex rejected the access token'&&!error.message.includes('super-secret'));
});

test('Plex matching uses external IDs and reports ambiguity without title fallback',()=>{
  const service=new PlexService(),vynode=[{id:'movie_1',domain:'movie',title:'Same title',tmdbId:10},{id:'movie_2',domain:'movie',title:'Same title',tmdbId:20},{id:'movie_3',domain:'movie',title:'Unique by name only'}],plex=[{ratingKey:'a',title:'Different title',Guid:[{id:'tmdb://10'}]},{ratingKey:'b',title:'Same title',Guid:[{id:'tmdb://20'}]},{ratingKey:'c',title:'Duplicate ID',Guid:[{id:'tmdb://20'}]},{ratingKey:'d',title:'Unique by name only',Guid:[]}];
  const result=service.match(vynode,plex);assert.equal(result[0].status,'matched');assert.equal(result[0].plex[0].ratingKey,'a');assert.equal(result[1].status,'ambiguous');assert.equal(result[2].status,'unmatched');
});

test('Plex artwork proxy accepts bounded image responses and rejects arbitrary paths',async()=>{
  const service=new PlexService({fetchImpl:async()=>new Response(Buffer.from('poster-bytes'),{headers:{'content-type':'image/jpeg'}})}),artwork=await service.artwork('http://plex.local:32400','token','/library/metadata/12/thumb/34');assert.equal(artwork.contentType,'image/jpeg');assert.equal(artwork.body.toString(),'poster-bytes');await assert.rejects(service.artwork('http://plex.local:32400','token','/system/accounts'),/path is invalid/);
});

test('Plex poster upload sends one bounded raster body to the matched metadata key',async()=>{
  let call;const service=new PlexService({fetchImpl:async(url,options)=>{call={url,options};return new Response('',{status:200});}}),poster=Buffer.from('jpeg-bytes');await service.uploadPoster('http://plex.local:32400','secret','91',poster,'image/jpeg');assert.equal(call.url,'http://plex.local:32400/library/metadata/91/posters');assert.equal(call.options.method,'POST');assert.equal(call.options.headers['x-plex-token'],'secret');assert.equal(call.options.headers['content-type'],'image/jpeg');assert.equal(call.options.body,poster);await assert.rejects(service.uploadPoster('http://plex.local:32400','secret','../91',poster,'image/jpeg'),/target is invalid/);
});
