# Responsive review

Existing breakpoints are aligned at 480, 768, 992, 1200, and 1450px, with 20px desktop and 10px small-screen content padding. Native sidebars are 210px and support swipe/drawer behavior. The additional 46px gateway header creates the largest combined-layout cost.

## Recommendations

- 1450+: expanded unified rail, dense tables, optional right detail panel.
- 992–1449: collapsible rail, full table with low-priority columns hideable.
- 768–991: modal navigation drawer, compact toolbar, two-column settings only where labels fit.
- 480–767: single-column forms, agenda calendar default, priority columns or row cards.
- <480: bottom/overflow shell navigation, poster list/compact grid, sticky action drawer.

Long titles wrap to two lines with accessible full text; they must not push status/actions off-screen. Tables should declare column priority before switching to cards. Poster sizing uses container queries or bounded CSS variables rather than fixed device assumptions.

Required captures: 1440×900, 1024×768, 768×1024, 390×844 for dashboard, both libraries, both details, calendar, queue, settings, and system. Record overflow, tap target, focus visibility, action reachability, and information loss.
