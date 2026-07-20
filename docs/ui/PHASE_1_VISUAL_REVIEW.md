# Phase 1 visual review

Review assets live in `docs/ui/review/phase-1/` and are documentation-only; they are not embedded in production packages.

## Capture matrix

| Route | Viewports | Theme | Engine state | Result | Remaining issue | Approval |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 1440x900, 1024x768, 768x1024, 390x844 | Dark | Both running | Compact identity, two readable engine panels, lifecycle actions, quick links; no measured horizontal overflow | Manual zoom/AT review pending | Recommended with follow-up |
| `/movies/` | all four | Dark | Movies running | Cyan context marker, unified navigation, native modal remains above shell; no measured horizontal overflow | Fresh data opens mandatory authentication setup, so populated library was not inspected | Conditional |
| `/television/` | all four | Dark | Television running | Violet context marker, unified navigation, native modal remains above shell; no measured horizontal overflow | Fresh data opens mandatory authentication setup, so populated library was not inspected | Conditional |
| `/` | 1440x900 | Dark | Movies unavailable, Television running | Unavailable is written as text and Television remains actionable | Transition announcement needs screen-reader confirmation | Recommended |
| `/` | 1440x900 | Dark | Both unavailable | Both degraded cards remain visible with start actions and quick links | None observed in this state | Recommended |

## Evidence index

- Dashboard: `dashboard-1440x900-dark.jpg`, `dashboard-1024x768-dark.jpg`, `dashboard-768x1024-dark.jpg`, `dashboard-390x844-dark.jpg`
- Movies entry: `movies-library-1440x900-dark.jpg`, `movies-library-1024x768-dark.jpg`, `movies-library-768x1024-dark.jpg`, `movies-library-390x844-dark.jpg`
- Television entry: `television-library-1440x900-dark.jpg`, `television-library-1024x768-dark.jpg`, `television-library-768x1024-dark.jpg`, `television-library-390x844-dark.jpg`
- Degraded states: `dashboard-1440x900-one-engine-offline-dark.jpg`, `dashboard-1440x900-both-engines-offline-dark.jpg`

## Accessibility observations

Visible engine names and status text prevent color-only meaning. Focus tokens and target sizes are present in rendered CSS. The native authentication modal remained above the injected shell at desktop and mobile widths. Keyboard focus traversal, screen-reader announcements, high contrast, and zoom were not proven by these screenshots.

## Theme and motion evidence

Dark mode was rendered. Light-mode tokens and `prefers-color-scheme: light` behavior are unit tested, but the connected browser inherited a dark OS preference and its security policy did not allow a safe media override. Reduced-motion rules are likewise unit tested; a static screenshot would not provide meaningful motion proof. These are explicitly open review items, not claimed visual validations.

## Pages not reviewed

Movie Details, Series Details, Calendar, Queue, Settings, and System were not rendered and are not claimed as reviewed.

Recommendation: accept the Phase 1 code foundation, but keep Phase 2 gated until light-mode capture and manual accessibility checks are completed.
