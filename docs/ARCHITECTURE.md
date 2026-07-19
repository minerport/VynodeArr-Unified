# Unified movie and television architecture

## Decision

Present one application to the user, but preserve Radarr and Sonarr as isolated domain engines behind a supervisor and gateway. Do not perform a source-level merge of their `NzbDrone.Core`, API, database, messaging, or frontend stores.

This is a modular-process architecture, not two unrelated applications in two browser tabs. The installed product has one launcher, one public HTTP endpoint, one authentication boundary, and one shell. Internally it owns two loopback-only engines.

## Evidence from the source trees

The compared revisions are:

- Movie source: `minerport/VydodeArr` at `de4811318ef1eb6560a5e480cc4bba2afc008ca9`, reset from Radarr `develop`.
- Television source: `minerport/VynodeArr2` at `a29f15e92bd2c21e646d065d9d78066952cac05d`, copied from Sonarr `v5-develop`.

### Scale and divergence

| Area | Movie | Television | Same paths | Byte-identical | Divergent same paths |
| --- | ---: | ---: | ---: | ---: | ---: |
| Backend `src` files | 2,653 | 3,026 | 1,791 | 732 | 1,059 |
| Frontend `frontend/src` files | 1,859 | 1,640 | 1,020 | 632 | 388 |
| Database migration files | 150 | 235 | n/a | n/a | n/a |

Most overlap is common ancestry, not a stable shared library. More than a thousand backend paths exist in both trees with different contents.

### Toolchain divergence

| Concern | Movie engine | Television engine | Consequence |
| --- | --- | --- | --- |
| .NET SDK | 8.0.421 | 10.0.302 | Build and host independently initially |
| React | 18.3.1 | 18.3.1 | Compatible rendering baseline |
| Router | react-router-dom 5.2.0 | react-router-dom 7.15.1 | Routes cannot be copied into one runtime unchanged |
| State | Redux 4 and legacy reducer creators | newer frontend without the same Redux dependency | Use adapters, not a merged global store |
| Webpack | 5.95.0 | 5.105.2 | Build independently until shell contract stabilizes |
| API | V3 | V3 and V5 | Gateway must normalize and version its own contract |

### Domain seams

The movie engine owns movies, movie files, collections, movie discovery, credits, movie naming, movie parsing, availability, and movie-specific import decisions.

The television engine owns series, seasons, episodes, episode files, statistics, scene mappings, episode numbering, air schedules, series types, and episode-specific import decisions.

Both contain similarly named infrastructure for indexers, download clients, queue, history, wanted, calendar, profiles, custom formats, notifications, import lists, root folders, health, commands, tasks, backup, update, localization, authentication, and SignalR. Similar naming does not establish identical behavior.

### Collision evidence

The engines currently share 23 command class names, including `RssSyncCommand`, `ManualImportCommand`, `RenameFilesCommand`, `ImportListSyncCommand`, `CheckForFinishedDownloadCommand`, and `ProcessMonitoredDownloadsCommand`.

They also share 33 event class names, while carrying separate domain events such as `MovieFileImportedEvent` and `EpisodeImportedEvent`. Loading both assemblies into one dependency-injection container or message bus would risk handler discovery collisions, duplicate scheduled jobs, ambiguous serialization names, and cross-domain execution.

The default services already use different ports (7878 and 8989) and different SQLite database names (`radarr.db` and `sonarr.db`). Those existing boundaries should be retained behind the unified product.

## Runtime topology

```text
Browser
  |
  v
Unified gateway and UI :8686 (public product endpoint)
  |-- /api/unified/*        -> shell, combined views, preferences
  |-- /api/movies/*         -> movie adapter -> movie engine (loopback dynamic port)
  |-- /api/television/*     -> TV adapter    -> TV engine (loopback dynamic port)
  |-- /events/movies        -> translated movie event stream
  `-- /events/television    -> translated TV event stream

Supervisor
  |-- Movie engine process  -> data/movie/{config.xml,radarr.db,logs.db,logs,...}
  `-- TV engine process     -> data/television/{config.xml,sonarr.db,logs.db,logs,...}
```

The gateway is the only public listener. Internal engine ports bind to loopback and are selected/configured by the supervisor. The supervisor owns startup order, readiness, restart policy, shutdown, version compatibility, and health reporting.

## Non-interference rules

