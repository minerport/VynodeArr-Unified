# Changelog

All notable VynodeArr changes will be recorded in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.50-rc.6] - 2026-08-16

### Fixed

- Replaced an already-applied style with its edited draft in the exact library
  preview instead of stacking the new layers over the style's previous version.
- Preserved layers from other active assignments when editing one style within a
  composite VynodeArr overlay.

### Validation

- Passed the focused React modernization suite, web TypeScript checks, and the
  production web build before publication.

## [2.0.50-rc.5] - 2026-08-16

### Fixed

- Restored the Templates and Assignments workspaces to the full available page
  width instead of allowing the generic studio layout to constrain them to one
  half-width column.

### Validation

- Passed the focused React modernization suite, web TypeScript checks, and the
  production web build before publication.

## [2.0.50-rc.4] - 2026-08-16

### Fixed

- Matched the poster-style editor's Poster grid preview to the production Movies
  and TV card hierarchy so the duplicate lower details body is no longer shown.

### Validation

- Passed the focused React modernization suite, web TypeScript checks, and the
  production web build before publication.

## [2.0.50-rc.3] - 2026-08-16

### Fixed

- Prevented the exact library card preview in the poster style editor from
  collapsing into a clipped strip when the preview column contains more content
  than fits in the editor viewport.

### Validation

- Passed the focused React modernization suite, web TypeScript checks, and the
  production web build before publication.

## [2.0.50-rc.2] - 2026-08-16

### Changed

- Reworked overlay assignment review to use the same production library cards
  shown on the Movies and TV pages instead of an approximate poster mockup.
- Added Poster grid, Cards, Compact, and List preview toggles so users can inspect
  the proposed overlay in each supported VynodeArr library view.
- Kept drag, resize, grid, snapping, and safe-area tools available in a separate
  Edit placement view without changing overlay behavior or saved designs.

### Fixed

- Combined the selected title's current artwork, metadata, existing overlays,
  and unsaved draft changes so assignment review accurately shows the result
  users will receive before applying it.
- Corrected assignment review sizing and layout so previews match normal library
  poster proportions instead of rendering as a cramped comparison panel.

### Validation

- Passed web TypeScript checks, 300 automated tests, and the
  production web build before publication.

## [2.0.50-rc.1] - 2026-08-16

### Added

- Added a canonical Plex artwork ledger that preserves the true original poster
  while tracking every VynodeArr and list overlay applied afterward.
- Added exact current and proposed poster previews during assignment review,
  including existing overlays from other assignments and list automation.
- Added concise Plex artwork history entries that identify overlay sources and
  support safe removal, restoration, and recomposition.

### Changed

- Condensed the overlay template library into compact cards with larger,
  library-sized preview posters and smaller action controls.
- Updated assignment review to evaluate current metadata and show each affected
  library view before an overlay is applied.

### Fixed

- Preserved the original Plex poster when multiple regular or list overlays are
  applied, removed, reordered, or reapplied.
- Prevented removing one overlay from discarding other active overlays or
  restoring an intermediate composited poster as the original.

### Validation

- Passed all 298 automated tests, web TypeScript checks, and production web
  builds before publication.

## [2.0.49] - 2026-08-16

### Changed

- Consolidated repeated React route loading and error presentation into shared
  typed components used throughout the application.
- Standardized client error normalization while preserving every existing
  operation, fallback message, and user-facing workflow.

### Validation

- Passed all 298 automated tests, web and server TypeScript checks, production
  builds, bundle budgets, branding checks, and deployment validation.

## [2.0.48] - 2026-08-16

### Added

- Added clear, timestamped Docker and Unraid logs for application startup and
  shutdown, bundled-engine processes, catalog synchronization, and engine
  connection state.
- Added per-domain and per-instance VynodeArr activity logs for external Radarr
  and Sonarr connections without ingesting their independent application logs.
- Added configurable `error`, `warn`, `info`, and `debug` log levels plus
  readable or JSON output in Docker and the Unraid template.

### Security

- Redacted credentials, API keys, authorization values, tokens, cookies,
  passwords, and secrets from log metadata and error messages.

### Fixed

- Corrected stable container version metadata so the Updates screen and startup
  logs report the release tag instead of the legacy `2.0.3` image default.

## [2.0.47] - 2026-08-15

### Added

- Completed the Overlay Studio with managed image assets, reusable linked
  components, scoped instance overrides, row and column group layouts,
  portable poster packs, import conflict review, template validation, and a
  four-title real-media preview matrix.
- Added precision canvas controls with zoom, grid and safe-area guides,
  configurable snapping, keyboard nudging, multi-layer alignment, grouping,
  responsive editing, and accessible keyboard selection.
- Added exact before-and-after assignment review, affected-title diagnostics,
  safe retry feedback, and explicit rollback confirmation.
- Added independent built-in or external source selection for Movies and
  Television, including mixed-source status and per-domain restart handling.

### Changed

- External engine settings now migrate from the previous global mode to
  per-domain modes without requiring users to recreate saved connections.
- Bundled engine startup, credential repair, authentication defaults, root
  folders, webhooks, download-path mappings, and multi-instance routing now
  operate only for the applicable movie or television domain.
- Expanded overlay effects, metadata expressions, missing-value behavior,
  variants, accessibility checks, application review, and mobile layouts while
  retaining existing templates and assignments.

### Fixed

- Prevented configuring an external Movies engine from stopping the bundled
  Television engine, and vice versa.
- Made large Radarr library validation use a bounded larger response and ignore
  isolated malformed movie records instead of rejecting an otherwise valid
  connection.
- Removed the 10,000-title external-engine validation ceiling and the 5,000-title
  synchronization ceiling so complete movie and television catalogs are retained
  across single or multiple engine instances.
- Preserved component synchronization and managed-image references across
  poster-pack export and import, including rollback of partially uploaded
  assets when an import fails.

## [2.0.47-rc.1] - 2026-08-15

### Changed

- Extended overlay layer multi-selection to the poster preview: Ctrl/Cmd-click
  or Shift-click preview items to select several layers, with every selected
  item receiving the same visible selection treatment as the layer list.
- Clarified that layers can be selected from either the left layer list or the
  poster preview and prevented accidental browser text selection on layer
  controls.
- Condensed layer inspector spacing across content, placement, appearance, and
  typography controls while retaining readable labels and usable control sizes.

## [2.0.46] - 2026-08-15

### Added

- Added reusable overlay layouts, import and export tools, design validation,
  undo and redo history, keyboard movement, and impact review before applying
  a style.
- Added endpoint-level connection diagnostics for external Radarr and Sonarr
  instances covering library, queue, calendar, and health capabilities.

### Changed

- Expanded the overlay editor with reusable shape layouts, safer bounded
  controls, clearer condition feedback, and compact editing tools without
  removing existing layer, typography, condition, or assignment capabilities.
- Renaming a saved overlay style now updates its generated assignment labels
  while preserving deliberately customized assignment names.

### Fixed

- External engine setup now identifies the exact Radarr or Sonarr capability
  that returned an unsupported response instead of reporting only a generic
  connection failure.
- Corrected overlay design state handling, conditional typography guidance,
  layer editing behavior, and assignment previews.

## [2.0.45] - 2026-08-15

### Added

- Added a guided Overlays workspace with reusable polished quick items,
  assignments, Plex artwork operations, and direct global navigation.
- Added separate list artwork designs for collection posters, trailer
  placeholders, existing real titles, and titles downloaded after initially
  appearing as placeholders.

### Changed

- Reorganized Lists so imported titles are the primary view while Plex sync,
  trailers, collections, destinations, schedules, and artwork live in a
  focused automation workspace.
- Simplified list imports and destination setup for movie-only, television-only,
  and mixed-media lists while retaining independent Plex, host, and engine
  paths and optional placeholder libraries.
