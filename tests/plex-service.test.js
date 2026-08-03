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

test('multi-library review is driven by Plex items instead of repeating every VynodeArr title',()=>{
  const service=new PlexService(),vynode=[{id:'movie_a',domain:'movie',title:'Alpha',tmdbId:10},{id:'movie_b',domain:'movie',title:'Beta',tmdbId:20}],first=service.matchLibrary(vynode,[{ratingKey:'1',title:'Alpha',type:'movie',Guid:[{id:'tmdb://10'}]}]),second=service.matchLibrary(vynode,[{ratingKey:'2',title:'Other',type:'movie',Guid:[{id:'tmdb://99'}]}]);
  assert.equal(first.length,1);assert.equal(first[0].status,'matched');assert.equal(first[0].id,'movie_a');assert.equal(second.length,1);assert.equal(second[0].status,'unmatched');assert.equal(second[0].id,'plex_2');
});

test('Plex library hydration retrieves omitted GUIDs and accepts legacy agent identifiers',async()=>{
  const calls=[],service=new PlexService({fetchImpl:async url=>{calls.push(url);if(url.includes('/library/sections/1/all'))return new Response(JSON.stringify({MediaContainer:{Metadata:[{ratingKey:'10',title:'Modern',year:2024,guid:'plex://movie/modern'},{ratingKey:'11',title:'Legacy',year:2009,guid:'com.plexapp.agents.themoviedb://34653?lang=en'}]}}));if(url.includes('/library/metadata/10'))return new Response(JSON.stringify({MediaContainer:{Metadata:[{ratingKey:'10',title:'Modern',Guid:[{id:'tmdb://32562'},{id:'imdb://tt1517451'}]}]}}));throw new Error(`Unexpected URL ${url}`);}}),items=await service.libraryItems('http://plex.local:32400','token',{key:'1',type:'movie'}),result=service.match([{id:'movie_a',domain:'movie',title:'Modern',tmdbId:32562},{id:'movie_b',domain:'movie',title:'Legacy',tmdbId:34653}],items);assert.equal(result[0].status,'matched');assert.equal(result[1].status,'matched');assert.equal(calls.length,2);assert.match(calls[1],/library\/metadata\/10\?includeGuids=1/);
});

test('Plex artwork proxy accepts bounded image responses and rejects arbitrary paths',async()=>{
  const service=new PlexService({fetchImpl:async()=>new Response(Buffer.from('poster-bytes'),{headers:{'content-type':'image/jpeg'}})}),artwork=await service.artwork('http://plex.local:32400','token','/library/metadata/12/thumb/34');assert.equal(artwork.contentType,'image/jpeg');assert.equal(artwork.body.toString(),'poster-bytes');await assert.rejects(service.artwork('http://plex.local:32400','token','/system/accounts'),/path is invalid/);
});

test('Plex poster upload sends one bounded raster body to the matched metadata key',async()=>{
  let call;const service=new PlexService({fetchImpl:async(url,options)=>{call={url,options};return new Response('',{status:200});}}),poster=Buffer.from('jpeg-bytes');await service.uploadPoster('http://plex.local:32400','secret','91',poster,'image/jpeg');assert.equal(call.url,'http://plex.local:32400/library/metadata/91/posters');assert.equal(call.options.method,'POST');assert.equal(call.options.headers['x-plex-token'],'secret');assert.equal(call.options.headers['content-type'],'image/jpeg');assert.equal(call.options.body,poster);await assert.rejects(service.uploadPoster('http://plex.local:32400','secret','../91',poster,'image/jpeg'),/target is invalid/);
});
