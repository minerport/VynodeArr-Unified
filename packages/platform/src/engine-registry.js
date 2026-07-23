import { assertContract, movieOperations, tvOperations } from '../../contracts/src/domains.js';

export class EngineRegistry {
  #movie;
  #tv;
  registerMovie(engine) { this.#movie = assertContract(engine, movieOperations); return this; }
  registerTv(engine) { this.#tv = assertContract(engine, tvOperations); return this; }
  movie() { if (!this.#movie) throw new Error('Movie engine is not registered'); return this.#movie; }
  tv() { if (!this.#tv) throw new Error('TV engine is not registered'); return this.#tv; }
}
