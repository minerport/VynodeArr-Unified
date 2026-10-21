# SQLite operational state

VynodeArr stores high-churn operational history in `vynodearr.db` inside the
configured application data directory. Notifications, search activity, and
download decisions use SQLite WAL mode so individual records can change
without rewriting their complete JSON history files.

## Automatic migration

On the first start after the SQLite upgrade, VynodeArr imports these files when
they exist:

- `notification-events.json`
- `search-activity.json`
- `download-decisions.json`

Each import is committed transactionally and recorded in the database. The
source JSON remains unchanged. A second copy is retained under
`backups/legacy-json/` as pre-migration recovery evidence. Later starts read
SQLite and do not import the legacy file again.

## Backups

The existing encrypted application backup continues to export and restore the
same JSON documents, regardless of the underlying SQLite storage. This keeps
backup archives portable across the storage migration.

VynodeArr also creates one consistent SQLite backup per day at startup under
`backups/sqlite/` and retains the seven most recent daily copies.

## Deployment requirements

Keep the application data directory on storage local to the Docker host. WAL
mode must not be used when the database is directly shared between hosts over
NFS or SMB. Unraid users should keep appdata on a local cache or pool and let
Unraid's backup tooling copy it when VynodeArr is stopped or use VynodeArr's
consistent backups.

The database, `-wal`, and `-shm` files belong together while the application is
running. Do not copy only `vynodearr.db` from a live container.
