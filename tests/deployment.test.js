import test from 'node:test';
import assert from 'node:assert/strict';
import { access,readFile } from 'node:fs/promises';

test('Docker Compose bundles private healthy engines and exposes only VynodeArr',async()=>{
  const text=await readFile(new URL('../compose.yaml',import.meta.url),'utf8');
  for(const value of ['${VYNODEARR_BIND_ADDRESS:-0.0.0.0}:${VYNODEARR_PORT:-8686}:4310','movie-engine-config','tv-engine-config','shared-downloads','lscr.io/linuxserver/radarr','lscr.io/linuxserver/sonarr','condition: service_healthy','VYNODEARR_BUNDLED_ENGINES'])assert.ok(text.includes(value),value);
  assert.equal((text.match(/ports:/g)||[]).length,1);
  assert.match(text,/MOVIE_ENGINE_HOST: movie-engine/);
  assert.match(text,/TV_ENGINE_HOST: tv-engine/);
  assert.match(text,/path: \.env\s+required: false/);
  assert.match(text,/chown -R 10001:"\$\$\{PGID\}" \/data/);
  assert.ok(text.includes('user: "10001:${PGID:-1000}"'));
  assert.doesNotMatch(text,/[A-Z]:\\/);
  for(const path of ['movie-library:/movies','tv-library:/tv','shared-downloads:/downloads'])assert.ok((text.match(new RegExp(path,'g'))||[]).length>=2,path);
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
  const text=await readFile(new URL('../templates/vynodearr.xml',import.meta.url),'utf8');
  for(const value of ['<Name>VynodeArr</Name>','ghcr.io/minerport/vynodearr-unified:latest','<Registry>https://github.com/minerport/VynodeArr-Unified/pkgs/container/vynodearr-unified</Registry>','<Network>bridge</Network>','<Shell>sh</Shell>','<Privileged>false</Privileged>','Target="8686"','Target="/config"','Target="/movies"','Target="/tv"','Target="/downloads"'])assert.match(text,new RegExp(value));
  const overview=text.match(/<Overview>(.*?)<\/Overview>/s)?.[1]||'';
  assert.match(overview,/\bRadarr\b/);assert.match(overview,/\bSonarr\b/);
  assert.match(text,/GPLv3/);assert.match(text,/Apache 2\.0/);
  assert.match(text,new RegExp(`<Config Name="[^"]+" Target="/media" Default=""[^>]+Required="false"[^>]*><\\/Config>`));
  for(const target of ['/movies-2','/movies-3','/tv-2','/tv-3'])assert.doesNotMatch(text,new RegExp(`Target="${target}"`));
  for(const field of ['MyIP','Description','ExtraSearchTerms','WebUI','ReadMe','Changes','Date','MinVer','License','Screenshot','ExtraParams','PostArgs','CPUset','DateInstalled','Requires'])assert.doesNotMatch(text,new RegExp(`<${field}(?:[ >/])`));
  assert.doesNotMatch(text,/Target="\/unraid-template"/);
  assert.doesNotMatch(text,/templates-user/);
});
test('production image is non-root and has a health check',async()=>{
  const text=await readFile(new URL('../Dockerfile',import.meta.url),'utf8');assert.match(text,/USER vynodearr/);assert.match(text,/HEALTHCHECK/);assert.match(text,/VYNODEARR_DATA_DIR=\/data/);
  assert.match(text,/npm ci --include=dev/);assert.match(text,/npm ci --omit=dev/);
  assert.match(text,/adduser -S -G node -u 10001 vynodearr/);
  for(const path of ['/data','/movies','/tv','/downloads'])assert.ok(text.includes(path),path);
});

test('Docker environment example uses current variables and safe defaults',async()=>{
  const text=await readFile(new URL('../.env.example',import.meta.url),'utf8');
  for(const value of ['VYNODEARR_PORT=8686','VYNODEARR_BIND_ADDRESS=0.0.0.0','VYNODEARR_DATA_MODE=engine','VYNODEARR_DATA_DIR=/data','PUID=1000','PGID=1000'])assert.ok(text.includes(value),value);
  assert.doesNotMatch(text,/VYNODENEW_/);
});

