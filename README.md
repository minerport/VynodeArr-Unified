# VynodeArr

VynodeArr is one self-hosted application for managing movie and television libraries. It presents one dashboard, one Windows service, one installer, and one system-tray controller while keeping the movie and television engines operationally isolated.

> VynodeArr is under active development. Back up existing media-manager configuration before testing upgrades.

## What works today

- Unified dashboard at `http://127.0.0.1:8686/`
- Complete movie interface under `/movies/`
- Complete television interface under `/television/`
- Persistent navigation between Dashboard, Movies, and Television
- Independent movie and television databases, settings, queues, commands, logs, and data roots
- Combined library, wanted, queue, download, and health summaries
- Independent start and stop controls for each media engine
- One action to shut down the gateway and both engines
- One Windows service and one notification-area controller
- Branded installer, executables, tray icon, Start menu entry, and desktop shortcut
- Graceful uninstall shutdown with forced VynodeArr-only cleanup as a fallback
- Automatic dashboard refresh during engine start and stop transitions

The movie and television payloads remain separate processes. A failure, command, database migration, or configuration change in one domain is not routed into the other domain.

## Architecture

```text
Browser
  |
  v
VynodeArr Gateway :8686
  |-- /                    Unified dashboard
  |-- /movies/*            Movie engine proxy
  |-- /television/*        Television engine proxy
  |-- /api/unified/v1/*    Unified status and lifecycle API
  |
  |-- VynodeArr Movies     Private loopback process and data
  `-- VynodeArr Television Private loopback process and data
```

The locked engine revisions and provenance are recorded in [`distribution/source-lock.json`](distribution/source-lock.json). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SOURCE_INVENTORY.md`](docs/SOURCE_INVENTORY.md), and [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for the detailed design and roadmap.

## Windows installation

VynodeArr currently targets 64-bit Windows. Run the latest `VynodeArr-<version>-win-x64-setup.exe` from the project’s GitHub Releases when a release is published.

The installer creates:

- Windows service: `VynodeArr`
- Application files: `C:\Program Files\VynodeArr`
- Movie data: `C:\ProgramData\VynodeArr\movie`
- Television data: `C:\ProgramData\VynodeArr\television`
- Unified state: `C:\ProgramData\VynodeArr\unified`
- Desktop and Start menu shortcuts
- One notification-area controller that starts with the signed-in user

Open `http://127.0.0.1:8686/` after installation. The tray menu can open the dashboard, start the service, or shut down the gateway and both engines.

Uninstall removes services and program files but intentionally preserves `C:\ProgramData\VynodeArr` so library settings and databases are not silently destroyed.

Detailed instructions:

- [`docs/WINDOWS_INSTALLER.md`](docs/WINDOWS_INSTALLER.md) — build and test the Windows installer
- [`docs/PLATFORM_INSTALLATION.md`](docs/PLATFORM_INSTALLATION.md) — current Windows, Linux, Docker, Unraid, and other-platform status

Linux, Docker, NAS, and Unraid packages are being developed on the experimental `agent/cross-platform-installation` branch. They are not yet supported releases; the platform guide records the remaining engineering and validation work without presenting untested commands as production instructions.

## Development

Requirements:

- .NET SDK 8.0.423 or a compatible 8.0 patch selected by `global.json`
- PowerShell 7 or Windows PowerShell
- Windows x64 for producing the complete installer
- Inno Setup 7 for installer compilation
- Reviewed movie and television engine payloads for full runtime packaging

Build and test the gateway:

```powershell
dotnet restore VynodeArr.Unified.sln
dotnet build VynodeArr.Unified.sln --configuration Release --no-restore
dotnet test VynodeArr.Unified.sln --configuration Release --no-build
dotnet run --project src/VynodeArr.Gateway
```

The development configuration keeps both native engines disabled until their reviewed executables are supplied. The health endpoint remains available at `http://127.0.0.1:8686/health`.

## Building the Windows installer

Stage reviewed engine builds and compile the installer:

```powershell
.\distribution\windows\package.ps1 `
  -MovieEnginePath C:\path\to\movie-build `
  -TelevisionEnginePath C:\path\to\television-build `
  -SkipArchive

.\distribution\windows\build-installer.ps1 `
  -IsccPath "$env:LOCALAPPDATA\Programs\Inno Setup 7\ISCC.exe" `
  -Version 0.3.3
```

Generated packages are written under `artifacts/` and excluded from Git. Publish installers as GitHub Release assets rather than committing generated binaries.

## Library import note

Movie Library Import expects one directory per movie. Loose media files directly inside a root folder are not import candidates.

```text
E:\Movies\Movie Title (Year)\movie-file.mkv
```

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before changing engine lifecycle, proxy routing, packaging, or data isolation behavior. Changes must keep both domains independently testable and must not merge their databases, dependency-injection containers, background jobs, or command buses.

## Source and licensing

The locked movie and television source repositories are both distributed under GPL-3.0. Their repository URLs and exact revisions are recorded in the source lock and source inventory. Preserve upstream copyright and license notices when redistributing engine payloads.

VynodeArr is an independent project and is not affiliated with or endorsed by the Radarr or Sonarr projects.
