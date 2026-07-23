# Movie source capability inventory

Review baseline: `de4811318ef1eb6560a5e480cc4bba2afc008ca9`.
The working tree was clean before review. This document is development-only.

## Library and metadata

Movie CRUD, lookup, bulk editor, alternate titles, credits, images, collections,
tags, import lists/exclusions, minimum availability, monitoring, root folders,
folder import, refresh/rescan, and statistics are represented across
`src/Radarr.Api.V3/{Movies,Collections,Credits,MediaCovers,ImportLists,Tags}` and
`src/NzbDrone.Core/{Movies,MetadataSource,RootFolders,ImportLists}`. Principal
entities include Movie, MovieFile, AlternativeTitle, Collection,
CollectionMovie, Credit, ExtraFile, Tag, and ImportListExclusion.

Important workflow: lookup → choose root/quality/minimum availability/monitoring
→ add → refresh metadata → disk scan → optionally search. Existing folders,
duplicates, changed paths, inaccessible roots, collection monitoring, editions,
deleted records versus deleted files, and unavailable metadata are distinct
outcomes.

## Acquisition and files

Indexer RSS sync, automatic/interactive search, release parsing and scoring,
grab, delay/restriction/custom-format decisions, download-client dispatch,
queue tracking, completed-download handling, failed-download blocklisting,
manual import/reprocess, replacement, rename, recycling, permissions, disk
space, and remote-path mapping are implemented under
`src/NzbDrone.Core/{Indexers,IndexerSearch,DecisionEngine,Download,Queue,
MediaFiles,Organizer,Parser,Blocklisting,DiskSpace,RemotePathMappings}` with APIs
under `Indexers`, `DownloadClient`, `Queue`, `ManualImport`, `MovieFiles`,
`Blocklist`, `Profiles`, `CustomFormats`, and `Config`.

Key edge cases: ambiguous parsing; wrong movie/year/edition; password-protected
or incomplete downloads; cross-device moves; duplicate files; sample/extra
files; upgrades below/above cutoff; hardlinks; read-only destinations; no free
space; category mismatch; removed downloads; and repeated failures.

## Wanted and automation

Missing and cutoff-unmet views, movie/collection searches, refresh/rescan,
rename, RSS, housekeeping, import-list sync, metadata consumers, health checks,
backups, updates, and scheduled tasks flow through `Wanted`, `Commands`,
`System/Tasks`, `Calendar`, `History`, `Health`, `System/Backup`, and `Update`
controllers plus `NzbDrone.Core/{Jobs,Messaging,Housekeeping,History,Backup,
HealthCheck,Update}`. Commands are asynchronous and observable; schedules must
avoid overlapping work and retain failure state.

## Settings, operations, and integration

Supported surfaces include quality profiles/definitions, custom formats,
release and delay profiles, restrictions, indexers, download clients, metadata,
notifications/webhooks, naming/media management, host/UI settings, security and
authentication, API keys, localization, remote paths, tags, root folders,
logs/update logs, system status, disk space, backup/restore, and application
updates. Provider implementations expose schema/test/test-all/enable/priority
patterns.

## API and UI rebuild targets

Important resources/controllers include Movie, MovieLookup, MovieEditor,
MovieFile, Collection, Release, Queue, ManualImport, Missing, Cutoff, Calendar,
History, Blocklist, Command, Task, Health, Notification, Indexer,
DownloadClient, QualityProfile, CustomFormat, RootFolder, Backup, Update, Log,
DiskSpace, and configuration controllers. The source frontend supplies
usability evidence for library, add/search, details, editor, wanted, activity,
calendar, collections, settings, and system workflows; no page, theme, asset,
navigation, or source DTO is reused.

## VynodeArr mapping

Movie records/files/collections/availability/search/import/naming stay in
`movie-domain`. Providers, normalized queue/history/calendar, commands,
scheduling, health, identity, notifications, audit, settings, secrets, backup
orchestration, and UI preferences move to `platform`. N1 implements read-only
list/get/search and bounded wanted/collection fixture behavior; remaining
operations are explicit contract methods that fail closed.
