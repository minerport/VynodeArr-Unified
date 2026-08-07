import { readdir,stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory=resolve('apps/web/public/react');
let files;
try{files=await readdir(directory);}catch(error){
  if(error?.code==='ENOENT'){
    console.error('Web bundle budget requires a completed web build. Run npm run build:web first.');
    process.exit(1);
  }
  throw error;
}
const sizes=await Promise.all(files.map(async name=>({name,bytes:(await stat(resolve(directory,name))).size})));
const entry=sizes.find(file=>file.name==='vynodearr-react.js');
const shell=sizes.find(file=>file.name==='vynodearr-app.js');
const routeChunks=sizes.filter(file=>file.name.endsWith('.js')&&!['vynodearr-react.js','vynodearr-app.js'].includes(file.name));
const stylesheet=sizes.find(file=>file.name==='vynodearr-react.css');
// Keep the transitional application shell near its current minified baseline
// while typed routes continue moving out into independently loaded chunks.
// The shared stylesheet now includes the theme-wide glass component system and
// the movie/TV template review editors, account page-access controls, and the
// shared mobile interaction system. Keep headroom small enough to catch
// accidental growth while accounting for those intentional surfaces.
const limits={entry:300_000,shell:252_000,route:45_000,css:69_000};
// The admin-only Action Center adds one typed route/mount boundary to the shell;
// its UI and data views remain isolated in a lazy-loaded route chunk. The shell
// also restores the active hash route when Safari revives its back-forward cache.
const mobileAllowance={shell:1_800,css:3_000};
// The admin System route now includes catalog/event/artwork diagnostics and
// live resource controls. Keep that intentional surface under a narrow,
// route-specific allowance instead of raising every lazy-route budget.
const performanceAllowance={systemRoute:1_500,css:600};
// Poster Overlay Studio carries its destination-aware editor, grouped layer
// inspector, and exact live poster preview in one administrator-only lazy
// route. Keep its headroom isolated from every other application route.
const posterOverlayAllowance={route:4_250,css:2_500};
// Reeltrack adds one Discover-permission navigation bridge and a lazy Lists
// workspace. Vite folds the responsive route stylesheet into shared CSS.
const reeltrackAllowance={shell:600,css:7_500};
const failures=[];

if(!entry)failures.push('The React entry bundle was not produced.');
else if(entry.bytes>limits.entry)failures.push(`React entry is ${entry.bytes} bytes (limit ${limits.entry}).`);
if(!shell)failures.push('The TypeScript application shell bundle was not produced.');
else if(shell.bytes>limits.shell+mobileAllowance.shell+reeltrackAllowance.shell)failures.push(`Application shell is ${shell.bytes} bytes (limit ${limits.shell+mobileAllowance.shell+reeltrackAllowance.shell}).`);
for(const chunk of routeChunks){const routeLimit=limits.route+(chunk.name.startsWith('system-')?performanceAllowance.systemRoute:0)+(chunk.name.startsWith('poster-overlays-')?posterOverlayAllowance.route:0);if(chunk.bytes>routeLimit)failures.push(`${chunk.name} is ${chunk.bytes} bytes (route limit ${routeLimit}).`);}
if(stylesheet&&stylesheet.bytes>limits.css+mobileAllowance.css+performanceAllowance.css+posterOverlayAllowance.css+reeltrackAllowance.css)failures.push(`React stylesheet is ${stylesheet.bytes} bytes (limit ${limits.css+mobileAllowance.css+performanceAllowance.css+posterOverlayAllowance.css+reeltrackAllowance.css}).`);

if(failures.length){
  console.error(`Web bundle budget failed:\n- ${failures.join('\n- ')}`);
  process.exitCode=1;
}else{
  const largest=[...routeChunks].sort((a,b)=>b.bytes-a.bytes)[0];
  console.log(`Web bundle budget passed: entry ${entry?.bytes||0} bytes; shell ${shell?.bytes||0} bytes; largest route ${largest?.name||'none'} ${largest?.bytes||0} bytes.`);
}
