# Unraid review deployment

Use `infrastructure/unraid/vynodenew.xml` for manual template testing or the
Compose example beside it. The template is not submitted to Community
Applications in N2.

- Appdata: `/mnt/user/appdata/vynodenew` → `/data`
- Secrets: `/mnt/user/appdata/vynodenew/secrets` → `/run/secrets` read-only
- Web port: host `4310` → container `4310`
- URL: `http://UNRAID-IP:4310`

Place the Movies and TV API credentials in separate files with restrictive
permissions. Connect VynodeNew and the existing engines to a user-defined
Docker network and use internal DNS names, never public forwarding. If a TLS
reverse proxy is used, set secure cookies and restrict direct port access.

Update by pinning and pulling a tested image tag, then recreating the container.
Back up `/mnt/user/appdata/vynodenew`; engine databases remain independently
owned and backed up. Review release migration notes before changing versions.
