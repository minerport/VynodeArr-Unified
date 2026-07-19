# Windows packaging

The package pipeline treats both native applications as immutable payloads. It does not combine assemblies, databases, configuration files, or web assets.

## Layout

```text
VynodeArr-win-x64/
  gateway/                  self-contained supervisor/gateway
  tray/                     notification-area controller and shortcut launcher
  branding/                 installer and shell branding assets
  engines/movie/            complete native movie application
  engines/television/       complete native television application
  data/                     initially empty; populated after installation
  source-lock.json          exact source revisions and expected entry points
  package-manifest.json     SHA-256 and size of every packaged file
```

## Create a staging package

Build both native repositories using their own release pipelines and assemble complete payloads:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\distribution\windows\build-native-engines.ps1 `
  -MovieSource C:\src\VydodeArr `
  -TelevisionSource C:\src\VynodeArr2 `
  -YarnJs C:\tools\yarn-1.22.22\bin\yarn.js `
  -NodePath C:\tools\node.exe
```

The script verifies both locked Git revisions and refuses tracked source modifications. It preserves each native output layout, UI, updater, Windows host, and license. Sonarr's `NU1510` restore diagnostic is demoted during the build without editing its source.

Then create the unified package:

```powershell
.\distribution\windows\package.ps1 `
  -MovieEnginePath .\artifacts\native-inputs\movie `
  -TelevisionEnginePath .\artifacts\native-inputs\television
```

The command fails before packaging if either native entry point is missing. Output is written only under `artifacts/windows`, which is excluded from source control.

## Compile the installer

Install Inno Setup 7 and compile the staged package:

```powershell
.\distribution\windows\build-installer.ps1 `
  -IsccPath "$env:LOCALAPPDATA\Programs\Inno Setup 7\ISCC.exe" `
  -Version 0.3.3
```

The installer registers one `VynodeArr` Windows service, creates branded Start menu and desktop shortcuts, starts one notification-area controller, and places application files under `C:\Program Files\VynodeArr`. Persistent domain data remains isolated under `C:\ProgramData\VynodeArr` and is preserved during uninstall.

During uninstall, the tray launcher first requests a graceful gateway shutdown. The gateway stops both native engines and closes their Windows job object. The installer then stops and removes the service and performs VynodeArr-specific process cleanup before deleting program files.

Generated packages and installers remain under `artifacts/`, which is excluded from source control. Upload approved installers as GitHub Release assets rather than committing them to the repository.
