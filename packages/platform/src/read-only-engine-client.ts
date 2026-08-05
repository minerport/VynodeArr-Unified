import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { engineError } from './engine-errors.js';

export class ReadOnlyEngineClient {
  config: Record<string, any>;
  domain: string;

  constructor(config: Record<string, any>, domain: string) { this.config=config;this.domain=domain; }
  buildUrl(path: string,query: Record<string, unknown>={}){
    const prefix=this.config.urlBase?`/${this.config.urlBase}`:'';
    const url=new URL(`${this.config.https?'https':'http'}://${this.config.host}:${this.config.port}${prefix}/api/v3/${path.replace(/^\/+/,'')}`);
    for(const [key,value] of Object.entries(query))if(value!=null)url.searchParams.set(key,String(value));
    return url;
  }
  #request(url: URL,{method='GET',payload,timeoutMs=this.config.timeoutMs,notFoundNull=false}:{method?: string;payload?: unknown;timeoutMs?: number;notFoundNull?: boolean}={}){
    return new Promise<any>((resolve,reject)=>{
      const transport=url.protocol==='https:'?httpsRequest:httpRequest;
      const encoded=payload===undefined?null:Buffer.from(JSON.stringify(payload));
      const options:any={method,headers:{accept:'application/json','x-api-key':this.config.apiCredential,...(encoded?{'content-type':'application/json','content-length':encoded.length}:{})},rejectUnauthorized:this.config.tlsVerify};
      const req=transport(url,options,(res)=>{
        const chunks: Buffer[]=[];let size=0;
        res.on('data',(chunk)=>{size+=chunk.length;if(size>32*1024*1024){req.destroy(engineError.invalid());return;}chunks.push(chunk);});
        res.on('end',()=>{
          if(res.statusCode===401||res.statusCode===403)return reject(engineError.authentication());
          if(notFoundNull&&res.statusCode===404)return resolve(null);
          const text=Buffer.concat(chunks).toString('utf8');
          if(res.statusCode<200||res.statusCode>=300){
            if([400,404,409,422,500].includes(res.statusCode)){
              try{
                const value=JSON.parse(text),items:any[]=Array.isArray(value)?value:[value];
                const message=items.map((item:any)=>item?.errorMessage||item?.message||item?.detail||item?.description||item?.title).filter(Boolean).join('; ');
                if(message)return reject(engineError.validation(message.slice(0,500)));
              }catch{}
            }
            return reject(engineError.unavailable(this.domain));
          }
          if(!text)return resolve(null);
          try{resolve(JSON.parse(text));}catch{reject(engineError.invalid());}
        });
      });
      req.setTimeout(timeoutMs,()=>req.destroy(engineError.timeout(this.domain)));
      req.on('error',reject);if(encoded)req.write(encoded);req.end();
    });
  }
  #requestBuffer(url: URL){
    return new Promise<{body: Buffer;contentType: string}|null>((resolve,reject)=>{
      const transport=url.protocol==='https:'?httpsRequest:httpRequest;
      const options:any={method:'GET',headers:{accept:'image/*','x-api-key':this.config.apiCredential},rejectUnauthorized:this.config.tlsVerify};
      const req=transport(url,options,(res)=>{
        const chunks: Buffer[]=[];let size=0;if([404,406].includes(res.statusCode ?? 0)){res.resume();return resolve(null);}if((res.statusCode ?? 0)<200||(res.statusCode ?? 0)>=300){res.resume();return reject(engineError.unavailable(this.domain));}
        res.on('data',(chunk)=>{size+=chunk.length;if(size>16*1024*1024){req.destroy(engineError.invalid());return;}chunks.push(chunk);});
        res.on('end',()=>resolve({body:Buffer.concat(chunks),contentType:String(res.headers['content-type']||'image/jpeg')}));
      });req.setTimeout(this.config.timeoutMs,()=>req.destroy(engineError.timeout(this.domain)));req.on('error',reject);req.end();
    });
  }
  #requestRemoteArtwork(url: URL){
    const hostname=url.hostname.toLowerCase(),allowed=['tmdb.org','thetvdb.com','tvmaze.com'].some((domain)=>hostname===domain||hostname.endsWith(`.${domain}`));
    if(url.protocol!=='https:'||!allowed)return Promise.resolve(null);
    return new Promise<{body: Buffer;contentType: string}|null>((resolve,reject)=>{
      const req=httpsRequest(url,{method:'GET',headers:{accept:'image/*','user-agent':'VynodeArr-Artwork/1.0'}},(res)=>{
        const chunks: Buffer[]=[];let size=0;
        if((res.statusCode ?? 0)<200||(res.statusCode ?? 0)>=300){res.resume();return resolve(null);}
        res.on('data',(chunk)=>{size+=chunk.length;if(size>16*1024*1024){req.destroy(engineError.invalid());return;}chunks.push(chunk);});
        res.on('end',()=>resolve({body:Buffer.concat(chunks),contentType:String(res.headers['content-type']||'image/jpeg')}));
      });
      req.setTimeout(this.config.timeoutMs,()=>req.destroy(engineError.timeout(this.domain)));req.on('error',reject);req.end();
    });
  }
  async get(path: string,query?: Record<string, unknown>): Promise<any>{
    if(!this.config.enabled)throw engineError.unavailable(this.domain);
    let lastError: any;
    for(let attempt=0;attempt<=this.config.retries;attempt+=1){
      try{return await this.#request(this.buildUrl(path,query));}
      catch(error:any){lastError=error;if(error?.code==='engine_authentication_failed')break;}
    }
    if(lastError?.safeMessage)throw lastError;
    throw engineError.unavailable(this.domain);
  }
  async getOptional(path: string,query?: Record<string, unknown>): Promise<any>{
    if(!this.config.enabled)throw engineError.unavailable(this.domain);
    let lastError: any;
    for(let attempt=0;attempt<=this.config.retries;attempt+=1){
      try{return await this.#request(this.buildUrl(path,query),{notFoundNull:true});}
      catch(error:any){lastError=error;if(error?.code==='engine_authentication_failed')break;}
    }
    if(lastError?.safeMessage)throw lastError;
    throw engineError.unavailable(this.domain);
  }
  async mutate(method: string,path: string,payload?: unknown,query?: Record<string, unknown>): Promise<any>{
    if(!this.config.enabled)throw engineError.unavailable(this.domain);
    const timeoutMs=Math.max(Number(this.config.timeoutMs)||0,method==='POST'&&String(path).replace(/^\/+/,'')==='release'?120_000:30_000);
    try{return await this.#request(this.buildUrl(path,query),{method,payload,timeoutMs});}
    catch(error:any){if(error?.safeMessage)throw error;throw engineError.unavailable(this.domain);}
  }
  post(path: string,payload?: unknown,query?: Record<string, unknown>){return this.mutate('POST',path,payload,query);}
  put(path: string,payload?: unknown,query?: Record<string, unknown>){return this.mutate('PUT',path,payload,query);}
  delete(path: string,query?: Record<string, unknown>,payload?: unknown){return this.mutate('DELETE',path,payload,query);}
  async getArtwork(mediaId: number|string,type: string){
    if(!this.config.enabled)throw engineError.unavailable(this.domain);
    const prefix=this.config.urlBase?`/${this.config.urlBase}`:'';
    const safeType=['poster','fanart','banner','logo','headshot','season','episode'].includes(type)?type:'poster',engineId=Number(mediaId);
    const url=new URL(`${this.config.https?'https':'http'}://${this.config.host}:${this.config.port}${prefix}/MediaCover/${engineId}/${safeType}.jpg`);
    const local=await this.#requestBuffer(url);
    if(local)return local;
    try{
      const record=await this.get(`${this.domain==='Movie'?'movie':'series'}/${engineId}`),image=(record?.images||[]).find((item:any)=>String(item.coverType||'').toLowerCase()===safeType);
      if(image?.remoteUrl){
        const remote=await this.#requestRemoteArtwork(new URL(image.remoteUrl));
        if(remote)return remote;
      }
    }catch{}
    return null;
  }
}
