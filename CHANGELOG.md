# Changelog

All notable VynodeArr changes will be recorded in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.5...HEAD
[2.0.5]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.2...v2.0.3
