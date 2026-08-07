# Changelog

All notable VynodeArr changes will be recorded in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.35-rc.23] - 2026-08-07

### Fixed

- Replaced the whole-column Layer Settings minimizer with independently collapsible settings cards for every overlay layer.
- Expanded and focused the selected layer card when adding a layer or selecting it from the build rail or poster preview.
- Preserved Plex added timestamps supplied as Unix seconds, Unix milliseconds, or ISO dates so days-since-added rules render reliably.
- Kept editor preview layers visible with representative metadata values when the selected title lacks the configured variable.

### Validation

- Passed 203 automated tests, TypeScript checks, production builds, bundle and branding checks, and deployment validation.

## [2.0.35-rc.22] - 2026-08-07

### Improved

- Centered newly added overlay text, icon, and shape layers and selected them immediately.
- Made build-rail and poster-preview layer clicks focus and scroll the matching second-column settings into view.
- Added responsive minimize and expand controls for the Layer Settings column, with automatic expansion when a layer is selected.

### Validation

- Passed 202 automated tests, TypeScript checks, production builds, bundle and branding checks, and deployment validation.

## [2.0.35-rc.21] - 2026-08-07

### Added

- Added a Plex-backed whole-calendar-day `Days since added` poster-overlay variable without substituting the Movie or Television engine added date.
- Added inclusive numeric condition operators for configurable ranked ranges such as 0–7, 8–14, and 15+ days.
- Preserved independent appearance formatting for every ranked sub-condition in the editor and final Plex artwork renderer.

### Validation

- Passed 200 automated tests, TypeScript checks, production builds, bundle and branding checks, and deployment validation.

## [2.0.35-rc.20] - 2026-08-07

### Fixed

- Rebuilt the Reeltrack list integration and Poster Overlay editor from the stable v2.0.35 codebase instead of retaining the broken RC poster-rendering changes.
- Corrected VynodeArr overlay sizing in alternate Movie and Television card, compact, and detailed-list layouts while leaving the primary poster-grid layout unchanged.

### Validation

- Passed complete tests, TypeScript checks, production web build, bundle validation, and deployment validation.

## [2.0.35] - 2026-08-06

### Fixed

- Corrected Movies and Television summary cards so title, monitored, attention,
  and coverage totals consistently represent the complete local catalog rather
  than mixing a 60-item page with whole-library attention counts.
- Kept complete-catalog totals current after synchronization, additions,
  removals, and monitoring changes through the existing live update stream.

### Release

- Promoted the validated 2.0.35 release-candidate series to the production
  `latest` channel for Docker, Unraid, and Windows deployments.

## [2.0.35-rc.8] - 2026-08-06

### Fixed

- Kept television match-correction failures inside the title details dialog,
  where duplicate TMDB or TVDB conflicts remain visible beside the match
  choices instead of appearing only as a transient global notification.
- Standardized movie and television match-correction error handling while
  retaining the existing duplicate-library protection and current media files.

### Validation

- Passed the match-correction regression test, TypeScript checks, and the
  production web build.

## [2.0.35-rc.7] - 2026-08-06

### Changed

- Made Dashboard, Queue, requests, notifications, import monitoring, Wanted,
  media-management jobs, and Action Center refresh only while the app is
  visible, with an immediate catch-up when users return.
- Grouped Service Settings into Library, Quality & automation, Connections,
  and Application sections while retaining every existing settings route.
- Clarified the difference between actionable Action Center records and the
  durable, read-only Automation Timeline, including dismissal and refresh
  behavior.
- Renamed ambiguous refresh actions so users can distinguish catalog reads,
  system-data refreshes, validation runs, and engine-changing operations.

### Fixed

- Prevented polling refreshes and settings-tab activation from shifting or
  rebuilding the visible page, reducing desktop twitch and unnecessary engine
  and browser work.
- Standardized application dialogs with focus containment, Escape handling,
  background scroll locking, and restoration of focus to the opening control.
- Preserved stable page widths across desktop and mobile scrollbar changes and
  prevented route content from widening the viewport.
- Kept poster-overlay editor columns adaptive and independently usable without
  removing any layer, condition, formatting, preview, or application control.
- Corrected the History loading message and improved responsive notification
  and operations navigation.

### Validation

- Passed all 194 automated tests, TypeScript checks, production builds, bundle
  limits, branding checks, and deployment validation.
- Authenticated desktop and phone-width reviews found no horizontal overflow
  or browser runtime warnings across the primary library, activity, system,
  and service-settings routes.

## [2.0.35-rc.6] - 2026-08-05

### Added

- Added per-engine circuit breakers with automatic cooldown probes and visible
  state in System Performance, preventing an unavailable engine from being
  called continuously.
- Added serialized, prioritized, and deduplicated catalog synchronization
  queues so targeted title updates run ahead of queued full reconciliations.
- Added catalog integrity diagnostics for SQLite health, invalid records,
  duplicate external IDs, synchronization age, and persisted title counts.
- Added administrator recovery controls to retry failed event work or rebuild
  a Movie or Television catalog without discarding the last usable catalog
  unless a complete replacement response succeeds.

### Fixed

- Kept long notification and release titles inside the mobile notification
  panel and separated individual Mark read controls from notification text.
- Added persistent selected and pressed feedback to the Action Center and
  Automation Timeline controls on desktop and touch devices.

## [2.0.35-rc.5] - 2026-08-05

### Fixed

- Restored persisted SQLite catalog synchronization timestamps after restart
  so Validation and the Action Center recognize usable synchronized libraries.
- Kept Movie and Television refresh responses usable when live attention
  totals fail, falling back to catalog-derived totals instead of returning
  `Load failed`.
- Marked failed live reconciliations stale when a durable catalog exists and
  clearly tell administrators that the local library remains available.

## [2.0.35-rc.4] - 2026-08-05

### Added

- Added administrator performance counters for catalog activity and engine
  requests, plus visible per-title freshness and guarded targeted refreshes on
  Movie and Television detail pages.

### Changed

- Engine API traffic is now bounded per engine, with duplicate queue,
  history, notification, and request-status reads sharing short-lived
  snapshots instead of opening competing requests.
- Filesystem reconciliation now waits for a quiet period and observes a
  cooldown so large import bursts become one controlled catalog update.
- Television catalog synchronization now derives attention totals from series
  statistics instead of requesting an unbounded missing-episode result set.

### Fixed

- Reduced SQLite lock contention and Kestrel thread-pool starvation during
  large-library synchronization by serializing catalog operations, limiting
  engine concurrency, and lowering operational history pressure.
- Kept detail-page refreshes mounted on the selected title while their targeted
  catalog reconciliation completes.

## [2.0.35-rc.3] - 2026-08-05

### Added

- Added a WAL-backed SQLite library catalog with indexed server-side search,
  filters, sorting, progressive pages, alphabet offsets, and direct detail
  lookup while keeping the media engines authoritative.