- Refined Dashboard, Movies, Television, Setup Overview, and overlay editing
  layouts across desktop and mobile without removing existing capabilities.

### Fixed

- Corrected list destination validation, linked-folder reuse, collection poster
  restoration, title artwork restoration, and lifecycle overlay application.
- Prevented unchecked destinations from becoming defaults and allowed separate
  placeholder libraries to use independently mapped host folders.
- Fixed manual Plex matching recursion, overlay item sizing and direct resizing,
  setup navigation links, and compact mobile library controls.

## [2.0.45-rc.8] - 2026-08-15

### Added

- Added separate list artwork designs for collection posters, trailer
  placeholders, real titles already in the library, and titles downloaded
  after first appearing as placeholders.
- Persisted each managed title's artwork lifecycle so later list syncs apply
  the correct overlay as media becomes available.

### Changed

- Kept existing list overlay settings backward compatible while allowing each
  real-title lifecycle state to use its own design.
- Restoring list title artwork now clears every managed title-overlay role and
  restores the original Plex posters.

## [2.0.45-rc.7] - 2026-08-15

### Changed

- Simplified Reeltrack list imports so they create a draft first and show only
  the movie and television destination settings required by the imported list.
- Reused linked Plex and VynodeArr destinations automatically while retaining
  manual host-folder controls for unlinked and legacy configurations.

### Fixed

- Restored original Plex collection artwork reliably when removing a managed
  list collection poster.
- Prevented movie-only lists from requiring television destinations, and vice
  versa, while retaining independent settings for mixed-media lists.

## [2.0.45-rc.6] - 2026-08-15

### Changed

- Allowed a separate placeholder Plex library to use its own independently
  selected VynodeArr-visible host folder, including folders mapped under `/media`.

### Fixed

- Stopped newly added movie and television destinations from becoming defaults
  unless the user explicitly selects the default option.

## [2.0.45-rc.5] - 2026-08-15

### Fixed

- Kept quick overlay item previews compact in the editor's left column.
- Replaced the ambiguous green media-status artwork with a clear checkmark
  without changing the applied overlay's position or sizing.

## [2.0.45-rc.4] - 2026-08-15

### Changed

- Moved Dashboard movie and television engine scopes beside the operational
  summary they control and clarified engine selection on both library pages.
- Made imported list titles the primary Lists workspace and moved Plex sync,
  trailers, collections, and list artwork into a dedicated automation subpage.
- Added direct Setup Overview links to list browsing and list automation.

### Fixed

- Prevented manual VynodeArr-to-Plex matching from recursively calling itself
  and failing with a maximum call stack error.
- Restored natural sizing and direct drag-and-resize behavior for quick overlay
  items in the poster editor.

## [2.0.45-rc.3] - 2026-08-15

### Added

- Added eight polished quick overlay items for media status, quality, audio and
  subtitles, ratings, release and airing, editions, sources, and personal labels.

### Changed

- Quick overlay items remain ordinary editable layers, allowing unrestricted
  customization through the existing metadata, color, size, opacity,
  typography, shape, position, condition, and stacking controls.

## [2.0.45-rc.2] - 2026-08-15

### Added

- Added one guided Overlays workspace with focused Overview, Templates,
  Assignments, and Plex artwork views.
- Added a direct Overlays entry to primary navigation and global search.

### Changed

- Explained VynodeArr display overlays and managed Plex artwork separately,
  with a clear destination, template, scope, preview, and apply workflow.
- Lazy-loaded the workspace overview to keep the main overlay editor bundle
  focused while preserving every existing editor and artwork operation.

## [2.0.45-rc.1] - 2026-08-15

### Changed

- Rebuilt the mobile Movies and Television controls as compact, independently
  scrollable rows for engine selection, status filters, search, sorting, and
  view selection.
- Reduced the mobile bulk-selection area and provided concise mobile action
  labels while preserving the complete desktop controls and behavior.

### Fixed

- Prevented the Movies and Television toolbars from consuming excessive
  vertical space on phones when filters or view controls wrap.

## [2.0.44] - 2026-08-14

### Changed

- Clarified request routing so users can see which movie or television engine
  will receive a request, while keeping the selector hidden when there is only
  one valid destination.
- Added independent Movie and Television engine filters to the Dashboard, with
  an All instances option for each media type.
- Reorganized the mobile Movies and Television controls into compact rows for
  engine, status, search, sorting, view selection, and bulk actions.
- Replaced the oversized mobile Setup Center navigation with one compact setup
  section selector and tightened the introductory and step-card spacing.

### Fixed

- Prevented the mobile library and Setup Overview controls from overflowing,
  overlapping the application shell, or pushing primary actions off-screen.

## [2.0.43] - 2026-08-14

### Added

- Added independently managed external movie and television engine instances,
  with isolated credentials, settings, destinations, requests, searches, and
  operational views for each instance or all instances together.
- Added a guided Setup Center for engines, storage, search providers, download
  clients, optional integrations, and final health validation.
- Added application-wide search for titles, pages, settings, and setup routes.
- Added portable Docker installation support, optional main-media mapping,
  preflight validation, smoke testing, and documented multi-engine testing.

### Changed

- Made Movies, Television, Wanted, Queue, History, Calendar, Health, Dashboard,
  and Action Center engine-aware while preserving existing single-engine and
  bundled-engine installations.
- Improved mobile Lists navigation and kept imported-list automation additive
  and explicit.

### Fixed

- Prevented native IDs, destinations, Plex mappings, requests, artwork, and
  notifications from crossing between engine instances.
- Preserved managed trailer-placeholder overlays when a title leaves a provider
  list but no valid real media file exists.
- Kept healthy instance data visible when another configured engine is offline.

## [2.0.43-rc.8] - 2026-08-14

### Added

- Added a dedicated Setup Center that places engines, storage, search and
  download connections, optional integrations, and final health validation in
  a clear first-time order while retaining every detailed setting and legacy
  route.

### Changed

- Moved engine entry points out of personal Account Settings, renamed the
  guided storage entry point to Storage & Destinations, and added concise
  instructions explaining which setup requirements are essential or optional.

### Fixed

- Kept the imported-list selector on-screen on phones by separating its
  navigation semantics from the application shell sidebar and bounding its
  mobile height.
- Preserved title overlays for managed trailer placeholders that leave a
  synchronized provider list while no valid real media file exists. Collection
  membership still follows the current list without deleting the trailer or
  restoring its placeholder poster.

## [2.0.43-rc.7] - 2026-08-14

### Fixed

- Corrected the clean-volume multi-engine Docker lab to use the published
  image's port and persistent configuration path, and added a retained-lab mode
  for browser validation.
- Scoped library totals, monitored counts, coverage, missing counts, and cutoff
  counts to the selected engine instance instead of retaining aggregate values.
- Documented the required external-engine restart and one-to-one Plex library
  ownership during multi-engine setup.

## [2.0.43-rc.5] - 2026-08-14

### Added

- Added multiple independently configured external movie and television engine
  instances, with encrypted credentials and isolated settings for each.
- Added **All engines** and individual-instance views across Movies, Television,
  Wanted, Queue, History, Calendar, Health, Dashboard, and Action Center.
- Added engine-aware destinations, quality profiles, providers, selection rules,
  guide templates, requests, automatic searches, and interactive grabs.

### Fixed

- Prevented identical native title IDs from different engine instances from
  colliding in library records, request attribution, artwork, notifications,
  search activity, and detail links.
- Kept healthy instance data visible when another external engine is offline.
- Preserved the selected engine throughout approval, correction, cancellation,
  deletion, destination selection, and search workflows.

### Compatibility

- Existing bundled-engine and single-external-engine installations migrate to
  one default instance without changing their current behavior or credentials.
- Multi-engine mode is optional. Removing an additional instance does not alter
  the remaining instance, and the bundled engines remain available unless the
  administrator explicitly switches to external engines.

