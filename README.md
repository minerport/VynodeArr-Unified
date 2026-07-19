# VynodeArr Unified

VynodeArr Unified is the local integration workspace for one application that manages both movies and television without blending the Radarr and Sonarr domain engines.

This repository is intentionally not connected to GitHub yet. The two source products remain unchanged while the integration boundary is built and reviewed.

## Foundation architecture

- One Windows installer and supervisor
- One browser origin and navigation shell
- A movie engine derived from `minerport/VydodeArr`
- A television engine derived from `minerport/VynodeArr2`
- Separate processes, configuration, databases, migrations, queues, commands, events, logs, and update lifecycles
- A gateway exposing namespaced contracts to the unified frontend
- Shared UI primitives only after behavior is proven equivalent

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the detailed analysis and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the staged build plan.

## Current status

Phase 0 is in progress: architecture, collision analysis, and non-interference contracts. No source code from either engine has been modified.
