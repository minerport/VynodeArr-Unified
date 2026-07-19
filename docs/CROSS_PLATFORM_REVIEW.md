# Cross-platform implementation review

## Conclusion

The VynodeArr gateway and engine-isolation model can support Linux and Unraid without merging or rewriting the native applications. The original movie and television projects already publish self-contained Posix payloads. VynodeArr must build those exact locked sources for the target runtime, compose them behind the portable gateway, and replace Windows host integration with systemd or a container boundary.

The experimental branch now implements that foundation. The `linux-x64` end-to-end workflow has built both complete native payloads, composed the archive, started both engines in the container, and passed coordinated shutdown. It is not a stable release until application workflows, persistence, and a real Unraid host are validated.

## Findings from the current source

| Area | Existing behavior | Cross-platform action |
| --- | --- | --- |
| Gateway | .NET 8 web host | Publish self-contained `linux-x64` and `linux-arm64` binaries |
| Child processes | Portable `System.Diagnostics.Process` plus optional Windows job object | Retain graceful API shutdown; use systemd control groups or the container boundary as final cleanup |
| Engine ports | Dynamically allocated loopback ports | Retain unchanged inside Linux and containers |
| Engine data | Separate `movie`, `television`, and `unified` roots | Map them below `/config` or `/var/lib/vynodearr` |
| Public endpoint | Hard-coded Windows package default | Bind `0.0.0.0:8686` only in Linux/container packages |
| Lifecycle API | Loopback-only authorization | Keep loopback access; require an explicit control key for remote browsers |
| Windows service | `AddWindowsService` and Inno Setup | Add systemd notification support and a hardened unit |
| Tray | Windows Forms | Omit it from headless Linux and container packages |
| Native builds | Windows-only VynodeArr build script | Build locked sources with `Platform=Posix` and matching Linux RIDs |
| Unraid | None | Use one OCI image plus an Unraid XML template and appdata/media mappings |

## Implemented experimental components

- `distribution/linux/build-native-engines.ps1`
  - verifies both source-lock commits;
  - refuses dirty native source trees;
  - invokes each project’s `PublishAllRids` target with `Platform=Posix`;
  - builds both native frontends;
  - recreates the original Linux package layout and license contents.
- `distribution/linux/package.ps1`
  - publishes the gateway for `linux-x64` or `linux-arm64`;
  - composes matching immutable engine payloads;
  - writes portable `/config` defaults and a SHA-256 manifest;
  - creates a versionable tar archive.
- `distribution/linux/vynodearr.service`
  - runs as a dedicated account;
  - receives systemd readiness notifications;
  - provides a 60-second graceful stop window;
  - uses the service control group as a final orphan-prevention boundary.
- `distribution/docker/Dockerfile`
  - runs the gateway directly as PID 1;
  - runs without root;
  - exposes one port and one persistent configuration root;
  - includes a unified health check;
  - leaves both databases and media domains separate.
- `templates/vynodearr.xml`
  - maps appdata, movies, television, downloads, timezone, port, and lifecycle key;
  - uses Unraid’s standard `nobody:users` runtime identity;
  - points to the same experimental container image used by other Docker hosts.
- Linux GitHub Actions validation
  - tests and publishes the gateway on Ubuntu for every PR;
  - provides a dispatchable full native-build, package, image, engine-readiness, and shutdown workflow;
  - passed the complete `linux-x64` workflow on July 19, 2026 ([run 29701061845](https://github.com/minerport/VynodeArr-Unified/actions/runs/29701061845)).

## Isolation requirements that must remain true

1. Movie and television payloads come from their independently locked repositories and target the same CPU architecture as the gateway.
2. Each engine keeps its own data directory, API key, loopback port, process record, readiness state, and shutdown request.
3. Only the gateway binds the public port.
4. Container and service shutdown first ask both engines to exit gracefully, then use only the owned control group/container to clean up failures.
5. Remote lifecycle mutations require a configured control key; an absent key denies remote mutation.
6. `/config`, movie media, television media, and downloads remain explicit mounts. No installer assumes host paths.
7. Upgrades replace immutable application files or the container image but never replace persistent configuration volumes.

## Remaining release gates

- Confirm the native applications create databases under the intended mounted paths during real library setup (first-run configuration and API-key persistence are covered by tests and the container smoke test).
- Confirm dashboard navigation, API proxying, SignalR, import, search, download-client, and media rename operations inside the container.
- Stop the container during active import/download work and verify graceful completion or recovery; the baseline two-engine coordinated shutdown test passes.
- Recreate the container and verify all settings and databases persist.
- Validate Unraid appdata ownership and the common `99:100` identity on a real Unraid host.
- Add backup, upgrade, rollback, and prerelease publication procedures.
- Repeat for ARM64 before publishing an ARM64 tag.

Docker documents that the entry-point process receives container signals and that PID 1 must explicitly handle termination; VynodeArr uses the ASP.NET host as the direct entry point. Unraid documents appdata-backed container configuration and persistent templates; the VynodeArr template follows that model rather than installing software directly into Unraid OS.

References:

- [Docker container runtime behavior](https://docs.docker.com/engine/containers/run/)
- [Unraid container overview](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/overview/)
- [Unraid Community Applications](https://docs.unraid.net/unraid-os/manual/applications/)
