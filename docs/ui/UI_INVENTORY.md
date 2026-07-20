# UI inventory

## Scope and evidence

Assessment baseline: unified commit `7ac0b2c`, Movies `de481131`, Television `a29f15e9`. The inventory was produced from both locked frontend source trees and the unified gateway shell. The existing rendered dashboard and Movies import screen supplied during installation testing were reviewed. Other pages below are source-reviewed, not claimed as newly rendered.

All engine routes are preserved below their proxy bases: `/movies` and `/television`. Paths in the tables are engine-relative.

## Unified shell

| Route | Purpose and actions | Layout/components | Finding | Risk |
| --- | --- | --- | --- | --- |
| `/` | Combined status, enter either engine, start/stop engines, shut down all | `UnifiedShell.Html`, summary panels, persistent top links | Functional but embedded HTML/CSS/JS, limited hierarchy, no reusable frontend package | Medium |
| `/movies/*` | Proxy complete Movies app | `EngineProxy`, `NativeShellBranding` | Injected 46px header preserves native UI but creates a second navigation layer | High |
| `/television/*` | Proxy complete Television app | Same adapter with engine branding | Same shell, different native router/state runtime | High |

## Movies routes

| Route | Purpose / main actions / data | Existing pattern and components | Pain point / safe opportunity | Risk |
| --- | --- | --- | --- | --- |
| `/` | Library; filter, sort, select, bulk edit/search, grid/overview/table | `MovieIndex`, poster/overview/table views, toolbar/menu primitives | Dense controls need clearer grouping; preserve every view and bulk action | High |
| `/add/new` | Search and add movies | lookup results, root folder/profile/monitor controls | Improve progressive disclosure and sticky add summary | Medium |
| `/add/import` | Import organized movie folders | folder browser, import rows, warnings | Keep one-folder-per-movie rule visible; improve permission/error recovery | High |
| `/add/discover` | Discover recommendations and add | poster/overview results, filters | Align card states and engine accent | Medium |
| `/collections` | Browse/manage collections | collection grid/table and actions | Standardize header/filter density | Medium |
| `/movie/:titleSlug` | Details, files, history, search, edit, delete | artwork header, metadata, action toolbar, history/file panels | Strong candidate for compact status summary and sticky actions | High |
| `/calendar` | Release calendar and commands | calendar toolbar, month/list behavior | Unified shell may later add combined view; native route remains | High |
| `/activity/queue` | Queue, progress, remove/retry | virtualized/table rows, status details, bulk actions | Make error reason and progress easier to scan | High |
| `/activity/history` | Event history and filtering | paged table/filter menu | Add engine context only in unified surfaces | Medium |
| `/activity/blocklist` | Blocked releases and removal | table, confirmation flows | Preserve destructive confirmations | Medium |
| `/wanted/missing` | Missing monitored movies; search/bulk actions | paged table, filters, select mode | Sticky filters and stronger state labels | High |
| `/wanted/cutoffunmet` | Files below cutoff | paged table and bulk search | Same density improvements, distinct semantics | High |
| `/settings` | Settings landing page | category links/cards | Searchable index can be additive | Low |
| `/settings/mediamanagement` | Naming, files, root folders, permissions | `FormGroup`, path inputs, sections | Sticky save/dirty state; retain movie naming rules | High |
| `/settings/profiles` | Quality/delay/release profiles | sortable lists, drag/drop, modals | Add accessible move controls before visual redesign | High |
| `/settings/quality` | Quality definitions/sizes | forms/tables | Normalize fields without changing validation | Medium |
| `/settings/customformats` | Custom format rules and scores | cards/tables, specification modals | Complex engine-owned editor; theme only initially | High |
| `/settings/indexers` | Indexers, restrictions, tests | provider cards, modals, test actions | Shared provider chrome possible, data remains engine-owned | High |
| `/settings/downloadclients` | Clients, remote mappings, queue behavior | provider cards, modals, tables | Preserve test and priority semantics | High |
| `/settings/importlists` | Lists and exclusions | provider cards, exclusion tables | Movie behavior differs from TV processing | High |
| `/settings/connect` | Notifications/connections | provider cards and test modal | Shared visual wrapper is low risk | Medium |
| `/settings/metadata` | Metadata consumers | provider cards/forms | Engine-specific fields | Medium |
| `/settings/tags` | Tag CRUD and usage | table/modals | Shared styling candidate | Low |
| `/settings/general` | Host, security, proxy, update settings | long forms, advanced settings | Dangerous controls need explicit sectioning | High |
| `/settings/ui` | theme, date/time, language, UI behavior | form sections | Natural entry point for future VynodeArr density/motion prefs | Medium |
| `/system/status` | versions, health, disk, runtime info | status sections, health/disk components | Add unified status center separately; retain native detail | Medium |
| `/system/tasks` | scheduled tasks and run commands | table with command state | Improve in-row progress feedback | Medium |
| `/system/backup` | create/download/restore/delete backups | table/cards, confirmations | Restore is high-risk; style only | High |
| `/system/updates` | update history and install | update cards/actions | Engine update behavior must remain isolated | High |
| `/system/events` | structured logs/events | paged table, level filters | Improve density and monospace hierarchy | Medium |
| `/system/logs/files`, `/system/logs/files/update` | download/view app/update logs | file lists | Preserve nested route behavior | Low |
| `*` | not found | `NotFound` | Unified error pattern can wrap, not replace | Low |

## Television routes and differences

Routes shared by name with Movies have the same broad purpose and risk classification above, but use Television implementations and data. Unique/different routes:

| Route | Purpose / main actions / data | Difference | Risk |
| --- | --- | --- | --- |
| `/` | Series library, grid/overview/table, bulk editor | Series, seasons, next/previous airing and episode statistics | High |
| `/add/new` | Lookup/add series | series type, season folder, monitor-new-seasons behavior | High |
| `/add/import/*`, `/add/import/:rootFolderId` | Select root then import series | Nested Router 7 flow; not interchangeable with Movies import | High |
| `/series/:titleSlug` | Series details | season expansion, episode rows, episode search/monitor/file actions | Very high |
| `/statistics` | Series/episode/file statistics | No Movies equivalent | Medium |
| `/serieseditor`, `/seasonpass` | Compatibility redirects to library | Preserve aliases | Low |
| `/settings/metadatasource` | Metadata source settings | Television-only | High |
| `/system/logs/files/*` | Nested app/update logs | Router 7 wildcard rather than Movies route pair | Low |

Television does not expose Movies `/collections` or `/add/discover` routes at this revision. Movies does not expose Television `/statistics` or metadata-source settings. These must not be normalized away.

## Component families reviewed

Shell/header/sidebar, page toolbar, menus, links/buttons, forms and validation, provider cards, modal/focus-lock, tables/virtualized lists, poster/overview cards, calendar, queue/history/wanted tables, settings sections, status/health/disk, logs, backups, updates, loading/error/empty/not-found states, tooltips/popovers, pagination, filters/sort/view menus, notifications/messages, file browser, confirmation dialogs, authentication/general settings, and import workflows.

The Movies tree contains roughly 468 TSX and 375 CSS files; Television contains roughly 610 TSX and 357 CSS files. Similar filenames are evidence of lineage, not proof of interchangeable behavior.
