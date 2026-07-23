# VynodeArr 1.0

VynodeArr 1.0 is the first public release of the unified movie and television
management application.

## Distribution

- **Unraid/Linux x86-64:** `ghcr.io/minerport/vynodearr-unified:1.0.0`
- **Windows x64:** Docker Desktop package attached to the GitHub release
- **Community Applications:** `templates/vynodearr.xml` and
  `templates/ca_profile.xml`

The Unraid image contains installation-managed movie and television engines.
Only VynodeArr branding is presented in the main interface. API-based request
applications use port 8686 with URL Base `/movies` or `/tv`; the same port
serves the VynodeArr interface.

## Persistent paths

- `/config` — VynodeArr accounts, settings, and isolated engine databases
- `/movies` — movie library
- `/tv` — television library
- `/downloads` — shared download-client path

Back up `/config` and use the backup download controls inside VynodeArr before
removing the application.
