# Engine configuration

Each domain supports enabled state, internal host/port, HTTPS, URL base, API
credential, timeout, retry count, TLS verification, fixture fallback policy,
and the fixed display names Movies and TV.

Use `MOVIE_ENGINE_*` and `TV_ENGINE_*` variables shown in `.env.example`.
Credential-file variables take precedence over direct credential values:

- `MOVIE_ENGINE_API_CREDENTIAL_FILE`
- `TV_ENGINE_API_CREDENTIAL_FILE`

Files should be mounted read-only and readable only by the container user.
Credentials are never returned by `/api/system/engines`. The engine wizard
requires successful validation before the `EncryptedCredentialVault` performs
AES-256-GCM replacement. Its stable master key must be supplied outside stored
data, preferably with `VYNODENEW_MASTER_KEY_FILE`.

Connection tests read system status only and report enabled, reachability,
authentication, compatibility, latency, capabilities, synchronization state,
last success/failure, and safe error text.