## [2.0.43-rc.4] - 2026-08-13

### Added

- Turned the persistent header field into an application-wide search for movie
  and television titles, primary pages, Service Settings, account settings,
  engine configuration, and system tools.
- Added a responsive search-results panel with direct navigation and keyboard
  support for arrows, Enter, and Escape.

### Fixed

- Constrained imported-list selectors on phones so long provider list names
  truncate cleanly instead of expanding the horizontal workspace and creating
  a massive blank page break.

## [2.0.43-rc.3] - 2026-08-13

### Added

- Added an optional `compose.media.yaml` override that maps one host parent
  media folder to `/media` in VynodeArr and both bundled engines.
- Added Linux/macOS and Windows PowerShell Docker preflight tools that verify
  Docker, Compose, the Docker service, configuration, and the optional media
  folder before startup.
- Added a real Linux container smoke test to develop, pull-request, and release
  workflows. It builds the generic image, verifies `/healthz`, waits for a
  healthy container, and confirms `/data`, `/movies`, `/tv`, and `/downloads`.

### Fixed

- Corrected permissions for a fresh persistent `/data` volume.
- Corrected unprivileged user creation in the generic Node Alpine image.

### Docker installation

Standard named-volume installation:

```sh
cp .env.example .env
sh scripts/docker-preflight.sh
docker compose up --build -d
```

Optional main media folder installation:

```sh
# Set VYNODEARR_MEDIA_PATH=/srv/media in .env first.
sh scripts/docker-preflight.sh --media
docker compose -f compose.yaml -f compose.media.yaml up --build -d
```

Open `http://localhost:8686`. Windows PowerShell equivalents and complete
folder-assignment and migration instructions are in the README's Docker
Compose section.

### Compatibility

- The Unraid image, Community Applications template, and Unraid configuration
  remain unchanged.

## [2.0.43-rc.2] - 2026-08-13

### Changed

- Made the standard Docker Compose installation portable across Linux, NAS,
  Docker Desktop, and other Docker hosts by removing machine-specific paths.
- Added configurable WebUI bind address, port, timezone, PUID, and PGID with
  safe defaults; `.env` is optional.
- Shared movie, television, and completed-download storage consistently with
  VynodeArr and its bundled engines.
- Updated the generic Docker image to use reproducible dependency installs and
  declare all persistent runtime paths.
- Added a complete Docker Compose installation, host-folder mapping,
  persistence, update, and troubleshooting guide to the README.

### Docker quick start

```sh
git clone https://github.com/minerport/VynodeArr-Unified.git
cd VynodeArr-Unified
cp .env.example .env
docker compose up --build -d
```

Open `http://localhost:8686`. Existing host media folders can be mapped to
`/movies`, `/tv`, and `/downloads` as documented in the README.

### Compatibility

- The Unraid image, Community Applications template, and Unraid configuration
  are unchanged in this release candidate.

## [2.0.43-rc.1] - 2026-08-13

### Added

- Added an optional split-library mode for Reeltrack Plex automation, allowing separate placeholder and real-media libraries for movies and television.
- Split mode maintains a corresponding collection in each Plex library and continues matching titles by authoritative external IDs.

### Changed

- Trailer promotion now copies the managed trailer beside real media, verifies the new file, and only then removes the placeholder copy.
- Existing automations remain in the established single-library mode unless an administrator explicitly enables separate placeholder libraries.

### Fixed

- Preserved collection posters, placeholder overlays, real-title overlays, and original-artwork restoration across both split-library destinations.

## [2.0.42] - 2026-08-12

### Added

- Added restart-safe support for either bundled engines or validated, encrypted connections to existing external movie and television engines.
- Mixed-media lists now remain unified while presenting separate Movies and Television sections with correct engine routing.
- Added targeted audits and repairs for missing managed trailers, including overlay application after successful recovery.
- Added a distinct overlay for real Plex titles after they replace managed trailer placeholders.

### Changed

- Plex list synchronization is additive: scheduled runs add missing members and retain trailers, existing collection membership, overlays, and artwork unless an administrator explicitly removes them.
- Managed trailers become Plex-recognized local extras when real media arrives.
- Imported lists are additive, remain until explicitly removed, and begin as inactive drafts so importing alone never changes Plex.
- Saving automation or running a manual synchronization applies the current collection and title artwork settings.
- Reeltrack artwork-editor setup, layer, and preview columns scroll independently through all controls while keeping actions accessible.

### Fixed

- Preserved original Plex posters for reliable restoration when overlays are removed.
- Applied title overlays to every matching Plex collection member instead of only managed placeholders.
- Prevented smart collections from being modified by regular list synchronization.
- Prevented unselected existing imports from being removed while importing another list.
- Corrected clipped and unreachable controls in long Reeltrack artwork editors.

## [2.0.42-rc.6] - 2026-08-12

### Fixed

- Every desktop Reeltrack artwork-editor column now includes a full viewport of trailing scroll space so all controls can move completely above the fixed action bar and out of view.

## [2.0.42-rc.5] - 2026-08-12

### Changed

- Reeltrack list imports are additive: unselected imported lists and their automation, trailers, overlays, and artwork backups remain until an explicit removal.
- New imports are stored as disabled drafts and do not touch Plex until the administrator finishes artwork and destination setup and chooses Save and apply settings.
- The desktop artwork editor keeps its header, presets, and bottom actions visible while the setup, layer settings, and preview columns scroll independently.

### Fixed

- Unchecking an existing list while importing another no longer removes the existing import.
- Long editor columns no longer hide controls below the visible viewport.

## [2.0.42-rc.4] - 2026-08-12

### Added

- Imported lists now provide a targeted missing-trailer audit and repair action that retries failed or missing files without rebuilding unrelated collection members.
- Recovered trailers for real movies and shows are promoted to Plex-recognized local extras and receive the configured real-title overlay after the library refresh.

### Fixed

- The Reeltrack artwork editor now scrolls continuously from its complete preset row through every control and the bottom actions instead of clipping the footer.

## [2.0.42-rc.3] - 2026-08-12

### Added

- Reeltrack list automation can use a separate overlay for real Plex movies and shows after they replace managed trailer placeholders.

### Changed

- Saving list automation now immediately applies the visible collection and title artwork settings, and manual synchronization persists edited artwork before running.
- Scheduled refreshes apply overlays to both managed trailer placeholders and matching real Plex titles while preserving additive collection behavior.

### Fixed

- Kept the Reeltrack artwork editor fully inside the viewport so its heading and illustrated preset row remain visible.
- Title overlays now target every matching Plex collection member instead of only trailer placeholders.
- Original Plex posters are retained per title and restored when list overlays are removed.

## [2.0.42-rc.2] - 2026-08-12

### Changed

- Reeltrack Plex automation now updates regular collections in place, adds only missing members, and refuses to modify smart collections.
- Managed movie and television trailers are retained as Plex local extras when real media arrives instead of being deleted.
- Scheduled list synchronization is additive and leaves trailers, collection members, and artwork in place unless an administrator explicitly removes the managed list.

### Fixed

- Preserved collection-poster and individual-title overlay application while reconciling additive Plex collection membership.

## [2.0.42-rc.1] - 2026-08-12

### Added

- Added a restart-gated external engine mode that securely validates and connects existing movie and television engine instances while disabling the bundled engines.
- Imported mixed-media Reeltrack lists now keep one list and present separate Movies and Television sections with independent counts and correct engine routing.

### Changed

- Bundled engine setup, authentication, webhook, and root-folder operations are limited to bundled mode so external instances remain under their owners' control.
- Unraid startup and health checks now support both bundled and external engine configurations without exposing or unnecessarily starting bundled services.

## [2.0.40-rc.12] - 2026-08-11

### Added

- Movie and television libraries now provide React-native bulk selection, bounded batch rename, and refresh-and-scan actions for visual testing.

### Changed

