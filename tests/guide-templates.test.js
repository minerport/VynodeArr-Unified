import test from 'node:test';
import assert from 'node:assert/strict';
import { GuideTemplateService,formatForMovieEngine } from '../packages/platform/src/guide-template-service.js';

class MemoryStore{
  constructor(){this.value={version:1,records:{}};}
  async read(){return structuredClone(this.value);}
  async write(value){this.value=structuredClone(value);}
}

const revision='a'.repeat(40);
const format={
  trash_id:'b'.repeat(32),
  trash_scores:{default:-10000},
  name:'BR-DISK',
  includeCustomFormatWhenRenaming:false,
  specifications:[{name:'BR-DISK',implementation:'ReleaseTitleSpecification',negate:false,required:true,fields:{value:'\\b(BDISO|BR-DISK)\\b'}}]
};
const jsonResponse=value=>({ok:true,status:200,json:async()=>structuredClone(value)});
const fetcher=async url=>{
  if(url.includes('/branches/master'))return jsonResponse({commit:{sha:revision}});
  if(url.includes('/git/trees/'))return jsonResponse({truncated:false,tree:['radarr','sonarr'].flatMap(domain=>Array.from({length:60},(_,index)=>({type:'blob',path:`docs/json/${domain}/cf/${index===0?'br-disk':`template-${index}`}.json`,sha:`${domain}-${index}`})))});
  if(url.includes('/conflicts.json'))return jsonResponse({custom_formats:[]});
  if(url.includes('/quality-profile-groups/groups.json'))return jsonResponse([]);
  if(url.includes('/br-disk.json'))return jsonResponse(format);
  throw new Error(`Unexpected URL ${url}`);
};

test('guide catalog is purpose grouped, revision pinned, cached, and templates retain TRaSH identity',async()=>{
  const store=new MemoryStore(),service=new GuideTemplateService({store,fetcher});
  const catalog=await service.catalog();
  assert.equal(catalog.revision,revision);
  assert.equal(catalog.templates.length,120);
  assert.equal(catalog.templates.find(item=>item.id==='movie--cf--br-disk').purpose,'unwanted');
  assert.equal(catalog.templates.find(item=>item.id==='tv--cf--br-disk').domain,'tv');
  assert.match(catalog.templates[0].url,new RegExp(revision));
  const cached=await service.catalog();
  assert.equal(cached.cached,true);
  const template=await service.template('movie--cf--br-disk');
  assert.equal(template.trashId,format.trash_id);
  assert.deepEqual(template.format.specifications,format.specifications);
});

test('comparison distinguishes new, matching, conflicting, and locally modified formats',async()=>{
  const store=new MemoryStore(),service=new GuideTemplateService({store,fetcher}),template=await service.template('movie--cf--br-disk');
  assert.equal((await service.comparison(template,[])).status,'new');
  assert.equal((await service.comparison(template,[{id:7,...template.format}])).status,'matches');
  assert.equal((await service.comparison(template,[{id:7,...template.format,specifications:[]}])).status,'conflict');
  await service.recordDecision(template,{decision:'implemented',radarrId:7,username:'admin'});
  assert.equal((await service.comparison(template,[{id:7,...template.format,specifications:[]}])).status,'modified');
  await service.recordDecision(template,{decision:'rejected',username:'admin'});
  assert.equal((await store.read()).records[`movie:${template.trashId}`].decision,'rejected');
});

test('local template provenance never substitutes for engine configuration',async()=>{
  const store=new MemoryStore(),service=new GuideTemplateService({store,fetcher}),template=await service.template('movie--cf--br-disk');
  await service.recordDecision(template,{decision:'implemented',radarrId:42,username:'admin'});
  const missing=await service.comparison(template,[]);
  assert.equal(missing.status,'new');
  assert.equal(missing.existing,null);
  assert.equal(missing.sourceOfTruth,'movie-engine');
  const changed=await service.comparison(template,[{id:42,...template.format,name:'Engine-owned name'}]);
  assert.equal(changed.status,'modified');
  assert.equal(changed.existing.name,'Engine-owned name');
});

test('TRaSH field objects are converted to movie-engine schema fields',()=>{
  const payload=formatForMovieEngine({
    name:'3D',
    includeCustomFormatWhenRenaming:false,
    specifications:[{name:'3D',implementation:'ReleaseTitleSpecification',negate:false,required:false,fields:{value:'\\b3D\\b'}}]
  },[{
    implementation:'ReleaseTitleSpecification',
    implementationName:'Release Title',
    fields:[{order:0,name:'value',label:'Regular Expression',type:'textbox'}],
    presets:[]
  }]);
  assert.equal(payload.specifications[0].fields[0].name,'value');
  assert.equal(payload.specifications[0].fields[0].value,'\\b3D\\b');
  assert.equal(payload.specifications[0].implementationName,'Release Title');
});

