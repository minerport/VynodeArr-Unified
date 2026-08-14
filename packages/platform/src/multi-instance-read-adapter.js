const prefixFor=domain=>domain==='movie'?'movie':'series';
const nativeId=(domain,id)=>String(id||'').replace(new RegExp(`^${prefixFor(domain)}_`),'');

export class MultiInstanceReadAdapter {
  constructor(domain,instances){this.domain=domain;this.instances=instances;this.client=instances.find(value=>value.isDefault)?.adapter?.client||instances[0]?.adapter?.client;}
  encode(instanceId,id){return `${prefixFor(this.domain)}_${instanceId}_${nativeId(this.domain,id)}`;}
  decode(id){
    const value=nativeId(this.domain,id);
    for(const instance of this.instances){const marker=`${instance.id}_`;if(value.startsWith(marker))return{instance,nativeId:value.slice(marker.length)};}
    const instance=this.instances.find(value=>value.isDefault)||this.instances[0];return instance?{instance,nativeId:value}:null;
  }
  tag(instance,item){return{...item,id:this.encode(instance.id,item.id),engineId:Number(nativeId(this.domain,item.id)),engineInstanceId:instance.id,engineInstanceName:instance.name};}
  async listMovies(options){return this.#all('listMovies',options);}
  async listSeries(options){return this.#all('listSeries',options);}
  async getMovie(id){return this.#one('getMovie',id);}
  async getMovieSummary(id){return this.#one('getMovieSummary',id);}
  async getSeries(id){return this.#one('getSeries',id);}
  async getSeriesSummary(id){return this.#one('getSeriesSummary',id);}
  async getSeriesFileMetadata(id){const decoded=this.decode(id);return decoded?decoded.instance.adapter.getSeriesFileMetadata(decoded.nativeId):[];}
  async getSeriesOverlayMetadata(id){const decoded=this.decode(id);return decoded?decoded.instance.adapter.getSeriesOverlayMetadata(decoded.nativeId):{};}
  async getAttentionSummary(){
    const values=await Promise.allSettled(this.instances.map(value=>value.adapter.getAttentionSummary()));
    const ready=values.filter(value=>value.status==='fulfilled').map(value=>value.value);if(!ready.length)throw values[0]?.reason||new Error('Media engines unavailable');
    return ready.reduce((total,value)=>({missing:total.missing+Number(value.missing||0),cutoff:total.cutoff+Number(value.cutoff||0)}),{missing:0,cutoff:0});
  }
  async getQueue(){return this.#operations('getQueue');}
  async getHistory(options){return this.#operations('getHistory',options);}
  async getHistorySince(options){return this.#operations('getHistorySince',options);}
  async getCalendar(){return this.#operations('getCalendar');}
  async getHealth(){return this.#operations('getHealth');}
  async #all(method,options){
    const values=await Promise.allSettled(this.instances.map(async instance=>(await instance.adapter[method](options)).map(item=>this.tag(instance,item))));
    const ready=values.filter(value=>value.status==='fulfilled').flatMap(value=>value.value);if(!ready.length&&values.length)throw values[0].reason;return ready;
  }
  async #one(method,id){const decoded=this.decode(id);if(!decoded)return null;const item=await decoded.instance.adapter[method](decoded.nativeId);return item?this.tag(decoded.instance,item):null;}
  async #operations(method,options){
    const values=await Promise.allSettled(this.instances.map(async instance=>(await instance.adapter[method](options)).map(item=>({...item,id:`${instance.id}:${item.id}`,mediaId:item.mediaId?this.encode(instance.id,item.mediaId):item.mediaId,engineInstanceId:instance.id,engineInstanceName:instance.name}))));
    const ready=values.filter(value=>value.status==='fulfilled').flatMap(value=>value.value);if(!ready.length&&values.length)throw values[0].reason;return ready;
  }
}
