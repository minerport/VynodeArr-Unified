# Implementation plan

## Phase 0 — Baseline and contracts

- Record exact source revisions and licenses.
- Build and test each source independently.
- Capture OpenAPI documents and route inventories.
- Capture database schema snapshots without merging them.
- Add API contract fixtures for core library, calendar, activity, queue, history, command, settings, and health responses.
- Define domain identity, command, event, error, pagination, and authentication envelopes.

Exit criterion: both unmodified engines pass their native checks and adapter contract tests can run against fixed fixtures.

## Phase 1 — Supervisor and gateway

- Create a .NET supervisor targeting the chosen product runtime.
- Allocate loopback ports and isolated data folders.
- Start, probe, restart, and stop both child engines.
- Refuse traffic until each child passes its native readiness endpoint.
- Proxy namespaced API and event traffic.
- Add unified health showing each engine independently.
- Ensure one engine can be unavailable while the other remains usable.

Exit criterion: one Windows process/service exposes both engines through namespaced routes, with failure-isolation tests.

Current validation: both locked Windows x64 engines have been built with their native SDKs and UIs, launched from a unified staged package, authenticated through private per-engine API keys, queried through namespaced status routes, and stopped without orphaned staged processes.

## Phase 2 — Unified shell

- Create top navigation with Movies and Television destinations.
- Add separate API clients, caches, event streams, and error boundaries.
- Mount existing movie and TV functionality behind domain routes.
- Preserve all settings and actions; avoid combined mutations.
- Add application settings distinct from engine settings.

Exit criterion: every existing destination is reachable from one origin and all original actions target the correct engine.

Current validation: the unified root launcher, both native index pages, static assets, movie/series deep links, API authentication, SignalR negotiation, and real WebSocket upgrades pass through one origin while retaining separate engine processes and URL bases.

## Phase 3 — Combined read views

- Combined calendar with movie/episode discriminators.
- Combined activity, queue, history, wanted summary, health, disk space, and global search.
- Domain filters and deep links back to native detail screens.
- Normalize progress and status without erasing domain-specific fields.

Exit criterion: combined screens are fully read-capable and cannot issue an ambiguous mutation.

## Phase 4 — Native unified screens

- Replace compatibility-hosted screens incrementally.
- Extract proven shared UI primitives and design tokens.
- Keep movie and TV feature modules separate.
- Add cross-domain command palette and dashboard.

Exit criterion: principal workflows are native to the unified shell with parity tests against both source products.

## Phase 5 — Packaging, migration, and recovery

- Build one Windows installer and service.
- Stage complete immutable engine payloads with a source lock and SHA-256 package manifest.
- Add per-engine import/restore assistants.
- Add composite backup manifest and independent restore.
- Add upgrade compatibility matrix and rollback.
- Verify clean install, upgrade, uninstall, service recovery, and data preservation.

Exit criterion: repeatable signed Windows artifacts pass installation and recovery tests on clean virtual machines.

## Required regression suites

- Movie library add/edit/delete/refresh/search/import/rename/move
- Series add/edit/delete/refresh, season monitoring, episode search/import/rename/move
- Torrent and Usenet download-client flows with distinct categories
- Manual and interactive import for both domains
- Indexers, restrictions, profiles, custom formats, root folders, remote mappings
- Calendar, wanted, queue, history, blocklist, notifications, import lists
- Authentication, base URL, reverse proxy, API keys, SignalR, localization
- SQLite and PostgreSQL, backup/restore, upgrades, Windows service lifecycle
- Cross-domain negative tests proving IDs, commands, downloads, paths, events, and failures cannot leak

## First implementation slice

Build the supervisor with stub engines before importing product binaries. The first executable behavior should be:

1. Read a unified configuration file.
2. create `data/movie`, `data/television`, and `data/unified`;
3. allocate two private loopback ports;
4. start configurable child commands;
5. expose `/health` with separate movie and television states;
6. shut down both children cleanly;
7. prove by automated test that either child can crash without terminating the other.

Only after that contract is reliable should real engine builds be placed under `engines/`.
