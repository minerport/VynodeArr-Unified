# Review test plan

1. Run `npm run verify`.
2. Start fixture Compose; create administrator; verify login/logout and restart.
3. Review dashboard, all three library layouts, search/filter/sort, Movie and TV
   details, season expansion, queue, history, calendar, settings, and system.
4. Test at desktop and mobile widths; confirm fallback artwork and empty states.
5. Switch to engine mode with read-only credentials. Verify item counts,
   monitoring, files/profiles, progress, queue/history/calendar, health, and
   connection latency without changing engine state.
6. Test wrong credential, unreachable host, timeout, invalid response, stale
   cache, and recovery. Inspect browser/API/log output for credential, host,
   source branding, or stack-trace leakage.
7. Validate Compose and Unraid template; confirm loopback/local and user-defined
   network behavior, appdata backup, reset scope, health checks, and non-root
   container execution.
8. Reconfirm both reviewed source working trees and databases are unchanged.
