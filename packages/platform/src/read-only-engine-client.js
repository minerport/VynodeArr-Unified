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
  #request(url){
    return new Promise((resolve,reject)=>{
      const transport=url.protocol==='https:'?httpsRequest:httpRequest;
      const req=transport(url,{method:'GET',headers:{accept:'application/json','x-api-key':this.config.apiCredential},rejectUnauthorized:this.config.tlsVerify},(res)=>{
        const chunks=[];let size=0;
        res.on('data',(chunk)=>{size+=chunk.length;if(size>32*1024*1024){req.destroy(engineError.invalid());return;}chunks.push(chunk);});
        res.on('end',()=>{
          if(res.statusCode===401||res.statusCode===403)return reject(engineError.authentication());
          if(res.statusCode<200||res.statusCode>=300)return reject(engineError.unavailable(this.domain));
          try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(engineError.invalid());}
        });
      });
      req.setTimeout(this.config.timeoutMs,()=>req.destroy(engineError.timeout(this.domain)));
      req.on('error',reject);req.end();
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
}
