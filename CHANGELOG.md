# Changelog

All notable VynodeArr changes will be recorded in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.13...HEAD
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
