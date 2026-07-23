import { JsonStore } from './json-store.js';
import { EncryptedCredentialVault } from './credential-vault.js';
import { publicEngineConfiguration } from './engine-config.js';

const allowed=(value,displayName)=>({
  enabled:value.enabled!==false,host:String(value.host||'').trim(),port:Number(value.port),
  https:Boolean(value.https),urlBase:String(value.urlBase||'').replace(/^\/+|\/+$/g,''),
  timeoutMs:Math.min(60000,Math.max(250,Number(value.timeoutMs)||8000)),
  retries:Math.min(4,Math.max(0,Number(value.retries)||0)),tlsVerify:value.tlsVerify!==false,
  displayName,fixtureFallback:false
});

export class EngineSettingsService {
  constructor({path,vaultPath,masterKey,defaults}) {
    this.store=new JsonStore(path,{version:1,configured:false,movie:null,tv:null,updatedAt:null});
    this.vault=new EncryptedCredentialVault(vaultPath,masterKey);this.defaults=defaults;this.value=null;
  }
  async initialize(){this.value=await this.store.read();}
  configured(){return Boolean(this.value?.configured&&this.value.movie&&this.value.tv);}
  async runtime(){
    if(!this.configured())return null;
    const [movieCredential,tvCredential]=await Promise.all([this.vault.get('movie'),this.vault.get('tv')]);
    return{movie:{...this.value.movie,apiCredential:movieCredential||''},tv:{...this.value.tv,apiCredential:tvCredential||''}};
  }
  public(){
    const domain=(name,displayName)=>this.value?.[name]?{...publicEngineConfiguration({...this.value[name],apiCredential:'configured'}),host:this.value[name].host,port:this.value[name].port,urlBase:this.value[name].urlBase,configured:true}:{...publicEngineConfiguration(this.defaults[name]),host:'',port:this.defaults[name].port,urlBase:'',configured:false,displayName};
    return{configured:this.configured(),movie:domain('movie','Movies'),tv:domain('tv','TV'),updatedAt:this.value?.updatedAt||null};
  }
  normalize(domain,input){return allowed(input,domain==='movie'?'Movies':'TV');}
  async save(domain,input,credential){
    const config=this.normalize(domain,input);if(!config.host||!Number.isInteger(config.port)||config.port<1||config.port>65535)throw new Error('Enter a valid internal host and port');
    if(!credential)throw new Error('API key is required');
    await this.vault.replace(domain,credential);this.value[domain]=config;
    this.value.configured=Boolean(this.value.movie&&this.value.tv);this.value.updatedAt=new Date().toISOString();await this.store.write(this.value);
    return this.public();
  }
  async remove(domain){await this.vault.remove(domain);this.value[domain]=null;this.value.configured=false;this.value.updatedAt=new Date().toISOString();await this.store.write(this.value);}
}