- Calendar, Queue, Wanted, Engine Management, Discover settings, Quality Profiles, first-run engine setup, and authentication now use their typed React implementations exclusively while preserving their existing workflows.
- Poster-overlay presentation now loads from static stylesheets, and background imports use a single React monitor instead of duplicate legacy controllers.
- Mobile release-profile and notification activity layouts are clearer, with persistent notification clearing behavior across activity sections.

### Fixed

- Missing React route initialization now presents an actionable reload state instead of silently switching to a second implementation.
- Library parity tests now protect bulk editing, destructive removal, and Quick Details until those remaining workflows are migrated.

## [2.0.40] - 2026-08-09

### Added

- Added flexible movie and television library destinations beneath an optional main media mapping while preserving the legacy `/movies` and `/tv` paths.
- Added guarded root-folder migration that updates both VynodeArr and its media engines, reports progress, and verifies title and collection references before declaring success.
- Added destination selection and defaults across requests, interactive search, and imported lists.

### Improved

- Improved library browsing, trailer heroes, Discover filtering and sorting, poster-overlay workflows, mobile interactive search, and Reeltrack list guidance.
- Updated Unraid Community Applications metadata, repository assets, and deployment validation.

### Fixed

- Fixed stale movie-engine root and collection mappings, health warnings that would not clear, and failed automatic searches that could leave unusable releases marked as already downloading.

## [2.0.40-rc.11] - 2026-08-09

### Fixed

- Discover and automatic movie searches now detect immediate completed zero-byte import failures, remove and blocklist the unusable release, and fall back to a fresh native search instead of leaving the title permanently rejected as already downloading.
- Removing a failed Queue item now blocklists that release and invalidates cached search results immediately, allowing automatic and interactive searches to try another candidate.

## [2.0.40-rc.10] - 2026-08-09

### Fixed

- **Check health now** queries the movie and television engines again instead of redisplaying VynodeArr's saved operational-health snapshot, allowing resolved root-folder warnings to clear immediately.

## [2.0.40-rc.9] - 2026-08-09

### Fixed

- Root-folder migration now updates the selected movie or television engine first, synchronizes VynodeArr immediately afterward, and verifies that the old engine path has zero remaining title or collection references before reporting success.

### Added

- Health warnings that mention an engine path now provide an on-demand engine
  mapping verification showing whether the root remains registered and how
  many title and collection records still use it.
- Verified legacy roots can be remapped directly inside the movie or television
  engine to an equivalent registered path. The guarded repair changes stored
  engine records only and always uses `moveFiles: false`.

## [2.0.40-rc.8] - 2026-08-09

### Fixed

- Same-folder root migrations now update movie-engine collection root paths in
  addition to individual movie locations, preventing stale legacy-root health
  warnings after switching from `/movies` to a `/media` path.

- Discover movie requests now explicitly grab the highest-ranked accepted
  release and send it to the download client, with native background search as
  a compatibility fallback when immediate release enumeration is unavailable.

- Discover's Movies and TV buttons now reload matching genre and supported
  streaming-service results instead of changing only the selected button.

### Added

- Genre and service result grids can hide titles already available in the
  library and sort loaded results by recommendation, rating, year, or title.

## [2.0.40-rc.7] - 2026-08-09

### Added

- Main `/media` folder rows can now expand one level at a time so
  administrators can browse arbitrarily deep subfolders and register the exact
  movie or television library location they need.
- Same-folder path migrations now show real batch progress, completion
  percentage, elapsed time, and an estimated time remaining while existing
  movie or television locations are updated.

## [2.0.40-rc.6] - 2026-08-09

### Added

- Storage scans now detect when a newly registered engine root points to the
  same physical Unraid folder as an existing root. Administrators can preview
  every affected title, deliberately scan anyway, or update the engine's saved
  paths to the new container location without moving, renaming, or deleting
  any media files.

## [2.0.40-rc.5] - 2026-08-09

### Changed

- Simplified new Unraid installations to the legacy `/movies` and `/tv`
  mappings plus one optional `/media` parent. Storage Folders scans only the
  parent's direct children and lets administrators assign each child to the
  movie or television engine without numbered container-path placeholders.

### Fixed

- Requests now add media to the selected destination first, then send and
  track an explicit movie or television search command instead of relying on
  an implicit add-time engine search.

## [2.0.40-rc.4] - 2026-08-09

### Fixed

- Storage folder discovery now omits only the synthetic `/media/cdrom`,
  `/media/floppy`, and `/media/usb` directories while continuing to offer every
  other visible child folder for Movies or Television.
- Newly registered engine roots now appear as selectable Media Destinations
  even after destination setup was previously completed. Request, Add Media,
  and Reeltrack list screens always show the destination and identify the
  default; the chosen folder and profile are sent to the appropriate engine.

## [2.0.40-rc.3] - 2026-08-09

### Changed

- Expanded the default Unraid template with blank optional placeholders for a
  shared `/media` parent, two additional movie libraries, and two additional
  television libraries while preserving the existing `/movies` and `/tv`
  mappings for compatibility.
- Added installation helper text explaining unified-parent and separate-share
  layouts and warning against registering the same library through two paths.
- Storage settings now detect the fixed optional container paths and direct
  children of `/media`, show whether each is configured or registered, and let
  administrators classify visible folders for the movie or television engine.

### Removed

- Removed in-app Unraid XML editing, its pending-edit API, and access to the
  Unraid template directory. Host-to-container mappings remain owned by Unraid;
  VynodeArr now provides detection, engine registration, and setup guidance.

## [2.0.40-rc.2] - 2026-08-09

### Added

- Added a guided Unraid storage-mapping workflow for additional movie and
  television roots. Administrators can enter friendly, host, and container
  paths, apply the updated container configuration in Unraid, then verify and
  register the new root with the correct bundled engine.
- Added persistent pending-mapping status and application-backup coverage so
  the setup survives the required Unraid container recreation.

### Changed

- Media Destination setup now distinguishes folders already visible inside the
  container from new Unraid mappings and provides first-use helper text.
- The Community Applications template now offers guarded access to VynodeArr's
  own user template for optional in-app path configuration.

### Security

- Unraid template changes are administrator-only and CSRF protected. Host and
  container paths, reserved targets, duplicate mappings, template identity, and
  complete XML structure are validated before an atomic replacement that
  preserves every existing setting.

### Validation

- Passed all 238 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.40-rc.1] - 2026-08-09

### Added

- Added friendly Media Destinations backed by multiple root folders in the
  existing single Radarr and Sonarr engines. Each destination can define its
  folder, quality profile, monitoring behavior, availability, series type,
  administrator access, default status, and optional Plex library.
- Added destination selection to Add Media, Discover requests, administrator
  approvals, and Reeltrack automation while retaining the current single-root
  behavior for installations that have not configured destinations.

### Changed

- Storage settings now discover existing engine roots, classify existing titles
  without moving them, suggest matching Plex libraries, and explain when an
  Unraid path mapping and container restart are required.
- Application backups now include Media Destination configuration.

### Validation

- Passed all 236 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.39] - 2026-08-09

### Changed

- Promoted the tested 2.0.39 release-candidate series with cinematic Movie and
  TV hero trailers, prioritizing securely proxied matched Plex extras before
  local trailers, official TMDB/YouTube trailers, and permanent artwork fallback.
- Replaced the outdated GitHub and Unraid screenshots with the current six-view
  product tour and linked walkthrough video.

### Fixed

- Corrected paged Movie release-date and TV first-aired sorting so reversing
  direction retains the selected field and undated titles remain last.
- Restored the exact Movie or TV library position, loaded page depth, filters,
  search, sorting, and layout after returning from title details.
- Made the **Watch trailer** action reliable and removed embedded-player controls
  from cinematic hero playback.

### Validation

- Passed all 232 automated tests plus TypeScript, production build, bundle,
  branding, deployment, and Community Applications metadata validation.

