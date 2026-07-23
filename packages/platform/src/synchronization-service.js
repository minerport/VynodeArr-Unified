export class SynchronizationService {
  constructor({movie,tv,maxItems=5000,pollIntervalMs=300000,projectionStore=null}) {
    this.engines={movie,tv};this.maxItems=maxItems;this.pollIntervalMs=pollIntervalMs;this.projectionStore=projectionStore;
    this.cache=new Map();this.state={
      movie:{status:'idle',lastSuccess:null,lastFailure:null,durationMs:null,itemCount:0,itemsUpdated:0},
      tv:{status:'idle',lastSuccess:null,lastFailure:null,durationMs:null,itemCount:0,itemsUpdated:0}
    };
  }
  setEngines(movie,tv){this.engines={movie,tv};this.invalidate();}
  async hydrate(){
    if(!this.projectionStore)return;
    for(const domain of ['movie','tv']){const items=await this.projectionStore.domain(domain);if(items.length)this.cache.set(domain,{items,cachedAt:new Date().toISOString(),durable:true});}
  }
  async synchronize(domain){
    const started=Date.now();this.state[domain].status='synchronizing';
    try{
      const items=domain==='movie'?await this.engines.movie.listMovies({limit:this.maxItems}):await this.engines.tv.listSeries({limit:this.maxItems});
      const bounded=items.slice(0,this.maxItems);const projection=this.projectionStore?await this.projectionStore.replaceDomain(domain,bounded):{updated:bounded.length,total:bounded.length};
      this.cache.set(domain,{items:bounded,cachedAt:new Date().toISOString()});
      Object.assign(this.state[domain],{status:'ready',lastSuccess:new Date().toISOString(),lastFailure:null,safeError:null,durationMs:Date.now()-started,itemCount:bounded.length,itemsUpdated:projection.updated});
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
  async operations(name){if(this.operationCache?.[name])return this.operationCache[name];if(this.projectionStore){this.operationCache=await this.projectionStore.operations();return this.operationCache[name]||[];}return [];}
  async list(domain,{refresh=false}={}){if(!refresh&&this.cache.has(domain))return this.cache.get(domain).items;return this.synchronize(domain);}
  invalidate(domain){if(domain)this.cache.delete(domain);else this.cache.clear();}
  snapshot(){return structuredClone(this.state);}
  async startup(){await this.hydrate();const result=await Promise.allSettled(['movie','tv'].map((domain)=>this.synchronize(domain)));await this.synchronizeOperations().catch(()=>{});return result;}
  startPolling(){this.stopPolling();this.timer=setInterval(()=>this.startup(),this.pollIntervalMs);this.timer.unref?.();}
  stopPolling(){if(this.timer)clearInterval(this.timer);}
}
