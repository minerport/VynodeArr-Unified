// Local-only, disposable fixture server for Android emulator and browser QA.
// Never uses real engines, metadata credentials, or the installation data directory.
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryCatalogStore } from '../.server-build/packages/platform/src/library-catalog-store.js';
import { createApplication } from '../.server-build/apps/api/src/app.js';
import { MovieFixtureAdapter } from '../.server-build/packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../.server-build/packages/tv-domain/src/fixture-adapter.js';

const directory = await mkdtemp(join(tmpdir(), 'vynodearr-companion-review-'));
const titles = ['Orbit City', 'The Glass Tide', 'Signal North', 'Far Horizon', 'The Last Station', 'Summer on Mars', 'Blue Meridian', 'After the Rain', 'The Crossing', 'Wild Country', 'Nightfall', 'Beyond the Sun', 'Open Water', 'The Long Way Home', 'Northern Lights', 'Silent Earth', 'Deep Field', 'Tomorrow Again'];
// Illustrative Unsplash photography for fictional review titles, never production metadata.
const reviewPhotos = ['photo-1446776811953-b23d57bd21aa', 'photo-1518837695005-2083093ee35b', 'photo-1469474968028-56623f02e42e', 'photo-1470770841072-f978cf4d019e', 'photo-1519608487953-e999c86e7455', 'photo-1462331940025-496dfbfc7564'];
const reviewArt = id => `https://images.unsplash.com/${reviewPhotos[(Number(id)-1) % reviewPhotos.length]}?auto=format&fit=crop&w=960&q=80`;
const media = (domain, id) => ({ id: `tmdb-${domain}-${id}`, tmdbId: Number(id), tvdbId: domain === 'tv' ? Number(id) + 1000 : null, domain, title: titles[(Number(id) - 1) % titles.length], year: 2026, overview: 'A journey beyond the familiar, where an unexpected discovery changes everything. This is fictional review media for companion testing.', poster: reviewArt(id), backdrop: reviewArt(id), rating: 8.2, genres: ['Adventure'], runtime: 112, certification: 'PG-13', tagline: 'Every horizon holds a secret.', status: 'Released', originalTitle: titles[(Number(id)-1) % titles.length], originalLanguage: 'en', studio: 'Review Studio', productionCompanies: ['Review Studio'], countries: ['United States'], cast: [{ id: 1, name: 'Alex Morgan', character: 'The explorer', photo: null }, { id: 2, name: 'Sam Rivera', character: 'The navigator', photo: null }], seasons: domain === 'tv' ? [{ seasonNumber: 1, name: 'Season 1', episodeCount: 8, airDate: '2026-01-10', poster: reviewArt(id) }] : [], trailer: { url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE', name: 'Review trailer link' } });
const discovery = {
  token: 'fixture', configured: () => true, setToken: () => {}, details: async (domain, id) => media(domain, id),
  feed: async kind => ({ page: 1, totalPages: 1, results: titles.map((_, index) => media(kind.includes('tv') ? 'tv' : 'movie', index + 1)) }),
  browse: async ({ domain, query }) => ({ page: 1, totalPages: 1, results: titles.map((_, index) => media(domain, index + 1)).filter(item => item.title.toLowerCase().includes(String(query || '').toLowerCase())) }),
};
const fixtureClient = domain => ({
  get: async (path, query = {}) => {
    if (path === 'qualityprofile') return [{ id: 1, name: 'HD' }, { id: 2, name: 'Ultra HD' }];
    if (path === 'rootfolder') return [{ id: 1, path: domain === 'tv' ? '/tv' : '/movies' }];
    if (path.endsWith('/lookup')) return [media(domain, Number(String(query.term).split(':')[1]) - (String(query.term).startsWith('tvdb:') ? 1000 : 0))];
    if (path === 'queue' || path === 'history') return { records: [] };
    return [];
  },
  post: async () => { throw new Error('Review server does not acquire media. Use an approval-required test user.'); },
});
const fixtureArtwork = async () => ({ body: await readFile(new URL('../android-companion/app/src/androidTest/assets/review-art/' + reviewPhotos[0] + '.jpg', import.meta.url)), contentType: 'image/jpeg' });
const reviewCatalog = new LibraryCatalogStore(join(directory, "library-catalog.sqlite"));
const app = createApplication({ projectionStore: reviewCatalog, env: { VYNODEARR_DATA_MODE: 'fixture', VYNODEARR_DATA_DIR: directory, VYNODEARR_SECURE_COOKIES: 'false' },
  movie: Object.assign(new MovieFixtureAdapter(), { client: fixtureClient('movie'), getArtwork: fixtureArtwork, getCalendar: async () => [{ id: 'review-release', domain: 'movie', title: 'Orbit City premiere', dateUtc: new Date().toISOString().slice(0, 10), context: 'Movie release', eventType: 'digital', status: 'Upcoming' }], listMovies: async () => (await new MovieFixtureAdapter().listMovies()).map((item, index) => ({ ...item, artwork: { url: `/api/review-art/${index}` } })) }),
  tv: Object.assign(new TvFixtureAdapter(), { client: fixtureClient('tv'), getArtwork: fixtureArtwork, listSeries: async () => new TvFixtureAdapter().listSeries() }), discovery });
await app.initialize();
await app.auth.createInitialAdministrator({ name: 'Preview Administrator', username: 'preview-admin', email: 'preview@example.test', password: 'Companion-Preview-Only1', confirmPassword: 'Companion-Preview-Only1' });
await app.auth.createUser({ name: 'Preview User', username: 'preview-user', email: 'user@example.test', password: 'Companion-Preview-Only1', role: 'user', permissions: { discover: true }, requestApprovalRequired: true });
await app.auth.createUser({ name: 'Library User', username: 'library-user', email: 'library@example.test', password: 'Companion-Preview-Only1', role: 'user', permissions: { movies: true, tv: true, calendar: true } });
await app.auth.createUser({ name: 'No Access', username: 'no-access', email: 'none@example.test', password: 'Companion-Preview-Only1', role: 'user', permissions: {} });
const server = createServer(async (req, res) => {
  const artMatch = req.url?.match(/^\/api\/review-art\/([0-5])$/);
  if (artMatch) {
    const bytes = await readFile(new URL('../android-companion/app/src/androidTest/assets/review-art/' + reviewPhotos[Number(artMatch[1])] + '.jpg', import.meta.url));
    res.writeHead(200, {'content-type': 'image/jpeg'}); res.end(bytes); return;
  }
  if (req.url?.startsWith("/api/media/") && process.env.COMPANION_REVIEW_LIBRARY_DELAY_MS) await new Promise(resolve => setTimeout(resolve, Math.min(1000, Number(process.env.COMPANION_REVIEW_LIBRARY_DELAY_MS) || 0)));
  return app.handleRequest(req, res);
});
server.listen(18787, '127.0.0.1', () => console.log('Companion review server: http://127.0.0.1:18787 (emulator: http://10.0.2.2:18787)'));
async function stop() { await new Promise(resolve => server.close(resolve)); reviewCatalog.database?.close(); await rm(directory, { recursive: true, force: true }); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
