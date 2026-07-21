# Authenticated control center

## Status

This document describes the authenticated control center included in stable VynodeArr 0.4.6 and later.

## First run

Open the gateway URL. With no account present, protected browser routes redirect to `/setup`. Create the first Administrator with a unique username, optional email address, and a password of at least 12 characters containing uppercase, lowercase, and numeric characters. Setup is permanently unavailable after the first account is created.

Authentication data is gateway-owned SQLite storage at `<data-root>/unified/auth.db`. Movie and television databases, migrations, API contracts, API keys, and command systems are unchanged.

The gateway is the only interactive login. Before starting each loopback-only engine, VynodeArr configures its native authentication method as `External` and disables authentication for local requests. Existing native username and password fields are preserved for rollback, but users are not prompted for them through the gateway. Restart VynodeArr once after upgrading an existing installation so both engine configurations are reconciled.

## Sessions and authorization

- Passwords use versioned PBKDF2-HMAC-SHA-256 parameters with 600,000 iterations and unique random salts.
- Browser sessions contain a random identifier and secret. Only a SHA-256 digest of the secret is stored server-side.
- Session cookies are `HttpOnly`, `SameSite=Lax`, scoped to `/`, and marked Secure when the observed request is HTTPS.
- Sessions have a 12-hour sliding idle limit, a seven-day absolute limit, server-side revocation, and rotation at login.
- Login failures are tracked by hashed identifier and direct client address; five failures in 15 minutes temporarily block further attempts.
- Administrator and Viewer policies are centralized. Viewers cannot call gateway or native mutation routes.
- Gateway mutations use antiforgery tokens. Native proxy mutations require an Administrator session and a same-origin `Origin` or `Referer` value.
- Audit events are stored without passwords, hashes, session secrets, cookies, authorization headers, CSRF secrets, or engine API keys.

## Routes

Public routes are limited to `/login`, `/setup`, `/api/auth/*`, `/assets/*`, and the detail-free `/health` container probe. All dashboard APIs and both engine proxies require authentication. Anonymous HTML receives a local login/setup redirect; anonymous APIs receive 401; denied authenticated requests receive 403.

Protected dashboard modules use:

- `GET /api/dashboard/summary`
- `GET /api/dashboard/attention`
- `GET /api/dashboard/queue`
- `GET /api/dashboard/agenda`

The queue is read-only. Each engine has separate mapping code and errors remain isolated. Cross-engine identifiers use `movies:<id>` and `television:<id>`.

## Reverse proxies

Keep the gateway bound to a trusted interface and terminate HTTPS at a maintained proxy. VynodeArr deliberately does not trust `X-Forwarded-For` or `X-Forwarded-Proto`; therefore cookie security follows the connection observed by the gateway. Explicit trusted-proxy configuration is required before internet-facing deployment.

## Backup and upgrade

Stop VynodeArr or use a filesystem snapshot before copying `auth.db`, its WAL, and SHM files. Back up the entire `unified` directory atomically. Never reuse the Movies or Television appdata directory for gateway authentication.

## Known limitations

- A complete browser UI for user creation, role changes, disablement, password changes, and session revocation remains to be built over the protected admin APIs.
- Trusted reverse-proxy allowlisting and HTTPS/HSTS detection remain to be implemented and tested.
- Queue quality extraction is omitted when the locked engine response does not expose a reliably normalized string.
- Dashboard adapter coverage must be expanded with captured responses from both locked source revisions.
- Additional end-to-end browser coverage for setup, login, logout, Viewer denial, CSRF rejection, and native workflows is recommended.
