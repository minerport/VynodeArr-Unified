# Local review deployment

## Start and login

Copy `.env.example` to `.env`, then run:

```powershell
docker compose up --build -d
```

Open `http://localhost:4310`. The first visit launches the setup wizard; there
is no committed default account password. The local stack automatically starts
private movie and television engines, waits for both to become healthy, and
registers them with VynodeArr. The Compose port binds only VynodeArr to
loopback; engine ports are not published to the host.
PowerShell helpers are in `infrastructure/local`.

## Bundled engines and real data

The included services persist configuration in `movie-engine-config` and
`tv-engine-config`, libraries in `movie-library` and `tv-library`, and use a
shared `shared-downloads` volume. Replace the local example API keys in `.env`
before any non-local deployment. The engines have outbound network access for
provider and download-client integrations but are reachable from the browser
only through VynodeArr's authenticated gateway.

## Checks and troubleshooting

- `docker compose ps`
- `curl http://127.0.0.1:4310/healthz`
- `docker compose logs vynodearr` (credentials are never intentionally logged)
- Confirm internal DNS/routing, URL base, credential, and TLS policy.
- Inspect private services with `docker compose logs movie-engine tv-engine`.
- Stop with `docker compose down`.

The reset script removes only the named VynodeArr application volume. Engine
configuration, libraries, and downloads remain in their separate volumes.

## Upgrade and recovery

Back up the Docker volume before upgrades. Startup automatically upgrades N2
user arrays into the versioned N3 account schema while preserving password
hashes. If the master key is lost, encrypted engine credentials cannot be
recovered; restore the key backup or reconnect engines. Account recovery is
currently an administrator operation.
