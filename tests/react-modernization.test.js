import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('loaded Action Center records cannot widen the mobile viewport',async()=>{
  const [styles,navigation]=await Promise.all([read('apps/web/public/styles.css'),read('apps/web/client/src/navigation-lifecycle.ts')]);
  assert.match(styles,/\.operations-center > \*,[\s\S]*?\.operations-action header > div[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/);
  assert.match(styles,/\.operations-action h2,[\s\S]*?overflow-wrap: anywhere;[\s\S]*?word-break: break-word;/);
  assert.match(styles,/@media \(max-width: 800px\)[\s\S]*?\.operations-tabs,[\s\S]*?\.operations-toolbar[\s\S]*?max-width: 100%;/);
  assert.match(styles,/\.operations-action > header \{[\s\S]*?position: static;[\s\S]*?height: auto;[\s\S]*?background: transparent;/);
  assert.match(navigation,/addEventListener\('pageshow',onPageShow\)/);
  assert.match(navigation,/persisted&&void options\.route\(\)/);
});

test('library titles can be attributed to a user without creating another download request',async()=>{
  const [detail,collections,server,queue,history,wanted,notifications,libraryCss]=await Promise.all([read('apps/web/client/src/discover-detail.tsx'),read('apps/web/client/src/collections.tsx'),read('apps/api/src/app.js'),read('apps/web/client/src/queue.tsx'),read('apps/web/client/src/history.tsx'),read('apps/web/client/src/wanted.tsx'),read('apps/web/client/src/notifications.tsx'),read('apps/web/public/library-enhancements.css')]);
  assert.match(detail,/Add to my collection/);assert.match(detail,/\/api\/user-collections\/items/);assert.match(detail,/\/api\/user-collections\/contains/);
  assert.match(collections,/userCollections/);assert.match(collections,/collectionSource/);assert.match(server,/userRequestCollections/);assert.match(server,/user_collection\.item_added/);
  for(const value of ['collection-statistics','collection-sharing-editor','collection-bulk-bar','collection-timeline','Export JSON','Export CSV','Import JSON','Recently requested'])assert.ok(collections.includes(value),value);
  for(const value of ['/api/user-collections/sharing','/api/user-collections/timeline','/api/user-collections/export','/api/user-collections/import','/api/user-collections/bulk','/api/request-attribution'])assert.ok(server.includes(value),value);
  for(const source of [queue,history,wanted,notifications])assert.match(source,/Requested by/);
  assert.match(collections,/ModalPortal/);assert.match(collections,/currentUserId/);assert.match(collections,/items\.slice\(0,30\)/);
  assert.match(server,/currentUserId:session\.user\.id/);assert.match(libraryCss,/\.vynode-nested-modal-layer > \.collection-builder-dialog\[open\]/);assert.match(libraryCss,/transform: none !important/);
});

test('the complete dashboard has a React view with a legacy-safe bridge',async()=>{
  const [packageJson,index,app,entry,dashboard,analytics,library,libraryCss,libraryTypes,history,queue,wanted,calendar,movieDetail,tvDetail,collections,collectionTypes,addMedia,addMediaTypes,health,healthTypes,account,accountTypes,system,systemTypes,selectionRules,selectionRuleTypes,bundleBudget,unraidDockerfile]=await Promise.all([
    read('package.json'),
    read('apps/web/public/index.html'),
    read('apps/web/client/src/app-shell.ts'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/dashboard.tsx'),
    read('apps/web/client/src/dashboard-analytics.tsx'),
    read('apps/web/client/src/library.tsx'),
    read('apps/web/client/src/react-library.css'),
    read('apps/web/client/src/library-types.ts'),
    read('apps/web/client/src/history.tsx'),
    read('apps/web/client/src/queue.tsx'),
    read('apps/web/client/src/wanted.tsx'),
    read('apps/web/client/src/calendar.tsx'),
    read('apps/web/client/src/movie-detail.tsx'),
    read('apps/web/client/src/tv-detail.tsx'),
    read('apps/web/client/src/collections.tsx'),
    read('apps/web/client/src/collection-types.ts'),
    read('apps/web/client/src/add-media.tsx'),
    read('apps/web/client/src/add-media-types.ts'),
    read('apps/web/client/src/health.tsx'),
    read('apps/web/client/src/health-types.ts'),
    read('apps/web/client/src/account.tsx'),
    read('apps/web/client/src/account-types.ts'),
    read('apps/web/client/src/system.tsx'),
    read('apps/web/client/src/system-types.ts'),
    read('apps/web/client/src/selection-rules.tsx'),
    read('apps/web/client/src/selection-rules-types.ts'),
    read('scripts/check-web-bundle.mjs'),
    read('Dockerfile.unraid')
  ]);
  const manifest=JSON.parse(packageJson);

  assert.match(manifest.scripts['build:web'],/vite build/);
  assert.equal(manifest.dependencies.react,'19.2.8');
  assert.match(index,/\/react\/vynodearr-react\.js/);
  assert.match(index,/\/react\/vynodearr-app\.js/);
  assert.match(app,/mountDashboard/);
  assert.match(app,/dashboard-react/);
  assert.match(app,/mountLibrary/);
  assert.match(app,/showHistoryReact/);
  assert.match(app,/content\.replaceChildren/);
  assert.match(entry,/createRoot/);
  assert.match(entry,/import\('\.\/library'\)/);
  assert.match(entry,/import\('\.\/movie-detail'\)/);
  assert.match(entry,/DashboardRoute/);
  assert.match(dashboard,/DashboardView/);
  assert.match(entry,/LibraryView/);
  assert.match(entry,/unmountLibrary/);
  assert.match(entry,/HistoryView/);
  assert.match(entry,/unmountHistory/);
  assert.match(entry,/QueueView/);
  assert.match(entry,/unmountQueue/);
  assert.match(entry,/WantedView/);
  assert.match(entry,/unmountWanted/);
  assert.match(entry,/CalendarView/);
  assert.match(entry,/unmountCalendar/);
  assert.match(entry,/MovieDetailView/);
  assert.match(entry,/unmountMovieDetail/);
  assert.match(entry,/mountTvDetail/);
  assert.match(entry,/unmountTvDetail/);
  assert.match(entry,/mountCollections/);
  assert.match(entry,/unmountCollections/);
  assert.match(entry,/import\('\.\/collections'\)/);
  assert.match(entry,/mountAddMedia/);
  assert.match(entry,/unmountAddMedia/);
  assert.match(entry,/import\('\.\/add-media'\)/);
  assert.match(entry,/mountHealth/);
  assert.match(entry,/unmountHealth/);
  assert.match(entry,/import\('\.\/health'\)/);
  assert.match(entry,/mountAccount/);
  assert.match(entry,/unmountAccount/);
  assert.match(entry,/import\('\.\/account'\)/);
  assert.match(entry,/mountSystem/);
  assert.match(entry,/unmountSystem/);
  assert.match(entry,/import\('\.\/system'\)/);
  assert.match(entry,/mountSelectionRules/);
  assert.match(entry,/import\('\.\/selection-rules'\)/);
  assert.match(app,/service\/custom-formats/);
  assert.match(app,/service\/release-profiles/);
  assert.match(selectionRules,/customFormatSchemas/);
  assert.match(selectionRules,/New custom format/);
  assert.match(selectionRules,/includeCustomFormatWhenRenaming/);
  assert.match(selectionRules,/condition\.negate/);
  assert.match(selectionRules,/condition\.required/);
  assert.match(selectionRules,/minFormatScore/);
  assert.match(selectionRules,/cutoffFormatScore/);
  assert.match(app,/Allowed qualities exceed this cutoff/);
  assert.match(app,/cutoff stops upgrades; it is not a maximum/);
  assert.match(selectionRules,/minUpgradeFormatScore/);
  assert.match(selectionRules,/releaseProfiles/);
  assert.doesNotMatch(selectionRules,/domain==='movie'\?'restrictions'/);
  assert.match(selectionRules,/airDateRestriction/);
  assert.match(selectionRules,/airDateGracePeriod/);
  assert.match(selectionRules,/allowSeasonPackWithoutAllEpisodesAired/);
  assert.match(selectionRules,/includePreferredWhenRenaming/);
  assert.match(selectionRules,/preferred-editor/);
  assert.match(selectionRules,/excludedTags/);
  assert.match(selectionRules,/\/tags/);
  assert.match(selectionRules,/\/indexers/);
  assert.match(selectionRuleTypes,/SelectionRulesMountOptions/);
  assert.match(dashboard,/Recently imported/);
  assert.match(dashboard,/Recent engine events/);
  assert.match(dashboard,/dashboard-attention-grid/);
  assert.match(analytics,/DashboardAnalyticsView/);
  assert.match(account,/AccountView/);
  assert.match(account,/Active Sessions/);
  assert.match(account,/Create user/);
  assert.match(accountTypes,/AccountMountOptions/);
  assert.match(app,/showAccountReact/);
  assert.match(system,/SystemView/);
  assert.match(system,/Create both engine backups/);
  for(const workflow of ['ApplicationBackups','Download application backup','Inspect & restore','.vynodearr-backup','Type RESTORE','/api/system/application-backup'])assert.match(system,new RegExp(workflow.replace(/[&]/g,'&')));
  assert.match(system,/AuditLog/);
  assert.match(system,/\/api\/manage\/audit/);
  assert.match(system,/All administrators/);
  assert.match(system,/administrator activity/);
  for(const workflow of ['Validation','POST-UPDATE & RECOVERY','Run validation','Installation validated','Repairing…','/api/system/validation'])assert.match(system,new RegExp(workflow.replace(/[&]/g,'&')));
  assert.match(system,/Automatic schedules are active/);
  assert.match(system,/Find events/);
  assert.match(system,/storageSize/);
  assert.match(system,/TB/);
  assert.match(systemTypes,/SystemMountOptions/);
  assert.match(app,/showSystemReact/);
  assert.match(library,/Filter titles/);
  assert.match(library,/onMonitor/);
  assert.match(library,/onItemChange/);
  assert.match(library,/saved\.result\?\.monitored\s*\?\?\s*next/);
  assert.match(library,/Search all missing/);
  assert.match(library,/MoviesSearch/);
  assert.match(library,/Cutoff unmet/);
  assert.match(library,/Unmonitored/);
  assert.match(library,/At cutoff/);
  assert.match(library,/cutoffUnmetEpisodes/);
  assert.match(library,/LibraryStatusBadges/);
  assert.match(library,/library-alphabet-rail/);
  assert.match(library,/selectFromPointer/);
  assert.match(library,/scrollIntoView/);
  assert.match(library,/IntersectionObserver/);
  assert.match(library,/setDebouncedQuery/);
  assert.match(library,/sessionStorage/);
  assert.match(library,/onPointerEnter=\{prefetch\}/);
  assert.match(library,/preloadRoute/);
  assert.match(library,/\/api\/media\/movies\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(library,/\/api\/media\/tv\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(libraryCss,/content-visibility:auto/);
  assert.match(libraryCss,/react-poster-title \.library-status-badges/);
  assert.match(libraryCss,/aspect-ratio:auto/);
  assert.match(libraryTypes,/LibraryMountOptions/);
  assert.match(history,/Organize again/);
  assert.match(history,/Imported into library/);
  assert.match(history,/Download grabbed/);
  assert.match(history,/event\.organizable/);
  assert.match(history,/Activity type/);
  assert.match(history,/Find activity/);
  assert.match(queue,/Select all completed/);
  assert.match(queue,/Queue totals/);
  assert.match(queue,/Movie engine/);
  assert.match(queue,/TV engine/);
  assert.match(queue,/item\.domain==='movie'/);
  assert.match(queue,/\/api\/activity\/queue\/live/);
  assert.match(queue,/useVisibleRefresh\(\(\)=>load\(true\),5000,\{immediate:false\}\)/);
  assert.match(queue,/requestSequence/);
  assert.match(queue,/startupRetries/);
  assert.match(wanted,/Search all missing/);
  assert.match(wanted,/Interactive search/);
  assert.match(wanted,/SeriesSearch/);
  assert.match(calendar,/Previous month/);
  assert.match(calendar,/\/api\/calendar\?start=/);
  assert.doesNotMatch(calendar,/\/api\/manage\/(?:movie|tv)\/calendar/);
  assert.match(movieDetail,/Automatic search/);
  assert.match(movieDetail,/MatchBrowser/);
  assert.doesNotMatch(movieDetail.match(/const applyMatch=[\s\S]*?if\(loading\)/)?.[0]||'',/catch\(reason\)\{options\.notify/);
  assert.match(movieDetail,/ReleaseBrowser/);
  assert.match(movieDetail,/RenamePreview/);
  assert.match(movieDetail,/is-working/);
  assert.match(movieDetail,/Finding releases/);
  assert.match(movieDetail,/AbortController/);
  assert.match(movieDetail,/enrichmentLoading/);
  assert.match(movieDetail,/method:'POST'/);
  assert.match(movieDetail,/saved\.result\?\.monitored\?\?next/);
  assert.match(tvDetail,/interactive\(`seriesId=\$\{engineId\}`/);
  assert.match(tvDetail,/MatchBrowser/);
  assert.doesNotMatch(tvDetail.match(/const applyMatch=[\s\S]*?if\(loading\)/)?.[0]||'',/catch\(reason\)\{options\.notify/);
  assert.match(tvDetail,/seasonNumber=\$\{season\.seasonNumber\}/);
  assert.match(tvDetail,/RenamePreview/);
  const renamePreview=await read('apps/web/client/src/rename-preview.tsx');
  assert.match(renamePreview,/renameAfterFolderMove/);
  assert.match(renamePreview,/Recalculate using the active movie naming format/);
  assert.match(renamePreview,/immediately after moving the folder/);
  assert.match(tvDetail,/busy==='SeriesSearch'/);
  assert.match(tvDetail,/command\('SeasonSearch',\{seriesId:engineId,seasonNumber:season\.seasonNumber\}\)/);
  assert.match(tvDetail,/saved\.result\?\.monitored\?\?next/);
  assert.match(tvDetail,/AbortController/);
  assert.match(movieDetail,/ModalPortal/);
  assert.match(tvDetail,/ModalPortal/);
  const modalPortal=await read('apps/web/client/src/modal-portal.tsx');
  const foundation=await read('apps/web/public/ui-foundation.css');
  assert.match(modalPortal,/createPortal/);
  assert.match(modalPortal,/document\.body/);
  assert.match(foundation,/\.vynode-nested-modal-layer/);
  assert.match(foundation,/max-height:\s*calc\(100dvh - 2rem\)/);
  assert.match(movieDetail,/Rename & organize/);
  assert.match(collections,/export function CollectionsView/);
  assert.match(collections,/CollectionBuilder/);
  assert.match(collections,/includedMovieIds/);
  assert.match(collections,/excludedMovieIds/);
  assert.match(collections,/Changing rules replaces the current matches/);
  assert.match(collections,/Edit rules &amp; movies/);
  assert.match(collections,/Everything/);assert.match(collections,/USER COLLECTION/);assert.match(collections,/Movies/);assert.match(collections,/Television/);assert.match(collections,/userCollections/);
  assert.match(collectionTypes,/interface CollectionRules/);
  assert.match(collectionTypes,/interface UserMediaCollection/);
  assert.match(app,/showCollectionsReact/);
  assert.match(addMedia,/export function AddMediaView/);
  assert.match(addMedia,/searchForMovie/);
  assert.match(addMedia,/searchForMissingEpisodes/);
  assert.match(addMedia,/minimumAvailability/);
  assert.match(addMedia,/seasonFolder:true/);
  assert.match(addMediaTypes,/interface AddMediaMountOptions/);
  assert.match(app,/showAddMediaReact/);
  assert.match(health,/export function HealthView/);
  assert.match(health,/Review root folders/);
  assert.match(health,/Review download clients/);
  assert.match(healthTypes,/interface HealthMountOptions/);
  assert.match(app,/showHealthReact/);
  assert.doesNotMatch(app,/function healthFix/);
  assert.match(manifest.scripts.verify,/check:web-bundle/);
  assert.match(bundleBudget,/limits=\{entry:300_000,shell:252_000,route:45_000,css:69_000\}/);
  assert.match(unraidDockerfile,/FROM node:24-alpine AS web-build/);
  assert.match(unraidDockerfile,/apps\/web\/public\/react/);
});

test('dashboard resolves television quality profile names and reports real storage',async()=>{
  const api=await read('apps/api/src/app.js');
  assert.match(api,/management\.execute\('tv','profiles','GET'\)/);
  assert.match(api,/qualityProfiles\.tv\?\.get\(String\(item\.qualityProfile\)\)/);
  assert.match(api,/analytics\.library\.movie\.sizeOnDisk\+analytics\.library\.tv\.sizeOnDisk/);
});

test('the Node API has a compiled TypeScript migration boundary',async()=>{
  const [manifest,config,tmdb,build,image]=await Promise.all([
    read('package.json'),
    read('tsconfig.server.json'),
    read('apps/api/src/tmdb-discovery.ts'),
    read('scripts/build.mjs'),
    read('Dockerfile.unraid')
  ]);
  assert.match(JSON.parse(manifest).scripts['build:server'],/tsc --project tsconfig\.server\.json/);
  assert.match(config,/"module": "NodeNext"/);
  assert.match(config,/"allowJs": true/);
  assert.match(tmdb,/type DiscoveryOptions=/);
  assert.match(tmdb,/class TmdbDiscoveryService/);
  assert.match(build,/\.server-build\/apps\/api/);
  assert.match(image,/npm run build:server/);
  assert.match(image,/\.server-build\/apps\/api/);
});

test('library navigation preserves mounted views and safely reuses short-lived reads',async()=>{
  const [legacy,client,appState,dispatch]=await Promise.all([
    read('apps/web/client/src/app-shell.ts'),
    read('apps/web/client/src/api-client.ts'),
    read('apps/web/client/src/app-state.ts'),
    read('apps/web/client/src/route-dispatch.ts')
  ]);
  assert.match(client,/const responseCache=new Map<string,CachedResponse>\(\)/);
  assert.match(client,/export function cacheLifetime/);
  assert.match(client,/responseInflight\.has\(path\)/);
  assert.match(client,/responseCache\.clear\(\)/);
  assert.match(client,/activeRequests\.get\(requestKey\)\?\.abort\(\)/);
  assert.match(legacy,/const api=createApiClient/);
  assert.match(legacy,/csrfToken:\(\)=>state\.csrf/);
  assert.match(legacy,/onUnauthorized:async/);
  assert.match(legacy,/onMutation:path/);
  assert.match(appState,/libraryStale:\{movies:false,tv:false\}/);
  assert.match(legacy,/preserveLibrary/);
  assert.match(dispatch,/state\.preserveLibrary&&!state\.libraryStale\[key\]/);
  assert.match(legacy,/if\(!document\.querySelector\('#movies-react'\)\)await showMedia\('movies'\)/);
  assert.match(legacy,/if\(!document\.querySelector\('#tv-react'\)\)await showMedia\('tv'\)/);
});

test('poster library cards expose engine metadata without eager TMDB requests',async()=>{
  const library=await read('apps/web/client/src/library.tsx');
  assert.match(library,/className="react-poster-title"/);
  assert.match(library,/item\.rating/);
  assert.match(library,/episodeCounts/);
  assert.doesNotMatch(library,/Promise\.all\(.*tmdb/is);
});

test('Discover progressively loads and owns title details and requests through a typed React route',async()=>{
  const [discover,detail,request,islands,legacy,styles]=await Promise.all([
    read('apps/web/client/src/discover.tsx'),
    read('apps/web/client/src/discover-detail.tsx'),
    read('apps/web/client/src/discover-request.tsx'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts'),
    read('apps/web/public/styles.css')
  ]);
  assert.match(discover,/export function DiscoverView/);
  assert.match(discover,/loadFeed/);
  assert.match(discover,/cachedRequest/);
  assert.match(discover,/<DiscoverDetail/);
  assert.match(detail,/export function DiscoverDetail/);
  assert.match(detail,/\/api\/discover\/details/);
  assert.match(request,/export function DiscoverRequest/);
  assert.match(request,/\/api\/discover\/import-options/);
  assert.match(request,/\/api\/discover\/request/);
  assert.match(request,/Fix movie match/);
  assert.match(request,/discover-match-dialog/);
  assert.match(styles,/\.discover-match-dialog\{[^}]*width:min\(42rem/);
  assert.match(styles,/\.discover-request-match\{[^}]*width:100%;max-width:100%/);
  assert.match(request,/setResolvedItem\(candidate\)/);
  assert.match(request,/tmdbId:resolvedItem\.tmdbId/);
  assert.match(discover,/onRequested=\{requested=>/);
  assert.match(discover,/libraryKeys\(requested\.domain,requested\.title,requested\.year\)/);
  assert.doesNotMatch(detail,/vynodearr:discover-request/);
  assert.match(islands,/mountDiscover/);
  assert.match(islands,/preloadRoute/);
  assert.match(legacy,/vynodearr\.dashboardSnapshot/);
});

test('global import progress uses a typed React monitor with the legacy path retained as fallback',async()=>{
  const [monitor,visibleRefresh,types,controller,poller,fallbackView,islands,legacy]=await Promise.all([
    read('apps/web/client/src/import-monitor.tsx'),
    read('apps/web/client/src/use-visible-refresh.ts'),
    read('apps/web/client/src/import-monitor-types.ts'),
    read('apps/web/client/src/background-import.ts'),
    read('apps/web/client/src/import-monitor-controller.ts'),
    read('apps/web/client/src/legacy-import-monitor-view.ts'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(monitor,/export function ImportMonitor/);
  assert.match(monitor,/useVisibleRefresh\(load,2000\)/);
  assert.match(visibleRefresh,/document\.visibilityState === "visible"/);
  assert.match(visibleRefresh,/window\.setInterval/);
  assert.match(monitor,/\/api\/import-jobs/);
  assert.match(monitor,/Canceling…/);
  assert.match(types,/interface ImportMonitorOptions/);
  assert.match(types,/ImportJobStatus/);
  assert.match(islands,/mountImportMonitor/);
  assert.match(legacy,/window\.VynodeArrReact\?\.mountImportMonitor/);
  assert.match(controller,/if\(!options\.reactMonitorActive\(\)\)options\.renderFallback/);
  assert.match(poller,/export function createImportMonitorController/);
  assert.match(poller,/milestones=new Map<string,number>/);
  assert.match(poller,/options\.onMilestone\(job\)/);
  assert.match(fallbackView,/export function createLegacyImportMonitorView/);
  assert.match(fallbackView,/cancel-import-job/);
  assert.match(legacy,/createImportMonitorController/);
  assert.match(legacy,/renderFallback:legacyImportView\.render/);
});

test('advanced engine resources use a typed schema-driven React editor',async()=>{
  const [management,types,islands,legacy,lifecycle]=await Promise.all([
    read('apps/web/client/src/management.tsx'),
    read('apps/web/client/src/management-types.ts'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts'),
    read('apps/web/client/src/route-lifecycle.ts')
  ]);
  assert.match(management,/export function ManagementView/);
  assert.match(management,/indexerSchemas/);
  assert.match(management,/downloadClientSchemas/);
  assert.match(management,/management-native-fields/);
  assert.match(management,/Advanced JSON/);
  assert.match(management,/methods\.includes\('POST'\)\?'POST':methods\.includes\('PUT'\)\?'PUT':null/);
  assert.match(management,/Read only/);
  assert.match(legacy,/teardownRoute/);
  assert.match(lifecycle,/unmountDashboardAnalytics/);
  assert.match(lifecycle,/unmountHealth/);
  assert.match(types,/interface ManagementField/);
  assert.match(islands,/mountManagement/);
  assert.match(legacy,/showManagementReact/);
  assert.match(lifecycle,/unmountManagement/);
});

test('media naming and importing settings use a typed React route without flattening away native fields',async()=>{
  const [view,types,islands,legacy]=await Promise.all([
    read('apps/web/client/src/media-management.tsx'),
    read('apps/web/client/src/media-management-types.ts'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(view,/export function MediaManagementView/);
  assert.match(view,/const flatten=/);
  assert.match(view,/const setPath=/);
  assert.match(view,/\/naming/);
  assert.match(view,/Naming audit/);
  assert.match(view,/\/api\/media-files\/naming-audit/);
  assert.match(view,/Running an audit does not rename or move anything/);
  assert.match(view,/Select all shown/);
  assert.match(view,/Folder issues/);
  assert.match(view,/Filename issues/);
  assert.match(view,/Rename selected/);
  assert.match(view,/auditSelected\.has\(result\.mediaId\)/);
  assert.match(view,/Rename queued/);
  assert.match(view,/\/mediaManagement/);
  assert.match(view,/copyUsingHardlinks/);
  assert.match(types,/type MediaSettings=Record<string,unknown>/);
  assert.match(islands,/mountMediaManagement/);
  assert.match(legacy,/showMediaManagementReact/);
});

test('storage folders and import review use a typed React route and analysis boundary',async()=>{
  const [view,types,analysis,review,islands,legacy]=await Promise.all([
    read('apps/web/client/src/root-folders.tsx'),
    read('apps/web/client/src/root-folders-types.ts'),
    read('apps/web/client/src/library-import-analysis.ts'),
    read('apps/web/client/src/library-import-review.tsx'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(view,/export function RootFoldersView/);
  assert.match(view,/\/api\/settings\/download-folders/);
  assert.match(view,/\/rootFolders/);
  assert.match(view,/\/filesystem\?/);
  assert.match(view,/Download and library paths match/);
  assert.match(view,/setScanRoot\(root\)/);
  assert.match(view,/LibraryImportReview/);
  assert.match(view,/ModalPortal/);
  assert.match(types,/interface RootFoldersMountOptions/);
  assert.match(types,/startImport:/);
  assert.match(islands,/mountRootFolders/);
  assert.match(legacy,/showRootFoldersReact/);
  assert.match(legacy,/startImport:startBackgroundImport/);
  assert.match(legacy,/async function reviewLibraryImport/);
  assert.match(legacy,/document\.body\.appendChild\(Object\.assign\(document\.createElement\('dialog'\),\{id:'detail-dialog'\}\)\)/);
  assert.match(legacy,/analyzeDuplicateFolders/);
  assert.match(legacy,/classifyImportChoice/);
  assert.doesNotMatch(legacy,/function scanNameParts/);
  assert.doesNotMatch(legacy,/async function duplicateFolderDetails/);
  assert.match(analysis,/export function scanNameParts/);
  assert.match(analysis,/export function classifyImportChoice/);
  assert.match(analysis,/export async function analyzeDuplicateFolders/);
  assert.match(review,/export function LibraryImportReview/);
  assert.match(review,/concurrentMap\(folders,4/);
  assert.match(review,/analyzeDuplicateFolders/);
  assert.match(review,/classifyImportChoice/);
  assert.match(review,/Select all shown/);
  assert.match(review,/Possible mismatches/);
  assert.match(review,/Find match/);
  assert.match(review,/Already imported match/);
  assert.match(review,/options\.startImport\(domain,items\)/);
  assert.match(review,/Possible duplicate/);
  assert.match(review,/Newest copy/);
});

test('background import creation and monitor handoff have typed ownership',async()=>{
  const [controller,legacy]=await Promise.all([
    read('apps/web/client/src/background-import.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(controller,/export async function queueBackgroundImport/);
  assert.match(controller,/request<\{job:ImportJob\}>\('\/api\/import-jobs'/);
  assert.match(controller,/dismissed\.delete\(job\.id\)/);
  assert.match(controller,/persistDismissed\(\)/);
  assert.match(controller,/if\(!options\.reactMonitorActive\(\)\)options\.renderFallback/);
  assert.match(controller,/queued for background import/);
  assert.match(legacy,/queueBackgroundImport\(\{domain,items/);
  assert.doesNotMatch(legacy,/async function startBackgroundImport/);
});

test('indexers and download clients use a typed native provider editor with connection testing',async()=>{
  const [view,types,islands,legacy,gateway]=await Promise.all([
    read('apps/web/client/src/provider-settings.tsx'),
    read('apps/web/client/src/provider-settings-types.ts'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts'),
    read('packages/platform/src/engine-management-service.js')
  ]);
  assert.match(view,/export function ProviderSettingsView/);
  assert.match(view,/indexerSchemas/);
  assert.match(view,/downloadClientSchemas/);
  assert.match(view,/Test connection/);
  assert.match(view,/Show advanced/);
  assert.match(view,/selectOptions/);
  assert.match(view,/downloadClientSettings/);
  assert.match(types,/interface ProviderSettingsMountOptions/);
  assert.match(islands,/mountProviderSettings/);
  assert.match(legacy,/showProviderSettingsReact/);
  assert.match(gateway,/indexerTest:\{path:'indexer\/test'/);
  assert.match(gateway,/downloadClientTest:\{path:'downloadclient\/test'/);
  assert.match(gateway,/importListTest:\{path:'importlist\/test'/);
  assert.match(view,/Import Lists/);
  assert.match(view,/ImportListSync/);
  assert.match(view,/Complete native configuration/);
});

test('React service settings routes share one complete navigation component',async()=>{
  const [tabs,...routes]=await Promise.all([
    read('apps/web/client/src/service-tabs.tsx'),
    read('apps/web/client/src/guide-templates.tsx'),
    read('apps/web/client/src/provider-settings.tsx'),
    read('apps/web/client/src/media-management.tsx'),
    read('apps/web/client/src/root-folders.tsx'),
    read('apps/web/client/src/selection-rules.tsx')
  ]);
  for(const href of ['#service/root-folders','#service/library-health','#service/media-management','#service/profiles','#service/custom-formats','#service/guide-templates','#service/release-profiles','#service/indexers','#service/download-clients','#service/import-lists','#service/discover','#management']){
    assert.match(tabs,new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.doesNotMatch(tabs,/scrollIntoView/);
  assert.match(tabs,/parent\.scrollTo\(\{left:Math\.max\(0,centered\),behavior:"auto"\}\)/);
  for(const route of [routes[0],routes[4]]){
    assert.match(route,/ModalPortal/);
    assert.doesNotMatch(route,/createPortal/);
  }
  for(const route of routes){
    assert.match(route,/ServiceTabs/);
    assert.doesNotMatch(route,/<nav className="settings-tabs"/);
  }
});

test('administrator account navigation retains access to engine API-key management',async()=>{
  const [account,tabs,shell,dispatch]=await Promise.all([
    read('apps/web/client/src/account.tsx'),
    read('apps/web/client/src/account-tabs.tsx'),
    read('apps/web/client/src/app-shell.ts'),
    read('apps/web/client/src/route-dispatch.ts')
  ]);
  assert.match(account,/AccountTabs/);
  assert.match(tabs,/\{administrator\?<a className=\{active==='engines'/);
  assert.match(tabs,/href="#settings\/engines">Engines/);
  assert.match(dispatch,/parts\[1\]==='engines'/);
  assert.match(shell,/case'engineManagement':return showEngineManagement\(\)/);
  assert.match(shell,/External application access/);
  assert.match(shell,/Generate new key/);
});

test('account sections and the React mount boundary have typed ownership',async()=>{
  const [account,types,shell]=await Promise.all([
    read('apps/web/client/src/account.tsx'),
    read('apps/web/client/src/account-types.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(types,/export function normalizeAccountSection/);
  assert.match(types,/if\(value==='sessions'\)return'sessions'/);
  assert.match(types,/if\(value==='users'&&administrator\)return'users'/);
  assert.match(account,/normalizeAccountSection\(options\.section,options\.administrator\)/);
  assert.match(shell,/import \{normalizeAccountSection\} from '\.\/account-types'/);
  assert.match(shell,/selected=normalizeAccountSection\(section,administrator\)/);
  assert.match(shell,/host=createRouteHost\(content,'account-react'\)/);
  assert.doesNotMatch(shell,/host=document\.createElement\('div'\);host\.id='account-react'/);
});

test('engine management uses a typed React route while retaining a legacy fallback',async()=>{
  const [view,types,islands,shell,api]=await Promise.all([
    read('apps/web/client/src/engine-management.tsx'),
    read('apps/web/client/src/engine-management-types.ts'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts'),
    read('apps/api/src/app.js')
  ]);
  for(const workflow of ['External application access','Reveal','Hide','Copy','Generate new key','Repair automatic connections','Advanced: external engines','Test connection']){
    assert.match(view,new RegExp(workflow));
  }
  assert.match(view,/navigator\.clipboard\.writeText/);
  assert.match(view,/\/api\/settings\/engines\/\$\{engine\.domain\}\/api-key/);
  assert.match(view,/\/api\/settings\/engines\/repair/);
  assert.match(view,/\/api\/settings\/engines\/\$\{domain\}\/test/);
  assert.match(view,/method:'PUT'/);
  assert.match(types,/interface EngineManagementMountOptions/);
  assert.match(islands,/mountEngineManagement/);
  assert.match(islands,/import\('\.\/engine-management'\)/);
  assert.match(shell,/showEngineManagementLegacy/);
  assert.match(shell,/mountEngineManagement/);
  assert.match(api,/client\.post\('command',\{name:'ResetApiKey'\}\)/);
  assert.match(api,/did not reconnect with the new API key/);
});

test('Discover credential settings use a typed React route with a safe legacy fallback',async()=>{
  const [view,types,islands,shell,api]=await Promise.all([
    read('apps/web/client/src/discover-settings.tsx'),
    read('apps/web/client/src/discover-settings-types.ts'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts'),
    read('apps/api/src/app.js')
  ]);
  for(const workflow of ['TMDB metadata','Test token','Save token','Remove token','Container configuration is optional']){
    assert.match(view,new RegExp(workflow));
  }
  assert.match(view,/type="password"/);
  assert.match(view,/autoComplete="new-password"/);
  assert.match(view,/\/api\/settings\/discover\/test/);
  assert.match(view,/method:'POST'/);
  assert.match(view,/method:'DELETE'/);
  assert.doesNotMatch(types,/token:/);
  assert.match(types,/interface DiscoverSettingsMountOptions/);
  assert.match(islands,/mountDiscoverSettings/);
  assert.match(islands,/import\('\.\/discover-settings'\)/);
  assert.match(shell,/showDiscoverSettingsLegacy/);
  assert.match(shell,/mountDiscoverSettings/);
  assert.match(api,/saveDiscoveryCredential\(input\.token\)/);
  assert.match(api,/removeDiscoveryCredential\(\)/);
});

test('quality profiles use a typed React route with engine-native editing parity',async()=>{
  const [view,types,islands,shell]=await Promise.all([
    read('apps/web/client/src/quality-profiles.tsx'),
    read('apps/web/client/src/quality-profiles-types.ts'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  for(const workflow of ['New profile','Browse TRaSH templates','Upgrade until the cutoff is met','Allowed qualities','Custom format scores','Quality size limits','Save limits to engine']){
    assert.match(view,new RegExp(workflow));
  }
  for(const endpoint of ['profiles','profileSchema','customFormats','qualityDefinitions','qualityDefinitionLimits'])assert.match(view,new RegExp(endpoint));
  for(const method of ["'POST'","'PUT'","'DELETE'"])assert.match(view,new RegExp(method));
  assert.match(types,/interface QualityProfilesMountOptions/);
  assert.match(islands,/mountQualityProfiles/);
  assert.match(islands,/import\('\.\/quality-profiles'\)/);
  assert.match(shell,/showProfilesLegacy/);
  assert.match(shell,/mountQualityProfiles/);
});

test('first-run engine setup uses the shared typed React connection workflow',async()=>{
  const [setup,types,management,islands,shell]=await Promise.all([
    read('apps/web/client/src/engine-setup.tsx'),
    read('apps/web/client/src/engine-setup-types.ts'),
    read('apps/web/client/src/engine-management.tsx'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  for(const workflow of ['Connect your engines','Skip for now and use review data','Both engines are required'])assert.match(setup,new RegExp(workflow));
  assert.match(setup,/ExternalEngineForm domain="movie"/);
  assert.match(setup,/ExternalEngineForm domain="tv"/);
  assert.match(management,/export function ExternalEngineForm/);
  for(const workflow of ['Test connection','Connection validated','Save \\$\\{display\\(domain\\)\\}','initial\\.configured'])assert.match(management,new RegExp(workflow));
  assert.match(types,/interface EngineSetupMountOptions/);
  assert.match(islands,/mountEngineSetup/);
  assert.match(islands,/import\('\.\/engine-setup'\)/);
  assert.match(shell,/showEngineSetupLegacy/);
  assert.match(shell,/mountEngineSetup/);
});

test('administrator setup and sign-in use a typed React authentication shell',async()=>{
  const [view,types,islands,shell]=await Promise.all([
    read('apps/web/client/src/authentication.tsx'),
    read('apps/web/client/src/authentication-types.ts'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  for(const workflow of ['Create Administrator','Create administrator and continue','Sign in','Remember me','Forgot password?','Passwords do not match'])assert.match(view,new RegExp(workflow));
  assert.match(view,/\/api\/auth\/setup/);
  assert.match(view,/\/api\/auth\/login/);
  assert.match(view,/autoComplete="new-password"/);
  assert.match(view,/autoComplete="current-password"/);
  assert.match(types,/interface AuthenticationMountOptions/);
  assert.match(islands,/mountAuthentication/);
  assert.match(islands,/import\('\.\/authentication'\)/);
  assert.match(shell,/wireLegacyAuthentication/);
  assert.match(shell,/mountAuthentication/);
  assert.match(shell,/authenticationComplete/);
});

test('hash navigation uses a typed route table without removing legacy route handlers',async()=>{
  const [routing,dispatch,shell]=await Promise.all([
    read('apps/web/client/src/routing.ts'),
    read('apps/web/client/src/route-dispatch.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  for(const route of ['dashboard','discover','movies','tv','collections','add','wanted','movie','series','queue','history','calendar','health','service','management','settings','system','engine-setup']){
    assert.match(routing,new RegExp(`'${route}'`));
  }
  assert.match(routing,/export function parseRoute/);
  assert.match(routing,/knownRouteKeys\.has\(requestedKey\)\?requestedKey:'dashboard'/);
  assert.match(routing,/export function preservesMountedLibrary/);
  assert.match(shell,/import \{parseRoute,preservesMountedLibrary\} from '\.\/routing'/);
  assert.match(shell,/const currentRoute=parseRoute\(location\.hash\)/);
  assert.match(dispatch,/if\(key==='service'\)return\{name:'serviceSettings'/);
  assert.match(dispatch,/parts\[1\]==='engines'/);
  assert.match(shell,/case'serviceSettings':return showServiceSettings\(action\.section,action\.templateFilter\)/);
  assert.match(shell,/case'account':return showAccountReact\(action\.section\)/);
});

test('route dispatch resolves typed React destinations without changing page handlers',async()=>{
  const [dispatch,shell]=await Promise.all([
    read('apps/web/client/src/route-dispatch.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(dispatch,/export type RouteAction=/);
  assert.match(dispatch,/export function resolveRouteAction/);
  for(const action of ['engineSetup','discover','library','collections','addMedia','wanted','movieDetail','tvDetail','queue','history','calendar','health','serviceSettings','management','engineManagement','account','system','dashboard']){
    assert.match(dispatch,new RegExp(`name:'${action}'`));
  }
  assert.match(dispatch,/state\.preserveLibrary&&!state\.libraryStale\[key\]/);
  assert.match(dispatch,/parts\[1\]==='engines'/);
  assert.match(shell,/import \{resolveRouteAction\} from '\.\/route-dispatch'/);
  assert.match(shell,/const action=resolveRouteAction\(currentRoute/);
  assert.match(shell,/switch\(action\.name\)/);
  assert.match(shell,/case'library':return showMedia\(action\.kind\)/);
  assert.match(shell,/case'serviceSettings':return showServiceSettings\(action\.section,action\.templateFilter\)/);
  assert.doesNotMatch(shell,/if\(key==='collections'\)return showCollectionsReact/);
});

test('navigation events and route preloading have typed lifecycle ownership',async()=>{
  const [lifecycle,shell]=await Promise.all([
    read('apps/web/client/src/navigation-lifecycle.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(lifecycle,/export function wireNavigationLifecycle/);
  assert.doesNotMatch(lifecycle,/vynodearr:discover-details/);
  assert.match(lifecycle,/addEventListener\('hashchange'/);
  assert.match(lifecycle,/unmountDiscover/);
  assert.match(lifecycle,/export function shouldResetRouteScroll/);
  assert.match(lifecycle,/previous\.key==='movie'&&next\.key==='movies'/);
  assert.match(lifecycle,/previous\.key==='series'&&next\.key==='tv'/);
  assert.match(lifecycle,/scrollTo\(\{top:0,left:0,behavior:'instant'\}\)/);
  assert.match(lifecycle,/querySelectorAll<HTMLAnchorElement>\('a\[href\^="#"\]'\)/);
  assert.match(lifecycle,/parseRoute\(link\.hash\)\.key/);
  assert.match(lifecycle,/requestIdleCallback/);
  assert.match(lifecycle,/preloadRoute\?\.\('dashboard'\)/);
  assert.match(lifecycle,/preloadRoute\?\.\('discover'\)/);
  assert.match(shell,/import \{wireNavigationLifecycle\} from '\.\/navigation-lifecycle'/);
  assert.match(shell,/wireNavigationLifecycle\(\{window,document,bridge:\(\)=>window\.VynodeArrReact,route\}\)/);
  assert.doesNotMatch(shell,/addEventListener\('hashchange'/);
  assert.doesNotMatch(shell,/querySelectorAll\('a\[href\^="#"\]'\)\.forEach/);
});

test('dashboard loading, caching, and refresh ownership live in typed React',async()=>{
  const [dashboard,types,islands,shell]=await Promise.all([
    read('apps/web/client/src/dashboard.tsx'),
    read('apps/web/client/src/dashboard-types.ts'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(dashboard,/export function DashboardRoute/);
  assert.match(dashboard,/options\.request<DashboardData>\('\/api\/dashboard'\)/);
  assert.match(dashboard,/sessionStorage\.setItem\(dashboardSnapshotKey/);
  assert.match(dashboard,/useVisibleRefresh\(load,15_000\)/);
  assert.match(types,/interface DashboardMountOptions/);
  assert.match(islands,/DashboardRoute options=\{options\}/);
  assert.doesNotMatch(islands,/fetch\('\/api\/dashboard'/);
  assert.match(shell,/mountDashboard\(dashboardHost,\{request:api\}\)/);
  assert.match(shell,/content\.innerHTML='<div class="hero"/);
});

test('movie and television initial loading is owned by typed React without losing shell synchronization',async()=>{
  const [library,types,shell]=await Promise.all([
    read('apps/web/client/src/library.tsx'),
    read('apps/web/client/src/library-types.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(library,/Loading \{movie\s*\?\s*["']movies["']\s*:\s*["']television["']\}/);
  assert.match(library,/options\.onLoaded\?\.\(value\.items\s*,\s*value\.mode\)/);
  assert.match(library,/Library refresh delayed/);
  assert.match(types,/onLoaded\?:\s*\(items:\s*LibraryItem\[\]\s*,\s*mode\?:\s*string\)/);
  assert.match(shell,/mountLibrary\(host,\{kind,administrator:state\.user\?\.role==='administrator',items:state\[kind\]/);
  assert.match(shell,/onLoaded:\(items,mode\)=>\{state\[kind\]=items/);
  assert.match(shell,/if\(window\.VynodeArrReact\?\.mountLibrary\).*return;/);
  assert.match(shell,/try\{const value=await api\(movie\?'\/api\/media\/movies':'\/api\/media\/tv'\)/);
});

test('history initial loading and refresh recovery are owned by typed React',async()=>{
  const [history,types,shell]=await Promise.all([
    read('apps/web/client/src/history.tsx'),
    read('apps/web/client/src/history-types.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(history,/useEffect/);
  assert.match(history,/if \(!options\.items\) void refresh\(false\)/);
  assert.match(history,/Loading history/);
  assert.match(history,/History refresh delayed/);
  assert.match(history,/options\.administrator && item\.mediaId && event\.organizable/);
  assert.match(types,/items\?:HistoryItem\[\]/);
  assert.match(shell,/mountHistory\(host,\{administrator:state\.user\.role==='administrator',request:api,notify\}\)/);
  assert.match(shell,/return showOperational\('History','\/api\/activity\/history'\)/);
});

test('route teardown and navigation activation use a typed lifecycle helper',async()=>{
  const [lifecycle,shell]=await Promise.all([
    read('apps/web/client/src/route-lifecycle.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  for(const method of ['unmountDashboard','unmountLibrary','unmountDiscover','unmountGuideTemplates','unmountEngineManagement','unmountQualityProfiles']){
    assert.match(lifecycle,new RegExp(method));
  }
  assert.match(lifecycle,/if\(!options\.preserveLibrary\)bridge\?\.unmountLibrary/);
  assert.match(lifecycle,/vynode-detail-modal-host/);
  assert.match(lifecycle,/link\.classList\.toggle/);
  assert.match(lifecycle,/body\.classList\.remove\('nav-open'\)/);
  assert.match(shell,/import \{teardownRoute,updateNavigation\} from '\.\/route-lifecycle'/);
  assert.match(shell,/teardownRoute\(window\.VynodeArrReact,\{preserveLibrary,document\}\)/);
  assert.match(shell,/updateNavigation\(nav,key,document\.body\)/);
});

test('React pages and detail modals use a typed route host boundary',async()=>{
  const [host,shell]=await Promise.all([
    read('apps/web/client/src/route-host.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(host,/export function createRouteHost/);
  assert.match(host,/container\.replaceChildren\(host\)/);
  assert.match(host,/export function createModalRouteHost/);
  assert.match(host,/document\.body\.append\(host\)/);
  assert.match(shell,/import \{createModalRouteHost,createRouteHost\} from '\.\/route-host'/);
  assert.match(shell,/createRouteHost\(content,`\$\{kind\}-react`\)/);
  for(const id of ['history-react','queue-react','wanted-react','guide-templates-react']){
    assert.match(shell,new RegExp(`createRouteHost\\(content,'${id}'\\)`));
  }
  assert.match(shell,/createModalRouteHost\('movie-detail-react','vynode-detail-modal-host'\)/);
  assert.match(shell,/createModalRouteHost\('tv-detail-react','vynode-detail-modal-host'\)/);
  assert.doesNotMatch(shell,/const host=document\.createElement\('div'\);host\.id=.*-react/);
});

test('release profile editor uses a bounded glass modal layout',async()=>{
  const [view,styles]=await Promise.all([
    read('apps/web/client/src/selection-rules.tsx'),
    read('apps/web/client/src/react-selection-rules.css')
  ]);
  assert.match(styles,/\.release-profile-card\{top:50%;width:min\(calc\(100vw - 2rem\),66rem\)/);
  assert.match(styles,/transform:translate\(-50%,-50%\)/);
  assert.match(styles,/backdrop-filter:blur\(24px\)/);
  assert.match(styles,/\.release-profile-card>\.editor-heading\{top:0/);
  assert.match(styles,/\.release-profile-card>\.editor-actions\{bottom:0/);
  assert.match(view,/profile\.id\?<button className="danger-secondary"/);
  assert.match(view,/editor-action-spacer/);
});

test('new release profiles remain drafts until explicitly saved',async()=>{
  const view=await read('apps/web/client/src/selection-rules.tsx');
  assert.match(view,/method:isNew\?'POST':'PUT'/);
  assert.match(view,/const closeRelease=\(profile:ReleaseProfile,index:number\)=>\{if\(!profile\.id\)setReleases/);
  assert.match(view,/onClick=\{\(\)=>closeRelease\(profile,index\)\}/);
  assert.match(view,/releases\.some\(profile=>profile\.id\)/);
  assert.match(view,/profile\.id\?<article className="rule-summary-card"/);
});

test('movie and television detailed-list cards use bounded named layout areas',async()=>{
  const styles=await read('apps/web/public/ui-foundation.css');
  assert.match(styles,/library-results-grid \.react-library-card\s*\{[^}]*background:\s*var\(--ui-surface\) !important/);
  assert.match(styles,/library-results-grid \.react-library-card \.card-body\s*\{[^}]*background:\s*transparent !important/);
  assert.match(styles,/library-results-grid \.react-library-card-actions \.secondary\s*\{[^}]*display:\s*inline-flex;[^}]*min-height:\s*2rem/);
  assert.match(styles,/library-results-grid\.view-compact \.react-library-card\s*\{[^}]*min-height:\s*11\.5rem/);
  assert.match(styles,/library-results-grid\.view-list \.react-library-card\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*9rem/);
  assert.match(styles,/grid-template-areas:\s*"heading details actions"\s*"progress details actions"\s*"state details actions"/);
  for(const area of ['heading','progress','state','details','actions']){
    assert.match(styles,new RegExp(`grid-area:\\s*${area}`));
  }
  assert.match(styles,/@media \(max-width: 760px\)[\s\S]*library-results-grid\.view-list/);
});

test('new custom formats remain drafts until explicitly saved',async()=>{
  const view=await read('apps/web/client/src/selection-rules.tsx');
  assert.match(view,/const closeFormat=\(format:CustomFormat,index:number\)=>\{if\(!format\.id\)setFormats/);
  assert.match(view,/onClick=\{\(\)=>closeFormat\(format,formatIndex\)\}/);
  assert.match(view,/\{format\.id\?<button type="button" className="danger-secondary"/);
});

test('legacy shell state and shared helpers have typed ownership',async()=>{
  const [state,utils,shell]=await Promise.all([
    read('apps/web/client/src/app-state.ts'),
    read('apps/web/client/src/shell-utils.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(state,/export function savedLibraryView/);
  assert.match(state,/export function createAppState/);
  assert.match(state,/libraryStale:\{movies:false,tv:false\}/);
  for(const helper of ['esc','pct','when','badge','formValue','mediaPath','formatBytes','releaseEligible']){
    assert.match(utils,new RegExp(`export function ${helper}`));
  }
  assert.match(shell,/import \{createAppState\} from '\.\/app-state'/);
  assert.match(shell,/from '\.\/shell-utils'/);
  assert.match(shell,/state=createAppState\(\)/);
  assert.doesNotMatch(shell,/savedLibraryView=kind=>/);
  assert.doesNotMatch(shell,/const esc=\(value\)=>/);
});

test('session bootstrap and authenticated shell activation have typed ownership',async()=>{
  const [lifecycle,shell]=await Promise.all([
    read('apps/web/client/src/session-lifecycle.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(lifecycle,/export async function bootstrapSession/);
  assert.match(lifecycle,/request<AuthenticationStatus>\('\/api\/auth\/status'\)/);
  assert.match(lifecycle,/setupView\.hidden=!status\.setupRequired/);
  assert.match(lifecycle,/if\(!status\.enginesConfigured&&location\.hash!=='#engine-setup'\)/);
  assert.match(lifecycle,/export function completeAuthentication/);
  assert.match(lifecycle,/location\.hash=options\.setup\?'#engine-setup'/);
  assert.match(shell,/import \{bootstrapSession,completeAuthentication\} from '\.\/session-lifecycle'/);
  assert.match(shell,/await bootstrapSession\(\{state,request:api,setupView,authView,shell,applyUser,startImportMonitor,route\}\)/);
  assert.match(shell,/completeAuthentication\(\{state,result,setup,setupView,authView,shell,applyUser,landingHash:firstPermittedHash\}\)/);
  assert.doesNotMatch(shell,/const status=await api\('\/api\/auth\/status'\)/);
});

test('global shell controls and presentation have typed ownership',async()=>{
  const [controller,shell]=await Promise.all([
    read('apps/web/client/src/shell-controller.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(controller,/export function createNotifier/);
  assert.match(controller,/\/abort\/i/);
  assert.match(controller,/tone==='error'\?6500:3500/);
  assert.match(controller,/export function applyUserPresentation/);
  for(const element of ['accountName','accountRole','avatar','documentElement']){
    assert.match(controller,new RegExp(`elements\\.${element}`));
  }
  assert.match(controller,/dataset\.uiStyle=user\.uiStyle\|\|'glass'/);
  assert.match(controller,/dataset\.uiDensity=user\.uiDensity\|\|'comfortable'/);
  assert.match(controller,/dataset\.motion=user\.motionPreference\|\|'system'/);
  assert.match(controller,/export function wireShellControls/);
  assert.match(controller,/request\('\/api\/auth\/logout'/);
  assert.match(controller,/classList\.toggle\('nav-open'\)/);
  assert.match(controller,/location\.hash\.slice\(1\)/);
  assert.match(controller,/addEventListener\('beforeunload'/);
  assert.match(shell,/from '\.\/shell-controller'/);
  assert.match(shell,/const notify=createNotifier\(toast\)/);
  assert.match(shell,/applyUserPresentation\(state,user/);
  assert.match(shell,/wireShellControls\(\{state/);
  assert.doesNotMatch(shell,/function notify\(/);
  assert.doesNotMatch(shell,/document\.querySelector\('#logout'\)\.addEventListener/);
  assert.doesNotMatch(shell,/addEventListener\('beforeunload'/);
});

test('Guide Templates route filters have typed domain and resource ownership',async()=>{
  const [routing,shell]=await Promise.all([
    read('apps/web/client/src/guide-template-routing.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  for(const resource of ['customFormat','customFormatGroup','qualityProfile','qualitySize','naming']){
    assert.match(routing,new RegExp(`'${resource}'`));
  }
  assert.match(routing,/export function parseGuideTemplateRouteFilter/);
  assert.match(routing,/requestedDomain==='tv'\?'tv':'movie'/);
  assert.match(routing,/item is ResourceType=>resourceTypeSet\.has\(item\)/);
  assert.match(shell,/import \{parseGuideTemplateRouteFilter\} from '\.\/guide-template-routing'/);
  assert.match(shell,/parseGuideTemplateRouteFilter\(templateFilter\)/);
  assert.doesNotMatch(shell,/templateFilter\.split\(':'\)/);
  assert.doesNotMatch(shell,/const allowed=\['customFormat'/);
});

test('Service Settings page selection has typed ownership',async()=>{
  const [routing,shell]=await Promise.all([
    read('apps/web/client/src/service-settings-routing.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(routing,/export type ServiceSettingsAction=/);
  for(const action of ['discover','mediaManagement','qualityProfiles','guideTemplates','selectionRules','providerSettings','rootFolders']){
    assert.match(routing,new RegExp(`name:'${action}'`));
  }
  assert.match(routing,/section==='custom-formats'\|\|section==='release-profiles'/);
  assert.match(routing,/kind:'downloadClients'/);
  assert.match(shell,/import \{resolveServiceSettingsAction\} from '\.\/service-settings-routing'/);
  assert.match(shell,/const action=resolveServiceSettingsAction\(section,templateFilter\)/);
  assert.match(shell,/case'guideTemplates':return showGuideTemplatesReact\(action\.templateFilter\)/);
  assert.match(shell,/case'selectionRules':return showSelectionRulesReact\(action\.section\)/);
  assert.match(shell,/case'providerSettings':return showProviderSettingsReact\(action\.kind\)/);
  assert.doesNotMatch(shell,/if\(section==='discover'\)return showDiscoverSettings/);
});

test('legacy library filtering and sorting have typed ownership',async()=>{
  const [filtering,shell]=await Promise.all([
    read('apps/web/client/src/legacy-library-filtering.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  assert.match(filtering,/export function titleInitial/);
  assert.match(filtering,/export function filterLibraryItems/);
  assert.match(filtering,/options\.mode==='missing'/);
  assert.match(filtering,/filters\.genre/);
  assert.match(filtering,/filters\.network/);
  assert.match(filtering,/options\.sort==='attention'/);
  assert.match(shell,/import \{filterLibraryItems,titleInitial\} from '\.\/legacy-library-filtering'/);
  assert.match(shell,/function filtered\(kind\)\{return filterLibraryItems\(/);
  assert.doesNotMatch(shell,/const titleInitial=item=>/);
  assert.doesNotMatch(shell,/function filtered\(kind\)\{const movie=/);
});

test('application layout reserves a stable scrollbar gutter',async()=>{
  const styles=await read('apps/web/public/styles.css');
  assert.match(styles,/html\{scrollbar-gutter:stable\}/);
});

test('all modal surfaces preserve their originating page position',async()=>{
  const [restoration,shell]=await Promise.all([
    read('apps/web/client/src/modal-scroll-restoration.ts'),
    read('apps/web/client/src/app-shell.ts')
  ]);
  for(const selector of ['dialog\\[open\\]','role="dialog"','react-dialog-backdrop','release-profile-card']){
    assert.match(restoration,new RegExp(selector));
  }
  assert.match(restoration,/prototype\.showModal/);
  assert.match(restoration,/new runtime\.MutationObserver/);
  assert.match(restoration,/position\.hash !== win\.location\.hash/);
  assert.match(restoration,/win\.scrollTo\(/);
  assert.match(shell,/import\('\.\/modal-scroll-restoration'\)/);
  assert.match(shell,/\(\{installModalScrollRestoration\}\)=>installModalScrollRestoration\(window,document\)/);
});

test('presentation style remains separate from color theme',async()=>{
  const [html,foundation,account,auth]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/ui-foundation.css'),
    read('apps/web/client/src/account.tsx'),
    read('packages/platform/src/auth-service.js')
  ]);
  assert.match(html,/<html lang="en" data-ui-style="glass" data-ui-density="comfortable" data-motion="system">/);
  assert.match(html,/ui-foundation\.css\?v=/);
  assert.match(foundation,/\[data-ui-style="solid"\]/);
  assert.match(foundation,/\[data-ui-style="oled"\]/);
  assert.match(foundation,/\[data-ui-style="high-contrast"\]/);
  assert.match(foundation,/--ui-page-background:/);
  assert.match(foundation,/--ui-shell-surface:/);
  assert.match(foundation,/--ui-scroll-thumb:/);
  assert.match(foundation,/\*::\-webkit-scrollbar-thumb/);
  assert.match(foundation,/backdrop-filter: none !important/);
  assert.match(foundation,/\.template-review-footer/);
  assert.match(foundation,/\.custom-format-editor > \.editor-actions/);
  assert.match(foundation,/dialog\[open\][\s\S]*position: fixed !important/);
  assert.match(foundation,/max-height: calc\(100dvh - 2rem\)/);
  assert.match(foundation,/:focus-visible/);
  assert.match(foundation,/@media \(forced-colors: active\)/);
  assert.match(account,/name="uiStyle"/);
  assert.match(account,/name="uiDensity"/);
  assert.match(account,/name="motionPreference"/);
  assert.match(account,/\['glass','Glass'\]/);
  assert.match(auth,/const uiStyles=new Set\(\['glass','solid','oled','high-contrast'\]\)/);
  assert.match(auth,/const uiDensities=new Set\(\['comfortable','compact'\]\)/);
  assert.match(auth,/const motionPreferences=new Set\(\['system','reduced','full'\]\)/);
  assert.match(foundation,/\[data-ui-density="compact"\]/);
  assert.match(foundation,/\[data-motion="reduced"\]/);
});

test('poster overlays preserve existing library card sizing',async()=>{
  const library=await read('apps/web/client/src/library.tsx');
  const styles=await read('apps/web/client/src/react-library.css');
  assert.match(library,/card react-library-card \$\{view\}/);
  assert.match(library,/<a className="poster" href=\{href\}>[\s\S]*?<PosterAssignmentLayers item=\{item\} \/>[\s\S]*?<\/a>/);
  assert.doesNotMatch(library,/view (?:===|!==) "poster" \? <PosterAssignmentLayers/);
  assert.match(styles,/\.react-library-card>\.poster\{container-type:inline-size\}/);
  assert.doesNotMatch(styles,/\.react-library-card\{[^}]*container-type/);
});

test('poster overlay style cards stay compact on phones',async()=>{
  const source=await read('apps/web/client/src/poster-overlays.tsx');
  assert.match(source,/overlay-template-panel \.panel-heading \.badge\{align-self:flex-start\}/);
  assert.match(source,/\.overlay-template-card\{grid-template-columns:64px minmax\(0,1fr\);align-items:center/);
  assert.match(source,/\.overlay-template-content \.form-actions\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);position:static/);
  assert.match(source,/backdrop-filter:none/);
});

test('poster overlay creation stays available beside the style list',async()=>{
  const source=await read('apps/web/client/src/poster-overlays.tsx');
  assert.match(source,/className="overlay-new-action"/);
  assert.match(source,/Create new style/);
  assert.match(source,/\.overlay-new-action\{display:grid;grid-template-columns:auto 1fr;width:100%\}/);
});

test('poster overlay editor layers retain drag and resize pointer input',async()=>{
  const source=await read('apps/web/client/src/poster-overlays.tsx');
  const preview=await read('apps/web/client/src/poster-overlay-library-preview.tsx');
  assert.match(preview,/\.overlay-preview \.poster-overlay-layer\{pointer-events:auto!important\}/);
  assert.match(source,/onPointerMove=/);assert.match(source,/overlay-resize-handle/);
});

test('poster overlay editor provides bounded layer fields and a shape library',async()=>{
  const rail=await read('apps/web/client/src/poster-overlay-editor-rail.tsx');
  for(const shape of ['rounded','square','pill','circle','ticket','ribbon','tag','hexagon','chevron'])assert.ok(rail.includes(shape),shape);
  assert.match(rail,/overlay-layer-body input/);assert.match(rail,/min-width:0/);
  assert.match(rail,/overlay-preview-column>label select\{box-sizing:border-box;width:100%;min-width:0\}/);
});

test('poster overlay editor uses three settings columns and an always-visible preview',async()=>{
  const conditions=await read('apps/web/client/src/poster-overlay-conditions.tsx'),layout=await read('apps/web/client/src/poster-overlay-editor-layout.tsx'),editor=await read('apps/web/client/src/poster-overlays.tsx');
  assert.match(conditions,/overlay-condition-row\{grid-column:1\/-1;grid-row:2;width:100%/);
  assert.match(conditions,/overlay-condition-rule\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(conditions,/@media\(max-width:1000px\)\{\.overlay-condition-rule/);
  assert.match(conditions,/@media\(max-width:980px\)\{\.overlay-condition-row\{grid-row:auto\}/);
  assert.match(layout,/width: min\(1760px, calc\(100vw - 24px\)\)/);
  assert.match(layout,/grid-template-columns: minmax\(230px, 250px\) minmax\(370px, 1fr\) minmax\(400px, 1\.08fr\) minmax\(340px, 380px\)/);
  assert.match(layout,/grid-template-areas: "rail fields conditions preview"/);
  assert.match(layout,/overlay-preview-column \{\s*grid-area: preview;\s*align-self: start;\s*position: sticky/);
  assert.match(layout,/@media \(max-width: 1499px\)[\s\S]*"rail fields preview"[\s\S]*"conditions conditions preview"/);
  assert.match(layout,/@media \(min-width: 1500px\)[\s\S]*height: 100%;[\s\S]*max-height: 100%/);
  assert.match(layout,/max-height: 100% !important;[\s\S]*overflow-y: auto !important/);
  assert.match(layout,/scrollbar-gutter: stable/);
  assert.match(layout,/touch-action: pan-y/);
  assert.match(layout,/padding-bottom: 48px/);
  assert.match(layout,/scrollbar-width: auto/);
  assert.match(layout,/overlay-editor-fields > \.overlay-layer-editor \{\s*align-self: start;\s*height: max-content;\s*min-height: max-content/);
  assert.match(layout,/@media \(min-width: 981px\)[\s\S]*height: calc\(100dvh - 40px\);[\s\S]*grid-template-rows: auto minmax\(0, 1fr\) auto/);
  assert.match(layout,/overlay-layer-body > \.notice \{\s*grid-column: 1 \/ -1;\s*display: grid/);
  assert.match(layout,/overlay-style-variants > header \{\s*position: static;\s*display: grid;\s*height: auto/);
  for(const control of ['Position','Prefix','Suffix','Text color','Badge color','Horizontal position','Vertical position','Layer width','Adaptive poster contrast','Font size','Font weight','Text alignment','Capitalization','Text opacity','Shape opacity','Inner spacing','Corner radius','Remove layer'])assert.ok(editor.includes(control),control);
});

test('poster overlay sub-conditions are ranked and expose inherited appearance overrides',async()=>{
  const source=await read('apps/web/client/src/poster-overlay-conditions.tsx'),editor=await read('apps/web/client/src/poster-overlays.tsx'),types=await read('apps/web/client/src/poster-overlays-types.ts'),service=await read('packages/platform/src/poster-overlay-service.js');
  assert.match(source,/Main condition — show this layer/);
  assert.match(source,/Rank 1 has highest priority/);
  assert.match(source,/Move up/);assert.match(source,/Move down/);
  assert.match(source,/Formatting for this sub-condition/);assert.match(source,/Copy all default formatting/);
  assert.match(source,/overrides:defaultFormatting\(\)/);
  assert.match(source,/overlay-color-control/);assert.match(source,/hex value/);
  assert.match(source,/setOverride\(style\.id,key,value\)/);
  assert.match(source,/rule\.id===id/);
  assert.doesNotMatch(source,/setOverride\(index,key,value\)/);
  assert.match(editor,/setEditing\(current=>current\?/);
  assert.match(editor,/typeof changes==="function"\?changes\(layer\):changes/);
  for(const label of ['Shape / background color','Text color','Font size','Font weight','Text alignment','Capitalization','Shape opacity','Inner spacing','Corner radius','Adaptive contrast'])assert.match(source,new RegExp(label.replace(/[\/]/g,'\\$&')));
  assert.match(types,/rank: number/);assert.match(service,/sort\(\(a,b\)=>a\.rank-b\.rank\)/);
});

test('icon and shape editors keep artwork separate from optional variables',async()=>{
  const identity=await read('apps/web/client/src/poster-overlay-layer-identity.tsx');
  assert.match(identity,/Icon artwork/);assert.match(identity,/Optional variable/);assert.match(identity,/Variable placement/);assert.match(identity,/Shape with optional metadata/);
  for(const group of ['Identity','Media file','Library','Dates','Download','Television','Requests'])assert.ok(identity.includes(group),group);
  assert.match(identity,/<optgroup label=\{group\}/);
});

test('new poster style opens as a non-submit dialog action',async()=>{
  const source=await read('apps/web/client/src/poster-overlays.tsx');
  const layer=await read('apps/web/client/src/poster-overlay-layer.tsx');
  assert.match(source,/type="button" className="primary" onClick=\{\(\) => setEditing\(blankTemplate\(\)\)\}/);
  assert.match(source,/overlayClientId\(\)/);
  assert.match(layer,/crypto\.randomUUID\?\.\(\)/);
  assert.match(layer,/crypto\.getRandomValues/);
  assert.doesNotMatch(layer,/crypto\.randomUUID\(\)/);
});

test('My Requests owns request tracking, correction, cancellation, and permission-aware routing',async()=>{
  const [view,types,islands,routing,dispatch,access,shell,server,html,styles,discoverRequest]=await Promise.all([
    read('apps/web/client/src/my-requests.tsx'),
    read('apps/web/client/src/my-requests-types.ts'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/routing.ts'),
    read('apps/web/client/src/route-dispatch.ts'),
    read('apps/web/client/src/user-access.ts'),
    read('apps/web/client/src/app-shell.ts'),
    read('apps/api/src/app.js'),
    read('apps/web/public/index.html'),
    read('apps/web/public/my-requests.css'),
    read('apps/web/client/src/discover-request.tsx')
  ]);
  assert.match(html,/href="#requests">My Requests/);
  assert.match(routing,/'requests'/);
  assert.match(dispatch,/if\(key==='requests'\)return\{name:'requests'\}/);
  assert.match(access,/requests:'discover'/);
  assert.match(shell,/case'requests':return showRequestsReact/);
  assert.match(islands,/mountRequests/);
  assert.match(types,/requested.*searching.*downloading.*imported.*failed.*rejected.*canceled/);
  assert.match(view,/\/api\/requests\/mine/);
  assert.match(view,/Correct match/);
  assert.match(view,/Cancel request/);
  assert.match(server,/user-requests\.json/);
  assert.match(server,/liveUserRequests/);
  assert.match(server,/request_not_cancellable/);
  assert.match(server,/status:'canceled'.*Cancelled by user/);
  assert.match(discoverRequest,/setError\(message\)/);
  assert.match(server,/request_not_correctable/);
  assert.match(server,/friendlyRequestFailure/);
  assert.match(styles,/\.my-request-card/);
  assert.match(styles,/\.my-request-match-dialog/);
});

test('Discover approval policy and administrator request history have typed poster-rich interfaces',async()=>{
  const [account,accountTypes,adminRequests,types,islands,routing,dispatch,shell,server,auth,html,styles]=await Promise.all([
    read('apps/web/client/src/account.tsx'),read('apps/web/client/src/account-types.ts'),read('apps/web/client/src/request-management.tsx'),
    read('apps/web/client/src/my-requests-types.ts'),read('apps/web/client/src/react-islands.tsx'),read('apps/web/client/src/routing.ts'),
    read('apps/web/client/src/route-dispatch.ts'),read('apps/web/client/src/app-shell.ts'),read('apps/api/src/app.js'),
    read('packages/platform/src/auth-service.js'),read('apps/web/public/index.html'),read('apps/web/public/my-requests.css')
  ]);
  assert.match(account,/Require administrator approval/);assert.match(accountTypes,/requestApprovalRequired/);assert.match(auth,/requestApprovalRequired/);
  assert.match(account,/Discover request limits/);assert.match(account,/Maximum pending/);assert.match(account,/requestLimitsEnabled/);assert.match(accountTypes,/requestLimits/);assert.match(auth,/normalizeRequestLimits/);
  assert.match(types,/pending_approval/);assert.match(types,/poster/);assert.match(types,/rejectionReason/);assert.match(adminRequests,/Approve & add/);assert.match(adminRequests,/\/api\/requests/);
  assert.match(adminRequests,/type="search"/);assert.match(adminRequests,/All statuses/);assert.match(adminRequests,/Movies and television/);assert.match(adminRequests,/Decline request/);
  assert.match(adminRequests,/Mark all read/);assert.match(adminRequests,/request-mark-read/);assert.match(adminRequests,/vynodearr:notifications-changed/);assert.match(styles,/admin-request-card\.unread/);
  assert.match(adminRequests,/ModalPortal/);
  assert.match(adminRequests,/\/api\/notifications\/review-requests/);
  assert.match(styles,/\.request-decline-dialog\{[^}]*max-height:[^}]*overflow:auto/);
  assert.match(routing,/'request-management'/);assert.match(dispatch,/requestManagement/);assert.match(shell,/showRequestManagementReact/);assert.match(islands,/mountRequestManagement/);
  assert.match(server,/validatedDiscoverRequest/);assert.match(server,/request_already_decided/);assert.match(server,/approvedBy/);assert.match(server,/requestMetadata/);assert.match(server,/rejection_reason_required/);
  assert.match(server,/requestAllowance/);assert.match(server,/request_limit_reached/);assert.match(server,/request\.blocked_by_limit/);
  assert.match(html,/href="#request-management">User Requests/);assert.match(styles,/\.admin-request-card/);assert.match(styles,/\.request-art img/);
});

test('request notification bell has durable role-aware request updates',async()=>{
  const [notifications,types,islands,shell,server,html,styles]=await Promise.all([
    read('apps/web/client/src/notifications.tsx'),read('apps/web/client/src/notification-types.ts'),read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/app-shell.ts'),read('apps/api/src/app.js'),read('apps/web/public/index.html'),read('apps/web/public/notifications.css')
  ]);
  assert.match(html,/id="notification-root"/);assert.match(html,/notifications\.css/);
  assert.match(islands,/mountNotifications/);assert.match(shell,/mountNotifications/);
  assert.match(shell,/nav-count-badge/);assert.match(notifications,/onPageBadge/);
  assert.match(notifications,/\/api\/notifications/);assert.match(notifications,/Mark all read/);assert.match(notifications,/15_000/);
  assert.match(notifications,/hasActiveActivity/);assert.doesNotMatch(notifications,/\},\[activities,load\]\)/,'notification polling must not restart after every loaded activity array');
  assert.match(notifications,/Notification history/);assert.match(notifications,/Read and resolved notifications will remain here/);assert.match(notifications,/tab==='inbox'/);
  assert.match(notifications,/aria-label="Notifications and activity"/);
  assert.match(notifications,/Open Action Center/);
  assert.match(notifications,/notification-operations-link/);
  assert.match(notifications,/notification-mark-read/);assert.match(notifications,/Mark read/);assert.match(notifications,/vynodearr:notifications-changed/);
  assert.match(notifications,/Close notification center/);assert.match(styles,/notification-panel-close/);
  assert.match(types,/approval.*approved.*rejected.*failed.*imported/);
  assert.match(server,/notificationReads/);assert.match(server,/\/api\/notifications\/read/);assert.match(server,/href:'#request-management'/);assert.match(server,/href:'#requests'/);
  assert.match(server,/notification-events\.json/);assert.match(server,/notificationStore\.update/);assert.match(server,/recipientUserId/);
  for(const value of ['synchronizeOperationalNotifications','operationalInitializedAt','queue-problem','engine-health','search-no-result',"client.get('queue'","client.get('history'","sync.operations('health')"])assert.ok(server.includes(value),value);
  for(const value of ['operationalGrabDeliveryInitializedAt','suppressExternalIds','deliverable=added.filter','recordEngineSearchActivities'])assert.ok(server.includes(value),value);
  for(const value of ['/api/notifications/preferences','notificationPreferenceDefaults','minimumSeverity','quietHours','/api/notifications/test','notification_preferences.updated'])assert.ok(server.includes(value),value);
  for(const value of ['Notification preferences','In-app notifications','Minimum severity','Quiet hours','Send test','Set admin defaults'])assert.ok(notifications.includes(value),value);
  for(const value of ['/api/notifications/channels','discord','telegram','gotify','pushover','api.pushover.net/1/messages.json','encryptPushoverField','sendExternalNotification','recordExternalDelivery','notification_channel.saved'])assert.ok(server.includes(value),value);
  for(const value of ['External delivery','Discord webhook','Telegram','Gotify','Pushover','User or group key','Emergency','Advanced Pushover options','Encryption key','Route categories','Delivery history','Retry'])assert.ok(notifications.includes(value),value);
  for(const value of ['Customize message','TemplateBuilder','LIVE PREVIEW','Use custom JSON payload','{category}','Use this template'])assert.ok(notifications.includes(value),value);
  for(const value of ['defaultChannelTemplate','sanitizeChannelTemplate','renderNotificationJson','channelPayload','invalid_notification_json'])assert.ok(server.includes(value),value);
  assert.doesNotMatch(notifications,/Email delivery|SMTP/);
  assert.match(notifications,/createPortal/);assert.match(notifications,/panel\.current\?\.contains/);assert.match(styles,/\.notification-panel\{position:fixed;z-index:30/);
  assert.match(server,/item\.status==='pending_approval'\|\|item\.approvedBy\|\|item\.rejectedBy/);assert.match(server,/item\.category==='request'&&item\.href===requestHref&&!item\.read/);
  assert.match(server,/\/api\/notifications\/review-requests/);
  assert.match(styles,/max-height:calc\(100dvh - 6rem\)/);assert.match(styles,/overflow:auto/);assert.match(styles,/notification-bell/);assert.match(styles,/nav-count-badge/);
});

test('activity surfaces separate actionable problems from durable history without reload flicker',async()=>{
  const [operations,styles,notificationsCss]=await Promise.all([read('apps/web/client/src/operations-center.tsx'),read('apps/web/public/styles.css'),read('apps/web/public/notifications.css')]);
  assert.match(operations,/useVisibleRefresh\(\(\)=>load\(false\),30_000\)/);
  assert.match(operations,/const hydrated=useRef\(false\)/);
  assert.match(operations,/Dismiss hides an item without deleting its history/);
  assert.match(operations,/Opening an event does not rerun or change the original action/);
  assert.match(styles,/\.operations-view-help/);
  assert.match(notificationsCss,/\.notification-operations-link/);
});

test('external notification template builder is previewable and phone safe',async()=>{
  const [notifications,types,server,styles]=await Promise.all([read('apps/web/client/src/notifications.tsx'),read('apps/web/client/src/notification-types.ts'),read('apps/api/src/app.js'),read('apps/web/public/search-activity.css')]);
  assert.match(types,/interface NotificationChannelTemplate/);assert.match(types,/accentColor/);assert.match(types,/priority/);assert.match(types,/json/);
  assert.match(notifications,/template-builder-backdrop/);assert.match(notifications,/aria-modal="true"/);assert.match(notifications,/event\.key==='Escape'/);assert.match(notifications,/event\.stopPropagation/);
  assert.match(server,/renderNotificationText/);assert.match(server,/Custom notification JSON must be an object/);assert.match(server,/\.\.\.rendered\.payload,chat_id:channel\.chatId/);
  assert.match(styles,/\.template-builder-backdrop\{position:fixed;z-index:260/);assert.match(styles,/max-height:calc\(100dvh - 2rem\)/);assert.match(styles,/@media\(max-width:760px\)/);assert.match(styles,/max-height:94dvh/);assert.match(styles,/safe-area-inset-bottom/);
});

test('administrator search activity visualizes every automatic-search entry point',async()=>{
  const [notifications,types,shell,server,html,styles]=await Promise.all([
    read('apps/web/client/src/notifications.tsx'),read('apps/web/client/src/notification-types.ts'),read('apps/web/client/src/app-shell.ts'),
    read('apps/api/src/app.js'),read('apps/web/public/index.html'),read('apps/web/public/search-activity.css')
  ]);
  assert.match(html,/search-activity\.css/);assert.match(types,/interface SearchActivity/);assert.match(shell,/administrator:user\.role==='administrator'/);
  for(const value of ['/api/search-activities','searchActivityStore','createSearchActivity','reconcileSearchActivities','SeriesSearch','SeasonSearch','EpisodeSearch','MoviesSearch','searchForMissingEpisodes','searchForMovie'])assert.match(server,new RegExp(value.replaceAll('/','\\/')),value);
  for(const value of ["client.get('queue'","client.get('history'",'status:\'downloading\'','status:\'imported\'','waiting for the media engine to import','download finished and was imported'])assert.ok(server.includes(value),value);
  for(const value of ['Search activity','Queued','Searching','Grabbed','Downloading','Imported','Open Queue','Open title'])assert.match(notifications,new RegExp(value),value);
  assert.match(notifications,/5_000/);assert.match(styles,/search-stage-track/);assert.match(styles,/bottom:0/);assert.match(styles,/aspect-ratio:2\/3/);
  assert.match(notifications,/artwork\/movie\/movie_\$\{item\.movieId\}\/poster/);assert.match(notifications,/#movie\/movie_\$\{item\.movieId\}/);
});

test('search activity reconciles in the server background and refreshes when the app returns',async()=>{
  const [server,notifications,visibleRefresh]=await Promise.all([read('apps/api/src/app.js'),read('apps/web/client/src/notifications.tsx'),read('apps/web/client/src/use-visible-refresh.ts')]);
  assert.match(server,/reconcileSearchActivities\(userId,providedSnapshots=null\)/);
  assert.match(server,/activitySnapshots\.set\(domain,\{queue:engineRecords,history:engineHistory\}\)/);
  assert.match(server,/await reconcileSearchActivities\(null,activitySnapshots\)/);
  assert.match(notifications,/useVisibleRefresh\(load,hasActiveActivity\?5_000:15_000\)/);
  assert.match(visibleRefresh,/visibilitychange/);
  assert.match(visibleRefresh,/window\.addEventListener\("focus", run\)/);
});

test('shared modal portals contain focus and restore the originating page',async()=>{
  const [portal,movie,tv]=await Promise.all([read('apps/web/client/src/modal-portal.tsx'),read('apps/web/client/src/movie-detail.tsx'),read('apps/web/client/src/tv-detail.tsx')]);
  assert.match(portal,/focusableSelector/);
  assert.match(portal,/document\.body\.style\.overflow = "hidden"/);
  assert.match(portal,/event\.key === "Escape"/);
  assert.match(portal,/returnFocus\.current\?\.focus/);
  assert.match(movie,/role="region"/);assert.doesNotMatch(movie,/react-movie-detail[^\n]+aria-modal/);
  assert.match(tv,/role="region"/);assert.doesNotMatch(tv,/react-tv-detail[^\n]+aria-modal/);
});

test('download decision center explains native candidate evidence',async()=>{
  const [server,notifications,types,styles]=await Promise.all([read('apps/api/src/app.js'),read('apps/web/client/src/notifications.tsx'),read('apps/web/client/src/notification-types.ts'),read('apps/web/public/notifications.css')]);
  for(const value of ['downloadDecisionStore','recordDownloadDecisions','/api/download-decisions','customFormatScore','preferredWordScore','upgradeEligible'])assert.ok(server.includes(value),value);
  for(const value of ['Download Decision Center','Why a release was accepted or rejected','Custom format','Preferred words','Age (days)','Seeders','Upgrade','Engine rejection evidence'])assert.ok(notifications.includes(value),value);
  assert.match(types,/interface DownloadDecision/);assert.match(styles,/decision-metrics/);assert.match(styles,/@media\(max-width:700px\)/);
});

test('administrator audit coverage includes security, jobs, exports, collections, media, and system operations',async()=>{
  const server=await read('apps/api/src/app.js');
  for(const action of [
    'administrator.initialized','session.logged_in','session.logged_out','account.updated','sessions.others_revoked','session.revoked',
    'engines.repaired','engine.api_key_regenerated','backup.downloaded','synchronization.started',
    'import.started','import.canceled','search.started','search.canceled','naming_audit.started',
    'collection.created','collection.updated','collection.deleted','media_file.reassigned','media.rematched',
    'media.rename_queued','media.preview_file_deleted','automatic_search.grabbed','queue.bulk_deleted',
    'guide_template.rejected','request.submitted','request.canceled','request.match_corrected'
  ])assert.match(server,new RegExp(action.replaceAll('.','\\.')),action);
  assert.doesNotMatch(server,/recordAudit\(session,\{[^}]+(?:apiCredential|password|currentPassword|newPassword):/);
});

test('new poster styles require explicit media and destination choices',async()=>{
  const [studio,rail]=await Promise.all([read('apps/web/client/src/poster-overlays.tsx'),read('apps/web/client/src/poster-overlay-editor-rail.tsx')]);
  assert.match(studio,/domain: "" as OverlayDomain/);
  assert.match(studio,/target: "" as "vynode"/);
  assert.match(studio,/layers: \[\]/);
  assert.match(studio,/Choose a destination/);
  assert.match(studio,/missingEditorChoices\.length > 0/);
  assert.match(studio,/item\.domain === editing\.domain/);
  assert.match(rail,/Choose Movies or Television/);
  assert.doesNotMatch(rail,/<option value="all">Movies & television<\/option>/);
});
