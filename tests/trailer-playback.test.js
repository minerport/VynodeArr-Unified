import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PassThrough} from 'node:stream';
import {TrailerPlaybackService} from '../packages/platform/src/trailer-playback-service.js';

test('trailer playback resolves only browser-compatible trailer files inside the selected library folder',async()=>{
  const root=await mkdtemp(join(tmpdir(),'vynode-trailer-'));
  try{
    const movie=join(root,'movies','Example Movie (2026)'),tv=join(root,'tv','Example Show','Trailers');
    await mkdir(movie,{recursive:true});await mkdir(tv,{recursive:true});
    await writeFile(join(movie,'Example Movie (2026).mkv'),'full movie');
    await writeFile(join(movie,'Example Movie (2026)-trailer.mp4'),'movie trailer');
    await writeFile(join(tv,'Official.webm'),'tv trailer');
    const service=new TrailerPlaybackService({movieRoot:join(root,'movies'),tvRoot:join(root,'tv')});
    const movieTrailer=await service.find('movie',movie),tvTrailer=await service.find('tv',join(root,'tv','Example Show'));
    assert.match(movieTrailer.path,/trailer\.mp4$/);assert.equal(movieTrailer.contentType,'video/mp4');
    assert.match(tvTrailer.path,/Official\.webm$/);assert.equal(tvTrailer.contentType,'video/webm');
    assert.equal(await service.find('movie',join(root,'tv','Example Show')),null);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('trailer playback serves byte ranges without transcoding',async()=>{
  const root=await mkdtemp(join(tmpdir(),'vynode-trailer-range-'));
  try{
    const folder=join(root,'movies','Range Movie');await mkdir(folder,{recursive:true});
    await writeFile(join(folder,'Range Movie-trailer.mp4'),'0123456789');
    const service=new TrailerPlaybackService({movieRoot:join(root,'movies'),tvRoot:join(root,'tv')}),file=await service.find('movie',folder),response=new PassThrough(),chunks=[];
    response.writeHead=(status,headers)=>{response.statusCode=status;response.responseHeaders=headers;};response.on('data',chunk=>chunks.push(chunk));
    const ended=new Promise(resolve=>response.on('end',resolve));service.send({method:'GET',headers:{range:'bytes=2-5'}},response,file);await ended;
    assert.equal(response.statusCode,206);assert.equal(response.responseHeaders['content-range'],'bytes 2-5/10');assert.equal(Buffer.concat(chunks).toString(),'2345');
  }finally{await rm(root,{recursive:true,force:true});}
});
