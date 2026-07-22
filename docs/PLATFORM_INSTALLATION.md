# Platform installation status

VynodeArr 0.4.8 supports Windows x64, Linux x64, Docker x86-64, and Unraid x86-64 from one repository and one pair of locked movie and television engine revisions.

| Platform | Status | Package |
| --- | --- | --- |
| Windows x64 | Supported | Inno Setup `.exe`, Windows service, and tray controller |
| Linux x64 | Supported | Versioned tar package, installer, uninstaller, and systemd unit |
| Docker x86-64 | Supported | `ghcr.io/minerport/vynodearr-unified:0.4.8` |
| Unraid x86-64 | Supported | Community Applications XML template using the supported container |
| Linux ARM64 | Not yet supported | Packaging option exists; native runtime validation is still required |
| Other x86-64 container hosts | Supported where OCI containers and bind mounts are available | Same Docker image |
| macOS | Not currently supported | No release package |

## Windows x64

Install `VynodeArr-0.4.8-win-x64-setup.exe` from the GitHub release, then open `http://127.0.0.1:8686/`. The installer creates one Windows service and one tray controller. Uninstall stops the gateway and both engines before removing application files, while preserving `C:\ProgramData\VynodeArr` unless the user removes it explicitly.

See [`WINDOWS_INSTALLER.md`](WINDOWS_INSTALLER.md) for maintainer build and validation instructions.

## Linux x64

Download the versioned archive and checksum from the GitHub release and follow [`distribution/linux/README.md`](../distribution/linux/README.md). The installer creates a dedicated non-login `vynodearr` account, installs immutable application files under `/opt/vynodearr`, stores persistent state under `/var/lib/vynodearr`, and installs one systemd service.

The service keeps operating-system and application directories read-only without imposing a fixed media-path allowlist. Users may select media locations anywhere the `vynodearr` account has normal filesystem permission to access. A normal uninstall preserves configuration and databases; `--purge` removes them explicitly.

## Docker and Unraid

The supported image is:

```text
ghcr.io/minerport/vynodearr-unified:0.4.8
```

The gateway runs as PID 1, supervises both native engines, forwards shutdown, exposes one port, and keeps persistent data separated under:

```text
/config/unified
/config/movie
/config/television
```

Media and download paths are mounted independently, normally as `/movies`, `/tv`, and `/downloads`. Never map existing Radarr or Sonarr application data into `/config`. Sharing media paths is supported; sharing application databases or download-client categories is not.

Unraid uses [`templates/vynodearr.xml`](../templates/vynodearr.xml) and the same supported OCI image. The template runs as `nobody:users` (`99:100`), so mapped appdata, media, and download paths must be writable by that identity.

## Isolation guarantees

All supported packages preserve the same boundaries:

- one public gateway on port `8686`;
- private loopback-only movie and television engines;
- separate databases, configuration, logs, queues, commands, and API keys;
- one coordinated shutdown path;
- dedicated VynodeArr application data that does not reuse Radarr or Sonarr appdata;
- locked, traceable engine source revisions in [`distribution/source-lock.json`](../distribution/source-lock.json).

## Release validation

The release pipeline must pass all of the following before a stable tag is published:

1. restore, Release build, and all gateway tests on Windows;
2. gateway tests and self-contained publish on Linux;
3. locked movie and television engine builds;
4. Linux installer and uninstaller syntax validation;
5. container startup with both engines healthy;
6. dashboard, unified summary, calendar API, and native engine API smoke checks;
7. coordinated container shutdown without orphaned engine processes;
8. upgrade checks confirming configuration and databases persist;
9. SHA-256 checksums for downloadable release assets.

ARM64 must not be advertised until both locked engines and the complete container pass equivalent native ARM64 runtime testing.