- Added a durable, deduplicated engine-event queue and managed Radarr/Sonarr
  webhooks for targeted add, update, import, rename, and removal reconciliation.
- Added administrator Performance diagnostics for process memory, catalog and
  event health, artwork queues, expensive API routes, and live resource limits.

### Changed

- Existing projected library data migrates automatically into SQLite, remains
  available during engine outages, and is included in encrypted application
  backup and restore workflows.
- Artwork downloads and disk writes are concurrency-limited, indexed on disk,
  reused across restarts, and invalidated only when the affected title changes.
- Full engine reconciliation is now a configurable integrity backstop; normal
  browsing, searching, sorting, filtering, details, and live updates read the
  local catalog without rescanning an entire engine library.

### Fixed

- Prevented notification activity refreshes from restarting after every
  response and creating a high-frequency API request loop.

## [2.0.35-rc.2] - 2026-08-04

### Changed

- Movie and Television detail pages now request only the selected title's
  records and reuse a short-lived, deduplicated detail cache instead of loading
  global queue, wanted, or cutoff data.
- Library poster grids now load progressively in 60-title batches while keeping
  automatic loading, manual loading, filtering, sorting, and alphabet jumps.
- Normal and composed overlay posters now share one bounded artwork path with a
  persistent, size-limited disk cache across application restarts.

### Fixed

- Stopped poster hover and keyboard focus from issuing live engine detail
  requests before a user actually opens a title.
- Prevented passive Television library rendering from making per-series file
  and episode metadata requests for existing overlay assignments.
- Prevented overlay-heavy libraries from bypassing the artwork cache and
  repeatedly downloading original posters from the movie or television engine.
- Cached projected detail fallbacks briefly during engine interruptions so
  repeated navigation cannot create an immediate retry storm.

## [2.0.35-rc.1] - 2026-08-04

### Added

- Added durable projected Movie and Television catalogs so library pages load
  the last verified engine state immediately instead of requesting the entire
  engine library on every visit.
- Added targeted reconciliation after adds, edits, imports, refreshes, renames,
  and removals, plus filesystem monitoring and a six-hour integrity sweep for
  changes made outside VynodeArr.
- Added an administrator-only **Sync now** recovery action and visible library
  freshness information on Movie and Television pages.

### Changed

- Queue enrichment now joins against the projected catalog instead of loading
  both complete engine libraries during frequent queue polling.
- Library update events now add, replace, or remove only affected titles and
  request a full client refresh only after a successful integrity reconciliation.

### Fixed

- Preserved the last good projected catalog when an engine is temporarily
  unavailable during filesystem or scheduled reconciliation.
- Serialized targeted and full reconciliation so an older full snapshot cannot
  overwrite a newer item-level update.

## [2.0.34-rc.19] - 2026-08-04

### Fixed

- Canceled the matching Radarr or Sonarr compatibility request immediately
  when its browser or external caller disconnects, preventing abandoned
  upstream response work while preserving submitted background operations.
- Retained the existing engine timeout as a fallback and verified that normal
  compatibility responses still complete without premature cancellation.

## [2.0.34-rc.18] - 2026-08-04

### Fixed

- Bounded binary artwork and television metadata caches by age, item count,
  and total bytes so browsing large libraries cannot retain artwork forever.
- Pruned expired browser requests, interactive searches, authentication
  attempts, sessions, and completed-event tracking during long uptimes.
- Prevented Action Center card headers, release names, and timestamps from
  overlapping on mobile screens.
- Restored the current hash route when Safari revives a cached page so opening
  Action Center does not unexpectedly return administrators to Dashboard.

## [2.0.34-rc.17] - 2026-08-04

### Fixed

- Prevented loaded Action Center records from widening the mobile viewport.
- Kept tabs, filters, action cards, timestamps, and decision evidence bounded
  and readable when release names or explanations contain long text.

## [2.0.34-rc.16] - 2026-08-04

### Fixed

- Prevented historical engine grabs from being replayed to Telegram, Discord,
  Gotify, or Pushover after an application upgrade.
- Added a persistent background-delivery watermark so old activity is silently
  backfilled in the app while new events continue delivering externally even
  when no browser session is open.

## [2.0.34-rc.15] - 2026-08-04

### Fixed

- Persisted engine-initiated background grabs into administrator Search
  Activity even when no browser session is open.
- Reconciled those durable entries through downloading, imported, and failed
  states using queue and engine-history evidence.
- Added background engine grabs to bell History with stable event identities
  that prevent duplicate entries across polling cycles.

## [2.0.34-rc.14] - 2026-08-04

### Fixed

- Reconciled bell and search activity from the server's background queue pass
  so statuses continue advancing while the application is closed.
- Refreshed notifications immediately when a phone or desktop browser returns
  to the foreground.
- Restored the Poster Overlay Studio creation action directly beside the style
  list with compact desktop and touch-friendly mobile layouts.

## [2.0.34-rc.13] - 2026-08-03

### Fixed

- Reworked the Automation Timeline filters and event rows for phone-sized
  screens so controls stack cleanly and long activity details remain inside
  the viewport.
- Made timeline actions, tabs, summaries, and metadata easier to read and use
  on mobile without changing the desktop workflow.

## [2.0.34-rc.12] - 2026-08-03

### Added

- Added an administrator Library Action Center that explains operational
  issues, affected areas, and recommended next actions with reversible
  dismiss and restore controls.
- Added a filterable Automation Timeline spanning requests, searches,
  download decisions, queue and history events, notifications, audit events,
  validation results, and Plex poster changes.

### Improved

- Added responsive desktop and mobile layouts for the new operations views
  without replacing or removing existing activity workflows.

## [2.0.34-rc.11] - 2026-08-03

### Fixed

- Rebuilt mobile poster-style cards as compact poster, details, and action
  rows instead of inheriting the global sticky mobile action bar.
- Kept Edit, Duplicate, and Delete as accessible touch targets on one row and
  prevented the poster-style count badge from stretching across the panel.

## [2.0.34-rc.10] - 2026-08-03

### Improved

- Reorganized the Poster Overlay Studio for cleaner desktop and mobile use,
  including compact style cards and a horizontally scrollable settings menu.
- Made Plex connection fields, long server names, library selection, and
  actions responsive without clipping or horizontal page overflow.
- Replaced the oversized Plex poster-change history with compact rows and
  recent/all history controls while preserving poster restoration actions.

## [2.0.34-rc.9] - 2026-08-03

### Fixed

- Correlated engine replacement events that omit download IDs using exact media
  identity and event timing, while still rejecting conflicting download IDs.
- Download decisions now distinguish new imports, quality upgrades,
  same-quality score upgrades, and same-quality replacements whose detailed
  ranking rationale was not retained by the engine.
- Preserved and displayed native replacement reasons such as `Upgrade` instead
  of reducing every background grab to a generic automation message.

## [2.0.34-rc.8] - 2026-08-03

### Fixed

- Fresh native engine grabs now remain explicitly pending until their import
  event confirms whether they are new files or upgrades.
