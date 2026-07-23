# VynodeNew architecture

## Stack decision

N1 uses dependency-light ECMAScript modules on Node.js 20 and an original
standards-based web UI. This avoids inheriting source dependencies, makes the
contracts directly executable, and keeps the proof portable. A later milestone
may introduce TypeScript compilation, a component framework, and PostgreSQL
after persistence and deployment constraints are agreed.

## Components

- `apps/web`: owned UI and static assets; consumes only normalized `/api/v1`.
- `apps/api`: gateway, public error boundary, and static host.
- `packages/contracts`: normalized models and operation sets.
- `packages/platform`: domain engine registry; future shared services.
- `packages/movie-domain`: isolated Movie contract implementation.
- `packages/tv-domain`: isolated TV contract implementation.
- `infrastructure`: future packaging and service topology.

No browser call reaches an engine directly. Movie and TV engines cannot be
substituted for one another. Shared platform services will own identity,
providers, queue normalization, commands, scheduling, health, notifications,
audit, settings, secrets, activity, calendar, and history.

## Persistence direction

Use a platform database for users, roles, providers, schedules, commands,
normalized queue/history/calendar projections, health, audit, and preferences.
Retain isolated Movie and TV engine databases until extraction is safe.
Migrations must be independently versioned per database and never cross-write.
