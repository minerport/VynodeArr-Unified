# Backup and Restore

VynodeArr provides two complementary backup types. The encrypted application
archive protects VynodeArr's own configuration and identity data. Native Movies
and Television backups protect each engine's database and settings.

## Create an encrypted VynodeArr application backup

1. Open **System → Backups** and select **Download application backup**.
2. Enter and confirm a password of at least 12 characters. VynodeArr cannot
   recover this password.
3. Choose whether to include Search Activity and administrator audit history.
4. Select **Create & download**, then store the `.vynodearr-backup` file and its
   password separately outside the server.

The archive includes users and permissions, application and connection
settings, requests and approvals, notification channels and templates,
encrypted provider credentials, the application-managed credential master
key, collections, and engine-authentication metadata. Active login sessions,
native Movies and Television databases, and library media are excluded.

If the master key is supplied by an environment variable or secret file, it is
not copied into the archive. Restore that archive only with the same external
key configured.

## Inspect and restore an application backup

1. Open **System → Backups** and select **Inspect & restore**.
2. Choose the `.vynodearr-backup` file and enter its password.
3. Inspect the creation time, application version, protected data groups, and
   any credential warnings before continuing.
4. Type `RESTORE` and select **Restore application**.
5. Restart VynodeArr to load the restored users, permissions, settings, and
   credentials.

Immediately before replacement, VynodeArr writes an encrypted pre-restore
safety archive under the persistent application data directory. Restore uses
atomic file replacement and does not restore old active sessions.

## Create VynodeArr-managed engine backups

1. Open **System → Backups**.
2. Select **Create both engine backups**.
3. Wait for the Movies and Television backups to appear in their respective
   sections.
4. Download both files and keep copies outside the container.

These files contain the native configuration for each engine. VynodeArr
accounts and application-level settings are stored separately under the
persistent `/config` mapping.

## Restore existing movie and TV engine backups

Native backups from an existing installation can be restored through VynodeArr:

1. Open **System → Backups**.
2. Under **Movies backups**, select **Upload & restore** and choose the native movie-engine
   backup.
3. Confirm that the current Movies configuration may be replaced.
4. Wait for the Movies engine to restart and reconnect.
5. Under **Television backups**, select **Upload & restore** and choose the
   native TV-engine backup.
6. Confirm the replacement and wait for the TV engine to reconnect.

Upload each backup to its matching section. A movie-engine backup cannot be
restored to TV, and a TV-engine backup cannot be restored to Movies.

VynodeArr forwards the archive to the selected engine, restarts that engine,
restores installation-managed credentials when necessary, and verifies that the
service reconnects successfully.

## Supported uploads

- `.zip`, `.db`, and `.xml`
- Maximum file size: 500 MB
- Movies and TV backups must be uploaded separately

The native engine ultimately validates the uploaded file. An archive from an
unsupported or incompatible engine version may be rejected.

## Before restoring

- Download current Movies and TV backups before replacing either configuration.
- Keep the VynodeArr `/config` mapping persistent.
- Confirm that the old library and download paths exist in the new container or
  can be updated after restore.
- Ensure `/movies`, `/tv`, and `/downloads` map to the intended host folders.
- Expect indexers, download clients, root folders, quality profiles, custom
  formats, naming rules, and other native settings to be replaced by the
  restored engine configuration.

Restoring an engine backup does not restore VynodeArr user accounts or other
application-level data.

## Restore a backup already listed in VynodeArr

1. Open **System → Backups**.
2. Find the desired backup under Movies or Television.
3. Select **Restore**.
4. Confirm the replacement.
5. Wait for the engine to restart and reconnect.

## After restoring

1. Open **System → Status** and confirm both services are available.
2. Open **Health** and resolve path, indexer, or download-client warnings.
3. Verify root folders under **Service Settings → Root Folders**.
4. Verify naming, quality profiles, custom formats, indexers, and download
   clients.
5. Confirm that restored download paths match the paths visible inside the
   VynodeArr container.

If an engine does not reconnect, check its health message and container logs.
The other engine remains independent and is not replaced by the failed restore.
