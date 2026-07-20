# UX assessment

## Summary

The native applications are capable, keyboard-aware power-user tools, but the combined product currently feels like a gateway placed above two related applications. The main problem is not missing capability; it is hierarchy across two navigation layers and inconsistent engine context.

## Visual hierarchy and space

- Page toolbars expose many equal-weight icon actions. Primary actions, view controls, filters, and destructive actions are not always visually grouped.
- Fixed 60px native header/toolbars plus the 46px injected shell consume significant vertical space, especially on tablets.
- Library views already support useful density, but poster metadata and status icons require learned interpretation. Long titles and error text compete with actions.
- Settings use wide label/form layouts designed around desktop breakpoints; long pages lack a persistent save/dirty-state summary.
- The unified dashboard is restrained but undersells actionable queue, health, and degraded-engine information.

## Navigation

- Dashboard → engine navigation works, but users then encounter a second sidebar whose root means Movies or Series rather than VynodeArr.
- The injected header identifies the engine by active tab, yet it has no breadcrumb, engine health, global search, or mobile overflow strategy.
- Similar native paths (`/calendar`, `/settings`, `/system`) belong to different engines. Any unified link must keep its engine scope explicit.
- Movies uses Router 5; Television uses Router 7. A shared router is a high-conflict redesign and is not recommended.

## Data density and media

- Tables are appropriate for queue, history, wanted, tasks, events, root folders, and bulk operations. They need column prioritization and mobile row cards, not conversion to decorative cards.
- Poster/overview modes are appropriate for discovery and libraries. Status needs text/tooltips in addition to color/icon.
- Movie details are item-centric; Series details are hierarchical across seasons and episodes. A single shared detail component would weaken Television behavior.
- Queue progress, tracked-download state, import warnings, quality/cutoff state, monitoring, and availability should share presentation vocabulary while retaining engine adapters.

## Forms and feedback

- Existing provider test/save, validation, advanced settings, confirmations, and dirty state are functional and must remain authoritative.
- Long-running commands often update through SignalR/store state, but progress and completion are distributed across toolbar icons, toasts/messages, and rows.
- Permission, offline, and proxy failures need recovery-oriented copy that names the affected engine and action.
- Skeletons are appropriate for first-load lists/cards; indefinite decorative animation is not.

## Highest-severity issues

1. Double navigation consumes space and fragments product identity.
2. Engine scope is too easy to lose on similarly named routes.
3. Toolbar actions lack consistent primary/secondary/destructive grouping.
4. Mobile tables and long settings pages impose horizontal/vertical friction.
5. Status often depends on icon/color literacy.
6. Unified degraded-state and queue visibility are limited.
7. Text replacement branding is brittle and can affect user-facing content unexpectedly.

## Evidence boundary

Rendered evidence reviewed: unified dashboard and Movies library-import view supplied during platform validation. Source structure and styling were reviewed for all other routes. No claims about pixel-level rendering of unvisited detail, calendar, queue, settings, or system pages are made; capturing those at four breakpoints is an implementation prerequisite.
