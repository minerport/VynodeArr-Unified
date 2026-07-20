# UI risk register

| Risk | Probability / impact | Mitigation | Gate |
| --- | --- | --- | --- |
| Router mismatch breaks deep links | High / critical | no shared router; engine-relative adapters | deep-link matrix |
| Store mismatch leaks assumptions | High / critical | presentational contracts only | engine unit/build tests |
| DOM injection breaks after upstream UI change | High / high | stable markers, versioned adapters | packaged smoke test |
| Double navigation obscures content | High / medium | responsive single-shell phase | four viewport captures |
| Engine context lost on shared names | Medium / high | visible badge/breadcrumb/URL | usability review |
| Color-only engine/status meaning | Medium / high | label+icon+color | WCAG/axe review |
| Mobile actions disappear | Medium / critical | action inventory, accessible overflow | touch/keyboard E2E |
| Settings save semantics regress | Medium / critical | wrapper only, retain engine handlers | dirty/save/error tests |
| Bulk/destructive action regression | Medium / critical | no action removal; confirmations | fixture E2E |
| Combined views imply combined settings/data | Medium / high | read-only adapters and scope labels | product copy/API review |
| Performance loss from observers/shell | Medium / medium | limit MutationObserver; stable hooks | performance profile |
| Upstream merge conflicts | High / high | additive CSS/markers, narrow commits | conflict review per sync |
| Light/high-contrast regression | Medium / high | paired token sets | visual/contrast tests |
| Screenshots overstate unrendered findings | Low / medium | evidence labels | review checklist |
| Fresh-engine authentication masks library view | Medium / low | label captures as shell/auth-entry evidence; repeat with approved seeded fixture | visual review gate |
| Browser runner cannot force light/reduced media | Medium / medium | unit-test token rules; capture in a runner with media emulation before Phase 2 | visual review gate |

Stop-ship: inaccessible required action, missing route, broken deep link, changed API/database behavior, cross-engine command, hidden advanced setting, failed import/save/backup confirmation, or inability to disable the new shell.
