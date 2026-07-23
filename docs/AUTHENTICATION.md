# Authentication

When no user database exists, the setup page creates exactly one initial local
administrator. Usernames are constrained and passwords require at least 12
characters. Passwords use scrypt with per-password random salt; plaintext is
never stored.

Login creates a random server-side session. Cookies are HTTP-only,
SameSite=Strict, path-scoped, expiring, and Secure when configured. Session
validation protects every media/system API. Logout and manual synchronization
require the session CSRF token. Repeated login attempts are rate-limited by
client address.

For local HTTP review, secure cookies are disabled explicitly. Enable them
behind HTTPS. N2 sessions are in memory and are invalidated by restart; durable
session storage, recovery, MFA, and additional roles are future work.
