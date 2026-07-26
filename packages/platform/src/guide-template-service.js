import { createHash } from 'node:crypto';

const repository='TRaSH-Guides/Guides';
const branch='master';
const guideKeys={movie:['ra','darr'].join(''),tv:['so','narr'].join('')};
const templateFamilies=Object.entries(guideKeys).flatMap(([domain,key])=>[
  {prefix:`${domain}--cf--`,domain,resourceType:'customFormat',path:`docs/json/${key}/cf/`,label:'Custom formats'},
  {prefix:`${domain}--profile--`,domain,resourceType:'qualityProfile',path:`docs/json/${key}/quality-profiles/`,label:'Quality profiles'},
  {prefix:`${domain}--size--`,domain,resourceType:'qualitySize',path:`docs/json/${key}/quality-size/`,label:'Quality size'},
  {prefix:`${domain}--group--`,domain,resourceType:'customFormatGroup',path:`docs/json/${key}/cf-groups/`,label:'Custom format groups'},
  {prefix:`${domain}--naming--`,domain,resourceType:'naming',path:`docs/json/${key}/naming/`,label:'Naming'}
]);
const githubApi='https://api.github.com';
const rawGithub='https://raw.githubusercontent.com';
const userAgent='VynodeArr-Guide-Templates';

const purposes=[
  {id:'unwanted',label:'Block unwanted releases',description:'Disc images, low-quality releases, unwanted codecs, editions, and release groups.',pattern:/\b(?:br-disk|lq|unwanted|bad|3d|extras|av1|generated|x265-hd|upscaled)\b/i},
  {id:'hdr',label:'HDR and Dolby Vision',description:'Prefer, require, or avoid HDR, Dolby Vision, HDR10+, and related fallback behavior.',pattern:/\b(?:hdr|dolby-vision|dv|pq|hlg)\b/i},
  {id:'audio',label:'Audio formats',description:'Audio codecs, channels, immersive audio, and lossless or lossy preferences.',pattern:/\b(?:atmos|truehd|dts|aac|flac|opus|sound|surround|stereo|mono|audio)\b/i},
  {id:'streaming',label:'Streaming services',description:'Recognize and rank releases from streaming services.',pattern:/\b(?:amzn|amazon|atvp|apple|crav|disney|dsnp|hmax|hulu|max|nf|netflix|pcok|peacock|paramount|web-tier)\b/i},
  {id:'anime',label:'Anime',description:'Anime release groups, versions, dual audio, and anime-specific characteristics.',pattern:/\banime\b/i},
  {id:'language',label:'Languages',description:'Original-language, multilingual, dubbed, and regional-language preferences.',pattern:/\b(?:language|french|german|italian|spanish|dutch|portuguese|multi|dub|vostfr|vof|vf)\b/i},
  {id:'release-groups',label:'Release groups',description:'Prefer or avoid ranked release groups for WEB, Blu-ray, Remux, and regional releases.',pattern:/\b(?:tier|group|scene|p2p)\b/i},
  {id:'quality',label:'Quality and source',description:'Resolution, source, remux, repack, proper, and quality-related matching.',pattern:/\b(?:2160p|1080p|720p|bluray|remux|web|webrip|webdl|hdtv|repack|proper|resolution)\b/i},
  {id:'codec',label:'Video codecs',description:'Video codec, bit depth, and encoding preferences.',pattern:/\b(?:x264|x265|h264|h265|hevc|av1|10bit|codec)\b/i},
  {id:'editions',label:'Editions and versions',description:'IMAX, theatrical, remastered, special editions, and release versions.',pattern:/\b(?:imax|edition|remaster|theatrical|open-matte|hybrid|version)\b/i}
];

