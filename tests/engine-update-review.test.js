import test from 'node:test';
import assert from 'node:assert/strict';
import { EngineUpdateReviewService,compareEngineVersions } from '../packages/platform/src/engine-update-review-service.js';

const release=(tag,asset,extra={})=>({ok:true,json:async()=>({tag_name:tag,html_url:`https://github.com/example/releases/tag/${tag}`,published_at:'2026-08-02T00:00:00Z',assets:asset?[{name:asset,size:123,browser_download_url:'https://github.com/example/archive'}]:[],...extra})});

test('engine versions compare numerically',()=>{
  assert.equal(compareEngineVersions('6.3.0.10514','6.3.0.10514'),0);
  assert.equal(compareEngineVersions('6.10.0','6.3.0'),1);
  assert.equal(compareEngineVersions('v4.0.19.1','4.0.20'),-1);
});

test('engine review recognizes the required movie-engine platform archive and produces a ready report',async()=>{
  const service=new EngineUpdateReviewService({versions:{movie:'6.3.0.10514',tv:'4.0.19.2979'},fetcher:async()=>release('v6.4.0.11000','Radarr.master.6.4.0.11000.linux-musl-core-x64.tar.gz')});
  const validation={checks:[{id:'movie-connection',status:'healthy',message:'Connected.'},{id:'movie-storage',status:'healthy',message:'Storage ready.'},{id:'application-data',status:'healthy',message:'Readable.'}]};
  const report=await service.review('movie',{validation});
  assert.equal(report.outcome,'ready');assert.equal(report.candidate.updateAvailable,true);assert.equal(report.issueDraft,undefined);assert.equal(report.applicationMode,'review-only');
});

test('unsafe engine metadata is blocked and its issue draft is sanitized',async()=>{
  const service=new EngineUpdateReviewService({versions:{movie:'6.3.0.10514'},fetcher:async()=>release('v6.2.0.1',null,{prerelease:true})});
  const report=await service.review('movie',{validation:{checks:[]}});
  assert.equal(report.outcome,'blocked');assert.ok(report.issueDraft.url.startsWith('https://github.com/minerport/VynodeArr-Unified/issues/new?'));assert.doesNotMatch(report.issueDraft.body,/(?:api.?key|password)\s*[:=]|10\.0\./i);
});

test('catalog isolates an upstream outage to one engine',async()=>{
  const service=new EngineUpdateReviewService({versions:{movie:'6.3.0.10514',tv:'4.0.19.2979'},fetcher:async url=>String(url).includes('Radarr')?release('v6.3.0.10514','Radarr.master.6.3.0.10514.linux-musl-core-x64.tar.gz'):{ok:false}});
  const catalog=await service.catalog();assert.equal(catalog.engines[0].unavailable,undefined);assert.equal(catalog.engines[1].unavailable,true);
});

test('candidate plans require two ready reviews, preserve rollback, and never target latest',()=>{
  const service=new EngineUpdateReviewService(),reports=[{domain:'movie',outcome:'ready',candidate:{latestVersion:'6.4.0.11000',updateAvailable:true}},{domain:'tv',outcome:'ready',candidate:{latestVersion:'4.0.19.2979',updateAvailable:false}}];
  const plan=service.candidatePlan(reports,{baseRef:'develop',currentImage:'ghcr.io/minerport/vynodearr-unified:2.0.33'});
  assert.equal(plan.workflowInputs.movie_version,'6.4.0.11000');assert.equal(plan.workflowInputs.tv_version,'4.0.19.2979');assert.equal(plan.rollbackImage,'ghcr.io/minerport/vynodearr-unified:2.0.33');assert.match(plan.candidateTag,/engine-candidate/);assert.doesNotMatch(plan.candidateTag,/:latest$/);
  assert.throws(()=>service.candidatePlan([{...reports[0],outcome:'blocked'},reports[1]]),/Both engine reviews/);
});
