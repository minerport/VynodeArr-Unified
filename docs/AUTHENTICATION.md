# Authentication

When no user database exists, a two-stage first-run wizard creates the initial
administrator and automatically signs them in. Usernames and emails are unique;
passwords require length, mixed case, and a number. Passwords use scrypt with
per-password random salt; plaintext is never stored.

Login accepts username or email and creates a durable random server-side session. Cookies are HTTP-only,
SameSite=Strict, path-scoped, expiring, and Secure when configured. Session
validation protects every media/system API. Logout and manual synchronization
require the session CSRF token. Repeated login attempts are rate-limited by
client address.

For local HTTP review, secure cookies are disabled explicitly. Enable them
behind HTTPS. Sessions persist across restart, can be listed and revoked, and
record only masked client IPs. MFA and self-service recovery are future work.
