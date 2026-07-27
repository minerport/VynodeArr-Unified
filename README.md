<p align="center">
  <img src="assets/branding/VynodeArr.png" alt="VynodeArr logo" width="190">
</p>

<h1 align="center">VynodeArr</h1>

<p align="center">
  Movies and television, managed together.
</p>

<p align="center">
  <a href="https://github.com/minerport/VynodeArr-Unified/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/minerport/VynodeArr-Unified"></a>
  <a href="https://github.com/minerport/VynodeArr-Unified/actions/workflows/verify.yml"><img alt="Verification status" src="https://github.com/minerport/VynodeArr-Unified/actions/workflows/verify.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Apache 2.0 license" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg"></a>
  <img alt="Unraid and Windows" src="https://img.shields.io/badge/platforms-Unraid%20%7C%20Windows-7c5cff">
</p>

VynodeArr is a self-hosted media-management application with one account system, one interface, and dedicated movie and television services operating behind its secure gateway. It brings library management, discovery, monitoring, acquisition, activity, and administration into a consistent VynodeArr experience.

![VynodeArr movie library](docs/screenshots/movie-library.png)

## Current release

Version **2.0.10** is ready for real-time testing on Unraid and Windows. The
interface now applies one consistent presentation system across page
backgrounds, navigation, heroes, cards, controls, dialogs, and scrollbars.
Users can independently choose a color theme and a Glass, Solid, OLED, or High
Contrast interface style, select comfortable or compact density, and control
motion. Nested movie and television workflows now open in a viewport-level
modal layer so their controls remain visible without losing the underlying
detail view.

The release has been validated with the complete automated test suite,
TypeScript checking, production builds, bundle-budget checks, deployment
validation, a fresh Docker image, connected movie and television engines, and
browser tests covering every Movies and TV information-card, compact-grid, and
detailed-list layout. Modal positioning, page-position restoration, card
overflow, title wrapping, action alignment, and theme application were also
verified.
Existing installations can update with the
`ghcr.io/minerport/vynodearr-unified:latest` image while retaining their
persistent `/config` mapping.

See the [changelog](CHANGELOG.md) for the detailed list of changes.

## Why VynodeArr

| One place for your media | Familiar control without the clutter | Built for real libraries |
|---|---|---|
| Browse movies, shows, seasons, episodes, wanted items, queue, history, and calendar from one sidebar. | Use guided forms for folders, profiles, indexers, clients, imports, backups, and service settings. | Bulk-edit large libraries, import in the background, monitor at every level, and keep movie and TV preferences independent. |

## Feature tour

### Rich movie and television libraries

- Poster, information-card, compact-grid, and detailed-list layouts remembered independently for movies and television
- Engine-backed sorting by title, release date, rating, content rating, duration, date added, library size, availability, completion, and attention
- Artwork-backed detail pages with monitoring, search, refresh, edit, and location controls
- Movie filters for title, year, genre, and collection
- Show, season, and episode monitoring with color-coded availability
- Bulk profile, root-folder, availability, refresh, and removal actions

### Personal interface presentation

- Ten color themes that remain independent from layout and surface treatment
- Glass, Solid, OLED, and High Contrast interface styles
- Comfortable and compact information density
- System-aware, reduced, or full motion
- Uniform themed cards, controls, dialogs, borders, backgrounds, and scrollbars
- Viewport-safe modals that return you to the same position on the originating page

### Search, acquire, and follow progress

- Automatic and interactive search for movies, shows, seasons, and individual episodes
- Release results with quality, size, source, status, and rejection reasons
- Wanted views grouped by show and season
- Sortable, filterable queue with download-client status and bulk actions
- Unified calendar, history, health, and scheduled-task views

### Flexible collections

Build hand-picked collections or combine smart rules such as title, year, decade, genre, monitoring state, file availability, and an existing movie collection. Preview matches, keep earlier selections while trying new rules, and remove individual movies before saving.

![VynodeArr collections](docs/screenshots/collections.png)

### Administration without configuration files

- First-run administrator creation and secure local accounts
- User roles, active sessions, encrypted credentials, and engine-key controls
- Visual root-folder browser, quality profiles, indexers, and download clients
- Review, customize, compare, and apply TRaSH guide templates independently for Movies and TV
- Movie and television settings kept separate where their behavior differs
- Backup creation, download, upload, and restore from the VynodeArr interface
- Actionable health issues with direct links to the setting that needs attention

## Install

