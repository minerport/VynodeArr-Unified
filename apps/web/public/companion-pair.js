const el = id => document.getElementById(id);
let csrf = '', inspectedCode = '';
async function api(path, input) {
  const response = await fetch(path, { method: input ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json', 'x-vynodearr-csrf': csrf }, ...(input ? { body: JSON.stringify(input) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error?.message || 'The request could not be completed.');
  return value;
}
async function status() {
  const value = await api('/api/auth/status'); csrf = value.csrf || '';
  el('login').hidden = value.authenticated; el('pair').hidden = !value.authenticated;
  if (value.setupRequired) { el('login').hidden = true; throw new Error('Finish server setup in VynodeArr first.'); }
  if (value.authenticated) el('account').textContent = `Authorizing as ${value.user.name || value.user.username}`;
}
async function perform(button, work) {
  button.disabled = true; el('message').textContent = '';
  try { await work(); } catch (error) { el('message').textContent = error.message; }
  finally { button.disabled = false; }
}
el('login').addEventListener('submit', event => {
  event.preventDefault(); void perform(event.submitter, async () => {
    await api('/api/auth/login', { identifier: el('identifier').value, password: el('password').value });
    el('password').value = ''; await status();
  });
});
el('pair').addEventListener('submit', event => {
  event.preventDefault(); void perform(event.submitter, async () => {
    const code = el('code').value;
    const value = await api('/api/companion/pair/inspect', { userCode: code }); inspectedCode = code;
    el('device').textContent = `Connect ${value.name}?`; el('pair').hidden = true; el('confirm').hidden = false;
  });
});
el('cancel').onclick = () => { inspectedCode = ''; el('confirm').hidden = true; el('pair').hidden = false; };
el('approve').onclick = event => perform(event.target, async () => {
  const result = await api('/api/companion/pair/approve', { userCode: inspectedCode });
  if (!result.approved) throw new Error('Pairing could not be approved. Start again on your device.');
  el('confirm').hidden = true; el('message').textContent = 'Device approved. Return to the companion app.';
});
void status().catch(error => { el('message').textContent = error.message; });
