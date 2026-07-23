import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist=fileURLToPath(new URL('../dist/',import.meta.url));
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
await cp(new URL('../apps/',import.meta.url),new URL('../dist/apps/',import.meta.url),{recursive:true});
await cp(new URL('../packages/',import.meta.url),new URL('../dist/packages/',import.meta.url),{recursive:true});
await cp(new URL('../package.json',import.meta.url),new URL('../dist/package.json',import.meta.url));
console.log(`Runnable review build created at ${dist}`);