const titleFromPath=(path,family)=>path.slice(family.path.length,-5).split('-').map(word=>word.length<=3&&/\d/.test(word)?word.toUpperCase():word.charAt(0).toUpperCase()+word.slice(1)).join(' ');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const purposeFor=path=>purposes.find(item=>item.pattern.test(path))?.id||'other';
const familyFor=path=>templateFamilies.find(family=>path.startsWith(family.path));
const slugFrom=(path,family)=>path.slice(family.path.length,-5);
const fieldValues=fields=>{
  if(Array.isArray(fields))return Object.fromEntries(fields.filter(field=>field&&typeof field.name==='string').map(field=>[field.name,field.value]));
  return fields&&typeof fields==='object'?fields:{};
};
const cleanFormat=value=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('The upstream custom format is invalid.');
  if(!/^[a-f0-9]{32}$/i.test(String(value.trash_id||'')))throw new Error('The upstream custom format does not contain a valid TRaSH ID.');
  if(typeof value.name!=='string'||!value.name.trim()||!Array.isArray(value.specifications))throw new Error('The upstream custom format is missing required movie-engine fields.');
  return{name:value.name.trim(),includeCustomFormatWhenRenaming:Boolean(value.includeCustomFormatWhenRenaming),specifications:value.specifications.map(specification=>({...specification,fields:fieldValues(specification.fields)}))};
};
export const formatForMovieEngine=(format,schemas=[])=>({
  ...format,
  specifications:format.specifications.map(specification=>{
    const schema=schemas.find(item=>item.implementation===specification.implementation);
    if(!schema)throw new Error(`The movie engine does not support the ${specification.implementation||specification.name||'requested'} template condition.`);
    const values=fieldValues(specification.fields);
    return{
      ...schema,
      name:specification.name,
      negate:Boolean(specification.negate),
      required:Boolean(specification.required),
      fields:(schema.fields||[]).map(field=>Object.prototype.hasOwnProperty.call(values,field.name)?{...field,value:values[field.name]}:{...field})
    };
  })
});
const requestJson=async(fetcher,url)=>{
  const response=await fetcher(url,{headers:{accept:'application/vnd.github+json','user-agent':userAgent,'x-github-api-version':'2022-11-28'},signal:AbortSignal.timeout(15_000)});
  if(!response.ok)throw new Error(`TRaSH Guides could not be reached (${response.status}).`);
  return response.json();
};

