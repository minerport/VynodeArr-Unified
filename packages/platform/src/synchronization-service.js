export class SynchronizationService {
  constructor({movie,tv,maxItems=5000,pollIntervalMs=300000,projectionStore=null}) {
    this.engines={movie,tv};this.maxItems=maxItems;this.pollIntervalMs=pollIntervalMs;this.projectionStore=projectionStore;
    this.domainRuns=new Map();this.itemRuns=new Map();this.startupRun=null;this.fullSyncListeners=new Set();
    this.cache=new Map();this.state={
      movie:{status:'idle',lastSuccess:null,lastFullSync:null,lastTargetedSync:null,lastFailure:null,durationMs:null,itemCount:0,itemsUpdated:0,source:'empty'},
      tv:{status:'idle',lastSuccess:null,lastFullSync:null,lastTargetedSync:null,lastFailure:null,durationMs:null,itemCount:0,itemsUpdated:0,source:'empty'}
    };
  }
  setEngines(movie,tv){this.engines={movie,tv};this.invalidate();}
  async hydrate(){
    if(!this.projectionStore)return;
    const projection=await this.projectionStore.load();
    for(const domain of ['movie','tv']){const items=projection.domains?.[domain]||[];if(items.length){this.cache.set(domain,{items,cachedAt:projection.updatedAt||new Date().toISOString(),durable:true});Object.assign(this.state[domain],{status:'ready',itemCount:items.length,source:'durable-projection',projectionUpdatedAt:projection.updatedAt||null});}}
  }
  async synchronize(domain){
    if(this.domainRuns.has(domain))return this.domainRuns.get(domain);
    const pending=[...this.itemRuns.entries()].filter(([key])=>key.startsWith(`${domain}:`)).map(([,run])=>run);
    if(pending.length){await Promise.allSettled(pending);if(this.domainRuns.has(domain))return this.domainRuns.get(domain);}
    const run=this.runDomainSynchronization(domain);this.domainRuns.set(domain,run);
    try{return await run;}finally{if(this.domainRuns.get(domain)===run)this.domainRuns.delete(domain);}
  }
  async runDomainSynchronization(domain){
    const started=Date.now();this.state[domain].status='synchronizing';
    try{
      const items=domain==='movie'?await this.engines.movie.listMovies({limit:this.maxItems}):await this.engines.tv.listSeries({limit:this.maxItems});
      const bounded=items.slice(0,this.maxItems);const projection=this.projectionStore?await this.projectionStore.replaceDomain(domain,bounded):{updated:bounded.length,total:bounded.length};
      this.cache.set(domain,{items:bounded,cachedAt:new Date().toISOString()});
      const completedAt=new Date().toISOString();Object.assign(this.state[domain],{status:'ready',lastSuccess:completedAt,lastFullSync:completedAt,lastFailure:null,safeError:null,durationMs:Date.now()-started,itemCount:bounded.length,itemsUpdated:projection.updated,itemsRemoved:projection.removed||0,source:'full-reconciliation'});
      for(const listener of this.fullSyncListeners)try{listener({domain,itemsUpdated:projection.updated,itemsRemoved:projection.removed||0,itemCount:bounded.length,updatedAt:completedAt});}catch{}
      return bounded;
    }catch(error){
      Object.assign(this.state[domain],{status:this.cache.has(domain)?'stale':'unavailable',lastFailure:new Date().toISOString(),safeError:error.safeMessage||`${domain==='movie'?'Movie':'TV'} service unavailable`,durationMs:Date.now()-started,itemsUpdated:0});
      if(this.cache.has(domain))return this.cache.get(domain).items;throw error;
    }
  }
  async synchronizeOperations(){
    const settled=await Promise.allSettled([
      Promise.all([this.engines.movie.getQueue(),this.engines.tv.getQueue()]).then((parts)=>parts.flat()),
      Promise.all([this.engines.movie.getHistory(),this.engines.tv.getHistory()]).then((parts)=>parts.flat().sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)))),
      Promise.all([this.engines.movie.getCalendar(),this.engines.tv.getCalendar()]).then((parts)=>parts.flat().sort((a,b)=>String(a.dateUtc).localeCompare(String(b.dateUtc)))),
      Promise.all([this.engines.movie.getHealth(),this.engines.tv.getHealth()]).then((parts)=>parts.flat())
    ]);
    const current=this.projectionStore?await this.projectionStore.operations():{queue:[],history:[],calendar:[],health:[]};
    const names=['queue','history','calendar','health'];const operations={...current};
    settled.forEach((result,index)=>{if(result.status==='fulfilled')operations[names[index]]=result.value;});
    if(this.projectionStore)await this.projectionStore.replaceOperations(operations);
    this.operationCache=operations;return operations;
  }
  async reconcileItem(domain,id) {
    const key=`${domain}:${id}`;
    if(this.itemRuns.has(key))return this.itemRuns.get(key);
    const run=(async()=>{if(this.domainRuns.has(domain))await this.domainRuns.get(domain);return this.runItemReconciliation(domain,id);})();this.itemRuns.set(key,run);
    try{return await run;}finally{if(this.itemRuns.get(key)===run)this.itemRuns.delete(key);}
  }
  async runItemReconciliation(domain,id) {
    const started=Date.now(),engine=this.engines[domain];
    try{
      const getter=domain==='movie'?(engine.getMovieSummary||engine.getMovie):(engine.getSeriesSummary||engine.getSeries);
      const item=await getter.call(engine,id);
      if(!item)return this.removeItem(domain,id);
      const current=this.cache.get(domain)?.items||await this.projectionStore?.domain(domain)||[],index=current.findIndex((candidate)=>candidate.id===item.id),items=[...current];
      if(index>=0)items[index]=item;else items.push(item);
      const projection=this.projectionStore?await this.projectionStore.upsertDomainItem(domain,item):{updated:index>=0&&JSON.stringify(current[index])===JSON.stringify(item)?0:1,total:items.length,item,created:index<0};
      this.cache.set(domain,{items,cachedAt:new Date().toISOString(),targeted:true});
      Object.assign(this.state[domain],{status:'ready',lastSuccess:new Date().toISOString(),lastTargetedSync:new Date().toISOString(),lastFailure:null,safeError:null,durationMs:Date.now()-started,itemCount:items.length,itemsUpdated:projection.updated,source:'targeted-reconciliation'});
      return {...projection,item};
    }catch(error){
      Object.assign(this.state[domain],{status:this.cache.has(domain)?'stale':'unavailable',lastFailure:new Date().toISOString(),safeError:error.safeMessage||`${domain==='movie'?'Movie':'TV'} service unavailable`,durationMs:Date.now()-started,itemsUpdated:0});
      throw error;
    }
  }
  async removeItem(domain,id) {
    const current=this.cache.get(domain)?.items||await this.projectionStore?.domain(domain)||[],items=current.filter((item)=>item.id!==id),removed=current.length-items.length;
    const projection=this.projectionStore?await this.projectionStore.removeDomainItem(domain,id):{removed,total:items.length};
    this.cache.set(domain,{items,cachedAt:new Date().toISOString(),targeted:true});
    Object.assign(this.state[domain],{status:'ready',lastSuccess:new Date().toISOString(),lastTargetedSync:new Date().toISOString(),lastFailure:null,itemCount:items.length,itemsUpdated:removed,source:'targeted-reconciliation'});
    return {...projection,id};
  }
  async operations(name){if(this.operationCache?.[name])return this.operationCache[name];if(this.projectionStore){this.operationCache=await this.projectionStore.operations();return this.operationCache[name]||[];}return [];}
  onFullSync(listener){this.fullSyncListeners.add(listener);return()=>this.fullSyncListeners.delete(listener);}
  async list(domain,{refresh=false}={}){if(!refresh&&this.cache.has(domain))return this.cache.get(domain).items;return this.synchronize(domain);}
  invalidate(domain){if(domain)this.cache.delete(domain);else this.cache.clear();}
  snapshot(){const state=structuredClone(this.state);for(const domain of ['movie','tv'])state[domain].nextIntegrityCheck=this.nextIntegrityCheck||null;return state;}
  async startup(){
    if(this.startupRun)return this.startupRun;
    this.startupRun=(async()=>{await this.hydrate();const result=await Promise.allSettled(['movie','tv'].map((domain)=>this.synchronize(domain)));await this.synchronizeOperations().catch(()=>{});return result;})();
    try{return await this.startupRun;}finally{this.startupRun=null;}
  }
  startPolling(){this.stopPolling();this.nextIntegrityCheck=new Date(Date.now()+this.pollIntervalMs).toISOString();this.timer=setInterval(()=>{this.nextIntegrityCheck=new Date(Date.now()+this.pollIntervalMs).toISOString();this.startup();},this.pollIntervalMs);this.timer.unref?.();}
  stopPolling(){if(this.timer)clearInterval(this.timer);this.nextIntegrityCheck=null;}
}