## [2.0.39-rc.4] - 2026-08-09

### Changed

- Prefer matched Plex trailer extras when Plex is connected, proxying protected range requests through VynodeArr before falling back to a local trailer, TMDB, and finally hero artwork.

### Fixed

- Restore Movie and TV libraries to the exact prior scroll position after closing a title detail instead of returning to the top.

### Validation

- Passed all 231 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.39-rc.3] - 2026-08-09

### Changed

- Made official fallback trailers fill the detail hero as a cropped cinematic background without embedded-player controls; the separate **Watch trailer** action remains available.

### Validation

- Passed all 229 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.39-rc.2] - 2026-08-09

### Fixed

- Made trailer actions clickable, normalized their label to **Watch trailer**, and added a muted official YouTube hero fallback when no local trailer exists.
- Kept Movie and TV library direction changes tied to the selected sort field, including correct release-date and first-aired ordering across paged results.

### Validation

- Passed all 229 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.39-rc.1] - 2026-08-09

### Changed

- Replaced the outdated GitHub and Unraid listing screenshots with a current
  six-view product tour and added a linked VynodeArr walkthrough video.
- Added muted, lightweight hero-trailer playback to movie and television
  details using browser-compatible local trailers, byte-range streaming, sound
  and pause controls, reduced-data safeguards, and the existing fanart as a
  permanent fallback. Plex is not required.

### Validation

- Passed all 228 automated tests plus TypeScript, production build, bundle,
  branding, deployment, and Community Applications metadata validation.

## [2.0.38] - 2026-08-09

### Changed

- Prepared the repository for the current Unraid Community Applications submission flow with root `ca_profile.xml`, one canonical Docker template, clearer installation fields, searchable metadata, licensing, project documentation, and screenshots.
- Promoted the tested 2.0.38 release-candidate series with mobile interactive-search filters, guided Reeltrack collection setup, clearer Plex and VynodeArr artwork workflows, saved preview posters, stackable VynodeArr overlay templates, and in-place applied-style updates.

### Validation

- Passed all 224 automated tests plus TypeScript, production build, bundle, branding, deployment, and Community Applications metadata validation.

## [2.0.38-rc.3] - 2026-08-09

### Changed

- Simplified saved style previews to always retain the exact poster visible when the style is saved or updated; removed the unnecessary rotation choice from the editor.
- Separated saved poster styles into VynodeArr and Plex template groups according to the destination selected when each style was saved.

### Validation

- Passed all 224 automated tests plus TypeScript, production build, bundle, branding, and deployment validation.

## [2.0.38-rc.2] - 2026-08-09

### Changed

- Moved poster rotation to saved style-card previews: each style can rotate through matching library posters or keep the exact preview poster visible when saved.
- Combined layers from multiple compatible VynodeArr style assignments so applying another template no longer replaces overlays that are already assigned to the same titles.
- Made applied styles directly editable from saved styles and active assignments; updating a style now refreshes every linked VynodeArr library assignment without removing or reapplying it.

### Validation

- Passed all 224 automated tests plus TypeScript, production build, bundle, branding, and deployment validation.

## [2.0.38-rc.1] - 2026-08-09

### Added

- Added mobile interactive-search controls for release text, status, source, and quality filtering, plus sorting by status, title, source, quality, score, size, age, or peers in either direction.
- Added fixed and daily-rotating VynodeArr poster-style assignments. Daily rotation selects from compatible saved VynodeArr styles while keeping each title stable throughout the day.
- Added a persistent link to `https://reeltrack.vynodehub.com` so users can find or create their Reeltrack API key from either connection state.

### Changed

- Reorganized managed Reeltrack collection setup into a numbered first-use flow for automation, Plex and host destinations, collection naming and scheduling, and optional artwork.
- Rewrote Reeltrack storage, artwork backup, synchronization, and result guidance in plain language, with clearer readiness and failure states and a responsive phone layout.
- Clearly separated Plex artwork operations from VynodeArr library-overlay assignments and added assignment-mode guidance to the application review.
- Collapsed Plex poster history into a compact summary that reveals restoration controls and individual records only when opened.
- Condensed mobile interactive-search headers and result rows, kept controls visible while scrolling, and added a live filtered-result count.

### Validation

- Passed all 224 automated tests plus TypeScript, production build, bundle, branding, and deployment validation.

## [2.0.37] - 2026-08-08

### Added

- Added optional managed Plex collections for imported Reeltrack lists, with scheduled provider refreshes, official trailer downloads through `yt-dlp`, automatic Movie and Television library registration, and cleanup when real media arrives or a title leaves its source list.
- Added independent Movie and Television Plex targets for mixed lists, explicit host-folder mapping, engine-root compatibility checks, and safe handling when Plex, VynodeArr, and the media engines use different paths for the same storage.
- Added a complete collection-poster and managed-title-overlay designer with exact Plex previews, custom uploads, gradients, four-title collages, metadata variables, conditions, text, shapes, icons, and illustrated theatrical presets.
- Added drag positioning, four-corner resizing, multi-selection, persistent grouping, proportional group transforms, and layer-level controls to managed artwork editors.
- Added integrity-checked original Plex artwork backups, per-list collection and title artwork restoration, and separate artwork success/failure reporting.
- Added guided recovery for movie-engine warnings caused by removed TMDB titles, including library detection, replacement matching, confirmed rematching that preserves files and settings, and durable dismissal when no action is needed.

### Changed

- Store managed trailers inside normal title folders under the selected media root instead of a separate trailer volume, while confining creation and cleanup to VynodeArr-owned files and empty folders.
- Register supported missing list titles with the appropriate media engine without forcing an immediate search, and build Plex collections only after their managed placeholders are indexed.
- Compose every artwork revision from the first captured original so repeated edits never accumulate overlays, and restore native artwork before removal.
- Condensed Reeltrack automation controls and title cards into responsive multi-column layouts with bounded wrapping and phone-safe controls.
- Enriched managed overlays with TMDB genre, rating, runtime, certification, studio, and network metadata when Plex placeholders omit those values.

### Fixed

- Fixed incomplete list synchronization, missing Plex collections, stale trailer-job records, delayed Plex indexing, and incorrect root selection.
- Fixed title overlays applying to only one placeholder, transient Plex artwork failures aborting later titles, and collection-poster failures preventing independent title-overlay work.
- Fixed original-artwork restore races, stale backup failures, cross-server backup collisions, and poster updates that could leave Plex showing an older or cumulatively overlaid image.
- Fixed decorative shapes inheriting visible custom-text placeholders and restored reliable selection, pointer movement, and resizing for artwork.
- Fixed Health recovery mutations being rejected by the API's read-only review fallback.

### Security

- Restricted trailer sources to validated HTTPS YouTube URLs, bounded downloader execution, verified the final `yt-dlp` path, and confined removal to managed files beneath the configured library root.

### Validation

- Passed all 223 automated tests plus TypeScript, production build, bundle, branding, and deployment validation.

## [2.0.36-rc.19] - 2026-08-08

### Added

- Added guided recovery for movie-engine warnings caused by TMDB removing a
  title: VynodeArr now checks the movie library and searches for a valid
  replacement match.
- Added confirmed in-place rematching that retains files and library settings,
  plus a durable dismiss action when the affected title is absent or no valid
  replacement exists.

## [2.0.36-rc.18] - 2026-08-08

### Changed

- Condensed imported-list title cards into a denser responsive grid that uses
  more columns on wide screens while retaining a clean single-column phone view.
- Reduced poster, metadata, summary, and action sizing so more titles remain
  visible without sacrificing readability.
- Wrapped long title text across two lines and constrained summaries and file
  metadata to prevent card content from overlapping or widening the page.

## [2.0.36-rc.17] - 2026-08-08

### Fixed

- Enriched managed Reeltrack title overlays with TMDB metadata before every
  render so genre-driven shapes appear on Plex placeholders.
