import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {JsonStore} from '../packages/platform/src/json-store.js';

const pause=()=>new Promise(resolve=>setTimeout(resolve,25));

test('JsonStore skips atomic replacement when an update makes no change',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-json-store-'));
  const path=join(directory,'state.json');
  const store=new JsonStore(path,{version:1,events:[]});
  try{
    await store.write({version:1,events:[{id:'one'}]});
    const before=await stat(path,{bigint:true});
    await pause();
    await store.update(current=>current.events.find(item=>item.id==='one'));
    const after=await stat(path,{bigint:true});
    assert.equal(after.mtimeNs,before.mtimeNs);
    assert.equal(after.ino,before.ino);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('JsonStore still atomically persists material updates',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-json-store-'));
  const path=join(directory,'state.json');
  const store=new JsonStore(path,{version:1,events:[]});
  try{
    await store.write({version:1,events:[]});
    await pause();
    await store.update(current=>current.events.push({id:'one'}));
    assert.deepEqual(JSON.parse(await readFile(path,'utf8')),{version:1,events:[{id:'one'}]});
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('JsonStore write reports and skips identical serialized state',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vynodearr-json-store-'));
  const path=join(directory,'state.json');
  const store=new JsonStore(path,{version:1});
  try{
    assert.equal(await store.write({version:1}),true);
    const before=await stat(path,{bigint:true});
    await pause();
    assert.equal(await store.write({version:1}),false);
    const after=await stat(path,{bigint:true});
    assert.equal(after.mtimeNs,before.mtimeNs);
    assert.equal(after.ino,before.ino);
  }finally{await rm(directory,{recursive:true,force:true});}
});