- Download Decision cards now expose their primary explanation and a clear
  evidence-expansion control in the collapsed mobile view.

## [2.0.34-rc.7] - 2026-08-03

### Added

- Added durable Download Decision Center evidence for native Movie Engine and
  Television Engine background grabs, including prior and incoming quality,
  custom-format scores, upgrade state, indexer, protocol, and release title.
- Added background operational polling so engine imports, failures, and
  external notification deliveries continue while the web app is closed.

### Changed

- Same-quality background upgrades now explain score improvements and identify
  Proper, Repack, and Rerip revisions when the engine reports that evidence.
- Missing prior-file evidence is explicitly reported instead of being guessed.

## [2.0.34-rc.6] - 2026-08-02

### Fixed

- Made Plex overlay height follow the text's actual rendered line count instead
  of reserving space for the configured maximum, keeping the editor, review,
  and applied Plex artwork geometry consistent.
- Changed multi-library Plex matching to review each real Plex item once and
  match it back to VynodeArr through exact external identifiers, avoiding
  repeated unmatched entries when several Plex libraries are selected.

## [2.0.34-rc.5] - 2026-08-02

### Fixed

- Made the reviewed Plex preview and uploaded Plex poster use the same raster
  rendering path so the approved composition is exactly what Plex receives.
- Preserved the original Plex poster beneath overlays instead of allowing the
  deployed SVG renderer to produce missing or black base artwork.
- Added production fonts to Docker and Unraid images so overlay text and rating
  symbols render correctly instead of appearing as boxes.

### Changed

- Poster styles now remember whether they were created for VynodeArr or Plex.
- Plex application only offers and accepts Plex-targeted styles, while Plex
  styles cannot be assigned to VynodeArr library cards.
- Selected VynodeArr status, availability, cutoff, and rating bubbles are now
  rendered directly into Plex artwork.

## [2.0.34-rc.4] - 2026-08-02

### Fixed

- Restored production dependencies in the Unraid container so Plex overlay
  previews can be rasterized and applied instead of failing to load `sharp`.

### Changed

- Reworked Plex match results into wide, searchable, scrollable rows with
  clearer match details, large selection targets, and responsive mobile layout.

## [2.0.34-rc.3] - 2026-08-02

### Fixed

- Improved Plex poster matching by hydrating external GUIDs omitted from library
  listings and recognizing legacy Plex TMDB, TVDB, and IMDb agent identifiers.
- Constrained Plex artwork comparisons to responsive 2:3 poster previews instead
  of allowing full-resolution artwork to expand across the page.

### Added

- Added individual, multi-select, and select-all-matched Plex poster application
  with typed batch confirmation and a separate rollback record per title.

## [2.0.34-rc.2] - 2026-08-02

### Added

- Added an administrator-only Plex connection for Poster Overlay Studio with
  encrypted token storage, server identity validation, and discovery of
  compatible movie and television libraries.
- Added external-ID-only Plex matching with matched, unmatched, and ambiguous
  review states plus side-by-side current-poster and rendered-overlay previews.

### Security

- Added the first controlled Plex artwork workflow: one title per operation,
  exact preview, typed confirmation, original-poster capture with SHA-256
  integrity verification, audited upload, and an immediate restore action.

## [2.0.34-rc.1] - 2026-08-02

### Added

- Added an administrator Engine Update Center that discovers official upstream
  releases, checks platform assets, version direction, engine health, storage,
  and recovery readiness, and prepares sanitized GitHub issue drafts.
- Added a backup-gated candidate workflow that pins reviewed movie and
  television engine versions, verifies VynodeArr, smoke-tests the complete
  container, and publishes an isolated candidate image without changing
  `latest`.

### Security

- Engine updates remain container-based and never replace live binaries in
  place. Candidate preparation requires fresh native engine backups and records
  the prior image for rollback.

## [2.0.33] - 2026-08-02

### Added

- Added the administrator Poster Overlay Studio with reusable text, shape, and
  media-icon layers, metadata variables, precise placement, resizing, adaptive
  contrast, reversible library assignments, and VynodeArr/Plex previews.
- Added movie-file, television season, next-episode, latest-episode, request,
  and calculated variables with AND/OR visibility rules.
- Added ranked conditional styles with independent colors, typography, shapes,
  opacity, spacing, icon appearance, and deterministic priority behavior.

### Fixed

- Ensured overlay previews and applied library artwork use the same variables,
  dimensions, conditions, shapes, icons, and metadata fallbacks.
- Made every Poster Overlay Studio settings column independently scrollable and
  kept all controls reachable without clipping behind the modal footer.
- Prevented one ranked sub-condition's formatting from overwriting another.

## [2.0.33-rc.15] - 2026-08-02

### Fixed

- Corrected the Poster Overlay Studio's second-column scroll ownership by
  allowing the open layer editor to retain its full content height instead of
  clipping controls inside a non-scrolling panel.
- Verified the correction in an authenticated browser session with a real
  885-pixel scroll range before release.

## [2.0.33-rc.14] - 2026-08-02

### Fixed

- Restored complete, independently scrollable Poster Overlay Studio settings
  columns so every layer and conditional-formatting control remains reachable.
- Isolated ranked sub-condition formatting by stable identifier and latest
  editor state, preventing one condition's colors or other appearance settings
  from overwriting another condition.

## [2.0.33-rc.13] - 2026-08-02

### Fixed

- Kept the Poster Overlay Studio settings columns inside the modal's actual
  workspace height instead of allowing the second column to clip under the
  footer.
- Added an independent, persistent scrollbar and bottom clearance so every
  selected-layer setting remains reachable on desktop.

## [2.0.33-rc.12] - 2026-08-02

### Fixed

- Restored latest-episode and next-episode overlay variables when the
  television gateway returns episode metadata in a paged records response.
- Prevented transient episode-metadata failures from caching blank overlay
  values for ten minutes.

## [2.0.33-rc.11] - 2026-08-02

### Changed

- Gave every ranked poster overlay sub-condition its own complete formatting
  profile, while retaining optional inheritance from the main layer defaults.
- Added a one-click action to copy the complete default appearance into an
  individual sub-condition.

### Fixed

- Rebuilt sub-condition color selectors as full-size swatches with editable
  hexadecimal values so they no longer collapse into narrow vertical controls.

## [2.0.33-rc.10] - 2026-08-02

### Added

- Added an explicit main condition that determines whether a poster layer is
  shown, followed by ranked appearance sub-conditions.
- Added reorderable sub-conditions with highest-ranked or ranked-merge
  resolution and inherited overrides for colors, typography, shape, opacity,
  spacing, radius, icon sizing, and adaptive contrast.

### Fixed

- Restored access to every customization control by giving the desktop editor
  a definite workspace height for its independent scrolling columns.

## [2.0.33-rc.9] - 2026-08-02

### Fixed

- Made all three Poster Overlay Studio settings columns independently scroll
  within the editor's actual available workspace height.
