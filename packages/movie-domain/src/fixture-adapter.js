const art = (id, kind = 'poster') => ({ url: `/art/${id}.svg`, kind, width: kind === 'poster' ? 400 : 1200, height: kind === 'poster' ? 600 : 675 });
const base = [
  { id:'movie_orbit-city', title:'Orbit City', year:2025, status:'released', monitoring:'all', hasFile:true, quality:'2160p HDR', qualityProfile:'Ultra HD', rootFolder:'/media/movies', collection:'Far Horizon', tags:['favorite'], state:'available', queue:null },
  { id:'movie_glass-tide', title:'The Glass Tide', year:2026, status:'announced', monitoring:'all', hasFile:false, quality:'Not available', qualityProfile:'HD', rootFolder:'/media/movies', collection:null, tags:[], state:'missing', queue:null },
  { id:'movie_signal-north', title:'Signal North', year:2024, status:'released', monitoring:'future', hasFile:true, quality:'1080p Blu-ray', qualityProfile:'HD', rootFolder:'/media/movies', collection:'Signal Archive', tags:['archive'], state:'cutoff', queue:{ progress:64, status:'downloading' } }
];
const movies = Object.freeze(base.map((movie, index) => Object.freeze({
  ...movie, artwork: art(`poster-movie-${index + 1}`),
  overview: `${movie.title} is deterministic review media used to validate the secure read-only VynodeNew experience.`,
  runtimeMinutes: 108 + index * 7, genres: ['Drama', index === 0 ? 'Science Fiction' : 'Mystery'],
  availability: movie.status, backdrop: art(`poster-movie-${index + 1}`, 'backdrop')
})));
const queue = [{ id:'movie_queue_demo', domain:'movie', mediaId:'movie_signal-north', title:'Signal North', context:null, artwork:movies[2].artwork, progress:64, eta:'2026-07-23T20:30:00Z', client:'Review client', status:'downloading', warning:null }];
const history = movies.map((movie, i) => ({ id:`movie_history_${i}`, domain:'movie', mediaId:movie.id, title:movie.title, artwork:movie.artwork, eventType:i ? 'downloaded' : 'imported', quality:movie.quality, timestamp:`2026-07-${20-i}T14:00:00Z`, details:'Read-only review event' }));
const calendar = movies.map((movie, i) => ({ id:`movie_calendar_${i}`, domain:'movie', mediaId:movie.id, title:movie.title, artwork:movie.artwork, dateUtc:`2026-08-0${i+2}T00:00:00Z`, eventType:'release' }));

export class MovieFixtureAdapter {
  constructor(config = { enabled:true, displayName:'Movies' }) { this.config = config; }
  async listMovies({ limit = 5000 } = {}) { return movies.slice(0, Math.min(limit, 5000)).map(({ overview, runtimeMinutes, genres, availability, backdrop, ...summary }) => summary); }
  async getMovie(id) { const movie = movies.find((item) => item.id === id); return movie ? { ...movie, recentHistory:history.filter((item)=>item.mediaId===id), calendar:calendar.filter((item)=>item.mediaId===id) } : null; }
  async getQueue() { return structuredClone(queue); }
  async getHistory() { return structuredClone(history); }
  async getCalendar() { return structuredClone(calendar); }
  async getHealth() { return []; }
  async getSystemStatus() { return { domain:'movie', version:'fixture-1', compatible:true, mode:'fixture' }; }
  async getArtwork(){return null;}
  async testConnection() { return { enabled:true, reachable:true, authenticated:true, compatible:true, latencyMs:0, capabilities:['library','details','queue','history','calendar','health','status'], safeError:null }; }
}
