# Local review deployment

## Start and login

Copy `.env.example` to `.env`, then run:

```powershell
docker compose up --build -d
```

Open `http://127.0.0.1:4310`. The first visit creates the initial administrator;
there is no committed default password. The Compose port binds to loopback.
PowerShell helpers are in `infrastructure/local`.

## Real data

Set `VYNODENEW_DATA_MODE=engine`, configure internal engine hosts/ports and
credential files, then recreate the container. On Docker Desktop,
`host.docker.internal` is preconfigured. Both engines must permit the gateway
network to reach their read-only API endpoints.

## Checks and troubleshooting

- `docker compose ps`
- `curl http://127.0.0.1:4310/healthz`
- `docker compose logs vynodenew` (credentials are never intentionally logged)
- Confirm internal DNS/routing, URL base, credential, and TLS policy.
- Use fixture mode to separate gateway/UI problems from engine connectivity.
- Stop with `docker compose down`.

The reset script removes only the named VynodeNew development volume. It erases
the local administrator and application state, not engine data.
