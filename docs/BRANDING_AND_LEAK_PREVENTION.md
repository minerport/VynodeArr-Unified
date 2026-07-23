# Branding and leak prevention

The normal product surface uses only VynodeNew naming, routes, assets, and
messages. Source product names are permitted only in development inventories,
internal future adapter locations, and legal/notices files.

`npm run check:branding` scans frontend source, static assets, gateway messages,
public contracts, navigation, titles, and build inputs. Tests also inspect
public API errors. The build runs only after this check. Future CI must scan
compiled bundles and container labels as an additional release gate.

Never apply a global rename to third-party source. Adapter mappings must be
explicit and reviews must inspect URLs, filenames, localization, health,
notifications, logs, screenshots, icons, and accessibility labels.
