# Synchronization and cache

Startup synchronization reads both libraries. Subsequent requests use a
bounded in-memory projection (default 5,000 records per domain), while polling
refreshes it every five minutes by default. `POST /api/system/sync` performs a
CSRF-protected manual refresh without modifying an engine.

The durable versioned projection records status, last success/failure, duration,
item count, and items changed by ID/content comparison.
A successful refresh replaces a domain atomically. A failed refresh returns
the last projection as stale when available; otherwise the UI receives a
neutral unavailable state. Invalidation is domain-scoped or global.

Projection files are written atomically and hydrate memory at startup. A future
database-backed store can replace this implementation without changing routes.
Engines remain the source of truth.
