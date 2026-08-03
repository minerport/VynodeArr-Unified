import test from 'node:test';
import assert from 'node:assert/strict';
import { access,readFile } from 'node:fs/promises';

test('local Compose bundles private healthy engines and exposes only VynodeArr',async()=>{
  const text=await readFile(new URL('../compose.yaml',import.meta.url),'utf8');
  for(const value of ['127.0.0.1:4310:4310','movie-engine-config','tv-engine-config','shared-downloads','lscr.io/linuxserver/radarr','lscr.io/linuxserver/sonarr','condition: service_healthy','VYNODEARR_BUNDLED_ENGINES'])assert.match(text,new RegExp(value.replaceAll('.','\\.')));
  assert.equal((text.match(/ports:/g)||[]).length,1);
  assert.match(text,/MOVIE_ENGINE_HOST: movie-engine/);
  assert.match(text,/TV_ENGINE_HOST: tv-engine/);
});
test('local Compose persists random engine keys and shares them with VynodeArr',async()=>{
  const text=await readFile(new URL('../compose.yaml',import.meta.url),'utf8');
  assert.match(text,/od -An -N16 -tx1 \/dev\/urandom/);
  assert.match(text,/MOVIE_ENGINE_API_CREDENTIAL_FILE: \/engine-config\/movie\/api-key/);
  assert.match(text,/TV_ENGINE_API_CREDENTIAL_FILE: \/engine-config\/tv\/api-key/);
  assert.match(text,/cat \/movie\/api-key/);assert.match(text,/cat \/tv\/api-key/);
  assert.doesNotMatch(text,/vynodearr-local-(?:movie|tv)-key/);
  assert.equal((text.match(/<AuthenticationRequired>Enabled<\/AuthenticationRequired>/g)||[]).length,2);
});
test('Unraid template has required mappings, self-contained image, and upstream attribution',async()=>{
  const text=await readFile(new URL('../infrastructure/unraid/vynodearr.xml',import.meta.url),'utf8');
  for(const value of ['<Name>VynodeArr</Name>','ghcr.io/minerport/vynodearr-unified:latest','Target="8686"','Target="/config"','Target="/movies"','Target="/tv"','Target="/downloads"'])assert.match(text,new RegExp(value));
  const overview=text.match(/<Overview>(.*?)<\/Overview>/s)?.[1]||'';
  assert.match(overview,/\bRadarr\b/);assert.match(overview,/\bSonarr\b/);
  assert.match(text,/GPLv3/);assert.match(text,/Apache 2\.0/);
});
test('production image is non-root and has a health check',async()=>{
  const text=await readFile(new URL('../Dockerfile',import.meta.url),'utf8');assert.match(text,/USER vynodearr/);assert.match(text,/HEALTHCHECK/);assert.match(text,/VYNODEARR_DATA_DIR=\/data/);
});

test('1.0 release includes self-contained Unraid and Windows distributions',async()=>{
  const [image,entrypoint,template,profile,windows]=await Promise.all([
    readFile(new URL('../Dockerfile.unraid',import.meta.url),'utf8'),
    readFile(new URL('../infrastructure/unraid/entrypoint.sh',import.meta.url),'utf8'),
    readFile(new URL('../templates/vynodearr.xml',import.meta.url),'utf8'),
    readFile(new URL('../templates/ca_profile.xml',import.meta.url),'utf8'),
    readFile(new URL('../distribution/windows/compose.yaml',import.meta.url),'utf8')
  ]);
  for(const value of ['Radarr.master.','Sonarr.main.','EXPOSE 8686','vynodearr-entrypoint'])assert.match(image,new RegExp(value.replaceAll('.','\\.')));
  assert.match(image,/npm install --omit=dev/, 'the runtime image must include production dependencies such as the poster renderer');
  assert.match(image,/sed -i 's\/\\r\$\/\/' \/usr\/local\/bin\/vynodearr-entrypoint/);
  assert.doesNotMatch(template,/Target="(?:7878|8989)"/);
  for(const value of ['/config/movies','/config/television','MOVIE_ENGINE_API_CREDENTIAL','TV_ENGINE_API_CREDENTIAL','env -u PORT'])assert.match(entrypoint,new RegExp(value));
  for(const value of ['ghcr.io/minerport/vynodearr-unified:latest','Target="8686"','Target="/config"','Target="/movies"','Target="/tv"','Target="/downloads"'])assert.match(template,new RegExp(value));
  assert.match(profile,/<CommunityApplications>/);
  assert.match(windows,/ghcr\.io\/minerport\/vynodearr-unified/);
  assert.match(image,/VYNODEARR_SECURE_COOKIES=false/);
  assert.match(template,/Target="VYNODEARR_SECURE_COOKIES".*Default="false"/);
  assert.match(windows,/VYNODEARR_SECURE_COOKIES:\s*"false"/);
});
test('Unraid installation includes first-run and dashboard screenshots',async()=>{
  await access(new URL('../docs/unraid/first-run.png',import.meta.url));
  await access(new URL('../docs/unraid/dashboard.png',import.meta.url));
  const text=await readFile(new URL('../docs/unraid/README.md',import.meta.url),'utf8');
  assert.match(text,/first-run\.png/);assert.match(text,/dashboard\.png/);assert.match(text,/automatic file-schema migrations/i);
});

test('bundled engines require authentication from every address by default',async()=>{
  const entrypoint=await readFile(new URL('../infrastructure/unraid/entrypoint.sh',import.meta.url),'utf8');
  assert.equal((entrypoint.match(/<AuthenticationRequired>Enabled<\/AuthenticationRequired>/g)||[]).length,2);
  assert.doesNotMatch(entrypoint,/DisabledForLocalAddresses/);
});
