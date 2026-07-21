# VynodeArr installers

This directory is the permanent installer index for builds produced by the VynodeArr project.

## Where installer files are stored

Installer executables are kept in two places:

1. **Local build workspace:** maintainers place newly built files in this directory for checksum and release preparation.
2. **GitHub Releases:** approved binaries are uploaded as release assets so users can download them.

The `.exe`, `.msi`, and `.zip` files in this directory are intentionally ignored by Git. GitHub rejects normal repository files larger than 100 MB, and the complete VynodeArr Windows installer is approximately 282 MB. Committing installers would also permanently inflate every clone of the source repository.

The tracked [`manifest.json`](manifest.json) records each approved installer’s version, filename, size, SHA-256 checksum, platform, architecture, and release URL.

## Current Windows installer

- Version: `0.4.7`
- Filename: `VynodeArr-0.4.7-win-x64-setup.exe`
- Platform: Windows x64
- SHA-256: `4FD5AA6F2E21D0EA4C944A352E9889A3F7416C56BDAD1DC3D8ABB8E55F4D974E`
- Download: [VynodeArr v0.4.7 release](https://github.com/minerport/VynodeArr-Unified/releases/tag/v0.4.7)

## Adding a future installer

When working on a release branch or `main`:

1. Build and validate the installer using the [Windows packaging guide](../distribution/windows/README.md).
2. Copy the resulting binary into `installers/` locally.
3. Calculate its SHA-256 checksum:

   ```powershell
   Get-FileHash .\installers\VynodeArr-<version>-win-x64-setup.exe -Algorithm SHA256
   ```

4. Add its metadata to `manifest.json`.
5. Commit the manifest and documentation, but not the ignored binary.
6. Create the matching GitHub Release and upload the binary as a release asset.
7. Confirm the uploaded asset size and checksum match the manifest.

Prerelease or experimental installers should use a prerelease tag and must not replace the stable entry until their installation, upgrade, shutdown, and uninstall checks pass.
