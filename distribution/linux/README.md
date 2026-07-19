# Experimental Linux packaging

The Linux package pipeline publishes the portable gateway for `linux-x64` or `linux-arm64` and composes it with matching native movie and television builds. It does not reuse Windows payloads.

Build the exact locked source revisions with their native Posix targets first:

```powershell
.\distribution\linux\build-native-engines.ps1 `
  -MovieSource C:\src\VydodeArr `
  -TelevisionSource C:\src\VynodeArr2 `
  -YarnPath C:\tools\yarn-1.22.22\bin\yarn.js `
  -RuntimeIdentifier linux-x64 `
  -DotnetPath dotnet `
  -NodePath node
```

The script verifies the two source-lock revisions, refuses tracked source modifications, builds with `Platform=Posix`, and assembles the same Linux payload layout used by each original project.

```powershell
.\distribution\linux\package.ps1 `
  -MovieEnginePath .\artifacts\native-inputs\linux-x64\movie `
  -TelevisionEnginePath .\artifacts\native-inputs\linux-x64\television `
  -RuntimeIdentifier linux-x64 `
  -DotnetPath dotnet
```

The native input directories must contain executable `Radarr` and `Sonarr` entry points by default. Alternative compatibility entry-point names can be supplied with `-MovieEntryPoint` and `-TelevisionEntryPoint`.

The package script:

- refuses missing payloads and entry points;
- publishes a self-contained gateway for the selected Linux runtime;
- stages the engines without merging them;
- writes container-oriented `/config` defaults;
- produces a file checksum manifest;
- optionally creates a `.tar.gz` archive.

## Native Linux service layout

The supplied systemd unit expects application files under `/opt/vynodearr`, configuration in `/etc/vynodearr/vynodearr.env`, and persistent state under `/var/lib/vynodearr`. Before enabling it:

1. create a non-login `vynodearr` user and group;
2. copy the package into `/opt/vynodearr`;
3. mark the gateway and both engine entry points executable;
4. create and grant ownership of `/var/lib/vynodearr` to the service account;
5. copy and review `vynodearr.env.example` under `/etc/vynodearr`;
6. install `vynodearr.service`, reload systemd, and start the service.

The unit uses `KillMode=control-group` as a final Linux-specific safety boundary. The gateway still performs graceful authenticated engine shutdown first; systemd terminates remaining owned descendants only if they fail to exit within the stop timeout.

Replace the lifecycle control key in the environment file with a long random secret. Browsers connecting from another device must provide this key for engine start, stop, and full shutdown actions. An unset key denies remote lifecycle mutations.

This branch does not yet publish Linux-native engine artifacts, so these files are experimental scaffolding rather than an end-user release.
