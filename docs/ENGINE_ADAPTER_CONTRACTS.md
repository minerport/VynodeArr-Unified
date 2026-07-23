# Engine adapter contracts

`MovieDomain` supports list/get/search/add/update/delete-record, refresh, scan,
release search, missing and cutoff search, files, history, calendar, and
collections.

`TvDomain` supports list/get/search/add/update/delete-record, refresh, scan,
seasons, episodes, monitoring at series/season/episode scope, release search at
series/season/episode scope, missing and cutoff search, files, history, and
calendar.

Platform contracts are `ProviderAdapter`, `IndexerAdapter`,
`DownloadClientAdapter`, `MetadataAdapter`, `QueueService`, `CommandService`,
`SchedulerService`, `HealthService`, `NotificationService`, `HistoryService`,
and `CalendarService`.

Adapters must translate IDs, enums, dates, pagination, errors, and capabilities;
redact secrets; apply timeouts; support cancellation/idempotency for commands;
and never forward internal responses to a public client. Registry validation
fails closed when an operation is missing.
