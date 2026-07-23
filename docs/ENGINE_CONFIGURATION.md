# Engine configuration

Each domain supports enabled state, internal host/port, HTTPS, URL base, API
credential, timeout, retry count, TLS verification, fixture fallback policy,
and the fixed display names Movies and TV.

Use `MOVIE_ENGINE_*` and `TV_ENGINE_*` variables shown in `.env.example`.
Credential-file variables take precedence over direct credential values:

- `MOVIE_ENGINE_API_CREDENTIAL_FILE`
- `TV_ENGINE_API_CREDENTIAL_FILE`

Files should be mounted read-only and readable only by the container user.
Credentials are never returned by `/api/system/engines`. The
`EncryptedCredentialVault` provides AES-256-GCM replace/remove storage for the
future settings workflow; its master key must be supplied outside the stored
data. N2 intentionally exposes no credential-setting API.

Connection tests read system status only and report enabled, reachability,
authentication, compatibility, latency, capabilities, synchronization state,
last success/failure, and safe error text.
