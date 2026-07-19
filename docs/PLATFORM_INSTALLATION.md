# Platform installation status

This document separates currently working installation paths from experimental platform plans. Only Windows x64 has a completed installer pipeline today.

| Platform | Current status | Intended package |
| --- | --- | --- |
| Windows x64 | Supported development build | Inno Setup `.exe`, Windows service, tray controller |
| Linux x64 | Experimental prerelease | Tar package, installer, uninstaller, and systemd unit |
| Linux ARM64 | Packaging foundation implemented; native payload validation pending | ARM64 tar package plus systemd unit |
| Docker | Experimental image definition; local x64 image validation passed | Multi-architecture published container image pending |
| Unraid | Experimental XML template implemented; image publication and host validation pending | Community Applications XML template using the Docker image |
| TrueNAS SCALE and other container NAS platforms | Experimental | Docker/OCI image after validation |
| macOS | Not planned for the first cross-platform phase | To be evaluated after Linux support |

## Windows

End users install a published `VynodeArr-<version>-win-x64-setup.exe`, then open `http://127.0.0.1:8686/`. See [`WINDOWS_INSTALLER.md`](WINDOWS_INSTALLER.md) for maintainer build and validation instructions.

## Linux x64 experimental installation

Linux x64 packages are built from the two locked native source revisions and distributed as a versioned archive with a SHA-256 checksum. Follow [`distribution/linux/README.md`](../distribution/linux/README.md) for the GitHub download and installation commands.

The installer uses one systemd service and keeps application files, administrator configuration, and persistent data separate. A normal uninstall preserves configuration and databases; the explicit `--purge` option permanently deletes them.

## Why Linux is still experimental

The gateway targets .NET 8 and most of its supervision code is portable. Windows job-object handling already degrades to a platform-neutral path outside Windows. The complete installed product still has Windows-specific assumptions:

- Linux gateway and composition packaging exists and the matching locked x64 payloads have passed the automated end-to-end container validation;
- the tray controller targets Windows Forms;
- lifecycle installation is implemented as a Windows service;
- installed configuration uses `%ProgramData%`;
- a systemd unit, archive layout, installer, and uninstaller exist, but clean-machine systemd and distribution-specific validation remain incomplete;
- baseline Linux shutdown and container ownership pass automation, while database locking and upgrade recovery still require real-use validation.

The prerelease is intended for clean-machine testing before Linux is marked stable.

## Experimental Linux design

The planned Linux package will use one headless gateway process and no tray application.

```text
/opt/vynodearr/                 immutable application files
  gateway/
  engines/movie/
  engines/television/
/var/lib/vynodearr/            persistent state
  movie/
  television/
  unified/
/etc/vynodearr/                administrator configuration
/etc/systemd/system/           VynodeArr service unit
```

The systemd service will run as a dedicated, non-login `vynodearr` user, bind the public dashboard to a configured address, start both engines as owned children, and stop both engines before the gateway exits. Media directories will be mounted or permissioned explicitly rather than making the service root.

Planned installation flow:

1. Download a versioned Linux archive and checksum from GitHub Releases.
2. Verify the SHA-256 checksum.
3. Create the service account and persistent directories.
4. Extract immutable application files under `/opt/vynodearr`.
5. Install the supplied systemd unit and environment file.
6. Grant the service account access only to selected media and download paths.
7. Enable and start the single VynodeArr service.
8. Open the configured dashboard port.

These are design steps, not commands for the current build.

## Experimental Docker and Unraid design

The planned container will run the gateway as PID 1 and supervise both native engines. It will expose one port and use separate persistent mounts:

```text
/config/unified
/config/movie
/config/television
/movies
/tv
/downloads
```

The image must forward `SIGTERM` to the gateway, wait for both engines to stop, run as a configurable non-root UID/GID, and never combine the movie and television databases. Health checks will query the unified `/health` endpoint.

Unraid support will be an XML Community Applications template over the same tested image. The template will expose:

- dashboard port;
- unified, movie, and television configuration paths;
- movie, television, and download media paths;
- UID, GID, and timezone settings;
- optional additional path mappings.

There will not be a separate Unraid-only application runtime. Keeping Unraid on the same OCI image avoids platform drift.

## Cross-platform acceptance criteria

Before Linux or container installation is marked supported, the experimental branch must prove:

- repeatable `linux-x64` engine and gateway builds from locked source revisions;
- repeatable `linux-arm64` builds before advertising ARM64;
- one shutdown action stops both child engines without orphans;
- movie and television databases remain distinct through install and upgrade;
- media and configuration paths survive container replacement or package upgrade;
- process ownership works without Windows job objects;
- `SIGTERM`, systemd stop, Docker stop, and host restart all shut down cleanly;
- upgrades preserve configuration and provide rollback instructions;
- Docker runs without root after initial volume permission setup;
- Unraid path mappings work with common download-client layouts;
- clean-install, upgrade, backup/restore, and uninstall tests pass on each advertised architecture.

## Experimental implementation order

1. Add runtime identifiers and packaging layouts for `linux-x64`.
2. Build locked Linux-native movie and television payloads.
3. Add platform-neutral signal and process-tree integration tests.
4. Add a systemd unit, environment file, installer, and uninstaller.
5. Add a multi-stage Dockerfile and Compose validation fixture.
6. Validate non-root permissions and persistent volumes.
7. Add the Unraid Community Applications template.
8. Add `linux-arm64` only after both engine source trees build and run on ARM64.
9. Publish prerelease artifacts from the experimental branch for clean-machine testing.
