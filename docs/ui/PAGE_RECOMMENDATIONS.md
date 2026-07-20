# Page recommendations

The classification applies to each recommendation: QW quick win, ME medium effort, MA major effort, EX experimental, DNP do not pursue.

| Improvement | Class | Benefit | Functional / upstream risk | A11y / mobile | Dependencies and likely files | Tests / rollback |
| --- | --- | --- | --- | --- | --- | --- |
| Tokenized shell and engine accents | QW | cohesive identity | Low / low | contrast and non-color badge | `UnifiedShell.cs`, `NativeShellBranding.cs`, new shell CSS | snapshot/contrast; remove stylesheet |
| Compact page header with engine badge | ME | immediate context/actions | Medium / medium | heading order, overflow menu | shell adapter plus native header CSS | keyboard/responsive; feature flag |
| Collapsible unified navigation | ME | less double-nav space | Medium / low | tooltip, focus, touch drawer | shell HTML/CSS/JS | navigation matrix; retain old header flag |
| Dashboard degraded-state/queue summary | ME | faster diagnosis | Medium / low | live-region restraint | `UnifiedSummaryService`, shell UI only; API change requires separate approval | gateway tests; revert widget |
| Library sticky filter/action bar | ME | faster scanning/bulk work | High / high | focus order, 44px targets | engine index toolbar CSS/components | both engine E2E; CSS rollback |
| Status badge vocabulary | ME | understandable state | Medium / medium | icon+text, contrast | adapters around status indicators | visual/unit tests; retain legacy icon |
| Queue expandable failures/progress | ME | actionable errors | High / high | disclosure semantics, mobile cards | each engine queue rows | queue fixtures; feature flag |
| Sticky settings save/dirty bar | ME | prevents lost changes | High / high | announced dirty state | each engine settings layout | save/error E2E; disable wrapper |
| Mobile table-to-row-card mode | MA | usable narrow layouts | High / high | reading/action order | queue/history/wanted tables separately | viewport E2E; retain table toggle |
| Detail sticky action bar | MA | key actions stay available | High / high | no hover-only actions | Movie Details and Series Details independently | engine-specific action tests |
| Combined calendar | EX | cross-library planning | High / low engine conflict but new gateway work | icon+label engine identity | new unified endpoint/page | isolated feature flag; delete route |
| Command palette | EX | fast navigation/actions | Medium / low | dialog focus, shortcut/input guards | gateway shell + search adapters | keyboard/E2E; flag off |
| One shared router/store | DNP | little user benefit | Very high / extreme | regression risk | would touch both apps broadly | avoid |
| One generic media-detail component | DNP | superficial consistency | Very high / extreme | loses hierarchy | movie/series domains | avoid |

## Page notes

Dashboard: replace decorative hero dominance with compact identity, engine health, queue, missing, recent failures, disk, and quick actions. Library: retain grid/overview/table, add density and persistent controls. Details: keep every action and use a compact status strip. Calendar: improve native modes first; combined mode is additive. Queue/history: tables remain primary on desktop. Settings: searchable landing index first; do not merge engine forms. System: create unified read-only status links while preserving native tasks/logs/backups/updates.
