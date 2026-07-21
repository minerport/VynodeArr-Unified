# Docker and Unraid package

The supported x86-64 image is:

```text
ghcr.io/minerport/vynodearr-unified:0.4.7
```

Unraid users should use the canonical template at [`templates/vynodearr.xml`](../../templates/vynodearr.xml), or create a container manually with port `8686`, `/config`, `/movies`, `/tv`, and `/downloads` mappings. Keep `/config` mapped only to VynodeArr's own appdata directory. Existing Radarr and Sonarr appdata must never be mapped there.

## Unraid installation requirements

- x86-64 Unraid host with Docker enabled;
- one unused host port mapped to container port `8686`;
- a dedicated appdata path, normally `/mnt/user/appdata/vynodearr`;
- movie, television, and download paths writable by `nobody:users` (`99:100`);
- a lifecycle control key generated with `openssl rand -hex 32`;
- unique download-client categories for VynodeArr if another media manager uses the same client.

The Community Applications template is [`templates/vynodearr.xml`](../../templates/vynodearr.xml). Until the listing is approved, download that XML into `/boot/config/plugins/dockerMan/templates-user/my-VynodeArr.xml`, then select **VynodeArr** under **Docker → Add Container → Template**. Once approved, install it directly from the Unraid **Apps** tab.

The template intentionally runs the container as `99:100`. If a mapped share is not writable, correct that share's ownership or permissions instead of removing the runtime user override or running the container as root.

Use unique download-client categories such as `vynode-movies` and `vynode-tv` before re-enabling other media managers. Sharing media paths is supported; sharing application databases or processing the same download category is not.

The Docker image consumes an already staged `VynodeArr-linux-x64` package. Native movie and television binaries are not downloaded implicitly; they must be built from the locked sources and supplied to `distribution/linux/package.ps1` first.

```powershell
.\distribution\linux\package.ps1 `
  -MovieEnginePath C:\builds\movie-linux-x64 `
  -TelevisionEnginePath C:\builds\television-linux-x64 `
  -RuntimeIdentifier linux-x64 `
  -SkipArchive

docker build `
  --file .\distribution\docker\Dockerfile `
  --tag ghcr.io/minerport/vynodearr-unified:0.4.7 `
  .\artifacts\linux\VynodeArr-linux-x64
```

The gateway is the container entry point and therefore receives Docker stop signals directly. Its hosted-service shutdown stops both native engines before the container exits. Docker's 60-second stop grace period must remain longer than the configured engine shutdown timeout.

The image runs as UID/GID 1000 by default. Build with `--build-arg VYNODEARR_UID=<uid> --build-arg VYNODEARR_GID=<gid>` or use a runtime user override when host volume ownership differs. Do not run the media manager as root merely to bypass volume permissions.

The Compose file is a supported deployment example. Replace every `/path/to/...` host path before use and keep `/config` dedicated to VynodeArr.

Set `VYNODEARR_CONTROL_KEY` to a long random value before starting Compose. Remote dashboard lifecycle actions prompt for this key once per browser session. Loopback access remains keyless, and an unset server key denies all remote start, stop, and shutdown requests.
