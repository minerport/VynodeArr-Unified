# Companion GUI research and coverage review

Reviewed 2026-10-11. Recommendation: a TV-first cinematic media browser with compact poster cards, focus-driven artwork, restrained glass surfaces, and progressive detail disclosure. This is a design recommendation for VynodeArr, not a claim that one app has objectively the best GUI.

## Sources and decisions

| Primary reference | What it supports | Decision for this companion |
|---|---|---|
| [Android TV immersive lists](https://developer.android.com/design/ui/tv/guides/components/immersive-list) | Focus-driven previews and artwork; progressive disclosure; prefer landscape backgrounds and avoid cropping subjects beneath content | Keep rich information in the preview/details, keep cards concise. Improve landscape artwork coverage rather than stretching portrait art when a backdrop exists. |
| [Android TV cards](https://developer.android.com/design/ui/tv/guides/components/cards) | Consistent artwork/content widths; concise card text; dark gradients behind image overlays | Preserve 2:3 library posters, reduce caption padding to 5dp, remove reserved blank title lines, keep one metadata line and small availability badges. |
| [Android TV typography](https://developer.android.com/design/ui/tv/guides/styles/typography) | A consistent type scale and distance legibility; brand fonts are acceptable when readable | Keep Outfit and shared styles. Tighten layout instead of shrinking all text. Physical viewing-distance validation remains required. |
| [Android TV focus](https://developer.android.com/design/ui/tv/guides/styles/focus-system) | D-pad navigation; single clear focus; scale, outline and color as focus cues | Keep subtle poster lift and lavender outline; static information should not pretend to be a button. |
| [Android TV navigation drawer](https://developer.android.com/design/ui/tv/guides/components/navigation-drawer) | Prioritized, grouped destinations and compact/expanded navigation | Existing permission-aware rail is the foundation. A collapsible rail and account grouping are future refinements, not implemented in this pass. |
| [FullCalendar accessibility](https://fullcalendar.io/docs/accessibility) | Accessible names and keyboard access to interactive calendar elements | Native Compose month grid with labeled selectable dates, today/month controls, release counts and a day agenda. FullCalendar is a reference, not a dependency. |
| [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Contrast targets of 4.5:1 for normal text and 3:1 for large text | Test text against the brightest supported artwork, not only a dark mockup. Full contrast compliance has not been established. |

## Coverage and remaining work

| Area | Current coverage | Remaining acceptance work |
|---|---|---|
| Discover | Focus-driven backdrop, poster rows, search, feeds, paging, previews | Preserve exact card focus and row position after returning from details; improve missing-art presentation |
| Movie/TV libraries | Permissions, search, filter, sort, engine choice, pagination, details, compact captions | More varied real artwork; richer TV season/episode browsing and actions need separate product/backend scope |
| Calendar | Month grid, previous/next month, Today, day selection, release markers, agenda; requests displayed month from server with boundary padding for local time conversion | Locale-specific first weekday, movie/TV toggles, dense-day agenda navigation, event-to-details links; engine data completeness depends on server responses |
| Details/trailers | Full page, synopsis, metadata, cast, popup trailer, request actions | Real-device long-text/font-scaling and live trailer verification |
| Requests/account | Approval status and server messages; role/permission-aware access | Saved preferences and richer request sorting; administrative actions remain in web app |
| Feedback/accessibility | Loading indicator, messages, empty states, focus outlines, date accessibility labels | Screen-reader traversal, large text, reduced motion, brightness/contrast matrix, reconnect/loading skeletons |
| Performance | Lazy lists/grids, cached artwork, inexpensive glass gradients | Physical Shield/Fire TV frame timing, cold start, low-memory and slow-network measurements |
| Playback | Trailers only | Full library playback, continue watching, watch history and playback handoff are not implemented; do not display misleading controls |

## Acceptance for this pass

Check tight title/metadata spacing across Discover and both libraries. Verify long titles still open to their complete title, posters retain aspect ratio, month navigation handles year boundaries, days indicate focus versus selection, and date-only/UTC events do not shift unpredictably. Test calendar data failure separately from an empty day. Keep permissions enforced by the server. Emulator screenshots do not replace physical Shield testing.
