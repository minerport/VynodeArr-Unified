export class PriorityWorkQueue {
  constructor(){this.active=null;this.pending=[];this.keys=new Map();}
  enqueue(key,task,{priority=0,label=key}={}){
    if(this.keys.has(key))return this.keys.get(key);
    let resolve,reject;
    const promise=new Promise((yes,no)=>{resolve=yes;reject=no;}),entry={key,task,priority,label,queuedAt:new Date().toISOString(),resolve,reject,promise};
    this.keys.set(key,promise);this.pending.push(entry);this.pending.sort((a,b)=>b.priority-a.priority||String(a.queuedAt).localeCompare(String(b.queuedAt)));this.drain();return promise;
  }
  drain(){if(this.active||!this.pending.length)return;const entry=this.pending.shift();this.active=entry;Promise.resolve().then(entry.task).then(entry.resolve,entry.reject).finally(()=>{this.keys.delete(entry.key);this.active=null;this.drain();});}
  snapshot(){return{active:this.active?{key:this.active.key,label:this.active.label,startedAt:this.active.startedAt||this.active.queuedAt}:null,queued:this.pending.map(item=>({key:item.key,label:item.label,priority:item.priority,queuedAt:item.queuedAt})),depth:this.pending.length};}
}
