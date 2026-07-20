# Phase 1 implementation

## Scope and ownership

Phase 1 is gateway-only. VynodeArr owns the versioned CSS tokens, unified dashboard, injected header, engine-context markers, and rollback flags. Movies remains at `de4811318ef1eb6560a5e480cc4bba2afc008ca9`; Television remains at `a29f15e92bd2c21e646d065d9d78066952cac05d`. Their routers, stores, API clients, pages, databases, migrations, commands, imports, downloads, monitoring, authentication, and update behavior are unchanged.

## Token delivery

`VynodeArrTokens.v1.css` is embedded in the gateway assembly and served at `/assets/vynodearr-tokens.v1.css`. It defines dark and light surfaces/text, Movies cyan, Television violet, shared graphite-blue, status colors, focus rings, typography, spacing, radii, target sizes, table density, shell heights, motion, z-index, forced-colors behavior, and reduced-motion behavior.

The approved muted-text and subtle-border values were raised slightly for contrast. No engine-owned status color was remapped.

## Engine context and branding

The dashboard renders `<html data-vy-engine="shared" class="vy-engine-shared">`. Proxied pages receive equivalent Movies or Television attributes/classes plus a visible accessible badge. The branding adapter changes only exact title/metadata values and its dedicated shell markup. The previous broad text observer and arbitrary `replaceAll` behavior were removed, so user content containing Radarr or Sonarr is preserved. Engine-relative links and deep paths are not rewritten.

## Dashboard and shell

The dashboard now exposes application identity/version, gateway state, both engine versions and visible status text, available summary counts, lifecycle actions, per-engine detail and system links, a color-coded 30-day calendar, refresh controls, and unified shutdown. One or both unavailable engines remain visible and do not remove the other engine's links. The compact injected header preserves Dashboard, Movies, and Television destinations and uses explicit active state, focus styling, responsive wrapping, and a bounded shell z-index.

## Feature flags and rollback

- `VYNODEARR_UI_TOKENS_ENABLED` / `VynodeArr:Ui:TokensEnabled`
- `VYNODEARR_NEW_SHELL_STYLING_ENABLED` / `VynodeArr:Ui:NewShellStylingEnabled`

Both default to `true` in production `appsettings.json`. Set either environment variable to `false` and restart VynodeArr to omit token delivery or use the legacy-compatible shell styling. Routes, lifecycle endpoints, engine configuration, APIs, and databases do not change under either flag. A full rollback is a revert of the Phase 1 gateway commits; no database rollback is required.

## Validation

- Gateway Release build: passed with zero warnings and zero errors.
- Gateway tests: 29 passed, 0 failed, 0 skipped.
- Movies frontend webpack build: passed at the locked source revision.
- Television frontend webpack build: passed at the locked source revision using a temporary pnpm install. pnpm required an explicit temporary transitive `@floating-ui/react-dom` dependency because the repository's normal Yarn hoisting was unavailable; the locked Television source was not modified.
- Responsive browser review: dashboard and both engine entry routes at all four required viewports, with no measured horizontal overflow.
- Docker runtime: not executed because Docker is unavailable on the validation workstation. Linux publish and package-input validation are recorded in the final handoff.

## Exact upstream conflict surface

Potential conflicts are limited to `Program.cs`, `UnifiedShell.cs`, `Proxy/EngineProxy.cs`, `Proxy/NativeShellBranding.cs`, gateway options/appsettings/project embedding, and gateway tests/docs. There is no engine-source conflict surface in this phase.

## Known limitations

- Fresh isolated Movies and Television instances show their mandatory authentication setup modal before the populated library view; screenshots therefore validate shell/context/responsiveness, not populated library content.
- The available browser runner used the host dark color preference and could not safely override media preferences. Light and reduced-motion rules are automated-test covered, but a light-mode screenshot and motion instrumentation remain a visual-review follow-up.
- Native modal/menu layering was observed for the authentication modal only, not every engine modal or dropdown.
- Automated axe, screen-reader, high-contrast, and zoom testing remain pending.

Phase 2 should not begin until the remaining visual and assistive-technology checks are accepted.
