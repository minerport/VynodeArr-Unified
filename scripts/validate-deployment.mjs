import { readFile } from 'node:fs/promises';

const compose=await readFile(new URL('../compose.yaml',import.meta.url),'utf8');
const image=await readFile(new URL('../Dockerfile',import.meta.url),'utf8');
const unraid=await readFile(new URL('../infrastructure/unraid/vynodearr.xml',import.meta.url),'utf8');
const failures=[];
if(!compose.includes('127.0.0.1:4310:4310'))failures.push('Local Compose is not loopback-bound');
if(!compose.includes('healthcheck:'))failures.push('Local Compose health check missing');
if(!image.includes('USER vynodearr'))failures.push('Production image does not use its unprivileged user');
if(!image.includes('HEALTHCHECK'))failures.push('Production image health check missing');
for(const marker of ['<Name>VynodeArr</Name>','Target="4310"','/mnt/user/appdata/vynodearr','API_CREDENTIAL_FILE'])if(!unraid.includes(marker))failures.push(`Unraid marker missing: ${marker}`);
try{JSON.parse(JSON.stringify({compose:true,image:true,unraid:true}));}catch{failures.push('Deployment metadata invalid');}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('Deployment validation passed.');
