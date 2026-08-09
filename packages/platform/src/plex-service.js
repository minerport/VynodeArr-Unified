const cleanEndpoint=value=>{
  const input=String(value||'').trim();
  if(!input)throw new Error('Plex server URL is required');
  let parsed;try{parsed=new URL(input);}catch{throw new Error('Enter a valid Plex server URL');}
  if(!['http:','https:'].includes(parsed.protocol))throw new Error('Plex server URL must use HTTP or HTTPS');
  if(parsed.username||parsed.password)throw new Error('Do not include credentials in the Plex server URL');
  parsed.pathname='';parsed.search='';parsed.hash='';return parsed.toString().replace(/\/$/,'');
};
const xmlAttribute=(value,name)=>String(value||'').match(new RegExp(`\\b${name}="([^"]*)"`,'i'))?.[1]||'';
const decodeXml=value=>String(value||'').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const externalId=value=>{
  const input=String(value||'').trim(),modern=input.match(/^(tmdb|tvdb|imdb):\/\/([^?/#]+)/i);if(modern)return`${modern[1].toLowerCase()}:${modern[2].toLowerCase()}`;
  const legacy=input.match(/^com\.plexapp\.agents\.(themoviedb|thetvdb|imdb):\/\/([^?/#]+)/i);if(!legacy)return'';const source={themoviedb:'tmdb',thetvdb:'tvdb',imdb:'imdb'}[legacy[1].toLowerCase()];return`${source}:${legacy[2].toLowerCase()}`;
};
const itemExternalIds=item=>{
  const values=[];for(const [field,prefix]of [['tmdbId','tmdb'],['tvdbId','tvdb'],['imdbId','imdb']])if(item?.[field])values.push(`${prefix}:${String(item[field]).toLowerCase()}`);
  for(const value of [item?.guid,...(item?.guids||item?.Guid||[])]){const id=externalId(value?.id||value);if(id)values.push(id);}return[...new Set(values)];
};
const plexAddedAt=value=>{const raw=value?.addedAt??xmlAttribute(value,'addedAt'),numeric=Number(raw);if(Number.isFinite(numeric)&&numeric>0)return numeric;const date=new Date(raw||'');return Number.isFinite(date.getTime())?date.toISOString():null;};
const plexMetadata=(response,libraryType)=>{
  const metadataValue=response.value?.MediaContainer?.Metadata,metadata=response.type==='json'?(Array.isArray(metadataValue)?metadataValue:metadataValue?[metadataValue]:[]):[...String(response.value).matchAll(/<(?:Video|Directory)\b[^>]*(?:\/>|>[\s\S]*?<\/(?:Video|Directory)>)/gi)].map(match=>match[0]);
  return metadata.map(item=>({ratingKey:String(item.ratingKey??xmlAttribute(item,'ratingKey')),title:decodeXml(item.title??xmlAttribute(item,'title')),year:Number(item.year??xmlAttribute(item,'year'))||null,type:String((item.type??xmlAttribute(item,'type'))||libraryType),thumb:String(item.thumb??xmlAttribute(item,'thumb')),addedAt:plexAddedAt(item),guid:String(item.guid??xmlAttribute(item,'guid')),guids:item.Guid||[...String(item).matchAll(/<Guid\b[^>]*id="([^"]+)"[^>]*\/>/gi)].map(match=>({id:decodeXml(match[1])})),files:[...new Set((response.type==='json'?(Array.isArray(item.Media)?item.Media:item.Media?[item.Media]:[]).flatMap(media=>(Array.isArray(media.Part)?media.Part:media.Part?[media.Part]:[]).map(part=>part.file)):[...String(item).matchAll(/<Part\b[^>]*\bfile="([^"]+)"/gi)].map(match=>decodeXml(match[1]))).filter(Boolean).map(String))]})).filter(item=>item.ratingKey);
};

export class PlexService{
  constructor({fetchImpl=fetch,timeoutMs=10000}={}){this.fetch=fetchImpl;this.timeoutMs=timeoutMs;}
  async request(endpoint,token,path){
    const response=await this.fetch(`${cleanEndpoint(endpoint)}${path}`,{headers:{accept:'application/json','x-plex-token':String(token||'')},signal:AbortSignal.timeout(this.timeoutMs)});
    if(response.status===401)throw new Error('Plex rejected the access token');
    if(!response.ok)throw new Error(`Plex returned HTTP ${response.status}`);
    const text=await response.text();
    try{return{type:'json',value:JSON.parse(text)}}catch{return{type:'xml',value:text}}
  }
  async command(endpoint,token,path,{method='POST'}={}){
    const response=await this.fetch(`${cleanEndpoint(endpoint)}${path}`,{method,headers:{accept:'application/json','x-plex-token':String(token||'')},signal:AbortSignal.timeout(this.timeoutMs)});
    if(response.status===401)throw new Error('Plex rejected the access token');
    if(!response.ok)throw new Error(`Plex returned HTTP ${response.status}`);
    const text=await response.text();let value=null;try{value=text?JSON.parse(text):null}catch{value=text}return{value,location:response.headers.get('location')||''};
  }
  async inspect(endpoint,token){
    if(!String(token||'').trim())throw new Error('Plex access token is required');
    const [identity,sections]=await Promise.all([this.request(endpoint,token,'/identity'),this.request(endpoint,token,'/library/sections')]);
    const identityContainer=identity.type==='json'?(identity.value.MediaContainer||identity.value):null;
    const server={
      name:String(identityContainer?.friendlyName||identityContainer?.machineIdentifier||xmlAttribute(identity.value,'machineIdentifier')||'Plex Media Server'),
      machineIdentifier:String(identityContainer?.machineIdentifier||xmlAttribute(identity.value,'machineIdentifier')),
      version:String(identityContainer?.version||xmlAttribute(identity.value,'version')),
    };
    if(!server.machineIdentifier)throw new Error('The endpoint did not identify itself as a Plex Media Server');
    const directoryValue=sections.value?.MediaContainer?.Directory,directories=sections.type==='json'?(Array.isArray(directoryValue)?directoryValue:directoryValue?[directoryValue]:[]):[...String(sections.value).matchAll(/<Directory\b[^>]*(?:\/>|>[\s\S]*?<\/Directory>)/gi)].map(match=>match[0]);
    const libraries=directories.map(item=>({
      key:String(item.key??xmlAttribute(item,'key')),
      title:decodeXml(item.title??xmlAttribute(item,'title')),
      type:String(item.type??xmlAttribute(item,'type')),
      uuid:String(item.uuid??xmlAttribute(item,'uuid')),
      locations:[...new Set((sections.type==='json'?(Array.isArray(item.Location)?item.Location:item.Location?[item.Location]:[]).map(location=>location?.path):[...String(item).matchAll(/<Location\b[^>]*\bpath="([^"]+)"[^>]*\/>/gi)].map(match=>decodeXml(match[1]))).filter(Boolean).map(String))],
    })).filter(item=>item.key&&['movie','show'].includes(item.type));
    return{endpoint:cleanEndpoint(endpoint),server,libraries};
  }
  async libraryItems(endpoint,token,library){
    const response=await this.request(endpoint,token,`/library/sections/${encodeURIComponent(library.key)}/all?includeGuids=1`),items=plexMetadata(response,library.type).slice(0,20000),missing=items.filter(item=>itemExternalIds(item).length===0);
    for(let offset=0;offset<missing.length;offset+=100){const batch=missing.slice(offset,offset+100),ids=batch.map(item=>item.ratingKey).join(','),details=await this.request(endpoint,token,`/library/metadata/${ids}?includeGuids=1`).then(value=>plexMetadata(value,library.type)).catch(()=>[]),byKey=new Map(details.map(item=>[item.ratingKey,item]));for(const item of batch){const detail=byKey.get(item.ratingKey);if(detail){item.guid=detail.guid;item.guids=detail.guids;item.thumb=item.thumb||detail.thumb;item.files=item.files?.length?item.files:detail.files||[];}}}
    return items;
  }
  async artwork(endpoint,token,path){
    const value=String(path||'');if(!/^\/library\/metadata\/\d+\/thumb(?:\/\d+)?$/i.test(value)&&!/^\/library\/metadata\/\d+\/art(?:\/\d+)?$/i.test(value))throw new Error('Plex artwork path is invalid');
    const response=await this.fetch(`${cleanEndpoint(endpoint)}${value}`,{headers:{accept:'image/*','x-plex-token':String(token||'')},signal:AbortSignal.timeout(this.timeoutMs)});if(response.status===401)throw new Error('Plex rejected the access token');if(!response.ok)throw new Error(`Plex artwork returned HTTP ${response.status}`);const contentType=String(response.headers.get('content-type')||'');if(!contentType.startsWith('image/'))throw new Error('Plex returned an invalid artwork response');const body=Buffer.from(await response.arrayBuffer());if(!body.length||body.length>20_000_000)throw new Error('Plex artwork is empty or too large');return{body,contentType};
  }
  async uploadPoster(endpoint,token,ratingKey,body,contentType){
    if(!/^\d+$/.test(String(ratingKey||'')))throw new Error('Plex poster target is invalid');
    if(!Buffer.isBuffer(body)||!body.length||body.length>20_000_000)throw new Error('Plex poster data is empty or too large');
    if(!['image/jpeg','image/png'].includes(String(contentType||'').toLowerCase()))throw new Error('Plex poster upload must be JPEG or PNG');
    const response=await this.fetch(`${cleanEndpoint(endpoint)}/library/metadata/${ratingKey}/posters`,{method:'POST',headers:{accept:'application/json','content-type':contentType,'content-length':String(body.length),'x-plex-token':String(token||'')},body,signal:AbortSignal.timeout(this.timeoutMs)});
    if(response.status===401)throw new Error('Plex rejected the access token');
    if(!response.ok)throw new Error(`Plex poster upload returned HTTP ${response.status}`);
    return true;
  }
  async refreshLibrary(endpoint,token,libraryKey){if(!/^\d+$/.test(String(libraryKey||'')))throw new Error('Plex library target is invalid');await this.command(endpoint,token,`/library/sections/${libraryKey}/refresh`,{method:'GET'});return true;}
  async libraryCollections(endpoint,token,libraryKey){if(!/^\d+$/.test(String(libraryKey||'')))throw new Error('Plex library target is invalid');const response=await this.request(endpoint,token,`/library/sections/${libraryKey}/collections`),metadata=response.value?.MediaContainer?.Metadata,items=response.type==='json'?(Array.isArray(metadata)?metadata:metadata?[metadata]:[]):[...String(response.value).matchAll(/<Directory\b[^>]*(?:\/>|>[\s\S]*?<\/Directory>)/gi)].map(match=>match[0]);return items.map(item=>({ratingKey:String(item.ratingKey??xmlAttribute(item,'ratingKey')),title:decodeXml(item.title??xmlAttribute(item,'title'))})).filter(item=>item.ratingKey);}
  async syncCollection(endpoint,token,{libraryKey,libraryType,machineIdentifier,title,ratingKeys}){if(!/^\d+$/.test(String(libraryKey||''))||!String(machineIdentifier||'').trim())throw new Error('Plex collection target is incomplete');const name=String(title||'').trim().slice(0,120);if(!name)throw new Error('Plex collection name is required');const existing=(await this.libraryCollections(endpoint,token,libraryKey)).filter(item=>item.title.toLowerCase()===name.toLowerCase());for(const item of existing)await this.command(endpoint,token,`/library/metadata/${encodeURIComponent(item.ratingKey)}`,{method:'DELETE'});const ids=[...new Set((ratingKeys||[]).map(String).filter(value=>/^\d+$/.test(value)))];if(!ids.length)return{ratingKey:null,title:name,itemCount:0};const query=new URLSearchParams({type:libraryType==='show'?'2':'1',title:name,smart:'0',sectionId:String(libraryKey),uri:`server://${machineIdentifier}/com.plexapp.plugins.library/library/metadata/${ids.join(',')}`});const created=await this.command(endpoint,token,`/library/collections?${query}`,{method:'POST'}),ratingKey=String(created.value?.MediaContainer?.Metadata?.[0]?.ratingKey||created.value?.MediaContainer?.Metadata?.ratingKey||created.location.match(/\/library\/metadata\/(\d+)/)?.[1]||'')||null;return{ratingKey,title:name,itemCount:ids.length};}
  match(vynodeItems,plexItems){
    const index=new Map();for(const item of plexItems)for(const id of itemExternalIds(item)){const values=index.get(id)||[];values.push(item);index.set(id,values);}
    return vynodeItems.map(item=>{const ids=itemExternalIds(item),matches=[...new Map(ids.flatMap(id=>index.get(id)||[]).map(value=>[value.ratingKey,value])).values()];return{domain:item.domain,id:item.id,title:item.title,year:item.year||null,externalIds:ids,status:!ids.length?'unmatched':matches.length===1?'matched':matches.length>1?'ambiguous':'unmatched',plex:matches.map(value=>({ratingKey:value.ratingKey,title:value.title,year:value.year,type:value.type,thumb:value.thumb,addedAt:value.addedAt}))};});
  }
  matchLibrary(vynodeItems,plexItems){
    const index=new Map();for(const item of vynodeItems)for(const id of itemExternalIds(item)){const values=index.get(id)||[];values.push(item);index.set(id,values);}
    return plexItems.map(plex=>{const ids=itemExternalIds(plex),matches=[...new Map(ids.flatMap(id=>index.get(id)||[]).map(value=>[value.id,value])).values()],item=matches[0];return{domain:item?.domain||(plex.type==='show'?'tv':'movie'),id:item?.id||`plex_${plex.ratingKey}`,title:item?.title||plex.title,year:item?.year||plex.year||null,externalIds:ids,status:!ids.length||!matches.length?'unmatched':matches.length===1?'matched':'ambiguous',candidateCount:matches.length,plex:[{ratingKey:plex.ratingKey,title:plex.title,year:plex.year,type:plex.type,thumb:plex.thumb,addedAt:plex.addedAt}]};});
  }
}

export {cleanEndpoint as sanitizePlexEndpoint,itemExternalIds as plexExternalIds};
