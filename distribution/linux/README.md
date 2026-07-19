# Linux installation and packaging

## Install a published x64 prerelease on Ubuntu

Download both files from the VynodeArr GitHub release, verify the archive, extract it, and run the installer:

```bash
wget https://github.com/minerport/VynodeArr-Unified/releases/download/v0.4.1/VynodeArr-0.4.1-linux-x64.tar.gz
wget https://github.com/minerport/VynodeArr-Unified/releases/download/v0.4.1/VynodeArr-0.4.1-linux-x64.tar.gz.sha256
sha256sum --check VynodeArr-0.4.1-linux-x64.tar.gz.sha256
tar -xzf VynodeArr-0.4.1-linux-x64.tar.gz
cd VynodeArr-linux-x64
sudo ./install.sh
```

Open `http://<ubuntu-ip>:8686`. The installer creates a dedicated `vynodearr` service account, installs the application under `/opt/vynodearr`, stores persistent data under `/var/lib/vynodearr`, generates a lifecycle-control key, and enables the single `vynodearr` systemd service.

The service does not restrict media to a hard-coded directory list. Root folders may be located under `/srv`, `/mnt`, `/media`, `/home`, or another administrator-selected location. Normal Linux ownership and mode rules still apply: the `vynodearr` account must have read and write access to any root folder selected in the UI. For example:

```bash
sudo chown -R vynodearr:vynodearr /path/to/media
sudo chmod -R u+rwX,g+rwX /path/to/media
```

Useful commands:

```bash
sudo systemctl status vynodearr
sudo journalctl -u vynodearr -f
sudo systemctl restart vynodearr
sudo /opt/vynodearr/uninstall.sh
```

Normal uninstall preserves configuration and databases. `sudo /opt/vynodearr/uninstall.sh --purge` permanently removes them and should only be used when all VynodeArr data is no longer needed.

The first Linux release is an experimental x86-64 prerelease. ARM64 is not advertised until its native payload and runtime tests pass.

## Maintainer packaging

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

The GitHub experimental packaging workflow builds the locked Linux-native engines, validates the installer payload, starts both engines in Docker, verifies readiness and coordinated shutdown, and uploads the completed archive.
