export class CatalogEventProcessor {
  constructor({store,synchronize,onProcessed=()=>{},concurrency=2,pollIntervalMs=1000}){this.store=store;this.synchronize=synchronize;this.onProcessed=onProcessed;this.concurrency=Math.max(1,Math.min(4,concurrency));this.pollIntervalMs=pollIntervalMs;this.running=false;this.active=0;this.timer=null;}
  async enqueue(event){const record=await this.store.enqueueEvent(event);this.wake();return record;}
  start(){if(this.running)return;this.running=true;this.wake();}
  stop(){this.running=false;if(this.timer)clearTimeout(this.timer);this.timer=null;}
  setConcurrency(value){this.concurrency=Math.max(1,Math.min(4,Number(value)||2));this.wake();return this.concurrency;}
  wake(){if(!this.running||this.timer)return;this.timer=setTimeout(()=>{this.timer=null;void this.drain();},0);this.timer.unref?.();}
  async drain(){if(!this.running)return;const available=Math.max(0,this.concurrency-this.active),events=available?await this.store.claimEvents(available):[];for(const event of events){this.active++;void this.process(event).finally(()=>{this.active--;this.wake();});}if(!events.length&&this.running){this.timer=setTimeout(()=>{this.timer=null;void this.drain();},this.pollIntervalMs);this.timer.unref?.();}}
  async process(event){try{let result;if(event.media_id)result=await this.synchronize.reconcileItem(event.domain,event.media_id);else result={items:await this.synchronize.synchronize(event.domain)};await this.store.completeEvent(event.id);await this.onProcessed(event,result);}catch(error){const delay=Math.min(300000,5000*(2**Math.min(6,Number(event.attempts)||1)));await this.store.retryEvent(event.id,error?.message||error,delay);}}
  async stats(){return{active:this.active,concurrency:this.concurrency,queue:await this.store.eventStats()};}
}
