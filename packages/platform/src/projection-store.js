import { JsonStore } from './json-store.js';

const hash = (value) => JSON.stringify(value);

export class ProjectionStore {
  constructor(path) {
    this.store=new JsonStore(path,{version:1,domains:{movie:[],tv:[]},operations:{queue:[],history:[],calendar:[],health:[]},updatedAt:null});
  }
  async load(){return this.store.read();}
  async replaceDomain(domain,items) {
    const current=await this.store.read(),existing=current.domains[domain]||[];
    if(hash(existing)===hash(items))return {updated:0,total:items.length,unchanged:true};
    return this.store.update((data)=>{
      const previous=new Map((data.domains[domain]||[]).map((item)=>[item.id,hash(item)]));
      const updated=items.filter((item)=>previous.get(item.id)!==hash(item)).length;
      data.domains[domain]=items;data.updatedAt=new Date().toISOString();
      return {updated,total:items.length};
    });
  }
  async replaceOperations(operations) {
    const current=await this.store.read();
    if(hash(current.operations)===hash(operations))return structuredClone(operations);
    return this.store.update((data)=>{data.operations=operations;data.updatedAt=new Date().toISOString();return structuredClone(operations);});
  }
  async domain(domain){return (await this.store.read()).domains[domain]||[];}
  async operations(){return (await this.store.read()).operations;}
}
