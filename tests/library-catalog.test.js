import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LibraryCatalogStore} from '../.server-build/packages/platform/src/library-catalog-store.js';

test('SQLite library catalog imports projections and supports indexed paging, restore, events, and artwork',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-catalog-')),legacy=join(directory,'projections.json'),database=join(directory,'library.sqlite');
  await writeFile(legacy,JSON.stringify({domains:{movie:[{id:'movie_1',title:'Alpha',year:2024,monitoring:'all',state:'available',hasFile:true,engineInstanceId:'movies-a'},{id:'movie_2',title:'Beta',year:2025,monitoring:'all',state:'missing',engineInstanceId:'movies-b'}],tv:[]},operations:{queue:[],history:[],calendar:[],health:[]}}));
  const store=new LibraryCatalogStore(database,{legacyPath:legacy});
  try{
    await store.initialize();assert.equal(await store.countDomain('movie'),2);
    assert.deepEqual(await store.librarySummary('movie'),{total:2,monitored:2,covered:1});
    assert.deepEqual(await store.librarySummary('movie','movies-a'),{total:1,monitored:1,covered:1});
    assert.deepEqual(await store.librarySummary('movie','movies-b'),{total:1,monitored:1,covered:0});
    assert.deepEqual(await store.attentionSummary('movie','movies-a'),{missing:0,cutoff:0});
    assert.deepEqual(await store.attentionSummary('movie','movies-b'),{missing:1,cutoff:0});
    assert.deepEqual(await store.integrityCheck(),{ok:true,result:'ok'});
    assert.deepEqual(await store.domainIntegrity('movie'),{count:2,invalidPayloads:0,duplicateExternalIds:0,ok:true});
    await store.replaceDomain('movie',await store.domain('movie'));const synchronization=await store.synchronizationState('movie');assert.ok(synchronization.lastSuccess);assert.equal(synchronization.itemCount,2);
    const page=await store.queryDomain('movie',{limit:1,sort:'title'});assert.equal(page.items[0].title,'Alpha');assert.equal(page.total,2);assert.deepEqual(page.letters.A,{offset:0,count:1});
    await store.enqueueEvent({dedupeKey:'movie:1:changed',domain:'movie',mediaId:'movie_1',eventType:'changed'});await store.enqueueEvent({dedupeKey:'movie:1:changed',domain:'movie',mediaId:'movie_1',eventType:'changed'});assert.equal((await store.claimEvents(10)).length,1);
    await store.artworkSet('movie:movie_1:poster',{file:'one.bin',contentType:'image/jpeg',size:10,cachedAt:Date.now()});assert.equal((await store.artworkGet('movie:movie_1:poster')).file,'one.bin');assert.deepEqual(await store.artworkRemovePrefix('movie:movie_1:'),['one.bin']);
    const snapshot=await store.exportSnapshot();await store.removeDomainItem('movie','movie_1');await store.restoreSnapshot(snapshot);assert.equal(await store.countDomain('movie'),2);
  }finally{await store.close();await rm(directory,{recursive:true,force:true});}
});

test('catalog paging preserves the selected movie and TV sort when direction changes',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-sort-')),database=join(directory,'library.sqlite'),store=new LibraryCatalogStore(database);
  try{
    await store.initialize();
    await store.replaceDomain('movie',[{id:'movie_a',title:'Alpha',releaseDate:'2020-01-01'},{id:'movie_z',title:'Zulu',releaseDate:'2025-06-01'},{id:'movie_m',title:'Missing date'}]);
    await store.replaceDomain('tv',[{id:'series_a',title:'Alpha',firstAired:'2024-08-01'},{id:'series_z',title:'Zulu',firstAired:'2019-03-01'},{id:'series_m',title:'Missing date'}]);
    assert.deepEqual((await store.queryDomain('movie',{sort:'releaseDate',direction:'ascending'})).items.map(item=>item.id),['movie_a','movie_z','movie_m']);
    assert.deepEqual((await store.queryDomain('movie',{sort:'releaseDate',direction:'descending'})).items.map(item=>item.id),['movie_z','movie_a','movie_m']);
    assert.deepEqual((await store.queryDomain('tv',{sort:'releaseDate',direction:'ascending'})).items.map(item=>item.id),['series_z','series_a','series_m']);
    assert.deepEqual((await store.queryDomain('tv',{sort:'releaseDate',direction:'descending'})).items.map(item=>item.id),['series_a','series_z','series_m']);
  }finally{await store.close();await rm(directory,{recursive:true,force:true});}
});
