# N4 management gateway

VynodeArr presents one native product interface while the movie and television
services remain private backend engines. Their web interfaces, network addresses,
and credentials are never sent to the browser.

## Automatic configuration

When `VYNODEARR_DATA_MODE=engine` and both engine credential environment variables
are present on first start, VynodeArr imports the two private connection profiles
into its encrypted credential vault. Later starts use the vault. Administrators can
also validate and replace either connection from the first-run or Settings wizard.

## Management capabilities

The administrator-only control center exposes library CRUD, discovery lookup,
episode and file management, queue removal, commands, manual import, profiles,
root folders, tags, custom formats, quality definitions, exclusions, collections,
indexers, download clients, notifications, import lists, naming, media management,
delay profiles, and restrictions.

Every upstream operation passes through an explicit capability map. Arbitrary paths
cannot be proxied. Non-GET operations require the authenticated session's CSRF
token, destructive actions require user confirmation, and changes are written to a
durable local audit log. Credentials remain encrypted at rest.

## Product and legal identity

No upstream HTML, CSS, JavaScript, names, icons, or logos are presented in the
VynodeArr interface. Required copyright, license, and source notices remain in the
distribution's legal files.