- Corrected compressed layer-description and conditional-style text, spacing,
  fallback messaging, and action placement.

## [2.0.33-rc.8] - 2026-08-02

### Changed

- Rebuilt Poster Overlay Studio as a four-column desktop workspace for library
  and layer tools, selected-layer settings, conditions and style variants, and
  an always-visible live poster preview.
- Added responsive three-column, two-column, and mobile layouts while keeping
  desktop settings columns independently scrollable.

## [2.0.33-rc.7] - 2026-08-02

### Fixed

- Forced the Poster Overlay Studio condition workspace into its own desktop
  grid row so it no longer overlaps the poster preview or editor side rails.
- Restored normal stacked document flow at the responsive editor breakpoint.

## [2.0.33-rc.6] - 2026-08-02

### Fixed

- Expanded the Poster Overlay Studio condition and conditional-style workspace
  across the full editor grid so fields, labels, and actions no longer collapse
  or overlap beneath the narrow poster preview.
- Kept condition rules and style overrides responsive by stacking their controls
  cleanly on narrower desktop and mobile layouts.

## [2.0.33-rc.5] - 2026-08-02

### Added

- Added optional conditional style variants to poster layers. Independent
  AND/OR rule groups can change background, text and icon colors, shape, font
  weight, and adaptive contrast while retaining the base style as a fallback.
- Added first-match and ordered merge behavior when multiple style variants
  match the same title.

### Fixed

- Moved layer conditions beneath the centered poster preview and made their
  controls responsive so values are no longer clipped in the narrow inspector.
- Kept conditional appearance identical across the editor, application review,
  VynodeArr library cards, and composed poster artwork.

## [2.0.33-rc.4] - 2026-08-02

### Added

- Expanded poster overlays with file-derived video, audio, HDR, source,
  language, subtitle, bitrate, edition, release-group, custom-format, and score
  variables, including configurable television episode-file aggregation.
- Added television season, current-season progress, next-episode, and latest
  aired-episode variables with season and episode codes.
- Added a responsive multi-rule condition builder supporting AND/OR groups,
  presence, equality, containment, and numeric comparisons across any overlay
  variables.

### Fixed

- Kept editor, application-review, live-library, and composed SVG condition
  evaluation consistent while preserving existing single-condition styles.
- Corrected requester attribution matching for prefixed movie and television
  detail identifiers.

## [2.0.33-rc.3] - 2026-08-02

### Fixed

- Restored **New poster style** on Unraid and other plain-HTTP deployments by
  generating overlay layer IDs without requiring `crypto.randomUUID()`.

## [2.0.33-rc.2] - 2026-08-02

### Fixed

- Made the New poster style action an explicit non-submit button so embedded
  form behavior cannot prevent the Create Style editor from opening.

## [2.0.33-rc.1] - 2026-08-02

### Added

- Added the first safe Poster Overlay Studio phase for administrators, with
  reusable variable-driven layers, live previews, movie/television targeting,
  selected-title, saved Collection, user Collection, metadata-rule, and
  whole-library assignments, conditional and custom-text layers, real-library
  poster previews, style duplication, compact collapsible layer editing, clean
  action alignment, and responsive body-level modals without header cutoff.
  Layers can be dragged and resized directly on the poster or positioned with
  precise controls, with editable typography, alignment, colors, independent
  text and shape opacity, padding, and corner radius.
- Overlay editing now switches between an exact VynodeArr poster-card preview
  and clean Plex artwork, with optional per-style Plex badge choices.
- VynodeArr poster assignments now use a review-and-confirm step showing the
  resolved scope, sample titles, layer count, live-card behavior, and original
  artwork fallback before any assignment is written.
- Added authenticated server rendering, bounded caching, input sanitization,
  audit events, backup coverage, and automatic original-artwork fallback.
- Added independent text, icon, and shape layers with a media icon library,
  editable outer shapes, icon sizing and color, two-dimensional shape resizing,
  adjustable icon-to-text spacing, and variable placement inside or around
  artwork.
- Added variable-aware rendering so icon and shape layers are omitted when a
  selected title has no matching metadata, while intentional artwork-only
  layers remain supported.
- Added fixed, auto-shrinking, and multi-line wrapping modes for variable and
  custom text, including configurable line limits and matching preview and
  composed-artwork output.
- Added television overlay values for upcoming episode timing with a derived
  series-status fallback, plus resolution and requester-aware metadata.

### Security

- Restricted overlay configuration to administrators with CSRF protection and
  escaped all poster metadata before SVG rendering. Plex artwork remains
  unchanged until the later opt-in publishing phase.

## [2.0.32] - 2026-08-01

### Fixed

- Fixed the collection builder being shifted or clipped outside the viewport by
  moving it into the shared modal layer and removing conflicting positioning.
- Improved mobile Collections loading with a focused signed-in-user view,
  backward-compatible collection data handling, and bounded poster rendering.
- Fixed requested and manually saved titles failing to appear in user
  collections by using TMDB/TVDB identity first and normalized engine IDs as a
  fallback, including after a title is rematched or re-added.

## [2.0.31] - 2026-08-01

- Completed user collection ownership tools with add/remove controls and requester attribution on movie and television details, plus title search and Movies/Television filtering on Collections.
- Expanded user collections with private, household, and selected-user sharing; sortable shelves; availability and storage statistics; bulk search, monitoring, profile, and removal actions; request-to-import timelines; and JSON/CSV transfer.
- Added requester attribution to Queue, History, Wanted, and the Download Decision Center so administrators can follow ownership throughout the media lifecycle.

### Added

- Added native Pushover delivery with protected application and user keys,
  device targeting, all five priority levels, emergency retry and expiration,
  message TTL, custom sounds, visual templates, test and retry history, and
  optional Sonarr-compatible end-to-end title and message encryption.
- Added request-derived user collections for Movies and Television, an
  Everything/Collections/user selector, private self-service views for regular
  users, and an idempotent Add to my collection action for titles already in
  the library without starting another download.

## [2.0.30] - 2026-08-01

### Fixed

- User Requests and My Requests navigation counters now count only unread
  request updates and clear after the corresponding request page is reviewed,
  while retaining the complete request and notification history.

## [2.0.29] - 2026-08-01

### Added

- Added an administrator-only **System → Validation** center that checks media
  engine connectivity, root folders and free space, indexers, download clients,
  scheduled tasks, library synchronization, engine health, application data
  stores, credential encryption, and external notification configuration.
- Validation runs automatically after application startup, including the first
  start following an update or application restore, and can be rerun on demand.
- Added guided recovery links to the existing specialized settings pages plus
  guarded one-click re-synchronization and installation-managed connection
  repair.
- Added an administrator **Download Decision Center** that retains candidate
  evidence from interactive searches and VynodeArr automatic selection,
  showing native rejection reasons alongside quality, custom-format score,
  preferred-word score, size, age, seeders, and upgrade eligibility.

