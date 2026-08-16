import { readFile } from 'node:fs/promises';

const compose=await readFile(new URL('../compose.yaml',import.meta.url),'utf8');
const image=await readFile(new URL('../Dockerfile',import.meta.url),'utf8');
const unraid=await readFile(new URL('../templates/vynodearr.xml',import.meta.url),'utf8');
const profile=await readFile(new URL('../ca_profile.xml',import.meta.url),'utf8');
const mediaCompose=await readFile(new URL('../compose.media.yaml',import.meta.url),'utf8');
const failures=[];
if(!compose.includes('${VYNODEARR_BIND_ADDRESS:-0.0.0.0}:${VYNODEARR_PORT:-8686}:4310'))failures.push('Docker Compose does not publish its configurable web port');
if(/[A-Z]:\\/.test(compose))failures.push('Docker Compose contains a machine-specific Windows path');
for(const marker of ['movie-library:/movies','tv-library:/tv','shared-downloads:/downloads'])if((compose.match(new RegExp(marker,'g'))||[]).length<2)failures.push(`Docker Compose does not share ${marker} with VynodeArr`);
if((mediaCompose.match(/target: \/media/g)||[]).length!==3)failures.push('Optional Docker main media folder is not shared with all three services');
if(!compose.includes('healthcheck:'))failures.push('Local Compose health check missing');
if(!image.includes('USER vynodearr'))failures.push('Production image does not use its unprivileged user');
if(!image.includes('HEALTHCHECK'))failures.push('Production image health check missing');
for(const marker of ['<Name>VynodeArr</Name>','ghcr.io/minerport/vynodearr-unified:latest','Target="8686"','Target="/config"','Target="/movies"','Target="/tv"','Target="/downloads"'])if(!unraid.includes(marker))failures.push(`Unraid marker missing: ${marker}`);
if(!new RegExp(`<Config Name="[^"]+" Target="/media" Default=""[^>]+Required="false"[^>]*><\\/Config>`).test(unraid))failures.push('Optional Unraid main media mapping is invalid: /media');
for(const target of ['/movies-2','/movies-3','/tv-2','/tv-3'])if(unraid.includes(`Target="${target}"`))failures.push(`Obsolete numbered Unraid mapping remains: ${target}`);
for(const forbidden of ['Target="/unraid-template"','templates-user'])if(unraid.includes(forbidden))failures.push(`Unsafe Unraid template access remains: ${forbidden}`);
for(const marker of ['<CommunityApplications>','<Profile>','<Icon>','<WebPage>','<Forum>'])if(!profile.includes(marker))failures.push(`Community Applications profile marker missing: ${marker}`);
for(const marker of ['<Registry>https://github.com/minerport/VynodeArr-Unified/pkgs/container/vynodearr-unified</Registry>','<Network>bridge</Network>','<Shell>sh</Shell>','<Privileged>false</Privileged>','<Project>https://github.com/minerport/VynodeArr-Unified</Project>','<Support>https://github.com/minerport/VynodeArr-Unified/issues</Support>','<Category>MediaApp:Video</Category>'])if(!unraid.includes(marker))failures.push(`Community Applications canonical field missing: ${marker}`);
if(!unraid.includes('main/templates/vynodearr.xml'))failures.push('Canonical Community Applications template URL is missing');
for(const field of ['MyIP','Description','ExtraSearchTerms','WebUI','ReadMe','Changes','Date','MinVer','License','ExtraParams','PostArgs','CPUset','DateInstalled','Requires'])if(new RegExp(`<${field}(?:[ >/])`).test(unraid))failures.push(`Unsupported Community Applications field remains: ${field}`);
try{JSON.parse(JSON.stringify({compose:true,image:true,unraid:true}));}catch{failures.push('Deployment metadata invalid');}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('Deployment validation passed.');
