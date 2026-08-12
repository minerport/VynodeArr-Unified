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
// inspector, exact live poster preview, destination-specific added dates,
// representative missing-metadata values, selection-to-settings navigation,
// and one shared stylesheet replacing per-preview runtime style injection.
// Keep its headroom isolated from every other application route.
const posterOverlayAllowance={route:7_700,css:6_700};
// Reeltrack adds one Discover-permission navigation bridge and a lazy Lists
// workspace. Vite folds the responsive route stylesheet into shared CSS.
const reeltrackAllowance={shell:600,css:7_500};
// The Reeltrack trailer downloader and managed Plex collection builder add a
// compact runtime-status strip, import-time automation fields, and per-list
// scheduling/status controls while keeping orchestration on the server.
const trailerDownloadAllowance={css:1_400};
// Managed-list artwork controls and host-path mapping now share compact,
// responsive rows instead of reserving a separate full-width row per field.
const managedListCompactAllowance={css:900};
// The shared Reeltrack artwork designer adds compact illustrated theatrical
// presets, four-corner canvas handles, and responsive grouped inspector fields.
const artworkDesignerAllowance={css:5_000};
// Library Review adds one administrator-only mount bridge and a responsive,
// independently loaded three-column file comparison surface with explicit
// cross-theme card alignment.
const libraryReviewAllowance={shell:600,css:4_800};
// Administrator media removal adds a shared, lazy detail dialog plus a small
// legacy-shell fallback for choosing whether files and folders are deleted.
const mediaRemovalAllowance={shell:700,css:1_300};
// Interactive search now keeps compact search, source, quality, status, and
// sorting controls available on phones instead of hiding desktop-only columns.
const releaseBrowserAllowance={css:2_500};
// Managed Reeltrack collections now use a numbered first-run setup flow with
// separate storage, scheduling, artwork, and sync-result cards.
const managedCollectionSetupAllowance={css:2_300};
// Poster Overlays now separates Plex history from VynodeArr assignments and
// explains preview-poster behavior, retains the poster visible when saved,
// composes stackable saved styles without replacing prior layers, and exposes
// in-place updates for every active library assignment using an edited style.
const overlayAssignmentClarityAllowance={route:4_600,css:1_000};
const reeltrackApiKeyLinkAllowance={css:100};
// Storage Folders now discovers the fixed optional Unraid mappings and direct
// children of /media, explains their container state, and registers a visible
// folder with the selected engine without granting access to Unraid's template.
const storageMappingAllowance={route:4_500};
// Same-folder detection adds a guarded, preview-first migration entry point to
// Storage Folders. The confirmation panel and request implementation remain in
// separate on-demand chunks; this allowance covers only the route orchestration.
const storagePathMigrationAllowance={route:1_300};
// Real migration progress adds only the batch loop and progress state to the
// route; timing and presentation remain isolated in the on-demand dialog.
const storagePathProgressAllowance={route:400};
// Completed path migrations now require an engine-confirmed zero-reference
// result after VynodeArr synchronization before the route reports success.
const storageEngineVerificationAllowance={route:500};
// Recursive /media browsing keeps folder rows and registration controls in a
// separate on-demand chunk; the route retains only expansion state and loader.
const nestedMediaFolderAllowance={route:700};
// Destination choice is now explicit in requests, Add Media, and Reeltrack
// automation. Storage also exposes a direct make-default action.
const mediaDestinationChoiceAllowance={rootFoldersRoute:1_000,reeltrackRoute:3_500};
// Mixed provider lists retain one synchronization identity while rendering
// movie and television titles in separate engine-aware sections. The small
// allowance is isolated to that lazy route and its responsive section headers.
const mixedListSectionsAllowance={route:1_500,css:700};
const failures=[];

if(!entry)failures.push('The React entry bundle was not produced.');
else if(entry.bytes>limits.entry)failures.push(`React entry is ${entry.bytes} bytes (limit ${limits.entry}).`);
if(!shell)failures.push('The TypeScript application shell bundle was not produced.');
else if(shell.bytes>limits.shell+mobileAllowance.shell+reeltrackAllowance.shell+libraryReviewAllowance.shell+mediaRemovalAllowance.shell)failures.push(`Application shell is ${shell.bytes} bytes (limit ${limits.shell+mobileAllowance.shell+reeltrackAllowance.shell+libraryReviewAllowance.shell+mediaRemovalAllowance.shell}).`);
for(const chunk of routeChunks){const routeLimit=limits.route+(chunk.name.startsWith('system-')?performanceAllowance.systemRoute:0)+(chunk.name.startsWith('poster-overlays-')?posterOverlayAllowance.route+overlayAssignmentClarityAllowance.route:0)+(chunk.name.startsWith('root-folders-')?storageMappingAllowance.route+mediaDestinationChoiceAllowance.rootFoldersRoute+storagePathMigrationAllowance.route+storagePathProgressAllowance.route+storageEngineVerificationAllowance.route+nestedMediaFolderAllowance.route:0)+(chunk.name.startsWith('reeltrack-lists-')?mediaDestinationChoiceAllowance.reeltrackRoute+mixedListSectionsAllowance.route:0);if(chunk.bytes>routeLimit)failures.push(`${chunk.name} is ${chunk.bytes} bytes (route limit ${routeLimit}).`);}
if(stylesheet&&stylesheet.bytes>limits.css+mobileAllowance.css+performanceAllowance.css+posterOverlayAllowance.css+reeltrackAllowance.css+trailerDownloadAllowance.css+managedListCompactAllowance.css+artworkDesignerAllowance.css+libraryReviewAllowance.css+mediaRemovalAllowance.css+releaseBrowserAllowance.css+managedCollectionSetupAllowance.css+overlayAssignmentClarityAllowance.css+reeltrackApiKeyLinkAllowance.css+mixedListSectionsAllowance.css)failures.push(`React stylesheet is ${stylesheet.bytes} bytes (limit ${limits.css+mobileAllowance.css+performanceAllowance.css+posterOverlayAllowance.css+reeltrackAllowance.css+trailerDownloadAllowance.css+managedListCompactAllowance.css+artworkDesignerAllowance.css+libraryReviewAllowance.css+mediaRemovalAllowance.css+releaseBrowserAllowance.css+managedCollectionSetupAllowance.css+overlayAssignmentClarityAllowance.css+reeltrackApiKeyLinkAllowance.css+mixedListSectionsAllowance.css}).`);

if(failures.length){
  console.error(`Web bundle budget failed:\n- ${failures.join('\n- ')}`);
  process.exitCode=1;
}else{
  const largest=[...routeChunks].sort((a,b)=>b.bytes-a.bytes)[0];
  console.log(`Web bundle budget passed: entry ${entry?.bytes||0} bytes; shell ${shell?.bytes||0} bytes; largest route ${largest?.name||'none'} ${largest?.bytes||0} bytes.`);
}
