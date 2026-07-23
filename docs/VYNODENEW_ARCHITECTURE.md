# VynodeNew architecture

```text
Browser → Authenticated VynodeNew gateway → durable projections
                                        ├─ MovieEngineAdapter → Movies engine
                                        └─ TvEngineAdapter    → TV engine
```

The gateway owns first-run setup, users/roles, durable sessions, CSRF and rate
limits, encrypted engine configuration, validation, normalization, artwork
proxy/cache, synchronization, projections, and aggregation. No credential,
internal engine URL, or source DTO reaches the browser.

Atomic versioned JSON stores provide installable N3 persistence without a
database service. `AuthService`, `EngineSettingsService`, and `ProjectionStore`
are contracts that can move to a transactional database later. Startup migrates
N2 users and hydrates projections before serving product APIs.

The engines remain read-only sources of truth. Synchronization compares public
IDs/content to count incremental changes, writes projections atomically, and
serves stale data during recoverable failures. The non-root container persists
all owned state under `/data`.
