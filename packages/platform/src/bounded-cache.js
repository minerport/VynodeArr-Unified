export class BoundedCache {
  constructor({maxItems=250,maxBytes=128*1024*1024,ttlMs=30*60*1000,sizeOf=value=>Number(value?.body?.length||0)}){
    this.maxItems=Math.max(1,maxItems);this.maxBytes=Math.max(0,maxBytes);this.ttlMs=Math.max(1,ttlMs);this.sizeOf=sizeOf;this.items=new Map();this.bytes=0;this.evictions=0;
  }
  get size(){this.prune();return this.items.size;}
  get(key){const entry=this.items.get(key);if(!entry)return undefined;if(entry.expiresAt<=Date.now()){this.#remove(key,entry);return undefined;}this.items.delete(key);this.items.set(key,entry);return entry.value;}
  has(key){return this.get(key)!==undefined;}
  set(key,value){const bytes=Math.max(0,Number(this.sizeOf(value))||0),existing=this.items.get(key);if(existing)this.#remove(key,existing);if(bytes>this.maxBytes)return this;this.items.set(key,{value,bytes,expiresAt:Date.now()+this.ttlMs});this.bytes+=bytes;this.prune();while(this.items.size>this.maxItems||this.bytes>this.maxBytes){const oldest=this.items.entries().next().value;if(!oldest)break;this.#remove(oldest[0],oldest[1]);this.evictions++;}return this;}
  delete(key){const entry=this.items.get(key);if(!entry)return false;this.#remove(key,entry);return true;}
  clear(){this.items.clear();this.bytes=0;}
  prune(now=Date.now()){for(const [key,entry]of this.items)if(entry.expiresAt<=now)this.#remove(key,entry);return this;}
  stats(){this.prune();return{items:this.items.size,bytes:this.bytes,evictions:this.evictions,maxItems:this.maxItems,maxBytes:this.maxBytes,ttlMs:this.ttlMs};}
  #remove(key,entry){if(this.items.delete(key))this.bytes=Math.max(0,this.bytes-entry.bytes);}
}
