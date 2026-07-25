import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('the complete dashboard has a React view with a legacy-safe bridge',async()=>{
  const [packageJson,index,app,entry,dashboard,analytics,library,libraryCss,libraryTypes,history,queue,wanted,calendar,movieDetail,tvDetail,collections,collectionTypes,addMedia,addMediaTypes,health,healthTypes,account,accountTypes,system,systemTypes,bundleBudget,unraidDockerfile]=await Promise.all([
    read('package.json'),
    read('apps/web/public/index.html'),
    read('apps/web/public/app.js'),
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
    read('scripts/check-web-bundle.mjs'),
    read('Dockerfile.unraid')
  ]);
  const manifest=JSON.parse(packageJson);

  assert.match(manifest.scripts['build:web'],/vite build/);
  assert.equal(manifest.dependencies.react,'19.2.8');
  assert.match(index,/\/react\/vynodearr-react\.js/);
  assert.match(app,/mountDashboard/);
  assert.match(app,/dashboard-react/);
  assert.match(app,/mountLibrary/);
  assert.match(app,/showHistoryReact/);
  assert.match(app,/content\.replaceChildren/);
  assert.match(entry,/createRoot/);
  assert.match(entry,/import\('\.\/library'\)/);
  assert.match(entry,/import\('\.\/movie-detail'\)/);
  assert.match(entry,/DashboardView/);
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
  assert.match(system,/Create both backups/);
  assert.match(system,/Automatic schedules are active/);
  assert.match(system,/Find events/);
  assert.match(system,/storageSize/);
  assert.match(system,/TB/);
  assert.match(systemTypes,/SystemMountOptions/);
  assert.match(app,/showSystemReact/);
  assert.match(library,/Filter titles/);
  assert.match(library,/onMonitor/);
  assert.match(library,/Search all missing/);
  assert.match(library,/MoviesSearch/);
  assert.match(library,/Cutoff unmet/);
  assert.match(library,/IntersectionObserver/);
  assert.match(library,/setDebouncedQuery/);
  assert.match(library,/sessionStorage/);
  assert.match(library,/onPointerEnter=\{prefetch\}/);
  assert.match(library,/preloadRoute/);
  assert.match(library,/\/api\/media\/movies\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(library,/\/api\/media\/tv\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(libraryCss,/content-visibility:auto/);
  assert.match(libraryTypes,/LibraryMountOptions/);
  assert.match(history,/Organize again/);
  assert.match(history,/Imported into library/);
  assert.match(history,/Download grabbed/);
  assert.match(history,/event\.organizable/);
  assert.match(history,/Activity type/);
  assert.match(history,/Find activity/);
  assert.match(queue,/Select all completed/);
  assert.match(queue,/\/api\/activity\/queue\/live/);
  assert.match(queue,/setInterval/);
  assert.match(queue,/requestSequence/);
  assert.match(queue,/visibilitychange/);
  assert.match(wanted,/Search all missing/);
  assert.match(wanted,/Interactive search/);
  assert.match(wanted,/SeriesSearch/);
  assert.match(calendar,/Previous month/);
  assert.match(calendar,/includeSeries=true/);
  assert.match(movieDetail,/Automatic search/);
  assert.match(movieDetail,/MatchBrowser/);
  assert.match(movieDetail,/ReleaseBrowser/);
  assert.match(movieDetail,/RenamePreview/);
  assert.match(movieDetail,/is-working/);
  assert.match(movieDetail,/Finding releases/);
  assert.match(movieDetail,/AbortController/);
  assert.match(movieDetail,/enrichmentLoading/);
  assert.match(movieDetail,/method:'POST'/);
  assert.match(tvDetail,/interactive\(`seriesId=\$\{engineId\}`/);
  assert.match(tvDetail,/MatchBrowser/);
  assert.match(tvDetail,/seasonNumber=\$\{season\.seasonNumber\}/);
  assert.match(tvDetail,/RenamePreview/);
  assert.match(tvDetail,/busy==='SeriesSearch'/);
  assert.match(tvDetail,/AbortController/);
  assert.match(movieDetail,/Rename & organize/);
  assert.match(collections,/export function CollectionsView/);
  assert.match(collections,/CollectionBuilder/);
  assert.match(collections,/includedMovieIds/);
  assert.match(collections,/excludedMovieIds/);
  assert.match(collections,/Changing rules replaces the current matches/);
  assert.match(collections,/Edit rules &amp; movies/);
  assert.match(collectionTypes,/interface CollectionRules/);
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
  assert.match(bundleBudget,/limits=\{entry:300_000,route:45_000,css:50_000\}/);
  assert.match(unraidDockerfile,/FROM node:24-alpine AS web-build/);
  assert.match(unraidDockerfile,/apps\/web\/public\/react/);
});

test('dashboard resolves television quality profile names and reports real storage',async()=>{
  const api=await read('apps/api/src/app.js');
  assert.match(api,/management\.execute\('tv','profiles','GET'\)/);
  assert.match(api,/qualityProfiles\.tv\?\.get\(String\(item\.qualityProfile\)\)/);
  assert.match(api,/analytics\.library\.movie\.sizeOnDisk\+analytics\.library\.tv\.sizeOnDisk/);
});

test('library navigation preserves mounted views and safely reuses short-lived reads',async()=>{
  const legacy=await read('apps/web/public/app.js');
  assert.match(legacy,/const responseCache=new Map\(\),responseInflight=new Map\(\)/);
  assert.match(legacy,/const cacheLifetime=path=>/);
  assert.match(legacy,/responseInflight\.has\(path\)/);
  assert.match(legacy,/responseCache\.clear\(\)/);
  assert.match(legacy,/libraryStale:\{movies:false,tv:false\}/);
  assert.match(legacy,/preserveLibrary/);
  assert.match(legacy,/if\(preserveLibrary&&!state\.libraryStale\[key\]\)return/);
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

test('Discover progressively loads through a typed React route',async()=>{
  const [discover,islands,legacy]=await Promise.all([
    read('apps/web/client/src/discover.tsx'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/public/app.js')
  ]);
  assert.match(discover,/export function DiscoverView/);
  assert.match(discover,/loadFeed/);
  assert.match(discover,/cachedRequest/);
  assert.match(islands,/mountDiscover/);
  assert.match(islands,/preloadRoute/);
  assert.match(legacy,/vynodearr\.dashboardSnapshot/);
});
