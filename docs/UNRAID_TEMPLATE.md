# Unraid Community Applications template

The release template is `templates/vynodearr.xml`. It declares the published
image, VynodeArr icon, web interface, appdata, movie, television, download, and
timezone settings required by Community Applications.

The companion root `ca_profile.xml` contains the repository profile used
when submitting the template feed. Both XML documents are parsed during release
validation and attached to each GitHub release.

This is the only Community Applications Docker template in the repository. Keep
`ca_profile.xml` at the repository root and keep the canonical application
template under `templates/` so the submission scanner discovers one listing.

The image is published for Linux x86-64. Validate folder permissions, health,
first-run administrator creation, engine connectivity, backup/restore, and
external API access before Community Applications submission.
