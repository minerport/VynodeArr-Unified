# UI implementation roadmap

## Top ten priorities

1. Central dark/light design tokens and engine accents.
2. Compact unified shell with explicit engine context.
3. Responsive navigation that eliminates persistent double chrome.
4. Consistent focus, contrast, status badge, empty/error/loading patterns.
5. Compact page-header/action hierarchy.
6. Library filter/action density and saved-view assessment.
7. Queue progress and expandable failure clarity.
8. Settings dirty-state/sticky save wrapper.
9. Mobile priority columns/row-card strategy.
10. Unified read-only system/degraded-state center.

## Phases

### Phase 0 — assessment (complete)

Inventory and source assessment only. No route, API, database, action, form, or engine UI behavior changed.

### Phase 1 — design foundation (recommended next)

Add `VynodeArrTokens.css`, dark/light token sets, reduced-motion rules, engine-context attributes/classes, and token tests. Restyle only the gateway dashboard and injected top shell. Expected files: `src/VynodeArr.Gateway/UnifiedShell.cs`, `src/VynodeArr.Gateway/Proxy/NativeShellBranding.cs`, gateway project embedded/static assets, `UnifiedShellTests.cs`, `NativeShellBrandingTests.cs`. No engine source-lock change.

### Phase 2 — unified shell

Collapsible desktop rail, accessible mobile drawer, breadcrumbs, engine badge/status. Preserve old shell behind a flag.

### Phase 3 — shared presentation contracts

Status badge, empty/error/skeleton, page-header tokens. Implement separately in each engine with adapters; no shared store/router.

### Phases 4–8

Libraries; details; activity/calendar; settings/system; polish/accessibility. Migrate one page family and one engine at a time, compare behavior inventories, then package-test both.

## Phase 1 tests

Gateway unit snapshots; HTML landmark/link checks; engine base-path/deep-link smoke tests; keyboard navigation; contrast; reduced motion; 1440/1024/768/390 screenshots; offline-one-engine state; Windows/Linux/Unraid package builds. Rollback: disable token/shell feature flag or revert gateway-only commit.

## Change control

After each phase, list all preserved routes/actions, engine-specific differences, screenshots, accessibility results, build results, upstream conflict surface, and rollback. Do not begin Phase 2 until Phase 1 review is approved.