| Platform | Best for | Start here |
|---|---|---|
| Unraid | Always-on media servers | Use the Community Apps template or [`templates/vynodearr.xml`](templates/vynodearr.xml) |
| Windows 10/11 x64 | Desktop testing or a Windows host | Download the Windows archive from the [latest release](https://github.com/minerport/VynodeArr-Unified/releases/latest) |

### Unraid

The container image is:

```text
ghcr.io/minerport/vynodearr-unified:latest
```

1. Install VynodeArr from Community Apps, or import [`templates/vynodearr.xml`](templates/vynodearr.xml).
2. Keep `/config` mapped to a persistent appdata folder.
3. Map writable movie, television, and download folders.
4. Open the WebUI on port `8686`.
5. Create the first administrator.
6. Confirm root folders, then add indexers and download clients under **Service Settings**.

| Container path | Purpose | Example Unraid path |
|---|---|---|
| `/config` | Accounts, settings, databases, and backups | `/mnt/user/appdata/vynodearr` |
| `/movies` | Movie library | `/mnt/user/media/movies` |
| `/tv` | Television library | `/mnt/user/media/tv` |
| `/downloads` | Shared completed-download data | `/mnt/user/downloads` |
| `8686` | VynodeArr WebUI and compatibility gateway | Required |

> Keep `/config` when updating or recreating the container. It contains the application state and both service databases.

For normal Unraid HTTP access, leave `VYNODEARR_SECURE_COOKIES=false`. Enable secure cookies only when VynodeArr is always accessed over HTTPS.

### Windows

Docker Desktop with Linux containers is required.

1. Download `VynodeArr-Windows-x64-<version>.zip` from the [latest release](https://github.com/minerport/VynodeArr-Unified/releases/latest).
2. Extract it to a permanent folder.
3. Run `Start-VynodeArr.ps1`.
4. Open [http://localhost:8686](http://localhost:8686).
5. Create the first administrator and complete the same guided setup.

Run `Stop-VynodeArr.ps1` to stop VynodeArr without removing its data.

## First-run checklist

1. Open **Service Settings → Root Folders** and confirm the movie and television locations.
2. Review the quality profiles for each library.
3. Optionally review recommended settings under **Service Settings → Guide Templates**.
4. Add at least one indexer and download client.
5. Ensure the same completed-download folder is visible to VynodeArr and the download client.
6. Add or import media and choose monitoring behavior.
7. Open **Health** from the dashboard to resolve any remaining setup issues.

## Connect Seerr or another request application

Use the VynodeArr server address and port `8686` for both services:

| Service | URL base |
|---|---|
| Movies | `/movies` |
| Television | `/tv` |

Administrators can reveal or generate the individual API keys under **Account Settings → Engines**. Regenerating a key requires updating every external application that uses it.

## Updates, backups, and removal

- On Unraid, update the container to pull the newest image.
- Never remove the persistent `/config` mapping during an update.
- Create and download both backups from **System → Backups** before uninstalling.
- A new installation can upload and restore downloaded backup files.
- Library media remains in `/movies` and `/tv`; it is not stored inside the application container.

### Restore existing movie and TV engine backups

Native backups from an existing installation can be restored through
**System → Backups**:

1. Upload the native movie-engine backup with **Upload & restore** under **Movies backups**.
2. Wait for the Movies engine to restart and reconnect.
3. Upload the native TV-engine backup under **Television backups**.
4. Wait for the TV engine to restart and reconnect.

The backups are restored separately and must be uploaded to their matching
sections. Supported uploads are `.zip`, `.db`, and `.xml` files up to 500 MB.
Restoring replaces the selected engine's current configuration but does not
restore VynodeArr accounts or application-level settings.

After restoring, verify root folders and download paths because paths from the
old installation must also exist inside the new container or be remapped.
See [Backup and Restore](docs/BACKUP_AND_RESTORE.md) for the complete migration
and verification procedure.

## Troubleshooting

<details>
<summary><strong>I am signed out immediately after login</strong></summary>

Update to the latest image and use `VYNODEARR_SECURE_COOKIES=false` when accessing VynodeArr over HTTP. Clear cookies for the server address before signing in again.
</details>

<details>
<summary><strong>A service or integration is unhealthy</strong></summary>

Open **Health** from the dashboard. Movie and television issues are separated and link directly to the applicable root-folder, indexer, download-client, quality-profile, storage, or advanced setting.
</details>

<details>
<summary><strong>A download completed but cannot be imported</strong></summary>

The download client and VynodeArr must see the completed folder through compatible container paths. Confirm that `/downloads` maps to the host folder used by the client, and review remote path mappings when the applications use different paths.
</details>

<details>
<summary><strong>A local service cannot be reached</strong></summary>

Inside a container, `localhost` refers to that container, not the Unraid host. Use the host LAN address or a shared Docker network address and make sure the target service listens on that interface.
</details>

<details>
<summary><strong>Artwork is missing</strong></summary>

Run **Refresh & scan** for the affected title and check **Health** for connectivity or storage issues. Artwork is served through the authenticated VynodeArr gateway.
</details>

## Development

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

The development interface opens at [http://localhost:4310](http://localhost:4310).

Run the full verification suite:

```text
npm run verify
```

More documentation:

- [Changelog](CHANGELOG.md)
- [Architecture](docs/VYNODEARR_ARCHITECTURE.md)
- [Authentication and accounts](docs/AUTHENTICATION.md)
- [Backup and restore](docs/BACKUP_AND_RESTORE.md)
- [Using guide templates](docs/GUIDE_TEMPLATES.md)
- [Management gateway](docs/N4_MANAGEMENT_GATEWAY.md)
- [Interaction parity](docs/N5_INTERACTION_PARITY.md)
- [Packaging and licensing](docs/PACKAGING_AND_LICENSING.md)

## License and acknowledgements

VynodeArr source code is licensed under the [Apache License 2.0](LICENSE). Bundled third-party components retain their respective licenses and notices; see [`THIRD_PARTY_NOTICES`](THIRD_PARTY_NOTICES).
