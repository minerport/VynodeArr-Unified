import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('the complete dashboard has a React view with a legacy-safe bridge',async()=>{
  const [packageJson,index,app,entry,dashboard,analytics,library,libraryTypes,history,queue,unraidDockerfile]=await Promise.all([
    read('package.json'),
    read('apps/web/public/index.html'),
    read('apps/web/public/app.js'),
    read('apps/web/client/src/react-islands.tsx'),
    read('apps/web/client/src/dashboard.tsx'),
    read('apps/web/client/src/dashboard-analytics.tsx'),
    read('apps/web/client/src/library.tsx'),
    read('apps/web/client/src/library-types.ts'),
    read('apps/web/client/src/history.tsx'),
    read('apps/web/client/src/queue.tsx'),
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
  assert.match(entry,/DashboardView/);
  assert.match(entry,/LibraryView/);
  assert.match(entry,/unmountLibrary/);
  assert.match(entry,/HistoryView/);
  assert.match(entry,/unmountHistory/);
  assert.match(entry,/QueueView/);
  assert.match(entry,/unmountQueue/);
  assert.match(dashboard,/Recently added/);
  assert.match(dashboard,/Recent events/);
  assert.match(analytics,/DashboardAnalyticsView/);
  assert.match(library,/Filter titles/);
  assert.match(library,/onMonitor/);
  assert.match(libraryTypes,/LibraryMountOptions/);
  assert.match(history,/Retry organize/);
  assert.match(history,/Find activity/);
  assert.match(queue,/Select all completed/);
  assert.match(queue,/\/api\/activity\/queue\/live/);
  assert.match(queue,/setInterval/);
  assert.match(unraidDockerfile,/FROM node:24-alpine AS web-build/);
  assert.match(unraidDockerfile,/apps\/web\/public\/react/);
});
