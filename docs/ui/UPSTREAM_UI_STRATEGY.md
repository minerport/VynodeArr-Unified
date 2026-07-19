# Upstream UI strategy

## Boundaries

VynodeArr owns gateway shell, tokens, engine-context adapters, unified pages, and cross-engine navigation. Movies and Television retain routes, stores, API hooks, page logic, schemas, and domain components.

Movies currently uses React Router 5, Redux 4, connected routing, and Redux local storage. Television uses React Router 7, Zustand, and more hook-based React Query access. Never introduce a cross-engine runtime component package that assumes either store/router.

## Change strategy

1. Versioned CSS token layer injected by gateway.
2. Small engine adapter selectors/classes with contract tests.
3. Feature flags for shell, header, and experimental combined pages.
4. Engine changes as narrow commits against exact locked revisions.
5. No broad moves, renames, formatting, or copied page trees.
6. Rebase each engine independently; update source lock only after its build/UI tests pass.

Gateway injection is low-conflict upstream but DOM-selector brittle. Prefer adding explicit stable marker classes in the owned engine forks over increasingly complex `:has` selectors/text mutation. Keep adapters per engine and version.

Phase 1 narrows that conflict surface to gateway files only: embedded token delivery, HTML context attributes, and targeted head/header injection. Broad `MutationObserver` label replacement was removed. No Movies or Television source file, route, store, API hook, database, migration, command, or source-lock entry changed.

## Testing/maintenance

Run each engine's lint, stylelint, TypeScript/build, route smoke tests, and visual snapshots separately. Then package through VynodeArr and test proxied base paths, navigation, authentication, refresh/deep links, lifecycle/offline states, and all supported platforms. Rollback is feature-flag disable plus source-lock reversal; databases/APIs are untouched.
