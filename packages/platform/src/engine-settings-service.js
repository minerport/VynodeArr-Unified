import { JsonStore } from './json-store.js';
import { EncryptedCredentialVault } from './credential-vault.js';
import { publicEngineConfiguration } from './engine-config.js';
import { randomUUID } from 'node:crypto';

const allowed=(value,displayName)=>({
  enabled:value.enabled!==false,host:String(value.host||'').trim(),port:Number(value.port),
  https:Boolean(value.https),urlBase:String(value.urlBase||'').replace(/^\/+|\/+$/g,''),
  timeoutMs:Math.min(60000,Math.max(250,Number(value.timeoutMs)||8000)),
  retries:Math.min(4,Math.max(0,Number(value.retries)||0)),tlsVerify:value.tlsVerify!==false,
  displayName,fixtureFallback:false
});

export class EngineSettingsService {
  constructor({path,vaultPath,masterKey,defaults,bundled=false}) {
    const source=bundled?'bundled':'external';this.store=new JsonStore(path,{version:4,configured:false,mode:source,pendingMode:null,modes:{movie:source,tv:source},pendingModes:{movie:null,tv:null},movie:null,tv:null,external:{movie:null,tv:null},instances:[],updatedAt:null});
    this.vault=new EncryptedCredentialVault(vaultPath,masterKey);this.defaults=defaults;this.bundled=bundled;this.value=null;
  }
  async initialize(){
    this.value=await this.store.read();
    if(!this.value.mode)this.value.mode=this.bundled?'bundled':'external';
    if(!this.value.external)this.value.external={movie:null,tv:null};
    if(!Array.isArray(this.value.instances))this.value.instances=[];
    if(!Object.hasOwn(this.value,'pendingMode'))this.value.pendingMode=null;
    if(!this.value.modes){const legacy=['bundled','external'].includes(this.value.mode)?this.value.mode:(this.bundled?'bundled':'external');this.value.modes={movie:legacy,tv:legacy};}
    if(!this.value.pendingModes)this.value.pendingModes={movie:this.value.pendingMode||null,tv:this.value.pendingMode||null};
    await this.#migrateExternalInstances();
    this.#syncLegacyModes();this.value.version=4;
    if(!this.configured()&&this.defaults?.dataMode==='engine'&&this.defaults.movie?.apiCredential&&this.defaults.tv?.apiCredential){
      await this.save('movie',this.defaults.movie,this.defaults.movie.apiCredential);
      await this.save('tv',this.defaults.tv,this.defaults.tv.apiCredential);
    } else await this.store.write(this.value);
  }
  mode(domain){if(domain)return this.value?.modes?.[domain]||(this.bundled?'bundled':'external');const values=['movie','tv'].map(value=>this.mode(value));return values[0]===values[1]?values[0]:'mixed';}
  pendingMode(domain){if(domain)return this.value?.pendingModes?.[domain]||null;const values=['movie','tv'].map(value=>this.pendingMode(value)).filter(Boolean);return values.length?(values.every(value=>value===values[0])?values[0]:'mixed'):null;}
  configured(){return Boolean(this.value?.configured&&this.value.movie&&this.value.tv);}
  async runtime(){
    if(!this.configured())return null;
    const [movieCredential,tvCredential]=await Promise.all([this.vault.get('movie'),this.vault.get('tv')]);
    return{movie:{...this.value.movie,apiCredential:movieCredential||''},tv:{...this.value.tv,apiCredential:tvCredential||''}};
  }
  public(){
    const domain=(name,displayName)=>this.value?.[name]?{...publicEngineConfiguration({...this.value[name],apiCredential:'configured'}),host:this.value[name].host,port:this.value[name].port,urlBase:this.value[name].urlBase,configured:true}:{...publicEngineConfiguration(this.defaults[name]),host:'',port:this.defaults[name].port,urlBase:'',configured:false,displayName};
    const externalDomain=(name,displayName)=>this.value?.external?.[name]?{...publicEngineConfiguration({...this.value.external[name],apiCredential:'configured'}),host:this.value.external[name].host,port:this.value.external[name].port,urlBase:this.value.external[name].urlBase,configured:true}:{...publicEngineConfiguration(this.defaults[name]),host:'',port:this.defaults[name].port,urlBase:'',configured:false,displayName};
    return{configured:this.configured(),mode:this.mode(),pendingMode:this.pendingMode(),modes:{movie:this.mode('movie'),tv:this.mode('tv')},pendingModes:{movie:this.pendingMode('movie'),tv:this.pendingMode('tv')},restartRequired:Boolean(this.pendingMode()),movie:domain('movie','Movies'),tv:domain('tv','TV'),external:{movie:externalDomain('movie','Movies'),tv:externalDomain('tv','TV')},instances:this.value.instances.map(instance=>this.#publicInstance(instance)),updatedAt:this.value?.updatedAt||null};
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
    const current=this.#defaultInstance(domain);
    if(current)return this.updateInstance(current.id,{...input,name:current.name,enabled:true,isDefault:true},credential);
    return this.createInstance(domain,{...input,name:domain==='movie'?'Primary Movies':'Primary TV',enabled:true,isDefault:true},credential);
  }
  async externalRuntime(){
    const [movie,tv]=await Promise.all([this.defaultInstanceRuntime('movie'),this.defaultInstanceRuntime('tv')]);
    return movie&&tv?{movie,tv}:null;
  }

  async createInstance(domain,input,credential){
    this.#assertDomain(domain);
    const config=this.normalize(domain,input),name=String(input.name||'').trim();
    if(!name)throw new Error('Instance name is required');
    if(this.value.instances.some(instance=>instance.domain===domain&&instance.name.toLowerCase()===name.toLowerCase()))throw new Error(`A ${domain==='movie'?'movie':'TV'} instance named ${name} already exists`);
    if(!config.host||!Number.isInteger(config.port)||config.port<1||config.port>65535)throw new Error('Enter a valid host and port');
    if(!credential)throw new Error('API key is required');
    const now=new Date().toISOString(),makeDefault=input.isDefault===true||!this.#defaultInstance(domain),instance={id:randomUUID(),name,domain,...config,enabled:input.enabled!==false,isDefault:makeDefault,createdAt:now,updatedAt:now};
    if(makeDefault)for(const item of this.value.instances)if(item.domain===domain)item.isDefault=false;
    this.value.instances.push(instance);
    if(instance.isDefault)this.value.external[domain]=config;
    await this.vault.replace(this.#instanceCredentialKey(instance.id),credential);
    await this.#persist();
    return this.#publicInstance(instance);
  }

  async updateInstance(id,input,credential=''){
    const instance=this.#instance(id);if(!instance)throw new Error('Engine instance was not found');
    const config=this.normalize(instance.domain,{...instance,...input}),name=String(input.name??instance.name).trim();
    if(!name)throw new Error('Instance name is required');
    if(this.value.instances.some(item=>item.id!==id&&item.domain===instance.domain&&item.name.toLowerCase()===name.toLowerCase()))throw new Error(`A ${instance.domain==='movie'?'movie':'TV'} instance named ${name} already exists`);
    if(!config.host||!Number.isInteger(config.port)||config.port<1||config.port>65535)throw new Error('Enter a valid host and port');
    Object.assign(instance,config,{name,enabled:input.enabled!==false,updatedAt:new Date().toISOString()});
    if(input.isDefault===true)this.#setDefaultInMemory(instance.domain,instance.id);
    if(credential)await this.vault.replace(this.#instanceCredentialKey(instance.id),credential);
    if(instance.isDefault)this.value.external[instance.domain]=this.normalize(instance.domain,instance);
    await this.#persist();return this.#publicInstance(instance);
  }

  async removeInstance(id){
    const instance=this.#instance(id);if(!instance)throw new Error('Engine instance was not found');
    if(instance.isDefault&&this.value.instances.some(item=>item.domain===instance.domain&&item.id!==id))throw new Error('Choose another default instance before removing this one');
    this.value.instances=this.value.instances.filter(item=>item.id!==id);
    await this.vault.remove(this.#instanceCredentialKey(id));
    if(instance.isDefault)this.value.external[instance.domain]=null;
    await this.#persist();return this.public();
  }

  async setDefaultInstance(id){
    const instance=this.#instance(id);if(!instance)throw new Error('Engine instance was not found');
    const credential=await this.vault.get(this.#instanceCredentialKey(id));
    if(!credential)throw new Error('The selected instance has no saved API key');
    this.#setDefaultInMemory(instance.domain,id);this.value.external[instance.domain]=this.normalize(instance.domain,instance);
    await this.#persist();return this.public();
  }

  async instanceRuntime(id){
    const instance=this.#instance(id);if(!instance||instance.enabled===false)return null;
    const credential=await this.vault.get(this.#instanceCredentialKey(id));
    return credential?{...this.normalize(instance.domain,instance),id:instance.id,name:instance.name,domain:instance.domain,apiCredential:credential}:null;
  }
  async defaultInstanceRuntime(domain){const instance=this.#defaultInstance(domain);return instance?this.instanceRuntime(instance.id):null;}

  #assertDomain(domain){if(!['movie','tv'].includes(domain))throw new Error('Choose a movie or TV engine');}
  #instance(id){return this.value.instances.find(instance=>instance.id===id);}
  #defaultInstance(domain){return this.value.instances.find(instance=>instance.domain===domain&&instance.isDefault)||this.value.instances.find(instance=>instance.domain===domain);}
  #instanceCredentialKey(id){return `external-instance:${id}`;}
  #setDefaultInMemory(domain,id){for(const instance of this.value.instances)if(instance.domain===domain)instance.isDefault=instance.id===id;const pending=this.#instance(id);if(pending)pending.isDefault=true;}
  #publicInstance(instance){return{id:instance.id,name:instance.name,domain:instance.domain,enabled:instance.enabled!==false,isDefault:Boolean(instance.isDefault),createdAt:instance.createdAt,updatedAt:instance.updatedAt,...publicEngineConfiguration({...instance,apiCredential:'configured'}),host:instance.host,port:instance.port,urlBase:instance.urlBase,configured:true,credentialConfigured:true};}
  async #persist(){this.value.updatedAt=new Date().toISOString();this.value.version=4;await this.store.write(this.value);}
  async #migrateExternalInstances(){
    for(const domain of ['movie','tv']){
      const legacy=this.value.external?.[domain];if(!legacy||this.value.instances.some(instance=>instance.domain===domain))continue;
      const id=`external-${domain}-default`,now=this.value.updatedAt||new Date().toISOString();
      this.value.instances.push({id,name:domain==='movie'?'Primary Movies':'Primary TV',domain,...this.normalize(domain,legacy),enabled:true,isDefault:true,createdAt:now,updatedAt:now});
      const credential=await this.vault.get(`external:${domain}`);if(credential)await this.vault.replace(this.#instanceCredentialKey(id),credential);
    }
    for(const domain of ['movie','tv']){const values=this.value.instances.filter(instance=>instance.domain===domain);if(values.length&&!values.some(instance=>instance.isDefault))values[0].isDefault=true;}
  }
  async requestMode(domain,mode){
    if(mode===undefined){mode=domain;for(const value of ['movie','tv'])await this.requestMode(value,mode);return this.public();}
    this.#assertDomain(domain);
    if(!['bundled','external'].includes(mode))throw new Error('Choose bundled or external engine mode');
    if(mode==='external'&&!await this.defaultInstanceRuntime(domain))throw new Error(`Validate and save an external ${domain==='movie'?'movie':'TV'} engine before switching modes`);
    this.value.pendingModes[domain]=mode===this.mode(domain)?null:mode;this.#syncLegacyModes();this.value.updatedAt=new Date().toISOString();await this.store.write(this.value);return this.public();
  }
  async applyPendingMode(){
    if(!this.pendingMode())return false;
    for(const domain of ['movie','tv']){const next=this.pendingMode(domain);if(!next)continue;if(next==='external'){const runtime=await this.defaultInstanceRuntime(domain);if(!runtime)throw new Error(`External ${domain} engine credentials are incomplete`);this.value[domain]=this.normalize(domain,runtime);await this.vault.replace(domain,runtime.apiCredential);}else{this.value[domain]=this.normalize(domain,this.defaults[domain]);if(this.defaults[domain].apiCredential)await this.vault.replace(domain,this.defaults[domain].apiCredential);}this.value.modes[domain]=next;this.value.pendingModes[domain]=null;}
    this.#syncLegacyModes();this.value.configured=Boolean(this.value.movie&&this.value.tv);this.value.updatedAt=new Date().toISOString();await this.store.write(this.value);return true;
  }
  #syncLegacyModes(){const modes=this.value.modes||{},pending=this.value.pendingModes||{};this.value.mode=modes.movie===modes.tv?modes.movie:'mixed';this.value.pendingMode=pending.movie===pending.tv?pending.movie:(pending.movie||pending.tv?'mixed':null);}
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
