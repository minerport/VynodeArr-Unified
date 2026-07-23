import { assertModel } from '../../contracts/src/models.js';

const movies = Object.freeze([
  {
    id: 'movie-orbit-city', title: 'Orbit City', year: 2025,
    artwork: { url: '/art/poster-movie-1.svg', kind: 'poster', width: 400, height: 600 },
    status: 'released', monitoring: 'all', hasFile: true, quality: '2160p HDR',
    collection: 'Far Horizon', state: 'available'
  },
  {
    id: 'movie-glass-tide', title: 'The Glass Tide', year: 2026,
    artwork: { url: '/art/poster-movie-2.svg', kind: 'poster', width: 400, height: 600 },
    status: 'announced', monitoring: 'all', hasFile: false, quality: '1080p',
    collection: null, state: 'missing'
  },
  {
    id: 'movie-signal-north', title: 'Signal North', year: 2024,
    artwork: { url: '/art/poster-movie-3.svg', kind: 'poster', width: 400, height: 600 },
    status: 'released', monitoring: 'future', hasFile: true, quality: '1080p Blu-ray',
    collection: 'Signal Archive', state: 'cutoff'
  }
].map((movie) => Object.freeze(assertModel('MovieSummary', movie))));

const unavailable = async () => { throw new Error('Write operations are disabled for the N1 fixture adapter'); };

export class MovieFixtureAdapter {
  async listMovies({ limit = 24 } = {}) { return movies.slice(0, Math.max(0, Math.min(limit, 50))); }
  async getMovie(id) { return movies.find((movie) => movie.id === id) ?? null; }
  async searchMovies(query) { return movies.filter((movie) => movie.title.toLowerCase().includes(String(query).toLowerCase())); }
  addMovie = unavailable; updateMovie = unavailable; deleteMovieRecord = unavailable;
  refreshMovie = unavailable; scanMovie = unavailable;
  async searchMovieReleases() { return []; }
  async searchMissingMovies() { return movies.filter((movie) => !movie.hasFile); }
  async searchCutoffUnmetMovies() { return movies.filter((movie) => movie.state === 'cutoff'); }
  async getMovieFiles(id) { return movies.find((movie) => movie.id === id)?.hasFile ? [{ id: `${id}-file`, quality: '1080p' }] : []; }
  async getMovieHistory() { return []; }
  async getMovieCalendar() { return []; }
  async getMovieCollections() { return [...new Set(movies.map((movie) => movie.collection).filter(Boolean))]; }
}
