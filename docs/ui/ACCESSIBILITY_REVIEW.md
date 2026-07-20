# Accessibility review

## Existing strengths

Semantic links/buttons are widely used; modal focus locking exists; the Television sidebar is a labeled `nav`; focus-visible treatment exists in the injected shell; keyboard-accessible menus and confirmations are established; reduced motion is already recognized in the dashboard shell.

## Findings

- The injected navigation uses an extremely high z-index and body offset; verify skip links and focus are not obscured.
- Movies sidebar uses a `div` container where Television uses `nav`; landmarks should be normalized additively.
- Icon-heavy toolbars and status glyphs require consistent accessible names and visible tooltip/help.
- Active/monitoring/quality/error state must never rely on cyan/violet/green/red alone.
- Swipe navigation needs an equivalent visible button; touch listeners must not prevent normal scrolling.
- Dynamic engine summaries should announce only meaningful transitions, not every poll.
- Sticky headers/save bars must not cover focused controls at 200% zoom.
- Mobile action drawers need focus trap, Escape/close, focus restoration, and non-drag alternatives.
- Drag/reorder controls need move up/down and destination controls.

## Acceptance checks

Keyboard-only route/action walkthrough; axe on representative routes; WCAG 2.2 AA contrast; 200% and 400% zoom; reduced-motion; Windows high contrast; screen-reader names/landmarks/headings; modal focus; error association; 44px touch targets; no hover-only required action.

## Phase 1 implementation result

The unified header is a labeled `nav`; the dashboard uses `main`, labeled regions, headings, articles, definition lists, visible state text, and a polite live region that updates only when an engine state changes. Focus-visible styling uses tokenized high-contrast outlines and `scroll-margin-top`. Desktop targets are at least 40px and coarse-pointer targets are 44px. Engine badges contain explicit Movies or Television text rather than color alone. Reduced-motion and forced-colors rules are present in the versioned stylesheet and covered by tests.

Pending manual checks: axe, screen-reader output, 200%/400% zoom, Windows High Contrast rendering, and keyboard traversal through native engine modals. These were not claimed as complete from screenshots alone.
