# Implementation roadmap

- **N1 complete:** contracts, architecture, inventories, strategy, fixture UI.
- **N2 complete:** secure GET-only adapters, normalized gateway, cache/sync,
  local authentication, real-or-fixture UI, detail/operation pages, Docker and
  Unraid review packaging.
- **N3 recommended:** durable platform database, durable/revocable sessions,
  artwork proxy, incremental synchronization, structured audit/metrics,
  capability/version matrix, signed container CI, accessibility and end-to-end
  browser automation.
- **N4:** carefully authorized commands, queue actions, providers, and domain
  workflows with RBAC/idempotency/audit. No mutation begins before N3 security
  and persistence gates pass.

Future media domains join through capability-described adapters and never
expand Movie or TV into an inaccurate generic record.
