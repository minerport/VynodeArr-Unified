// Seeds only the disposable companion-review-server on loopback for artwork QA.
const origin = 'http://127.0.0.1:18787';
const response = await fetch(origin + '/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: 'preview-admin', password: 'Companion-Preview-Only1' }),
});
if (!response.ok) throw new Error('Start the disposable companion review server first.');
const auth = await response.json();
const headers = { 'content-type': 'application/json', cookie: response.headers.get('set-cookie').split(';')[0], 'x-vynodearr-csrf': auth.csrf };
async function post(path, input) {
  const result = await fetch(origin + path, { method: 'POST', headers, body: JSON.stringify(input) });
  if (!result.ok) throw new Error('Fixture setup failed: ' + result.status);
  return result.json();
}
const { template } = await post('/api/poster-overlays/templates', {
  name: 'Companion review', domain: 'movie', layers: [{ id: 'review-label', kind: 'text', variable: 'custom_text', label: 'ULTRA HD', x: 5, y: 5, width: 90, height: 8, background: '#111820', backgroundOpacity: 0.85, foreground: '#ffffff', fontSize: 28, fontWeight: 700, enabled: true }],
});
await post('/api/poster-overlays/assignments', { name: 'Review assignment', templateId: template.id, scope: { type: 'items', domain: 'movie', mediaIds: ['movie_orbit-city'] }, enabled: true });
console.log('Disposable fixture poster template assigned.');
