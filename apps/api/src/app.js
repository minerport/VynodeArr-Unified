import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EngineRegistry } from '../../../packages/platform/src/engine-registry.js';
import { MovieFixtureAdapter } from '../../../packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../../../packages/tv-domain/src/fixture-adapter.js';

const webRoot = fileURLToPath(new URL('../../web/public/', import.meta.url));
export const registry = new EngineRegistry().registerMovie(new MovieFixtureAdapter()).registerTv(new TvFixtureAdapter());
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

export async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://vynodenew.local');
  try {
    if (req.method === 'GET' && url.pathname === '/api/v1/movies') {
      return json(res, 200, { items: await registry.movie().listMovies({ limit: Number(url.searchParams.get('limit') || 24) }), source: 'movie-domain' });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/tv/series') {
      return json(res, 200, { items: await registry.tv().listSeries({ limit: Number(url.searchParams.get('limit') || 24) }), source: 'tv-domain' });
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: { code: 'not_found', message: 'The requested VynodeNew resource was not found.' } });

    const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const safe = normalize(requested).replace(/^(\.\.[/\\])+/, '');
    const path = join(webRoot, safe);
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream' });
      return res.end(body);
    } catch {
      const body = await readFile(join(webRoot, 'index.html'));
      res.writeHead(200, { 'content-type': mime['.html'] });
      return res.end(body);
    }
  } catch {
    return json(res, 500, { error: { code: 'internal_error', message: 'VynodeNew could not complete this request.' } });
  }
}