## [2.0.28] - 2026-08-01

### Added

- Added password-encrypted VynodeArr application backups under **System →
  Backups** for users and permissions, application settings, collections,
  requests, notification channels and templates, credentials, and the
  application-managed encryption key. Search Activity and administrator audit
  history can be included or omitted.
- Added guarded application recovery with archive inspection, a contents and
  compatibility preview, exact confirmation, and an automatic encrypted
  pre-restore safety backup.

### Changed

- Clarified that native Movies and Television engine backups are independent
  from the portable VynodeArr application archive.

## [2.0.27] - 2026-08-01

### Added

- Added a visual notification-template builder for Discord, Telegram, and
  Gotify with friendly title and message fields, reusable event tokens, and a
  live provider preview.
- Added optional provider-specific JSON payloads with validation, bounded
  recursive token rendering, protected credential fields, Discord accent
  colors, and Gotify priority controls.
- Added explicit individual and bulk mark-read actions to the notification
  center and administrator request-management page.
- Added Search Activity and durable grabbed notifications for releases selected
  through Movie interactive search.

### Changed

- External notification templates use a responsive desktop dialog and mobile
  bottom sheet with sticky actions, internal scrolling, safe-area padding, and
  previews that remain fully inside the phone viewport.
- Telegram custom payloads always retain the securely configured chat ID, while
  Discord's standard payload uses a color-accented embed.
- Notification read state synchronizes between the notification bell and user
  request-management surfaces without removing notification history.

### Fixed

- Fixed manually grabbed Movie releases failing to appear in Search Activity or
  produce a notification before Queue and History reconciliation.
- Fixed Movie rename previews omitting the file when the folder must be renamed
  first. The file now remains selected and is recalculated with the active
  naming format immediately after the folder move.
- Fixed the desktop notification settings drawer allowing channel forms and
  long delivery history to create horizontal scrolling and clipped controls.
- Fixed the mobile template preview inheriting the navigation sidebar width and
  slide transform, which could move the preview outside the modal.
- Fixed a Gotify priority of zero being replaced by the default priority.

## [2.0.26] - 2026-08-01

### Added

- Added a durable notification Inbox and History with categorized request,
  download, import, health, security, and automatic-search events.
- Added administrator operational alerts for stalled or failed Queue items,
  import successes and failures, engine health issues, and automatic searches
  that finish without finding a download.
- Added per-user category filters, severity thresholds, in-app delivery controls,
  UTC quiet hours, administrator defaults, and a test-notification action.
- Added encrypted external notification delivery for Discord webhooks, Telegram,
  and Gotify, including per-category routing, masked credentials, delivery
  history, provider error details, and manual retry.

### Changed

- Operational alerts are deduplicated and resolve in place when the underlying
  Queue, health, or search condition clears.
- Notification provider failures are isolated from media requests and in-app
  activity so an unavailable external service cannot interrupt VynodeArr.
- The notification settings experience uses compact, touch-friendly layouts on
  phones while preserving every desktop control.

### Fixed

- Fixed the notification panel being positioned outside the phone viewport when
  rendered inside the sticky, blurred application header.
- Fixed the document-level mobile panel losing its desktop bell alignment by
  giving desktop and mobile layouts explicit viewport anchors.

## [2.0.25] - 2026-08-01

### Changed

- Search Activity now reconciles matching Movie and Television Queue and History
  records, advancing through grabbed, downloading, waiting for import, and
  imported states using authoritative engine data.
- Completed search commands remain eligible for Queue and History reconciliation
  for seven days so delayed grabs and imports continue updating.
- Administrator Search Activity includes automatic searches initiated through
  user Discover requests as well as searches started directly by an
  administrator.

### Fixed

- Fixed Search Activity stopping after a download instead of advancing when the
  media engine confirmed the library import.
- Fixed administrator request notifications disappearing after approval or
  rejection; they now remain as durable decision history.
- Fixed read notifications becoming difficult to see on phone-sized displays.
- Kept the User Requests sidebar badge limited to requests that still require an
  administrator decision, rather than counting retained notification history.

## [2.0.24] - 2026-08-01

### Added

- Added a persistent administrator Search Activity center inside the global
  notification bell for Movie and Television automatic searches.
- Added real search-stage visibility for queued, searching, grabbed,
  downloading, imported, completed, failed, and cancelled activity.
- Added poster-rich activity cards with direct links to Queue and the relevant
  Movie or Television title.
- Added live progress and failure counts for bulk Wanted searches.
- Added native automatic season search to each Television season management
  menu.

### Changed

- New Movie and Television additions now preserve their native immediate-search
  options when sent to the media engines.
- Search Activity is stored per administrator, survives application restarts,
  and reconciles native engine command status without simulated timers.
- The activity panel uses a compact bottom sheet on phone-sized displays while
  preserving the complete stage timeline and actions.

### Fixed

- Fixed Television additions losing monitor scope or cutoff-search options as
  they passed through Discover, direct Add Media, or request approval.
- Fixed automatic searches started from whole-show, season, episode, Wanted,
  bulk-missing, and new-library workflows not having one visible activity
  history.

## [2.0.23] - 2026-08-01

### Changed

- Refined phone-sized movie and television detail headers with correctly aligned
  artwork and copy, an unclipped horizontally scrollable action rail, and no
  horizontal page overflow.
- Reworked mobile television seasons so season management and episode actions
  expand only when requested while availability, monitoring, quality, and
  progress remain visible.
- Replaced changing title backdrops on Discover studio and network cards with
  official TMDB brand logos and safe branded fallbacks.
- Added stable custom artwork, symbols, and color treatments for Discover genre
  cards instead of borrowing artwork from currently popular titles.

### Fixed

- Prevented the floating detail Back control from narrowing and breaking the
  mobile title layout.
- Removed the nested phone scroll region from television seasons so the page
  scroll remains predictable.
- Invalidated old cached Discover taxonomy artwork so the new studio and network
  logos appear immediately after upgrading.

## [2.0.22] - 2026-07-31

### Added

- Added a dedicated administrator Import Lists subpage for Movies and
  Television with native provider selection, create, edit, enable/disable,
  connection testing, deletion, manual synchronization, advanced fields, and
  complete engine configuration access.

### Changed

- Import-list health warnings now lead directly to Import Lists instead of the
  general Advanced settings page.

## [2.0.21] - 2026-07-31

### Added

- Added an administrator-only Library Health overview for missing or duplicate
  external identities, incomplete metadata or artwork, invalid library folders,
  missing monitored media, disabled monitoring, and unmet quality cutoffs.
- Added finding-specific actions that lead administrators to the existing title
  details, Wanted, or Root Folders workflow without silently changing files or
  starting downloads.

### Changed

- Moved Library Health to its own Service Settings subpage so the existing Media
  Management naming, auditing, importing, and file-handling controls remain
  immediately accessible.
- Discover library-presence checks now use authoritative TMDB, TVDB, and IMDb
  identities before falling back to normalized title and year matching.
