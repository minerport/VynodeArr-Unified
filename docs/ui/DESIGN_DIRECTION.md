# Design direction

## Product character

VynodeArr should be calm, technical, compact, and clearly one product. Use graphite/blue-black shared surfaces, cyan Movies context, violet Television context, thin borders, moderate 4–8px radii, readable type, and restrained elevation. Engine color is an orientation aid, never the only status signal.

## Principles

1. Capability before decoration: every action, menu, route, filter, and advanced field remains reachable.
2. Neutral shell, contextual content: shared chrome is graphite; a labeled engine badge and accent rail provide context.
3. Dense by default, adjustable later: reduce wasted height while preserving 40–44px touch targets.
4. Status is icon + label + color: monitoring, missing, cutoff, warning, and offline states remain understandable without color.
5. Motion explains change: 120–180ms transitions for drawer/collapse/status; honor reduced motion.
6. Upstream-friendly ownership: unified shell/tokens/adapters live in VynodeArr; engine page logic remains in its source tree.

## Avoid

No pervasive gradients, glass blur, neon glow, giant cards, hidden hover-only actions, router unification, or wholesale copying between engines. Keep light mode supported until an explicit product decision and contrast audit says otherwise.

## Page-header pattern

Compact title; optional breadcrumb; explicit Movies/Television/Shared badge; concise state; primary action; grouped secondary menu. On mobile, title and state stay visible while secondary actions move to an accessible drawer/menu.

## Visual-review matrix

For Dashboard, library, detail, calendar, queue, settings, and system, capture 1440px, 1024px, 768px, and 390px widths. Record current state, issue, recommendation, functional risk, complexity, and benefit. Do not approve page migration without this artifact.
