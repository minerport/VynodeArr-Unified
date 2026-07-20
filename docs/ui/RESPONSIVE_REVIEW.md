# Responsive review

Existing breakpoints are aligned at 480, 768, 992, 1200, and 1450px, with 20px desktop and 10px small-screen content padding. Native sidebars are 210px and support swipe/drawer behavior. The additional 46px gateway header creates the largest combined-layout cost.

## Recommendations

- 1450+: expanded unified rail, dense tables, optional right detail panel.
- 992–1449: collapsible rail, full table with low-priority columns hideable.
- 768–991: modal navigation drawer, compact toolbar, two-column settings only where labels fit.
- 480–767: single-column forms, agenda calendar default, priority columns or row cards.
- <480: bottom/overflow shell navigation, poster list/compact grid, sticky action drawer.

Long titles wrap to two lines with accessible full text; they must not push status/actions off-screen. Tables should declare column priority before switching to cards. Poster sizing uses container queries or bounded CSS variables rather than fixed device assumptions.

## Phase 1 result

The dashboard and both engine entry routes were rendered at 1440x900, 1024x768, 768x1024, and 390x844. DOM measurements reported no horizontal overflow in all twelve captures. Dashboard status and lifecycle actions remain reachable, and cards collapse to one column on narrow viewports. Fresh isolated engine data correctly presented the engine-owned authentication setup modal, so the underlying populated library grids were not claimed as visually reviewed. Details, calendar, queue, settings, and system remain outside Phase 1 and were not captured.

Required captures: 1440×900, 1024×768, 768×1024, 390×844 for dashboard, both libraries, both details, calendar, queue, settings, and system. Record overflow, tap target, focus visibility, action reachability, and information loss.