- Discover access can determine that a title is already managed without exposing
  library details the user is not permitted to view.
- Library diagnostics load independently from native media-management settings,
  allowing health findings to remain available when an engine does not expose
  that settings resource.

### Fixed

- Fixed existing movies or series with alternate, localized, or changed titles
  appearing available to request in Discover.
- Fixed duplicate Discover submissions reaching an engine when the title text
  differed but the authoritative external identity already existed.
- Fixed Library Health remaining stuck on an inspection message when diagnostics
  or engine management settings were unavailable.

## [2.0.20] - 2026-07-31

### Added

- Added an accessible mobile navigation drawer with a backdrop, outside-click
  and Escape closing, focus containment, and accurate expanded-state labels.
- Added safe-area support for notched phones and devices with home indicators.
- Calendar dates now expose complete accessible labels including the date and
  number of scheduled items.

### Changed

- Account, Service Settings, and System navigation now becomes a visible
  two-column control on phones instead of hiding destinations in a long tab
  scroller.
- Mobile library filters, sorting, view controls, poster actions, queue cards,
  media details, forms, and modal actions now use touch-friendly sizing and
  compact responsive layouts without removing capabilities or information.
- The mobile Calendar now shows the complete month without horizontal
  scrolling, using compact date cells, event counts, Movie/TV activity dots,
  segmented filters, and a poster-rich selected-day agenda.
- History now includes a media-library selector so long activity timelines can
  be narrowed to Movies or Television without losing the combined view.
- Long mobile dialogs use bounded scrolling and sticky action footers.

### Fixed

- Fixed undersized mobile menu, notification, poster-action, sort, checkbox,
  and queue-selection targets.
- Fixed hidden mobile section destinations and page-level horizontal overflow
  across administrative and user-facing routes.
- Fixed the Calendar selected-day agenda being treated as the mobile navigation
  sidebar and shifted off-screen.
- Fixed mobile media-detail modals escaping the viewport, stretched request and
  Wanted posters, crowded library-card actions, and non-scrollable navigation.
- Fixed mobile page-heading letter collisions and aligned request-status card
  numbers and labels into consistent rows.

## [2.0.19] - 2026-07-30

### Added

- Added a global notification bell with a live unread count and request
  activity available from every authenticated page.
- Administrators receive notifications for requests awaiting approval.
- Users receive notifications when requests are approved, declined, fail, or
  finish importing.
- Notification items link directly to **User Requests** or **My Requests** and
  can be marked read individually or with **Mark all read**.
- Added synchronized sidebar badges: administrators see the live
  awaiting-approval total beside **User Requests**, and users see unread request
  updates beside **My Requests**.

### Changed

- Notification read state is stored per account and persists across
  application restarts.
- Notification activity refreshes automatically every 15 seconds.

### Fixed

- The notification panel remains scrollable and viewport-contained on desktop
  and mobile layouts.

## [2.0.18] - 2026-07-30

### Changed

- User-cancelled requests now have a distinct **Cancelled by user** status in
  personal and administrator request history.
- The administrator request-history status filter now includes user
  cancellations.
- Existing self-cancelled request records are recognized without requiring a
  data migration.

### Fixed

- Request-limit denials remain visible inside the Discover request modal
  instead of appearing only as a temporary notification.
- Cancelling a request immediately removes it from period allowance usage, so
  the user can submit another request when the cancellation brings them below
  their configured threshold.

## [2.0.17] - 2026-07-30

### Added

- Administrators can require approval for Discover requests independently for
  each User account.
- Added an administrator-only **User Requests** page with per-user history,
  approval filters, and controls to approve and add or decline pending titles.
- User and administrator request cards now include posters, overviews, ratings,
  genres, runtime, certification, and authoritative TMDB/TVDB identifiers.
- Added request search plus user, status, and media-type filters for
  administrators.
- Added optional per-user daily, weekly, or monthly request allowances,
  separate Movie and TV limits, and a maximum-pending-request limit.
- Discover and **My Requests** now show each user their remaining request
  allowance.
- Added an administrator-only **System Audit** view with search, category, and
  administrator filters.
- Audit history now covers request decisions and limit blocks, accounts,
  access, configuration, engines, backups, security, jobs, collections, media,
  synchronization, exports, and guide-template operations.

### Changed

- Approval-required requests remain in VynodeArr and are not submitted to the
  Movie or TV engine until an administrator approves them.
- Existing User accounts retain automatic request approval by default.
- Existing request history is enriched with TMDB presentation metadata when it
  is first viewed and metadata is available.
- Users can correct or cancel their own request while it is awaiting approval.
- Declining a request now requires a reason that is retained and shown in both
  administrator and user request history.
- Request-limit settings can be updated, disabled, or left unlimited from the
  existing User account editor; administrator accounts remain unlimited.

### Fixed

- Request-decline and User account dialogs remain scrollable and contained on
  short or narrow viewports.

### Security

- Approval and rejection require administrator access and CSRF validation.
- Approval revalidates the stored external identity, current root folder, and
  quality profile before adding the title to an engine.
- Atomic approval claiming prevents concurrent administrators from adding the
  same request more than once.
- Request allowances are enforced by the server before a request reaches an
  engine, and blocked attempts are recorded in the audit log.

## [2.0.16] - 2026-07-30

### Added

- Added a dedicated, permission-aware **My Requests** page for users with
  Discover access.
- Requests now retain durable user ownership while their requested, searching,
  downloading, imported, failed, and rejected states are derived from the live
  Movie and TV engines.
- Users can correct their own pending movie or television match by selecting an
  authoritative TMDB ID, or cancel an eligible request before downloading or
  importing begins.

### Security

- Request correction and cancellation validate ownership, CSRF protection, and
  live engine eligibility on the server.
- User-visible failures are translated into actionable explanations without
  exposing download-client, indexer, path, host, or credential details.

### Fixed

- Active queue state now takes precedence over older failed history events so a
  recovering request correctly appears as downloading.

## [2.0.15] - 2026-07-29

### Fixed

- Fix Match no longer renders wider than its parent movie or television detail
  modal.
- Discover request correction now uses a narrower purpose-sized dialog, and
  its search controls, result cards, metadata, and selection buttons remain
  inside the modal without horizontal overflow.
- Nested detail dialogs now use a shared centered viewport layer and calculate
  their padding and borders inside the available width.
- Nested dialogs remain fully contained on smaller screens without changing
  their existing search, selection, editing, or file-management workflows.

### Documentation

- Updated the current-release overview with the nested-modal containment and
  responsive-layout changes.

## [2.0.14] - 2026-07-29

### Added

- Added live Queue summary cards that separately report the total items from
  the Movie engine and TV engine.
- Discover-enabled users can correct a movie request before submission by
  searching TMDB, reviewing the year and metadata, and selecting the intended
  TMDB ID.
- Added typed React ownership for Discover details and requests, background
  import creation and monitoring, and library-import review and analysis.

