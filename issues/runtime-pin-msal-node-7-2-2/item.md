---
created: 2026-11-13
updated: 2026-11-14
type: chore
reporter: runtime-pin-watch
status: open
priority: normal
labels:
- runtime-pin
- runtime-pin:needs-work
provenance: other
provenance_detail: runtime pin watch
source_ref: runtime-pin:@azure/msal-node@7.2.2
lane: runtime-pins
lane_seq: 5
preparation: pending
---

# Runtime pin: @azure/msal-node 7.2.2 is available (pinned 5.6.0)

## Description

A newer stable upstream release of a runtime component that Open Habitat pins is available.

- Component: `@azure/msal-node` (npm:@azure/msal-node)
- Pinned on main: 5.6.0 in `runtime/profiles/integrations/package.json`
- New stable release: 7.2.2, published 2026-11-12
- Release: https://www.npmjs.com/package/@azure/msal-node/v/7.2.2

A research run assesses this release before it is scheduled and writes its
findings and a verdict (safe-to-bump, needs-work or hold) to research.md in
this issue directory. A safe-to-bump release is raised automatically; anything
else stays here for the conductor.

## Comments

### 2026-11-13T16:03:34Z · @runtime-pin-watch

Research verdict: needs-work; this release stays for the conductor.
