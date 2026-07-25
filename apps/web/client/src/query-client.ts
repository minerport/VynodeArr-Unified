type Entry<T>={value:T;expires:number};

const memory=new Map<string,Entry<unknown>>();
const pending=new Map<string,Promise<unknown>>();

export async function cachedRequest<T>(
  key:string,
  loader:()=>Promise<T>,
  ttlMs=60_000,
  stale?:T,
):Promise<T>{
  const cached=memory.get(key) as Entry<T>|undefined;
  if(cached&&cached.expires>Date.now())return cached.value;
  const active=pending.get(key) as Promise<T>|undefined;
  if(active)return active;
  const run=loader().then(value=>{
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
  memory.set(key,{value,expires:Date.now()+ttlMs});
}

export function invalidateRequest(prefix=''){
  for(const key of memory.keys())if(!prefix||key.startsWith(prefix))memory.delete(key);
}