### Changed

- Discover requests now resolve engine records using authoritative TMDB and
  TVDB identifiers instead of title text or search-result order.
- Movie and television match correction now applies only an exact external-ID
  result and stops safely when the engine cannot resolve that identity.
- Discover request review displays the authoritative TMDB and TVDB identifiers
  before a title is sent to an engine.
- Queue totals continue to show complete live engine counts while users filter
  the queue table.
- Root-folder import review now uses typed, bounded background analysis without
  changing the existing import choices or workflows.

### Fixed

- Create User and Edit Access dialogs now render through the shared modal
  portal so their headers and controls are not hidden beneath the application
  search bar.
- Ambiguous titles, including regional series with similar names, can no longer
  be added or rematched merely because a title string or first search result
  appears similar.
- Correcting a Discover movie request updates the pending-library state for the
  movie actually selected instead of the original search result.

### Security

- The server re-fetches Discover metadata and verifies submitted engine payload
  identifiers before creating a movie or television request.
- Discover movie correction remains limited to the pending request workflow;
  it does not grant User accounts permission to modify existing library items.

### Documentation

- Updated the current-release overview for identifier-safe requests, request
  correction, queue counts, and the continued React and TypeScript migration.

## [2.0.13] - 2026-07-28

### Fixed

- Calendar-enabled User accounts no longer receive an administrator-access
  error when opening Calendar.
- Calendar month and Movies/Television filters now use the permission-aware
  Calendar API instead of administrator-only engine-management routes.
- Calendar results retain normalized engine identities, artwork references,
  and television episode context when loaded for a selected month.

### Security

- Regular users continue to receive only the Calendar capability explicitly
  granted by an administrator; generic engine-management routes remain
  administrator-only.

### Documentation

- Documented that independently granted Calendar access works for User
  accounts without granting engine-administration access.

## [2.0.12] - 2026-07-28

### Added

- Added an administrator-managed **User** role with independent access choices
  for Dashboard, Discover, Movies, TV, and Calendar.
- Added clear page-access controls when creating a user and when editing an
  existing user's access.
- Discover-enabled users can browse and request movies or series through a
  narrowly scoped engine request workflow.

### Changed

- Dashboard, Movies, TV, and Calendar are read-only for User accounts.
- Navigation hides unavailable pages, direct links return users to their first
  permitted page, and sign-in opens the first page the account may access.
- Existing legacy Viewer accounts migrate to User accounts with all five
  supported pages enabled to preserve prior access.
- User permission changes are enforced immediately for existing sessions.

### Security

- Added server-side permission checks for page APIs, artwork, live library
  updates, activity, collections, engine settings, and system information.
- Live library events are filtered so users receive updates only for movie or
  television libraries they may view.
- Discover requests validate the selected root folder and quality profile
  against the connected engine before adding a title.
- Administrative background library imports remain administrator-only and are
  not implied by Discover access.

### Documentation

- Documented the User role, configurable page access, view-only library
  behavior, and Discover request capability.

## [2.0.11] - 2026-07-28

### Added

- Generate a cryptographically random credential-encryption master key on
  first run when no environment-managed key is supplied, and retain it in the
  persistent VynodeArr configuration directory.
- Added **System → Security** for administrators to review master-key
  management and safely rotate app-managed keys without changing movie- or
  television-engine API keys.
- Added administrator controls on the Media Engines page to require or relax
  API-key authentication independently for the movie and television engines,
  with a warning explaining Docker-network exposure.

### Security

- Removed the fixed development master key fallback.
- Existing vaults created with the former fallback are migrated once and
  re-encrypted with a unique persisted key.
- Master-key rotation uses a recoverable pending key so interrupted rotations
  can complete safely on the next startup.
- New bundled installations require engine authentication from every address.
  Existing bundled installations are moved to this secure default once on
  upgrade while retaining an explicit per-engine opt-out.
- Local Compose installations now generate independent random movie- and
  television-engine API keys, persist them beside each engine configuration,
  and make VynodeArr read the same files. Existing engine keys are retained
  during upgrades.

### Documentation

- Added prominent Radarr and Sonarr attribution to the README and Unraid
  installation metadata.
- Clarified that the Apache 2.0 badge covers VynodeArr code only and that the
  bundled Radarr and Sonarr binaries retain their GPLv3 licenses, copyrights,
  and corresponding-source links.

## [2.0.10] - 2026-07-27

### Fixed

- Moved secondary movie and television dialogs into a shared viewport-level
  modal layer so Fix Match, interactive search, rename previews, library
  editors, and file selection cannot be clipped by their parent detail modal.
- Bounded nested dialogs to the visible viewport with independent scrolling
  while preserving the underlying detail dialog and its navigation state.

## [2.0.9] - 2026-07-27

### Added

- Added independent interface-style choices for Glass, Solid, OLED, and High
  Contrast alongside the existing color themes.
- Added comfortable and compact interface density preferences plus system,
  reduced, and full motion settings.
- Added a shared presentation foundation for page backgrounds, cards,
  controls, dialogs, borders, scrollbars, and focus states.

### Changed

- Standardized page heroes, navigation, panels, forms, buttons, dropdowns,
  cards, and modal surfaces across React and legacy-backed routes.
- Refined Movies and TV information cards, compact grids, and detailed lists
  with consistent themed surfaces, tighter spacing, aligned 32-pixel actions,
  bounded summaries, and predictable title handling.
- Improved activity-history spacing and responsive layout so labels, badges,
  timestamps, and actions remain separated at narrower widths.
- Account presentation preferences are now validated and persisted per user.

### Fixed

- Preserved the originating page position whenever a modal is opened and
  closed, while avoiding stale restoration after intentional navigation.
- Constrained short dialogs to the center of the visible viewport and long
  dialogs to an internally scrollable viewport-safe area.
- Prevented information-card summaries from being partially clipped behind
  their actions.
- Prevented compact-grid movie and television titles from breaking inside
  words when status badges reduce the available heading width.
- Corrected detailed-list card structure, metadata alignment, action sizing,
  and theme-inconsistent card backgrounds.
- Corrected Discover modal positioning and several overlapping or
  edge-crowded controls across the updated routes.

## [2.0.8] - 2026-07-27

### Added

- Added engine-backed Movies and TV library sorting by title, year, release or
  first-air date, rating, content rating, duration, date added, library size,
  availability or episode completion, attention, and random order.
- Added ascending and descending direction controls plus an explicit reshuffle
  action for random ordering.

### Changed

- Library sort choices and direction now persist independently for Movies and
  TV.
- Title sorting and the alphabet rail now use the engines' sort titles so
  leading articles such as "The" are handled consistently.
- Unavailable metadata is kept at the end of sorted results in both
  directions.
- Expanded the normalized movie and television summaries with the reliable
  engine fields required by library sorting.

## [2.0.7] - 2026-07-26

### Fixed

