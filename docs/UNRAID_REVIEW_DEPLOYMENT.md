# Unraid deployment

Use `templates/vynodearr.xml` for Community Applications and
`infrastructure/unraid/vynodearr.xml` for local template validation.

- Image: `ghcr.io/minerport/vynodearr-unified:latest`
- Appdata: `/mnt/user/appdata/vynodearr` → `/config`
- Movies: selected share → `/movies`
- Television: selected share → `/tv`
- Downloads: selected share → `/downloads`
- Web interface: `http://UNRAID-IP:8686`
- External application APIs: port 8686 with URL Base `/movies` or `/tv`

The single x86-64 image starts VynodeArr and its two installation-managed,
isolated engines. API credentials are generated during the first start and
stored below `/config`. Back up `/config` before upgrading or uninstalling.

Update by pulling a tested versioned image or `latest`, then recreating the
container. The application and both engines run automatic database migrations
when required.
