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

Phase 1 is in progress: the supervisor/gateway foundation now models independent movie and television processes, isolated data roots, health, recovery, and namespaced proxy routes. Both engines remain disabled by default until reviewed binaries are supplied. No source code from either engine has been modified.

## Development

The supervisor/gateway targets .NET 8 LTS and is pinned by `global.json`. Each packaged media engine retains its own native runtime, including the television engine's .NET 10 baseline.

```powershell
dotnet restore VynodeArr.Unified.sln
dotnet build VynodeArr.Unified.sln --no-restore
dotnet run --project src/VynodeArr.Gateway
```

With the default safe configuration, browse to `http://127.0.0.1:8686/health`. Both engines will report `disabled` until their executable paths and `Enabled` flags are configured. Port 8686 intentionally avoids the native Radarr and Sonarr defaults.
