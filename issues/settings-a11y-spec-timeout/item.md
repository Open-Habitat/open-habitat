---
created: 2026-10-26
updated: 2026-10-26
type: bug
reporter: conductor
status: fixed
priority: normal
lane: unlaned
collision: [web/tests/settings-three-pages.spec.ts]
preparation: ready
closed: 2026-10-26
---

# settings-three-pages @a11y spec exceeds its 30 s timeout under load

## Description

Blocks the v0.1.0-pilot.12 release (2026-10-26). In two full clean gates on
Alder (browser suite on Cedar), `web/tests/settings-three-pages.spec.ts:163`
"@a11y the three pages have no axe violations, light and dark, desktop and
phone" exceeded the 30 s test timeout waiting for `settings-section-koodipalvelut`.
It passes alone (5/5) and passed in the Birch gate. One test runs axe on three
pages × two themes × two viewports, so its runtime sits near the limit.

Fix the test's shape, not the timeout alone: split it into cases per
viewport/theme (or per page) so each has headroom, keeping the same coverage.

## Acceptance Criteria

- [x] Same axe coverage; each case well under the timeout on a loaded host.