- Made rating, runtime, certification, studio, and network variables available
  to list overlays even when Plex trailer placeholders omit that metadata.

## [2.0.36-rc.16] - 2026-08-08

### Fixed

- Prevented decorative theatrical preset shapes and icons from inheriting a
  visible `Custom text` placeholder when several artwork layers are added.
- Removed the accidental legacy placeholder from existing non-text custom
  artwork while preserving intentional labels and normal custom text layers.

## [2.0.36-rc.15] - 2026-08-08

### Added

- Added per-list controls to restore native Plex collection artwork or the
  original title posters without changing artwork configured for other lists.
- Added separate collection-poster and title-overlay success and failure
  reporting to managed-list runs.

### Changed

- Condensed the managed Plex collection panel with tighter controls, inline
  host-path mapping, compact artwork actions, and a shared summary/save row.
- Recreate a managed collection immediately when its custom poster is
  reverted so Plex restores native collection artwork without waiting for the
  next scheduled synchronization.

### Fixed

- Prevented a newly created Plex collection's temporarily unavailable
  thumbnail from aborting collection-poster and title-overlay application.
- Isolated collection-poster failures so title overlays continue applying to
  every managed placeholder in the list.

## [2.0.36-rc.14] - 2026-08-08

### Changed

- Changed collection and title artwork updates to compose every revision from
  the first captured original instead of the previously rendered poster.
- Limited direct original-poster uploads to artwork removal and titles that
  are no longer targeted by a managed overlay.

### Fixed

- Prevented Plex's asynchronous poster processing from allowing an original
  restore upload to finish after and replace a newly rendered poster.
- Ensured active collection-poster and title-overlay updates send Plex one
  final composite, preventing overlays from disappearing or accumulating.

## [2.0.36-rc.13] - 2026-08-08

### Added

- Added modifier-key multi-selection, persistent groups, and Group/Ungroup
  controls to the collection-poster and title-overlay designers.
- Added shared group bounds so selected artwork can be moved and resized
  proportionally as one composition.

### Changed

- Automatically grouped the related layers created by collection and
  theatrical presets while retaining independent layer editing.
- Separated original-artwork backups by Plex server, media domain, artwork
  type, and item to prevent unrelated poster records from colliding.

### Fixed

- Restored pointer input and visible resize handles for artwork layers that
  inherited noninteractive poster-preview styling.
- Recovered safely from stale or unavailable artwork backup files so a failed
  restore cannot prevent collection posters and title overlays from applying.
- Ensured the newly rendered JPEG remains Plex's final poster upload after an
  original is restored during an update.

## [2.0.36-rc.12] - 2026-08-08

### Added

- Added explicit layer-level controls to move selected collection-poster and
  title-overlay items forward, backward, to the front, or to the back.
- Added durable, integrity-checked original-artwork backups for managed
  Reeltrack collection posters and title overlays.

### Changed

- Upgraded theatrical presets into independently editable accent, icon, and
  text layers with more complete poster-ready compositions.
- Allowed every artwork layer to grow or shrink horizontally and vertically
  from all four resize corners in both the editor and exact Plex renderer.

### Fixed

- Restored the first captured Plex artwork before replacing, updating, or
  removing a managed overlay or collection poster, preventing effects from
  accumulating across repeated edits and synchronization runs.

## [2.0.36-rc.11] - 2026-08-08

### Added

- Added illustrated theatrical overlay presets for Coming Soon, Feature
  Trailer, Upcoming, Trending Now, Recently Added, New Release, Leaving Soon,
  Editor's Pick, Watch Tonight, and Now Showing.
- Added editable filmstrip, clapperboard, megaphone, popcorn, spotlight,
  flame, laurel, marquee, and ticket artwork for title overlays.

### Changed

- Reorganized the collection-poster and title-overlay designers with compact
  preset cards, grouped controls, responsive columns, and clearer settings.
- Applied the cleaner, full-width control layout to the standard poster
  overlay inspector.

### Fixed

- Added four-corner resizing so artwork can grow left, right, up, and down
  while remaining bounded by the poster canvas.
- Improved vertical icon resizing and prevented editor controls from
  colliding or overflowing at narrower viewport sizes.

## [2.0.36-rc.10] - 2026-08-08

### Added

- Added editable quick-overlay presets for Coming Soon, Upcoming, Trending
  Now, Recently Added, New Release, Leaving Soon, Editor's Pick, and Watch
  Tonight.
- Gave each preset distinct text, colors, typography, shape, and placement
  while retaining the complete drag, resize, condition, and appearance editor.

### Changed

- Refreshed the selected Plex library after applying a managed-title overlay
  batch so every changed poster becomes visible together.

### Fixed

- Retried transient Plex poster-upload failures per title instead of allowing
  one temporary failure to leave the rest of a synchronized list unchanged.
- Ensured every managed placeholder is processed independently during title
  overlay application.

### Validation

- Passed all automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.36-rc.9] - 2026-08-08

### Added

- Added a searchable four-title selector to collection poster designs for a
  2-by-2 mini-poster collage sourced from synchronized list titles.
- Added visible title-overlay applied and failure totals, with bounded failure
  details available from the automation summary.

### Changed

- Rendered the selected mini posters through the exact server-side Plex poster
  pipeline as well as the interactive design preview.
- Limited collection collages to four explicitly selected TMDB-backed titles.

### Fixed

- Recovered managed title identities from both Plex GUIDs and the `[tmdb-id]`
  marker in trailer folder paths when applying individual title overlays.
- Fell back to the title's provider artwork when Plex had not assigned usable
  poster art to a newly indexed trailer placeholder.
- Stopped silently discarding title-overlay errors so failed applications are
  visible and actionable after an automation run.

### Validation

- Passed all 218 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.36-rc.8] - 2026-08-08

### Added

- Added starter collection-poster designs and customizable solid, linear,
  and radial-gradient backgrounds.
- Added validated custom JPEG, PNG, and WebP poster-background uploads with
  persistent server-side storage and Plex rendering.
- Added interactive drag positioning and corner-handle resizing to Reeltrack
  collection posters and managed-title overlays.

### Changed

- Replaced the reduced Reeltrack artwork controls with the same layer model,
  variables, icons, shapes, text fitting, appearance controls, conditions,
  ranked sub-conditions, and adaptive contrast used by Poster Overlays.
- Removed manual X/Y fields in favor of direct manipulation on the poster.
- Kept an exact server-rendered Plex output preview alongside the interactive
  editing canvas.

### Fixed

- Ensured collection previews always have visible starter artwork or a chosen
  color/gradient background instead of an empty dark canvas.
- Preserved uploaded backgrounds after reopening the editor and used them for
  collection creation, updates, and recurring synchronization.

### Validation

- Passed all 218 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.36-rc.7] - 2026-08-08

### Added

- Added an administrator collection-poster designer for synchronized Reeltrack
  lists with multiple editable text and shape layers.
- Added collection name, title count, media type, and last-sync variables for
  collection artwork.
- Added optional layered title overlays for the managed Plex titles inside a
  synchronized collection.
- Added exact server-rendered artwork previews using the same renderer and
  dimensions used for Plex uploads.

### Changed

- Reapplied collection posters and managed-title overlays whenever automation
  creates, synchronizes, or updates a Plex collection.
- Made the list artwork designer a separate lazy-loaded route chunk and
  condensed Reeltrack title cards and automation controls.

### Fixed

- Loaded Reeltrack title posters through the authenticated application route
  and replaced unavailable images with a clean media-type fallback.
- Preserved explicit removal of saved collection posters and title-overlay
  designs when automation settings are updated.

### Validation

- Passed all 218 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.36-rc.6] - 2026-08-08

### Added

- Added explicit Movie and Television host-folder mapping for managed
  Reeltrack Plex collections, with a bounded folder browser and the Plex
  library path retained as a reference.

