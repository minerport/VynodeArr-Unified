# VynodeArr 0.4.8

VynodeArr 0.4.8 adds native API-key compatibility for third-party applications while preserving the single authenticated dashboard and private engine ports.

## Changes

- allows Radarr-compatible applications to connect through `http://HOST:8686/movies`;
- allows Sonarr-compatible applications to connect through `http://HOST:8686/television`;
- validates `X-Api-Key`, `apikey`, and `access_token` against the corresponding engine key;
- supports authenticated native API read and write operations without requiring a dashboard session;
- keeps native engine ports bound to loopback and non-API pages protected by the VynodeArr login;
- documents Docker and Unraid connection settings for other applications.

## Upgrade notes

- Back up the VynodeArr data directory before upgrading.
- Keep the existing VynodeArr data or `/config` mapping during the upgrade.
- Docker and Unraid users can update through `ghcr.io/minerport/vynodearr-unified:latest`.
- Use the separate API key displayed by each engine under **Settings > General > Security**.

## Supported artifacts

- `VynodeArr-0.4.8-win-x64-setup.exe`
- `VynodeArr-0.4.8-linux-x64.tar.gz`
- `VynodeArr-0.4.8-linux-x64.tar.gz.sha256`
- `ghcr.io/minerport/vynodearr-unified:0.4.8`
- `ghcr.io/minerport/vynodearr-unified:latest`
