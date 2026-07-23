import { readdir,readFile } from 'node:fs/promises';
import { extname,join,relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const scanRoots=['apps/web','apps/api','packages/contracts','packages/platform','dist/apps','infrastructure/unraid','compose.yaml','Dockerfile','README.md',
  'docs/READ_ONLY_ENGINE_ADAPTERS.md','docs/ENGINE_CONFIGURATION.md','docs/SYNCHRONIZATION_AND_CACHE.md','docs/LOCAL_REVIEW_DEPLOYMENT.md','docs/UNRAID_REVIEW_DEPLOYMENT.md','docs/UNRAID_TEMPLATE.md','docs/AUTHENTICATION.md','docs/BRANDING_LEAK_PREVENTION.md','docs/REVIEW_TEST_PLAN.md'];
const prohibited=[/\bradarr\b/i,/\bsonarr\b/i],extensions=new Set(['.js','.html','.css','.json','.svg','.md','.yaml','.yml','.xml','']);
const violations=[];
async function scan(path){
  let entries;
  try{entries=await readdir(path,{withFileTypes:true});}
  catch{const text=await readFile(path,'utf8');for(const pattern of prohibited)if(pattern.test(text))violations.push(`${relative(root,path)}: ${pattern}`);return;}
  for(const entry of entries){const target=join(path,entry.name);if(entry.isDirectory())await scan(target);else if(extensions.has(extname(entry.name))){const text=await readFile(target,'utf8');for(const pattern of prohibited)if(pattern.test(text))violations.push(`${relative(root,target)}: ${pattern}`);}}
}
for(const target of scanRoots)await scan(join(root,target));
if(violations.length){console.error(`Public branding leak(s):\n${violations.join('\n')}`);process.exit(1);}
console.log('Branding scan passed: UI, API, build, deployment, and user documentation are neutral.');
