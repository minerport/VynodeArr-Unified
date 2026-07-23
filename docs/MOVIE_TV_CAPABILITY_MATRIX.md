# Movie and TV capability matrix

Source abbreviations in this development-only inventory: `M/API` =
`src/Radarr.Api.V3`; `M/Core` = `src/NzbDrone.Core`; `T/API` =
`src/Sonarr.Api.V3`; `T/Core` = `src/NzbDrone.Core`.

| Capability | Movie | TV | Class | Source / APIs | Services / entities / jobs | UI / behavior | Target | Priority | Status |
|---|---|---|---|---|---|---|---|---|---|
| Library list/details | Yes | Yes | shared_with_domain_policy | M/API Movies; T/API Series | Movie/MovieFile; Series/Season/Episode/EpisodeFile; refresh/scan | Cards, table, details; different stats | domain engines + gateway | P0 | N1 fixture |
| Add/lookup/edit/delete record | Yes | Yes | shared_with_domain_policy | Movie/Series Lookup, Editor controllers | metadata, root, profiles; refresh/search commands | TV adds type, seasons, monitoring policy | domain engines | P0 | Contract |
| Monitoring | Movie | Series/season/episode | domain-specific | Movie, SeasonPass, Episodes | monitored flags; wanted jobs | hierarchical TV overrides | movie_domain / tv_domain | P0 | Model proof |
| Availability/airing | Minimum availability | Air dates/status | domain-specific | Movies; Episodes/Calendar | Movie availability; Episode air dates | different calendar meaning | domain engines | P0 | Inventory |
| Series type/numbering | No | Standard/daily/anime | tv_domain | T/Core Tv, Parser | Episode, alternate/scene/absolute numbers | affects parse/search/naming | tv_domain | P0 | Inventory |
| Specials/multi-episode | No | Yes | tv_domain | Episodes/EpisodeFiles | one file ↔ many episodes | special season and combined releases | tv_domain | P0 | Inventory |
| Collections | Yes | No equivalent | movie_domain | M/API Collections | Collection/CollectionMovie; refresh | collection monitoring | movie_domain | P1 | Contract |
| Root folders | Yes | Yes | shared_with_domain_policy | RootFolders APIs | RootFolder, disk provider | validate path/access/free space | platform + policy | P0 | Model |
| Quality profiles/definitions | Yes | Yes | shared_with_domain_policy | Profiles/Quality, Qualities | QualityProfile, QualityDefinition | domain item applicability | platform + policy | P0 | Model |
| Custom formats | Yes | Yes | shared_with_domain_policy | CustomFormats | specifications, scores | score/cutoff effects | platform + policy | P0 | Model |
| Delay/release restrictions | Yes | Yes | shared_with_domain_policy | Profiles/Delay, Profiles/Release | delay profiles, restriction specs | domain release parsing differs | platform + policy | P1 | Inventory |
| Indexers/RSS | Yes | Yes | shared_with_domain_policy | Indexers/Release | indexer factory, RSS sync command | category/capability filtered | platform + adapters | P0 | Model |
| Interactive search | Movie | Series/season/episode | domain-specific | Release controllers | search services, decision engine | scope and grouping differ | domain engines | P0 | Contract |
| Automatic/wanted search | Missing/cutoff | Missing/cutoff episodes | domain-specific | Wanted, Commands | search missing/cutoff commands | eligibility policies differ | domain engines + commands | P0 | Contract |
| Grab | Yes | Yes | shared_with_domain_policy | Release controllers | download service, decision result | normalized action/result | platform + policy | P0 | Inventory |
| Download clients | Yes | Yes | shared_platform | DownloadClient controllers | provider repository/factory | schema/test/priority/tags | platform | P0 | Model |
| Queue | Yes | Yes | shared_with_domain_policy | Queue controllers | tracked downloads; refresh job | normalize domain/media/progress | platform | P0 | Model |
| Completed downloads | Movie import | Episode mapping/import | domain-specific | ManualImport, Download | import services; completed scan | TV pack/multi-episode matching | domain engines | P0 | Inventory |
| Failed downloads/blocklist | Yes | Yes | shared_with_domain_policy | Blocklist, Queue actions | failure service, blocklist | retry/remove/redownload policy | platform + domain | P0 | Inventory |
| Manual import | Yes | Yes | domain-specific | ManualImport | parser/import decision/mover | Movie identity vs episode mapping | domain engines | P0 | Inventory |
| Rename/naming | Movie tokens | Series/season/episode tokens | domain-specific | Rename, Config/Naming | organizer/naming config | distinct examples and folder rules | domain engines | P1 | Inventory |
| Recycle bin/permissions | Yes | Yes | shared_platform | MediaManagement config | recycle provider, disk/filesystem | safety and retention | platform | P1 | Inventory |
| Import lists | Movies/collections | Series | shared_with_domain_policy | ImportLists | list sync commands/exclusions | add options differ | platform + domain | P1 | Inventory |
| Tags/auto-tagging | Yes | Yes | shared_with_domain_policy | Tags, AutoTagging | Tag, specifications | domain fields differ | platform + policy | P1 | Inventory |
| Calendar | Availability/release | Episode air date | shared_with_domain_policy | Calendar/feed | date aggregation | one view, domain filters | platform | P0 | Contract |
| History | Movie events | Episode/series events | shared_with_domain_policy | History | History records | normalized event types | platform | P0 | Model |
| Commands/jobs | Yes | Yes | shared_platform | Commands, System/Tasks | command queue/scheduler | progress/cancel/idempotency | platform | P0 | Model |
| Health/system/disk | Yes | Yes | shared_platform | Health, System, DiskSpace | health checks, disk provider | neutral messages | platform | P0 | Model |
| Notifications/webhooks | Yes | Yes | shared_with_domain_policy | Notifications | provider factory/event bus | event payloads normalized | platform | P1 | Inventory |
| Metadata consumers | Movie metadata/extras | Series/episode metadata | domain-specific | Metadata | consumer factories | paths and content differ | domain engines | P2 | Inventory |
| Backup/restore | Yes | Yes | shared_platform | System/Backup | backup/restore commands | coordinate isolated databases | platform | P1 | Inventory |
| Updates | Yes | Yes | shared_platform | Update | update check/install command | hidden engine lifecycle | platform | P2 | Inventory |
| Logs | Yes | Yes | shared_platform | Logs | instrumentation/log files | redact and rebrand normal messages | platform | P0 | Inventory |
| Authentication/API | Yes | Yes | shared_platform | Host/Security + HTTP | auth middleware/API keys | one session/RBAC | platform | P0 | Shell only |
| UI preferences/localization | Yes | Yes | shared_platform | Config/Ui, Localization | config repository | one experience | platform + web | P1 | Shell |
| Audit/secrets | Partial operational logging/config | Partial | shared_platform | Security/Configuration | future Audit/Secret stores | required explicit platform concern | platform | P0 | Planned |
| Music/subtitles/requests | No | No | future_domain_extension | Future adapters | capability descriptors | add navigation only when registered | platform registry | P3 | Planned |

## Database and migration conclusion

Do not merge source schemas. N2 requires independently versioned
`platform`, `movie-engine`, and `tv-engine` stores. Platform migrations create
User, Role, Session, Secret, Provider, Indexer, DownloadClient, Schedule,
Command, QueueProjection, HistoryProjection, CalendarProjection, HealthEvent,
AuditEvent, AppSetting, and UiPreference. Domain entities remain isolated until
their behavior and migration history can be extracted with parity tests.
