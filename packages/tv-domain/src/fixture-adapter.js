const art = (id, kind = 'poster') => ({ url:`/art/${id}.svg`, kind, width:kind === 'poster' ? 400 : 1200, height:kind === 'poster' ? 600 : 675 });
const base = [
  { id:'series_afterlight', title:'Afterlight', year:2025, network:'Northstar', status:'continuing', monitoring:'future', seasonProgress:'2 / 3', episodeProgress:'18 / 24', missingEpisodes:2, cutoffUnmetEpisodes:1, nextEpisode:{title:'The Quiet Vector',airDateUtc:'2026-08-02T01:00:00Z'}, qualityProfile:'Ultra HD', rootFolder:'/media/tv', tags:['weekly'], queue:null },
  { id:'series_low-country', title:'Low Country', year:2023, network:'Mosaic', status:'ended', monitoring:'all', seasonProgress:'4 / 4', episodeProgress:'40 / 40', missingEpisodes:0, cutoffUnmetEpisodes:0, nextEpisode:null, qualityProfile:'HD', rootFolder:'/media/tv', tags:['complete'], queue:null },
  { id:'series_neon-kite', title:'Neon Kite', year:2026, network:'Vector+', status:'continuing', monitoring:'all', seasonProgress:'1 / 1', episodeProgress:'7 / 12', missingEpisodes:1, cutoffUnmetEpisodes:0, nextEpisode:{title:'Frame Eight',airDateUtc:'2026-07-29T03:00:00Z'}, qualityProfile:'HD', rootFolder:'/media/tv', tags:['anime'], queue:{progress:38,status:'downloading'} }
];
const series = Object.freeze(base.map((item,index)=>Object.freeze({
  ...item, artwork:art(`poster-tv-${index+1}`), backdrop:art(`poster-tv-${index+1}`,'backdrop'),
  overview:`${item.title} is deterministic episodic review media for VynodeNew.`, genres:['Drama'], seriesType:index===2?'anime':'standard',
  seasons:[{seasonNumber:1,monitored:true,episodeCount:12,episodeFileCount:index===1?12:7,percentComplete:index===1?100:58,episodes:[
    {id:`episode_${index}_1`,title:'Opening Signal',episodeNumber:1,absoluteNumber:index===2?1:null,airDateUtc:'2026-07-01T00:00:00Z',monitored:true,hasFile:true,quality:'1080p'},
    {id:`episode_${index}_2`,title:'Second Light',episodeNumber:2,absoluteNumber:index===2?2:null,airDateUtc:'2026-07-08T00:00:00Z',monitored:true,hasFile:index===1,quality:index===1?'1080p':null}
  ]}]
})));
const queue=[{id:'tv_queue_demo',domain:'tv',mediaId:'series_neon-kite',title:'Neon Kite',context:'Frame Eight',artwork:series[2].artwork,progress:38,eta:'2026-07-23T21:00:00Z',client:'Review client',status:'downloading',warning:null}];
const history=series.map((item,i)=>({id:`tv_history_${i}`,domain:'tv',mediaId:item.id,title:item.title,artwork:item.artwork,eventType:'episodeFileImported',quality:'1080p',timestamp:`2026-07-${19-i}T14:00:00Z`,details:'Read-only review event'}));
const calendar=series.filter((item)=>item.nextEpisode).map((item,i)=>({id:`tv_calendar_${i}`,domain:'tv',mediaId:item.id,title:item.title,context:item.nextEpisode.title,artwork:item.artwork,dateUtc:item.nextEpisode.airDateUtc,eventType:'airing'}));

export class TvFixtureAdapter {
  constructor(config={enabled:true,displayName:'TV'}){this.config=config;}
  async listSeries({limit=5000}={}){return series.slice(0,Math.min(limit,5000)).map(({backdrop,overview,genres,seriesType,seasons,...summary})=>summary);}
  async getSeries(id){const item=series.find((candidate)=>candidate.id===id);return item?{...item,recentHistory:history.filter((event)=>event.mediaId===id),calendar:calendar.filter((event)=>event.mediaId===id)}:null;}
  async getQueue(){return structuredClone(queue);} async getHistory(){return structuredClone(history);}
  async getCalendar(){return structuredClone(calendar);} async getHealth(){return [];}
  async getSystemStatus(){return{domain:'tv',version:'fixture-1',compatible:true,mode:'fixture'};}
  async getArtwork(){return null;}
  async testConnection(){return{enabled:true,reachable:true,authenticated:true,compatible:true,latencyMs:0,capabilities:['library','details','episodes','queue','history','calendar','health','status'],safeError:null};}
}
