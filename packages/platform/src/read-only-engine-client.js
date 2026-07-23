import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { engineError } from './engine-errors.js';

export class ReadOnlyEngineClient {
  constructor(config, domain) { this.config=config;this.domain=domain; }
  buildUrl(path,query={}){
    const prefix=this.config.urlBase?`/${this.config.urlBase}`:'';
    const url=new URL(`${this.config.https?'https':'http'}://${this.config.host}:${this.config.port}${prefix}/api/v3/${path.replace(/^\/+/,'')}`);
    for(const [key,value] of Object.entries(query))if(value!=null)url.searchParams.set(key,value);
    return url;
  }
  #request(url,{method='GET',payload}={}){
    return new Promise((resolve,reject)=>{
      const transport=url.protocol==='https:'?httpsRequest:httpRequest;
      const encoded=payload===undefined?null:Buffer.from(JSON.stringify(payload));
      const req=transport(url,{method,headers:{accept:'application/json','content-type':'application/json','x-api-key':this.config.apiCredential,...(encoded?{'content-length':encoded.length}:{})},rejectUnauthorized:this.config.tlsVerify},(res)=>{
        const chunks=[];let size=0;
        res.on('data',(chunk)=>{size+=chunk.length;if(size>32*1024*1024){req.destroy(engineError.invalid());return;}chunks.push(chunk);});
        res.on('end',()=>{
          if(res.statusCode===401||res.statusCode===403)return reject(engineError.authentication());
          const text=Buffer.concat(chunks).toString('utf8');
          if(res.statusCode<200||res.statusCode>=300){
            if([400,409,422].includes(res.statusCode)){
              try{
                const value=JSON.parse(text),items=Array.isArray(value)?value:[value];
                const message=items.map((item)=>item?.errorMessage||item?.message).filter(Boolean).join('; ');
                if(message)return reject(engineError.validation(message.slice(0,500)));
              }catch{}
            }
            return reject(engineError.unavailable(this.domain));
          }
          if(!text)return resolve(null);
          try{resolve(JSON.parse(text));}catch{reject(engineError.invalid());}
        });
      });
      req.setTimeout(this.config.timeoutMs,()=>req.destroy(engineError.timeout(this.domain)));
      req.on('error',reject);if(encoded)req.write(encoded);req.end();
    });
  }
  #requestBuffer(url){
    return new Promise((resolve,reject)=>{
      const transport=url.protocol==='https:'?httpsRequest:httpRequest;
      const req=transport(url,{method:'GET',headers:{accept:'image/*','x-api-key':this.config.apiCredential},rejectUnauthorized:this.config.tlsVerify},(res)=>{
        const chunks=[];let size=0;if(res.statusCode===404){res.resume();return resolve(null);}if(res.statusCode<200||res.statusCode>=300){res.resume();return reject(engineError.unavailable(this.domain));}
        res.on('data',(chunk)=>{size+=chunk.length;if(size>16*1024*1024){req.destroy(engineError.invalid());return;}chunks.push(chunk);});
        res.on('end',()=>resolve({body:Buffer.concat(chunks),contentType:String(res.headers['content-type']||'image/jpeg')}));
      });req.setTimeout(this.config.timeoutMs,()=>req.destroy(engineError.timeout(this.domain)));req.on('error',reject);req.end();
    });
  }
  async get(path,query){
    if(!this.config.enabled)throw engineError.unavailable(this.domain);
    let lastError;
    for(let attempt=0;attempt<=this.config.retries;attempt+=1){
      try{return await this.#request(this.buildUrl(path,query));}
      catch(error){lastError=error;if(error?.code==='engine_authentication_failed')break;}
    }
    if(lastError?.safeMessage)throw lastError;
    throw engineError.unavailable(this.domain);
  }
  async mutate(method,path,payload,query){
    if(!this.config.enabled)throw engineError.unavailable(this.domain);
    try{return await this.#request(this.buildUrl(path,query),{method,payload});}
    catch(error){if(error?.safeMessage)throw error;throw engineError.unavailable(this.domain);}
  }
  post(path,payload,query){return this.mutate('POST',path,payload,query);}
  put(path,payload,query){return this.mutate('PUT',path,payload,query);}
  delete(path,query){return this.mutate('DELETE',path,undefined,query);}
  async getArtwork(mediaId,type){
    if(!this.config.enabled)throw engineError.unavailable(this.domain);
    const prefix=this.config.urlBase?`/${this.config.urlBase}`:'';
    const safeType=['poster','fanart','banner','logo','headshot','season','episode'].includes(type)?type:'poster';
    const url=new URL(`${this.config.https?'https':'http'}://${this.config.host}:${this.config.port}${prefix}/MediaCover/${Number(mediaId)}/${safeType}.jpg`);
    return this.#requestBuffer(url);
  }
}
