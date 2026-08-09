import { readFile } from 'node:fs/promises';

const compose=await readFile(new URL('../compose.yaml',import.meta.url),'utf8');
const image=await readFile(new URL('../Dockerfile',import.meta.url),'utf8');
const unraid=await readFile(new URL('../templates/vynodearr.xml',import.meta.url),'utf8');
const profile=await readFile(new URL('../ca_profile.xml',import.meta.url),'utf8');
const failures=[];
if(!compose.includes('127.0.0.1:4310:4310'))failures.push('Local Compose is not loopback-bound');
if(!compose.includes('healthcheck:'))failures.push('Local Compose health check missing');
if(!image.includes('USER vynodearr'))failures.push('Production image does not use its unprivileged user');
if(!image.includes('HEALTHCHECK'))failures.push('Production image health check missing');
for(const marker of ['<Name>VynodeArr</Name>','ghcr.io/minerport/vynodearr-unified:latest','Target="8686"','Target="/config"','Target="/movies"','Target="/tv"','Target="/downloads"'])if(!unraid.includes(marker))failures.push(`Unraid marker missing: ${marker}`);
if(!new RegExp(`<Config Name="[^"]+" Target="/media" Default=""[^>]+Required="false"[^>]*><\\/Config>`).test(unraid))failures.push('Optional Unraid main media mapping is invalid: /media');
for(const target of ['/movies-2','/movies-3','/tv-2','/tv-3'])if(unraid.includes(`Target="${target}"`))failures.push(`Obsolete numbered Unraid mapping remains: ${target}`);
for(const forbidden of ['Target="/unraid-template"','templates-user'])if(unraid.includes(forbidden))failures.push(`Unsafe Unraid template access remains: ${forbidden}`);
for(const marker of ['<CommunityApplications>','<Profile>','<Icon>','<WebPage>','<Forum>'])if(!profile.includes(marker))failures.push(`Community Applications profile marker missing: ${marker}`);
for(const marker of ['<Registry>https://github.com/minerport/VynodeArr-Unified/pkgs/container/vynodearr-unified</Registry>','<MyIP/>','<License>Apache-2.0</License>','<ReadMe>https://raw.githubusercontent.com/minerport/VynodeArr-Unified/main/README.md</ReadMe>'])if(!unraid.includes(marker))failures.push(`Community Applications canonical field missing: ${marker}`);
if(!unraid.includes('main/templates/vynodearr.xml'))failures.push('Canonical Community Applications template URL is missing');
if(!unraid.includes('<Screenshot>'))failures.push('Community Applications screenshots are missing');
try{JSON.parse(JSON.stringify({compose:true,image:true,unraid:true}));}catch{failures.push('Deployment metadata invalid');}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('Deployment validation passed.');
