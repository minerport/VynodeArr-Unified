# Docker and Unraid package

The published experimental x86-64 image is:

```text
ghcr.io/minerport/vynodearr-unified:0.4.2
```

Unraid users should use the template at [`distribution/unraid/vynodearr.xml`](../unraid/vynodearr.xml), or create a container manually with port `8686`, `/config`, `/movies`, `/tv`, and `/downloads` mappings. Keep `/config` mapped only to VynodeArr's own appdata directory. Existing Radarr and Sonarr appdata must never be mapped there.

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
  --tag ghcr.io/minerport/vynodearr-unified:experimental `
  .\artifacts\linux\VynodeArr-linux-x64
```

The gateway is the container entry point and therefore receives Docker stop signals directly. Its hosted-service shutdown stops both native engines before the container exits. Docker's 60-second stop grace period must remain longer than the configured engine shutdown timeout.

The image runs as UID/GID 1000 by default. Build with `--build-arg VYNODEARR_UID=<uid> --build-arg VYNODEARR_GID=<gid>` or use a runtime user override when host volume ownership differs. Do not run the media manager as root merely to bypass volume permissions.

The Compose file is an experimental example. Replace every `/path/to/...` host path before use.

Set `VYNODEARR_CONTROL_KEY` to a long random value before starting Compose. Remote dashboard lifecycle actions prompt for this key once per browser session. Loopback access remains keyless, and an unset server key denies all remote start, stop, and shutdown requests.
