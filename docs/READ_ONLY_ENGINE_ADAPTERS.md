# Read-only engine adapters

N2 connects separately running Movies and TV engines through internal HTTP
adapters. The browser sees only `/api/media`, `/api/activity`, `/api/calendar`,
and `/api/system`. Internal response objects, service locations, credentials,
stack traces, and source-specific messages never cross the gateway.

The adapters implement list/detail, queue, history, calendar, health, status,
and mutation-free connection testing. The contracts contain no add, edit,
delete, search, grab, import, rename, or settings-write operation. Gateway
requests other than the explicit synchronization and authentication operations
return `405 Read-only review mode`.

Fixtures implement the same contracts and are selected only when
`VYNODENEW_DATA_MODE=fixture`. Fixture and engine records are never combined.