function indexedFetcher({revisionValue=revision,failFormats=false,counter={formats:0}}={}){
  return async url=>{
    if(url.includes('/branches/master'))return jsonResponse({commit:{sha:revisionValue}});
    if(url.includes('/git/trees/'))return jsonResponse({truncated:false,tree:['radarr','sonarr'].flatMap(domain=>Array.from({length:60},(_,index)=>({type:'blob',path:`docs/json/${domain}/cf/template-${index}.json`,sha:`${domain}-${index}`})))});
    if(url.includes('/conflicts.json'))return jsonResponse({custom_formats:[]});
    if(url.includes('/quality-profile-groups/groups.json'))return jsonResponse([]);
    const match=url.match(/docs\/json\/(radarr|sonarr)\/cf\/template-(\d+)\.json$/);
    if(match){
      counter.formats++;
      if(failFormats)throw new Error('upstream unavailable');
      const domainDigit=match[1]==='radarr'?'1':'2',index=Number(match[2]),trashId=`${domainDigit}${String(index).padStart(31,'0')}`;
      return jsonResponse({...format,trash_id:trashId,name:`${match[1]} format ${index}`});
    }
    throw new Error(`Unexpected URL ${url}`);
  };
}

test('custom-format indexes persist by revision and isolate Movies from TV',async()=>{
  const store=new MemoryStore(),coldCounter={formats:0},cold=new GuideTemplateService({store,fetcher:indexedFetcher({counter:coldCounter}),cacheTtlMs:5});
  const movieId=`1${String(7).padStart(31,'0')}`,tvId=`2${String(7).padStart(31,'0')}`;
  const [first,concurrent]=await Promise.all([cold.customFormatsByTrashIds([movieId],'movie'),cold.customFormatsByTrashIds([movieId],'movie')]);
  assert.equal(first.get(movieId).format.name,'radarr format 7');assert.equal(concurrent.get(movieId).format.name,'radarr format 7');assert.equal(coldCounter.formats,60);
  assert.equal((await store.read()).formatIndexes.movie.revision,revision);assert.equal((await store.read()).formatIndexes.tv,undefined);

  const warmCounter={formats:0},warm=new GuideTemplateService({store,fetcher:indexedFetcher({counter:warmCounter,failFormats:true})});
  assert.equal((await warm.customFormatsByTrashIds([movieId],'movie')).get(movieId).format.name,'radarr format 7');assert.equal(warmCounter.formats,0);
  const tvCounter={formats:0},tvService=new GuideTemplateService({store,fetcher:indexedFetcher({counter:tvCounter})});
  assert.equal((await tvService.customFormatsByTrashIds([tvId],'tv')).get(tvId).format.name,'sonarr format 7');assert.equal(tvCounter.formats,60);
  assert.equal((await store.read()).formatIndexes.movie.revision,revision);assert.equal((await store.read()).formatIndexes.tv.revision,revision);

  const failedStore=new MemoryStore(),failure=new GuideTemplateService({store:failedStore,fetcher:indexedFetcher({failFormats:true})});
  await assert.rejects(()=>failure.customFormatsByTrashIds([movieId],'movie'),/upstream unavailable/);
  assert.deepEqual((await failedStore.read()).formatIndexes,{});
});

test('custom-format indexes rebuild when corrupt or from an older revision',async()=>{
  const store=new MemoryStore(),seedCounter={formats:0},seed=new GuideTemplateService({store,fetcher:indexedFetcher({counter:seedCounter})});
  const movieId=`1${String(3).padStart(31,'0')}`;await seed.customFormatsByTrashIds([movieId],'movie');
  store.value.formatIndexes.movie.items[0].value.trash_id='invalid';
  const repairCounter={formats:0},repair=new GuideTemplateService({store,fetcher:indexedFetcher({counter:repairCounter})});
  assert.ok((await repair.customFormatsByTrashIds([movieId],'movie')).has(movieId));assert.equal(repairCounter.formats,60);

  const nextRevision='c'.repeat(40),refreshCounter={formats:0},refresh=new GuideTemplateService({store,fetcher:indexedFetcher({revisionValue:nextRevision,counter:refreshCounter})});
  await refresh.catalog({refresh:true});assert.equal((await store.read()).formatIndexes.movie,undefined);
  assert.ok((await refresh.customFormatsByTrashIds([movieId],'movie')).has(movieId));assert.equal(refreshCounter.formats,60);assert.equal((await store.read()).formatIndexes.movie.revision,nextRevision);
});
