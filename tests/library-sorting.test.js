import test from 'node:test';
import assert from 'node:assert/strict';
import {librarySortOptions,sortLibraryItems} from '../apps/web/client/src/library-sorting.ts';

const items=[
  {id:'movie_1',title:'The Alpha',sortTitle:'alpha',year:2020,releaseDate:'2020-01-02',firstAired:'2020-01-02',rating:7.1,certification:'PG-13',runtimeMinutes:120,addedAt:'2026-01-03',sizeOnDisk:300,completionPercent:100,hasFile:true,state:'available',missingEpisodes:0,cutoffUnmetEpisodes:0},
  {id:'movie_2',title:'Bravo',sortTitle:'bravo',year:2024,releaseDate:'2024-06-01',firstAired:'2024-06-01',rating:8.5,certification:'R',runtimeMinutes:90,addedAt:'2026-02-03',sizeOnDisk:100,completionPercent:40,hasFile:false,state:'missing',missingEpisodes:6,cutoffUnmetEpisodes:1},
  {id:'movie_3',title:'Charlie',sortTitle:'charlie',year:2022,releaseDate:'2022-03-04',firstAired:'2022-03-04',rating:6.2,certification:'PG',runtimeMinutes:150,addedAt:'2026-01-20',sizeOnDisk:200,completionPercent:70,hasFile:true,state:'cutoff',missingEpisodes:2,cutoffUnmetEpisodes:3}
];
const ids=(values)=>values.map(item=>item.id);

test('library exposes only engine-backed sorting choices with domain-specific date labels',()=>{
  const movie=librarySortOptions('movies'),tv=librarySortOptions('tv');
  assert.deepEqual(movie.map(option=>option.value),['title','year','releaseDate','rating','certification','duration','added','size','completion','attention','random']);
  assert.equal(movie.find(option=>option.value==='releaseDate').label,'Release date');
  assert.equal(tv.find(option=>option.value==='releaseDate').label,'First aired');
  assert.equal(movie.find(option=>option.value==='completion').label,'Availability');
  assert.equal(tv.find(option=>option.value==='completion').label,'Episode completion');
  for(const unsupported of ['plays','dateViewed','progress','resolution','bitrate'])assert.ok(!movie.some(option=>option.value===unsupported));
});

test('library sorting covers normalized movie and television metadata',()=>{
  assert.deepEqual(ids(sortLibraryItems(items,'movies','title','ascending')),['movie_1','movie_2','movie_3']);
  assert.deepEqual(ids(sortLibraryItems(items,'movies','year','descending')),['movie_2','movie_3','movie_1']);
  assert.deepEqual(ids(sortLibraryItems(items,'movies','releaseDate','descending')),['movie_2','movie_3','movie_1']);
  assert.deepEqual(ids(sortLibraryItems(items,'movies','rating','descending')),['movie_2','movie_1','movie_3']);
  assert.deepEqual(ids(sortLibraryItems(items,'movies','certification','ascending')),['movie_3','movie_1','movie_2']);
  assert.deepEqual(ids(sortLibraryItems(items,'movies','duration','descending')),['movie_3','movie_1','movie_2']);
  assert.deepEqual(ids(sortLibraryItems(items,'movies','added','descending')),['movie_2','movie_3','movie_1']);
  assert.deepEqual(ids(sortLibraryItems(items,'movies','size','descending')),['movie_1','movie_3','movie_2']);
  assert.deepEqual(ids(sortLibraryItems(items,'tv','completion','descending')),['movie_1','movie_3','movie_2']);
  assert.deepEqual(ids(sortLibraryItems(items,'movies','attention','descending')),['movie_2','movie_3','movie_1']);
  assert.deepEqual(ids(sortLibraryItems(items,'tv','attention','descending')),['movie_2','movie_3','movie_1']);
});

test('missing metadata stays last and random order is stable for a seed',()=>{
  const incomplete=[...items,{id:'movie_4',title:'Unknown',sortTitle:'unknown'}];
  assert.equal(sortLibraryItems(incomplete,'movies','rating','ascending').at(-1).id,'movie_4');
  assert.equal(sortLibraryItems(incomplete,'movies','rating','descending').at(-1).id,'movie_4');
  assert.deepEqual(ids(sortLibraryItems(items,'movies','random','ascending',1234)),ids(sortLibraryItems(items,'movies','random','ascending',1234)));
});
