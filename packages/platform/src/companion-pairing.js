import { randomBytes } from 'node:crypto';

// Pending grants deliberately do not survive a restart. Only the existing AuthService
// persists sessions, so device access follows normal expiry and account revocation.
export class CompanionPairing {
  constructor({ now = Date.now, ttl = 300000 } = {}) {
    this.now = now; this.ttl = ttl; this.pending = new Map(); this.attempts = new Map();
  }
  prune() {
    for (const [key, value] of this.pending) if (value.expiresAt <= this.now()) this.pending.delete(key);
    for (const [key, value] of this.attempts) if (value.expiresAt <= this.now()) this.attempts.delete(key);
  }
  allow(key, limit) {
    this.prune();
    const value = this.attempts.get(key) || { count: 0, expiresAt: this.now() + 60000 };
    if (!this.attempts.has(key) && this.attempts.size >= 2000) return false;
    value.count++; this.attempts.set(key, value); return value.count <= limit;
  }
  start(name, ip) {
    if (!this.allow(`start:${ip}`, 6) || this.pending.size >= 500) return null;
    const deviceCode = randomBytes(32).toString('base64url');
    let userCode;
    do { userCode = randomBytes(5).toString('hex').toUpperCase(); }
    while ([...this.pending.values()].some(value => value.userCode === userCode));
    const value = { userCode, name: String(name || 'Android companion').replace(/[\x00-\x1f\x7f]/g, '').slice(0, 64), ip,
      expiresAt: this.now() + this.ttl, state: 'pending' };
    this.pending.set(deviceCode, value);
    return { deviceCode, userCode, expiresAt: value.expiresAt, interval: 5 };
  }
  lookup(code) {
    this.prune();
    const normalized = String(code || '').replace(/[\s-]/g, '').toUpperCase();
    return [...this.pending.values()].find(value => value.userCode === normalized);
  }
  async approve(code, session, auth) {
    const value = this.lookup(code);
    if (!value || value.state !== 'pending') return false;
    value.state = 'authorizing';
    try {
      const grant = await auth.createSession(session.user, { ip: value.ip, userAgent: 'VynodeArr Companion Android', remember: true });
      value.sessionId = grant.id; value.state = 'approved'; return true;
    } catch (error) { value.state = 'pending'; throw error; }
  }
  poll(deviceCode, auth) {
    this.prune();
    const value = this.pending.get(String(deviceCode || ''));
    if (!value) return { status: 'expired' };
    if (value.state !== 'approved') return { status: 'pending' };
    const session = auth.session(value.sessionId);
    if (!session) return { status: 'expired' };
    // Repeatable until the five-minute grant expires, allowing recovery if a response
    // is lost. The high-entropy device code, never the displayed code, retrieves it.
    return { status: 'approved', sessionId: session.id, csrf: session.csrf, user: session.user };
  }
}

export async function handleCompanionPairing(req, res, url, { pairing, auth, body, json, requireSession, requireCsrf, permitted }) {
  if (!url.pathname.startsWith('/api/companion/pair/')) return false;
  const reply = (status, value) => { json(res, status, value, { 'cache-control': 'no-store' }); return true; };
  if (req.method !== 'POST') return reply(405, { error: { message: 'Use POST for device pairing.' } });
  const action = url.pathname.slice('/api/companion/pair/'.length);
  const ip = req.socket.remoteAddress || 'unknown';
  if (action === 'start') {
    const input = await body(req, 4096), grant = pairing.start(input.name, ip);
    return grant ? reply(201, grant) : reply(429, { error: { message: 'Too many pairing attempts. Wait one minute.' } });
  }
  if (action === 'poll') {
    if (!pairing.allow(`poll:${ip}`, 120)) return reply(429, { error: { message: 'Pairing checked too frequently. Wait one minute.' } });
    const input = await body(req, 4096);
    return reply(200, pairing.poll(input.deviceCode, auth));
  }
  if (!['inspect', 'approve'].includes(action)) return reply(404, { error: { message: 'Pairing action not found.' } });
  const session = requireSession(req, res, auth);
  if (!session || !requireCsrf(req, res, session) || !permitted(res, session, 'discover')) return true;
  if (!pairing.allow(`approve:${session.user.id}`, 12)) return reply(429, { error: { message: 'Too many code attempts. Wait one minute.' } });
  const input = await body(req, 4096), value = pairing.lookup(input.userCode);
  if (!value || value.state !== 'pending') return reply(400, { error: { message: 'This code has expired or was already approved.' } });
  if (action === 'inspect') return reply(200, { name: value.name, expiresAt: value.expiresAt });
  const approved = await pairing.approve(input.userCode, session, auth);
  return reply(approved ? 200 : 409, { approved });
}
