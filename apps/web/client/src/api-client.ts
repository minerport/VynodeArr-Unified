type CachedResponse={value:unknown;expiresAt:number};

export interface ApiClientOptions{
  csrfToken:()=>string|null|undefined;
  onUnauthorized:()=>void|Promise<void>;
  onMutation?:(path:string)=>void;
}

export function cacheLifetime(path:string){
  if(/^\/api\/media\/(?:movies|tv)$/.test(path))return 8000;
  if(/^\/api\/media\/(?:movies\/movie|tv\/series)_[A-Za-z0-9_-]+$/.test(path))return 30000;
  if(path==='/api/dashboard')return 10000;
  if(/^\/api\/discover\/(?:status|genres|categories)/.test(path))return 300000;
  return 0;
}

export function createApiClient(options:ApiClientOptions){
  const activeRequests=new Map<string,AbortController>();
  const responseCache=new Map<string,CachedResponse>();
  const responseInflight=new Map<string,Promise<unknown>>();

  return async function request<T=unknown>(path:string,requestOptions:RequestInit={}):Promise<T>{
    let requestKey='';
    let configuredOptions=requestOptions;
    if(path.startsWith('/api/discover/browse?')&&path.includes('query=')){
      requestKey=`discover-search-${new URL(path,location.origin).searchParams.get('domain')||'all'}`;
      activeRequests.get(requestKey)?.abort();
      const controller=new AbortController();
      activeRequests.set(requestKey,controller);
      configuredOptions={...requestOptions,signal:controller.signal};
    }

    const method=String(configuredOptions.method||'GET').toUpperCase();
    const ttl=method==='GET'&&!configuredOptions.signal?cacheLifetime(path):0;
    const cached=ttl?responseCache.get(path):undefined;
    if(cached&&cached.expiresAt>Date.now())return structuredClone(cached.value) as T;
    if(ttl&&responseInflight.has(path))return structuredClone(await responseInflight.get(path)) as T;

    const execute=async()=>{
      const headers=new Headers(configuredOptions.headers);
      if(!(configuredOptions.body instanceof FormData)&&!headers.has('content-type'))headers.set('content-type','application/json');
      const csrf=options.csrfToken();
      if(csrf&&!headers.has('x-vynodearr-csrf'))headers.set('x-vynodearr-csrf',csrf);
      try{
        const response=await fetch(path,{...configuredOptions,headers});
        const value=await response.json().catch(()=>({}));
        if(response.status===401&&!path.startsWith('/api/auth/')){
          await options.onUnauthorized();
          throw new Error('Your session timed out. Sign in to continue.');
        }
        if(!response.ok)throw new Error(value.error?.message||'VynodeArr could not complete this request.');
        if(method!=='GET'){
          responseCache.clear();
          options.onMutation?.(path);
        }
        return value;
      }finally{
        if(requestKey)activeRequests.delete(requestKey);
      }
    };

    if(!ttl)return execute() as Promise<T>;
    const pending=execute().then(value=>{
      responseCache.set(path,{value:structuredClone(value),expiresAt:Date.now()+ttl});
      return value;
    }).finally(()=>responseInflight.delete(path));
    responseInflight.set(path,pending);
    return structuredClone(await pending) as T;
  };
}
