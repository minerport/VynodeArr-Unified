# Building and testing the Windows installer

This guide creates the self-contained 64-bit Windows installer. It is intended for maintainers producing reviewed VynodeArr builds, not for end users who only need to run a published installer.

## Requirements

- 64-bit Windows 10 or Windows 11
- Git
- PowerShell 7 or Windows PowerShell 5.1
- .NET SDK selected by `global.json` (currently .NET 8.0.423 with latest-patch roll-forward)
- Node.js and Yarn 1.22.22 for native frontend builds
- The SDK required by each locked native source revision
- Inno Setup 7
- Enough free space for both source trees, native builds, staging output, and the compressed installer

The exact movie and television source revisions are authoritative in `distribution/source-lock.json`. Do not package a different revision without reviewing it and updating the lock and source inventory.

## 1. Verify the unified source

From the VynodeArr repository root:

```powershell
git status --short
dotnet restore VynodeArr.Unified.sln
dotnet build VynodeArr.Unified.sln --configuration Release --no-restore
dotnet test VynodeArr.Unified.sln --configuration Release --no-build
```

The worktree should be clean and all tests should pass before packaging.

## 2. Build the locked native engines

Clone the standalone movie and television repositories separately and check out the revisions recorded in the source lock. Then run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\distribution\windows\build-native-engines.ps1 `
  -MovieSource C:\src\VydodeArr `
  -TelevisionSource C:\src\VynodeArr2 `
  -YarnJs C:\tools\yarn-1.22.22\bin\yarn.js `
  -NodePath C:\tools\node.exe
```

The script verifies both Git revisions and refuses tracked modifications. Its default output is:

```text
artifacts/native-inputs/movie/
artifacts/native-inputs/television/
```

Confirm that `Radarr.Console.exe` exists in the movie output and `Sonarr.Console.exe` exists in the television output. Those filenames are compatibility entry points internal to the packaged engines; users see VynodeArr branding.

## 3. Stage the unified application

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\distribution\windows\package.ps1 `
  -MovieEnginePath .\artifacts\native-inputs\movie `
  -TelevisionEnginePath .\artifacts\native-inputs\television `
  -SkipArchive
```

This publishes the self-contained gateway and tray controller, copies both immutable engine payloads, adds branding, applies the installed ProgramData configuration, and generates SHA-256 entries in `package-manifest.json`.

Staged output is written to:

```text
artifacts/windows/VynodeArr-win-x64/
```

## 4. Compile the installer

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\distribution\windows\build-installer.ps1 `
  -IsccPath "$env:LOCALAPPDATA\Programs\Inno Setup 7\ISCC.exe" `
  -Version 0.3.3
```

Replace `0.3.3` with the version being released. The resulting file is:

```text
artifacts/installer/VynodeArr-<version>-win-x64-setup.exe
```

Do not commit staged applications or installers. `artifacts/` is intentionally ignored. Approved binaries should be attached to a GitHub Release with a published SHA-256 checksum.

## 5. Clean-machine validation

Test the installer in a Windows virtual machine or other clean environment:

1. Install without an existing VynodeArr installation.
2. Confirm one `VynodeArr` Windows service exists.
3. Confirm the branded desktop and Start menu shortcuts exist.
4. Confirm one VynodeArr notification-area icon appears after sign-in.
5. Open `http://127.0.0.1:8686/` and verify Dashboard, Movies, and Television navigation.
6. Stop and start Movies; verify its card transitions and refreshes while Television stays running.
7. Stop and start Television; verify the inverse isolation behavior.
8. Upgrade over the previous released version and confirm ProgramData is retained.
9. Uninstall and confirm the tray, gateway, service, and both owned engines stop before files are removed.
10. Confirm `C:\ProgramData\VynodeArr` remains after uninstall.

Do not validate process cleanup by killing every process named Radarr or Sonarr. VynodeArr cleanup must remain scoped to its owned processes and installation paths so unrelated installations are not affected.

## Troubleshooting

- If PowerShell blocks a script, invoke it with `powershell.exe -ExecutionPolicy Bypass -File` as shown above.
- If `gh`, `dotnet`, or Inno Setup was just installed, open a new terminal so Windows refreshes `PATH`.
- If port 8686 is occupied, identify the owning process before testing. Do not run two VynodeArr gateways against the same data root.
- If native packaging rejects a revision, compare it with `distribution/source-lock.json`; do not bypass the lock.
