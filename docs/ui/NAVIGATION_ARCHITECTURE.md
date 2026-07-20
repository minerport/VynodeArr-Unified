# Navigation architecture

## Recommended model

Use one persistent VynodeArr shell with primary destinations: Dashboard, Movies, Television, Calendar, Activity, Search, Settings, System. Calendar/Activity/Settings/System open an engine-aware chooser or last-used engine; they must not silently merge native APIs.

Movies secondary links: Library, Add Movie, Library Import, Discover, Collections, Wanted. Television: Series, Add Series, Library Import, Statistics, Wanted. Native sidebars and all routes remain during incremental adoption.

## Route ownership

- Gateway owns `/`, unified summaries, and future additive combined views.
- Movies owns everything under `/movies/*` with Router 5.
- Television owns everything under `/television/*` with Router 7.
- Breadcrumbs are shell-derived: `VynodeArr / Movies / Activity / Queue`.
- Aliases may improve discoverability but always redirect to the unchanged canonical engine route.

## Responsive behavior

Desktop: 220px collapsible shell rail, icon + text expanded, tooltip and accessible label collapsed. Tablet: compact rail or modal drawer. Mobile: 48–52px top bar plus bottom/overflow navigation; no dual persistent sidebars. Focus returns to the menu trigger after drawer close; Escape closes; focus is trapped only in modal drawers.

## Safety

Do not replace native routing, remove sidebar links, or infer equivalence from matching paths. The first shell phase may visually coordinate native navigation, but route registration and action handling stay engine-owned.
