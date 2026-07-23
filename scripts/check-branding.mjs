import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scanRoots = ['apps/web', 'apps/api', 'packages/contracts', 'packages/platform'];
const prohibited = [/\bradarr\b/i, /\bsonarr\b/i];
const textExtensions = new Set(['.js', '.html', '.css', '.json', '.svg', '.md']);
const violations = [];

async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (textExtensions.has(extname(entry.name))) {
      const text = await readFile(target, 'utf8');
      for (const pattern of prohibited) if (pattern.test(text)) violations.push(`${relative(root, target)}: ${pattern}`);
    }
  }
}

for (const path of scanRoots) await walk(join(root, path));
if (violations.length) {
  console.error(`Public branding leak(s):\n${violations.join('\n')}`);
  process.exit(1);
}
console.log('Branding scan passed: public product surfaces are neutral.');