### Changed

- Treated Plex-visible paths, VynodeArr-mounted host paths, and media-engine
  roots as independent namespaces instead of requiring their strings to match.
- Refreshed saved Plex library metadata and derived the shared library root
  when older metadata incorrectly pointed at an individual title folder.
- Used each engine's own configured root when registering list titles while
  placing managed trailers in the administrator-selected host mapping.

### Fixed

- Kept the System Status page usable when only one media engine is unavailable,
  preserving healthy storage information and showing a direct connection link
  for the failed engine.
- Prevented Plex container paths from being registered directly as media-engine
  roots when the services mount the same host storage under different paths.

### Validation

- Passed all 217 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.36-rc.5] - 2026-08-08

### Added

- Added Movie and Television engine-root compatibility checks for selected
  Plex libraries.
- Added administrator actions beside incompatible Plex targets to register the
  reported Plex location as the corresponding Movie or TV engine root folder.

### Changed

- Selected the most specific compatible engine root when adding Reeltrack
  titles instead of defaulting to the engine's first root folder.
- Condensed managed-automation status into readable counters and grouped Plex
  target compatibility directly with each library selector.

### Fixed

- Detected trailer files and folders deleted outside VynodeArr, discarded their
  stale completed-job records, and downloaded them again on the next sync.
- Prevented titles from silently being added beneath an unrelated engine root
  when the selected Plex library location is not configured in that engine.

### Validation

- Passed all 216 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.36-rc.4] - 2026-08-08

### Fixed

- Refreshed and polled Plex whenever managed trailer files remain, allowing a
  later automation run to recover when the initial Plex scan had not finished.
- Waited up to 30 seconds for all expected managed placeholders before creating
  or replacing the list collection.
- Replaced silent collection omission with an actionable error that reports
  the indexed and expected trailer counts, target library, and Plex-visible
  library path.
- Preserved the intended collection state when Plex has not indexed every
  managed trailer instead of replacing it with an empty collection.

### Validation

- Passed all 215 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.36-rc.3] - 2026-08-08

### Added

- Added missing Reeltrack movie and television titles to their corresponding
  VynodeArr libraries during managed-list synchronization without forcing an
  immediate search.
- Added separate Movie and Television Plex library selections for mixed-media
  Reeltrack lists, with independent managed collections and trailer roots.

### Changed

- Derived managed trailer destinations from each selected Plex library rather
  than accepting a manually entered Plex path.
- Processed the complete provider list during each synchronization and retried
  Plex library scans before finalizing managed collections.
- Required only the Plex library types represented by a list; movie-only and
  television-only lists need one target, while mixed lists need both.
- Migrated existing single-library automations automatically according to the
  selected Plex section type.

### Fixed

- Preserved Plex library locations during discovery so trailer files map to
  the selected media section correctly.
- Fixed partial managed-list imports, missing Plex collections, and trailers
  being written beneath a location unrelated to the selected Plex library.
- Cleared managed collections from both Plex targets when a mixed list is
  removed.

### Validation

- Passed all 215 automated tests plus TypeScript, production build, bundle,
  branding, and deployment validation.

## [2.0.36-rc.2] - 2026-08-08

### Changed

- Created Reeltrack trailer placeholders directly in normal movie folders
  beneath the configured movie library root instead of a separate `/trailers`
  staging volume.
- Defaulted and migrated Plex-visible trailer roots from `/trailers` to
  `/movies`, while retaining support for alternate Plex path mappings.
- Removed the dedicated trailer volume from Docker, Unraid, and Windows
  deployment templates.

### Fixed

- Removed only the VynodeArr-managed trailer after real media arrives and
  removed its movie folder only when the folder is empty, preserving every
  real media file.
- Identified placeholders by their exact managed trailer paths so real movie
  files in the same library root are never mistaken for placeholders.
- Fixed a fast automation-run race that could cache a completed reconciliation
  and delay detection of newly arrived media.

### Security

- Validated the final path reported by `yt-dlp` and confined downloads and
  cleanup to the configured movie root and managed title folder.

### Validation

- Passed the complete automated test, TypeScript, production build, bundle,
  branding, and deployment verification suite.

## [2.0.36-rc.1] - 2026-08-08

### Added

- Added optional managed Plex trailer collections for imported Reeltrack lists.
- Added periodic provider synchronization, Plex collection reconciliation, and
  automatic cleanup when a real library item arrives or a title leaves its
  source list.
- Integrated `yt-dlp` and FFmpeg into Docker and Unraid distributions for
  bounded official YouTube trailer downloads under the managed `/trailers`
  storage root.
- Added per-list Plex library, collection name, Plex-visible trailer path,
  update interval, run status, error details, and manual run controls.

### Changed

- Preserved Reeltrack automation settings during manual list synchronization.
- Limited each automation run to a configurable download batch so large lists
  converge without overwhelming metadata providers, storage, or Plex.
- Reconciled managed Plex collections by authoritative external IDs and treated
  any Plex item with media outside the trailer root as real media.

### Security

- Restricted trailer downloads to validated HTTPS YouTube URLs, bounded the
  downloader process, sanitized managed paths, and limited cleanup to folders
  owned beneath the configured trailer root.

### Validation

- Passed 215 automated tests, server and web TypeScript checks, production
  builds, bundle and branding checks, and deployment validation.

## [2.0.36] - 2026-08-08

### Added

- Added imported Reeltrack list views with durable external-ID library matching, missing-title requests, server-side credential storage, list synchronization, searching, and availability filters.
- Added Plex poster-overlay workflows with variable-based filtering, whole-library selection, scoped application, filtered restoration, and rollback history.
- Added Plex `Days since added` overlay values and inclusive numeric conditions, using Plex dates for Plex artwork and VynodeArr dates for VynodeArr artwork.
- Added a three-column Library Review workspace for independent Plex titles, VynodeArr titles, and scanned movie folders, including filenames, paths, TMDB identities, match filters, and title/filename mismatch highlighting.
- Added Library Review actions to repair VynodeArr matches with TMDB or IMDb identities, reuse Plex TMDB identities, add scanned folders to VynodeArr, and rename or organize selected titles using configured naming standards.

### Changed

- Reworked the Poster Overlay editor into a bounded responsive workspace with centered new layers, direct preview selection, automatic scrolling to the selected layer, and independently collapsible layer settings.
- Kept shape, icon, and text layers independent so each layer can use its own variable, conditions, prefix, suffix, and representative preview value.
- Preserved intentional leading and trailing spaces in overlay prefixes, suffixes, and conditional formatting overrides.
- Condensed Plex matching, selection, filtering, and recent-poster history into compact responsive cards and grouped matched and unmatched results.
- Made Plex, VynodeArr, and scanned-folder Library Review columns left aligned, independently searchable, independently scrollable, and incrementally loaded.

### Fixed

- Fixed overlay editor crashes caused by stale disclosure event targets, malformed legacy layer values, and oversized modal dimensions.
- Fixed incorrect or missing Plex and VynodeArr added-date calculations and ensured preview layers remain visible with representative values when live metadata is unavailable.
- Fixed library and overlay pickers stopping at their first result batch, including complete-library selection and scroll-triggered loading.
- Fixed corrected matches leaving stale library entries or old file locations behind, with safe rollback when a rematch or move fails.
- Fixed refresh-and-scan from Movie and Television details so the engine scans the selected title folder.
- Fixed IMDb-only match correction and TMDB/IMDb searching in Root Folder scans and Library Review.
- Fixed Plex-to-VynodeArr comparisons to recognize matching TMDB identities even when titles differ.

### Validation

- Passed the automated test suite, web TypeScript checks, production builds, bundle and branding checks, and deployment validation for the published release.

## [2.0.35-rc.32] - 2026-08-07

### Added

