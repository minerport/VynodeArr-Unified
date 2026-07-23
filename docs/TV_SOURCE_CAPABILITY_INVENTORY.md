# TV source capability inventory

Review baseline: `a29f15e92bd2c21e646d065d9d78066952cac05d`.
The working tree was clean before review. This document is development-only.

## Library and episodic metadata

Series CRUD, lookup/import/editor, alternate titles, seasons, episodes, episode
files, season pass, images, monitoring, root folders, tags, import lists, and
statistics appear across `src/Sonarr.Api.V3/{Series,Episodes,EpisodeFiles,
SeasonPass,MediaCovers,RootFolders,ImportLists,Tags}` and
`src/NzbDrone.Core/{Tv,MetadataSource,MediaFiles,RootFolders}`. Principal
entities include Series, Season, Episode, EpisodeFile, AlternateTitle, and
scene/alternate numbering data.

Add workflow: lookup → choose root/quality/series type/season folders/monitoring
policy → add → refresh → scan → optional search. Monitoring can change at
series, season, or episode granularity and future, missing, existing, all, or
none policies must expand without losing explicit overrides.

## Episodic differences and edge cases

Standard series use season/episode numbering; daily series key releases by air
date; anime may use absolute numbers and alternate scene numbering. Specials,
unknown seasons, unaired episodes, alternate titles, delayed metadata, series
renames, multi-episode files, split/combined releases, season packs, partial
packs, and numbering disagreements require dedicated matching logic. A single
EpisodeFile may satisfy several Episode records. Season folders and series
types are not movie concepts.

## Acquisition and files

RSS, automatic search, interactive series/season/episode search, release
parsing/scoring, grab, queue, completed/failed-download handling, manual import,
rename, quality/custom-format/delay/restriction decisions, blocklisting, remote
paths, disk space, permissions, and download-client interaction live under
`src/NzbDrone.Core/{Indexers,IndexerSearch,DecisionEngine,Download,Queue,
MediaFiles,Organizer,Parser,Blocklisting,RemotePathMappings}` with corresponding
V3 API controllers. Searches must distinguish episode, season-pack, and
series-level intent.

## Wanted and automation

Missing/cutoff episode views, future monitoring, series refresh/rescan, series/
season/episode search, rename, RSS, housekeeping, import-list sync, health,
metadata, backups, updates, and schedules use `Wanted`, `Commands`,
`System/Tasks`, `Calendar`, `History`, `Health`, `System/Backup`, and `Update`
controllers with core Jobs/Messaging services. Calendar reflects air dates and
time zones, not movie availability dates.

## Settings, operations, and integration

Shared-looking settings cover root folders, quality profiles/definitions,
custom formats, release/delay profiles, restrictions, indexers, download
clients, naming/media management, metadata, notifications/webhooks, tags,
remote paths, host/UI configuration, authentication/API, localization, logs,
health, backups/restore, updates, disk space, and failed downloads. TV naming
adds series title, season, episode, absolute number, air date, multi-episode
tokens, specials, and season-folder rules.

## API and UI rebuild targets

Important controllers/resources include Series, SeriesLookup, SeriesEditor,
SeasonPass, Episode, EpisodeFile, RenameEpisode, Release, Queue, ManualImport,
Missing, Cutoff, Calendar, History, Blocklist, Command, Task, Health,
Notification, Indexer, DownloadClient, QualityProfile, CustomFormat,
RootFolder, Backup, Update, Log, DiskSpace, and configuration. Library, series
details/season expansion, episode monitoring, wanted, calendar, activity,
settings, and system experiences must be rebuilt with original VynodeArr UI.

## VynodeArr mapping

Series/seasons/episodes/files/types/numbering/monitoring/search/import/naming stay
in `tv-domain`. Shared operational concerns move to `platform` behind
domain-policy hooks. N1 implements bounded list/get/search fixture behavior and
explicit episodic progress/next-episode fields; mutations remain fail-closed.
