import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const generatedKey=()=>randomBytes(48).toString('base64url');
const legacyKey=()=>['local','development','key','change','me','2026'].join('-');

export class MasterKeyService {
  constructor({path,vaultPath,configuredKey=''}) {
    this.path=path;
    this.pendingPath=`${path}.next`;
    this.vaultPath=vaultPath;
    this.configuredKey=String(configuredKey||'').trim();
    this.source=this.configuredKey?'environment':'generated';
    this.pendingKey='';
    this.currentKey='';
  }
  resolve(){
    if(this.configuredKey){this.currentKey=this.configuredKey;return this.configuredKey;}
    const stored=existsSync(this.path)?readFileSync(this.path,'utf8').trim():'';
    const pending=existsSync(this.pendingPath)?readFileSync(this.pendingPath,'utf8').trim():'';
    if(pending){
      this.source='file';this.pendingKey=pending;this.currentKey=stored||legacyKey();
      return[pending,this.currentKey];
    }
    if(stored){this.source='file';this.currentKey=stored;return stored;}
    if(existsSync(this.vaultPath)){
      this.source='legacy';this.currentKey=legacyKey();return this.currentKey;
    }
    const key=generatedKey();
    this.#persist(key);
    this.source='generated';this.currentKey=key;
    return key;
  }
  async initialize(engineSettings){
    if(this.configuredKey)return;
    if(this.pendingKey){
      await engineSettings.rotateMasterKey(this.pendingKey);
      this.#promotePending();
      this.currentKey=this.pendingKey;this.pendingKey='';this.source='file';
      return;
    }
    if(this.source==='legacy'){
      await this.rotate(engineSettings);
      this.source='migrated';
    }
  }
  status(){
    return{
      managed:!this.configuredKey,
      source:this.configuredKey?'environment':this.source,
      canRotate:!this.configuredKey,
      storage:this.configuredKey?'Environment or secret file':'Persistent application configuration'
    };
  }
  async rotate(engineSettings){
    if(this.configuredKey)throw Object.assign(new Error('This master key is managed by the environment. Update VYNODEARR_MASTER_KEY or VYNODEARR_MASTER_KEY_FILE and recreate the container to rotate it.'),{code:'master_key_environment_managed'});
    const next=generatedKey();
    this.#write(this.pendingPath,next);
    try{
      await engineSettings.rotateMasterKey(next);
      this.#promotePending();
      this.currentKey=next;this.source='file';
      return this.status();
    }catch(error){
      rmSync(this.pendingPath,{force:true});
      throw error;
    }
  }
  #write(path,value){
    mkdirSync(dirname(path),{recursive:true});
    writeFileSync(path,value,{mode:0o600});
  }
  #persist(value){
    const temporary=`${this.path}.tmp`;
    this.#write(temporary,value);
    renameSync(temporary,this.path);
  }
  #promotePending(){
    this.#persist(readFileSync(this.pendingPath,'utf8').trim());
    rmSync(this.pendingPath,{force:true});
  }
}
