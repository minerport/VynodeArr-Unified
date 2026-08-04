type Entry<T>={value:T;expires:number};

const memory=new Map<string,Entry<unknown>>();
const pending=new Map<string,Promise<unknown>>();
const prune=()=>{const now=Date.now();for(const [key,value]of memory)if(value.expires<=now)memory.delete(key);while(memory.size>=250){const key=memory.keys().next().value;if(key===undefined)break;memory.delete(key);}};

export async function cachedRequest<T>(
  key:string,
  loader:()=>Promise<T>,
  ttlMs=60_000,
  stale?:T,
):Promise<T>{
  const cached=memory.get(key) as Entry<T>|undefined;
  if(cached&&cached.expires>Date.now())return cached.value;
  prune();
  const active=pending.get(key) as Promise<T>|undefined;
  if(active)return active;
  const run=loader().then(value=>{
    prune();
    memory.set(key,{value,expires:Date.now()+ttlMs});
    pending.delete(key);
    return value;
  }).catch(error=>{
    pending.delete(key);
    if(cached)return cached.value;
    if(stale!==undefined)return stale;
    throw error;
  });
  pending.set(key,run);
  return run;
}

export function primeRequest<T>(key:string,value:T,ttlMs=60_000){
  prune();
  memory.set(key,{value,expires:Date.now()+ttlMs});
}

export function invalidateRequest(prefix=''){
  for(const key of memory.keys())if(!prefix||key.startsWith(prefix))memory.delete(key);
}
