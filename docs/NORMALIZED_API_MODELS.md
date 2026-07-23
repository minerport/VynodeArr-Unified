# Normalized API models

Executable schemas live in `packages/contracts/src/models.js`.

- Library: `MovieSummary`, `MovieDetails`, `SeriesSummary`, `SeriesDetails`,
  `SeasonSummary`, `EpisodeSummary`, `MediaArtwork`.
- Policy/config: `MediaStatus`, `MonitoringStatus`, `QualityProfile`,
  `CustomFormat`, `RootFolder`, `DownloadClient`, `Indexer`.
- Operations: `QueueItem`, `HistoryItem`, `CalendarItem`, `HealthItem`,
  `CommandItem`, `SearchResult`.

Public IDs are opaque strings. Dates are UTC ISO-8601. Optional domain fields
remain explicit rather than being collapsed into a misleading generic media
record. Public API errors use `{ error: { code, message } }` and neutral
VynodeArr messages.
