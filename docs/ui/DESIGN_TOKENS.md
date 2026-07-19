# Design tokens

## Implemented Phase 1 contract

Tokens should be CSS custom properties emitted by the gateway shell and mapped into each engine's existing theme variables. Do not introduce a runtime TypeScript theme dependency across the two separately built frontends.

```css
:root {
  --vy-surface-app: #12161c;
  --vy-surface-sidebar: #171c24;
  --vy-surface-panel: #1d232d;
  --vy-surface-elevated: #242b36;
  --vy-surface-hover: #2b3441;
  --vy-surface-selected: #303b4b;
  --vy-text-primary: #f2f5f8;
  --vy-text-secondary: #b8c0cb;
  --vy-text-muted: #8893a1;
  --vy-border-subtle: #303946;
  --vy-border-strong: #4a5666;
  --vy-engine-movies: #38bdf8;
  --vy-engine-television: #a78bfa;
  --vy-engine-shared: #8aa0b8;
  --vy-status-success: #4ade80;
  --vy-status-warning: #fbbf24;
  --vy-status-error: #fb7185;
  --vy-status-info: #60a5fa;
  --vy-status-offline: #94a3b8;
  --vy-space-1: 4px; --vy-space-2: 8px; --vy-space-3: 12px;
  --vy-space-4: 16px; --vy-space-5: 20px; --vy-space-6: 24px;
  --vy-radius-sm: 4px; --vy-radius-md: 7px; --vy-radius-lg: 10px;
  --vy-shadow-raised: 0 6px 18px rgb(0 0 0 / 22%);
  --vy-font-sans: Inter, "Segoe UI", system-ui, sans-serif;
  --vy-font-mono: "Cascadia Code", Consolas, monospace;
  --vy-motion-fast: 120ms; --vy-motion-normal: 180ms;
  --vy-ease-standard: cubic-bezier(.2, 0, 0, 1);
  --vy-z-shell: 1000; --vy-z-dropdown: 1100; --vy-z-modal: 1200;
}
```

Breakpoints retain the engines' existing 480/768/992/1200/1450px contract in Phase 1. Icon sizes: 16, 20, 24; minimum interactive target 40px desktop and 44px touch. Typography: 12px metadata, 14px body/control, 16–18px section, 22–28px page title, with numeric tabular figures for queue/statistics.

## Adoption

1. The gateway embeds and serves `VynodeArrTokens.v1.css` with dark/light sets and reduced-motion overrides.
2. Map existing shell values to tokens with unchanged markup.
3. Add engine adapter styles that map Movies and Television theme variables without editing page logic.
4. Migrate one low-risk shared primitive family at a time.
5. Add automated contrast snapshots and token fallback tests.

Existing status colors remain until contrast and semantic mapping are verified. No hard-coded component colors should be added after the token layer lands.

## Phase 1 deviations

The implementation keeps the approved contract except for two contrast-driven refinements: muted text and subtle borders are slightly brighter than the assessment draft so they remain legible against the app and panel surfaces. Status colors are not remapped in engine-owned components. The light palette is a complete token override, not a component-specific color patch. Forced-colors mode preserves system colors and focus outlines, while reduced-motion sets transition and animation durations to effectively zero.

Ownership remains in the gateway. Movies and Television consume the stylesheet through injection and receive only a stable engine context; neither frontend gains a shared runtime theme dependency.
