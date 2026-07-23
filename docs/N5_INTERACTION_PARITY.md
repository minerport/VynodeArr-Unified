# N5 interaction parity

VynodeArr does not expose, embed, proxy, or restyle either upstream web
application. Feature parity means recreating each user outcome in the native
VynodeArr design while the private services remain the system of record.

## Workflow inventory

The live bundled applications and their source route definitions were reviewed
against the following interaction groups.

| Area | Required native workflows |
| --- | --- |
| Library | Grid/table/overview views, search, sort, filters, custom filters, bulk select/edit/delete, refresh, rescan, rename preview, manual import |
| Add and import | Metadata lookup, discovered/recommended titles, folder import, root/profile/monitoring choices, duplicate handling, immediate search |
| Movie details | Edit monitoring/profile/path/availability, files, history, releases, search, refresh/scan, rename, delete with independent file choice, collections |
| Television details | Series/season/episode monitoring, series type, season folders, episode files, episode/season/series search, rename, delete choices |
| Acquisition | RSS sync, automatic and interactive search, release scoring/rejection reasons, grab, queue retry/remove/blocklist, completed/failed handling |
| Wanted | Missing and cutoff-unmet paging/filtering, per-item and bulk search |
| Activity | Queue, history, blocklist, details, failed-item handling and retry |
| Calendar | Agenda/month views, domain filters, monitoring state, feed options |
| Profiles | Quality, delay, release, language where supported, custom formats and scoring |
| Providers | Indexers, download clients, import lists, notifications, metadata; schema-driven add/edit, enable, priority, test, test-all, delete |
| Storage | Root folders, remote path mappings, naming examples, permissions, recycling, free-space status |
| General | Host, authentication boundary, proxy, logging, update branch/mechanism, UI/time/date/certificate settings |
| System | Status, health, disk space, scheduled tasks/run-now, backups/create/restore/delete, updates, events and log files |

## Implemented native workflows

- Search-and-add for movies and television with root folder, quality profile,
  monitoring, availability, series type, season folder, and immediate-search
  choices.
- Automatic writable root-folder setup for bundled local services.
- Native root-folder management with path entry, accessibility, free space,
  unmapped-folder status, and protected removal.
- Native quality-profile creation and editing with upgrade/cutoff behavior,
  allowed quality groups, custom-format scores, and protected deletion.
- Movie/series edit, search, refresh/scan, and safe library removal actions.
- Missing and cutoff-unmet views with per-item searches.
- Queue progress, warnings, retry, and removal.
- Guided schema-driven provider creation plus the complete advanced field
  representation returned by the service.
- Unified status, disk space, tasks/run-now, backups/create, updates, and events.
- Extended gateway resources for blocklist, releases, files, parse, rename,
  filesystem, remote paths, provider schemas, host/UI settings, logs, and
  system operations.

## Remaining parity work

The following still requires purpose-built interaction screens rather than only
advanced gateway access: bulk library editing, folder import, discovery
recommendations, interactive release search/grab with rejection explanations,
manual import mapping, file rename preview/apply, collection management,
season/episode bulk monitoring, blocklist/history actions, calendar display
options, custom-format scoring designers, provider test/test-all actions,
backup restore/download/delete, log-file download, and safe service restart.

These items must remain visible in the milestone acceptance checklist until a
live create/update/delete or command test passes through VynodeArr for both
domains.
