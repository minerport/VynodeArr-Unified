# VynodeArr

VynodeArr is one self-hosted application for managing movie and television libraries. It presents one dashboard, one Windows service, one installer, and one system-tray controller while keeping the movie and television engines operationally isolated.

> VynodeArr is under active development. Back up existing media-manager configuration before testing upgrades.

VynodeArr 0.4.8 uses one authenticated control center. Users sign in once at the dashboard; the private Movies and Television engines trust only the loopback gateway and do not present separate login prompts. See [`docs/AUTHENTICATED_CONTROL_CENTER.md`](docs/AUTHENTICATED_CONTROL_CENTER.md) and [`SECURITY.md`](SECURITY.md).

## What works today

- Unified dashboard at `http://127.0.0.1:8686/`
- Complete movie interface under `/movies/`
- Complete television interface under `/television/`
- Persistent navigation between Dashboard, Movies, and Television
- Independent movie and television databases, settings, queues, commands, logs, and data roots
- Combined library, wanted, queue, download, and health summaries
- Color-coded 30-day movie and television calendar summaries
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

The tracked [`installers/`](installers/) index identifies approved builds, checksums, and download locations. Installer binaries are stored as GitHub Release assets because they exceed GitHub's normal source-file size limit.

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
- [`docs/CROSS_PLATFORM_REVIEW.md`](docs/CROSS_PLATFORM_REVIEW.md) — portability findings, implemented foundation, and release gates

## Linux installation

The supported Linux x64 package is published in [VynodeArr 0.4.8](https://github.com/minerport/VynodeArr-Unified/releases/tag/v0.4.8). Download the archive and checksum, verify them, extract the package, and run `sudo ./install.sh`. Detailed commands, service management, permissions, upgrades, and uninstall instructions are in [`distribution/linux/README.md`](distribution/linux/README.md).

## Docker and Unraid

The validated x86-64 container is:

```text
ghcr.io/minerport/vynodearr-unified:0.4.8
```

For Unraid, install VynodeArr from Community Applications after the listing is approved, or load [`templates/vynodearr.xml`](templates/vynodearr.xml) as a user template. The default mappings are:

| Container path | Default Unraid path | Purpose |
| --- | --- | --- |
| `/config` | `/mnt/user/appdata/vynodearr` | Persistent VynodeArr configuration and databases |
| `/movies` | `/mnt/user/movies` | Movie library |
| `/tv` | `/mnt/user/tv` | Television library |
| `/downloads` | `/mnt/user/downloads` | Shared download-client path |

The container runs as Unraid `nobody:users` (`99:100`). Every mapped directory must be writable by that identity. Never map existing Radarr or Sonarr appdata into `/config`; VynodeArr must keep its own application data. Existing media folders may be shared, but use unique download-client categories such as `vynode-movies` and `vynode-tv` to prevent multiple managers from processing the same downloads.

Generate a lifecycle control key before installation:

```bash
openssl rand -hex 32
```

Enter the result in the required **Lifecycle Control Key** template field. See [`distribution/docker/README.md`](distribution/docker/README.md) for Docker details and [`docs/PLATFORM_INSTALLATION.md`](docs/PLATFORM_INSTALLATION.md) for platform status.

### Connecting other applications

Applications that normally connect to Radarr or Sonarr can use VynodeArr's public gateway without exposing either native engine port. Configure the applications with these URL bases:

- Movies: `http://VYNODEARR_HOST:8686/movies`
- Television: `http://VYNODEARR_HOST:8686/television`

Use the API key displayed by the corresponding engine under **Settings > General > Security**. The movie and television API keys are intentionally separate. On Unraid, use the Unraid server address or a resolvable container hostname instead of `127.0.0.1`; localhost inside another container refers to that other container.

Only native API routes under `/movies/api/*` and `/television/api/*` accept engine API-key authentication. Dashboard pages and all non-API engine routes continue to require the VynodeArr login. The gateway validates each supplied key against the selected engine and forwards the request over its private loopback connection.

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
  -Version 0.4.8
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
