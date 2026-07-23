import test from 'node:test';
import assert from 'node:assert/strict';
import { assertContract, movieOperations, tvOperations } from '../packages/contracts/src/domains.js';
import { assertModel, modelSchemas } from '../packages/contracts/src/models.js';
import { MovieFixtureAdapter } from '../packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../packages/tv-domain/src/fixture-adapter.js';
import { EngineRegistry } from '../packages/platform/src/engine-registry.js';

test('normalized models include every N1 model', () => {
  for (const name of ['MovieSummary','MovieDetails','SeriesSummary','SeriesDetails','SeasonSummary','EpisodeSummary','MediaArtwork','QualityProfile','CustomFormat','RootFolder','QueueItem','HistoryItem','CalendarItem','HealthItem','CommandItem','SearchResult','DownloadClient','Indexer']) {
    assert.ok(modelSchemas[name], name);
  }
  assert.throws(() => assertModel('MovieSummary', {}), /required/);
});

test('movie fixture fulfills MovieDomain and is bounded', async () => {
  const engine = assertContract(new MovieFixtureAdapter(), movieOperations);
  assert.equal((await engine.listMovies({ limit: 2 })).length, 2);
  assert.equal((await engine.searchMissingMovies()).length, 1);
});

test('TV fixture fulfills TvDomain and preserves episodic data', async () => {
  const engine = assertContract(new TvFixtureAdapter(), tvOperations);
  const items = await engine.listSeries({ limit: 10 });
  assert.equal(items.length, 3);
  assert.ok(items[0].seasonProgress && 'nextEpisode' in items[0]);
});

test('engine registry isolates both domains', () => {
  const registry = new EngineRegistry().registerMovie(new MovieFixtureAdapter()).registerTv(new TvFixtureAdapter());
  assert.ok(registry.movie() instanceof MovieFixtureAdapter);
  assert.ok(registry.tv() instanceof TvFixtureAdapter);
});
