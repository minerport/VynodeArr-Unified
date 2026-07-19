# Shared component assessment

| Candidate | Movies / Television reality | Safe shared API and migration | Risk / decision |
| --- | --- | --- | --- |
| App shell | Gateway injection surrounds separate apps | links, engine context, health, collapse state | Medium; share now |
| Tokens/theme | Nearly parallel JS theme variables with different accents/domain keys | CSS variables + adapters | Low; share first |
| Page header/breadcrumb | Related native headers, different stores/router APIs | presentational wrapper receiving labels/actions | Medium |
| Engine badge | Missing as a first-class primitive | `engine`, label, state, icon | Low |
| Status badge | Many icons/labels and domain states | semantic tone + icon + visible label | Medium |
| Button/icon button | Similar markup; implementation drift | tokens first; extraction later | Medium |
| Form group/validation | Related components; state/save differs | styling contract only initially | High |
| Modal/confirm | Both use focus lock and destructive flows | theme and accessibility tests; no logic extraction | High |
| Table | Similar visual family; row/data/bulk behavior differs | density/column tokens and wrappers | High |
| Empty/error/skeleton | Repeated presentation, low domain logic | title, message, action, engine, state | Low |
| Tooltip/menu | Router/floating libraries differ | visual contract, not shared runtime | Medium |
| Poster card | Movie vs series status and actions differ | shared frame/status slots with engine adapters | High |
| Queue progress | Similar API concepts, differing models/actions | presentation model adapter | High |
| Health card | Gateway already normalizes summary counts | unified summary component | Medium |
| Settings section | Similar layout, different schemas/side effects | header/help/sticky save wrapper only | High |

Remain engine-specific: movie/series details, seasons/episodes, collections, discover, statistics, imports, naming, metadata source, custom-format editors, provider schemas, update/backup execution, monitoring rules, and all API/store hooks.

Extraction rule: share only when behavior, accessibility contract, error handling, and test surface are explicit. Similar markup alone is insufficient.
