import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class EncryptedCredentialVault {
  constructor(path, masterKey) {
    if (!masterKey || masterKey.length < 24) throw new Error('VYNODENEW_MASTER_KEY must contain at least 24 characters');
    this.path = path;
    this.key = scryptSync(masterKey, 'vynodenew-credential-v1', 32);
  }
  async #read() {
    try {
      const envelope = JSON.parse(await readFile(this.path, 'utf8'));
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
  }
  async #write(value) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    const envelope = JSON.stringify({ version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') });
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, envelope, { mode: 0o600 });
    await rename(temporary, this.path);
  }
  async get(name) { return (await this.#read())[name] ?? null; }
  async replace(name, credential) { const data = await this.#read(); data[name] = credential; await this.#write(data); }
  async remove(name) { const data = await this.#read(); delete data[name]; await this.#write(data); }
  async status() { return Object.keys(await this.#read()).map((name) => ({ name, configured: true })); }
}
