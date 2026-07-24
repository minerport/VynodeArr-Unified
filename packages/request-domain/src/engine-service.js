import { readFile } from 'node:fs/promises';

const pause=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const trimBase=value=>String(value||'').replace(/^\/+|\/+$/g,'');

export class RequestEngineService{
  constructor({host='request-engine',port=5055,https=false,configPath='',fetchImpl=fetch}={}){
    this.origin=`${https?'https':'http'}://${host}:${port}`;
    this.configPath=configPath;
    this.fetch=fetchImpl;
  }
  async publicStatus(){
    try{
      const [status,settings]=await Promise.all([
        this.fetch(`${this.origin}/api/v1/status`).then(response=>response.ok?response.json():null),
        this.fetch(`${this.origin}/api/v1/settings/public`).then(response=>response.ok?response.json():null)
      ]);
      return{reachable:Boolean(status),authenticated:true,compatible:Boolean(status),status:{version:status?.version||'Unknown',branch:status?.commitTag||'stable',initialized:Boolean(settings?.initialized)},settings};
    }catch{return{reachable:false,authenticated:false,compatible:false,status:null,settings:null};}
  }
  async apiKey(){
    if(!this.configPath)return'';
    const settings=JSON.parse(await readFile(this.configPath,'utf8'));
    return String(settings?.main?.apiKey||'');
  }
  async request(path,{method='GET',body}={}){
    const apiKey=await this.apiKey();
    if(!apiKey)throw new Error('Request engine credential is not ready');
    const response=await this.fetch(`${this.origin}/api/v1${path}`,{
      method,headers:{'X-Api-Key':apiKey,...(body?{'content-type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined
    });
    if(!response.ok)throw new Error(`Request engine returned ${response.status}`);
    return response.status===204?null:response.json();
  }
  async ensureMediaServices({movie,tv,retries=1}={}){
    if(!this.configPath||!movie?.apiKey||!tv?.apiKey)return{configured:false,reason:'configuration unavailable'};
    for(let attempt=0;attempt<retries;attempt+=1){
      try{
        const result={configured:true,created:[]};
        for(const service of [
          {kind:'radarr',name:'VynodeArr Movies',engine:movie,minimumAvailability:'released'},
          {kind:'sonarr',name:'VynodeArr Television',engine:tv,seriesType:'standard',seasonFolder:true,monitorNewItems:'all'}
        ]){
          const existing=await this.request(`/settings/${service.kind}`);
          if(existing.some(item=>item.hostname===service.engine.host&&Number(item.port)===Number(service.engine.port)))continue;
          const engineOrigin=`${service.engine.https?'https':'http'}://${service.engine.host}:${service.engine.port}`;
          const headers={'X-Api-Key':service.engine.apiKey};
          const [profiles,roots]=await Promise.all([
            this.fetch(`${engineOrigin}/api/v3/qualityprofile`,{headers}).then(response=>response.ok?response.json():[]),
            this.fetch(`${engineOrigin}/api/v3/rootfolder`,{headers}).then(response=>response.ok?response.json():[])
          ]);
          if(!profiles.length||!roots.length)continue;
          const payload={
            name:service.name,hostname:service.engine.host,port:Number(service.engine.port),
            apiKey:service.engine.apiKey,useSsl:Boolean(service.engine.https),baseUrl:trimBase(service.engine.urlBase),
            activeProfileId:Number(profiles[0].id),activeProfileName:profiles[0].name,
            activeDirectory:roots[0].path,is4k:false,isDefault:true,syncEnabled:true,
            preventSearch:false,tagRequests:false,...(service.kind==='radarr'
              ?{minimumAvailability:service.minimumAvailability}
              :{seriesType:service.seriesType,seasonFolder:service.seasonFolder,monitorNewItems:service.monitorNewItems})
          };
          await this.request(`/settings/${service.kind}`,{method:'POST',body:payload});
          result.created.push(service.kind);
        }
        return result;
      }catch(error){
        if(attempt===retries-1)return{configured:false,reason:error.message};
        await pause(2000);
      }
    }
  }
}
