import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CompanionPairing } from '../.server-build/packages/platform/src/companion-pairing.js';
import { AuthService } from '../.server-build/packages/platform/src/auth-service.js';
import { createApplication } from '../.server-build/apps/api/src/app.js';
import { MovieFixtureAdapter } from '../.server-build/packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../.server-build/packages/tv-domain/src/fixture-adapter.js';

test('pairing expires, limits creation, and never releases a session to the displayed code', async () => {
  let now = 0;
  const pairing = new CompanionPairing({ now: () => now, ttl: 1000 });
  const grant = pairing.start('Living room', 'local');
  assert.equal(pairing.lookup(grant.userCode).name, 'Living room');
  assert.deepEqual(pairing.poll(grant.userCode, {}), { status: 'expired' });
  assert.deepEqual(pairing.poll(grant.deviceCode, {}), { status: 'pending' });
  for (let i = 0; i < 5; i++) assert.ok(pairing.start('TV', 'local'));
  assert.equal(pairing.start('TV', 'local'), null);
  now = 1001;
  assert.equal(pairing.lookup(grant.userCode), undefined);
  assert.deepEqual(pairing.poll(grant.deviceCode, {}), { status: 'expired' });
});

test('concurrent approvals create one session, recover lost polling responses, and honor revocation', async () => {
  const pairing = new CompanionPairing();
  const grant = pairing.start('TV', 'local');
  let count = 0, active = true;
  const auth = { createSession: async () => { count++; await new Promise(resolve => setTimeout(resolve, 5)); return { id: 'secret' }; }, session: () => active ? { id: 'secret', csrf: 'csrf', user: { id: 'viewer' } } : null };
  const results = await Promise.all([pairing.approve(grant.userCode, { user: { id: 'viewer' } }, auth), pairing.approve(grant.userCode, { user: { id: 'other' } }, auth)]);
  assert.deepEqual(results, [true, false]); assert.equal(count, 1);
  assert.equal(pairing.poll(grant.deviceCode, auth).sessionId, 'secret');
  assert.equal(pairing.poll(grant.deviceCode, auth).sessionId, 'secret');
  active = false;
  assert.equal(pairing.poll(grant.deviceCode, auth).status, 'expired');
});

test('HTTP pairing requires authenticated CSRF approval, inherits permissions, and revokes normally', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vynodearr-companion-'));
  const auth = new AuthService({ userFile: join(directory, 'users.json'), secureCookies: false });
  const app = createApplication({ env: { VYNODEARR_DATA_MODE: 'fixture', VYNODEARR_DATA_DIR: directory }, auth, movie: new MovieFixtureAdapter(), tv: new TvFixtureAdapter() });
  const server = createServer(app.handleRequest);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, input, cookie = '', csrf = '') => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie, 'x-vynodearr-csrf': csrf }, body: JSON.stringify(input) });
  try {
    const page = await fetch(base + '/companion-pair.html');
    assert.equal(page.headers.get('x-frame-options'), 'DENY');
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    await post('/api/auth/setup', { name: 'Administrator', username: 'admin', email: 'admin@example.test', password: 'Correct-horse-review1', confirmPassword: 'Correct-horse-review1' });
    const user = await auth.createUser({ name: 'Companion User', username: 'viewer', email: 'viewer@example.test', password: 'Correct-horse-review1', role: 'user', permissions: { discover: true }, requestApprovalRequired: true });
    const login = await post('/api/auth/login', { identifier: 'viewer', password: 'Correct-horse-review1' });
    const cookie = login.headers.get('set-cookie').split(';')[0], csrf = (await login.json()).csrf;
    const start = await post('/api/companion/pair/start', { name: 'Shield' });
    assert.equal(start.status, 201); assert.equal(start.headers.get('cache-control'), 'no-store');
    const grant = await start.json();
    assert.equal((await post('/api/companion/pair/approve', { userCode: grant.userCode })).status, 401);
    assert.equal((await post('/api/companion/pair/approve', { userCode: grant.userCode }, cookie)).status, 403);
    const inspect = await post('/api/companion/pair/inspect', { userCode: grant.userCode }, cookie, csrf);
    assert.deepEqual(Object.keys(await inspect.json()).sort(), ['expiresAt', 'name']);
    assert.equal((await post('/api/companion/pair/approve', { userCode: grant.userCode }, cookie, csrf)).status, 200);
    assert.equal((await post('/api/companion/pair/approve', { userCode: grant.userCode }, cookie, csrf)).status, 400);
    const paired = await (await post('/api/companion/pair/poll', { deviceCode: grant.deviceCode })).json();
    assert.equal(paired.user.id, user.id); assert.equal(paired.user.requestApprovalRequired, true); assert.equal(paired.user.permissions.movies, false);
    const deviceCookie = `vynodearr_session=${paired.sessionId}`;
    const status = await (await fetch(base + '/api/auth/status', { headers: { cookie: deviceCookie } })).json();
    assert.equal(status.authenticated, true);
    assert.equal(auth.session(paired.sessionId).browser, 'VynodeArr Companion');
    assert.equal((await fetch(base + '/api/requests/mine', { headers: { cookie: deviceCookie } })).status, 200);
    assert.equal((await fetch(base + '/api/requests', { headers: { cookie: deviceCookie } })).status, 403);
    assert.equal((await post('/api/discover/request', { domain: 'movie', tmdbId: 1 }, deviceCookie)).status, 403);
    await auth.logout(paired.sessionId);
    assert.equal((await fetch(base + '/api/requests/mine', { headers: { cookie: deviceCookie } })).status, 401);
    const forbidden = await auth.createUser({ name: 'No Discovery', username: 'restricted', email: 'restricted@example.test', password: 'Correct-horse-review1', role: 'user', permissions: {} });
    const denied = await auth.createSession(forbidden);
    const another = await (await post('/api/companion/pair/start', { name: 'Phone' })).json();
    assert.equal((await post('/api/companion/pair/approve', { userCode: another.userCode }, `vynodearr_session=${denied.id}`, denied.csrf)).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
});