1. Each engine runs in its own OS process and dependency-injection container.
2. Each engine has an independent application-data directory.
3. SQLite files and migration histories are never combined.
4. PostgreSQL deployments use different database names and credentials by default.
5. Command endpoints require an explicit domain namespace; no unqualified command endpoint exists in the unified API.
6. Event envelopes contain `domain`, `engineVersion`, `contractVersion`, `eventType`, `correlationId`, and payload.
7. Download-client categories must be domain-specific by default to prevent one engine importing the other's downloads.
8. Root folders are configured per domain. Shared physical disks are allowed, shared library root paths are rejected unless an advanced override is deliberately enabled.
9. Remote path mappings, naming rules, quality profiles, custom formats, tags, import lists, and metadata providers remain domain-owned.
10. Backups and restores operate per engine. A product backup is a manifest plus two engine backups and unified settings.
11. Updating one engine cannot migrate, stop, or replace the other engine.
12. Combined screens are read models. Mutations are routed to exactly one engine.

## Gateway contract

The gateway must not expose raw upstream API paths as its permanent public contract. Adapters translate engine responses into versioned unified contracts while a compatibility endpoint can proxy advanced settings during early phases.

Core resource identity is a discriminated key:

```json
{
  "domain": "movie",
  "engineId": "movie-primary",
  "resourceType": "movie",
  "resourceId": 42
}
```

For television, an episode identity additionally carries its series and season context. Numeric IDs are never globally unique.

Commands use an envelope:

```json
{
  "domain": "television",
  "command": "EpisodeSearch",
  "target": { "episodeIds": [101, 102] },
  "idempotencyKey": "..."
}
```

The adapter allowlists commands and validates domain-specific targets before forwarding. Arbitrary command-name proxying is prohibited.

## Frontend architecture

The first unified UI preserves the familiar visual language but assigns all routes a domain:

- `/movies`, `/movies/add`, `/movies/movie/:titleSlug`, `/movies/wanted/*`
- `/television`, `/television/add`, `/television/series/:titleSlug`, `/television/wanted/*`
- `/calendar`, `/activity`, and `/search` are combined read views with domain filters.
- `/settings/movies/*` and `/settings/television/*` expose domain-owned settings.
- `/settings/application/*` controls the shell, gateway, authentication, and supervisor.

Frontend state is split into `shell`, `movies`, and `television` namespaces. The movie and television API clients have separate base URLs, caches, request cancellation, SignalR/event connections, error boundaries, and feature flags. A failure or loading state in one domain must not block the other.

Initially, existing domain screens should be hosted through compatibility boundaries while the unified shell and normalized combined screens are built. Shared components may be extracted only when their inputs, behavior, accessibility, and tests are equivalent. Same filename is not sufficient evidence.

## Shared capabilities policy

Download clients, indexers, notifications, authentication, and visual settings look like duplication to users. They must still remain separate in Phase 1. Later, the shell can offer a deliberate “copy configuration to other domain” workflow that calls both APIs and reports partial failure. It must never silently make one database authoritative for both engines.

A future credentials vault may hold shared secrets, but each engine receives an explicit materialized configuration and retains independent validation.

## Windows installation

The target package installs:

- `VynodeArr.exe` supervisor/gateway
- `engines/movie/*`
- `engines/television/*`
- `ui/*`
- one Windows service owned by the supervisor

Program binaries belong under Program Files. Mutable state belongs under a single VynodeArr data root with `movie`, `television`, and `unified` children. Service recovery restarts the supervisor; the supervisor independently recovers its children.

Existing Radarr/Sonarr installations are imported by copying or restoring into the appropriate isolated domain directory after version checks. The installer must never point both engines at an existing shared directory.

## Rejected designs

### Merge both `NzbDrone.Core` trees into one assembly

Rejected because divergent common files, command/event name collisions, reflection-based registration, incompatible migration histories, and difficult upstream rebasing make regression risk unacceptable.

### One combined database

Rejected because migration numbering and shared table names have diverged. It would also couple backup, restore, downgrade, and corruption domains.

### Rename every Sonarr or Radarr namespace

Rejected because it creates a permanent high-conflict fork and does not solve database, routes, scheduled work, frontend generation, or behavioral divergence.

### Two iframes as the final product

Rejected as a final architecture because authentication, navigation, keyboard behavior, URLs, overlays, accessibility, and combined views remain fragmented. Compatibility embedding may be used only as a temporary migration aid.

## Upstream maintenance

The movie and TV engines are imported from the user's standalone repositories, never pushed back to upstream Radarr or Sonarr. Product-specific patches should be narrow and carried as separate commits or patch queues. Prefer adapter and supervisor changes outside engine trees. Each engine is built and tested at its native toolchain version.
