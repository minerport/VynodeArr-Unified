import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LibraryCatalogStore} from '../.server-build/packages/platform/src/library-catalog-store.js';

test('SQLite library catalog imports projections and supports indexed paging, restore, events, and artwork',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-catalog-')),legacy=join(directory,'projections.json'),database=join(directory,'library.sqlite');
  await writeFile(legacy,JSON.stringify({domains:{movie:[{id:'movie_1',title:'Alpha',year:2024,monitoring:'all',state:'available',hasFile:true},{id:'movie_2',title:'Beta',year:2025,monitoring:'all',state:'missing'}],tv:[]},operations:{queue:[],history:[],calendar:[],health:[]}}));
  const store=new LibraryCatalogStore(database,{legacyPath:legacy});
  try{
    await store.initialize();assert.equal(await store.countDomain('movie'),2);
    await store.replaceDomain('movie',await store.domain('movie'));const synchronization=await store.synchronizationState('movie');assert.ok(synchronization.lastSuccess);assert.equal(synchronization.itemCount,2);
    const page=await store.queryDomain('movie',{limit:1,sort:'title'});assert.equal(page.items[0].title,'Alpha');assert.equal(page.total,2);assert.deepEqual(page.letters.A,{offset:0,count:1});
    await store.enqueueEvent({dedupeKey:'movie:1:changed',domain:'movie',mediaId:'movie_1',eventType:'changed'});await store.enqueueEvent({dedupeKey:'movie:1:changed',domain:'movie',mediaId:'movie_1',eventType:'changed'});assert.equal((await store.claimEvents(10)).length,1);
    await store.artworkSet('movie:movie_1:poster',{file:'one.bin',contentType:'image/jpeg',size:10,cachedAt:Date.now()});assert.equal((await store.artworkGet('movie:movie_1:poster')).file,'one.bin');assert.deepEqual(await store.artworkRemovePrefix('movie:movie_1:'),['one.bin']);
    const snapshot=await store.exportSnapshot();await store.removeDomainItem('movie','movie_1');await store.restoreSnapshot(snapshot);assert.equal(await store.countDomain('movie'),2);
  }finally{await store.close();await rm(directory,{recursive:true,force:true});}
});
