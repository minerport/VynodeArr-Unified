# Unraid review deployment

Use `infrastructure/unraid/vynodenew.xml` for manual template testing or the
Compose example beside it. The template is not submitted to Community
Applications in N2.

- Appdata: `/mnt/user/appdata/vynodenew` → `/data`
- Secrets: `/mnt/user/appdata/vynodenew/secrets` → `/run/secrets` read-only
- Web port: host `4310` → container `4310`
- URL: `http://UNRAID-IP:4310`

Create `/mnt/user/appdata/vynodenew/secrets/master-key` with a stable random
24+ character value and restrictive permissions. Back it up separately. Engine
credentials are entered through the first-run UI; legacy secret-file variables
remain supported. Connect VynodeNew and the existing engines to a user-defined
Docker network and use internal DNS names, never public forwarding. If a TLS
reverse proxy is used, set secure cookies and restrict direct port access.

Update by pinning and pulling a tested image tag, backing up appdata/master key,
then recreating the container. Automatic migrations run on startup. Engine
databases remain independently owned and backed up. Recovery and screenshots
are in `docs/unraid`.
