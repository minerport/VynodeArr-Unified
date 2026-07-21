# VynodeArr security

The authenticated control center is the supported browser security boundary beginning with VynodeArr 0.4.6.

## Reporting a vulnerability

Do not open a public issue containing credentials, session tokens, API keys, database files, or an exploitable security report. Contact the repository owner privately through GitHub and include the affected revision, deployment platform, reproduction steps, and impact. Rotate any exposed engine or session credentials immediately.

## Security boundary

The gateway is the only browser-facing security boundary. Movies and Television remain private child processes. Their API keys are read only by the gateway and must never be exposed to a browser, log, screenshot, reverse proxy, or support bundle.

The child engines use external authentication and accept local gateway requests because they bind exclusively to loopback. Do not publish, forward, or reconfigure the dynamically allocated engine ports. Only the authenticated gateway port should be reachable by users.

Authentication state is stored in `<data-root>/unified/auth.db`. Back up that file with the rest of the VynodeArr data root and restrict it to the VynodeArr service identity. Do not edit it with either native engine stopped or running.

Use HTTPS when VynodeArr is reachable outside a trusted local network. Configure TLS at a reverse proxy, restrict access with firewall rules, and do not publish internal engine ports. The gateway does not trust forwarded client or scheme headers by default.

## Recovery

There are no default credentials and no password-reset bypass. Keep a tested backup of the `unified` data directory. If all administrator credentials are lost, stop VynodeArr, preserve a backup, and seek a documented recovery procedure before changing `auth.db`.
