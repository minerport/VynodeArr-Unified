# Request engine integration

VynodeSeerr runs as an independent private service built directly from
`minerport/VynodeSeerr`. Its complete setup, authentication, discovery,
request, user, permission, notification, job, issue, and administration
features remain owned by that service.

VynodeArr exposes the service at `/requests/` through an additive gateway
proxy. The proxy removes the public prefix before forwarding requests and
rewrites redirects, cookies, API paths, static assets, images, and manifests
back under `/requests`.

The request service owns a separate persistent `request-engine-config` volume.
It does not share a database, process, credentials, adapters, or synchronization
state with the movie and television services.

During request-service setup, connect its movie service to the VynodeArr host
on port `8686` with URL base `/movies`, and connect its television service to
the same host and port with URL base `/tv`. Use the corresponding external
application API keys shown in VynodeArr Account Settings.

Environment variables:

- `REQUEST_ENGINE_HOST` (default `request-engine`)
- `REQUEST_ENGINE_PORT` (default `5055`)
- `REQUEST_ENGINE_HTTPS` (default `false`)
- `REQUEST_ENGINE_TLS_VERIFY` (default `true`)
