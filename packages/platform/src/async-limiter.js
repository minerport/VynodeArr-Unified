export class AsyncLimiter {
  constructor(limit=2){this.limit=Math.max(1,Number(limit)||1);this.active=0;this.queue=[];}
  run(task){return new Promise((resolve,reject)=>{this.queue.push({task,resolve,reject});this.drain();});}
  drain(){while(this.active<this.limit&&this.queue.length){const item=this.queue.shift();this.active++;Promise.resolve().then(item.task).then(item.resolve,item.reject).finally(()=>{this.active--;this.drain();});}}
  setLimit(limit){this.limit=Math.max(1,Number(limit)||1);this.drain();}
  snapshot(){return{active:this.active,queued:this.queue.length,limit:this.limit};}
}