- Added a Library Review page with independent Plex and VynodeArr movie lists displayed side by side.
- Displayed each title's movie library, TMDB ID, and filename or full media path without forcing titles into paired rows.
- Added independent searching, scrolling, and Plex movie-library filtering.
- Allowed administrators to correct a selected VynodeArr match using the selected Plex title's TMDB ID or a manually entered TMDB ID.

### Validation

- Passed 210 automated tests, TypeScript checks, production builds, bundle and branding checks, and deployment validation.

## [2.0.35-rc.31] - 2026-08-07

### Fixed

- Removed stale library entries after correcting a movie or television match.
- Moved corrected matches and their existing files to the canonical folder calculated by the media engine.
- Restored the original match safely when a corrected match or folder move cannot be completed.
- Loaded additional Movies and Television library pages automatically as users scroll beyond the first result set.
- Prevented overlapping library pagination requests while retaining a manual Load more fallback.

### Validation

- Passed 208 automated tests and web TypeScript checks.

## [2.0.35-rc.30] - 2026-08-07

### Changed

- Grouped Plex match results into Matched and Not matched sections.
- Reduced every match result to its checkbox, title, year, and match status.
- Displayed grouped titles in compact responsive columns.

### Fixed

- Removed the old multi-line match metadata layout that caused title rows to overlap.

### Validation

- Passed 208 automated tests, TypeScript checks, production builds, bundle and branding checks, and deployment validation.

## [2.0.35-rc.29] - 2026-08-07

### Changed

- Condensed Plex library selection, matching controls, variable filters, and selection actions.
- Displayed matched Plex titles in responsive two-column cards on desktop.
- Displayed recent Plex poster changes in a responsive three-column card grid instead of full-width rows.

### Fixed

- Applied compact styling to the actual match-results workspace instead of the library-selection panel.
- Corrected the malformed remove-filter icon.

### Validation

- Passed 208 automated tests, TypeScript checks, production builds, bundle and branding checks, and deployment validation.

## [2.0.35-rc.28] - 2026-08-07

### Changed

- Preserved leading and trailing spaces in layer prefixes, suffixes, and conditional formatting overrides.
- Condensed Plex match controls after library synchronization.
- Consolidated repeated overlay preview, editor, badge, and review styles into one route stylesheet to prevent layout shifts during large-list rerenders.

### Fixed

- Replaced the remaining 200-title VynodeArr overlay picker cap with incremental loading through the complete filtered library.

### Validation

- Passed 208 automated tests, TypeScript checks, production builds, bundle and branding checks, and deployment validation.

## [2.0.35-rc.27] - 2026-08-07

### Added

- Added multi-variable filters for Plex poster application and rollback history.
- Added individual, filtered, entire-library, and full-library Plex apply and restore scopes.

### Changed

- Removed typed confirmation phrases from Plex poster application and restoration.
- Stored the applied title's variable values with each rollback record for deterministic filtered restoration.
- Used destination-specific added dates when rendering both Plex and VynodeArr overlays.

### Validation

- Passed 207 automated tests, TypeScript checks, production builds, bundle and branding checks, and deployment validation.

## [2.0.35-rc.26] - 2026-08-07

### Fixed

- Used VynodeArr added dates for VynodeArr styles and matched Plex added dates for Plex styles in the overlay editor.
- Preserved Plex added timestamps in multi-library match results so editor previews and conditions calculate the correct age.
- Replaced fixed overlay-library result caps with incremental batches that grow as users scroll.
- Allowed Select all matched to include the complete filtered Plex library instead of only the first 500 titles.

### Validation

- Passed 206 automated tests, TypeScript checks, production builds, bundle and branding checks, and deployment validation.

## [2.0.35-rc.25] - 2026-08-07

### Fixed

- Made Plex Days Since Added use a title's added date when preview metadata contains an empty value.
- Ensured Plex age values have a minimum of one day so conditions never receive an unusable zero value.

### Validation

- Passed 205 automated tests, TypeScript checks, production builds, bundle and branding checks, and deployment validation.

## [2.0.35-rc.24] - 2026-08-07

### Fixed

- Prevented layer-card disclosure updates from reading a cleared React event target while editing poster overlays.
- Bounded the Poster Overlay editor to the backdrop's available width and height instead of adding viewport dimensions to modal padding.
- Removed page-level horizontal and vertical overflow while retaining responsive desktop, tablet, and mobile editor layouts.

### Validation

- Passed 204 automated tests, TypeScript checks, production builds, bundle and branding checks, and deployment validation.

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

[Unreleased]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.50-rc.6...HEAD
[2.0.50-rc.6]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.50-rc.5...v2.0.50-rc.6
[2.0.50-rc.5]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.50-rc.4...v2.0.50-rc.5
[2.0.50-rc.4]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.50-rc.3...v2.0.50-rc.4
[2.0.50-rc.3]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.50-rc.2...v2.0.50-rc.3
[2.0.50-rc.2]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.50-rc.1...v2.0.50-rc.2
[2.0.50-rc.1]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.49...v2.0.50-rc.1
[2.0.49]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.48...v2.0.49
[2.0.48]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.47...v2.0.48
[2.0.47]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.46...v2.0.47
[2.0.46]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.45...v2.0.46
[2.0.45]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.44...v2.0.45
[2.0.44]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.43...v2.0.44
[2.0.43]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.42...v2.0.43
[2.0.43-rc.8]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.43-rc.7...v2.0.43-rc.8
[2.0.43-rc.7]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.43-rc.6...v2.0.43-rc.7
[2.0.43-rc.6]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.43-rc.5...v2.0.43-rc.6
[2.0.43-rc.5]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.43-rc.4...v2.0.43-rc.5
[2.0.43-rc.4]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.43-rc.3...v2.0.43-rc.4
[2.0.43-rc.3]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.43-rc.2...v2.0.43-rc.3
[2.0.43-rc.2]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.43-rc.1...v2.0.43-rc.2
[2.0.43-rc.1]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.42...v2.0.43-rc.1
[2.0.42]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.41...v2.0.42
[2.0.41]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.40...v2.0.41
[2.0.40-rc.8]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.40-rc.7...v2.0.40-rc.8
[2.0.40-rc.7]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.40-rc.6...v2.0.40-rc.7
[2.0.40-rc.6]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.40-rc.5...v2.0.40-rc.6
[2.0.40-rc.5]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.40-rc.4...v2.0.40-rc.5
[2.0.40-rc.4]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.40-rc.3...v2.0.40-rc.4
[2.0.40-rc.3]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.40-rc.2...v2.0.40-rc.3
[2.0.40-rc.2]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.40-rc.1...v2.0.40-rc.2
[2.0.40-rc.1]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.39...v2.0.40-rc.1
[2.0.39]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.38...v2.0.39
[2.0.39-rc.4]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.39-rc.3...v2.0.39-rc.4
[2.0.39-rc.3]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.39-rc.2...v2.0.39-rc.3
[2.0.39-rc.2]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.39-rc.1...v2.0.39-rc.2
[2.0.39-rc.1]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.38...v2.0.39-rc.1
[2.0.36-rc.5]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.36-rc.4...v2.0.36-rc.5
[2.0.36-rc.4]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.36-rc.3...v2.0.36-rc.4
[2.0.36-rc.3]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.36-rc.2...v2.0.36-rc.3
[2.0.36-rc.2]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.36-rc.1...v2.0.36-rc.2
[2.0.36-rc.1]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.36...v2.0.36-rc.1
[2.0.36]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.35...v2.0.36
[2.0.35-rc.24]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.35-rc.23...v2.0.35-rc.24
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
[2.0.38]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.37...v2.0.38
[2.0.38-rc.3]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.38-rc.2...v2.0.38-rc.3
[2.0.38-rc.2]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.38-rc.1...v2.0.38-rc.2
[2.0.38-rc.1]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.37...v2.0.38-rc.1
[2.0.37]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.36...v2.0.37
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
