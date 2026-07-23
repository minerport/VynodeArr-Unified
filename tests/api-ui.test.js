import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { handleRequest } from '../apps/api/src/app.js';

async function withServer(run) {
  const server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('Movies API returns normalized bounded results', async () => withServer(async (base) => {
  const response = await fetch(`${base}/api/v1/movies?limit=2`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.items.length, 2);
  assert.deepEqual(Object.keys(body.items[0]).sort(), ['artwork','collection','hasFile','id','monitoring','quality','state','status','title','year'].sort());
}));

test('TV API returns normalized bounded results', async () => withServer(async (base) => {
  const response = await fetch(`${base}/api/v1/tv/series?limit=2`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.items.length, 2);
  assert.ok('seasonProgress' in body.items[0] && 'episodeProgress' in body.items[0]);
}));

test('public API errors are neutral', async () => withServer(async (base) => {
  const body = await (await fetch(`${base}/api/v1/nope`)).json();
  const serialized = JSON.stringify(body);
  assert.match(serialized, /VynodeNew/);
  assert.doesNotMatch(serialized, /\b(radarr|sonarr)\b/i);
}));

test('UI has required navigation, login shell, and domain pages', async () => {
  const root = fileURLToPath(new URL('../apps/web/public/', import.meta.url));
  const html = await readFile(`${root}index.html`, 'utf8');
  for (const label of ['Dashboard','Movies','TV','Wanted','Activity','Calendar','Collections','Automation','Settings','System','Signed in']) assert.match(html, new RegExp(label));
  const script = await readFile(`${root}app.js`, 'utf8');
  assert.match(script, /movieCard/); assert.match(script, /tvCard/);
});
