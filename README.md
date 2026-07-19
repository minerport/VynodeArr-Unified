# VynodeArr Unified

VynodeArr Unified is one application for managing movies and television while keeping both media domains operationally isolated.

This is the standalone `minerport/VynodeArr-Unified` repository. The two source products remain unchanged while their reviewed native builds are composed behind an isolation boundary.

## Foundation architecture

- One Windows installer and supervisor
- One browser origin and navigation shell
- VynodeArr Movies for movie library management
- VynodeArr Television for series, season, and episode management
- Separate processes, configuration, databases, migrations, queues, commands, events, logs, and update lifecycles
- A gateway exposing namespaced contracts to the unified frontend
- Shared UI primitives only after behavior is proven equivalent

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the detailed analysis and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the staged build plan.

## Current status

Phase 2 is in progress. The supervisor/gateway runs independent movie and television processes with isolated data roots, health, recovery, private credentials, and namespaced proxy routes. A unified launcher at `/` mounts the complete native movie UI under `/movies` and television UI under `/television`, including deep links and SignalR. Source development keeps both engines disabled until reviewed binaries are supplied; packaged Windows builds enable both. No source code from either engine has been modified.

## Development

The supervisor/gateway targets .NET 8 LTS and is pinned by `global.json`. Each packaged media engine retains its own native runtime, including the television engine's .NET 10 baseline.

```powershell
dotnet restore VynodeArr.Unified.sln
dotnet build VynodeArr.Unified.sln --no-restore
dotnet run --project src/VynodeArr.Gateway
```

With the default safe configuration, browse to `http://127.0.0.1:8686/health`. Both engines will report `disabled` until their executable paths and `Enabled` flags are configured. Port 8686 intentionally avoids the native Radarr and Sonarr defaults.

When packaged engines are enabled, browse to `http://127.0.0.1:8686/` for an independent movie/television library, monitoring, download, missing-item, queue, and health summary. Choose Movies or Television to enter the full native interface. Native functionality remains at `/movies/` and `/television/`; the gateway selects the correct private engine API and event stream by route.

## Windows packaging

The Windows package is a self-contained x64 gateway plus reviewed VynodeArr Movies and VynodeArr Television payloads. It installs one `VynodeArr` Windows service and listens on `http://127.0.0.1:8686/`.

- Program binaries: `C:\Program Files\VynodeArr`
- Persistent movie data: `C:\ProgramData\VynodeArr\movie`
- Persistent television data: `C:\ProgramData\VynodeArr\television`
- Unified state: `C:\ProgramData\VynodeArr\unified`

Build the staged payload, then compile the installer:

```powershell
.\distribution\windows\package.ps1 `
  -MovieEnginePath .\runtime\native\movie `
  -TelevisionEnginePath .\runtime\native\television `
  -SkipArchive

.\distribution\windows\build-installer.ps1 `
  -IsccPath "$env:LOCALAPPDATA\Programs\Inno Setup 7\ISCC.exe" `
  -Version 0.1.0
```

Generated packages remain under `artifacts/` and are intentionally excluded from Git. Uninstalling removes the service and program files but deliberately preserves the data under `C:\ProgramData\VynodeArr`.
