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
      const nextIds=new Set(items.map((item)=>item.id)),removed=[...previous.keys()].filter((id)=>!nextIds.has(id)).length;
      const updated=items.filter((item)=>previous.get(item.id)!==hash(item)).length+removed;
      data.domains[domain]=items;data.updatedAt=new Date().toISOString();
      return {updated,removed,total:items.length};
    });
  }
  async upsertDomainItem(domain,item) {
    if(!item?.id)throw new TypeError('A projected item with an id is required');
    return this.store.update((data)=>{
      const items=data.domains[domain]||[],index=items.findIndex((candidate)=>candidate.id===item.id);
      if(index>=0&&hash(items[index])===hash(item))return {updated:0,total:items.length,item:structuredClone(items[index]),unchanged:true};
      if(index>=0)items[index]=item;else items.push(item);
      data.domains[domain]=items;data.updatedAt=new Date().toISOString();
      return {updated:1,total:items.length,item:structuredClone(item),created:index<0};
    });
  }
  async removeDomainItem(domain,id) {
    return this.store.update((data)=>{
      const items=data.domains[domain]||[],next=items.filter((item)=>item.id!==id),removed=items.length-next.length;
      if(removed){data.domains[domain]=next;data.updatedAt=new Date().toISOString();}
      return {removed,total:next.length};
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
