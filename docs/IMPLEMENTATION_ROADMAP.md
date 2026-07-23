# Implementation roadmap

## N1 — foundation (this milestone)

Neutral contracts, registry/gateway, deterministic Movie and TV proofs,
original UI shells, source inventories, strategy ADR, licensing boundary,
branding gate, and executable tests.

## N2 — secure adapter pilot

Add authentication/session management, secrets, provider registry, capability
discovery, read-only engine adapters, pagination, normalized health, structured
logging, contract tests, and container isolation. Keep databases separate.

## N3 — shared operations

Implement queue, commands/jobs, scheduler, activity, history/calendar
aggregation, notifications, indexers/download clients, and audit. Add safe
mutation workflows with idempotency and role checks.

## N4 — domain workflows

Implement add/edit/search/import/rename/wanted flows independently for Movies
and TV, including episodic edge cases, backup/restore, upgrade strategy, and
production migration tests.

Future domains plug into the platform through capability-described adapters;
they do not expand the Movie or TV models into an unbounded generic entity.
