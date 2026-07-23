import test from 'node:test';
import assert from 'node:assert/strict';
import { assertContract, movieOperations, tvOperations } from '../packages/contracts/src/domains.js';
import { modelSchemas } from '../packages/contracts/src/models.js';
import { MovieFixtureAdapter } from '../packages/movie-domain/src/fixture-adapter.js';
import { TvFixtureAdapter } from '../packages/tv-domain/src/fixture-adapter.js';
import { MediaEngineRegistry } from '../packages/platform/src/engine-registry.js';

test('normalized models include the N2 public surface',()=>{
  for(const name of ['MovieSummary','MovieDetails','SeriesSummary','SeriesDetails','SeasonSummary','EpisodeSummary','MediaArtwork','QueueItem','HistoryItem','CalendarItem','HealthItem'])assert.ok(modelSchemas[name],name);
});
test('movie fixture fulfills the read-only Movie contract',async()=>{
  const engine=assertContract(new MovieFixtureAdapter(),movieOperations);
  assert.equal((await engine.listMovies({limit:2})).length,2);
  assert.equal((await engine.getMovie('movie_glass-tide')).state,'missing');
  assert.equal((await engine.getQueue()).length,1);
});
test('TV fixture fulfills the read-only TV contract',async()=>{
  const engine=assertContract(new TvFixtureAdapter(),tvOperations);
  assert.equal((await engine.listSeries()).length,3);
  assert.ok((await engine.getSeries('series_afterlight')).seasons[0].episodes.length);
});
test('media registry isolates domains and rejects incomplete engines',()=>{
  const registry=new MediaEngineRegistry().register('movie',new MovieFixtureAdapter()).register('tv',new TvFixtureAdapter());
  assert.ok(registry.movie() instanceof MovieFixtureAdapter);assert.ok(registry.tv() instanceof TvFixtureAdapter);
  assert.throws(()=>new MediaEngineRegistry().register('movie',{}),/missing operations/);
});
