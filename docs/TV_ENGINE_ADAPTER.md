# TV engine adapter

`TvEngineAdapter` reads series/details, artwork metadata, network/status,
series/season/episode monitoring, progress, missing/cutoff counts, next airing,
episode files/quality, profiles, root reference, tags, queue, history, calendar,
health, and system status.

Public IDs use `series_*` and `episode_*`. A detail read combines the series and
episode projections so season monitoring and episode availability remain
domain-correct. Multi-level TV structures are never collapsed into movie-like
records. All engine calls are GET-only.
