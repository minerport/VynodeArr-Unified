# VynodeArr 0.4.4

VynodeArr 0.4.4 is the first supported unified release for Windows x64, Linux x64, Docker x86-64, and Unraid x86-64.

## Highlights

- modernized shared VynodeArr dashboard and design-token foundation;
- persistent Dashboard, Movies, and Television navigation across both native interfaces;
- separate Movies and Television status cards with independent lifecycle controls;
- dedicated Movies System and Television System links;
- color-coded rolling 30-day movie and television calendar summaries;
- safe public-host redirect handling for first-run engine authentication;
- responsive layouts, keyboard-visible focus states, reduced-motion handling, and forced-color support;
- stable Linux systemd, Docker, and Unraid packaging using isolated data directories;
- one coordinated shutdown path for the gateway and both engines.

## Upgrade notes

- Back up the VynodeArr configuration directory before upgrading.
- Windows upgrades preserve `C:\ProgramData\VynodeArr`.
- Linux upgrades preserve `/var/lib/vynodearr` and `/etc/vynodearr`.
- Docker and Unraid upgrades must continue mapping the same dedicated VynodeArr appdata directory to `/config`.
- Do not map existing Radarr or Sonarr appdata into VynodeArr.
- If another media manager uses the same download client, keep unique categories such as `vynode-movies` and `vynode-tv`.

## Supported artifacts

- `VynodeArr-0.4.4-win-x64-setup.exe`
- `VynodeArr-0.4.4-linux-x64.tar.gz`
- `VynodeArr-0.4.4-linux-x64.tar.gz.sha256`
- `ghcr.io/minerport/vynodearr-unified:0.4.4`
- `ghcr.io/minerport/vynodearr-unified:latest`

Linux ARM64 and macOS are not supported by this release.
