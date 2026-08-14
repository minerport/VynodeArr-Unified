import test from 'node:test';
import assert from 'node:assert/strict';
import {MultiInstanceReadAdapter} from '../.server-build/packages/platform/src/multi-instance-read-adapter.js';

const adapter=(domain,id,title)=>({
  async listMovies(){return domain==='movie'?[{id:`movie_${id}`,title}]:[];},
  async listSeries(){return domain==='tv'?[{id:`series_${id}`,title}]:[];},
  async getMovie(value){return domain==='movie'&&Number(value)===id?{id:`movie_${id}`,title}:null;},
  async getMovieSummary(value){return this.getMovie(value);},
  async getSeries(value){return domain==='tv'&&Number(value)===id?{id:`series_${id}`,title,seasons:[]}:null;},
  async getSeriesSummary(value){return this.getSeries(value);},
  async getAttentionSummary(){return{missing:1,cutoff:2};},
  async getQueue(){return[{id:`queue_${id}`,mediaId:`${domain==='movie'?'movie':'series'}_${id}`}];},
  async getHistory(){return[];},async getHistorySince(){return[];},async getCalendar(){return[];},async getHealth(){return[];}
});

test('multi-instance reads preserve ownership and prevent numeric id collisions',async()=>{
  const combined=new MultiInstanceReadAdapter('movie',[
    {id:'primary',name:'Primary',isDefault:true,adapter:adapter('movie',7,'First Seven')},
    {id:'four-k',name:'4K',isDefault:false,adapter:adapter('movie',7,'Second Seven')}
  ]);
  const items=await combined.listMovies();
  assert.deepEqual(items.map(item=>item.id),['movie_primary_7','movie_four-k_7']);
  assert.deepEqual(items.map(item=>item.engineInstanceId),['primary','four-k']);
  assert.equal((await combined.getMovie('movie_four-k_7')).title,'Second Seven');
  assert.equal((await combined.getMovie('movie_7')).title,'First Seven');
  const queue=await combined.getQueue();
  assert.deepEqual(queue.map(item=>item.mediaId),['movie_primary_7','movie_four-k_7']);
});

test('one unavailable instance does not hide healthy instance records',async()=>{
  const unavailable={...adapter('movie',8,'Unavailable'),async listMovies(){throw new Error('offline');},async getQueue(){throw new Error('offline');},async getAttentionSummary(){throw new Error('offline');}};
  const combined=new MultiInstanceReadAdapter('movie',[{id:'offline',name:'Offline',isDefault:true,adapter:unavailable},{id:'healthy',name:'Healthy',adapter:adapter('movie',9,'Available')}]);
  assert.deepEqual((await combined.listMovies()).map(item=>item.id),['movie_healthy_9']);
  assert.deepEqual((await combined.getQueue()).map(item=>item.engineInstanceId),['healthy']);
  assert.deepEqual(await combined.getAttentionSummary(),{missing:1,cutoff:2});
});
