const sharedResources=Object.freeze({
  profiles:{path:'qualityprofile',methods:['GET','POST','PUT','DELETE']},
  rootFolders:{path:'rootfolder',methods:['GET','POST','DELETE']},
  tags:{path:'tag',methods:['GET','POST','PUT','DELETE']},
  customFormats:{path:'customformat',methods:['GET','POST','PUT','DELETE']},
  indexers:{path:'indexer',methods:['GET','POST','PUT','DELETE']},
  downloadClients:{path:'downloadclient',methods:['GET','POST','PUT','DELETE']},
  notifications:{path:'notification',methods:['GET','POST','PUT','DELETE']},
  importLists:{path:'importlist',methods:['GET','POST','PUT','DELETE']},
  naming:{path:'config/naming',methods:['GET','PUT']},
  mediaManagement:{path:'config/mediamanagement',methods:['GET','PUT']},
  qualityDefinitions:{path:'qualitydefinition',methods:['GET','PUT']},
  delayProfiles:{path:'delayprofile',methods:['GET','POST','PUT','DELETE']},
  restrictions:{path:'restriction',methods:['GET','POST','PUT','DELETE']},
  commands:{path:'command',methods:['GET','POST']},
  queue:{path:'queue',methods:['GET','DELETE']}
});

const domainResources=Object.freeze({
  movie:{
    library:{path:'movie',methods:['GET','POST','PUT','DELETE']},
    lookup:{path:'movie/lookup',methods:['GET']},
    exclusions:{path:'exclusions',methods:['GET','POST','DELETE']},
    collections:{path:'collection',methods:['GET','PUT']},
    manualImport:{path:'manualimport',methods:['GET','POST']}
  },
  tv:{
    library:{path:'series',methods:['GET','POST','PUT','DELETE']},
    lookup:{path:'series/lookup',methods:['GET']},
    episodes:{path:'episode',methods:['GET','PUT']},
    episodeFiles:{path:'episodefile',methods:['GET','DELETE']},
    manualImport:{path:'manualimport',methods:['GET','POST']}
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
    if((method==='PUT'||method==='DELETE')&&!id&&resource!=='naming'&&resource!=='mediaManagement')throw new Error('A resource identifier is required');
    const path=id?`${definition.path}/${encodeURIComponent(String(id))}`:definition.path;
    const client=this.registry.get(domain).client;
    if(!client)throw new Error('The connected engine does not support management');
    if(method==='GET')return client.get(path,cleanQuery(query));
    if(method==='POST')return client.post(path,payload,cleanQuery(query));
    if(method==='PUT')return client.put(path,payload,cleanQuery(query));
    return client.delete(path,cleanQuery(query));
  }
}
