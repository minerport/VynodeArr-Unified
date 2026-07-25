import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist=fileURLToPath(new URL('../dist/',import.meta.url));
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
await cp(new URL('../apps/',import.meta.url),new URL('../dist/apps/',import.meta.url),{recursive:true});
await rm(new URL('../dist/apps/api/',import.meta.url),{recursive:true,force:true});
await cp(new URL('../.server-build/apps/api/',import.meta.url),new URL('../dist/apps/api/',import.meta.url),{recursive:true});
await cp(new URL('../.server-build/packages/',import.meta.url),new URL('../dist/packages/',import.meta.url),{recursive:true});
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
manifest.scripts={start:'node apps/api/src/server.js'};
await writeFile(new URL('../dist/package.json',import.meta.url),`${JSON.stringify(manifest,null,2)}\n`);
console.log(`Runnable review build created at ${dist}`);