export class GuideTemplateService{
  constructor({store,fetcher=globalThis.fetch,cacheTtlMs=21_600_000}={}){
    if(!store)throw new Error('Guide template storage is required');
    if(typeof fetcher!=='function')throw new Error('Guide template network access is unavailable');
    this.store=store;this.fetcher=fetcher;this.cacheTtlMs=cacheTtlMs;this.catalogRun=null;this.formatIndexRuns=new Map();
  }
  async state(){return this.store.read();}
  async catalog({refresh=false}={}){
    const stored=await this.state(),cached=stored.catalog;
    if(!refresh&&cached&&cached.coordination?.movie&&cached.coordination?.tv&&cached.templates?.every(item=>item.resourceType&&item.domain)&&Date.now()-new Date(cached.fetchedAt).getTime()<this.cacheTtlMs)return{...cached,purposes:[...purposes,{id:'other',label:'Other formats',description:'Additional specialized matching templates.'}],cached:true};
    if(!this.catalogRun)this.catalogRun=this.pullCatalog().finally(()=>{this.catalogRun=null;});
    return this.catalogRun;
  }
  async pullCatalog(){
    const branchValue=await requestJson(this.fetcher,`${githubApi}/repos/${repository}/branches/${branch}`);
    const revision=String(branchValue?.commit?.sha||'');
    if(!/^[a-f0-9]{40}$/i.test(revision))throw new Error('TRaSH Guides returned an invalid catalog revision.');
    const tree=await requestJson(this.fetcher,`${githubApi}/repos/${repository}/git/trees/${revision}?recursive=1`);
    if(tree?.truncated)throw new Error('TRaSH Guides returned an incomplete catalog.');
    const templates=(tree?.tree||[]).filter(item=>item.type==='blob'&&item.path.endsWith('.json')&&familyFor(item.path)).map(item=>{
      const family=familyFor(item.path),slug=slugFrom(item.path,family);
      return{id:`${family.prefix}${slug}`,domain:family.domain,title:family.resourceType==='customFormat'?titleFromPath(item.path,family):slug.split('-').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' '),purpose:family.resourceType==='customFormat'?purposeFor(item.path):family.resourceType,resourceType:family.resourceType,familyLabel:family.label,path:item.path,blob:String(item.sha||''),url:`https://github.com/${repository}/blob/${revision}/${item.path}`};
    }).sort((left,right)=>left.familyLabel.localeCompare(right.familyLabel)||left.title.localeCompare(right.title));
    for(const domain of Object.keys(guideKeys))if(templates.filter(item=>item.domain===domain&&item.resourceType==='customFormat').length<50)throw new Error(`TRaSH Guides returned an unexpectedly small ${domain==='movie'?'movie':'television'} template catalog.`);
    const coordination={};
    for(const [domain,key] of Object.entries(guideKeys)){
      const [conflicts,profileGroups]=await Promise.all([
        requestJson(this.fetcher,`${rawGithub}/${repository}/${revision}/docs/json/${key}/conflicts.json`),
        requestJson(this.fetcher,`${rawGithub}/${repository}/${revision}/docs/json/${key}/quality-profile-groups/groups.json`)
      ]);
      coordination[domain]={conflicts:conflicts.custom_formats||[],profileGroups:Array.isArray(profileGroups)?profileGroups:[]};
    }
    const catalog={provider:'TRaSH Guides',repository,revision,fetchedAt:new Date().toISOString(),templates,coordination};
    const stored=await this.state();await this.store.write({...stored,version:1,catalog});
    return{...catalog,purposes:[...purposes,{id:'other',label:'Other formats',description:'Additional specialized matching templates.'}],cached:false};
  }
  async template(id){
    if(!/^[a-z0-9][a-z0-9-]*$/i.test(String(id||'')))throw new Error('Choose a valid guide template.');
    const catalog=await this.catalog(),entry=catalog.templates.find(item=>item.id===id);
    if(!entry)throw new Error('That guide template is no longer available.');
    const value=await requestJson(this.fetcher,`${rawGithub}/${repository}/${catalog.revision}/${entry.path}`);
    if(entry.resourceType==='customFormat'){
      const format=cleanFormat(value),trashId=String(value.trash_id).toLowerCase();
      return{...entry,trashId,format,scores:value.trash_scores||{},contentHash:hash(format),revision:catalog.revision,provider:catalog.provider};
    }
    const trashId=/^[a-f0-9]{32}$/i.test(String(value?.trash_id||''))?String(value.trash_id).toLowerCase():hash({path:entry.path}).slice(0,32);
    return{...entry,trashId,template:value,contentHash:hash(value),revision:catalog.revision,provider:catalog.provider};
  }
  async customFormatsByTrashIds(ids=[],domain='movie'){
    const wanted=new Set(ids.map(value=>String(value).toLowerCase()));
    if(!this.formatIndexRuns.has(domain))this.formatIndexRuns.set(domain,(async()=>{
      const catalog=await this.catalog(),entries=catalog.templates.filter(item=>item.domain===domain&&item.resourceType==='customFormat');
      const pairs=[];
      for(let index=0;index<entries.length;index+=24){
        const batch=await Promise.all(entries.slice(index,index+24).map(async entry=>{
          const value=await requestJson(this.fetcher,`${rawGithub}/${repository}/${catalog.revision}/${entry.path}`);
          return[String(value.trash_id||'').toLowerCase(),{entry,value}];
        }));
        pairs.push(...batch);
      }
      return new Map(pairs);
    })().finally(()=>{setTimeout(()=>{this.formatIndexRuns.delete(domain);},this.cacheTtlMs).unref?.();}));
    const index=await this.formatIndexRuns.get(domain),result=new Map();
    for(const id of wanted){const found=index.get(id);if(found){const format=cleanFormat(found.value);result.set(id,{...found.entry,trashId:id,format,scores:found.value.trash_scores||{}});}}
    return result;
  }
  async comparison(template,configured=[]){
    const domain=template.domain||'movie',stored=await this.state(),record=stored.records?.[`${domain}:${template.trashId}`]||stored.records?.[template.trashId],recordId=record?.engineId||record?.radarrId,byId=recordId?configured.find(item=>String(item.id)===String(recordId)):null;
    const byName=configured.find(item=>String(item.name||'').toLowerCase()===template.format.name.toLowerCase()),existing=byId||byName||null;
    const existingFormat=existing?cleanFormat({...existing,trash_id:template.trashId}):null;
    const status=!existing?'new':hash(existingFormat)===template.contentHash?'matches':record?'modified':'conflict';
    return{status,existing,record:record||null,sourceOfTruth:`${domain}-engine`,observedAt:new Date().toISOString()};
  }
  async recordDecision(template,{decision,engineId=null,radarrId=null,username=null}={}){
    if(!['implemented','rejected'].includes(decision))throw new Error('Choose whether to implement or reject this template.');
    const stored=await this.state(),records={...(stored.records||{})};
    const domain=template.domain||'movie',key=`${domain}:${template.trashId}`,resolvedId=engineId??radarrId;
    records[key]={trashId:template.trashId,templateId:template.id,domain,name:template.format?.name||template.template?.name||template.title,resourceType:template.resourceType,decision,engineId:resolvedId,revision:template.revision,contentHash:template.contentHash,decidedAt:new Date().toISOString(),decidedBy:username};
    await this.store.write({...stored,version:1,records});
    return records[key];
  }
}
