import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('local Compose is loopback-bound, healthy, persistent, and neutral',async()=>{
  const text=await readFile(new URL('../compose.yaml',import.meta.url),'utf8');assert.match(text,/127\.0\.0\.1:4310:4310/);assert.match(text,/healthcheck:/);assert.match(text,/vynodenew-data/);assert.doesNotMatch(text,/\b(radarr|sonarr)\b/i);
});
test('Unraid template has required mappings, secrets, health-compatible port, and neutral overview',async()=>{
  const text=await readFile(new URL('../infrastructure/unraid/vynodenew.xml',import.meta.url),'utf8');
  for(const value of ['<Name>VynodeNew</Name>','Target="4310"','/mnt/user/appdata/vynodenew','MOVIE_ENGINE_HOST','TV_ENGINE_HOST','API_CREDENTIAL_FILE'])assert.match(text,new RegExp(value));
  const overview=text.match(/<Overview>(.*?)<\/Overview>/s)?.[1]||'';assert.doesNotMatch(overview,/\b(radarr|sonarr)\b/i);
});
test('production image is non-root and has a health check',async()=>{
  const text=await readFile(new URL('../Dockerfile',import.meta.url),'utf8');assert.match(text,/USER vynodenew/);assert.match(text,/HEALTHCHECK/);assert.match(text,/VYNODENEW_DATA_DIR=\/data/);
});
