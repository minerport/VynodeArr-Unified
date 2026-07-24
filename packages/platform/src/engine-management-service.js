const sharedResources=Object.freeze({
  profiles:{path:'qualityprofile',methods:['GET','POST','PUT','DELETE']},
  profileSchema:{path:'qualityprofile/schema',methods:['GET']},
  rootFolders:{path:'rootfolder',methods:['GET','POST','DELETE']},
  tags:{path:'tag',methods:['GET','POST','PUT','DELETE']},
  customFormats:{path:'customformat',methods:['GET','POST','PUT','DELETE']},
  indexers:{path:'indexer',methods:['GET','POST','PUT','DELETE']},
  downloadClients:{path:'downloadclient',methods:['GET','POST','PUT','DELETE']},
  notifications:{path:'notification',methods:['GET','POST','PUT','DELETE']},
  importLists:{path:'importlist',methods:['GET','POST','PUT','DELETE']},
  naming:{path:'config/naming',methods:['GET','PUT']},
  mediaManagement:{path:'config/mediamanagement',methods:['GET','PUT']},
  downloadClientSettings:{path:'config/downloadclient',methods:['GET','PUT']},
  qualityDefinitions:{path:'qualitydefinition',methods:['GET','PUT']},
  delayProfiles:{path:'delayprofile',methods:['GET','POST','PUT','DELETE']},
  restrictions:{path:'restriction',methods:['GET','POST','PUT','DELETE']},
  commands:{path:'command',methods:['GET','POST']},
  calendar:{path:'calendar',methods:['GET']},
  queue:{path:'queue',methods:['GET','DELETE']},
  queueGrab:{path:'queue/grab',methods:['POST']},
  history:{path:'history',methods:['GET']},
  blocklist:{path:'blocklist',methods:['GET','DELETE']},
  wantedMissing:{path:'wanted/missing',methods:['GET']},
  wantedCutoff:{path:'wanted/cutoff',methods:['GET']},
  releases:{path:'release',methods:['GET','POST']},
  manualImport:{path:'manualimport',methods:['GET','POST']},
  renamePreview:{path:'rename',methods:['GET']},
  filesystem:{path:'filesystem',methods:['GET']},
  remotePathMappings:{path:'remotepathmapping',methods:['GET','POST','PUT','DELETE']},
  metadata:{path:'metadata',methods:['GET','POST','PUT','DELETE']},
  hostSettings:{path:'config/host',methods:['GET','PUT']},
  uiSettings:{path:'config/ui',methods:['GET','PUT']},
  indexerSchemas:{path:'indexer/schema',methods:['GET']},
  downloadClientSchemas:{path:'downloadclient/schema',methods:['GET']},
  notificationSchemas:{path:'notification/schema',methods:['GET']},
  importListSchemas:{path:'importlist/schema',methods:['GET']},
  metadataSchemas:{path:'metadata/schema',methods:['GET']},
  diskSpace:{path:'diskspace',methods:['GET']},
  tasks:{path:'system/task',methods:['GET']},
  backups:{path:'system/backup',methods:['GET','POST','DELETE']},
  updates:{path:'update',methods:['GET']},
  events:{path:'log',methods:['GET']},
  logFiles:{path:'log/file',methods:['GET']}
});

const domainResources=Object.freeze({
  movie:{
    library:{path:'movie',methods:['GET','POST','PUT','DELETE']},
    libraryEditor:{path:'movie/editor',methods:['PUT','DELETE']},
    lookup:{path:'movie/lookup',methods:['GET']},
    exclusions:{path:'exclusions',methods:['GET','POST','DELETE']},
    collections:{path:'collection',methods:['GET','PUT']},
    movieFiles:{path:'moviefile',methods:['GET','PUT','DELETE']},
    importExclusions:{path:'importlistexclusion',methods:['GET','POST','PUT','DELETE']}
  },
  tv:{
    library:{path:'series',methods:['GET','POST','PUT','DELETE']},
    libraryEditor:{path:'series/editor',methods:['PUT','DELETE']},
    lookup:{path:'series/lookup',methods:['GET']},
    episodes:{path:'episode',methods:['GET','PUT']},
    episodeFiles:{path:'episodefile',methods:['GET','DELETE']},
    seasonPass:{path:'seasonpass',methods:['POST']},
    parse:{path:'parse',methods:['GET']},
    statistics:{path:'statistics',methods:['GET']},
    releaseProfiles:{path:'releaseprofile',methods:['GET','POST','PUT','DELETE']},
    metadataSource:{path:'config/metadatasource',methods:['GET','PUT']}
  }
});

const cleanQuery=(query={})=>Object.fromEntries(Object.entries(query).filter(([,value])=>value!==''&&value!=null));

export class EngineManagementService {
  constructor(registry){this.registry=registry;}
  available(domain){return Boolean(this.registry.get(domain)?.client);}
  catalog(domain){
    if(!domainResources[domain])throw new Error('Unsupported media domain');
    return Object.entries({...sharedResources,...domainResources[domain]}).map(([key,value])=>({key,methods:value.methods}));
  }
  async execute(domain,resource,method,{id,query,payload}={}){
    const definition={...sharedResources,...domainResources[domain]}[resource];
    if(!definition||!definition.methods.includes(method))throw new Error('This management operation is not available');
    const singleton=['naming','mediaManagement','downloadClientSettings','hostSettings','uiSettings','metadataSource','libraryEditor'];
    if((method==='PUT'||method==='DELETE')&&!id&&!singleton.includes(resource))throw new Error('A resource identifier is required');
    const path=id?`${definition.path}/${encodeURIComponent(String(id))}`:definition.path;
    const client=this.registry.get(domain).client;
    if(!client)throw new Error('The connected engine does not support management');
    if(method==='GET')return client.get(path,cleanQuery(query));
    if(method==='POST')return client.post(path,payload,cleanQuery(query));
    if(method==='PUT')return client.put(path,payload,cleanQuery(query));
    return client.delete(path,cleanQuery(query),payload);
  }
}
