import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('poster overlay presentation is owned by static stylesheets',async()=>{
  const [conditions,conditionStyles,rail,layoutStyles]=await Promise.all([
    read('apps/web/client/src/poster-overlay-conditions.tsx'),
    read('apps/web/client/src/poster-overlay-conditions.css'),
    read('apps/web/client/src/poster-overlay-editor-rail.tsx'),
    read('apps/web/client/src/poster-overlay-editor-layout.css')
  ]);

  assert.match(conditions,/import "\.\/poster-overlay-conditions\.css"/);
  assert.match(rail,/import "\.\/poster-overlay-editor-layout\.css"/);
  assert.doesNotMatch(conditions,/createElement\(["']style["']\)|style\.textContent|document\.head\.append/);
  assert.doesNotMatch(rail,/createElement\(["']style["']\)|style\.textContent|document\.head\.append/);
  assert.match(conditionStyles,/\.overlay-condition-workspace\s*\{/);
  assert.match(layoutStyles,/\.overlay-editor \.overlay-editor-grid\s*\{/);
});