test('optional Docker main-media override maps the same path into every service',async()=>{
  const text=await readFile(new URL('../compose.media.yaml',import.meta.url),'utf8');
  for(const service of ['movie-engine:','tv-engine:','vynodearr:'])assert.ok(text.includes(service),service);
  assert.equal((text.match(/source: "\$\{VYNODEARR_MEDIA_PATH:/g)||[]).length,3);
  assert.equal((text.match(/target: \/media/g)||[]).length,3);
});

test('Docker preflight and smoke-test scripts cover configuration and runtime health',async()=>{
  const [shell,powershell,smoke]=await Promise.all([
    readFile(new URL('../scripts/docker-preflight.sh',import.meta.url),'utf8'),
    readFile(new URL('../scripts/docker-preflight.ps1',import.meta.url),'utf8'),
    readFile(new URL('../scripts/docker-smoke-test.sh',import.meta.url),'utf8')
  ]);
  for(const marker of ['docker info','docker compose','config --quiet','VYNODEARR_MEDIA_PATH'])assert.ok(shell.includes(marker),marker);
  for(const marker of ['docker info','docker compose','config','VYNODEARR_MEDIA_PATH'])assert.ok(powershell.includes(marker),marker);
  for(const marker of ['docker build','/healthz','State.Health.Status','/data','/movies','/tv','/downloads'])assert.ok(smoke.includes(marker),marker);
});

test('1.0 release includes self-contained Unraid and Windows distributions',async()=>{
  const [image,entrypoint,template,profile,windows]=await Promise.all([
    readFile(new URL('../Dockerfile.unraid',import.meta.url),'utf8'),
    readFile(new URL('../infrastructure/unraid/entrypoint.sh',import.meta.url),'utf8'),
    readFile(new URL('../templates/vynodearr.xml',import.meta.url),'utf8'),
    readFile(new URL('../ca_profile.xml',import.meta.url),'utf8'),
    readFile(new URL('../distribution/windows/compose.yaml',import.meta.url),'utf8')
  ]);
  for(const value of ['Radarr.master.','Sonarr.main.','EXPOSE 8686','vynodearr-entrypoint'])assert.match(image,new RegExp(value.replaceAll('.','\\.')));
  assert.match(image,/npm install --omit=dev/, 'the runtime image must include production dependencies such as the poster renderer');
  assert.match(image,/sed -i 's\/\\r\$\/\/' \/usr\/local\/bin\/vynodearr-entrypoint/);
  assert.doesNotMatch(template,/Target="(?:7878|8989)"/);
  for(const value of ['/config/movies','/config/television','MOVIE_ENGINE_API_CREDENTIAL','TV_ENGINE_API_CREDENTIAL','env -u PORT'])assert.match(entrypoint,new RegExp(value));
  for(const value of ['ghcr.io/minerport/vynodearr-unified:latest','Target="8686"','Target="/config"','Target="/movies"','Target="/tv"','Target="/downloads"'])assert.match(template,new RegExp(value));
  assert.match(profile,/<CommunityApplications>/);
  assert.match(profile,/<Profile>[^<]+<\/Profile>/);
  assert.equal((template.match(/<Container\b/g)||[]).length,1);
  assert.equal((profile.match(/<CommunityApplications\b/g)||[]).length,1);
  assert.match(template,/main\/templates\/vynodearr\.xml/);
  assert.match(windows,/ghcr\.io\/minerport\/vynodearr-unified/);
  assert.match(image,/VYNODEARR_SECURE_COOKIES=false/);
  assert.match(template,/Target="VYNODEARR_SECURE_COOKIES".*Default="false"/);
  assert.match(windows,/VYNODEARR_SECURE_COOKIES:\s*"false"/);
});
test('README and Unraid metadata use the current product tour assets',async()=>{
  const assets=['dashboard.png','discover.png','my-requests.png','collections.png','tv-library.png','poster-overlay-studio.png','vynodearr-walkthrough.mp4'];
  await Promise.all(assets.map(asset=>access(new URL(`../docs/screenshots/${asset}`,import.meta.url))));
  const [readme,unraid,template]=await Promise.all([
    readFile(new URL('../README.md',import.meta.url),'utf8'),
    readFile(new URL('../docs/unraid/README.md',import.meta.url),'utf8'),
    readFile(new URL('../templates/vynodearr.xml',import.meta.url),'utf8')
  ]);
  for(const asset of assets)assert.match(readme,new RegExp(asset.replaceAll('.','\\.')));
  assert.match(unraid,/current product screenshots/i);assert.match(unraid,/automatic file-schema migrations/i);
  assert.doesNotMatch(template,/<Screenshot>/);
});

test('bundled engines require authentication from every address by default',async()=>{
  const entrypoint=await readFile(new URL('../infrastructure/unraid/entrypoint.sh',import.meta.url),'utf8');
  assert.equal((entrypoint.match(/<AuthenticationRequired>Enabled<\/AuthenticationRequired>/g)||[]).length,2);
  assert.doesNotMatch(entrypoint,/DisabledForLocalAddresses/);
});

test('Unraid startup disables bundled engines only after an explicit external-mode switch',async()=>{
  const [entrypoint,image]=await Promise.all([
    readFile(new URL('../infrastructure/unraid/entrypoint.sh',import.meta.url),'utf8'),
    readFile(new URL('../Dockerfile.unraid',import.meta.url),'utf8')
  ]);
  for(const value of ['engine-settings.json','pendingMode',"v.pendingMode||v.mode||'bundled'",'if [ "$engine_mode" = bundled ]'])assert.ok(entrypoint.includes(value),value);
  assert.match(image,/127\.0\.0\.1:8686\/healthz/);
  assert.doesNotMatch(image,/Promise\.all\(\[8686,7878,8989\]/);
});
