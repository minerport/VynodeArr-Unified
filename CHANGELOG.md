# Changelog

All notable VynodeArr changes will be recorded in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.4...HEAD
[2.0.4]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/minerport/VynodeArr-Unified/compare/v2.0.2...v2.0.3
