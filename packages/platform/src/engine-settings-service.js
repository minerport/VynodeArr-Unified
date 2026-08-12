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
  constructor({path,vaultPath,masterKey,defaults,bundled=false}) {
    this.store=new JsonStore(path,{version:2,configured:false,mode:bundled?'bundled':'external',pendingMode:null,movie:null,tv:null,external:{movie:null,tv:null},updatedAt:null});
    this.vault=new EncryptedCredentialVault(vaultPath,masterKey);this.defaults=defaults;this.bundled=bundled;this.value=null;
  }
  async initialize(){
    this.value=await this.store.read();
    if(!this.value.mode)this.value.mode=this.bundled?'bundled':'external';
    if(!this.value.external)this.value.external={movie:null,tv:null};
    if(!Object.hasOwn(this.value,'pendingMode'))this.value.pendingMode=null;
    this.value.version=2;
    if(!this.configured()&&this.defaults?.dataMode==='engine'&&this.defaults.movie?.apiCredential&&this.defaults.tv?.apiCredential){
      await this.save('movie',this.defaults.movie,this.defaults.movie.apiCredential);
      await this.save('tv',this.defaults.tv,this.defaults.tv.apiCredential);
    } else await this.store.write(this.value);
  }
  mode(){return this.value?.mode|| (this.bundled?'bundled':'external');}
  pendingMode(){return this.value?.pendingMode||null;}
  configured(){return Boolean(this.value?.configured&&this.value.movie&&this.value.tv);}
  async runtime(){
    if(!this.configured())return null;
    const [movieCredential,tvCredential]=await Promise.all([this.vault.get('movie'),this.vault.get('tv')]);
    return{movie:{...this.value.movie,apiCredential:movieCredential||''},tv:{...this.value.tv,apiCredential:tvCredential||''}};
  }
  public(){
    const domain=(name,displayName)=>this.value?.[name]?{...publicEngineConfiguration({...this.value[name],apiCredential:'configured'}),host:this.value[name].host,port:this.value[name].port,urlBase:this.value[name].urlBase,configured:true}:{...publicEngineConfiguration(this.defaults[name]),host:'',port:this.defaults[name].port,urlBase:'',configured:false,displayName};
    const externalDomain=(name,displayName)=>this.value?.external?.[name]?{...publicEngineConfiguration({...this.value.external[name],apiCredential:'configured'}),host:this.value.external[name].host,port:this.value.external[name].port,urlBase:this.value.external[name].urlBase,configured:true}:{...publicEngineConfiguration(this.defaults[name]),host:'',port:this.defaults[name].port,urlBase:'',configured:false,displayName};
    return{configured:this.configured(),mode:this.mode(),pendingMode:this.pendingMode(),restartRequired:Boolean(this.pendingMode()),movie:domain('movie','Movies'),tv:domain('tv','TV'),external:{movie:externalDomain('movie','Movies'),tv:externalDomain('tv','TV')},updatedAt:this.value?.updatedAt||null};
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
  async saveExternal(domain,input,credential){
    const config=this.normalize(domain,input);if(!config.host||!Number.isInteger(config.port)||config.port<1||config.port>65535)throw new Error('Enter a valid host and port');
    if(!credential&&!this.value.external?.[domain])throw new Error('API key is required');
    if(credential)await this.vault.replace(`external:${domain}`,credential);
    this.value.external[domain]=config;this.value.updatedAt=new Date().toISOString();await this.store.write(this.value);return this.public();
  }
  async externalRuntime(){
    if(!this.value?.external?.movie||!this.value?.external?.tv)return null;
    const [movieCredential,tvCredential]=await Promise.all([this.vault.get('external:movie'),this.vault.get('external:tv')]);
    if(!movieCredential||!tvCredential)return null;
    return{movie:{...this.value.external.movie,apiCredential:movieCredential},tv:{...this.value.external.tv,apiCredential:tvCredential}};
  }
  async requestMode(mode){
    if(!['bundled','external'].includes(mode))throw new Error('Choose bundled or external engine mode');
    if(mode==='external'&&!await this.externalRuntime())throw new Error('Validate and save both external engines before switching modes');
    this.value.pendingMode=mode===this.mode()?null:mode;this.value.updatedAt=new Date().toISOString();await this.store.write(this.value);return this.public();
  }
  async applyPendingMode(){
    if(!this.value?.pendingMode)return false;
    const next=this.value.pendingMode;
    if(next==='external'){
      const runtime=await this.externalRuntime();if(!runtime)throw new Error('External engine credentials are incomplete');
      for(const domain of ['movie','tv']){this.value[domain]=this.normalize(domain,runtime[domain]);await this.vault.replace(domain,runtime[domain].apiCredential);}
    }else{
      for(const domain of ['movie','tv']){this.value[domain]=this.normalize(domain,this.defaults[domain]);if(this.defaults[domain].apiCredential)await this.vault.replace(domain,this.defaults[domain].apiCredential);}
    }
    this.value.mode=next;this.value.pendingMode=null;this.value.configured=Boolean(this.value.movie&&this.value.tv);this.value.updatedAt=new Date().toISOString();await this.store.write(this.value);return true;
  }
  async discoveryCredential(){return await this.vault.get('tmdb')||'';}
  async saveDiscoveryCredential(credential){
    const value=String(credential||'').trim();if(!value)throw new Error('TMDB read access token is required');
    await this.vault.replace('tmdb',value);return{configured:true};
  }
  async removeDiscoveryCredential(){await this.vault.remove('tmdb');return{configured:false};}
  async plexCredential(){return await this.vault.get('plex')||'';}
  async savePlexCredential(credential){const value=String(credential||'').trim();if(!value)throw new Error('Plex access token is required');await this.vault.replace('plex',value);}
  async removePlexCredential(){await this.vault.remove('plex');}
  async reeltrackCredential(userId){return await this.vault.get(`reeltrack:${userId}`)||'';}
  async saveReeltrackCredential(userId,credential){const value=String(credential||'').trim();if(!value)throw new Error('Reeltrack API key is required');await this.vault.replace(`reeltrack:${userId}`,value);}
  async removeReeltrackCredential(userId){await this.vault.remove(`reeltrack:${userId}`);}
  async notificationCredential(id){return await this.vault.get(`notification:${id}`)||'';}
  async saveNotificationCredential(id,credential){const value=String(credential||'').trim();if(!value)throw new Error('Notification credential is required');await this.vault.replace(`notification:${id}`,value);}
  async removeNotificationCredential(id){await this.vault.remove(`notification:${id}`);}
  async rotateMasterKey(masterKey){await this.vault.rotate(masterKey);}
}