- Prevented horizontal page jitter in Edge when navigating between short
  loading states and tall settings pages such as Engines.

## [2.0.6] - 2026-07-26

### Changed

- Moved application route dispatch and mounted-library reuse decisions into a
  typed resolver while preserving every React route and legacy fallback.
- Moved hash navigation, Discover detail events, link-hover preloading, and
  idle route preloading into a typed navigation lifecycle controller.
- Centralized Account Settings section normalization and React host creation in
  typed helpers, including administrator-only user-management routing.
- Moved Guide Templates domain and resource-filter routing into a typed parser
  so filtered Movies and TV entry points share one validated contract.
- Moved Service Settings page selection into a typed resolver while preserving
  administrator access checks, React mounts, and legacy fallbacks.
- Moved the legacy Movies and TV fallback's title filtering, advanced filters,
  initial-letter selection, and sorting into a typed pure helper.

## [2.0.5] - 2026-07-26

### Changed

- Stable JavaScript and CSS entry files now revalidate on every application
  load while content-hashed chunks retain long-lived immutable caching.
- Migrated administrator engine management from JavaScript-rendered markup to a
  lazy-loaded React and TypeScript route while retaining the legacy fallback.
- Migrated encrypted Discover token configuration to a typed React route with
  test, save, remove, and status parity.
- Migrated movie and television quality-profile and quality-size editing to a
  typed React route while retaining the legacy fallback.
- Migrated the first-run movie and television engine connection wizard to the
  shared typed React validation workflow with a legacy fallback.
- Migrated first-administrator setup and sign-in to a typed React
  authentication shell while retaining the static HTML fallback.
- Centralized hash parsing and mounted-library route classification in a typed
  route table while retaining the existing page handlers and redirects.
- Moved dashboard loading, session caching, background refresh, and stale-data
  feedback into the typed React route while retaining the legacy fallback.
- Moved initial Movies and TV library loading into the typed React route,
  removing a duplicate blocking shell request while preserving synchronized
  shell state, live engine events, and the legacy fallback.
- Moved initial activity-history loading and refresh error recovery into typed
  React while preserving administrator-only organize actions and the legacy
  history fallback.
- Centralized React route teardown, modal cleanup, and navigation activation in
  a typed lifecycle helper, including explicit Discover and Guide Templates
  cleanup.
- Centralized React page and detail-modal host creation in a typed route helper
  so route transitions use one consistent DOM mounting boundary.
- Moved shared API requests, CSRF headers, search cancellation, short-lived
  response caching, request deduplication, and mutation invalidation into a
  typed client while preserving session-timeout recovery.
- Corrected the release-profile editor to use a centered, bounded glass modal
  with aligned sticky controls and no delete action for unsaved profiles.
- Moved application-state initialization, persisted library-view selection, and
  shared legacy formatting and form helpers into typed modules.
- New release profiles now remain local drafts until Save is selected; closing
  the editor discards an unsaved draft instead of leaving it in the profile list.
- Moved session bootstrap, setup/login view activation, authenticated-shell
  routing, and engine-setup redirection into a typed lifecycle controller.
- Moved global notifications, account identity presentation, logout, mobile
  navigation, library search, and unsaved-change protection into a typed shell
  controller.
- Centralized Account Settings navigation for the account, session, engine, and
  user-administration routes.

## [2.0.4] - 2026-07-26

### Added

- Durable, revision-specific TRaSH custom-format indexes for Movies and TV.
- Documentation for restoring existing movie- and TV-engine backups through
  VynodeArr.
- Automated coverage for static compression, template index recovery, shared
  settings navigation, and administrator access to engine key management.

### Changed

- Static assets now use validation, safe cache headers, and gzip compression.
- Service Settings React routes now share one complete navigation component.
- Guide-template catalog indexing reuses validated local data and rebuilds
  corrupt or outdated indexes.

### Fixed

- Restored the administrator **Engines** tab under Account Settings.
- Preserved access to reveal, copy, and regenerate installation-managed movie
  and TV engine API keys.
- Corrected several damaged interface characters in the legacy application
  shell.

## [2.0.3] - 2026-07-26

### Added

- Reviewed TRaSH Guide custom-format workflows for Movies and TV.
- Engine-native template comparison, customization, overwrite confirmation,
  and naming-token assistance.

[Unreleased]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.35-rc.23...HEAD
[2.0.35-rc.23]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.35-rc.22...v2.0.35-rc.23
[2.0.35-rc.22]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.35-rc.21...v2.0.35-rc.22
[2.0.35-rc.21]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.35-rc.20...v2.0.35-rc.21
[2.0.35-rc.20]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.35...v2.0.35-rc.20
[2.0.35]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.35-rc.8...v2.0.35
[2.0.35-rc.8]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.35-rc.7...v2.0.35-rc.8
[2.0.35-rc.7]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.35-rc.6...v2.0.35-rc.7
[2.0.34-rc.6]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.34-rc.5...v2.0.34-rc.6
[2.0.34-rc.5]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.34-rc.4...v2.0.34-rc.5
[2.0.34-rc.4]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.34-rc.3...v2.0.34-rc.4
[2.0.34-rc.3]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.34-rc.2...v2.0.34-rc.3
[2.0.34-rc.2]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.34-rc.1...v2.0.34-rc.2
[2.0.34-rc.1]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.33...v2.0.34-rc.1
[2.0.33]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.32...v2.0.33
[2.0.33-rc.5]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.33-rc.4...v2.0.33-rc.5
[2.0.33-rc.4]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.33-rc.3...v2.0.33-rc.4
[2.0.33-rc.3]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.33-rc.2...v2.0.33-rc.3
[2.0.33-rc.2]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.33-rc.1...v2.0.33-rc.2
[2.0.33-rc.1]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.32...v2.0.33-rc.1
[2.0.31]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.30...v2.0.31
[2.0.30]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.29...v2.0.30
[2.0.29]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.28...v2.0.29
[2.0.28]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.27...v2.0.28
[2.0.27]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.26...v2.0.27
[2.0.26]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.25...v2.0.26
[2.0.25]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.24...v2.0.25
[2.0.24]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.23...v2.0.24
[2.0.23]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.22...v2.0.23
[2.0.22]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.21...v2.0.22
[2.0.21]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.20...v2.0.21
[2.0.20]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.19...v2.0.20
[2.0.19]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.18...v2.0.19
[2.0.18]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.17...v2.0.18
[2.0.17]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.16...v2.0.17
[2.0.16]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.15...v2.0.16
[2.0.15]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.14...v2.0.15
[2.0.14]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.13...v2.0.14
[2.0.13]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.12...v2.0.13
[2.0.12]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.11...v2.0.12
[2.0.11]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.10...v2.0.11
[2.0.10]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.9...v2.0.10
[2.0.9]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.8...v2.0.9
[2.0.8]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.7...v2.0.8
[2.0.7]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.6...v2.0.7
[2.0.6]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.5...v2.0.6
[2.0.5]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.2...v2.0.3
