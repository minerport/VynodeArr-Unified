# Windows packaging

The package pipeline treats both native applications as immutable payloads. It does not combine assemblies, databases, configuration files, or web assets.

## Layout

```text
VynodeArr-win-x64/
  gateway/                  self-contained supervisor/gateway
  engines/movie/            complete native movie application
  engines/television/       complete native television application
  data/                     initially empty; populated after installation
  source-lock.json          exact source revisions and expected entry points
  package-manifest.json     SHA-256 and size of every packaged file
```

## Create a staging package

Build both native repositories using their own documented release pipelines, then run:

```powershell
.\distribution\windows\package.ps1 `
  -MovieEnginePath C:\build\VydodeArr `
  -TelevisionEnginePath C:\build\VynodeArr2
```

The command fails before packaging if either native entry point is missing. Output is written only under `artifacts/windows`, which is excluded from source control.

The staged directory is the input for the final Windows installer project. Installer work will add service registration, Program Files placement, ProgramData data roots, upgrade detection, rollback, and uninstall-with-data-preservation around this unchanged payload layout.
