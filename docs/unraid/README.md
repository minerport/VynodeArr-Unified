# Unraid installation

1. Add this repository as a template source or import
   `templates/vynodearr.xml`.
2. Keep the default `/mnt/user/appdata/vynodearr` mapping for `/config`.
3. Select writable movie, television, and shared download folders.
4. Open port 8686 and create the first administrator.
5. Configure indexers and download clients from Service Settings.

The image automatically creates and connects its isolated movie and television
engines. Request applications connect through port 8686 using URL Base
`/movies` or `/tv`. Engine API keys can be revealed from Account Settings.
Automatic file-schema migrations run when a newer image requires them.

Before upgrading or uninstalling, create and download both configuration
backups. The `/config` mapping contains all persistent application and engine
state.

Screenshots:

- `first-run.png` — initial administrator wizard.
- `dashboard.png` — post-login product dashboard.
