import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EncryptedCredentialVault } from '../packages/platform/src/credential-vault.js';
import { MasterKeyService } from '../packages/platform/src/master-key-service.js';

const temporary=()=>mkdtemp(join(tmpdir(),'vynodearr-master-key-'));

test('first run generates and persists a unique master key',async()=>{
  const root=await temporary(),path=join(root,'master-key'),vaultPath=join(root,'credentials.enc');
  const first=new MasterKeyService({path,vaultPath}),key=first.resolve();
  assert.equal(typeof key,'string');
  assert.ok(key.length>=64);
  assert.equal((await readFile(path,'utf8')).trim(),key);
  const second=new MasterKeyService({path,vaultPath});
  assert.equal(second.resolve(),key);
  assert.equal(second.status().managed,true);
});

test('rotation preserves credentials and replaces the persisted key',async()=>{
  const root=await temporary(),path=join(root,'master-key'),vaultPath=join(root,'credentials.enc');
  const manager=new MasterKeyService({path,vaultPath}),original=manager.resolve();
  const vault=new EncryptedCredentialVault(vaultPath,original);
  await vault.replace('movie','radarr-secret');
  await vault.replace('tv','sonarr-secret');
  const settings={rotateMasterKey:key=>vault.rotate(key)};
  await manager.rotate(settings);
  const replacement=(await readFile(path,'utf8')).trim();
  assert.notEqual(replacement,original);
  assert.equal(await vault.get('movie'),'radarr-secret');
  assert.equal(await vault.get('tv'),'sonarr-secret');
  await assert.rejects(()=>new EncryptedCredentialVault(vaultPath,original).get('movie'));
  assert.equal(await new EncryptedCredentialVault(vaultPath,replacement).get('movie'),'radarr-secret');
});

test('legacy vault is migrated without losing credentials',async()=>{
  const root=await temporary(),path=join(root,'master-key'),vaultPath=join(root,'credentials.enc');
  const oldKey=['local','development','key','change','me','2026'].join('-');
  const oldVault=new EncryptedCredentialVault(vaultPath,oldKey);
  await oldVault.replace('tmdb','discovery-secret');
  const manager=new MasterKeyService({path,vaultPath}),resolved=manager.resolve();
  assert.equal(resolved,oldKey);
  const vault=new EncryptedCredentialVault(vaultPath,resolved);
  await manager.initialize({rotateMasterKey:key=>vault.rotate(key)});
  const replacement=(await readFile(path,'utf8')).trim();
  assert.notEqual(replacement,oldKey);
  assert.equal(await vault.get('tmdb'),'discovery-secret');
  assert.equal(manager.status().source,'migrated');
});

test('environment-managed master keys cannot be rotated in the app',async()=>{
  const root=await temporary(),configuredKey='environment-secret-at-least-24-characters';
  const manager=new MasterKeyService({path:join(root,'master-key'),vaultPath:join(root,'credentials.enc'),configuredKey});
  assert.equal(manager.resolve(),configuredKey);
  assert.equal(manager.status().canRotate,false);
  await assert.rejects(()=>manager.rotate({rotateMasterKey:async()=>{}}),{code:'master_key_environment_managed'});
});
