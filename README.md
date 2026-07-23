# VynodeNew

VynodeNew is one secure Movies and TV application. It provides guided first-run
setup, local accounts and roles, durable read-only media projections, unified
activity, authenticated artwork, and encrypted connections to separately
running media engines.

## Install and start

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

Open `http://localhost:4310`. A new installation opens **Welcome to
VynodeNew**, creates the first administrator, signs them in, and continues to
the engine wizard. No default username or password exists.

The engine wizard validates authentication, version, capabilities, library,
queue, calendar, and health before saving encrypted credentials. It can be
skipped to use deterministic review data.

Run `npm run verify` for tests, build, branding, and deployment checks. See
`docs/LOCAL_REVIEW_DEPLOYMENT.md` or `docs/UNRAID_REVIEW_DEPLOYMENT.md`.
