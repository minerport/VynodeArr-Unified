# Synchronization and cache

Startup synchronization reads both libraries. Subsequent requests use a
bounded in-memory projection (default 5,000 records per domain), while polling
refreshes it every five minutes by default. `POST /api/system/sync` performs a
CSRF-protected manual refresh without modifying an engine.

The projection records status, last success/failure, duration, and item count.
A successful refresh replaces a domain atomically. A failed refresh returns
the last projection as stale when available; otherwise the UI receives a
neutral unavailable state. Invalidation is domain-scoped or global.

The interface is intentionally persistence-agnostic. A future database-backed
projection can replace the in-memory cache without changing public routes.
Engines remain the source of truth.
