# VynodeArr

Current release: **1.0.0**

VynodeArr is one secure Movies and TV application. It provides guided first-run
setup, local accounts and roles, durable media projections, unified activity,
authenticated artwork, and encrypted connections to private bundled media
services. Its administrator control center provides an allowlisted management
gateway without exposing either backend interface. See
`docs/N4_MANAGEMENT_GATEWAY.md` and `docs/N5_INTERACTION_PARITY.md`.

## Install and start

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

Open `http://localhost:4310`. A new installation opens **Welcome to
VynodeArr**, creates the first administrator, and signs them in. Both private
media services are started and connected automatically. No default VynodeArr
username or password exists.

The engine settings screen validates authentication, version, capabilities,
library, queue, calendar, and health. Manual connection remains available for
deployments that use existing external services.

Run `npm run verify` for tests, build, branding, and deployment checks. See
`docs/LOCAL_REVIEW_DEPLOYMENT.md` or `docs/UNRAID_REVIEW_DEPLOYMENT.md`.
