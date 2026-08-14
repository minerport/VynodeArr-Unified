import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class JsonStore {
  constructor(path, initialValue) { this.path=path;this.initialValue=initialValue;this.queue=Promise.resolve(); }
  async read() {
    try { return JSON.parse(await readFile(this.path,'utf8')); }
    catch(error) { if(error.code==='ENOENT')return structuredClone(this.initialValue);throw error; }
  }
  async write(value) {
    const operation=this.queue.catch(()=>{}).then(async()=>{
      await mkdir(dirname(this.path),{recursive:true});
      const temporary=`${this.path}.${process.pid}.tmp`;
      await writeFile(temporary,JSON.stringify(value,null,2),{mode:0o600});
      await rename(temporary,this.path);
    });
    this.queue=operation.catch(()=>{});
    return operation;
  }
  async update(mutator) {
    let result;
    const operation=this.queue.catch(()=>{}).then(async()=>{
      const current=await this.read();
      result=await mutator(current);
      await mkdir(dirname(this.path),{recursive:true});
      const temporary=`${this.path}.${process.pid}.tmp`;
      await writeFile(temporary,JSON.stringify(current,null,2),{mode:0o600});
      await rename(temporary,this.path);
    });
    this.queue=operation.catch(()=>{});
    await operation;return result;
  }
}
