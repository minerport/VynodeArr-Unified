# VynodeArr 0.4.6

VynodeArr 0.4.6 adds a single authenticated control center across Windows x64, Linux x64, Docker x86-64, and Unraid x86-64.

## Highlights

- one VynodeArr administrator login for the dashboard, Movies, and Television;
- private loopback-only media engines with gateway-managed API access;
- automatic migration of existing engine authentication settings on restart;
- existing native engine username and password fields preserved for rollback;
- authenticated dashboard summary, attention, queue, and agenda modules;
- separate movie and television databases, settings, commands, queues, and data roots;
- versioned Windows and Linux packages from one stable release workflow;
- versioned and `latest` Docker tags for Docker and Unraid.

## Upgrade notes

- Back up the complete VynodeArr data directory before upgrading.
- Upgrade while retaining the same VynodeArr data directory.
- Restart VynodeArr so both engine configurations are reconciled before launch.
- Sign in or create the first VynodeArr administrator at the gateway. Movies and Television must not request separate credentials.
- Never expose private engine ports or map existing Radarr or Sonarr appdata into VynodeArr.

## Supported artifacts

- `VynodeArr-0.4.6-win-x64-setup.exe`
- `VynodeArr-0.4.6-linux-x64.tar.gz`
- `VynodeArr-0.4.6-linux-x64.tar.gz.sha256`
- `ghcr.io/minerport/vynodearr-unified:0.4.6`
- `ghcr.io/minerport/vynodearr-unified:latest`

Linux ARM64 and macOS are not supported by this release.
