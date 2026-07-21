# VynodeArr 0.4.7

VynodeArr 0.4.7 is a dashboard navigation and presentation hotfix for Windows x64, Linux x64, Docker x86-64, and Unraid x86-64.

## Changes

- removed the invalid Movies and Television manual-import dashboard buttons;
- retained the valid Add and Library Import dashboard destinations;
- removed the gateway-injected movie Library Import folder-layout notice;
- preserved all engine import behavior, APIs, authentication, data isolation, and lifecycle controls.

## Upgrade notes

- Back up the VynodeArr data directory before upgrading.
- Keep the existing VynodeArr data or `/config` mapping during the upgrade.
- Docker and Unraid users can update through `ghcr.io/minerport/vynodearr-unified:latest`.

## Supported artifacts

- `VynodeArr-0.4.7-win-x64-setup.exe`
- `VynodeArr-0.4.7-linux-x64.tar.gz`
- `VynodeArr-0.4.7-linux-x64.tar.gz.sha256`
- `ghcr.io/minerport/vynodearr-unified:0.4.7`
- `ghcr.io/minerport/vynodearr-unified:latest`
