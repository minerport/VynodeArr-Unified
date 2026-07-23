import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const encode = (value) => Buffer.from(value).toString('base64url');
const hashPassword = (password, salt = randomBytes(16)) => `${encode(salt)}.${encode(scryptSync(password, salt, 64))}`;
const verifyPassword = (password, stored) => {
  const [salt, expected] = stored.split('.');
  const actual = scryptSync(password, Buffer.from(salt, 'base64url'), 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'base64url'));
};

export class AuthService {
  constructor({ userFile, secureCookies = true, sessionTtlMs = 86400000, rateLimit = 8 }) {
    this.userFile = userFile; this.secureCookies = secureCookies;
    this.sessionTtlMs = sessionTtlMs; this.rateLimit = rateLimit;
    this.sessions = new Map(); this.attempts = new Map();
  }
  async #users() { try { return JSON.parse(await readFile(this.userFile, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } }
  async #save(users) {
    await mkdir(dirname(this.userFile), { recursive: true });
    const temporary = `${this.userFile}.tmp`;
    await writeFile(temporary, JSON.stringify(users), { mode: 0o600 });
    await rename(temporary, this.userFile);
  }
  async setupRequired() { return (await this.#users()).length === 0; }
  async createInitialAdministrator(username, password) {
    if (!(await this.setupRequired())) throw new Error('Administrator already exists');
    if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username) || password.length < 12) throw new Error('Username or password does not meet security requirements');
    await this.#save([{ id: `user_${encode(randomBytes(12))}`, username, passwordHash: hashPassword(password), role: 'administrator', createdAt: new Date().toISOString() }]);
  }
  #rateKey(ip) { return ip || 'unknown'; }
  #allow(ip) {
    const key = this.#rateKey(ip); const now = Date.now();
    const attempt = this.attempts.get(key) || { count: 0, resetAt: now + 60000 };
    if (now > attempt.resetAt) Object.assign(attempt, { count: 0, resetAt: now + 60000 });
    attempt.count += 1; this.attempts.set(key, attempt);
    return attempt.count <= this.rateLimit;
  }
  async login(username, password, ip) {
    if (!this.#allow(ip)) return null;
    const user = (await this.#users()).find((candidate) => candidate.username.toLowerCase() === String(username).toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) return null;
    this.attempts.delete(this.#rateKey(ip));
    const id = encode(randomBytes(32)); const csrf = encode(randomBytes(24));
    this.sessions.set(id, { user: { id: user.id, username: user.username, role: user.role }, csrf, expiresAt: Date.now() + this.sessionTtlMs });
    return { id, csrf, user: this.sessions.get(id).user };
  }
  session(id) {
    const session = this.sessions.get(id);
    if (!session || session.expiresAt <= Date.now()) { if (id) this.sessions.delete(id); return null; }
    return session;
  }
  logout(id) { return this.sessions.delete(id); }
  cookie(id, clear = false) {
    return `vynodenew_session=${clear ? '' : id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : Math.floor(this.sessionTtlMs / 1000)}${this.secureCookies ? '; Secure' : ''}`;
  }
}
