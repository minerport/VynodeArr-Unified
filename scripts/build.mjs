import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(new URL('../apps/web/public/', import.meta.url), new URL('../dist/web/', import.meta.url), { recursive: true });
await cp(new URL('../apps/api/src/', import.meta.url), new URL('../dist/api/', import.meta.url), { recursive: true });
console.log(`Build proof created at ${dist}`);
