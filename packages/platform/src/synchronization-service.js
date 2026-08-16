import {PriorityWorkQueue} from './priority-work-queue.js';

export class SynchronizationService {
  constructor({movie,tv,maxItems=Infinity,pollIntervalMs=300000,projectionStore=null,logger=null}) {
    this.engines={movie,tv};this.maxItems=maxItems;this.pollIntervalMs=pollIntervalMs;this.projectionStore=projectionStore;this.logger=logger;
    this.domainRuns=new Map();this.itemRuns=new Map();this.workQueues={movie:new PriorityWorkQueue(),tv:new PriorityWorkQueue()};this.startupRun=null;this.operationsRun=null;this.fullSyncListeners=new Set();
    this.metrics={catalogReads:0,engineReads:0,fullReconciliations:0,targetedReconciliations:0};
    this.cache=new Map();this.state={
      movie:{status:'idle',lastSuccess:null,lastFullSync:null,lastTargetedSync:null,lastFailure:null,durationMs:null,itemCount:0,itemsUpdated:0,source:'empty'},
      tv:{status:'idle',lastSuccess:null,lastFullSync:null,lastTargetedSync:null,lastFailure:null,durationMs:null,itemCount:0,itemsUpdated:0,source:'empty'}
    };
  }
  setEngines(movie,tv){this.engines={movie,tv};this.invalidate();}
  async hydrate(){
    if(!this.projectionStore)return;
    if(typeof this.projectionStore.countDomain==='function'){
      await this.projectionStore.initialize?.();
      for(const domain of ['movie','tv']){const count=await this.projectionStore.countDomain(domain),persisted=await this.projectionStore.synchronizationState?.(domain);if(count)Object.assign(this.state[domain],{status:'ready',lastSuccess:persisted?.lastSuccess||null,lastFullSync:persisted?.lastSuccess||null,itemCount:count,itemsUpdated:Number(persisted?.updated)||0,itemsRemoved:Number(persisted?.removed)||0,source:'sqlite-catalog'});}
      return;
    }
    const projection=await this.projectionStore.load();
    for(const domain of ['movie','tv']){const items=projection.domains?.[domain]||[];if(items.length){this.cache.set(domain,{items,cachedAt:projection.updatedAt||new Date().toISOString(),durable:true});Object.assign(this.state[domain],{status:'ready',itemCount:items.length,source:'durable-projection',projectionUpdatedAt:projection.updatedAt||null});}}
  }
  async synchronize(domain){
    if(this.domainRuns.has(domain))return this.domainRuns.get(domain);
    const run=this.workQueues[domain].enqueue('full',()=>this.runDomainSynchronization(domain),{priority:1,label:`${domain} full reconciliation`});this.domainRuns.set(domain,run);
    try{return await run;}finally{if(this.domainRuns.get(domain)===run)this.domainRuns.delete(domain);}
  }
  async runDomainSynchronization(domain){
    const started=Date.now();this.state[domain].status='synchronizing';
    this.logger?.info('catalog.sync.started',`${domain==='movie'?'Movies':'Television'} catalog synchronization started`,{domain});
    try{
      this.metrics.engineReads++;this.metrics.fullReconciliations++;
      const items=domain==='movie'?await this.engines.movie.listMovies({limit:this.maxItems}):await this.engines.tv.listSeries({limit:this.maxItems});
      const bounded=Number.isFinite(this.maxItems)?items.slice(0,this.maxItems):items;const projection=this.projectionStore?await this.projectionStore.replaceDomain(domain,bounded):{updated:bounded.length,total:bounded.length};
      if(typeof this.projectionStore?.queryDomain!=='function')this.cache.set(domain,{items:bounded,cachedAt:new Date().toISOString()});
      const completedAt=new Date().toISOString();Object.assign(this.state[domain],{status:'ready',lastSuccess:completedAt,lastFullSync:completedAt,lastFailure:null,safeError:null,durationMs:Date.now()-started,itemCount:bounded.length,itemsUpdated:projection.updated,itemsRemoved:projection.removed||0,source:'full-reconciliation'});
      this.logger?.info('catalog.sync.completed',`${domain==='movie'?'Movies':'Television'} catalog synchronized`,{domain,itemCount:bounded.length,itemsUpdated:projection.updated,itemsRemoved:projection.removed||0,durationMs:Date.now()-started});
      for(const listener of this.fullSyncListeners)try{listener({domain,itemsUpdated:projection.updated,itemsRemoved:projection.removed||0,itemCount:bounded.length,updatedAt:completedAt});}catch{}
      return bounded;
    }catch(error){
      const persisted=typeof this.projectionStore?.countDomain==='function'&&(await this.projectionStore.countDomain(domain))>0;
      Object.assign(this.state[domain],{status:this.cache.has(domain)||persisted?'stale':'unavailable',lastFailure:new Date().toISOString(),safeError:error.safeMessage||`${domain==='movie'?'Movie':'TV'} service unavailable`,durationMs:Date.now()-started,itemsUpdated:0});
      const retained=this.cache.has(domain)||persisted;
      this.logger?.warn('catalog.sync.deferred',`${domain==='movie'?'Movies':'Television'} synchronization deferred${retained?'; retained catalog remains available':''}`,{domain,retainedCatalog:retained,durationMs:Date.now()-started,error});
      if(this.cache.has(domain))return this.cache.get(domain).items;
      if(persisted)return this.projectionStore.domain(domain);
      throw error;
    }
  }
  async synchronizeOperations(){
    if(this.operationsRun)return this.operationsRun;
    const run=this.runOperationsSynchronization();this.operationsRun=run;
    try{return await run;}finally{if(this.operationsRun===run)this.operationsRun=null;}
  }
  async runOperationsSynchronization(){
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
    const run=this.workQueues[domain].enqueue(`item:${id}`,()=>this.runItemReconciliation(domain,id),{priority:10,label:`${domain} title ${id}`});this.itemRuns.set(key,run);
    try{return await run;}finally{if(this.itemRuns.get(key)===run)this.itemRuns.delete(key);}
  }
  async runItemReconciliation(domain,id) {
    const started=Date.now(),engine=this.engines[domain];
    try{
      this.metrics.engineReads++;this.metrics.targetedReconciliations++;
      const getter=domain==='movie'?(engine.getMovieSummary||engine.getMovie):(engine.getSeriesSummary||engine.getSeries);
      const item=await getter.call(engine,id);
      if(!item)return this.removeItem(domain,id);
      const catalog=typeof this.projectionStore?.getDomainItem==='function',currentItem=catalog?await this.projectionStore.getDomainItem(domain,item.id):null,current=catalog?[]:(this.cache.get(domain)?.items||await this.projectionStore?.domain(domain)||[]),index=catalog?(currentItem?0:-1):current.findIndex((candidate)=>candidate.id===item.id),items=catalog?[]:[...current];
      if(!catalog){if(index>=0)items[index]=item;else items.push(item);}
      const projection=this.projectionStore?await this.projectionStore.upsertDomainItem(domain,item):{updated:index>=0&&JSON.stringify(current[index])===JSON.stringify(item)?0:1,total:items.length,item,created:index<0};
      if(!catalog)this.cache.set(domain,{items,cachedAt:new Date().toISOString(),targeted:true});
      Object.assign(this.state[domain],{status:'ready',lastSuccess:new Date().toISOString(),lastTargetedSync:new Date().toISOString(),lastFailure:null,safeError:null,durationMs:Date.now()-started,itemCount:projection.total,itemsUpdated:projection.updated,source:'targeted-reconciliation'});
      return {...projection,item};
    }catch(error){
      Object.assign(this.state[domain],{status:this.cache.has(domain)?'stale':'unavailable',lastFailure:new Date().toISOString(),safeError:error.safeMessage||`${domain==='movie'?'Movie':'TV'} service unavailable`,durationMs:Date.now()-started,itemsUpdated:0});
      throw error;
    }
  }
  async removeItem(domain,id) {
    const catalog=typeof this.projectionStore?.getDomainItem==='function',current=catalog?[]:(this.cache.get(domain)?.items||await this.projectionStore?.domain(domain)||[]),items=current.filter((item)=>item.id!==id),removed=catalog?Number(Boolean(await this.projectionStore.getDomainItem(domain,id))):current.length-items.length;
    const projection=this.projectionStore?await this.projectionStore.removeDomainItem(domain,id):{removed,total:items.length};
    if(!catalog)this.cache.set(domain,{items,cachedAt:new Date().toISOString(),targeted:true});
    Object.assign(this.state[domain],{status:'ready',lastSuccess:new Date().toISOString(),lastTargetedSync:new Date().toISOString(),lastFailure:null,itemCount:projection.total,itemsUpdated:removed,source:'targeted-reconciliation'});
    return {...projection,id};
  }
  async operations(name){if(this.operationCache?.[name])return this.operationCache[name];if(this.projectionStore){this.operationCache=await this.projectionStore.operations();return this.operationCache[name]||[];}return [];}
  onFullSync(listener){this.fullSyncListeners.add(listener);return()=>this.fullSyncListeners.delete(listener);}
  async list(domain,{refresh=false,...query}={}){if(!refresh&&typeof this.projectionStore?.queryDomain==='function'){this.metrics.catalogReads++;return (await this.projectionStore.queryDomain(domain,{limit:5000,...query})).items;}if(!refresh&&this.cache.has(domain))return this.cache.get(domain).items;return this.synchronize(domain);}
  async page(domain,query={}){if(typeof this.projectionStore?.queryDomain==='function'){this.metrics.catalogReads++;return this.projectionStore.queryDomain(domain,query);}const items=await this.list(domain),offset=Math.max(0,Number(query.offset)||0),limit=Math.max(1,Math.min(5000,Number(query.limit)||60));return{items:items.slice(offset,offset+limit),total:items.length,offset,limit,hasMore:offset+limit<items.length};}
  async item(domain,id){if(typeof this.projectionStore?.getDomainItem==='function'){this.metrics.catalogReads++;return this.projectionStore.getDomainItem(domain,id);}return(await this.list(domain)).find(item=>item.id===id)||null;}
  invalidate(domain){if(domain)this.cache.delete(domain);else this.cache.clear();}
  async integrity(domain){
    const count=typeof this.projectionStore?.countDomain==='function'?await this.projectionStore.countDomain(domain):this.cache.get(domain)?.items?.length||0,state=this.state[domain],persisted=await this.projectionStore?.synchronizationState?.(domain),database=await this.projectionStore?.integrityCheck?.(),catalog=await this.projectionStore?.domainIntegrity?.(domain);
    const issues=[];if(!count)issues.push('Catalog is empty');if(state.itemCount&&state.itemCount!==count)issues.push('Runtime and catalog title counts differ');if(!persisted?.lastSuccess&&!state.lastSuccess)issues.push('No successful synchronization timestamp is recorded');if(database&&!database.ok)issues.push('SQLite integrity check failed');if(catalog?.invalidPayloads)issues.push(`${catalog.invalidPayloads} invalid catalog records`);if(catalog?.duplicateExternalIds)issues.push(`${catalog.duplicateExternalIds} duplicate external identifiers`);
    const result={domain,checkedAt:new Date().toISOString(),healthy:issues.length===0,issues,itemCount:count,runtimeItemCount:state.itemCount,lastSuccess:persisted?.lastSuccess||state.lastSuccess||null,catalogAgeMs:Date.parse(persisted?.lastSuccess||state.lastSuccess||0)?Date.now()-Date.parse(persisted?.lastSuccess||state.lastSuccess):null,database:database||null,catalog:catalog||null};this.lastIntegrity={...(this.lastIntegrity||{}),[domain]:result};return result;
  }
  resetCircuit(domain){return this.engines[domain]?.client?.resetCircuit?.()||null;}
  snapshot(){const state=structuredClone(this.state);for(const domain of ['movie','tv']){state[domain].nextIntegrityCheck=this.nextIntegrityCheck||null;state[domain].integrity=this.lastIntegrity?.[domain]||null;state[domain].workQueue=this.workQueues[domain].snapshot();state[domain].circuit=this.engines[domain]?.client?.circuitSnapshot?.()||null;}return {...state,metrics:{...this.metrics}};}
  async startup(){
    if(this.startupRun)return this.startupRun;
    this.startupRun=(async()=>{await this.hydrate();const result=await Promise.allSettled(['movie','tv'].map((domain)=>this.synchronize(domain)));await this.synchronizeOperations().catch(()=>{});await Promise.allSettled(['movie','tv'].map(domain=>this.integrity(domain)));return result;})();
    try{return await this.startupRun;}finally{this.startupRun=null;}
  }
  startPolling(){this.stopPolling();this.nextIntegrityCheck=new Date(Date.now()+this.pollIntervalMs).toISOString();this.timer=setInterval(()=>{this.nextIntegrityCheck=new Date(Date.now()+this.pollIntervalMs).toISOString();this.startup();},this.pollIntervalMs);this.timer.unref?.();}
  stopPolling(){if(this.timer)clearInterval(this.timer);this.nextIntegrityCheck=null;}
  setPollingInterval(value){this.pollIntervalMs=Math.max(30*60*1000,Number(value)||this.pollIntervalMs);if(this.timer)this.startPolling();return this.pollIntervalMs;}
}
