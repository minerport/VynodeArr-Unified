import { assertContract, movieOperations, tvOperations } from '../../contracts/src/domains.js';

export class MediaEngineRegistry {
  #engines = new Map();
  register(domain, engine) {
    const operations = domain === 'movie' ? movieOperations : domain === 'tv' ? tvOperations : null;
    if (!operations) throw new TypeError(`Unsupported media domain: ${domain}`);
    this.#engines.set(domain, assertContract(engine, operations));
    return this;
  }
  get(domain) {
    const engine = this.#engines.get(domain);
    if (!engine) throw new Error(`${domain === 'movie' ? 'Movie' : 'TV'} service unavailable`);
    return engine;
  }
  movie() { return this.get('movie'); }
  tv() { return this.get('tv'); }
  domains() { return [...this.#engines.keys()]; }
}

export const EngineRegistry = MediaEngineRegistry;
